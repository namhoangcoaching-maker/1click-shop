"use client";

import { useActionState } from "react";
import { saveTagName, type TagState } from "@/lib/finance/tag-actions";

export interface TagRow {
  tagId: string;
  name: string | null;
  sample: string | null;
  count: number;
}

function TagForm({ tag, canEdit }: { tag: TagRow; canEdit: boolean }) {
  const [state, action, pending] = useActionState<TagState, FormData>(saveTagName, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
      <input type="hidden" name="tagId" value={tag.tagId} />
      <input
        name="name"
        defaultValue={tag.name ?? ""}
        placeholder="Đặt tên thẻ, ví dụ Sản xuất"
        disabled={!canEdit || pending}
        maxLength={60}
        aria-label={`Tên thẻ ${tag.tagId}`}
        className={`h-8 w-48 rounded-md border bg-card px-2 outline-none focus:border-primary ${tag.name ? "border-input" : "border-warning"}`}
      />
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {tag.count} phiếu{tag.sample ? ` · ví dụ: “${tag.sample}”` : ""}
      </span>
      {canEdit && (
        <button type="submit" disabled={pending} className="h-8 rounded-md border px-2.5 text-xs hover:bg-muted disabled:opacity-60">
          Lưu
        </button>
      )}
      {state.message && (
        <span className={state.ok ? "text-xs text-success" : "text-xs text-destructive"}>{state.message}</span>
      )}
    </form>
  );
}

/**
 * Thẻ phiếu chi Pancake: Pancake chỉ cho 1Click biết MÃ thẻ, không biết TÊN,
 * nên Chủ shop đặt tên một lần (theo phiếu ví dụ). Thẻ chưa đặt tên viền vàng.
 */
export function TagNames({ tags, canEdit }: { tags: TagRow[]; canEdit: boolean }) {
  return (
    <div className="divide-y">
      {tags.map((t) => (
        <TagForm key={t.tagId} tag={t} canEdit={canEdit} />
      ))}
    </div>
  );
}
