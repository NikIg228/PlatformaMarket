import { Module } from "@nestjs/common";
import { IdentitySigningStore } from "../identity-signing/identity-signing.store";
import { SigningAdmissionController } from "./signing-admission.controller";
import { SigningAdmissionRules } from "./signing-admission.rules";
import { SigningAdmissionService } from "./signing-admission.service";
import { SigningAdmissionStore } from "./signing-admission.store";

@Module({ controllers: [SigningAdmissionController], providers: [IdentitySigningStore, SigningAdmissionRules, SigningAdmissionService, SigningAdmissionStore] })
export class SigningAdmissionModule {}
