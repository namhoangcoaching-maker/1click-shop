import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, parseKey, secretHint } from "./secret-box";

const key = randomBytes(32);
const ctx = "org-a:pancake_pos";

describe("encryptSecret / decryptSecret", () => {
  it("mã hóa rồi giải mã ra đúng khóa ban đầu", () => {
    const sealed = encryptSecret("pancake-key-123", ctx, key);
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain("pancake-key-123");
    expect(decryptSecret(sealed, ctx, key)).toBe("pancake-key-123");
  });

  it("mỗi lần mã hóa ra bản mã khác nhau", () => {
    expect(encryptSecret("abc", ctx, key)).not.toBe(encryptSecret("abc", ctx, key));
  });

  it("sai khóa mã hóa thì không giải được", () => {
    const sealed = encryptSecret("abc", ctx, key);
    expect(() => decryptSecret(sealed, ctx, randomBytes(32))).toThrow();
  });

  it("bản mã của shop A chép sang shop B thì không giải được", () => {
    const sealed = encryptSecret("abc", ctx, key);
    expect(() => decryptSecret(sealed, "org-b:pancake_pos", key)).toThrow();
  });

  it("bản mã bị sửa một ký tự thì bị phát hiện", () => {
    const sealed = encryptSecret("abcdef", ctx, key);
    const parts = sealed.split(":");
    parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
    expect(() => decryptSecret(parts.join(":"), ctx, key)).toThrow();
  });

  it("bản mã sai định dạng báo lỗi rõ", () => {
    expect(() => decryptSecret("rac", ctx, key)).toThrow("định dạng");
  });
});

describe("parseKey", () => {
  it("nhận khóa 32 byte, từ chối thiếu hoặc sai độ dài", () => {
    expect(parseKey(key.toString("base64")).length).toBe(32);
    expect(() => parseKey(undefined)).toThrow("ENCRYPTION_KEY");
    expect(() => parseKey(randomBytes(16).toString("base64"))).toThrow("32 byte");
  });
});

describe("secretHint", () => {
  it("chỉ lộ 4 ký tự cuối, khóa ngắn thì không lộ gì", () => {
    expect(secretHint("abcdefgh1234")).toBe("••••1234");
    expect(secretHint("short")).toBe("••••");
  });
});
