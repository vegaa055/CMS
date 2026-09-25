import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function UserAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      {image && <AvatarImage src={image} alt="" />}
      <AvatarFallback className="bg-accent text-accent-foreground text-xs">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
