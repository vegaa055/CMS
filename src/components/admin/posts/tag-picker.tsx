"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { slugify } from "@/lib/slug";

export function TagPicker({
  value,
  onChange,
  options,
  canCreate,
  invalid,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  options: string[];
  canCreate: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = new Set(value.map(slugify));
  const available = options.filter((o) => !selected.has(slugify(o)));
  const name = query.replace(/\s+/g, " ").trim();
  const nameSlug = slugify(name);
  const isNew =
    Boolean(nameSlug) &&
    !selected.has(nameSlug) &&
    !options.some((o) => slugify(o) === nameSlug);

  function add(tag: string) {
    onChange([...value, tag]);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected tags">
          {value.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((t) => t !== tag))}
                  className="hover:bg-foreground/10 rounded-full p-0.5"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            aria-invalid={invalid}
          >
            <Plus /> Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={canCreate ? "Find or create…" : "Find a tag…"}
            />
            <CommandList>
              <CommandEmpty>
                {canCreate ? "Type a name to create a tag." : "No tags found."}
              </CommandEmpty>
              {available.length > 0 && (
                <CommandGroup>
                  {available.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => add(tag)}
                    >
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {canCreate && isNew && (
                <CommandGroup forceMount>
                  <CommandItem
                    forceMount
                    value={`__create__${name}`}
                    onSelect={() => add(name)}
                  >
                    <Plus /> Create &ldquo;{name}&rdquo;
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
