import { WalletIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { InsetBox, Panel, ProgressBar } from "@/components/dashboard/panel";
import { TrendBadge } from "@/components/dashboard/trend-badge";
import { formatVND, percentChange, ratio } from "@/lib/format";
import type { CashflowSummary as CashflowData } from "@/lib/overview/types";

/** Dòng tiền tóm tắt: tổng thu, tổng chi, kết quả âm hay dương, chi tiết các khoản chi. */
export function CashflowSummary({ cashflow }: { cashflow: CashflowData }) {
  const { income, expense } = cashflow;
  const net = income.value - expense.value;
  const prevNet =
    income.previous !== null && expense.previous !== null ? income.previous - expense.previous : null;

  return (
    <Panel title="Dòng tiền" icon={WalletIcon} tone="green">
      <div className="grid grid-cols-3 gap-2">
        <InsetBox>
          <div className="text-xs text-muted-foreground">Tổng thu</div>
          <div className="font-semibold tabular-nums">{formatVND(income.value)}</div>
          {income.previous !== null && <TrendBadge change={percentChange(income.value, income.previous)} />}
        </InsetBox>
        <InsetBox>
          <div className="text-xs text-muted-foreground">Tổng chi</div>
          <div className="font-semibold tabular-nums">{formatVND(expense.value)}</div>
          {expense.previous !== null && (
            <TrendBadge change={percentChange(expense.value, expense.previous)} positiveIsGood={false} />
          )}
        </InsetBox>
        <InsetBox className={cn(net >= 0 ? "bg-success/10" : "bg-destructive/10")}>
          <div className="text-xs text-muted-foreground">{net >= 0 ? "Dương" : "Âm"}</div>
          <div className={cn("font-semibold tabular-nums", net >= 0 ? "text-success" : "text-destructive")}>
            {net > 0 && "+"}
            {formatVND(net)}
          </div>
          {prevNet !== null && <TrendBadge change={percentChange(net, prevNet)} />}
        </InsetBox>
      </div>

      <h3 className="mt-3 mb-1 text-sm font-medium">Các khoản chi</h3>
      <ul className="space-y-1.5">
        {cashflow.expenseBreakdown.map((item) => (
          <li key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="text-right font-medium tabular-nums">{formatVND(item.amount)}</span>
            <ProgressBar
              value={ratio(item.amount, expense.value)}
              label={`Tỷ trọng ${item.label}`}
              className="col-span-2 mt-0.5 h-1"
            />
          </li>
        ))}
      </ul>

      {cashflow.unreconciledCod > 0 && (
        <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-sm">
          <span className="font-medium">{formatVND(cashflow.unreconciledCod)}</span> tiền COD đã giao
          nhưng chưa đối soát với đơn vị vận chuyển.
        </p>
      )}
    </Panel>
  );
}
