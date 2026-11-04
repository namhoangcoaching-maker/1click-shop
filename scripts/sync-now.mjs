// Chạy đồng bộ Pancake cho mọi shop ngay, lặp lại tới khi lấy đủ lịch sử 90 ngày.
// Dùng cho lần đầu (lấy lịch sử mất vài phút). Cần web đang chạy (npm run dev) hoặc chỉ định web thật.
// Chạy:  npm run sync:now                       (web trên máy, http://localhost:3000)
//        npm run sync:now -- https://shop.nhankhoitu.com.vn
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const base = process.argv[2] ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("Thiếu CRON_SECRET trong .env.local");
  process.exit(1);
}

for (let round = 1; round <= 30; round++) {
  const started = Date.now();
  const res = await fetch(`${base}/api/cron/pancake-sync?budget=50000`, {
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    console.error(`Lượt ${round}: lỗi ${res.status}`, body);
    process.exit(1);
  }
  const results = Object.values(body.results ?? {});
  const line = results
    .map((r) => `${r.status}, ${r.products} mã, ${r.orders} đơn${r.skipped ? `, ⚠️ BỎ QUA ${r.skipped}` : ""}${r.backfillDone ? ", đủ lịch sử" : ""}${r.error ? `, ${r.error}` : ""}`)
    .join(" | ");
  console.log(`Lượt ${round} (${Math.round((Date.now() - started) / 1000)} giây): ${line || "không có shop nào kết nối"}`);
  if (results.every((r) => r.backfillDone || r.status === "error" || r.status === "not_connected")) break;
}
