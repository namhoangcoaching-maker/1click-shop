import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeftIcon, LinkIcon, ListChecksIcon, TargetIcon, TrophyIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { KpiValue } from "@/components/staff/kpi-view";
import {
  AssignForm,
  RemoveAssignmentButton,
  ResultForm,
  SellerForm,
  TargetForm,
  TemplateForm,
  ToggleTemplateButton,
} from "@/components/staff/kpi-forms";
import { todayInVN } from "@/lib/date-range";
import { recentMonths, resolveMonth } from "@/lib/finance/month";
import { formatVND } from "@/lib/format";
import { getManagerOrg } from "@/lib/org/guard";
import { cachedOrderSourceEntries, cachedPancakeUsers } from "@/lib/pancake/cached";
import { monthEditable } from "@/lib/staff/attendance";
import { isMonthUnlocked } from "@/lib/staff/attendance-data";
import { getMembers } from "@/lib/staff/data";
import { KIND_LABELS, SOURCE_LABELS, describeFormula, isRevenueSource, needsTarget, type KpiTemplate } from "@/lib/staff/kpi";
import { getKpiMonth } from "@/lib/staff/kpi-data";
import { canManage } from "@/lib/staff/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "KPI" };

export default function KpiPage({ searchParams }: PageProps<"/nhan-su/kpi">) {
  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-4 px-4 py-4 md:px-6">
      <div className="flex items-center gap-2">
        <Link href="/nhan-su" className="rounded-md p-1 hover:bg-muted" aria-label="Về Nhân sự">
          <ArrowLeftIcon className="size-5" aria-hidden />
        </Link>
        <h1 className="text-xl font-bold">KPI</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-96 bg-card" />}>
        <Kpi searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const unitOf = (t: KpiTemplate) => (isRevenueSource(t.source) ? "₫" : (t.unitLabel ?? "lần"));

async function Kpi({ searchParams }: Pick<PageProps<"/nhan-su/kpi">, "searchParams">) {
  await connection();
  const org = await getManagerOrg();
  if (!org) return null;
  const today = todayInVN();
  const month = resolveMonth((await searchParams).thang, today);
  const isOwner = org.role === "owner";

  const [members, unlocked, sourceEntries, pancakeUsers] = await Promise.all([
    getMembers(org.id),
    isMonthUnlocked(org.id, month),
    cachedOrderSourceEntries(org.id).catch(() => [] as [string, string][]),
    cachedPancakeUsers(org.id).catch(() => [] as [string, string][]),
  ]);
  const active = members.filter((m) => !m.disabledAt);
  const people = active.filter((m) => canManage(org.role, m.role));
  const kpi = await getKpiMonth(
    org.id,
    month,
    today,
    people.map((m) => ({ userId: m.userId, department: m.department, sellerId: m.settings?.pancakeSellerId ?? null })),
  );
  const editable = monthEditable(`${month}-01`, today, unlocked);
  const nameOf = (id: string | null) => {
    const m = active.find((x) => x.userId === id);
    return m ? (m.displayName ?? m.email ?? "") : "Người đã nghỉ";
  };
  const sourceName = new Map(sourceEntries);
  const sellerName = new Map(pancakeUsers);
  const live = kpi.templates.filter((t) => !t.archived);
  const departments = [...new Set(active.map((m) => m.department).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b, "vi"));
  const withKpi = people.filter((m) => (kpi.byUser.get(m.userId) ?? []).length > 0);

  return (
    <>
      <nav aria-label="Chọn tháng" className="flex flex-wrap gap-1.5">
        {recentMonths(today, 6).map((mo) => (
          <Link
            key={mo}
            href={`/nhan-su/kpi?thang=${mo}`}
            scroll={false}
            aria-current={mo === month ? "page" : undefined}
            className={cn("rounded-md border px-2.5 py-1 text-sm", mo === month ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-card hover:bg-muted")}
          >
            Tháng {mo.slice(5)}/{mo.slice(0, 4)}
          </Link>
        ))}
      </nav>

      <Panel title={`Kết quả KPI tháng ${month.slice(5)}/${month.slice(0, 4)}`} icon={TrophyIcon} tone="orange">
        {kpi.pancakeError && <p className="mb-2 text-sm text-destructive">{kpi.pancakeError}</p>}
        {withKpi.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa gắn KPI cho ai. Tạo mẫu KPI rồi gắn ở bên dưới.</p>
        ) : (
          <div className="space-y-4">
            {withKpi.map((m) => {
              const items = kpi.byUser.get(m.userId)!;
              const total = kpi.totalByUser.get(m.userId) ?? 0;
              return (
                <div key={m.userId}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {m.displayName ?? m.email}
                      {m.department && <span className="ml-1 text-xs font-normal text-muted-foreground">· {m.department}</span>}
                    </span>
                    <span className={cn("font-semibold tabular-nums", total < 0 ? "text-destructive" : "text-success")}>
                      {total >= 0 ? "+" : "−"}
                      {formatVND(Math.abs(total))}
                    </span>
                  </div>
                  <div className="-mx-4 overflow-x-auto px-4">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="py-1.5 pr-2 font-normal">KPI</th>
                          <th className="px-2 py-1.5 text-right font-normal">Chỉ tiêu</th>
                          <th className="px-2 py-1.5 font-normal">Thực tế</th>
                          <th className="px-2 py-1.5 text-right font-normal">Hoàn thành</th>
                          <th className="py-1.5 pl-2 text-right font-normal">Thưởng / phạt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(({ assignment: a, template: t, outcome: o, note }) => (
                          <tr key={a.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-2">
                              <div>{t.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {describeFormula(t)}
                                {a.department ? ` · gắn cho bộ phận ${a.department}` : ""}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{a.target === null ? "—" : <KpiValue value={a.target} unit={unitOf(t)} />}</td>
                            <td className="px-2 py-1.5">
                              {t.source === "manual" && editable ? (
                                <ResultForm assignmentId={a.id} userId={m.userId} month={month} actual={o.actual} note={note} unit={unitOf(t)} />
                              ) : o.actual === null ? (
                                <span className="text-xs text-warning">
                                  {t.source === "seller_revenue" ? "Chưa nối nhân viên Pancake" : t.source === "manual" ? "Chưa nhập" : "Chưa lấy được"}
                                </span>
                              ) : (
                                <span className="tabular-nums">
                                  <KpiValue value={o.actual} unit={unitOf(t)} />
                                  {note && <span className="ml-1 text-xs text-muted-foreground">({note})</span>}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{o.completion === null ? "—" : `${String(o.completion).replace(".", ",")}%`}</td>
                            <td className={cn("py-1.5 pl-2 text-right tabular-nums", o.amount < 0 && "text-destructive")}>
                              {o.amount < 0 ? "−" : ""}
                              {formatVND(Math.abs(o.amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Doanh thu = Doanh thu Pancake (đã trừ chiết khấu, hàng hoàn, phí sàn), tính từ đầu tháng tới hôm nay. Thưởng / phạt
          KPI được cộng vào Lương dự kiến. Kết quả nhập tay sửa được tới hết mùng 5 tháng sau (cùng khóa sổ với chấm công).
          {!editable && " Tháng này đã khóa sổ."}
        </p>
      </Panel>

      <Panel title="KPI đang gắn" icon={ListChecksIcon} tone="blue">
        {live.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có mẫu KPI. {isOwner ? "Tạo mẫu ở khung Mẫu KPI bên dưới." : "Chủ shop tạo mẫu trước."}</p>
        ) : (
          <AssignForm
            templates={live.map((t) => ({ id: t.id, name: t.name, needsTarget: needsTarget(t.kind), unit: unitOf(t) }))}
            people={people.filter((m) => m.settings).map((m) => ({ userId: m.userId, name: m.displayName ?? m.email ?? "" }))}
            departments={isOwner ? departments : null}
          />
        )}
        {kpi.assignments.length > 0 && (
          <div className="-mx-4 mt-4 overflow-x-auto px-4">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-normal">Mẫu KPI</th>
                  <th className="px-2 py-1.5 font-normal">Gắn cho</th>
                  <th className="px-2 py-1.5 font-normal">Chỉ tiêu tháng</th>
                  <th className="py-1.5 pl-2" />
                </tr>
              </thead>
              <tbody>
                {kpi.assignments.map((a) => {
                  const t = kpi.templates.find((x) => x.id === a.templateId)!;
                  const target = active.find((x) => x.userId === a.userId);
                  const can = a.userId ? !!target && canManage(org.role, target.role) : isOwner;
                  const who = a.userId ? `user:${a.userId}` : `dept:${a.department}`;
                  return (
                    <tr key={a.id} className={cn("border-b last:border-0", t.archived && "opacity-50")}>
                      <td className="py-1.5 pr-2">
                        {t.name}
                        {t.archived && <span className="ml-1 text-xs">(ngừng dùng)</span>}
                      </td>
                      <td className="px-2 py-1.5">{a.userId ? nameOf(a.userId) : `Bộ phận ${a.department}`}</td>
                      <td className="px-2 py-1.5">
                        {can ? (
                          <TargetForm id={a.id} templateId={a.templateId} who={who} target={a.target} />
                        ) : a.target === null ? (
                          "—"
                        ) : (
                          <KpiValue value={a.target} unit={unitOf(t)} />
                        )}
                      </td>
                      <td className="py-1.5 pl-2 text-right">{can && <RemoveAssignmentButton id={a.id} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {isOwner
            ? "Gắn cho cả bộ phận: mọi người trong bộ phận (đặt ở Cấu hình nhân sự) cùng áp KPI này; gắn đích danh thì thắng khi trùng mẫu."
            : "Quản lý gắn KPI cho Nhân viên; gắn cho cả bộ phận do Chủ shop làm."}
        </p>
      </Panel>

      <Panel title="Mẫu KPI" icon={TargetIcon} tone="violet">
        {kpi.templates.length === 0 && <p className="mb-2 text-sm text-muted-foreground">Chưa có mẫu.</p>}
        <div className="divide-y">
          {kpi.templates.map((t) => (
            <div key={t.id} className={cn("py-2", t.archived && "opacity-60")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{t.name}</span>
                  {t.archived && <span className="ml-1 text-xs text-muted-foreground">(ngừng dùng)</span>}
                  <div className="text-xs text-muted-foreground">
                    {KIND_LABELS[t.kind]} · {describeFormula(t)} · {SOURCE_LABELS[t.source]}
                    {t.source === "channel_revenue" && `: ${t.channels.map((c) => sourceName.get(c) ?? c).join(", ")}`}
                  </div>
                </div>
                {isOwner && <ToggleTemplateButton id={t.id} archived={t.archived} />}
              </div>
              {isOwner && (
                <details className="mt-1" suppressHydrationWarning>
                  <summary className="cursor-pointer text-xs text-primary">Sửa</summary>
                  <div className="mt-2 rounded-md border p-3">
                    <TemplateForm channels={sourceEntries} template={t} />
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
        {isOwner ? (
          <details className="mt-3 rounded-md border" open={kpi.templates.length === 0} suppressHydrationWarning>
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">+ Tạo mẫu KPI mới</summary>
            <div className="px-3 pb-3">
              <TemplateForm channels={sourceEntries} />
              <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                <li>% doanh thu: ví dụ trực page Facebook + Instagram được 1% doanh thu 2 kênh đó.</li>
                <li>Theo số lượng: ví dụ 20.000 ₫ mỗi video, 2.000 ₫ mỗi đơn đóng gói (Quản lý nhập số cuối tháng).</li>
                <li>Bậc thang: đạt 80% chỉ tiêu thưởng 500.000 ₫, 100% thưởng 1.000.000 ₫…</li>
                <li>Tỷ lệ hoàn thành: thưởng tối đa × % hoàn thành chỉ tiêu (tối đa 100%).</li>
                <li>Trừ phạt: ví dụ trừ 30.000 ₫ mỗi đơn đóng sai.</li>
              </ul>
            </div>
          </details>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Chỉ Chủ shop tạo, sửa mẫu KPI.</p>
        )}
      </Panel>

      <Panel title="Nối nhân viên Pancake" icon={LinkIcon} tone="slate">
        <p className="mb-2 text-xs text-muted-foreground">
          Dùng cho KPI “doanh thu đơn gán cho người này”: chọn tài khoản nhân viên trên Pancake của từng người (đơn trên
          Pancake gán nhân viên bán nào thì doanh thu tính cho người đó). Đơn sàn thường không gán ai.
        </p>
        {pancakeUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa lấy được danh sách nhân viên từ Pancake.</p>
        ) : (
          <div className="divide-y text-sm">
            {people
              .filter((m) => m.settings)
              .map((m) => (
                <div key={m.userId} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span>
                    {m.displayName ?? m.email}
                    {m.settings?.pancakeSellerId && (
                      <span className="ml-1 text-xs text-muted-foreground">→ {sellerName.get(m.settings.pancakeSellerId) ?? "tài khoản đã xóa trên Pancake"}</span>
                    )}
                  </span>
                  <SellerForm userId={m.userId} sellerId={m.settings?.pancakeSellerId ?? null} users={pancakeUsers} />
                </div>
              ))}
          </div>
        )}
      </Panel>
    </>
  );
}
