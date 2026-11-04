/**
 * Chứng minh khóa bảo vệ (RLS) trên database thật: shop A không đọc/sửa được dữ liệu shop B.
 * Mỗi bảng dữ liệu shop mới phải có thêm một nhóm test ở đây.
 * Tạo tạm 3 tài khoản @test.1click.local + 2 shop, tự xóa hết khi xong.
 * Chạy: npm run test:db
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SECRET, noSession);

const run = randomUUID().slice(0, 8);
const password = `Test-${randomUUID()}`;
const userIds: string[] = [];
const orgIds: string[] = [];

async function makeUser(name: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${name}-${run}@test.1click.local`,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  userIds.push(data.user.id);
  return data.user;
}

async function makeOrg(name: string) {
  const { data, error } = await admin.from("organizations").insert({ name }).select("id").single();
  if (error) throw error;
  orgIds.push(data.id);
  return data.id as string;
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, PUBLISHABLE, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

let orgA: string, orgB: string;
let ownerAId: string, ownerBId: string, staffAId: string;
let ownerA: SupabaseClient, staffA: SupabaseClient, ownerB: SupabaseClient;

beforeAll(async () => {
  const [uA, uB, uS] = await Promise.all([makeUser("owner-a"), makeUser("owner-b"), makeUser("staff-a")]);
  ownerAId = uA.id;
  ownerBId = uB.id;
  staffAId = uS.id;
  orgA = await makeOrg(`Shop A ${run}`);
  orgB = await makeOrg(`Shop B ${run}`);
  const { error } = await admin.from("memberships").insert([
    { org_id: orgA, user_id: ownerAId, role: "owner" },
    { org_id: orgA, user_id: staffAId, role: "staff" },
    { org_id: orgB, user_id: ownerBId, role: "owner" },
  ]);
  if (error) throw error;
  [ownerA, staffA, ownerB] = await Promise.all([signIn(uA.email!), signIn(uS.email!), signIn(uB.email!)]);
});

afterAll(async () => {
  // Xóa shop trước (kéo theo thành viên), rồi xóa tài khoản thử.
  if (orgIds.length) await admin.from("organizations").delete().in("id", orgIds);
  await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
});

describe("Shop A không thấy shop B", () => {
  it("chỉ đọc được shop của mình", async () => {
    const { data, error } = await ownerA.from("organizations").select("id");
    expect(error).toBeNull();
    expect(data!.map((o) => o.id)).toEqual([orgA]);
  });

  it("chỉ thấy thành viên shop mình", async () => {
    const { data } = await ownerA.from("memberships").select("org_id, user_id");
    expect(data).toHaveLength(2);
    expect(data!.every((m) => m.org_id === orgA)).toBe(true);
  });

  it("hỏi thẳng id shop B vẫn không ra gì", async () => {
    const { data } = await ownerA.from("organizations").select("id").eq("id", orgB);
    expect(data).toEqual([]);
    const members = await ownerA.from("memberships").select("user_id").eq("org_id", orgB);
    expect(members.data).toEqual([]);
  });

  it("không sửa được tên shop B", async () => {
    const { data } = await ownerA.from("organizations").update({ name: "Bị hack" }).eq("id", orgB).select();
    expect(data).toEqual([]);
    const check = await admin.from("organizations").select("name").eq("id", orgB).single();
    expect(check.data!.name).toBe(`Shop B ${run}`);
  });

  it("không tự chen mình vào shop B", async () => {
    const { error } = await ownerA
      .from("memberships")
      .insert({ org_id: orgB, user_id: ownerAId, role: "owner" });
    expect(error).not.toBeNull();
  });

  it("không xóa được Chủ của shop B", async () => {
    await ownerA.from("memberships").delete().eq("org_id", orgB);
    const { count } = await admin
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgB);
    expect(count).toBe(1);
  });

  it("chiều ngược lại: shop B cũng không thấy shop A", async () => {
    const { data } = await ownerB.from("organizations").select("id");
    expect(data!.map((o) => o.id)).toEqual([orgB]);
  });
});

describe("Quyền trong cùng một shop", () => {
  it("Nhân viên xem được shop mình nhưng không sửa được", async () => {
    const read = await staffA.from("organizations").select("id");
    expect(read.data!.map((o) => o.id)).toEqual([orgA]);
    const { data } = await staffA.from("organizations").update({ name: "Đổi tên" }).eq("id", orgA).select();
    expect(data).toEqual([]);
  });

  it("Nhân viên không tự nâng mình lên Chủ", async () => {
    const { data } = await staffA
      .from("memberships")
      .update({ role: "owner" })
      .eq("org_id", orgA)
      .eq("user_id", staffAId)
      .select();
    expect(data).toEqual([]);
  });

  it("Chủ sửa được tên shop mình", async () => {
    const { data, error } = await ownerA
      .from("organizations")
      .update({ name: `Shop A ${run} mới` })
      .eq("id", orgA)
      .select("name");
    expect(error).toBeNull();
    expect(data).toEqual([{ name: `Shop A ${run} mới` }]);
  });

  it("Chủ không được tự hạ quyền khi là Chủ duy nhất", async () => {
    const { error } = await ownerA
      .from("memberships")
      .update({ role: "staff" })
      .eq("org_id", orgA)
      .eq("user_id", ownerAId);
    expect(error?.message).toContain("ít nhất một Chủ");
  });

  it("không ai tự tạo shop mới (chỉ quản trị 1Click tạo)", async () => {
    const { error } = await ownerA.from("organizations").insert({ name: "Shop lậu" });
    expect(error).not.toBeNull();
  });
});

describe("Kết nối Pancake (khóa đã mã hóa)", () => {
  const row = (org_id: string) => ({
    org_id,
    provider: "pancake_pos",
    external_id: "123",
    external_name: "Shop thử",
    secret_ciphertext: "v1:ban-ma-gia",
    secret_hint: "••••1234",
  });

  beforeAll(async () => {
    const { error } = await admin.from("connections").insert(row(orgB));
    if (error) throw error;
  });

  it("Chủ shop A lưu được kết nối cho shop mình", async () => {
    const { error } = await ownerA.from("connections").insert(row(orgA));
    expect(error).toBeNull();
  });

  it("không ai đọc được cột bản mã khóa qua trình duyệt, kể cả Chủ", async () => {
    const { error } = await ownerA.from("connections").select("secret_ciphertext");
    expect(error).not.toBeNull();
    const star = await ownerA.from("connections").select("*");
    expect(star.error).not.toBeNull();
  });

  it("shop A không thấy kết nối của shop B", async () => {
    const { data } = await ownerA.from("connections").select("org_id, secret_hint");
    expect(data!.map((c) => c.org_id)).toEqual([orgA]);
  });

  it("shop A không ghi đè, không xóa được kết nối shop B", async () => {
    await ownerA.from("connections").update({ external_id: "hack" }).eq("org_id", orgB);
    await ownerA.from("connections").delete().eq("org_id", orgB);
    const check = await admin.from("connections").select("external_id").eq("org_id", orgB).single();
    expect(check.data!.external_id).toBe("123");
  });

  it("shop A không chèn kết nối vào shop B", async () => {
    const { error } = await ownerA.from("connections").insert({ ...row(orgB), provider: "pancake_pos" });
    expect(error).not.toBeNull();
  });

  it("Nhân viên xem được trạng thái nhưng không đổi, không xóa được", async () => {
    const read = await staffA.from("connections").select("external_id");
    expect(read.data).toEqual([{ external_id: "123" }]);
    const upd = await staffA.from("connections").update({ external_id: "999" }).eq("org_id", orgA).select("id");
    expect(upd.data ?? []).toEqual([]);
    await staffA.from("connections").delete().eq("org_id", orgA);
    const check = await admin.from("connections").select("external_id").eq("org_id", orgA).single();
    expect(check.data!.external_id).toBe("123");
  });

  it("không chuyển được kết nối sang shop khác", async () => {
    const { error } = await ownerA.from("connections").update({ org_id: orgB }).eq("org_id", orgA);
    expect(error).not.toBeNull();
  });
});

describe("Cấu hình tồn kho (chỉ Chủ shop sửa)", () => {
  beforeAll(async () => {
    const { error } = await admin.from("inventory_settings").insert({ org_id: orgB, safety_days: 9 });
    if (error) throw error;
  });

  it("Chủ shop A lưu được cấu hình cho shop mình", async () => {
    const ins = await ownerA.from("inventory_settings").insert({ org_id: orgA, safety_days: 3, target_cover_days: 21 });
    expect(ins.error).toBeNull();
    const upd = await ownerA
      .from("inventory_settings")
      .update({ safety_days: 5 })
      .eq("org_id", orgA)
      .select("safety_days");
    expect(upd.data).toEqual([{ safety_days: 5 }]);
  });

  it("database từ chối số vô lý (dự phòng âm, tốc độ bán tính trên 0 ngày)", async () => {
    const neg = await ownerA.from("inventory_settings").update({ safety_days: -1 }).eq("org_id", orgA);
    expect(neg.error).not.toBeNull();
    const zero = await ownerA.from("inventory_settings").update({ velocity_window_days: 0 }).eq("org_id", orgA);
    expect(zero.error).not.toBeNull();
  });

  it("Nhân viên xem được nhưng không sửa được", async () => {
    const read = await staffA.from("inventory_settings").select("safety_days");
    expect(read.data).toEqual([{ safety_days: 5 }]);
    const upd = await staffA
      .from("inventory_settings")
      .update({ safety_days: 1 })
      .eq("org_id", orgA)
      .select("safety_days");
    expect(upd.data ?? []).toEqual([]);
    const check = await admin.from("inventory_settings").select("safety_days").eq("org_id", orgA).single();
    expect(check.data!.safety_days).toBe(5);
  });

  it("shop A không xem, không sửa được cấu hình shop B", async () => {
    const read = await ownerA.from("inventory_settings").select("org_id");
    expect(read.data!.map((r) => r.org_id)).toEqual([orgA]);
    await ownerA.from("inventory_settings").update({ safety_days: 0 }).eq("org_id", orgB);
    const check = await admin.from("inventory_settings").select("safety_days").eq("org_id", orgB).single();
    expect(check.data!.safety_days).toBe(9);
  });

  it("không chuyển được cấu hình sang shop khác", async () => {
    const { error } = await ownerA.from("inventory_settings").update({ org_id: orgB }).eq("org_id", orgA);
    expect(error).not.toBeNull();
  });
});

describe("Người chưa đăng nhập", () => {
  it("không đọc được gì", async () => {
    const anon = createClient(URL, PUBLISHABLE, noSession);
    const orgs = await anon.from("organizations").select("id");
    expect(orgs.data ?? []).toEqual([]);
    const members = await anon.from("memberships").select("user_id");
    expect(members.data ?? []).toEqual([]);
    const conns = await anon.from("connections").select("id");
    expect(conns.data ?? []).toEqual([]);
    const settings = await anon.from("inventory_settings").select("org_id");
    expect(settings.data ?? []).toEqual([]);
  });
});
