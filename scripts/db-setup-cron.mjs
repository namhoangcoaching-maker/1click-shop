// Cài lịch tự động trên Supabase: mỗi 30 phút gọi web để đồng bộ Pancake cho mọi shop.
// Mật khẩu CRON_SECRET (trong .env.local) được cất vào Supabase Vault, KHÔNG nằm trong code/git.
// Chạy lại lệnh này khi đổi CRON_SECRET hoặc đổi tên miền.
//
// Chạy:  npm run db:setup-cron                                  (mặc định https://shop.nhankhoitu.com.vn)
//        npm run db:setup-cron -- https://ten-mien-khac.vn
//        npm run db:setup-cron -- off                           (tắt lịch)
import { config } from "dotenv";
import { connect } from "./db.mjs";

config({ path: ".env.local", quiet: true });
const arg = process.argv[2] ?? "https://shop.nhankhoitu.com.vn";
const JOB = "pancake-sync-every-30-min";
const SECRET_NAME = "cron_secret";

const client = await connect();
try {
  await client.query("create extension if not exists pg_cron");
  await client.query("create extension if not exists pg_net");

  const existing = await client.query("select jobid from cron.job where jobname = $1", [JOB]);
  if (existing.rows.length) await client.query("select cron.unschedule($1)", [JOB]);

  if (arg === "off") {
    console.log("Đã tắt lịch đồng bộ tự động.");
  } else {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 32) throw new Error("Thiếu CRON_SECRET (ít nhất 32 ký tự) trong .env.local");
    const url = `${new URL(arg).origin}/api/cron/pancake-sync`;

    const found = await client.query("select id from vault.secrets where name = $1", [SECRET_NAME]);
    if (found.rows.length) await client.query("select vault.update_secret($1, $2)", [found.rows[0].id, secret]);
    else await client.query("select vault.create_secret($1, $2, $3)", [secret, SECRET_NAME, "Mật khẩu gọi /api/cron của 1Click"]);

    const command = `
      select net.http_post(
        url := '${url}',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = '${SECRET_NAME}')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );`;
    await client.query("select cron.schedule($1, $2, $3)", [JOB, "*/30 * * * *", command]);
    console.log(`Đã cài lịch: mỗi 30 phút gọi ${url}`);
  }
} catch (err) {
  console.error("LỖI:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
