/**
 * Signals avatar pipeline, deterministic, no LLM. For each person in
 * signals.json, fetch the profile picture of the account we link to
 * (their own public avatar: via unavatar.io's resolver for X/YouTube, or
 * the public Bluesky API for a bluesky channel), re-host it under
 * public/img/signals/{id}.{ext}, and write the manifest
 * src/data/signal-avatars.json. People whose channels expose no
 * fetchable avatar keep the generated initials tile. Any avatar is
 * removed on request from the person concerned.
 *
 * Idempotent: existing files are kept; delete a file to refresh it.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SignalsFile, SignalPerson } from "../src/data/schema";

const OUT_DIR = "public/img/signals";
const MANIFEST = "src/data/signal-avatars.json";
const UA = "MCC-Vesperio avatar fetcher (mcc.vesperio.ai; mail@florianwardell.com)";
const MAX_BYTES = 2 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function avatarSource(person: SignalPerson): string | null {
  for (const c of person.channels) {
    if (c.status === "dead") continue;
    if (c.type === "x" && c.handle) return `https://unavatar.io/x/${c.handle}?fallback=false`;
    if (c.type === "youtube") {
      const m = c.url.match(/youtube\.com\/@([^/?]+)/);
      if (m) return `https://unavatar.io/youtube/${m[1]}?fallback=false`;
    }
  }
  return null;
}

/** Bluesky handle of the exact account the person's card links to, straight
    from signals.json (never a name search). null when no live bluesky
    channel carries a handle. */
function bskyHandle(person: SignalPerson): string | null {
  for (const c of person.channels) {
    if (c.status === "dead") continue;
    if (c.type === "bluesky" && c.handle) return c.handle;
  }
  return null;
}

/** Resolve a Bluesky handle's avatar URL via the public, unauthenticated
    profile API (same host fetch-thumbs.ts uses to resolve embedded
    articles). Returns null when the profile has no avatar set or the
    lookup fails. */
async function resolveBskyAvatar(handle: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { avatar?: string };
    return data.avatar && /^https?:\/\//i.test(data.avatar) ? data.avatar : null;
  } catch {
    return null;
  }
}

async function download(url: string, id: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    const ext = EXT_BY_TYPE[type];
    if (!ext) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    writeFileSync(join(OUT_DIR, `${id}.${ext}`), buf);
    return `/img/signals/${id}.${ext}`;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const signals = JSON.parse(readFileSync("src/data/signals.json", "utf8")) as SignalsFile;
  const manifest: Record<string, string> = {};

  for (const person of signals.people) {
    const existing = readdirSync(OUT_DIR).find((f) => f.startsWith(person.id + "."));
    if (existing) {
      manifest[person.id] = `/img/signals/${existing}`;
      console.log(`${person.id}: kept ${existing}`);
      continue;
    }
    const src = avatarSource(person);
    if (src) {
      const path = await download(src, person.id);
      if (path) {
        manifest[person.id] = path;
        console.log(`${person.id}: ${path}`);
      } else {
        console.log(`${person.id}: fetch failed, initials tile`);
      }
      continue;
    }

    const handle = bskyHandle(person);
    if (!handle) {
      console.log(`${person.id}: no avatar source, initials tile`);
      continue;
    }
    const bskySrc = await resolveBskyAvatar(handle);
    if (!bskySrc) {
      console.log(`${person.id}: bluesky profile has no avatar, initials tile`);
      continue;
    }
    const bskyPath = await download(bskySrc, person.id);
    if (bskyPath) {
      manifest[person.id] = bskyPath;
      console.log(`${person.id}: ${bskyPath} (bluesky)`);
    } else {
      console.log(`${person.id}: fetch failed, initials tile`);
    }
  }

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`fetch-avatars: ${Object.keys(manifest).length}/${signals.people.length} avatars`);
}

await main();
