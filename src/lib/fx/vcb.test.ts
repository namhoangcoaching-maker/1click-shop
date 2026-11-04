import { describe, expect, it } from "vitest";
import { parseVcbRate, rateOn } from "./vcb";

describe("parseVcbRate", () => {
  it("lấy cột mua chuyển khoản của USD (dữ liệu VCB thật ngày 15/10/2026)", () => {
    const body = {
      Date: "2026-10-15T00:00:00",
      Data: [
        { currencyCode: "USD", cash: "25650.00", transfer: "25680.00", sell: "26060.00" },
        { currencyCode: "EUR", cash: "28257.75", transfer: "28543.18", sell: "29748.26" },
      ],
    };
    expect(parseVcbRate(body, "USD")).toBe(25_680);
    expect(parseVcbRate(body, "JPY")).toBeNull();
    expect(parseVcbRate(null, "USD")).toBeNull();
    expect(parseVcbRate({ Data: [{ currencyCode: "USD", transfer: "25,530.00" }] }, "USD")).toBe(25_530);
  });
});

describe("rateOn", () => {
  const rates = new Map([
    ["2026-10-15", 25_680],
    ["2026-10-17", 25_700],
  ]);
  it("đúng ngày; thiếu thì ngày gần nhất trước đó; trước mọi ngày thì ngày gần nhất sau", () => {
    expect(rateOn(rates, "2026-10-15")).toBe(25_680);
    expect(rateOn(rates, "2026-10-16")).toBe(25_680);
    expect(rateOn(rates, "2026-10-20")).toBe(25_700);
    expect(rateOn(rates, "2026-10-01")).toBe(25_680);
    expect(rateOn(new Map(), "2026-10-01")).toBeNull();
  });
});
