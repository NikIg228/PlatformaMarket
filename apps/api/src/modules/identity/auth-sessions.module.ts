import { Module } from "@nestjs/common";
import { AuthSessionsController } from "./auth-sessions.controller";
import { AuthSessionsService } from "./auth-sessions.service";
import { OidcVerifierService } from "./oidc-verifier.service";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { RegistrationResumeController } from "./registration-resume.controller";
import { RegistrationResumeService } from "./registration-resume.service";
import { PersonalProfileController } from "./personal-profile.controller";
import { PersonalProfileService } from "./personal-profile.service";

@Module({ imports: [OnboardingModule], controllers: [AuthSessionsController, RegistrationResumeController, PersonalProfileController], providers: [AuthSessionsService, OidcVerifierService, RegistrationResumeService, PersonalProfileService], exports: [AuthSessionsService] })
export class AuthSessionsModule {}
