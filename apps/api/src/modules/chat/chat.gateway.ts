import {
  CHAT_NAMESPACE,
  ChatEvent,
  ErrorCode,
  type ChatChunk,
  type ChatDone,
  type ChatError,
} from '@ers/shared';
import { Interval } from '@nestjs/schedule';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import { PinoLogger } from 'nestjs-pino';

import { DomainError } from '../../common/errors/domain-error.js';
import { MINUTE_MS } from '../../common/time.js';
import {
  buildChatPrompt,
  type ChatPrompt,
  type ChatPromptRefusal,
} from '../../domain/chat-prompt.js';
import { RateWindow } from '../app-logs/rate-window.js';
import { SessionService } from '../auth/session.service.js';

import { ChatAnswerService } from './chat-answer.service.js';
import { ChatHandshake, HANDSHAKE_REFUSED } from './chat-handshake.js';
import { parseChatQuestion } from './chat-question.js';

import type { ChatSocket } from './chat-socket.js';
import type { Namespace } from 'socket.io';

/** A person asks a few questions a minute; more is a script spending the model budget. */
const MESSAGES_PER_MINUTE = 10;

const REFUSALS: Readonly<Record<ChatPromptRefusal, { code: ErrorCode; message: string }>> = {
  'empty-question': { code: ErrorCode.VALIDATION_FAILED, message: 'Type a question first.' },
  'question-too-long': { code: ErrorCode.VALIDATION_FAILED, message: 'The question is too long.' },
  'unknown-form': { code: ErrorCode.VALIDATION_FAILED, message: 'This screen has no help.' },
  'form-not-allowed': {
    code: ErrorCode.FORBIDDEN,
    message: 'You cannot get help with this screen.',
  },
};

/**
 * The help chat over Socket.IO. The browser connects to the API host directly (the admin's host
 * cannot proxy WebSockets), so it proves who it is with a one-time ticket from the CSRF-checked
 * REST API, and the origin is checked against the admin's. A connection only lives as long as its
 * session: it is checked on every question (with the current role) and swept every minute.
 */
