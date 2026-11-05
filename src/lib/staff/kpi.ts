/**
 * KPI dạng cấu hình (Giai đoạn 6.6, thuần, có unit test). Chủ dự án chốt 05/11/2026:
 *  • 5 kiểu công thức: % doanh thu, theo số lượng, bậc thang theo % chỉ tiêu, theo tỷ lệ hoàn thành, trừ phạt.
 *  • Kết quả: nhập tay, Doanh thu Pancake cả shop, Doanh thu Pancake một số kênh (nguồn đơn),
 *    Doanh thu Pancake của đơn gán đúng nhân viên (assigning_seller).
 *  • Doanh thu = "Doanh thu" của Pancake (đã trừ chiết khấu, hàng hoàn, phí sàn).
 *  • Thưởng / phạt KPI cộng vào Lương dự kiến (chỉ để xem; Dòng tiền vẫn theo phiếu chi thẻ Lương).
 */

export type KpiKind = "percent" | "per_unit" | "tiers" | "completion" | "penalty";
export type KpiSource = "manual" | "shop_revenue" | "channel_revenue" | "seller_revenue";

export const KIND_LABELS: Record<KpiKind, string> = {
  percent: "% doanh thu",
  per_unit: "Theo số lượng",
  tiers: "Bậc thang theo % chỉ tiêu",
  completion: "Theo tỷ lệ hoàn thành",
  penalty: "Trừ phạt",
};

export const SOURCE_LABELS: Record<KpiSource, string> = {
  manual: "Nhập tay (Quản lý nhập kết quả)",
  shop_revenue: "Doanh thu Pancake cả shop",
  channel_revenue: "Doanh thu Pancake theo kênh",
  seller_revenue: "Doanh thu Pancake đơn gán cho người này",
};

export interface Tier {
  /** Đạt từ pct% chỉ tiêu… */
  pct: number;
  /** …thì thưởng amount đồng. */
  amount: number;
}

export interface KpiTemplate {
  id: string;
  name: string;
  kind: KpiKind;
  source: KpiSource;
  /** Mã nguồn đơn Pancake (source = channel_revenue). */
  channels: string[];
  unitLabel: string | null;
  /** percent: %; per_unit / penalty: đồng/đơn vị; completion: mức thưởng khi đạt 100%. */
  rate: number;
  tiers: Tier[];
  /** Trần thưởng / tháng. */
  cap: number | null;
  archived: boolean;
}

export interface KpiAssignment {
  id: string;
  templateId: string;
  userId: string | null;
  department: string | null;
  target: number | null;
}

/** Kiểu nào cần chỉ tiêu. */
export const needsTarget = (k: KpiKind) => k === "tiers" || k === "completion";
/** Nguồn nào là doanh thu (đồng). */
export const isRevenueSource = (s: KpiSource) => s !== "manual";

export interface KpiOutcome {
  /** Kết quả thực tế (đồng hoặc số lượng); null = chưa có (chưa nhập / không lấy được). */
  actual: number | null;
  /** % chỉ tiêu (khi có chỉ tiêu). */
  completion: number | null;
  /** Tiền: dương = thưởng, âm = phạt. */
  amount: number;
  /** Bậc đã đạt (kiểu bậc thang). */
  tier: Tier | null;
}

/** Tiền KPI cho một kết quả thực tế. */
export function kpiOutcome(t: Pick<KpiTemplate, "kind" | "rate" | "tiers" | "cap">, target: number | null, actual: number | null): KpiOutcome {
  const completion = actual !== null && target ? Math.round((actual / target) * 10000) / 100 : null;
  if (actual === null) return { actual, completion, amount: 0, tier: null };
  let amount = 0;
  let tier: Tier | null = null;
  switch (t.kind) {
    case "percent":
      amount = Math.max(0, actual) * (t.rate / 100);
      break;
    case "per_unit":
      amount = Math.max(0, actual) * t.rate;
      break;
    case "tiers":
      if (completion !== null) {
        tier = [...t.tiers].sort((a, b) => b.pct - a.pct).find((x) => completion >= x.pct) ?? null;
        amount = tier?.amount ?? 0;
      }
      break;
    case "completion":
      amount = completion === null ? 0 : t.rate * Math.min(1, Math.max(0, completion) / 100);
      break;
    case "penalty":
      return { actual, completion, amount: -Math.round(Math.max(0, actual) * t.rate), tier: null };
  }
  amount = Math.round(amount);
  if (t.cap !== null && amount > t.cap) amount = t.cap;
  return { actual, completion, amount, tier };
}

