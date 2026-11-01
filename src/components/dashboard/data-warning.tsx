import { ChevronDownIcon, ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";

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
 * Khung cảnh báo dữ liệu sai hoặc thiếu (PROJECT_BRIEF mục 4).
 * Không được im lặng tính sai: mỗi lỗi nói rõ hậu quả, bấm vào để xem danh sách và cách sửa.
 */
export function DataWarnings({ issues }: { issues: DataIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <section
      aria-label="Dữ liệu cần kiểm tra"
      className="overflow-hidden rounded-lg border border-warning/40 bg-card"
    >
      <header className="flex items-center gap-2 bg-warning/10 px-4 py-2 text-sm font-semibold">
        <TriangleAlertIcon className="size-4 text-warning" aria-hidden />
        Dữ liệu cần kiểm tra ({issues.length}) – một số con số bên dưới có thể chưa chính xác
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
    <details className="group text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{issue.title}</span>
        <span className="hidden min-w-0 flex-1 truncate text-muted-foreground sm:block">
          {issue.impact}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-primary">
          Chi tiết
          <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="space-y-2 px-4 pb-3 pl-4 text-foreground/80">
        <p className="sm:hidden">{issue.impact}</p>
        {shown.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-foreground">
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
            <ExternalLinkIcon className="size-3.5" aria-hidden />
          </a>
        )}
      </div>
    </details>
  );
}
