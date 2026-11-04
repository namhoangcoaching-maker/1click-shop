import { describe, expect, it } from "vitest";
import { checkIncomingForm, isOverdue, toPlanItems } from "./incoming";
import type { RealStockItem } from "./real-stock";

const TODAY = "2026-11-05";

const stock = (id: string, soldInWindow: number): RealStockItem => ({
  id,
  productId: "A",
  sku: id,
  name: "Mẫu A",
  variant: id,
  stock: 10,
  soldInWindow,
  leadTimeDays: null,
  costPrice: 1,
  price: 2,
  sold90: soldInWindow * 3,
  inactive: false,
});

describe("toPlanItems", () => {
  it("tốc độ bán = số bán ÷ số ngày; gắn hàng sắp về đúng size", () => {
    const [s, m] = toPlanItems(
      [stock("S", 60), stock("M", 0)],
      [
        { id: "1", variation_id: "S", quantity: 40, eta: "2026-11-12", note: null },
        { id: "2", variation_id: "S", quantity: 20, eta: "2026-11-20", note: null },
      ],
      30,
      TODAY,
    );
    expect(s.velocity).toBe(2);
    expect(s.incoming).toEqual([
      { quantity: 40, eta: "2026-11-12" },
      { quantity: 20, eta: "2026-11-20" },
    ]);
    expect(m.incoming).toEqual([]);
  });

  it("quá ngày về hơn 3 ngày thì không cộng nữa (coi như đã về)", () => {
    expect(isOverdue({ eta: "2026-11-02" }, TODAY)).toBe(false);
    expect(isOverdue({ eta: "2026-11-01" }, TODAY)).toBe(true);
    const [s] = toPlanItems([stock("S", 30)], [{ id: "1", variation_id: "S", quantity: 9, eta: "2026-11-01", note: null }], 30, TODAY);
    expect(s.incoming).toEqual([]);
  });
});

describe("checkIncomingForm", () => {
  it("nhận số lượng từng size, bỏ size để trống/0", () => {
    expect(checkIncomingForm("2026-11-20", { S: "40", M: "", L: "0", XL: " 25 " }, TODAY)).toEqual({
      ok: true,
      eta: "2026-11-20",
      entries: [
        { variationId: "S", quantity: 40 },
        { variationId: "XL", quantity: 25 },
      ],
    });
  });

  it("báo lỗi ngày về sai/thiếu/quá khứ/quá xa", () => {
    expect(checkIncomingForm("", { S: "1" }, TODAY)).toMatchObject({ ok: false });
    expect(checkIncomingForm("2026-11-04", { S: "1" }, TODAY)).toEqual({ ok: false, error: "Ngày về không được trước hôm nay." });
    expect(checkIncomingForm("2027-06-01", { S: "1" }, TODAY)).toMatchObject({ ok: false });
  });

  it("báo lỗi số lượng sai hoặc không có size nào", () => {
    expect(checkIncomingForm("2026-11-20", { S: "-5" }, TODAY)).toMatchObject({ ok: false });
    expect(checkIncomingForm("2026-11-20", { S: "2.5" }, TODAY)).toMatchObject({ ok: false });
    expect(checkIncomingForm("2026-11-20", { S: "" }, TODAY)).toEqual({ ok: false, error: "Nhập số lượng cho ít nhất một size." });
  });
});
