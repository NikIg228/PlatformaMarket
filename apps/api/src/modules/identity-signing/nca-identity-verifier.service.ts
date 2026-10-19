import { Injectable } from "@nestjs/common";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { environment } from "../../platform/config/environment";
import { identityVerificationSchema, type IdentityVerification, type IdentityVerifierInput } from "./identity-verifier.contract";

const unavailable = (): IdentityVerification => ({ protocol: 1, status: "REJECTED", code: "VERIFIER_UNAVAILABLE" });
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

@Injectable()
export class NcaIdentityVerifierService {
  private running = 0;
  configured() {
    const config = environment();
    return Boolean(config.NCA_IDENTITY_JAVA_PATH && config.NCA_IDENTITY_CLASSPATH && config.NCA_IDENTITY_POLICY_PATH && config.NCA_IDENTITY_POLICY_SHA256);
  }
  async verify(input: IdentityVerifierInput): Promise<IdentityVerification> {
    const config = environment();
    if (!this.configured() || this.running >= 2) return unavailable();
    if (input.original.length === 0 || input.original.length > 98304 || input.cms.length === 0 || input.cms.length > 1048576) {
      return { protocol: 1, status: "REJECTED", code: "INVALID_SIGNATURE" };
    }
    this.running++;
    try {
      const policy = await readFile(config.NCA_IDENTITY_POLICY_PATH!);
      if (sha256(policy) !== config.NCA_IDENTITY_POLICY_SHA256) return unavailable();
      const output = await this.execute(config.NCA_IDENTITY_JAVA_PATH!, ["-Xmx256m", "-cp", config.NCA_IDENTITY_CLASSPATH!,
        "NcaIdentityVerifier", config.NCA_IDENTITY_POLICY_PATH!, config.NCA_IDENTITY_POLICY_SHA256!, config.NODE_ENV === "production" ? "production" : "test"],
      [input.original.toString("base64"), input.cms.toString("base64"), input.createdAt.toISOString(), input.acceptedAt.toISOString(), ""].join("\n"));
      const parsed = identityVerificationSchema.safeParse(JSON.parse(output));
      if (!parsed.success) return unavailable();
      const result = parsed.data;
      if (result.status === "VERIFIED") {
        if (result.policySha256 !== config.NCA_IDENTITY_POLICY_SHA256 || result.originalSha256 !== sha256(input.original) || result.cmsSha256 !== sha256(input.cms) ||
          (config.NODE_ENV === "production" && result.trustProfile !== "PRODUCTION")) return unavailable();
        const now = Date.now();
        if (Math.abs(Date.parse(result.verifiedAt) - now) > 120_000 || Date.parse(result.validFrom) > now || Date.parse(result.validUntil) <= now) return unavailable();
        for (const crl of result.revocations) {
          if (Date.parse(crl.thisUpdate) > now || Date.parse(crl.nextUpdate) <= now || sha256(Buffer.from(crl.contentBase64, "base64")) !== crl.sha256) return unavailable();
        }
      }
      return result;
    } catch { return unavailable(); }
    finally { this.running--; }
  }
  private execute(binary: string, args: string[], input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // No shell, certificate paths or user input in argv; CMS goes only through stdin.
      const child = spawn(binary, args, { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
      const chunks: Buffer[] = []; let bytes = 0, settled = false;
      const fail = () => { if (settled) return; settled = true; clearTimeout(timer); child.kill(); reject(new Error("Verifier unavailable")); };
      const timer = setTimeout(fail, 45_000);
      child.stdout.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 44_000_000) fail(); else chunks.push(chunk); });
      child.on("error", fail); child.stdin.on("error", fail);
      child.on("close", code => {
        if (settled) return; settled = true; clearTimeout(timer);
        if (code !== 0) reject(new Error("Verifier unavailable")); else resolve(Buffer.concat(chunks).toString("utf8"));
      });
      child.stdin.end(input);
    });
  }
}
