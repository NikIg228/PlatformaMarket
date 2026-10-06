import { Module } from "@nestjs/common";
import { SupportController } from "./support.controller";
import { SupportService } from "./support.service";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { SupportAttachmentsController } from "./support-attachments.controller";
import { SupportAttachmentsService } from "./support-attachments.service";

@Module({ controllers: [SupportController, ConversationsController, SupportAttachmentsController], providers: [SupportService, ConversationsService, SupportAttachmentsService], exports: [SupportService] })
export class SupportModule {}
