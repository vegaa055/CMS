"use client";

import { Heart, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setLike } from "@/app/(site)/posts/actions";
import { Button } from "@/components/ui/button";

export function UnlikeButton({
  postId,
  title,
}: {
  postId: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function unlike() {
    startTransition(async () => {
      const result = await setLike(postId, false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Removed from your liked stories");
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={unlike}
      aria-label={`Unlike “${title}”`}
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <Heart className="text-primary fill-current" />
      )}
      Unlike
    </Button>
  );
}
