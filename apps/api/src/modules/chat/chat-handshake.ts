import { AppLogCategory, AppLogLevel, CHAT_NAMESPACE, ErrorCode } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { InjectConfig } from '../../config/config.module.js';
import { AppLogService } from '../app-logs/app-log.service.js';
import { SessionService } from '../auth/session/session.service.js';

import { ChatTicketStore } from './chat-tickets.js';

import type { Config } from '../../config/config.schema.js';
import type { ChatSocket, ChatSocketData } from './chat-socket.js';

/** The refusal text the client gets; the reason stays in the security journal. */
export const HANDSHAKE_REFUSED = 'not allowed';

/**
 * Decides who a new chat socket is. It must come from the admin's origin and carry an unspent
 * ticket whose session is still live; anything else is refused and journalled as a security event.
 */
@Injectable()
export class ChatHandshake {
  constructor(
    private readonly tickets: ChatTicketStore,
    private readonly sessions: SessionService,
    private readonly journal: AppLogService,
    @InjectConfig() private readonly config: Config,
  ) {}

  async identify(socket: ChatSocket): Promise<ChatSocketData> {
    if (socket.handshake.headers.origin !== this.config.adminOrigin) {
      this.refuse(socket, 'Chat handshake refused: foreign origin');
    }
    const holder = await this.tickets.consume(socket.handshake.auth.ticket);
    if (holder === undefined) {
      this.refuse(socket, 'Chat handshake refused: missing, spent or expired ticket');
    }
    const live = await this.sessions.findLiveById(holder.sessionId);
    if (live === null) {
      this.refuse(socket, "Chat handshake refused: the ticket's session has ended");
    }
    return { userId: live.user.id, sessionId: live.session.id, role: live.user.role };
  }

  private refuse(socket: ChatSocket, reason: string): never {
    this.journal.record({
      level: AppLogLevel.WARN,
      category: AppLogCategory.SECURITY,
      message: reason,
      route: CHAT_NAMESPACE,
      ...(socket.handshake.address === '' ? {} : { ip: socket.handshake.address }),
    });
    throw new DomainError(ErrorCode.UNAUTHENTICATED, HANDSHAKE_REFUSED);
  }
}
