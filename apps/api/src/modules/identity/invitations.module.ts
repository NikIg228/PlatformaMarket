import { Module } from "@nestjs/common";
import { InvitationsController } from "./invitations.controller";
import { InvitationsService } from "./invitations.service";
import { MfaModule } from "./mfa.module";

@Module({ imports: [MfaModule], controllers: [InvitationsController], providers: [InvitationsService] })
export class InvitationsModule {}
