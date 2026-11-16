import { Module } from '@nestjs/common';
import OpenAI from 'openai';

import { APP_CONFIG } from '../../config/config.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { EventsModule } from '../events/events.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { RegistrationsModule } from '../registrations/registrations.module.js';
import { SessionsModule } from '../sessions/sessions.module.js';
import { TagsModule } from '../tags/tags.module.js';

import { ChatAdmission } from './chat-admission.js';
import {
  AI_CLIENT,
  CHAT_MODEL,
  CHAT_REASONING_EFFORT,
  ChatAnswerService,
} from './chat-answer.service.js';
import { ChatConversations } from './chat-conversations.js';
import { ChatFailures } from './chat-failures.js';
import { ChatHandshake } from './chat-handshake.js';
import { ChatHistoryStore } from './chat-history.store.js';
import { ChatTicketStore } from './chat-tickets.js';
import { ChatController } from './chat.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatToolbox, TOOL_CLASSES } from './tools/chat-toolbox.js';

import type { Config } from '../../config/config.schema.js';

/**
 * No SDK retries: the user is waiting and can ask again, and a retry would honour the provider's
 * Retry-After (up to a minute on a free-tier 429), which is longer than the answer deadline and
 * would turn "busy" into "took too long".
 */
const ANSWER_MAX_RETRIES = 0;

@Module({
  imports: [
    IdentityModule,
    EventsModule,
    SessionsModule,
    RegistrationsModule,
    CustomersModule,
    TagsModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatTicketStore,
    ChatHistoryStore,
    ChatConversations,
    ChatToolbox,
    ...TOOL_CLASSES,
    ChatAdmission,
    ChatAnswerService,
    ChatFailures,
    ChatGateway,
    ChatHandshake,
    {
      provide: AI_CLIENT,
      inject: [APP_CONFIG],
      // Without a key the admin still works; the chat answers "not available".
      useFactory: (config: Config) =>
        config.ai.apiKey === undefined
          ? undefined
          : new OpenAI({
              apiKey: config.ai.apiKey,
              baseURL: config.ai.baseUrl,
              maxRetries: ANSWER_MAX_RETRIES,
            }),
    },
    { provide: CHAT_MODEL, inject: [APP_CONFIG], useFactory: (config: Config) => config.ai.model },
    {
      provide: CHAT_REASONING_EFFORT,
      inject: [APP_CONFIG],
      useFactory: (config: Config) => config.ai.reasoningEffort,
    },
  ],
})
export class ChatModule {}
