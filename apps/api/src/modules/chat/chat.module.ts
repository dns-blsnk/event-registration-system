import { Module } from '@nestjs/common';

import { ChatTicketStore } from './chat-tickets.js';
import { ChatController } from './chat.controller.js';

@Module({
  controllers: [ChatController],
  providers: [ChatTicketStore],
  // One store per app: the socket gateway must see the tickets this controller issues.
  exports: [ChatTicketStore],
})
export class ChatModule {}
