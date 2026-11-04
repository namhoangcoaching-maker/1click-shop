// Gắn một tài khoản vào một shop với vai trò cho trước. Shop chưa có thì tạo mới.
// Tài khoản phải được tạo trước trên Supabase (Authentication → Users → Add user).
//
// Chạy:  npm run db:add-member -- <email> "<Tên shop>" <owner|manager|staff>
// Ví dụ: npm run db:add-member -- chu@ecobath.vn "Ecobath" owner
import { connect } from "./db.mjs";

const [email, shopName, role = "staff"] = process.argv.slice(2);
const ROLES = { owner: "Chủ", manager: "Quản lý", staff: "Nhân viên" };

if (!email || !shopName || !(role in ROLES)) {
  console.error('Cách dùng: npm run db:add-member -- <email> "<Tên shop>" <owner|manager|staff>');
  process.exit(1);
}

const client = await connect();
try {
  const user = (
    await client.query("select id from auth.users where lower(email) = lower($1)", [email.trim()])
  ).rows[0];
  if (!user) {
    console.error(`Chưa có tài khoản ${email}. Tạo trên Supabase: Authentication → Users → Add user.`);
    process.exitCode = 1;
  } else {
    await client.query("begin");
    const shops = (
      await client.query("select id from public.organizations where lower(name) = lower($1)", [
        shopName.trim(),
      ])
    ).rows;
    if (shops.length > 1) throw new Error(`Có ${shops.length} shop cùng tên "${shopName}".`);
    const orgId =
      shops[0]?.id ??
      (
        await client.query("insert into public.organizations (name) values ($1) returning id", [
          shopName.trim(),
        ])
      ).rows[0].id;
    await client.query(
      `insert into public.memberships (org_id, user_id, role) values ($1, $2, $3)
       on conflict (org_id, user_id) do update set role = excluded.role`,
      [orgId, user.id, role],
    );
    await client.query("commit");
    console.log(`${shops[0] ? "" : `Đã tạo shop "${shopName}". `}Đã gắn ${email} làm ${ROLES[role]}.`);
  }
} catch (err) {
  await client.query("rollback").catch(() => {});
  console.error("LỖI:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
