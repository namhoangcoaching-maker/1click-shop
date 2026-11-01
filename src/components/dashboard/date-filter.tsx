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
  /** Nhãn của "kỳ liền trước" theo độ dài khoảng đang chọn, ví dụ "Trước đó 7 ngày". */
  previousLabel: string;
  /** Ngày cụ thể, ví dụ "27/10/2026 – 02/11/2026 · so với 20/10/2026 – 26/10/2026". */
  datesText: string;
}

const TRIGGER_CLASS = "h-9 rounded-md bg-card px-3 font-normal";

/**
 * Bộ lọc thời gian kiểu Pancake. Lựa chọn được ghi lên thanh địa chỉ (?range=…&compare=…)
 * để trang tải lại đúng số liệu và có thể gửi link cho người khác.
 */
export function DateFilter({ preset, compare, previousLabel, datesText }: DateFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const compareItems: Record<CompareMode, string> = { ...COMPARE_MODES, previous: previousLabel };

  function update(next: { range?: RangePreset; compare?: CompareMode }) {
    const params = new URLSearchParams({
      range: next.range ?? preset,
      compare: next.compare ?? compare,
    });
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm transition-opacity data-pending:opacity-60"
      data-pending={isPending || undefined}
    >
      <label className="flex items-center gap-2">
        <span className="font-medium">Khoảng thời gian</span>
        <Select
          items={RANGE_PRESETS}
          value={preset}
          onValueChange={(value) => value && update({ range: value as RangePreset })}
        >
          <SelectTrigger className={TRIGGER_CLASS}>
            <CalendarIcon />
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
      </label>

      <label className="flex items-center gap-2">
        <span className="font-medium">So sánh với</span>
        <Select
          items={compareItems}
          value={compare}
          onValueChange={(value) => value && update({ compare: value as CompareMode })}
        >
          <SelectTrigger className={TRIGGER_CLASS}>
            <CalendarIcon />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(compareItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <span className="text-xs text-muted-foreground">{datesText}</span>
    </div>
  );
}
