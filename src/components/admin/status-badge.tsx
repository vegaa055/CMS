import { cn } from "@/lib/utils";

export type PostStatus = "draft" | "scheduled" | "published" | "archived";

const styles: Record<PostStatus, string> = {
  published: "bg-success/15 text-success",
  scheduled: "bg-warning/15 text-warning",
  draft: "bg-muted text-muted-foreground",
  archived: "border-border text-muted-foreground",
};

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full border border-transparent px-2 text-xs font-medium capitalize",
        styles[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {status}
    </span>
  );
}
