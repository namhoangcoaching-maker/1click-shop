"use client";

import { useActionState, useState } from "react";
import {
  removeAssignment,
  saveAssignment,
  saveResult,
  saveSellerLink,
  saveTemplate,
  toggleTemplate,
  type KpiState,
} from "@/lib/staff/kpi-actions";
import { KIND_LABELS, SOURCE_LABELS, formatTiers, type KpiKind, type KpiSource, type KpiTemplate } from "@/lib/staff/kpi";

const input = "h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary";
const btn = "h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60";
const small = "h-8 rounded-md border bg-card px-2.5 text-xs hover:bg-muted disabled:opacity-60";

function Msg({ s }: { s: KpiState }) {
  if (!s.message) return null;
  return <span className={`text-xs ${s.ok ? "text-success" : "text-destructive"}`}>{s.message}</span>;
}

const label = (text: string, child: React.ReactNode, wide = false) => (
  <label className={`space-y-1 ${wide ? "min-w-[220px] flex-1" : ""}`}>
    <span className="block text-xs text-muted-foreground">{text}</span>
    {child}
  </label>
);

/** Tạo / sửa mẫu KPI (Chủ shop). Ô hiện theo kiểu KPI đang chọn. */
export function TemplateForm({ channels, template }: { channels: [string, string][]; template?: KpiTemplate }) {
  const [state, action, pending] = useActionState<KpiState, FormData>(saveTemplate, {});
  const [kind, setKind] = useState<KpiKind>(template?.kind ?? "percent");
  const [source, setSource] = useState<KpiSource>(template?.source ?? "shop_revenue");
  const manualOnly = kind === "per_unit" || kind === "penalty";
  const effSource = manualOnly ? "manual" : source;
  const sources = (Object.keys(SOURCE_LABELS) as KpiSource[]).filter((s) => !(kind === "percent" && s === "manual"));

  return (
    <form action={action} className="space-y-3 text-sm">
      {template && <input type="hidden" name="id" value={template.id} />}
      <div className="flex flex-wrap items-end gap-3">
        {label("Tên KPI", <input name="name" required maxLength={80} defaultValue={template?.name} placeholder="Ví dụ: Hoa hồng trực page" className={`${input} w-full`} />, true)}
        {label(
          "Kiểu",
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as KpiKind)} className={input}>
            {(Object.keys(KIND_LABELS) as KpiKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>,
        )}
        {manualOnly ? (
          <input type="hidden" name="source" value="manual" />
        ) : (
          label(
            "Kết quả lấy từ",
            <select name="source" value={effSource === "manual" && kind === "percent" ? "shop_revenue" : effSource} onChange={(e) => setSource(e.target.value as KpiSource)} className={input}>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>,
          )
        )}
      </div>

      {effSource === "channel_revenue" && kind !== "per_unit" && (
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
          <legend className="mb-1 text-xs text-muted-foreground">Kênh (nguồn đơn Pancake) tính doanh thu</legend>
          {channels.map(([id, name]) => (
            <label key={id} className="inline-flex items-center gap-1.5">
              <input type="checkbox" name="channels" value={id} defaultChecked={template?.channels.includes(id)} />
              {name}
            </label>
          ))}
        </fieldset>
      )}

      <div className="flex flex-wrap items-end gap-3">
        {kind === "tiers" ? (
          label(
            "Bậc thang (đạt % chỉ tiêu : tiền thưởng)",
            <input name="tiers" required defaultValue={template ? formatTiers(template.tiers) : ""} placeholder="80:500.000, 100:1.000.000, 120:1.500.000" className={`${input} w-full`} />,
            true,
          )
        ) : (
          label(
            kind === "percent" ? "Tỷ lệ (% doanh thu)" : kind === "completion" ? "Thưởng khi đạt 100% (₫)" : kind === "penalty" ? "Tiền phạt mỗi lần (₫)" : "Tiền mỗi đơn vị (₫)",
            <input name="rate" required inputMode="decimal" defaultValue={template ? String(template.rate).replace(".", ",") : ""} placeholder={kind === "percent" ? "1,5" : "20.000"} className={`${input} w-40`} />,
          )
        )}
        {(effSource === "manual" || manualOnly) &&
          label("Đơn vị (khi nhập tay)", <input name="unitLabel" maxLength={30} defaultValue={template?.unitLabel ?? ""} placeholder="video, đơn, lỗi…" className={`${input} w-36`} />)}
        {kind !== "penalty" &&
          label("Trần thưởng / tháng (₫, để trống = không giới hạn)", <input name="cap" inputMode="numeric" defaultValue={template?.cap ?? ""} className={`${input} w-44`} />)}
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "Đang lưu…" : template ? "Lưu" : "Tạo mẫu"}
        </button>
        <Msg s={state} />
      </div>
    </form>
  );
}

