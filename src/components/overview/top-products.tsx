import { PackageIcon, TrophyIcon, TriangleAlertIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { formatNumber, formatVND } from "@/lib/format";
import type { TopProduct } from "@/lib/overview/types";

/** Top 5 sản phẩm bán chạy theo doanh thu. Dòng sàn chưa liên kết được đánh dấu riêng. */
export function TopProducts({ products }: { products: TopProduct[] }) {
  return (
    <Panel title="Top 5 sản phẩm bán chạy" icon={TrophyIcon} tone="violet">
      <ol className="divide-y">
        {products.map((product, index) => (
          <li key={product.sku ?? `unlinked-${index}`} className="flex items-center gap-3 py-2.5">
            <span className="w-4 text-center text-sm font-semibold text-muted-foreground">
              {index + 1}
            </span>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {product.linked ? (
                <PackageIcon className="size-5" aria-hidden />
              ) : (
                <TriangleAlertIcon className="size-5 text-warning" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              {product.linked ? (
                <>
                  <div className="truncate text-sm font-medium">{product.name}</div>
                  <div className="text-xs text-muted-foreground">{product.sku}</div>
                </>
              ) : (
                <>
                  <div className="truncate text-sm font-medium text-warning">
                    Sản phẩm sàn chưa liên kết (“-”)
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Liên kết trên Pancake để xếp hạng đúng
                  </div>
                </>
              )}
            </div>
            <div className="text-right tabular-nums">
              <div className="text-sm font-semibold">{formatVND(product.revenue)}</div>
              <div className="text-xs text-muted-foreground">{formatNumber(product.quantity)} SP</div>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
