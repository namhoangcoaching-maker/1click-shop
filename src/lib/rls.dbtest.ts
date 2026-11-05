/**
 * Chứng minh khóa bảo vệ (RLS) trên database thật: shop A không đọc/sửa được dữ liệu shop B.
 * Mỗi bảng dữ liệu shop mới phải có thêm một nhóm test ở đây.
 * Tạo tạm 4 tài khoản @test.1click.local (Chủ A, Quản lý A, Nhân viên A, Chủ B) + 2 shop, tự xóa hết khi xong.
 * Chạy: npm run test:db
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { saveExpenseTagName } from "./finance/tags-db";

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
let ownerAId: string, ownerBId: string, staffAId: string, managerAId: string;
let ownerA: SupabaseClient, staffA: SupabaseClient, ownerB: SupabaseClient, managerA: SupabaseClient;

beforeAll(async () => {
  const [uA, uB, uS, uM] = await Promise.all([
    makeUser("owner-a"),
    makeUser("owner-b"),
    makeUser("staff-a"),
    makeUser("manager-a"),
  ]);
  managerAId = uM.id;
  ownerAId = uA.id;
  ownerBId = uB.id;
  staffAId = uS.id;
  orgA = await makeOrg(`Shop A ${run}`);
  orgB = await makeOrg(`Shop B ${run}`);
  const { error } = await admin.from("memberships").insert([
    { org_id: orgA, user_id: ownerAId, role: "owner" },
    { org_id: orgA, user_id: staffAId, role: "staff" },
    { org_id: orgA, user_id: managerAId, role: "manager" },
    { org_id: orgB, user_id: ownerBId, role: "owner" },
  ]);
  if (error) throw error;
  [ownerA, staffA, ownerB, managerA] = await Promise.all([
    signIn(uA.email!),
    signIn(uS.email!),
    signIn(uB.email!),
    signIn(uM.email!),
  ]);
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
    expect(data).toHaveLength(3);
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

  it("Nhân viên KHÔNG xem được kết nối (6.1), không đổi, không xóa được; Quản lý xem được", async () => {
    const read = await staffA.from("connections").select("external_id");
    expect(read.data).toEqual([]);
    const mgr = await managerA.from("connections").select("external_id");
    expect(mgr.data).toEqual([{ external_id: "123" }]);
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

  it("Nhân viên không xem, không sửa được; Quản lý xem được", async () => {
    const read = await staffA.from("inventory_settings").select("safety_days");
    expect(read.data).toEqual([]);
    const mgr = await managerA.from("inventory_settings").select("safety_days");
    expect(mgr.data).toEqual([{ safety_days: 5 }]);
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

describe("Dữ liệu bán hàng từ Pancake (chỉ đọc, theo shop)", () => {
  beforeAll(async () => {
    for (const org of [orgA, orgB]) {
      const tag = org === orgA ? "A" : "B";
      const p = await admin.from("products").insert({
        org_id: org, variation_id: `v-${tag}`, product_id: `p-${tag}`, name: `Áo ${tag}`, retail_price: 100, stock: 5,
      });
      if (p.error) throw p.error;
      const o = await admin.from("orders").insert({
        org_id: org, order_id: `DON-${tag}`, inserted_at: new Date().toISOString(), status: 3, total_price: 100,
      });
      if (o.error) throw o.error;
      const i = await admin.from("order_items").insert({
        org_id: org, order_id: `DON-${tag}`, item_id: "1", variation_id: `v-${tag}`, quantity: 1,
      });
      if (i.error) throw i.error;
      const s = await admin.from("sync_state").insert({ org_id: org, provider: "pancake_pos", last_status: "ok" });
      if (s.error) throw s.error;
      const rp = await admin.from("daily_reports").insert({ org_id: org, report_date: "2026-11-05", data: { tag } });
      if (rp.error) throw rp.error;
      const t = await admin.from("cash_transactions").insert({
        org_id: org, transaction_id: `T-${tag}`, posted_at: new Date().toISOString(), amount: 1000, name: "Trả trước",
      });
      if (t.error) throw t.error;
    }
  });

  for (const table of ["products", "orders", "order_items", "sync_state", "cash_transactions", "daily_reports"] as const) {
    it(`${table}: shop A chỉ thấy dòng của shop A; Quản lý xem được, Nhân viên KHÔNG`, async () => {
      const a = await ownerA.from(table).select("org_id");
      expect(a.error).toBeNull();
      expect(a.data!.map((r) => r.org_id)).toEqual([orgA]);
      const m = await managerA.from(table).select("org_id");
      expect(m.data!.map((r) => r.org_id)).toEqual([orgA]);
      const s = await staffA.from(table).select("org_id");
      expect(s.data).toEqual([]);
    });

    it(`${table}: không ai ghi, sửa, xóa được qua trình duyệt, kể cả Chủ`, async () => {
      const del = await ownerA.from(table).delete().eq("org_id", orgA);
      expect(del.error).not.toBeNull();
      const upd = await ownerA.from(table).update({ org_id: orgA }).eq("org_id", orgA);
      expect(upd.error).not.toBeNull();
      const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("org_id", orgA);
      expect(count).toBe(1);
    });
  }

  it("hàm tính số đã bán: shop mình ra số, truyền mã shop B thì không ra gì", async () => {
    const args = (org: string) => ({
      p_org_id: org,
      p_since: new Date(Date.now() - 86_400_000).toISOString(),
      p_statuses: [3],
    });
    const mine = await ownerA.rpc("variation_sales", args(orgA));
    expect(mine.error).toBeNull();
    expect(mine.data).toEqual([{ variation_id: "v-A", sold: 1, returned: 0 }]);
    const other = await ownerA.rpc("variation_sales", args(orgB));
    expect(other.data ?? []).toEqual([]);
    const anon = await createClient(URL, PUBLISHABLE, noSession).rpc("variation_sales", args(orgA));
    expect(anon.data ?? []).toEqual([]);
  });

  it("hàm số liệu Tổng quan (overview_orders, product_sales): chỉ ra dữ liệu shop mình", async () => {
    const args = (org: string) => ({
      p_org_id: org,
      p_start: new Date(Date.now() - 86_400_000).toISOString(),
      p_end: new Date(Date.now() + 60_000).toISOString(),
      p_statuses: [3],
    });
    for (const fn of ["overview_orders", "product_sales"]) {
      const mine = await ownerA.rpc(fn, args(orgA));
      expect(mine.error).toBeNull();
      expect(mine.data).toHaveLength(1);
      const other = await ownerA.rpc(fn, args(orgB));
      expect(other.data ?? []).toEqual([]);
    }
    const o = await ownerA.rpc("overview_orders", args(orgA));
    expect(o.data![0]).toMatchObject({ order_id: "DON-A", total_price: 100, returned_value: 0 });
  });

  it("không chèn được đơn giả vào shop B", async () => {
    const { error } = await ownerA
      .from("orders")
      .insert({ org_id: orgB, order_id: "GIA", inserted_at: new Date().toISOString(), status: 3 });
    expect(error).not.toBeNull();
  });
});

describe("Hàng sắp về (Chủ/Quản lý nhập)", () => {
  const row = (org_id: string) => ({ org_id, variation_id: "v-A", quantity: 40, eta: "2026-12-01" });

  it("Chủ shop A thêm, sửa, xóa được hàng sắp về của shop mình", async () => {
    const ins = await ownerA.from("incoming_stock").insert(row(orgA)).select("id").single();
    expect(ins.error).toBeNull();
    const upd = await ownerA.from("incoming_stock").update({ quantity: 50 }).eq("id", ins.data!.id).select("quantity");
    expect(upd.data).toEqual([{ quantity: 50 }]);
    const del = await ownerA.from("incoming_stock").delete().eq("id", ins.data!.id).select("id");
    expect(del.data).toHaveLength(1);
  });

  it("Nhân viên không xem, không thêm/xóa được; Quản lý xem được", async () => {
    await admin.from("incoming_stock").insert(row(orgA));
    const read = await staffA.from("incoming_stock").select("quantity");
    expect(read.data).toEqual([]);
    const mgr = await managerA.from("incoming_stock").select("quantity");
    expect(mgr.data).toEqual([{ quantity: 40 }]);
    const ins = await staffA.from("incoming_stock").insert(row(orgA));
    expect(ins.error).not.toBeNull();
    const del = await staffA.from("incoming_stock").delete().eq("org_id", orgA).select("id");
    expect(del.data ?? []).toEqual([]);
  });

  it("shop B không thấy, không thêm vào shop A; database chặn số lượng vô lý", async () => {
    const read = await ownerB.from("incoming_stock").select("id").eq("org_id", orgA);
    expect(read.data).toEqual([]);
    const ins = await ownerB.from("incoming_stock").insert(row(orgA));
    expect(ins.error).not.toBeNull();
    const bad = await ownerA.from("incoming_stock").insert({ ...row(orgA), quantity: 0 });
    expect(bad.error).not.toBeNull();
  });

  it("cấu hình kế hoạch đặt hàng: Chủ lưu được, database chặn mức 2 ≤ mức 1", async () => {
    const ok = await ownerA.from("inventory_settings").update({ moq_per_size: 25, tier3_days: 15 }).eq("org_id", orgA).select("moq_per_size");
    expect(ok.data).toEqual([{ moq_per_size: 25 }]);
    const bad = await ownerA.from("inventory_settings").update({ tier1_qty: 200, tier2_qty: 150 }).eq("org_id", orgA);
    expect(bad.error).not.toBeNull();
  });
});

describe("Tên thẻ chi phí (chỉ Chủ shop đặt)", () => {
  it("Chủ shop A đặt tên thẻ mới rồi đổi tên được (đúng hàm nút Lưu dùng)", async () => {
    expect(await saveExpenseTagName(ownerA, orgA, "tag-1", "Quảng cáo Shopee")).toEqual({ error: null });
    expect(await saveExpenseTagName(ownerA, orgA, "tag-1", "Quảng cáo TikTok")).toEqual({ error: null });
    const read = await ownerA.from("expense_tags").select("tag_id, name").eq("org_id", orgA);
    expect(read.data).toEqual([{ tag_id: "tag-1", name: "Quảng cáo TikTok" }]);
  });

  it("Nhân viên không xem, không đặt, không đổi tên được; Quản lý xem được", async () => {
    const read = await staffA.from("expense_tags").select("name").eq("tag_id", "tag-1");
    expect(read.data).toEqual([]);
    const mgr = await managerA.from("expense_tags").select("name").eq("tag_id", "tag-1");
    expect(mgr.data).toEqual([{ name: "Quảng cáo TikTok" }]);
    expect((await saveExpenseTagName(staffA, orgA, "tag-1", "Đổi bậy")).error).not.toBeNull();
    expect((await saveExpenseTagName(staffA, orgA, "tag-2", "Thẻ lạ")).error).not.toBeNull();
  });

  it("shop B không thấy, không đặt tên thẻ cho shop A", async () => {
    const read = await ownerB.from("expense_tags").select("tag_id").eq("org_id", orgA);
    expect(read.data).toEqual([]);
    expect((await saveExpenseTagName(ownerB, orgA, "tag-3", "Chen")).error).not.toBeNull();
  });
});

describe("6.1 Thành viên: danh sách, khóa tài khoản", () => {
  it("Nhân viên chỉ thấy dòng thành viên của chính mình; Quản lý, Chủ thấy cả shop", async () => {
    const s = await staffA.from("memberships").select("user_id").eq("org_id", orgA);
    expect(s.data!.map((r) => r.user_id)).toEqual([staffAId]);
    const m = await managerA.from("memberships").select("user_id").eq("org_id", orgA);
    expect(m.data).toHaveLength(3);
  });

  it("Chủ đặt họ tên, bộ phận cho nhân viên; Quản lý không sửa được Chủ", async () => {
    const ok = await ownerA
      .from("memberships")
      .update({ display_name: "Lan", department: "Đóng gói" })
      .eq("org_id", orgA)
      .eq("user_id", staffAId)
      .select("display_name, department");
    expect(ok.data).toEqual([{ display_name: "Lan", department: "Đóng gói" }]);
    const bad = await managerA.from("memberships").update({ department: "X" }).eq("user_id", ownerAId).select("department");
    expect(bad.data ?? []).toEqual([]);
  });

  it("Nhân viên bị khóa: không còn thấy shop; mở khóa thì thấy lại", async () => {
    const lock = await ownerA
      .from("memberships")
      .update({ disabled_at: new Date().toISOString() })
      .eq("org_id", orgA)
      .eq("user_id", staffAId)
      .select("disabled_at");
    expect(lock.data).toHaveLength(1);
    const read = await staffA.from("organizations").select("id");
    expect(read.data).toEqual([]);
    await ownerA.from("memberships").update({ disabled_at: null }).eq("org_id", orgA).eq("user_id", staffAId);
    const again = await staffA.from("organizations").select("id");
    expect(again.data!.map((o) => o.id)).toEqual([orgA]);
  });

  it("Quản lý bị khóa thì mất quyền xem dữ liệu kinh doanh", async () => {
    await ownerA.from("memberships").update({ disabled_at: new Date().toISOString() }).eq("user_id", managerAId);
    const read = await managerA.from("orders").select("org_id");
    expect(read.data).toEqual([]);
    await ownerA.from("memberships").update({ disabled_at: null }).eq("user_id", managerAId);
    const back = await managerA.from("orders").select("org_id");
    expect(back.data!.map((r) => r.org_id)).toEqual([orgA]);
  });

  it("không khóa được Chủ cuối cùng còn hoạt động", async () => {
    const r = await ownerA
      .from("memberships")
      .update({ disabled_at: new Date().toISOString() })
      .eq("org_id", orgA)
      .eq("user_id", ownerAId);
    expect(r.error).not.toBeNull();
    const check = await admin.from("memberships").select("disabled_at").eq("user_id", ownerAId).single();
    expect(check.data!.disabled_at).toBeNull();
  });
});

describe("6.2 Quản lý thêm/sửa nhân viên", () => {
  it("Quản lý thêm được người vai trò Nhân viên, KHÔNG thêm được Quản lý/Chủ", async () => {
    const u1 = await makeUser("staff-new");
    const ok = await managerA.from("memberships").insert({ org_id: orgA, user_id: u1.id, role: "staff", display_name: "Mới" });
    expect(ok.error).toBeNull();
    const u2 = await makeUser("mgr-new");
    const bad = await managerA.from("memberships").insert({ org_id: orgA, user_id: u2.id, role: "manager" });
    expect(bad.error).not.toBeNull();
    await admin.from("memberships").delete().eq("user_id", u1.id);
  });

  it("Quản lý sửa, khóa được Nhân viên; không nâng Nhân viên lên Quản lý; không sửa được Chủ", async () => {
    const ok = await managerA.from("memberships").update({ department: "Kho" }).eq("user_id", staffAId).select("department");
    expect(ok.data).toEqual([{ department: "Kho" }]);
    const up = await managerA.from("memberships").update({ role: "manager" }).eq("user_id", staffAId).select("role");
    expect(up.error ?? up.data?.length === 0).toBeTruthy();
    const owner = await managerA.from("memberships").update({ department: "X" }).eq("user_id", ownerAId).select("user_id");
    expect(owner.data ?? []).toEqual([]);
    const check = await admin.from("memberships").select("role").eq("user_id", staffAId).single();
    expect(check.data!.role).toBe("staff");
  });
});

describe("6.2 Cấu hình nhân sự và địa điểm chấm công", () => {
  let locA: string;
  beforeAll(async () => {
    const l = await ownerA.from("work_locations").insert({ org_id: orgA, name: "Shop", lat: 21.03, lng: 105.85 }).select("id").single();
    if (l.error) throw l.error;
    locA = l.data.id;
  });

  it("địa điểm: Quản lý thêm được, Nhân viên xem được nhưng không thêm được, shop B không thấy", async () => {
    const m = await managerA.from("work_locations").insert({ org_id: orgA, name: "Kho", lat: 21, lng: 105.8, radius_m: 200 });
    expect(m.error).toBeNull();
    const s = await staffA.from("work_locations").select("name").eq("org_id", orgA);
    expect(s.data!.map((r) => r.name).sort()).toEqual(["Kho", "Shop"]);
    const bad = await staffA.from("work_locations").insert({ org_id: orgA, name: "Nhà", lat: 1, lng: 1 });
    expect(bad.error).not.toBeNull();
    const b = await ownerB.from("work_locations").select("id").eq("org_id", orgA);
    expect(b.data).toEqual([]);
  });

  it("Chủ cấu hình được mọi người; Quản lý cấu hình được Nhân viên, KHÔNG cấu hình/xem lương của Chủ", async () => {
    const o = await ownerA.from("staff_settings").insert({ org_id: orgA, user_id: ownerAId, base_salary: 30_000_000 });
    expect(o.error).toBeNull();
    const m = await managerA
      .from("staff_settings")
      .insert({ org_id: orgA, user_id: staffAId, attendance_mode: "gps", location_id: locA, base_salary: 7_000_000 });
    expect(m.error).toBeNull();
    const seeOwner = await managerA.from("staff_settings").select("base_salary").eq("user_id", ownerAId);
    expect(seeOwner.data).toEqual([]);
    const editOwner = await managerA.from("staff_settings").update({ base_salary: 1 }).eq("user_id", ownerAId).select("user_id");
    expect(editOwner.data ?? []).toEqual([]);
  });

  it("Nhân viên chỉ xem cấu hình của mình, không sửa được (kể cả lương mình)", async () => {
    const own = await staffA.from("staff_settings").select("base_salary");
    expect(own.data).toEqual([{ base_salary: 7_000_000 }]);
    const up = await staffA.from("staff_settings").update({ base_salary: 99_000_000 }).eq("user_id", staffAId).select("user_id");
    expect(up.data ?? []).toEqual([]);
  });

  it("database chặn giờ ca sai, ngày làm sai, địa điểm của shop khác", async () => {
    const t = await ownerA.from("staff_settings").update({ shift_start: "18:00", shift_end: "08:00" }).eq("user_id", staffAId);
    expect(t.error).not.toBeNull();
    const d = await ownerA.from("staff_settings").update({ work_days: [0, 8] }).eq("user_id", staffAId);
    expect(d.error).not.toBeNull();
    const lb = await admin.from("work_locations").insert({ org_id: orgB, name: "B", lat: 10, lng: 106 }).select("id").single();
    const x = await ownerA.from("staff_settings").update({ location_id: lb.data!.id }).eq("user_id", staffAId);
    expect(x.error).not.toBeNull();
  });
});

describe("6.3 Chấm công", () => {
  // Ngày VN hôm nay và một ngày tháng trước đã khóa sổ (quá mùng 5 tháng sau) – chọn ngày cách xa hẳn 2 tháng.
  const vnToday = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const day = (offset: number) => new Date(Date.parse(`${vnToday}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
  const yesterday = day(-1);
  const locked = day(-70);
  const shift = { shift_start: "08:00", shift_end: "17:00", late_grace_min: 10 };

  beforeAll(async () => {
    // Máy chủ (khóa secret) ghi giờ vào ca hôm qua cho Nhân viên A.
    const { error } = await admin.from("attendance").insert({
      org_id: orgA,
      user_id: staffAId,
      work_date: yesterday,
      check_in_at: `${yesterday}T01:05:00Z`,
      attendance_mode: "gps",
      in_lat: 21.03,
      in_lng: 105.85,
      ...shift,
    });
    if (error) throw error;
  });

  afterAll(async () => {
    await admin.from("attendance_unlocks").delete().eq("org_id", orgA);
  });

  it("Nhân viên chỉ xem được chấm công của mình, KHÔNG tự ghi / sửa giờ được", async () => {
    const own = await staffA.from("attendance").select("work_date");
    expect(own.data).toEqual([{ work_date: yesterday }]);
    const ins = await staffA.from("attendance").insert({ org_id: orgA, user_id: staffAId, work_date: vnToday, check_in_at: new Date().toISOString(), attendance_mode: "online", edit_note: "tự chấm", ...shift });
    expect(ins.error).not.toBeNull();
    const up = await staffA.from("attendance").update({ check_out_at: `${yesterday}T10:00:00Z`, edit_note: "x" }).eq("user_id", staffAId).select("work_date");
    expect(up.data ?? []).toEqual([]);
  });

  it("Quản lý sửa được công Nhân viên (phải ghi lý do; tọa độ GPS giữ nguyên, ghi người sửa)", async () => {
    const noNote = await managerA.from("attendance").update({ check_out_at: `${yesterday}T10:00:00Z` }).eq("user_id", staffAId).eq("work_date", yesterday);
    expect(noNote.error).not.toBeNull();
    const ok = await managerA
      .from("attendance")
      .update({ check_out_at: `${yesterday}T10:00:00Z`, edit_note: "Quên ra ca", in_lat: 1 })
      .eq("user_id", staffAId)
      .eq("work_date", yesterday)
      .select("check_out_at, in_lat, edited_by");
    expect(ok.error).toBeNull();
    expect(ok.data![0]).toMatchObject({ in_lat: 21.03, edited_by: managerAId });
  });

  it("Quản lý KHÔNG xem, không sửa được công của Chủ; Chủ xem được cả shop; shop B không thấy", async () => {
    await admin.from("attendance").insert({ org_id: orgA, user_id: ownerAId, work_date: yesterday, check_in_at: `${yesterday}T01:00:00Z`, attendance_mode: "online", ...shift });
    const m = await managerA.from("attendance").select("user_id").eq("user_id", ownerAId);
    expect(m.data).toEqual([]);
    const mUp = await managerA.from("attendance").update({ edit_note: "x", check_out_at: null }).eq("user_id", ownerAId).select("user_id");
    expect(mUp.data ?? []).toEqual([]);
    const o = await ownerA.from("attendance").select("user_id").eq("org_id", orgA);
    expect(o.data!.length).toBe(2);
    const b = await ownerB.from("attendance").select("user_id").eq("org_id", orgA);
    expect(b.data).toEqual([]);
  });

  it("không sửa được ngày tương lai; tháng đã khóa sổ chỉ sửa được khi Chủ mở khóa", async () => {
    const future = await managerA.from("attendance").insert({ org_id: orgA, user_id: staffAId, work_date: day(3), edit_note: "nghỉ phép", attendance_mode: "manual", ...shift });
    expect(future.error).not.toBeNull();
    const closed = await managerA.from("attendance").insert({ org_id: orgA, user_id: staffAId, work_date: locked, edit_note: "bổ sung", attendance_mode: "manual", ...shift });
    expect(closed.error).not.toBeNull();
    // Quản lý không mở khóa được; Chủ mở được.
    const month = `${locked.slice(0, 7)}-01`;
    const mUnlock = await managerA.from("attendance_unlocks").insert({ org_id: orgA, month });
    expect(mUnlock.error).not.toBeNull();
    const oUnlock = await ownerA.from("attendance_unlocks").insert({ org_id: orgA, month });
    expect(oUnlock.error).toBeNull();
    const reopened = await managerA.from("attendance").insert({ org_id: orgA, user_id: staffAId, work_date: locked, edit_note: "bổ sung", attendance_mode: "manual", ...shift });
    expect(reopened.error).toBeNull();
  });

  it("database chặn giờ ra trước giờ vào", async () => {
    const bad = await ownerA
      .from("attendance")
      .update({ check_out_at: `${yesterday}T00:00:00Z`, edit_note: "sai" })
      .eq("user_id", staffAId)
      .eq("work_date", yesterday);
    expect(bad.error).not.toBeNull();
  });
});

describe("6.6 KPI", () => {
  const month = `${new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7)}-01`;
  let tpl: string, tplB: string, asgStaff: string, asgOwner: string;

  beforeAll(async () => {
    await admin.from("memberships").update({ department: "Bán hàng" }).eq("org_id", orgA).eq("user_id", staffAId);
    const b = await admin.from("kpi_templates").insert({ org_id: orgB, name: "B", kind: "per_unit", source: "manual", rate: 1 }).select("id").single();
    tplB = b.data!.id;
  });

  it("chỉ Chủ tạo / sửa mẫu KPI; Quản lý, Nhân viên xem được nhưng không tạo được", async () => {
    const o = await ownerA.from("kpi_templates").insert({ org_id: orgA, name: "Video", kind: "per_unit", source: "manual", rate: 20000, unit_label: "video" }).select("id").single();
    expect(o.error).toBeNull();
    tpl = o.data!.id;
    const m = await managerA.from("kpi_templates").insert({ org_id: orgA, name: "X", kind: "per_unit", source: "manual", rate: 1 });
    expect(m.error).not.toBeNull();
    const mUp = await managerA.from("kpi_templates").update({ rate: 999999 }).eq("id", tpl).select("id");
    expect(mUp.data ?? []).toEqual([]);
    const s = await staffA.from("kpi_templates").select("name").eq("org_id", orgA);
    expect(s.data).toEqual([{ name: "Video" }]);
    const b = await ownerB.from("kpi_templates").select("id").eq("org_id", orgA);
    expect(b.data).toEqual([]);
  });

  it("database chặn mẫu vô lý (theo số lượng mà lấy doanh thu; theo kênh mà không chọn kênh)", async () => {
    const x = await ownerA.from("kpi_templates").insert({ org_id: orgA, name: "X", kind: "per_unit", source: "shop_revenue", rate: 1 });
    expect(x.error).not.toBeNull();
    const y = await ownerA.from("kpi_templates").insert({ org_id: orgA, name: "Y", kind: "percent", source: "channel_revenue", rate: 1 });
    expect(y.error).not.toBeNull();
  });

  it("Quản lý gắn KPI cho Nhân viên; KHÔNG gắn cho Chủ, KHÔNG gắn cho bộ phận; Chủ gắn cho bộ phận được", async () => {
    const s = await managerA.from("kpi_assignments").insert({ org_id: orgA, template_id: tpl, user_id: staffAId, target: 30 }).select("id").single();
    expect(s.error).toBeNull();
    asgStaff = s.data!.id;
    const o = await managerA.from("kpi_assignments").insert({ org_id: orgA, template_id: tpl, user_id: ownerAId });
    expect(o.error).not.toBeNull();
    const d = await managerA.from("kpi_assignments").insert({ org_id: orgA, template_id: tpl, department: "Bán hàng" });
    expect(d.error).not.toBeNull();
    const od = await ownerA.from("kpi_assignments").insert({ org_id: orgA, template_id: tpl, department: "Kho" });
    expect(od.error).toBeNull();
    const oo = await ownerA.from("kpi_assignments").insert({ org_id: orgA, template_id: tpl, user_id: ownerAId }).select("id").single();
    asgOwner = oo.data!.id;
    // Không gắn được mẫu của shop B vào shop A.
    const cross = await ownerA.from("kpi_assignments").insert({ org_id: orgA, template_id: tplB, user_id: staffAId });
    expect(cross.error).not.toBeNull();
  });

  it("Nhân viên chỉ thấy KPI gắn cho mình / bộ phận mình", async () => {
    const own = await staffA.from("kpi_assignments").select("id").eq("org_id", orgA);
    expect(own.data!.map((r) => r.id)).toEqual([asgStaff]);
    await ownerA.from("kpi_assignments").insert({ org_id: orgA, template_id: tpl, department: "Bán hàng" });
    const withDept = await staffA.from("kpi_assignments").select("department").eq("org_id", orgA);
    expect(withDept.data!.length).toBe(2);
  });

  it("kết quả nhập tay: Quản lý nhập cho Nhân viên; Nhân viên không tự nhập; Quản lý không nhập cho Chủ", async () => {
    const m = await managerA.from("kpi_results").insert({ org_id: orgA, assignment_id: asgStaff, user_id: staffAId, month, actual: 12 }).select("updated_by").single();
    expect(m.error).toBeNull();
    expect(m.data!.updated_by).toBe(managerAId);
    const self = await staffA.from("kpi_results").update({ actual: 999 }).eq("assignment_id", asgStaff).select("actual");
    expect(self.data ?? []).toEqual([]);
    const seen = await staffA.from("kpi_results").select("actual");
    expect(seen.data).toEqual([{ actual: 12 }]);
    const o = await managerA.from("kpi_results").insert({ org_id: orgA, assignment_id: asgOwner, user_id: ownerAId, month, actual: 50 });
    expect(o.error).not.toBeNull();
  });

  it("kết quả phải đúng người được gắn; tháng đã khóa sổ không nhập được", async () => {
    const wrong = await ownerA.from("kpi_results").insert({ org_id: orgA, assignment_id: asgOwner, user_id: staffAId, month, actual: 1 });
    expect(wrong.error).not.toBeNull();
    const old = new Date(Date.now() - 80 * 86_400_000).toISOString().slice(0, 7);
    const locked = await managerA.from("kpi_results").insert({ org_id: orgA, assignment_id: asgStaff, user_id: staffAId, month: `${old}-01`, actual: 1 });
    expect(locked.error).not.toBeNull();
  });

  it("Nhân viên không tự nối mình với nhân viên Pancake khác; Quản lý nối được cho Nhân viên", async () => {
    const self = await staffA.from("staff_settings").update({ pancake_seller_id: "x" }).eq("user_id", staffAId).select("user_id");
    expect(self.data ?? []).toEqual([]);
    const m = await managerA.from("staff_settings").update({ pancake_seller_id: "seller-1" }).eq("user_id", staffAId).select("pancake_seller_id");
    expect(m.data).toEqual([{ pancake_seller_id: "seller-1" }]);
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
    for (const table of ["products", "orders", "order_items", "sync_state", "incoming_stock", "cash_transactions", "daily_reports", "attendance", "attendance_unlocks", "kpi_templates", "kpi_assignments", "kpi_results"]) {
      const r = await anon.from(table).select("org_id");
      expect(r.data ?? []).toEqual([]);
    }
  });
});
