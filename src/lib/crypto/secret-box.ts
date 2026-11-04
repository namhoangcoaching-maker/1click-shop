import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Mã hóa khóa API của khách (Pancake…) trước khi lưu vào database.
 * Thuật toán AES-256-GCM: vừa giấu nội dung, vừa phát hiện nếu bản mã bị sửa.
 *
 * `context` (ví dụ "org-id:pancake_pos") được gắn vào bản mã: bản mã của shop A
 * chép sang dòng của shop B sẽ không giải mã được.
 *
 * Dạng lưu: "v1:<iv>:<tag>:<ciphertext>" (base64url). "v1" để sau này đổi cách mã hóa vẫn đọc được bản cũ.
 */

const VERSION = "v1";
const ALGO = "aes-256-gcm";

export function parseKey(base64: string | undefined): Buffer {
  if (!base64) throw new Error("Thiếu ENCRYPTION_KEY trong .env.local (xem HUONG_DAN.md).");
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY phải là 32 byte dạng base64.");
  return key;
}

export function encryptSecret(plain: string, context: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(":");
}

export function decryptSecret(sealed: string, context: string, key: Buffer): string {
  const [version, iv, tag, ct] = sealed.split(":");
  if (version !== VERSION || !iv || !tag || ct === undefined) {
    throw new Error("Bản mã không đúng định dạng.");
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** Vài ký tự cuối để hiện cho người dùng nhận ra khóa, ví dụ "••••a1b2". */
export function secretHint(plain: string): string {
  const s = plain.trim();
  return s.length <= 8 ? "••••" : `••••${s.slice(-4)}`;
}
