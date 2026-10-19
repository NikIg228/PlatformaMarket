import { Module } from "@nestjs/common";
import { IdentitySigningController } from "./identity-signing.controller";
import { IdentitySigningService } from "./identity-signing.service";
import { IdentitySigningStore } from "./identity-signing.store";
import { IdentitySigningProcessor } from "./identity-signing.processor";
import { NcaIdentityVerifierService } from "./nca-identity-verifier.service";

@Module({ controllers: [IdentitySigningController], providers: [IdentitySigningService, IdentitySigningStore, IdentitySigningProcessor, NcaIdentityVerifierService] })
export class IdentitySigningModule {}