/** Số liệu Pancake của tháng để tính KPI doanh thu. */
export interface RevenueContext {
  shop: number | null;
  /** Doanh thu theo mã nguồn đơn. */
  bySource: Map<string, number> | null;
  /** Doanh thu theo mã nhân viên Pancake (assigning_seller_id). */
  bySeller: Map<string, number> | null;
}

/** Kết quả thực tế của một KPI cho một người. */
export function kpiActual(
  t: Pick<KpiTemplate, "source" | "channels">,
  ctx: RevenueContext,
  person: { sellerId: string | null; manual: number | null },
): number | null {
  switch (t.source) {
    case "manual":
      return person.manual;
    case "shop_revenue":
      return ctx.shop;
    case "channel_revenue":
      return ctx.bySource ? t.channels.reduce((s, c) => s + (ctx.bySource!.get(c) ?? 0), 0) : null;
    case "seller_revenue":
      if (!person.sellerId) return null;
      return ctx.bySeller ? (ctx.bySeller.get(person.sellerId) ?? 0) : null;
  }
}

/** KPI áp cho người này: gắn đích danh, hoặc gắn cho bộ phận của họ (gắn đích danh được ưu tiên nếu trùng mẫu). */
export function assignmentsFor(all: KpiAssignment[], userId: string, department: string | null): KpiAssignment[] {
  const own = all.filter((a) => a.userId === userId);
  const ownTemplates = new Set(own.map((a) => a.templateId));
  const dept = department ? all.filter((a) => a.department === department && !ownTemplates.has(a.templateId)) : [];
  return [...own, ...dept];
}

/**
 * "80:500000, 100:1000000" → [{pct: 80, amount: 500000}, …] (sắp xếp tăng dần).
 * Dấu chấm phân cách nghìn được bỏ. Sai → null.
 */
export function parseTiers(text: string): Tier[] | null {
  const parts = text.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0 || parts.length > 10) return null;
  const tiers: Tier[] = [];
  for (const p of parts) {
    const m = /^(\d{1,3})\s*%?\s*[:=→>-]+\s*([\d.\s]+)$/.exec(p);
    if (!m) return null;
    const pct = Number(m[1]);
    const amount = Number(m[2].replace(/[.\s]/g, ""));
    if (!(pct > 0 && pct <= 500) || !Number.isFinite(amount) || amount > 10_000_000_000) return null;
    tiers.push({ pct, amount });
  }
  tiers.sort((a, b) => a.pct - b.pct);
  return new Set(tiers.map((t) => t.pct)).size === tiers.length ? tiers : null;
}

export const formatTiers = (tiers: Tier[]) => tiers.map((t) => `${t.pct}:${t.amount.toLocaleString("vi-VN")}`).join(", ");

export type TemplateInput = Omit<KpiTemplate, "id" | "archived">;
type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

