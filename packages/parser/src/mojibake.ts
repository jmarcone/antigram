/**
 * Meta exports captions as UTF-8 bytes that were re-encoded as
 * **Windows-1252** by mistake somewhere in their pipeline. The result is
 * mojibake: an emoji like 🌅 shows up as "ðŸŒ…". The bytes are right; the
 * encoding label is wrong.
 *
 * To repair: re-encode the string as Windows-1252 bytes (the same encoding
 * Meta used by mistake), then decode the byte sequence as UTF-8 — which is
 * what the bytes always were.
 *
 * Why Windows-1252 specifically: Latin-1's 0x80–0x9F are control codes;
 * Windows-1252 maps that range to typographic characters like "Ÿ", "Œ", "…".
 * Meta's mojibake includes those characters (e.g., "ðŸŒ…" has both Ÿ and …),
 * which proves the original bad decode used cp1252.
 *
 * We only repair when we're confident the input is actually mojibake —
 * a round-trip check catches strings that are already correct.
 */

// Windows-1252 → Unicode codepoint mapping for the 0x80–0x9F range that
// differs from Latin-1. Everything 0xA0+ is identical between the two.
const CP1252_HIGH_BYTE_TO_CP: Record<number, number> = {
  0x80: 0x20ac, // €
  0x82: 0x201a, // ‚
  0x83: 0x0192, // ƒ
  0x84: 0x201e, // „
  0x85: 0x2026, // …
  0x86: 0x2020, // †
  0x87: 0x2021, // ‡
  0x88: 0x02c6, // ˆ
  0x89: 0x2030, // ‰
  0x8a: 0x0160, // Š
  0x8b: 0x2039, // ‹
  0x8c: 0x0152, // Œ
  0x8e: 0x017d, // Ž
  0x91: 0x2018, // '
  0x92: 0x2019, // '
  0x93: 0x201c, // "
  0x94: 0x201d, // "
  0x95: 0x2022, // •
  0x96: 0x2013, // –
  0x97: 0x2014, // —
  0x98: 0x02dc, // ˜
  0x99: 0x2122, // ™
  0x9a: 0x0161, // š
  0x9b: 0x203a, // ›
  0x9c: 0x0153, // œ
  0x9e: 0x017e, // ž
  0x9f: 0x0178, // Ÿ
};

// Reverse map: codepoint → byte. Used to re-encode a Unicode string back to
// Windows-1252 bytes.
const CP_TO_CP1252_HIGH_BYTE: Map<number, number> = new Map(
  Object.entries(CP1252_HIGH_BYTE_TO_CP).map(([b, cp]) => [cp, Number.parseInt(b, 10)]),
);

/**
 * Encode a Unicode string as Windows-1252 bytes. Returns null if any char
 * isn't representable in cp1252.
 */
function encodeCp1252(input: string): Uint8Array | null {
  const out = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const cp = input.charCodeAt(i);
    if (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff)) {
      out[i] = cp;
      continue;
    }
    const byte = CP_TO_CP1252_HIGH_BYTE.get(cp);
    if (byte === undefined) return null;
    out[i] = byte;
  }
  return out;
}

const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true });

/**
 * Fix Meta's UTF-8-bytes-as-Windows-1252 mojibake. Returns the input
 * unchanged if we can't confidently confirm it's mojibake. Safe to call on
 * any string.
 */
export function fixMojibake(input: string): string {
  if (!hasAnyHighBitChar(input)) return input;
  const cp1252Bytes = encodeCp1252(input);
  if (!cp1252Bytes) return input;
  let fixed: string;
  try {
    fixed = STRICT_UTF8.decode(cp1252Bytes);
  } catch {
    return input;
  }
  return fixed === input ? input : fixed;
}

/**
 * Detect (without rewriting) whether a string looks like Meta-style mojibake.
 * Useful for diagnostics; not used during parsing.
 */
export function looksMojibake(input: string): boolean {
  return fixMojibake(input) !== input;
}

function hasAnyHighBitChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) >= 0x80) return true;
  }
  return false;
}
