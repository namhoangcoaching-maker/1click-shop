// Áp các file supabase/migrations/*.sql lên database (theo thứ tự tên file).
// File nào đã chạy rồi thì bỏ qua. Chạy:  npm run db:migrate
import { readdir, readFile } from "node:fs/promises";
import { connect } from "./db.mjs";

const DIR = new URL("../supabase/migrations/", import.meta.url);

const client = await connect();
try {
  await client.query(`
    create schema if not exists private;
    revoke all on schema private from public, anon, authenticated;
    create table if not exists private.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const done = new Set(
    (await client.query("select name from private.schema_migrations")).rows.map((r) => r.name),
  );
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(new URL(file, DIR), "utf8");
    process.stdout.write(`→ ${file} … `);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into private.schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log("xong");
      applied++;
    } catch (err) {
      await client.query("rollback");
      console.log("LỖI");
      throw err;
    }
  }
  console.log(applied ? `Đã áp ${applied} file.` : "Database đã mới nhất, không có gì để áp.");
} finally {
  await client.end();
}
