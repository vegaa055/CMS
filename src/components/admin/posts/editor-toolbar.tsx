"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isSafeHref, normalizeHref } from "@/lib/editor/links";

function ToolbarToggle({
  icon: Icon,
  label,
  shortcut,
  pressed,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={pressed ?? false}
          onPressedChange={onClick}
          // Keep focus (and the selection) in the editor when clicking.
          onMouseDown={(e) => e.preventDefault()}
          disabled={disabled}
          aria-label={label}
        >
          <Icon />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && (
          <span className="text-muted-foreground ml-2">{shortcut}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onOpenChange(next: boolean) {
    if (next) {
      setHref(editor.getAttributes("link").href ?? "");
      setError(null);
    }
    setOpen(next);
  }

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const value = normalizeHref(href);
    if (!value) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else if (!isSafeHref(value)) {
      setError("Enter a web address, email, or /path.");
      return;
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: value })
        .run();
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Toggle size="sm" pressed={active} aria-label="Link">
              <Link2 />
            </Toggle>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Link</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={apply} className="flex flex-col gap-2">
          <Input
            autoFocus
            value={href}
            onChange={(e) => {
              setHref(e.target.value);
              setError(null);
            }}
            placeholder="https://example.com"
            aria-label="Link URL"
            aria-invalid={Boolean(error)}
          />
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            {active && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .unsetLink()
                    .run();
                  setOpen(false);
                }}
              >
                Remove
              </Button>
            )}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5"
    >
      <ToolbarToggle
        icon={Heading2}
        label="Heading"
        pressed={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarToggle
        icon={Heading3}
        label="Subheading"
        pressed={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      />
      <Separator orientation="vertical" className="mx-1 h-5!" />
      <ToolbarToggle
        icon={Bold}
        label="Bold"
        shortcut="Ctrl B"
        pressed={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolbarToggle
        icon={Italic}
        label="Italic"
        shortcut="Ctrl I"
        pressed={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolbarToggle
        icon={Underline}
        label="Underline"
        shortcut="Ctrl U"
        pressed={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      <ToolbarToggle
        icon={Strikethrough}
        label="Strikethrough"
        pressed={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <ToolbarToggle
        icon={Code}
        label="Inline code"
        pressed={state.code}
        onClick={() => chain().toggleCode().run()}
      />
      <LinkButton editor={editor} active={state.link} />
      <Separator orientation="vertical" className="mx-1 h-5!" />
      <ToolbarToggle
        icon={List}
        label="Bulleted list"
        pressed={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolbarToggle
        icon={ListOrdered}
        label="Numbered list"
        pressed={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolbarToggle
        icon={Quote}
        label="Quote"
        pressed={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolbarToggle
        icon={SquareCode}
        label="Code block"
        pressed={state.codeBlock}
        onClick={() => chain().toggleCodeBlock().run()}
      />
      <ToolbarToggle
        icon={Minus}
        label="Divider"
        onClick={() => chain().setHorizontalRule().run()}
      />
      <Separator orientation="vertical" className="mx-1 h-5!" />
      <ToolbarToggle
        icon={Undo2}
        label="Undo"
        shortcut="Ctrl Z"
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      />
      <ToolbarToggle
        icon={Redo2}
        label="Redo"
        shortcut="Ctrl Shift Z"
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      />
    </div>
  );
}
