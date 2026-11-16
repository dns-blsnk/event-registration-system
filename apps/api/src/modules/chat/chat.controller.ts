import { type ChatStatus, type ChatTicket } from '@ers/shared';
import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { SignedIn } from '../../common/auth/access.decorator.js';
import { CurrentAuth } from '../../common/auth/current-user.decorator.js';
import { MINUTE_MS } from '../../common/time.js';

import { ChatAnswerService } from './chat-answer.service.js';
import { ChatTicketStore } from './chat-tickets.js';

import type { AuthContext } from '../../common/auth/auth-context.js';

/**
 * A person opens a few chats a minute. The throttler runs before authentication, so it counts per
 * client address; the allowance leaves room for several people behind one office address.
 */
const TICKETS_PER_MINUTE = 30;

@Controller('chat')
export class ChatController {
  constructor(
    private readonly tickets: ChatTicketStore,
    private readonly answers: ChatAnswerService,
  ) {}

  /** Lets the widget say "assistant unavailable" up front instead of failing on every question. */
  @SignedIn()
  @Get('status')
  status(): ChatStatus {
    return { isAvailable: this.answers.isAvailable };
  }

  /** Every role may use the help chat; the CSRF guard protects this like any other POST. */
  @SignedIn()
  @Post('ticket')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: TICKETS_PER_MINUTE, ttl: MINUTE_MS } })
  async ticket(@CurrentAuth() auth: AuthContext): Promise<ChatTicket> {
    // Without a model key there is nothing to connect to; the widget checks the status first.
    this.answers.assertAvailable();
    const { ticket, expiresAt } = await this.tickets.issue({
      userId: auth.user.id,
      sessionId: auth.session.id,
    });
    return { ticket, expiresAt: expiresAt.toISOString() };
  }
}
