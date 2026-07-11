/**
 * 64-bit SimHash over normalized title tokens, used to catch wire-service
 * rewrites: an AP story syndicated across outlets keeps a near-identical
 * headline, and two titles within a small Hamming distance collapse into
 * one corroboration unit rather than counting as independent sources.
 *
 * Zero npm dependencies. FNV-1a 64-bit is implemented locally with BigInt.
 */

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const MASK_64 = (1n << 64n) - 1n;

/** FNV-1a 64-bit hash of a string, folded into an unsigned 64-bit BigInt. */
function fnv1a64(token: string): bigint {
  let hash = FNV_OFFSET_BASIS_64;
  for (let i = 0; i < token.length; i++) {
    hash ^= BigInt(token.charCodeAt(i));
    hash = (hash * FNV_PRIME_64) & MASK_64;
  }
  return hash;
}

/**
 * Lowercases, strips a trailing " - Outlet" or " | Outlet" segment when the
 * tail is short (<= 5 words, the Google News feed convention), then
 * tokenizes on runs of non-alphanumeric characters. Empty tokens are
 * dropped.
 */
export function normalizeTitle(title: string): string[] {
  let t = title.toLowerCase().trim();
  // The separator needs whitespace on BOTH sides: outlet suffixes are
  // always " - Outlet" / " | Outlet", and requiring the spaces keeps
  // intra-word hyphens (direct-to-device) out of the match.
  const sepMatch = t.match(/^(.*?)\s+[-|]\s+([^-|]+)$/);
  if (sepMatch) {
    const [, head, tail] = sepMatch;
    const tailWords = tail!.trim().split(/\s+/).filter((w) => w.length > 0);
    if (head!.trim().length > 0 && tailWords.length <= 5) {
      t = head!.trim();
    }
  }
  return t.split(/[^a-z0-9]+/).filter((tok) => tok.length > 0);
}

/**
 * Classic SimHash: each token hashes to 64 bits, each bit position
 * accumulates +weight/-weight (weighted by token frequency) depending on
 * whether that bit is set, and the sign of each accumulator sets the
 * output bit. An empty token list has no signal and returns 0n.
 */
export function simhash64(title: string): bigint {
  const tokens = normalizeTitle(title);
  if (tokens.length === 0) return 0n;

  const freq = new Map<string, number>();
  for (const tok of tokens) freq.set(tok, (freq.get(tok) ?? 0) + 1);

  const acc = new Array<number>(64).fill(0);
  for (const [tok, weight] of freq) {
    const h = fnv1a64(tok);
    for (let bit = 0; bit < 64; bit++) {
      const set = (h >> BigInt(bit)) & 1n;
      acc[bit] += set === 1n ? weight : -weight;
    }
  }

  let out = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (acc[bit]! > 0) out |= 1n << BigInt(bit);
  }
  return out;
}

/** Number of differing bits between two 64-bit hashes. */
export function hammingDistance(a: bigint, b: bigint): number {
  let x = (a ^ b) & MASK_64;
  let count = 0;
  while (x !== 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/**
 * Whether two titles are likely the same underlying story (a wire rewrite,
 * a syndication copy). Default threshold is 3 bits of 64.
 *
 * An empty or punctuation-only title hashes to 0n. Two such titles must
 * never collide with each other or with anything else: a missing title
 * carries no signal, and "no signal" must never be spent to buy a
 * collapse that a corroboration count then relies on.
 */
export function titlesCollide(a: string, b: string, maxDistance = 3): boolean {
  const ha = simhash64(a);
  const hb = simhash64(b);
  if (ha === 0n || hb === 0n) return false;
  return hammingDistance(ha, hb) <= maxDistance;
}
