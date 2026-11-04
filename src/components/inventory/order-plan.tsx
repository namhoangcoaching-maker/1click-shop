import Link from "next/link";
import { CalendarClockIcon, ChevronRightIcon, OctagonAlertIcon } from "lucide-react";
import { daysUntil, formatDateVN, type DateString } from "@/lib/date-range";
import { formatNumber, formatVelocity } from "@/lib/format";
import type { OrderDay, ProductSuggestion } from "@/lib/inventory/plan";
import { cn } from "@/lib/utils";
import { PlanVariants } from "./plan-variants";

const shortDate = (d: DateString) => formatDateVN(d).slice(0, 5);

function whenText(date: DateString, today: DateString): string {
  const n = daysUntil(date, today);
  return n === 0 ? "hôm nay" : n === 1 ? "ngày mai" : `còn ${n} ngày`;
}

/** Bảng "Cần sản xuất ngay": đợi tới lần đặt kế tiếp sẽ bán âm kho quá giới hạn. */
export function UrgentPlan({
  products,
  today,
  maxNegativeDays,
  canEdit,
}: {
  products: ProductSuggestion[];
  today: DateString;
  maxNegativeDays: number;
  canEdit: boolean;
}) {
  if (products.length === 0) {
    return (
      <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2 text-sm text-success">
        Không có mẫu nào cần sản xuất ngay: đợi tới ngày đặt kế tiếp vẫn không bán âm kho quá {maxNegativeDays} ngày.
      </p>
    );
  }
  return (
    <section aria-label="Cần sản xuất ngay" className="rounded-lg border border-destructive/40 bg-card">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-destructive/30 bg-destructive/10 px-4 py-2">
        <OctagonAlertIcon className="size-4 text-destructive" aria-hidden />
        <span className="font-semibold text-destructive">Cần sản xuất ngay: {products.length} mẫu</span>
        <span className="text-sm text-muted-foreground">
          (nếu đợi tới ngày đặt kế tiếp sẽ bán âm kho quá {maxNegativeDays} ngày · bấm vào mẫu để xem từng size)
        </span>
      </header>
      <ProductList products={products} today={today} canEdit={canEdit} />
    </section>
  );
}

/** Một mục nhắc đặt hàng: Cuối tháng, Ngày 16 (đặt chính), Ngày 10, Ngày 20 (đặt bổ sung). */
export function OrderDaySection({
  day,
  products,
  hiddenSlow,
  today,
  canEdit,
  showSlowHref,
}: {
  day: OrderDay;
  products: ProductSuggestion[];
  hiddenSlow: number;
  today: DateString;
  canEdit: boolean;
  showSlowHref: string | null;
}) {
  const total = products.reduce((s, p) => s + p.total, 0);
  const until = products[0]?.coverUntil;
  return (
    <section className="rounded-lg bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5">
        <CalendarClockIcon className={cn("size-4", day.kind === "main" ? "text-primary" : "text-warning")} aria-hidden />
        <span className="font-semibold">
          {day.label} · {formatDateVN(day.date)}
        </span>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium",
            day.kind === "main" ? "bg-primary/10 text-primary" : "bg-warning/15 text-warning",
          )}
        >
          {day.kind === "main" ? "Đặt chính" : "Đặt bổ sung"}
        </span>
        <span className="text-sm text-muted-foreground">{whenText(day.date, today)}</span>
        {products.length > 0 && (
          <span className="ml-auto text-sm">
            {products.length} mẫu · <b className="tabular-nums">{formatNumber(total)} cái</b>
            {until && <span className="text-muted-foreground"> · đủ bán tới {formatDateVN(until)}</span>}
          </span>
        )}
      </header>
      {products.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          {day.kind === "main"
            ? "Chưa cần đặt thêm mẫu nào cho lần này."
            : "Không cần đặt bổ sung: các mẫu vẫn đủ hàng tới lần đặt chính kế tiếp."}
        </p>
      ) : (
        <ProductList products={products} today={today} canEdit={canEdit} />
      )}
      {hiddenSlow > 0 && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          Đang ẩn {hiddenSlow} mẫu bán chậm (đặt tối thiểu mà lâu mới bán hết).{" "}
          {showSlowHref && (
            <Link href={showSlowHref} scroll={false} className="text-primary hover:underline">
              Xem cả mẫu bán chậm
            </Link>
          )}
        </p>
      )}
    </section>
  );
}

function ProductList({ products, today, canEdit }: { products: ProductSuggestion[]; today: DateString; canEdit: boolean }) {
  return (
    <ul className="max-h-[36rem] divide-y overflow-y-auto">
      {products.map((p) => (
        <li key={`${p.orderDate}-${p.productId}`}>
          <details className="group" suppressHydrationWarning>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
              <ChevronRightIcon
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                aria-hidden
              />
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground">
                {p.variants.filter((v) => v.suggested > 0).length}/{p.variants.length} size cần đặt
                {p.negativeDays > 0 && (
                  <span className="text-destructive"> · bán âm kho khoảng {p.negativeDays} ngày trước khi hàng về</span>
                )}
              </span>
              <span className="ml-auto tabular-nums">
                <b>Gợi ý đặt {formatNumber(p.total)} cái</b>
                <span className="text-muted-foreground">
                  {" "}
                  · SX {p.leadTimeDays} ngày · về khoảng {shortDate(p.arrival)}
                </span>
              </span>
            </summary>
            <div className="bg-muted/40 px-4 pt-1 pb-3">
              <PlanVariants
                productName={p.name}
                rows={p.variants.map((v) => ({
                  id: v.item.id ?? v.item.sku,
                  label: v.item.variant ?? v.item.sku,
                  sku: v.item.sku,
                  stock: v.item.stock,
                  incomingQty: v.incomingQty,
                  velocity: formatVelocity(v.item.velocity),
                  stockout: v.stockout ? shortDate(v.stockout) : null,
                  stockoutSoon: Boolean(v.stockout && v.stockout <= p.coverUntil),
                  short: Math.ceil(v.short),
                  suggested: v.suggested,
                  slow: v.slow,
                }))}
                untilLabel={shortDate(p.coverUntil)}
                estimatedArrival={shortDate(p.arrival)}
                minEta={today}
                canEdit={canEdit}
              />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
