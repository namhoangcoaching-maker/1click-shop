import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Màu nền của biểu tượng tròn ở đầu thẻ, giống Pancake (xanh lá, cam, xanh dương…). */
const ICON_TONES = {
  blue: "bg-primary",
  green: "bg-success",
  orange: "bg-warning",
  red: "bg-destructive",
  violet: "bg-violet-600",
  slate: "bg-slate-500",
} as const;

export type IconTone = keyof typeof ICON_TONES;

export function IconCircle({ icon: Icon, tone = "blue" }: { icon: LucideIcon; tone?: IconTone }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-white",
        ICON_TONES[tone],
      )}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

interface PanelProps {
  title?: string;
  icon?: LucideIcon;
  tone?: IconTone;
  /** Nội dung bên phải tiêu đề: nút, link "Xem tất cả", con số tổng… */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Thẻ trắng phẳng trên nền xám, tiêu đề đậm có biểu tượng tròn – khung chung của mọi khối. */
export function Panel({ title, icon, tone, action, className, children }: PanelProps) {
  return (
    <section className={cn("min-w-0 rounded-lg bg-card p-4", className)}>
      {(title || action) && (
        <header className="mb-3 flex min-h-8 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <IconCircle icon={icon} tone={tone} />}
            {title && <h2 className="truncate text-[15px] font-semibold">{title}</h2>}
          </div>
          {action && <div className="shrink-0 text-sm">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Ô xám nhạt bên trong thẻ trắng (như "Tổng cộng / Online / Bán tại quầy" của Pancake). */
export function InsetBox({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-md bg-muted px-3 py-2.5", className)}>{children}</div>;
}

/** Dòng nhãn bên trái, giá trị bên phải: "Doanh thu: 33.695.642 ₫". */
export function KeyValue({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** Thanh tiến độ mảnh, ví dụ tỷ trọng doanh thu của một kênh, % hóa đơn đã xuất. */
export function ProgressBar({
  value,
  tone = "blue",
  className,
  label,
}: {
  /** 0–100 */
  value: number;
  tone?: "blue" | "green" | "orange" | "red";
  className?: string;
  /** Mô tả cho trình đọc màn hình. */
  label: string;
}) {
  const fill = {
    blue: "bg-primary",
    green: "bg-success",
    orange: "bg-warning",
    red: "bg-destructive",
  }[tone];
  const track = {
    blue: "bg-primary/15",
    green: "bg-success/15",
    orange: "bg-warning/15",
    red: "bg-destructive/15",
  }[tone];
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full", track, className)}
    >
      <div className={cn("h-full rounded-full", fill)} style={{ width: `${clamped}%` }} />
    </div>
  );
}
