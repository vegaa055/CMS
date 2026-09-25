import type { RichTextDoc } from "@/db/schema";

import type { palettes } from "./covers";
import {
  bold,
  code,
  doc,
  h2,
  h3,
  hr,
  italic,
  link,
  ol,
  p,
  pre,
  quote,
  t,
  ul,
} from "./doc";

export const demoAuthors = [
  {
    id: "demo-sam",
    name: "Sam Carter",
    username: "sam",
    email: "sam@demo.folio.local",
    role: "editor" as const,
    bio: "Writes about web platforms, databases, and the small decisions that make software pleasant to use.",
  },
  {
    id: "demo-riley",
    name: "Riley Park",
    username: "riley",
    email: "riley@demo.folio.local",
    role: "author" as const,
    bio: "Designer and occasional photographer. Mostly found somewhere with good light and bad cell service.",
  },
];

export type DemoPost = {
  title: string;
  excerpt: string;
  author: (typeof demoAuthors)[number]["id"];
  tags: string[];
  /** Days before now; negative = scheduled in the future. Null = draft. */
  daysAgo: number | null;
  cover?: keyof typeof palettes;
  content: RichTextDoc;
};

export const demoPosts: DemoPost[] = [
  {
    title: "Field notes from the Sonoran Desert",
    excerpt:
      "Three days of saguaros, monsoon clouds, and learning to shoot in light that changes by the minute.",
    author: "demo-riley",
    tags: ["Travel", "Photography"],
    daysAgo: 1,
    cover: "desert",
    content: doc(
      p(
        "The desert rewards patience. For the first hour after sunrise the light is soft and low, the saguaros throw long shadows, and everything smells faintly of creosote from last night's storm.",
      ),
      h2("Chasing the golden hour"),
      p(
        "Most of my keepers came from two short windows each day. Midday light flattens everything; the ",
        t("interesting", italic),
        " work happens when the sun is within a fist of the horizon.",
      ),
      ul(
        "Scout locations at noon, shoot them at dusk",
        "Underexpose by a third of a stop to keep the sky",
        "Carry twice the water you think you need",
      ),
      h2("Monsoon season"),
      p(
        "Afternoon storms build fast over the mountains. They make for dramatic skies — and for washes that fill in minutes. Never park in one.",
      ),
      quote(
        "The desert is not empty. It is full of things that have learned to be quiet.",
      ),
      h3("What I packed"),
      ol(
        "One body, a 24–70mm, and a 70–200mm",
        "A light tripod for blue hour",
        "A headlamp with a red-light mode",
      ),
      p(
        "Next time: a longer stay, and a night of astrophotography away from the city glow.",
      ),
    ),
  },
  {
    title: "Scheduling posts without a cron job",
    excerpt:
      "How a single SQL condition and incremental static regeneration replace a background worker.",
    author: "demo-sam",
    tags: ["Engineering", "Next.js"],
    daysAgo: 4,
    cover: "teal",
    content: doc(
      p(
        "The usual way to schedule a post is a background job that wakes up, finds posts whose time has come, and flips them to published. It works, but it's one more moving part to deploy, monitor, and forget about.",
      ),
      h2("Make “live” a query, not a state"),
      p(
        "Instead of changing the stored status, treat a scheduled post as live once its publish time has passed. Every public query uses the same condition:",
      ),
      pre(`export function livePostWhere(now = new Date()) {
  return and(
    inArray(posts.status, ["published", "scheduled"]),
    isNotNull(posts.publishedAt),
    lte(posts.publishedAt, now),
  );
}`),
      p(
        "The admin shows the ",
        t("effective", italic),
        " status with a small helper, so editors see “published” the moment the time passes.",
      ),
      h2("Let the cache expire on a timer"),
      p(
        "Public pages are statically generated. Publishing triggers an immediate refresh, and every page also revalidates every five minutes — which is exactly when a scheduled post shows up.",
      ),
      ul(
        [t("Zero", bold), " extra infrastructure"],
        "Scheduled posts appear within minutes, not instantly — fine for a blog",
        ["The same rule protects drafts: one function, used everywhere"],
      ),
    ),
  },
  {
    title: "Pairing a serif display face with a sans",
    excerpt:
      "A condensed serif for headlines, a quiet sans for everything else, and why the contrast does the work.",
    author: "demo-riley",
    tags: ["Design", "Typography"],
    daysAgo: 9,
    cover: "violet",
    content: doc(
      p(
        "Good type pairing is mostly about contrast with a shared rhythm. A tall, condensed serif like Instrument Serif brings personality to headings; a neutral geometric sans keeps long passages calm.",
      ),
      h2("Rules of thumb"),
      ol(
        "Pick one expressive face and one workhorse",
        "Match x-heights more than letterforms",
        "Use size and weight for hierarchy before adding a third family",
      ),
      h2("Tuning for dark mode"),
      p(
        "Light text on dark backgrounds looks heavier. Nudge body text slightly toward the background color and add a touch of letter-spacing to large display sizes.",
      ),
      quote("Typography is what language looks like."),
    ),
  },
  {
    title: "Direct-to-storage uploads with presigned URLs",
    excerpt:
      "Keeping large files off your server: the browser uploads straight to R2, and the server verifies afterwards.",
    author: "demo-sam",
    tags: ["Engineering"],
    daysAgo: 14,
    cover: "emerald",
    content: doc(
      p(
        "Serverless functions have tight body-size limits and bill by the millisecond. Streaming a 10 MB image through one is wasteful when object storage can accept it directly.",
      ),
      h2("The three-step handshake"),
      ol(
        [
          t("requestUpload", code),
          " validates type and size, returns a short-lived signed URL",
        ],
        [
          "The browser ",
          t("PUT", code),
          "s the file straight to storage, with progress",
        ],
        [
          t("completeUpload", code),
          " checks what actually landed, then records it",
        ],
      ),
      p(
        "The last step matters: a presigned PUT can't enforce size, so the server re-checks the stored object and deletes anything that doesn't match. See the ",
        t("Cloudflare R2 docs", link("https://developers.cloudflare.com/r2/")),
        " for bucket and CORS setup.",
      ),
    ),
  },
  {
    title: "A small case for writing things down",
    excerpt:
      "Notes, logs, and half-finished drafts are how ideas survive long enough to become good ones.",
    author: "demo-riley",
    tags: ["Writing", "Notes"],
    daysAgo: 19,
    cover: "ember",
    content: doc(
      p(
        "Most ideas don't fail because they're bad. They fail because they're forgotten before they're finished.",
      ),
      h2("Low-friction capture"),
      p(
        "The best notebook is the one that's open. Write the sentence now; decide where it belongs later.",
      ),
      hr(),
      p(
        "Publishing is just the moment a note is ready to be read by someone else.",
      ),
    ),
  },
  {
    title: "What I learned rebuilding an old PHP blog",
    excerpt:
      "Moving a hand-rolled PHP site to Next.js, Postgres, and a real editor — and what I'd keep from the original.",
    author: "demo-sam",
    tags: ["Engineering", "Next.js"],
    daysAgo: 27,
    cover: "slate",
    content: doc(
      p(
        "The old site did its job for years: a handful of PHP files, a MySQL database, and an upload folder. Rebuilding it was less about fixing what was broken and more about making the next ten years easy.",
      ),
      h2("What changed"),
      ul(
        "Roles and invites instead of one shared password",
        "A structured editor instead of raw HTML in a textarea",
        "Static pages that refresh themselves instead of a query per view",
      ),
      h2("What stayed"),
      p(
        "Simple URLs, fast pages, and the habit of writing regularly. The stack changed; the point didn't.",
      ),
    ),
  },
  {
    title: "Ideas for next quarter",
    excerpt: "A working list — not ready for readers yet.",
    author: "demo-sam",
    tags: ["Notes"],
    daysAgo: null,
    content: doc(
      ul("Comments with moderation", "Newsletter delivery", "Revision history"),
    ),
  },
  {
    title: "Coming soon: a photo essay",
    excerpt: "Scheduled for later this week.",
    author: "demo-riley",
    tags: ["Photography"],
    daysAgo: -3,
    cover: "desert",
    content: doc(p("A longer piece with more images from the trip.")),
  },
];
