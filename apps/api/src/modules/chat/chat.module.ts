import Anthropic from '@anthropic-ai/sdk';
import { Module } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.module.js';
import { AuthModule } from '../auth/auth.module.js';

import { ANTHROPIC_CLIENT, CHAT_MODEL, ChatAnswerService } from './chat-answer.service.js';
import { ChatFailures } from './chat-failures.js';
import { ChatHandshake } from './chat-handshake.js';
import { ChatTicketStore } from './chat-tickets.js';
import { ChatController } from './chat.controller.js';
import { ChatGateway } from './chat.gateway.js';

import type { Config } from '../../config/config.schema.js';

/** One retry is enough for a help answer; the user is waiting and can ask again. */
const ANSWER_MAX_RETRIES = 1;

@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  providers: [
    ChatTicketStore,
    ChatAnswerService,
    ChatFailures,
    ChatGateway,
    ChatHandshake,
    {
      provide: ANTHROPIC_CLIENT,
      inject: [APP_CONFIG],
      // Without a key the admin still works; the chat answers "not available".
      // The service's own deadline covers the whole answer, retries included.
      useFactory: (config: Config) =>
        config.ai.apiKey === undefined
          ? undefined
          : new Anthropic({ apiKey: config.ai.apiKey, maxRetries: ANSWER_MAX_RETRIES }),
    },
    { provide: CHAT_MODEL, inject: [APP_CONFIG], useFactory: (config: Config) => config.ai.model },
  ],
  // One ticket store per app: the socket gateway must see the tickets this controller issues.
  exports: [ChatTicketStore, ChatAnswerService],
})
export class ChatModule {}