@WebSocketGateway({ namespace: CHAT_NAMESPACE, transports: ['websocket'] })
export class ChatGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() private readonly server!: Namespace;
  /** The answer each connection is waiting for; a new question or a cancel stops it. */
  private readonly answers = new Map<string, AbortController>();
  private readonly limits = new Map<string, RateWindow>();

  constructor(
    private readonly handshake: ChatHandshake,
    private readonly sessions: SessionService,
    private readonly answerService: ChatAnswerService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ChatGateway.name);
  }

  afterInit(namespace: Namespace): void {
    namespace.use((socket, next) => {
      const chatSocket = socket as ChatSocket;
      void this.handshake.identify(chatSocket).then(
        (data) => {
          chatSocket.data = data;
          next();
        },
        (error: unknown) => {
          // A refusal is journalled by the handshake; anything else (the database down) is an outage.
          if (!(error instanceof DomainError))
            this.logger.error({ err: error }, 'chat handshake failed');
          next(new Error(HANDSHAKE_REFUSED));
        },
      );
    });
  }

  handleDisconnect(socket: ChatSocket): void {
    this.answers.get(socket.id)?.abort();
    this.answers.delete(socket.id);
  }

  @SubscribeMessage(ChatEvent.CANCEL)
  cancel(@ConnectedSocket() socket: ChatSocket): void {
    this.answers.get(socket.id)?.abort();
  }

  @SubscribeMessage(ChatEvent.ASK)
  async ask(@ConnectedSocket() socket: ChatSocket, @MessageBody() payload: unknown): Promise<void> {
    // Every message counts, readable or not, before any database work.
    if (!this.limitFor(socket.data.userId).tryAccept()) {
      this.fail(
        socket,
        idOf(payload),
        ErrorCode.RATE_LIMITED,
        'Too many questions. Wait a minute and try again.',
      );
      return;
    }
    const question = parseChatQuestion(payload);
    if (question === undefined) {
      this.fail(
        socket,
        idOf(payload),
        ErrorCode.VALIDATION_FAILED,
        'The question could not be read.',
      );
      return;
    }
    // Registered before any await, so a cancel or a disconnect from here on stops this question.
    this.answers.get(socket.id)?.abort();
    const controller = new AbortController();
    this.answers.set(socket.id, controller);
    try {
      const prompt = await this.promptFor(socket, question);
      if (prompt !== undefined && !controller.signal.aborted) {
        await this.stream(socket, question.id, prompt, controller.signal);
      } else if (prompt !== undefined) {
        socket.emit(ChatEvent.DONE, { id: question.id, cancelled: true } satisfies ChatDone);
      }
    } catch (error) {
      this.report(socket, question.id, error);
    } finally {
      if (this.answers.get(socket.id) === controller) this.answers.delete(socket.id);
    }
  }

  /** Closes connections whose session ended since they connected, and forgets idle users' limits. */
  @Interval(MINUTE_MS)
  async sweepEndedSessions(): Promise<void> {
    const sockets = [...this.server.sockets.values()] as ChatSocket[];
    const live = await this.sessions.liveIds(sockets.map((socket) => socket.data.sessionId));
    for (const socket of sockets) {
      if (!live.has(socket.data.sessionId)) socket.disconnect(true);
    }
    const connectedUsers = new Set(sockets.map((socket) => socket.data.userId));
    for (const userId of this.limits.keys()) {
      if (!connectedUsers.has(userId)) this.limits.delete(userId);
    }
  }

  /** The prompt for a question, or undefined after telling the client why there is none. */
  private async promptFor(
    socket: ChatSocket,
    question: NonNullable<ReturnType<typeof parseChatQuestion>>,
  ): Promise<ChatPrompt | undefined> {
    const live = await this.sessions.findLiveById(socket.data.sessionId);
    if (live === null) {
      this.fail(
        socket,
        question.id,
        ErrorCode.UNAUTHENTICATED,
        'Your session has ended. Sign in again.',
      );
      socket.disconnect(true);
      return undefined;
    }
    // The current role, not the one at connect time: what the user may see can change.
    const prompt = buildChatPrompt({ role: live.user.role, ...question });
    if (typeof prompt === 'string') {
      this.fail(socket, question.id, REFUSALS[prompt].code, REFUSALS[prompt].message);
      return undefined;
    }
    return prompt;
  }

  private async stream(
    socket: ChatSocket,
    id: string,
    prompt: ChatPrompt,
    signal: AbortSignal,
  ): Promise<void> {
    const outcome = await this.answerService.answer(prompt, {
      signal,
      onText: (text) => {
        socket.emit(ChatEvent.CHUNK, { id, text } satisfies ChatChunk);
      },
    });
    socket.emit(ChatEvent.DONE, { id, cancelled: outcome === 'cancelled' } satisfies ChatDone);
  }

  /** Tells the client a question failed and logs why; the question text is never logged. */
  private report(socket: ChatSocket, id: string, error: unknown): void {
    if (error instanceof DomainError) {
      this.logger.warn(
        { err: error.cause ?? error, userId: socket.data.userId, code: error.code },
        'chat answer failed',
      );
      this.fail(socket, id, error.code, error.message);
      return;
    }
    this.logger.error({ err: error, userId: socket.data.userId }, 'chat answer crashed');
    this.fail(socket, id, ErrorCode.INTERNAL_ERROR, 'Something went wrong. Please try again.');
  }

  private fail(socket: ChatSocket, id: string, code: ErrorCode, message: string): void {
    socket.emit(ChatEvent.ERROR, { id, code, message } satisfies ChatError);
  }

  private limitFor(userId: string): RateWindow {
    let limit = this.limits.get(userId);
    if (limit === undefined) {
      limit = new RateWindow(MESSAGES_PER_MINUTE, MINUTE_MS);
      this.limits.set(userId, limit);
    }
    return limit;
  }
}

/** The client's question id if the payload carries a usable one, so even a refusal can be matched. */
function idOf(payload: unknown): string {
  const id: unknown =
    typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>).id
      : undefined;
  return typeof id === 'string' ? id.slice(0, ID_ECHO_MAX_LENGTH) : '';
}

const ID_ECHO_MAX_LENGTH = 64;