/** "1.500.000" / "1500000" / "1,5" → số; trống → null; sai → NaN. */
function num(v: FormDataEntryValue | null, decimal = false): number | null {
  const s = typeof v === "string" ? v.trim().replace(/[\s₫đ%]/g, "") : "";
  if (s === "") return null;
  const n = decimal ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s.replace(/[.,]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN;
}

/** Đọc và kiểm tra form mẫu KPI (khớp ràng buộc database 0016). */
export function checkTemplate(form: FormData): Checked<TemplateInput> {
  const str = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string).trim() : "");
  const name = str("name");
  if (name.length < 1 || name.length > 80) return { ok: false, message: "Đặt tên KPI (1–80 ký tự)." };
  const kind = str("kind") as KpiKind;
  if (!(kind in KIND_LABELS)) return { ok: false, message: "Chọn kiểu KPI." };
  let source = str("source") as KpiSource;
  if (!(source in SOURCE_LABELS)) return { ok: false, message: "Chọn nguồn kết quả." };
  if (kind === "per_unit" || kind === "penalty") source = "manual";
  if (kind === "percent" && source === "manual") return { ok: false, message: "KPI % doanh thu phải chọn một nguồn doanh thu Pancake." };
  const channels = source === "channel_revenue" ? [...new Set(form.getAll("channels").map(String))].slice(0, 30) : [];
  if (source === "channel_revenue" && channels.length === 0) return { ok: false, message: "Chọn ít nhất một kênh." };
  const unitLabel = source === "manual" ? str("unitLabel").slice(0, 30) || null : null;

  const rate = kind === "tiers" ? 0 : num(form.get("rate"), kind === "percent");
  if (kind !== "tiers" && (rate === null || Number.isNaN(rate) || rate <= 0)) {
    return { ok: false, message: kind === "percent" ? "Nhập tỷ lệ %, ví dụ 1,5." : "Nhập số tiền, ví dụ 20.000." };
  }
  if (kind === "percent" && rate! > 100) return { ok: false, message: "Tỷ lệ % tối đa 100." };
  let tiers: Tier[] = [];
  if (kind === "tiers") {
    const parsed = parseTiers(str("tiers"));
    if (!parsed) return { ok: false, message: "Bậc thang dạng “80:500.000, 100:1.000.000” (đạt % chỉ tiêu : tiền thưởng)." };
    tiers = parsed;
  }
  const cap = kind === "penalty" ? null : num(form.get("cap"));
  if (cap !== null && Number.isNaN(cap)) return { ok: false, message: "Trần thưởng chỉ gồm chữ số." };
  return { ok: true, value: { name, kind, source, channels, unitLabel, rate: rate ?? 0, tiers, cap } };
}

/** Hàng database → mẫu KPI. */
export function templateFromDb(r: Record<string, unknown>): KpiTemplate {
  return {
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as KpiKind,
    source: r.source as KpiSource,
    channels: (r.channels as string[]) ?? [],
    unitLabel: (r.unit_label as string | null) ?? null,
    rate: Number(r.rate),
    tiers: ((r.tiers as Tier[]) ?? []).map((t) => ({ pct: Number(t.pct), amount: Number(t.amount) })),
    cap: r.cap === null || r.cap === undefined ? null : Number(r.cap),
    archived: !!r.archived_at,
  };
}

export function assignmentFromDb(r: Record<string, unknown>): KpiAssignment {
  return {
    id: r.id as string,
    templateId: r.template_id as string,
    userId: (r.user_id as string | null) ?? null,
    department: (r.department as string | null) ?? null,
    target: r.target === null || r.target === undefined ? null : Number(r.target),
  };
}

/** Mô tả công thức ngắn: "1,5% doanh thu", "20.000 ₫/video", "80% → 500.000 ₫ · 100% → 1.000.000 ₫"… */
export function describeFormula(t: KpiTemplate): string {
  const money = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} ₫`;
  const unit = t.unitLabel ?? "lần";
  const cap = t.cap !== null ? ` (tối đa ${money(t.cap)})` : "";
  switch (t.kind) {
    case "percent":
      return `${String(t.rate).replace(".", ",")}% doanh thu${cap}`;
    case "per_unit":
      return `${money(t.rate)}/${unit}${cap}`;
    case "tiers":
      return t.tiers.map((x) => `đạt ${x.pct}% → ${money(x.amount)}`).join(" · ") + cap;
    case "completion":
      return `${money(t.rate)} × % hoàn thành (tối đa 100%)${cap}`;
    case "penalty":
      return `trừ ${money(t.rate)}/${unit}`;
  }
}
