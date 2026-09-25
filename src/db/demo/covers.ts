/**
 * Generated abstract cover art for demo posts: soft blurred color fields over
 * a dark gradient with fine contour lines and grain. Deterministic per seed.
 */

export type Palette = {
  background: [string, string];
  blobs: string[];
  lines: string;
};

export const palettes = {
  desert: {
    background: ["#1c1110", "#3a1a14"],
    blobs: ["#f59e0b", "#ef4444", "#fb923c", "#fde68a"],
    lines: "#fde68a",
  },
  teal: {
    background: ["#0b1320", "#0f1116"],
    blobs: ["#2dd4bf", "#6366f1", "#0ea5e9", "#57d6c4"],
    lines: "#a5f3fc",
  },
  violet: {
    background: ["#140d26", "#0f1116"],
    blobs: ["#a78bfa", "#f472b6", "#60a5fa", "#c084fc"],
    lines: "#e9d5ff",
  },
  emerald: {
    background: ["#06140f", "#0f1116"],
    blobs: ["#34d399", "#a3e635", "#14b8a6", "#57d6c4"],
    lines: "#d9f99d",
  },
  ember: {
    background: ["#150c09", "#0f1116"],
    blobs: ["#f97316", "#eab308", "#dc2626", "#fdba74"],
    lines: "#fed7aa",
  },
  slate: {
    background: ["#111318", "#1b2030"],
    blobs: ["#94a3b8", "#57d6c4", "#818cf8", "#e2e8f0"],
    lines: "#cbd5e1",
  },
} satisfies Record<string, Palette>;

/** Small deterministic PRNG (mulberry32). */
function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function coverSvg(
  palette: Palette,
  seed: number,
  width = 1600,
  height = 1000,
) {
  const rand = random(seed);
  // Soft glows as radial gradients: smooth, unlike large blur filters,
  // which band visibly when rasterized.
  const glows = palette.blobs.map((color, i) => {
    const cx = (0.1 + rand() * 0.8) * width;
    const cy = (0.1 + rand() * 0.8) * height;
    const r = (0.28 + rand() * 0.22) * width;
    const opacity = (0.5 + rand() * 0.35).toFixed(2);
    return {
      def: `<radialGradient id="g${i}" gradientUnits="userSpaceOnUse" cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}">
        <stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/>
        <stop offset="0.45" stop-color="${color}" stop-opacity="${(Number(opacity) * 0.35).toFixed(2)}"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </radialGradient>`,
      rect: `<rect width="100%" height="100%" fill="url(#g${i})"/>`,
    };
  });
  const ox = (0.3 + rand() * 0.4) * width;
  const oy = (0.45 + rand() * 0.35) * height;
  const contours = Array.from({ length: 16 }, (_, i) => {
    const r = 90 + i * 64;
    return `<ellipse cx="${ox.toFixed(0)}" cy="${oy.toFixed(0)}" rx="${(r * 1.7).toFixed(0)}" ry="${r}" fill="none" stroke="${palette.lines}" stroke-opacity="${Math.max(0.03, 0.2 - i * 0.011).toFixed(3)}" stroke-width="1.25"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.background[0]}"/>
      <stop offset="1" stop-color="${palette.background[1]}"/>
    </linearGradient>
    ${glows.map((g) => g.def).join("")}
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed % 1000}"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.07 0"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  ${glows.map((g) => g.rect).join("")}
  ${contours}
  <rect width="100%" height="100%" filter="url(#grain)"/>
</svg>`;
}
