"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMPARE_MODES,
  RANGE_PRESETS,
  type CompareMode,
  type RangePreset,
} from "@/lib/date-range";

interface DateFilterProps {
  preset: RangePreset;
  compare: CompareMode;
  /** Ví dụ "01/11/2026" – do server tính sẵn theo giờ Việt Nam. */
  rangeText: string;
  /** Ví dụ "Trước đó 1 ngày (31/10/2026)", null khi không so sánh. */
  compareText: string | null;
}

/**
 * Bộ lọc thời gian. Lựa chọn được ghi lên thanh địa chỉ (?range=…&compare=…)
 * để trang tải lại đúng số liệu và có thể gửi link cho người khác.
 */
export function DateFilter({ preset, compare, rangeText, compareText }: DateFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function update(next: { range?: RangePreset; compare?: CompareMode }) {
    const params = new URLSearchParams({
      range: next.range ?? preset,
      compare: next.compare ?? compare,
    });
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 data-pending:opacity-60"
      data-pending={isPending || undefined}
    >
      <Select
        items={RANGE_PRESETS}
        value={preset}
        onValueChange={(value) => value && update({ range: value as RangePreset })}
      >
        <SelectTrigger className="bg-card" aria-label="Khoảng thời gian">
          <CalendarIcon className="text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(RANGE_PRESETS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">So sánh với:</span>
        <Select
          items={COMPARE_MODES}
          value={compare}
          onValueChange={(value) => value && update({ compare: value as CompareMode })}
        >
          <SelectTrigger className="bg-card" aria-label="So sánh với">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COMPARE_MODES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="w-full text-xs text-muted-foreground">
        {rangeText}
        {compareText && <> · so với {compareText}</>}
      </p>
    </div>
  );
}
