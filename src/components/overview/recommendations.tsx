import Link from "next/link";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  LightbulbIcon,
  OctagonAlertIcon,
  SparklesIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/dashboard/panel";
import type { Recommendation, RecommendationPriority } from "@/lib/overview/recommendations";

const PRIORITY: Record<
  RecommendationPriority,
  { label: string; icon: LucideIcon; chip: string; border: string }
> = {
  urgent: {
    label: "Khẩn",
    icon: OctagonAlertIcon,
    chip: "bg-destructive/10 text-destructive",
    border: "border-l-destructive",
  },
  important: {
    label: "Nên làm",
    icon: TriangleAlertIcon,
    chip: "bg-warning/15 text-warning",
    border: "border-l-warning",
  },
  opportunity: {
    label: "Cơ hội",
    icon: LightbulbIcon,
    chip: "bg-primary/10 text-primary",
    border: "border-l-primary",
  },
};

/** Đề xuất hành động dựa trên dữ liệu: sản xuất, content, xả kho, quảng cáo. */
export function Recommendations({ items }: { items: Recommendation[] }) {
  return (
    <Panel
      title="Đề xuất của AI"
      icon={SparklesIcon}
      tone="violet"
      action={<span className="text-xs text-muted-foreground">{items.length} đề xuất</span>}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có việc gì cần chú ý. Mọi chỉ số đang ổn.</p>
      ) : (
        <ul className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
          {items.map((rec) => (
            <li key={rec.id}>
              <RecommendationCard rec={rec} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Các con số do 1Click tính từ dữ liệu bán hàng và tồn kho. Tốc độ bán tính trung bình 30 ngày gần nhất.
      </p>
    </Panel>
  );
}

/** Gọn một dòng, bấm để mở lý do và việc cần làm. Đề xuất khẩn luôn mở sẵn. */
function RecommendationCard({ rec }: { rec: Recommendation }) {
  const priority = PRIORITY[rec.priority];
  const Icon = priority.icon;

  return (
    <details
      open={rec.priority === "urgent"}
      className={cn("group rounded-md border border-l-4 text-sm", priority.border)}
    >
      <summary className="flex cursor-pointer list-none items-start gap-2 p-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold",
            priority.chip,
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {priority.label}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{rec.title}</span>
          <span className="block truncate text-[13px] text-muted-foreground group-open:hidden">
            {rec.reasons[0]}
          </span>
        </span>
        <ChevronDownIcon
          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className="px-3 pb-3">
        <ul className="mb-2 space-y-0.5 text-[13px] text-muted-foreground">
          {rec.reasons.map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>

        <div className="mb-1 text-xs font-medium text-foreground/70 uppercase">Nên làm</div>
        <ul className="space-y-1">
          {rec.actions.map((action) => (
            <li key={action} className="flex gap-1.5">
              <ArrowRightIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              <span>{action}</span>
            </li>
          ))}
        </ul>

        {rec.link && (
          <Link
            href={rec.link.href}
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
          >
            {rec.link.label}
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </details>
  );
}
