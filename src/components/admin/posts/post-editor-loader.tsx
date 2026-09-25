"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

function EditorSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-14 w-3/4" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * The editor is client-only: it depends on browser APIs, local time zones,
 * and contentEditable, so server-rendering it only risks hydration mismatches.
 */
export const PostEditorLoader = dynamic(
  () => import("./post-editor").then((m) => m.PostEditor),
  { ssr: false, loading: EditorSkeleton },
);
