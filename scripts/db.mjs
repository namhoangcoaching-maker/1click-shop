// Kết nối thẳng tới database Supabase bằng SUPABASE_DB_URL trong .env.local.
// Chỉ dùng cho các lệnh quản trị chạy trên máy (npm run db:...), không dùng trong web.
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

export async function connect() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("Thiếu SUPABASE_DB_URL trong .env.local (xem HUONG_DAN.md).");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}
