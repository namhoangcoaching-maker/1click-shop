import { ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DataWarningProps {
  title: string;
  /** Hậu quả nếu không sửa, ví dụ "Lợi nhuận đang hiện bằng 100% doanh thu". */
  impact: string;
  /** Cách sửa trên Pancake. */
  howToFix: string;
  /** Danh sách mục bị lỗi (tên sản phẩm, mã đơn…). Hiện tối đa 5, phần còn lại ghi "và N mục khác". */
  items?: string[];
  fixUrl?: string;
}

const MAX_ITEMS = 5;

/**
 * Banner cảnh báo dữ liệu sai hoặc thiếu (PROJECT_BRIEF mục 4).
 * Không được im lặng tính sai: luôn nói rõ hậu quả và cách sửa.
 */
export function DataWarning({ title, impact, howToFix, items = [], fixUrl }: DataWarningProps) {
  const shown = items.slice(0, MAX_ITEMS);
  const hidden = items.length - shown.length;

  return (
    <Alert className="border-warning/40 bg-warning/5 px-4 py-3 *:[svg]:text-warning">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle className="font-semibold">{title}</AlertTitle>
      <AlertDescription className="space-y-1.5 text-foreground/80">
        <p>{impact}</p>
        {shown.length > 0 && (
          <ul className="list-disc pl-5 text-foreground">
            {shown.map((item) => (
              <li key={item}>{item}</li>
            ))}
            {hidden > 0 && <li className="text-muted-foreground">và {hidden} mục khác</li>}
          </ul>
        )}
        <p>
          <span className="font-medium text-foreground">Cách sửa: </span>
          {howToFix}
        </p>
        {fixUrl && (
          <a
            href={fixUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary no-underline! hover:underline!"
          >
            Mở Pancake để sửa
            <ExternalLinkIcon className="size-3.5" aria-hidden />
          </a>
        )}
      </AlertDescription>
    </Alert>
  );
}
