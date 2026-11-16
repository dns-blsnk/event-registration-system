import {
  CHAT_HISTORY_REQUEST_ID,
  CHAT_NAMESPACE,
  ChatEvent,
  ErrorCode,
  type ChatChunk,
  type ChatDone,
  type ChatError,
  type ChatHistory,
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

import { DomainError } from '../../common/errors/domain-error.js';
import { MINUTE_MS } from '../../common/time.js';
import { assistantQuestion, type AssistantQuestionRefusal } from '../../domain/assistant-prompt.js';

import { ChatAdmission } from './chat-admission.js';
import { ChatConversations } from './chat-conversations.js';
import { ChatFailures } from './chat-failures.js';
import { ChatHandshake, HANDSHAKE_REFUSED } from './chat-handshake.js';
import { type ChatOwner } from './chat-history.store.js';
import { fieldOf, parseChatQuestion } from './chat-question.js';

import type { ValidSession } from '../identity/index.js';
import type { ChatSocket } from './chat-socket.js';
import type { Namespace } from 'socket.io';

const REFUSALS: Readonly<Record<AssistantQuestionRefusal, string>> = {
  'empty-question': 'Type a question first.',
  'question-too-long': 'The question is too long.',
};

type ParsedQuestion = NonNullable<ReturnType<typeof parseChatQuestion>>;

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

  constructor(
    private readonly handshake: ChatHandshake,
    private readonly admission: ChatAdmission,
    private readonly conversations: ChatConversations,
    private readonly failures: ChatFailures,
  ) {}

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
          if (!(error instanceof DomainError)) this.failures.recordHandshakeCrash(error);
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

  /** Continues the chat the browser kept, or starts one. Every reconnect sends it, so it is free. */
  @SubscribeMessage(ChatEvent.RESUME)
  async resume(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    await this.sendHistory(socket, (owner) =>
      this.conversations.resume(owner, fieldOf(payload, 'chatId')),
    );
  }

  /** Forgets the current chat and starts an empty one; counted like a question. */
  @SubscribeMessage(ChatEvent.NEW_CHAT)
  async newChat(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    if (await this.isOverLimit(socket, CHAT_HISTORY_REQUEST_ID)) return;
    await this.sendHistory(socket, (owner) =>
      this.conversations.startNew(owner, fieldOf(payload, 'chatId')),
    );
  }

  @SubscribeMessage(ChatEvent.ASK)
  async ask(@ConnectedSocket() socket: ChatSocket, @MessageBody() payload: unknown): Promise<void> {
    if (await this.isOverLimit(socket, idOf(payload))) return;
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
      await this.answer(socket, question, controller.signal);
    } catch (error) {
      this.report(socket, question.id, error);
    } finally {
      if (this.answers.get(socket.id) === controller) this.answers.delete(socket.id);
    }
  }

  /** Closes connections whose session ended since they connected. */
  @Interval(MINUTE_MS)
  async sweepEndedSessions(): Promise<void> {
    const sockets = [...this.server.sockets.values()] as ChatSocket[];
    const live = await this.admission.liveSessionIds(
      sockets.map((socket) => socket.data.sessionId),
    );
    for (const socket of sockets) {
      if (!live.has(socket.data.sessionId)) socket.disconnect(true);
    }
  }

  /**
   * Answers a question after checking it and the session, with the user's current role: what the
   * user may see can change while the socket is open.
   */
  private async answer(socket: ChatSocket, question: ParsedQuestion, signal: AbortSignal) {
    const { id } = question;
    const text = assistantQuestion(question.question);
    if (typeof text !== 'string') {
      this.fail(socket, id, ErrorCode.VALIDATION_FAILED, REFUSALS[text.refusal]);
      return;
    }
    const live = await this.liveSession(socket, id);
    if (live === undefined) return;
    if (signal.aborted) {
      socket.emit(ChatEvent.DONE, { id, cancelled: true } satisfies ChatDone);
      return;
    }
    const { outcome, chatId } = await this.conversations.answer(
      {
        user: live.user,
        question: text,
        chatId: question.chatId,
        timeZone: question.timeZone,
        screen:
          question.resource === undefined
            ? undefined
            : { resource: question.resource, field: question.field },
      },
      {
        signal,
        onText: (chunk) => socket.emit(ChatEvent.CHUNK, { id, text: chunk } satisfies ChatChunk),
        onProgress: (progress) => socket.emit(ChatEvent.PROGRESS, { id, text: progress }),
        onNavigate: (list) => socket.emit(ChatEvent.NAVIGATE, { id, ...list }),
      },
    );
    socket.emit(ChatEvent.DONE, {
      id,
      cancelled: outcome === 'cancelled',
      ...(chatId === undefined ? {} : { chatId }),
    } satisfies ChatDone);
  }

  /**
   * The socket's session if it is still live; otherwise tells the client and closes the socket.
   * Checked on every message, since a session can end and a role can change while it is open.
   */
  private async liveSession(socket: ChatSocket, id: string): Promise<ValidSession | undefined> {
    const live = await this.admission.liveSession(socket.data.sessionId);
    if (live !== null) return live;
    this.fail(socket, id, ErrorCode.UNAUTHENTICATED, 'Your session has ended. Sign in again.');
    socket.disconnect(true);
    return undefined;
  }

  /**
   * Stops any answer still coming, then sends the chat the client should show. Failures carry
   * CHAT_HISTORY_REQUEST_ID, so the client can tell them from a failed question.
   */
  private async sendHistory(
    socket: ChatSocket,
    load: (owner: ChatOwner) => Promise<ChatHistory>,
  ): Promise<void> {
    this.answers.get(socket.id)?.abort();
    try {
      if ((await this.liveSession(socket, CHAT_HISTORY_REQUEST_ID)) === undefined) return;
      socket.emit(
        ChatEvent.HISTORY,
        await load({ userId: socket.data.userId, role: socket.data.role }),
      );
    } catch (error) {
      this.report(socket, CHAT_HISTORY_REQUEST_ID, error);
    }
  }

  /** Tells the client a question failed; ChatFailures logs why. */
  private report(socket: ChatSocket, id: string, error: unknown): void {
    const { code, message } = this.failures.record(socket.data.userId, error);
    this.fail(socket, id, code, message);
  }

  private fail(socket: ChatSocket, id: string, code: ErrorCode, message: string): void {
    socket.emit(ChatEvent.ERROR, { id, code, message } satisfies ChatError);
  }

  /**
   * Counts this message against the user's limit, readable or not, before any database work.
   * True after telling the client the message was refused.
   */
  private async isOverLimit(socket: ChatSocket, id: string): Promise<boolean> {
    try {
      if (await this.admission.isWithinLimit(socket.data.userId)) return false;
      this.fail(
        socket,
        id,
        ErrorCode.RATE_LIMITED,
        'Too many messages to the assistant. Wait a minute and try again.',
      );
    } catch (error) {
      const { code, message } = this.failures.record(
        socket.data.userId,
        error,
        'chat message limit check failed',
      );
      this.fail(socket, id, code, message);
    }
    return true;
  }
}

/** The client's question id if the payload carries a usable one, so even a refusal can be matched. */
function idOf(payload: unknown): string {
  const id = fieldOf(payload, 'id');
  return typeof id === 'string' ? id.slice(0, ID_ECHO_MAX_LENGTH) : '';
}

const ID_ECHO_MAX_LENGTH = 64;
