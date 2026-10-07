import crypto from "crypto";
import { logger } from "../../config/logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
const VERSION_PREFIX = "v1";

let cachedMasterKey: Buffer | null = null;

/**
 * Resolves the 32-byte master key for AES-256-GCM.
 * Strictly throws in production if VAULT_MASTER_KEY is missing.
 * In development, derives a deterministic fallback key with a warning.
 */
function getMasterKey(): Buffer {
  if (cachedMasterKey) {
    return cachedMasterKey;
  }

  const rawKey = process.env.VAULT_MASTER_KEY;
  const isProduction = process.env.NODE_ENV === "production";

  if (rawKey) {
    // 64-character hex string (32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      cachedMasterKey = Buffer.from(rawKey, "hex");
      return cachedMasterKey;
    }
    // 44-character base64 string (32 bytes)
    if (/^[A-Za-z0-9+/]{43}=$/.test(rawKey)) {
      cachedMasterKey = Buffer.from(rawKey, "base64");
      return cachedMasterKey;
    }
    // Otherwise hash key to guarantee exact 256 bits (32 bytes)
    cachedMasterKey = crypto.createHash("sha256").update(rawKey).digest();
    return cachedMasterKey;
  }

  if (isProduction) {
    throw new Error(
      "FATAL SECURITY ERROR: VAULT_MASTER_KEY environment variable is required in production!"
    );
  }

  logger.warn(
    "[SECURITY WARNING] VAULT_MASTER_KEY is missing in development. Using deterministic dev fallback key. NEVER USE IN PRODUCTION."
  );
  cachedMasterKey = crypto
    .createHash("sha256")
    .update("cognify-dev-vault-fallback-master-key-32b")
    .digest();
  return cachedMasterKey;
}

export const vaultService = {
  /**
   * Encrypts a plaintext secret using AES-256-GCM with a random 12-byte IV.
   * Format: v1:<ivHex>:<authTagHex>:<ciphertextHex>
   */
  encryptSecret(plaintext: string): string {
    if (typeof plaintext !== "string") {
      throw new Error("Plaintext secret must be a string");
    }

    const key = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${VERSION_PREFIX}:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
  },

  /**
   * Decrypts an envelope payload encrypted with encryptSecret.
   * Authenticates payload integrity via the GCM authentication tag.
   */
  decryptSecret(payload: string): string {
    if (!payload || typeof payload !== "string") {
      throw new Error("Encrypted payload must be a non-empty string");
    }

    const parts = payload.split(":");
    if (parts.length !== 4) {
      throw new Error("Invalid envelope payload format: expected 4 segments");
    }

    const [version, ivHex, authTagHex, ciphertextHex] = parts;
    if (version !== VERSION_PREFIX) {
      throw new Error(`Unsupported payload version: ${version}`);
    }

    const key = getMasterKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes`);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    try {
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return decrypted.toString("utf8");
    } catch (err: any) {
      throw new Error(
        `Failed to decrypt secret: authentication tag mismatch or corrupted ciphertext (${err.message})`
      );
    }
  },

  /**
   * Helper to produce a masked hint for safe client representation.
   * Never leaks the full secret, e.g. "••••••••abcd".
   */
  maskSecret(secret: string): string {
    if (!secret) return "••••••••";
    const trimmed = secret.trim();
    if (trimmed.length <= 4) return "••••";
    const last4 = trimmed.slice(-4);
    return `••••••••${last4}`;
  },
};
