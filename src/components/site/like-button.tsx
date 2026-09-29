"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { setLike } from "@/app/(site)/posts/actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type LikeInfo = { count: number; liked: boolean | null; canSignUp: boolean };

function likesLabel(count: number) {
  return `${count} ${count === 1 ? "like" : "likes"}`;
}

/**
 * Heart button with the post's like total. Everything loads in the browser
 * (the post page itself stays cached), and a click updates instantly while
 * the server catches up. Signed-out visitors are invited to sign in, and
 * come back here afterwards.
 */
export function LikeButton({ postId, path }: { postId: string; path: string }) {
  const [info, setInfo] = useState<LikeInfo | null>(null);
  const [shown, showLiked] = useOptimistic(info, (current, liked: boolean) =>
    current
      ? { ...current, liked, count: current.count + (liked ? 1 : -1) }
      : current,
  );
  const [saving, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/posts/${postId}/likes`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LikeInfo | null) => {
        if (!cancelled && data) setInfo(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (!shown) {
    // Same footprint while loading, so nothing jumps.
    return (
      <Button variant="outline" size="sm" disabled aria-label="Likes loading">
        <Heart />
        <span className="w-3" />
      </Button>
    );
  }

  if (shown.liked === null) {
    const next = `?next=${encodeURIComponent(path)}`;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Like this post (${likesLabel(shown.count)})`}
          >
            <Heart />
            <span className="tabular-nums">{shown.count}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-64 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="font-medium">Sign in to like this post</p>
            <p className="text-muted-foreground text-sm">
              Your likes are private; only the total is shown.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" asChild>
              <Link href={`/login${next}`}>Sign in</Link>
            </Button>
            {shown.canSignUp && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/register${next}`}>Create account</Link>
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const liked = shown.liked;
  function toggle() {
    startTransition(async () => {
      showLiked(!liked);
      const result = await setLike(postId, !liked);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInfo((current) => current && { ...current, ...result.data });
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      aria-pressed={liked}
      // Shown right away; busy until the server has it.
      aria-busy={saving}
      aria-label={`${liked ? "Unlike" : "Like"} this post (${likesLabel(shown.count)})`}
    >
      <Heart className={cn(liked && "text-primary fill-current")} />
      <span className="tabular-nums">{shown.count}</span>
    </Button>
  );
}
