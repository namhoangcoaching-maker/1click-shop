import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleCheckIcon, CircleAlertIcon, CircleDashedIcon, PlugIcon, ShoppingCartIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { getConnections, getSyncInfo, type ConnectionInfo, type SyncInfo } from "@/lib/connections/queries";
import { formatDateTimeVN } from "@/lib/date-range";
import { formatNumber } from "@/lib/format";
import { getCurrentOrg } from "@/lib/org/current";
import { PancakeForm } from "./pancake-form";
import { SyncButton } from "./sync-button";

export const metadata: Metadata = { title: "Kết nối" };

/** Các nguồn sẽ làm sau, hiện để khách biết lộ trình. */
const UPCOMING = [
  { name: "Pancake Page (hội thoại, tin nhắn)", stage: "Giai đoạn 8" },
  { name: "YouTube, Facebook, Instagram, TikTok (số liệu content)", stage: "Giai đoạn 4" },
  { name: "Hóa đơn điện tử (Pancake / Sinvoice)", stage: "Giai đoạn 7" },
  { name: "Telegram (gửi báo cáo tự động)", stage: "Giai đoạn 2" },
];

export default function ConnectionsPage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <div>
        <h1 className="text-xl font-bold">Kết nối</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Nguồn dữ liệu 1Click dùng để tổng hợp số liệu cho shop của bạn.
        </p>
      </div>

      <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-card" aria-hidden />}>
        <PancakePanel />
      </Suspense>

      <Panel title="Sắp có" icon={PlugIcon} tone="slate">
        <ul className="divide-y text-sm">
          {UPCOMING.map((u) => (
            <li key={u.name} className="flex items-center justify-between gap-3 py-2">
              <span>{u.name}</span>
              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {u.stage}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}

async function PancakePanel() {
  const org = await getCurrentOrg();
  if (!org) return null;
  const conn = (await getConnections(org.id)).find((c) => c.provider === "pancake_pos");
  const sync = conn ? await getSyncInfo(org.id) : null;
  const isOwner = org.role === "owner";

  return (
    <Panel title="Pancake POS" icon={ShoppingCartIcon} tone="blue" action={<StatusBadge conn={conn} />}>
      <p className="mb-3 text-sm text-muted-foreground">
        Đơn hàng, sản phẩm, tồn kho, khách hàng, phiếu chi, công nợ, nhân viên.
      </p>

      {conn && (
        <dl className="mb-4 grid gap-x-6 gap-y-2 rounded-md bg-muted px-3 py-2.5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Shop trên Pancake</dt>
            <dd className="font-medium">
              {conn.externalName ?? "—"} <span className="text-muted-foreground">(ID {conn.externalId})</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Khóa API</dt>
            <dd className="font-mono">{conn.secretHint}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Kiểm tra lần cuối</dt>
            <dd>{conn.lastCheckedAt ? formatDateTimeVN(conn.lastCheckedAt) : "—"}</dd>
          </div>
          {conn.status === "error" && conn.lastError && (
            <div className="text-destructive sm:col-span-3">{conn.lastError}</div>
          )}
        </dl>
      )}

      {conn && <SyncStatus sync={sync} />}

      {isOwner ? (
        <>
          <PancakeForm connected={Boolean(conn)} currentShopId={conn?.externalId} />
          {!conn && <HowToGetKey />}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Chỉ Chủ shop mới thêm, đổi hoặc ngắt được kết nối.</p>
      )}
    </Panel>
  );
}

function SyncStatus({ sync }: { sync: SyncInfo | null }) {
  return (
    <div className="mb-4 space-y-2 rounded-md border px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">Đồng bộ dữ liệu</span>
        <SyncButton />
      </div>
      {!sync ? (
        <p className="text-muted-foreground">Chưa đồng bộ lần nào. Bấm “Đồng bộ ngay” để lấy dữ liệu về.</p>
      ) : (
        <>
          <p className="text-muted-foreground">
            {sync.running
              ? "Đang đồng bộ…"
              : `Lần cuối: ${sync.lastRunAt ? formatDateTimeVN(sync.lastRunAt) : "—"}`}
            {" · "}
            {formatNumber(sync.products)} mã sản phẩm · {formatNumber(sync.orders)} đơn hàng
            {sync.oldestOrderAt && ` (từ ${formatDateTimeVN(sync.oldestOrderAt).slice(0, 10)})`}
            {" · "}Tự động mỗi 30 phút.
          </p>
          {sync.backfillPercent < 100 && (
            <p className="text-warning">
              Đang lấy lịch sử 90 ngày: {sync.backfillPercent}%. Số liệu các trang có thể chưa đủ cho tới khi xong.
            </p>
          )}
          {sync.lastStatus === "error" && sync.lastError && <p className="text-destructive">{sync.lastError}</p>}
        </>
      )}
    </div>
  );
}

function StatusBadge({ conn }: { conn?: ConnectionInfo }) {
  if (!conn) {
    return (
      <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
        <CircleDashedIcon className="size-3.5" aria-hidden /> Chưa kết nối
      </span>
    );
  }
  if (conn.status === "error") {
    return (
      <span className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
        <CircleAlertIcon className="size-3.5" aria-hidden /> Lỗi
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success">
      <CircleCheckIcon className="size-3.5" aria-hidden /> Đã kết nối
    </span>
  );
}

function HowToGetKey() {
  return (
    <details className="mt-4 rounded-md border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">Lấy khóa API ở đâu trên Pancake?</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>Đăng nhập Pancake POS bằng tài khoản chủ shop.</li>
        <li>
          Vào <b>Cấu hình → Ứng dụng</b>, ở khung <b>API KEY</b> bấm <b>Thêm mới</b>.
        </li>
        <li>Sao chép khóa vừa tạo và dán vào ô bên trên. Pancake có thể chỉ hiện khóa một lần.</li>
        <li>Shop ID có thể để trống nếu khóa chỉ dùng cho một shop; 1Click sẽ tự nhận ra.</li>
      </ol>
    </details>
  );
}
