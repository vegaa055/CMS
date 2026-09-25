import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { siteConfig } from "@/config/site";
import { getSiteSettings } from "@/lib/settings";

export const ogSize = { width: 1200, height: 630 };

// Satori can't read CSS variables; these approximate the dark theme tokens
// in globals.css (background, foreground, muted-foreground, primary, border).
const colors = {
  background: "#0f1116",
  foreground: "#eceef3",
  muted: "#9ba1ad",
  primary: "#57d6c4",
  border: "#262a33",
};

// Passing `fonts` replaces next/og's built-in Geist, so both are registered.
// Literal paths let deployment file tracing bundle the font files.
let fontData: Promise<[Buffer, Buffer]> | undefined;
function loadFonts() {
  fontData ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/InstrumentSerif-Regular.woff")),
    readFile(join(process.cwd(), "assets/fonts/Geist-Regular.ttf")),
  ]);
  return fontData;
}

/** Title size that keeps long titles within the card. */
function titleSize(title: string) {
  if (title.length > 90) return 60;
  if (title.length > 60) return 72;
  if (title.length > 30) return 88;
  return 104;
}

export async function renderOgImage({
  title,
  eyebrow,
  footer,
}: {
  title: string;
  eyebrow?: string;
  footer?: string;
}) {
  const [[serif, sans], site] = await Promise.all([
    loadFonts(),
    getSiteSettings(),
  ]);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: colors.background,
        backgroundImage: `radial-gradient(circle at 85% 0%, ${colors.primary}33, transparent 45%)`,
        color: colors.foreground,
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 28,
          color: colors.muted,
        }}
      >
        <span
          style={{
            fontFamily: "Instrument Serif",
            fontSize: 44,
            color: colors.foreground,
          }}
        >
          {site.name}
        </span>
        {eyebrow && (
          <span
            style={{
              display: "flex",
              padding: "6px 16px",
              border: `1px solid ${colors.border}`,
              borderRadius: 999,
              color: colors.primary,
              fontSize: 22,
            }}
          >
            {eyebrow}
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Instrument Serif",
          fontSize: titleSize(title),
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          maxWidth: 1040,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `1px solid ${colors.border}`,
          paddingTop: 28,
          fontSize: 24,
          color: colors.muted,
        }}
      >
        <span>{footer ?? site.tagline}</span>
        <span style={{ color: colors.primary }}>
          {new URL(siteConfig.url).host}
        </span>
      </div>
    </div>,
    {
      ...ogSize,
      fonts: [
        { name: "Geist", data: sans, style: "normal", weight: 400 },
        { name: "Instrument Serif", data: serif, style: "normal", weight: 400 },
      ],
    },
  );
}
