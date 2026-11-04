import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env.local", quiet: true });

/**
 * Test chạy trên database Supabase THẬT (cần mạng + .env.local): npm run test:db
 * Tách khỏi `npm test` để test thường vẫn chạy nhanh, không cần mạng.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.dbtest.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
