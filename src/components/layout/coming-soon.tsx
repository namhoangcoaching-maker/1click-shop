import { ConstructionIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";

/** Trang tạm cho các mục chưa làm: nói rõ sẽ có gì và làm ở giai đoạn nào. */
export function ComingSoon({
  title,
  stage,
  features,
}: {
  title: string;
  /** Ví dụ "Giai đoạn 4". */
  stage: string;
  features: string[];
}) {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 md:px-6">
      <h1 className="text-xl font-bold">{title}</h1>
      <Panel
        title="Đang xây dựng"
        icon={ConstructionIcon}
        tone="orange"
        action={
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            {stage}
          </span>
        }
      >
        <p className="mb-2 text-sm text-muted-foreground">Mục này sẽ có:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
