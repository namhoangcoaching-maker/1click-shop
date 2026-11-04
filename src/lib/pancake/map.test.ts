import { describe, expect, it } from "vitest";
import { isConfirmed, mapOrder, mapVariation, orderStatusLabel, parsePancakeTime } from "./map";

// Mẫu dựng theo đúng cấu trúc Pancake trả về cho shop thật (đã bỏ thông tin khách).
const variation = {
  id: "9ca27235-a959-4f43-b2b3-f43a53a91fdf",
  product_id: "5a495d38-d90c-405f-a842-e43796d3dbfd",
  display_id: "SC181M",
  retail_price: 500000,
  average_imported_price: 130000,
  last_imported_price: 125000,
  remain_quantity: 10,
  is_hidden: false,
  updated_at: "2026-11-02T09:01:43.814010",
  fields: [
    { id: "a", name: "Màu", value: "Xám", keyValue: "Xám" },
    { id: "b", name: "Size", value: "M", keyValue: "M" },
  ],
  product: { name: "Birdie Top", note: "SX: 10", note_product: "SUGAR CRUSH | BIRDIE TOP…" },
};

const order = {
  id: "261104EK2E1FYN",
  system_id: 42166,
  inserted_at: "2026-11-04T13:41:31.000000",
  updated_at: "2026-11-04T14:00:00.000000",
  status: 3,
  order_sources_name: "Shopee",
  total_price: 369000,
  total_discount: 0,
  shipping_fee: 0,
  surcharge: 0,
  fee_marketplace: 115545,
  partner_fee: 0,
  tax: 0,
  total_price_after_sub_discount: 253455,
  total_quantity: 1,
  assigning_seller_id: "seller-1",
  bill_full_name: "Nguyễn Văn A",
  bill_phone_number: "0900000000",
  shipping_address: { full_address: "…" },
  items: [
    {
      id: "item-1",
      variation_id: "9ca27235-a959-4f43-b2b3-f43a53a91fdf",
      product_id: "5a495d38-d90c-405f-a842-e43796d3dbfd",
      quantity: 1,
      variation_info: { retail_price: 369000 },
      discount_each_product: 0,
      total_discount: 0,
      return_quantity: 0,
      is_bonus_product: false,
    },
  ],
};

describe("parsePancakeTime", () => {
  it("giờ Pancake là giờ quốc tế không kèm múi giờ", () => {
    expect(parsePancakeTime("2026-11-04T13:41:31.000000")).toBe("2026-11-04T13:41:31.000Z");
    expect(parsePancakeTime("2026-11-04T13:41:31+07:00")).toBe("2026-11-04T06:41:31.000Z");
    expect(parsePancakeTime("")).toBeNull();
    expect(parsePancakeTime("rác")).toBeNull();
    expect(parsePancakeTime(null)).toBeNull();
  });
});

describe("mapVariation", () => {
  it("lấy tên, màu/size, giá bán, giá nhập TRUNG BÌNH, tồn, ghi chú nội bộ (note, không phải note_product)", () => {
    expect(mapVariation(variation)).toEqual({
      variation_id: variation.id,
      product_id: variation.product_id,
      sku: "SC181M",
      name: "Birdie Top",
      variant: "Xám / M",
      retail_price: 500000,
      cost_price: 130000,
      stock: 10,
      internal_note: "SX: 10",
      is_hidden: false,
      pancake_updated_at: "2026-11-02T09:01:43.814Z",
    });
  });

  it("giá vốn 0 nghĩa là chưa nhập → null; thiếu màu/size, ghi chú → null", () => {
    const row = mapVariation({ ...variation, average_imported_price: 0, fields: [], product: { name: "X" } });
    expect(row).toMatchObject({ cost_price: null, variant: null, internal_note: null });
  });

  it("thiếu id thì bỏ qua", () => {
    expect(mapVariation({ ...variation, id: "" })).toBeNull();
  });
});

describe("mapOrder", () => {
  it("lấy số tiền, phí sàn, nguồn đơn và dòng hàng", () => {
    const r = mapOrder(order)!;
    expect(r.order).toMatchObject({
      order_id: "261104EK2E1FYN",
      system_id: 42166,
      inserted_at: "2026-11-04T13:41:31.000Z",
      status: 3,
      source: "Shopee",
      total_price: 369000,
      fee_marketplace: 115545,
      total_after_discount: 253455,
      seller_id: "seller-1",
    });
    expect(r.items).toEqual([
      {
        order_id: "261104EK2E1FYN",
        item_id: "item-1",
        variation_id: variation.id,
        product_id: variation.product_id,
        quantity: 1,
        retail_price: 369000,
        discount_each_product: 0,
        total_discount: 0,
        return_quantity: 0,
        is_bonus: false,
      },
    ]);
  });

  it("KHÔNG mang theo thông tin cá nhân của khách", () => {
    const text = JSON.stringify(mapOrder(order));
    expect(text).not.toContain("Nguyễn Văn A");
    expect(text).not.toContain("0900000000");
    expect(text).not.toContain("full_address");
  });

  it("mã đơn sàn là chữ (Shopee), mã đơn tạo trên Pancake là số: đều giữ, lưu dạng chữ", () => {
    expect(mapOrder(order)!.order.order_id).toBe("261104EK2E1FYN");
    expect(mapOrder({ ...order, id: 41813 })!.order.order_id).toBe("41813");
  });

  it("đơn thiếu id hoặc ngày tạo thì bỏ qua", () => {
    expect(mapOrder({ ...order, id: "" })).toBeNull();
    expect(mapOrder({ ...order, id: null })).toBeNull();
    expect(mapOrder({ ...order, inserted_at: null })).toBeNull();
  });
});

describe("trạng thái đơn", () => {
  it("đơn chốt: từ Đã xác nhận trở đi, kể cả hoàn; không tính Mới, Chờ hàng, Hủy", () => {
    for (const s of [1, 8, 9, 2, 3, 4, 5, 15]) expect(isConfirmed(s)).toBe(true);
    for (const s of [0, 11, 20, 6, 7]) expect(isConfirmed(s)).toBe(false);
  });

  it("tên trạng thái tiếng Việt", () => {
    expect(orderStatusLabel(3)).toBe("Đã nhận");
    expect(orderStatusLabel(6)).toBe("Đã hủy");
    expect(orderStatusLabel(99)).toBe("Trạng thái 99");
  });
});
