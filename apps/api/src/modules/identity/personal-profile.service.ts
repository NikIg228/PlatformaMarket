import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { AVATAR_MAX_BYTES, personalProfileSchema, type UpdatePersonalProfile, type RequestProfileEmail, type UploadProfileAvatar } from "@marketplace/schemas";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { FileUploadPolicyService } from "../../platform/security/file-upload-policy.service";
import { ObjectStorageService } from "../../platform/storage/object-storage.service";
import { environment } from "../../platform/config/environment";
import { deliverAuthMail, requireAuthMail } from "./auth-mail.delivery";

type Actor = { actorId: string; organizationId: string; sessionId: string };
type Database = Prisma.TransactionClient;
const conflict = () => new ConflictException("Профиль изменился. Обновите данные и повторите сохранение.");

@Injectable()
export class PersonalProfileService {
  constructor(private readonly prisma: PrismaService, private readonly uploads: FileUploadPolicyService, private readonly storage: ObjectStorageService) {}

  private async actor(context: Actor, db: Database = this.prisma) {
    if (!context.actorId || !context.organizationId || !context.sessionId) throw new UnauthorizedException("Войдите в кабинет заново");
    const session = await db.authSession.findFirst({ where: { id: context.sessionId, userId: context.actorId, status: "ACTIVE", expiresAt: { gt: new Date() },
      user: { status: "ACTIVE", memberships: { some: { organizationId: context.organizationId, status: "ACTIVE", organization: { status: "ACTIVE" } } } } }, include: { user: true } });
    if (!session) throw new UnauthorizedException("Сеанс недоступен. Войдите заново");
    return session.user;
  }

  async current(context: Actor) {
    const user = await this.actor(context);
    return personalProfileSchema.parse({ id: user.id, displayName: user.displayName, email: user.email, phone: user.phone, avatarAssetId: user.avatarAssetId, version: user.profileVersion });
  }

  private async update(db: Database, context: Actor, expectedVersion: number, data: Prisma.UserUpdateManyMutationInput, action: string) {
    await this.actor(context, db);
    const changed = await db.user.updateMany({ where: { id: context.actorId, status: "ACTIVE", profileVersion: expectedVersion }, data: { ...data, profileVersion: { increment: 1 } } });
    if (changed.count !== 1) throw conflict();
    await db.auditLog.create({ data: { actorId: context.actorId, organizationId: context.organizationId, action, entityType: "User", entityId: context.actorId,
      after: { version: expectedVersion + 1 } } });
  }

  async save(input: UpdatePersonalProfile, context: Actor) {
    const { expectedVersion, ...fields } = input;
    await this.prisma.$transaction(tx => this.update(tx, context, expectedVersion, fields, "identity.profile.updated"));
    return this.current(context);
  }

  async requestEmail(input: RequestProfileEmail, context: Actor) {
    const user = await this.actor(context);
    if (user.profileVersion !== input.expectedVersion) throw conflict();
    if (user.email === input.email) throw new ConflictException("Этот адрес уже используется в вашем профиле");
    const config = environment(); requireAuthMail(config);
    const raw = randomBytes(48).toString("base64url");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const expiresAt = new Date(Date.now() + config.AUTH_EMAIL_VERIFICATION_TTL_HOURS * 3_600_000);
    await this.prisma.$transaction(async tx => {
      await this.update(tx, context, input.expectedVersion, {}, "identity.email.change.requested");
      await tx.emailAuthToken.deleteMany({ where: { userId: user.id, type: "EMAIL_VERIFICATION", consumedAt: null, metadata: { path: ["purpose"], equals: "profile-email" } } });
      await tx.emailAuthToken.create({ data: { userId: user.id, type: "EMAIL_VERIFICATION", tokenHash, expiresAt,
        metadata: { purpose: "profile-email", email: input.email, previousEmail: user.email, sessionId: context.sessionId } } });
    });
    try {
      const delivery = await deliverAuthMail(config, { to: input.email, subject: "Подтвердите новую почту — PlatformaMarket",
        text: `Подтвердите новый адрес электронной почты:\n${config.AUTH_EMAIL_BASE_URL}/verify-email?token=${encodeURIComponent(raw)}\n\nДо подтверждения входите по прежнему адресу. Ссылка действует до ${expiresAt.toISOString()}.` });
      return { ok: true as const, verificationRequired: true as const, email: input.email, delivery };
    } catch (error) {
      await this.prisma.emailAuthToken.deleteMany({ where: { tokenHash, consumedAt: null } });
      throw error;
    }
  }

  async uploadAvatar(input: UploadProfileAvatar, context: Actor) {
    const user = await this.actor(context);
    if (user.profileVersion !== input.expectedVersion) throw conflict();
    const asset = await this.uploads.quarantine({ organizationId: context.organizationId, actorId: context.actorId, purpose: "profile-avatar", fileName: input.fileName,
      body: this.uploads.decodeBase64(input.contentBase64, AVATAR_MAX_BYTES), allowedKinds: ["PNG", "JPEG"], maxBytes: AVATAR_MAX_BYTES });
    try {
      await this.prisma.$transaction(async tx => {
        await this.update(tx, context, input.expectedVersion, { avatarAssetId: asset.id }, "identity.avatar.updated");
        await tx.uploadAsset.update({ where: { id: asset.id }, data: { metadata: { profileUserId: user.id } } });
        // Let the existing unlinked-upload cleanup reclaim replaced assets safely.
        if (user.avatarAssetId) await tx.uploadAsset.updateMany({ where: { id: user.avatarAssetId, uploadedById: user.id, purpose: "profile-avatar" }, data: { metadata: Prisma.DbNull } });
      });
    } catch (error) { await this.uploads.release(asset.id, "Avatar was not linked"); throw error; }
    return this.current(context);
  }

  async avatar(context: Actor) {
    const user = await this.actor(context);
    if (!user.avatarAssetId) throw new NotFoundException("Фото профиля не установлено");
    const asset = await this.prisma.uploadAsset.findFirst({ where: { id: user.avatarAssetId, uploadedById: user.id, purpose: "profile-avatar", status: "CLEAN", deletedAt: null, metadata: { equals: { profileUserId: user.id } } } });
    if (!asset || !["image/png", "image/jpeg"].includes(asset.detectedMime ?? "")) throw new NotFoundException("Фото профиля недоступно");
    return { contentType: asset.detectedMime!, contentBase64: (await this.storage.get(asset.storageKey)).toString("base64") };
  }
}
