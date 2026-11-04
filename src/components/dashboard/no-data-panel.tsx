import type { LucideIcon } from "lucide-react";
import { Panel, type IconTone } from "./panel";

/** Khối chưa có nguồn dữ liệu thật: nói rõ khi nào có, không hiện số giả. */
export function NoDataPanel({
  title,
  icon,
  tone = "slate",
  stage,
  note,
}: {
  title: string;
  icon: LucideIcon;
  tone?: IconTone;
  stage: string;
  note: string;
}) {
  return (
    <Panel
      title={title}
      icon={icon}
      tone={tone}
      action={<span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{stage}</span>}
    >
      <p className="text-sm text-muted-foreground">Chưa có dữ liệu. {note}</p>
    </Panel>
  );
}
