import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { vaultService } from "../src/services/security/vault.service";

describe("VaultService - AES-256-GCM Envelope Encryption & Tamper Detection", () => {
  test("encrypts and decrypts secrets cleanly across diverse payloads (round-trip)", () => {
    const payloads = [
      "sk-live-51N0Abc123SecretApiKey",
      JSON.stringify({ apiKey: "groq-xyz", tenant: "acme-corp", tokens: 5000 }),
      "Special characters: !@#$%^&*()_+-=[]{}|;':,.<>/?`~ 🚀 🧠",
      "Multi-line\nSecret\nValue\nWith\nIndents",
    ];

    for (const secret of payloads) {
      const encrypted = vaultService.encryptSecret(secret);
      assert.notStrictEqual(encrypted, secret);
      assert.ok(encrypted.startsWith("v1:"));

      const decrypted = vaultService.decryptSecret(encrypted);
      assert.strictEqual(decrypted, secret);
    }
  });

  test("generates unique IVs on every encryption call (cryptographic non-repeating nonce)", () => {
    const plaintext = "identical-shared-secret-value";
    const enc1 = vaultService.encryptSecret(plaintext);
    const enc2 = vaultService.encryptSecret(plaintext);

    assert.notStrictEqual(enc1, enc2);

    const parts1 = enc1.split(":");
    const parts2 = enc2.split(":");

    // Verify format: v1:<ivHex>:<authTagHex>:<ciphertextHex>
    assert.strictEqual(parts1.length, 4);
    assert.strictEqual(parts2.length, 4);

    const iv1 = parts1[1];
    const iv2 = parts2[1];
    assert.notStrictEqual(iv1, iv2);
    assert.strictEqual(iv1.length, 24); // 12 bytes = 24 hex chars
    assert.strictEqual(iv2.length, 24);

    // Both still decrypt back to the identical plaintext
    assert.strictEqual(vaultService.decryptSecret(enc1), plaintext);
    assert.strictEqual(vaultService.decryptSecret(enc2), plaintext);
  });

  test("tamper detection: throws authentication error if ciphertext is mutated", () => {
    const plaintext = "sensitive-database-password-9921";
    const encrypted = vaultService.encryptSecret(plaintext);
    const parts = encrypted.split(":");

    // Flip the last character of ciphertext
    const originalCiphertext = parts[3];
    const mutatedChar = originalCiphertext.endsWith("a") ? "b" : "a";
    parts[3] = originalCiphertext.slice(0, -1) + mutatedChar;
    const tampered = parts.join(":");

    assert.throws(
      () => vaultService.decryptSecret(tampered),
      /Failed to decrypt secret: authentication tag mismatch or corrupted ciphertext/
    );
  });

  test("tamper detection: throws authentication error if authTag is altered", () => {
    const plaintext = "api-access-token-live-environment";
    const encrypted = vaultService.encryptSecret(plaintext);
    const parts = encrypted.split(":");

    // Mutate the authTag
    const originalTag = parts[2];
    const mutatedTag = originalTag.endsWith("0") ? originalTag.slice(0, -1) + "1" : originalTag.slice(0, -1) + "0";
    parts[2] = mutatedTag;
    const tampered = parts.join(":");

    assert.throws(
      () => vaultService.decryptSecret(tampered),
      /Failed to decrypt secret: authentication tag mismatch or corrupted ciphertext/
    );
  });

  test("tamper detection: throws error if IV length or version is corrupted", () => {
    const encrypted = vaultService.encryptSecret("test-secret");
    const parts = encrypted.split(":");

    // Truncate IV
    const corruptedIvPayload = [parts[0], parts[1].slice(0, 10), parts[2], parts[3]].join(":");
    assert.throws(
      () => vaultService.decryptSecret(corruptedIvPayload),
      /Invalid IV length/
    );

    // Corrupt version
    const corruptedVersionPayload = ["v2", parts[1], parts[2], parts[3]].join(":");
    assert.throws(
      () => vaultService.decryptSecret(corruptedVersionPayload),
      /Unsupported payload version/
    );
  });

  test("maskSecret produces safe masked hints without leaking credentials", () => {
    assert.strictEqual(vaultService.maskSecret("sk-live-1234567890abcdef"), "••••••••cdef");
    assert.strictEqual(vaultService.maskSecret("abcd"), "••••");
    assert.strictEqual(vaultService.maskSecret(""), "••••••••");
  });
});
