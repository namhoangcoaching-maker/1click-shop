/**
 * Chứng minh khóa bảo vệ (RLS) trên database thật: shop A không đọc/sửa được dữ liệu shop B.
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

describe("Người chưa đăng nhập", () => {
  it("không đọc được gì", async () => {
    const anon = createClient(URL, PUBLISHABLE, noSession);
    const orgs = await anon.from("organizations").select("id");
    expect(orgs.data ?? []).toEqual([]);
    const members = await anon.from("memberships").select("user_id");
    expect(members.data ?? []).toEqual([]);
  });
});