export function ToggleTemplateButton({ id, archived }: { id: string; archived: boolean }) {
  const [state, action, pending] = useActionState<KpiState, FormData>(toggleTemplate, {});
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="archive" value={archived ? "0" : "1"} />
      <button type="submit" disabled={pending} className={small}>
        {archived ? "Dùng lại" : "Ngừng dùng"}
      </button>
      <Msg s={state} />
    </form>
  );
}

/** Gắn KPI cho người / bộ phận, kèm chỉ tiêu tháng. */
export function AssignForm({
  templates,
  people,
  departments,
}: {
  templates: { id: string; name: string; needsTarget: boolean; unit: string }[];
  people: { userId: string; name: string }[];
  departments: string[] | null;
}) {
  const [state, action, pending] = useActionState<KpiState, FormData>(saveAssignment, {});
  const [tid, setTid] = useState(templates[0]?.id ?? "");
  const t = templates.find((x) => x.id === tid);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 text-sm">
      {label(
        "Mẫu KPI",
        <select name="templateId" value={tid} onChange={(e) => setTid(e.target.value)} className={input}>
          {templates.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>,
      )}
      {label(
        "Gắn cho",
        <select name="who" className={input} required defaultValue="">
          <option value="" disabled>
            Chọn người / bộ phận
          </option>
          <optgroup label="Người">
            {people.map((p) => (
              <option key={p.userId} value={`user:${p.userId}`}>
                {p.name}
              </option>
            ))}
          </optgroup>
          {departments && departments.length > 0 && (
            <optgroup label="Cả bộ phận">
              {departments.map((d) => (
                <option key={d} value={`dept:${d}`}>
                  Bộ phận {d}
                </option>
              ))}
            </optgroup>
          )}
        </select>,
      )}
      {label(
        `Chỉ tiêu tháng (${t?.unit ?? ""})${t?.needsTarget ? "" : " – không bắt buộc"}`,
        <input name="target" inputMode="decimal" required={t?.needsTarget} placeholder={t?.unit === "₫" ? "100.000.000" : "30"} className={`${input} w-44`} />,
      )}
      <button type="submit" disabled={pending || !tid} className={btn}>
        Gắn KPI
      </button>
      <Msg s={state} />
    </form>
  );
}

export function TargetForm({ id, templateId, who, target }: { id: string; templateId: string; who: string; target: number | null }) {
  const [state, action, pending] = useActionState<KpiState, FormData>(saveAssignment, {});
  return (
    <form action={action} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="who" value={who} />
      <input
        name="target"
        inputMode="decimal"
        defaultValue={target === null ? "" : target.toLocaleString("vi-VN")}
        aria-label="Chỉ tiêu"
        className="h-8 w-32 rounded-md border border-input bg-card px-2 text-right text-xs tabular-nums"
      />
      <button type="submit" disabled={pending} className={small}>
        Lưu
      </button>
      <Msg s={state} />
    </form>
  );
}

export function RemoveAssignmentButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<KpiState, FormData>(removeAssignment, {});
  return (
    <form action={action} className="inline-flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={`${small} text-destructive`}>
        Bỏ
      </button>
      <Msg s={state} />
    </form>
  );
}

/** Nhập kết quả KPI nhập tay của một người trong tháng. */
export function ResultForm({
  assignmentId,
  userId,
  month,
  actual,
  note,
  unit,
}: {
  assignmentId: string;
  userId: string;
  month: string;
  actual: number | null;
  note: string | null;
  unit: string;
}) {
  const [state, action, pending] = useActionState<KpiState, FormData>(saveResult, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="month" value={month} />
      <input
        name="actual"
        inputMode="decimal"
        defaultValue={actual === null ? "" : String(actual).replace(".", ",")}
        placeholder="0"
        aria-label={`Kết quả (${unit})`}
        className="h-8 w-20 rounded-md border border-input bg-card px-2 text-right text-xs tabular-nums"
      />
      <span className="text-xs text-muted-foreground">{unit}</span>
      <input name="note" defaultValue={note ?? ""} maxLength={200} placeholder="Ghi chú" aria-label="Ghi chú" className="h-8 w-32 rounded-md border border-input bg-card px-2 text-xs" />
      <button type="submit" disabled={pending} className={small}>
        Lưu
      </button>
      <Msg s={state} />
    </form>
  );
}

/** Nối nhân sự 1Click với tài khoản nhân viên trên Pancake. */
export function SellerForm({ userId, sellerId, users }: { userId: string; sellerId: string | null; users: [string, string][] }) {
  const [state, action, pending] = useActionState<KpiState, FormData>(saveSellerLink, {});
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <select name="sellerId" defaultValue={sellerId ?? ""} aria-label="Nhân viên trên Pancake" className="h-8 rounded-md border border-input bg-card px-2 text-xs">
        <option value="">— Chưa nối —</option>
        {users.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className={small}>
        Lưu
      </button>
      <Msg s={state} />
    </form>
  );
}
