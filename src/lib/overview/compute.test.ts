import { describe, expect, it } from "vitest";
import { rangeToInstants, rangeToPancake, unlinkedQuantity } from "./compute";

describe("khoảng ngày giờ Việt Nam", () => {
  it("ngày 04/11 giờ VN = 03/11 17:00 → 04/11 17:00 giờ quốc tế", () => {
    expect(rangeToInstants({ from: "2026-11-04", to: "2026-11-04" })).toEqual({
      start: "2026-11-03T17:00:00.000Z",
      end: "2026-11-04T17:00:00.000Z",
    });
  });

  it("gửi Pancake: since/until đúng như màn hình Thống kê đã đối chiếu", () => {
    expect(rangeToPancake({ from: "2026-11-04", to: "2026-11-04" })).toEqual({
      since: "2026-11-03T17:00:00Z",
      until: "2026-11-04T16:59:59Z",
    });
    expect(rangeToPancake({ from: "2026-10-06", to: "2026-11-04" }).since).toBe("2026-10-05T17:00:00Z");
  });
});

describe("unlinkedQuantity", () => {
  it("đếm hàng không có mã hoặc mã đã xóa, trừ hàng hoàn", () => {
    const rows = [
      { variation_id: "a", quantity: 3, returned: 1, gross: 0 },
      { variation_id: null, quantity: 4, returned: 1, gross: 0 },
      { variation_id: "da-xoa", quantity: 2, returned: 0, gross: 0 },
    ];
    expect(unlinkedQuantity(rows, ["a"])).toBe(5);
  });
});
