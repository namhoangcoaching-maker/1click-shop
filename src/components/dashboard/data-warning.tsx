import { ChevronRightIcon, ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";

export interface DataIssue {
  title: string;
  /** Hậu quả nếu không sửa, ví dụ "Lợi nhuận đang bị tính bằng 100% doanh thu". */
  impact: string;
  /** Cách sửa trên Pancake. */
  howToFix: string;
  /** Danh sách mục bị lỗi (tên sản phẩm, mã đơn…). Hiện tối đa 5, phần còn lại ghi "và N mục khác". */
  items?: string[];
  fixUrl?: string;
}

const MAX_ITEMS = 5;

/**
 * Khung nhỏ "Dữ liệu cần kiểm tra" (PROJECT_BRIEF mục 4).
 * Không được im lặng tính sai: mỗi lỗi một dòng, bấm vào để xem hậu quả, danh sách và cách sửa.
 */
export function DataWarnings({ issues }: { issues: DataIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <section aria-label="Dữ liệu cần kiểm tra" className="rounded-lg border border-warning/40 bg-card">
      <header className="flex items-center gap-1.5 border-b border-warning/30 bg-warning/10 px-3 py-1.5 text-[13px] font-semibold">
        <TriangleAlertIcon className="size-3.5 text-warning" aria-hidden />
        Dữ liệu cần kiểm tra ({issues.length})
      </header>
      <ul className="divide-y">
        {issues.map((issue) => (
          <li key={issue.title}>
            <DataIssueRow issue={issue} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DataIssueRow({ issue }: { issue: DataIssue }) {
  const items = issue.items ?? [];
  const shown = items.slice(0, MAX_ITEMS);
  const hidden = items.length - shown.length;

  return (
    <details className="group text-[13px]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate">{issue.title}</span>
        <ChevronRightIcon
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden
        />
      </summary>
      <div className="space-y-1.5 px-3 pb-2.5 text-foreground/80">
        <p>{issue.impact}</p>
        {shown.length > 0 && (
          <ul className="list-disc pl-4 text-foreground">
            {shown.map((item) => (
              <li key={item}>{item}</li>
            ))}
            {hidden > 0 && <li className="text-muted-foreground">và {hidden} mục khác</li>}
          </ul>
        )}
        <p>
          <span className="font-medium text-foreground">Cách sửa: </span>
          {issue.howToFix}
        </p>
        {issue.fixUrl && (
          <a
            href={issue.fixUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Mở Pancake để sửa
            <ExternalLinkIcon className="size-3" aria-hidden />
          </a>
        )}
      </div>
    </details>
  );
}
