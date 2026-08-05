/**
 * PNG metadata extract — ordinary tEXt / zTXt / iTXt chunks (as practical for M4).
 * Stealth alpha pnginfo is out of scope for v0; text-chunk path is proven with fixtures.
 */
import { deflateSync, inflateSync } from "node:zlib";

export type ExtractedPngMetadata = {
  /** Raw key→value text chunks */
  textChunks: Record<string, string>;
  /** Best-effort prompt from common NovelAI / A1111-style keys */
  prompt: string | null;
  negativePrompt: string | null;
  seed: string | null;
  /** JSON-stringified full extraction for storage */
  rawJson: string;
};

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Extract generation-related fields from PNG buffer.
 * Supports tEXt, zTXt, and uncompressed iTXt.
 */
export function extractPngMetadata(png: Buffer): ExtractedPngMetadata {
  const textChunks: Record<string, string> = {};
  if (png.length < 8 || !png.subarray(0, 8).equals(PNG_SIG)) {
    return emptyMeta(textChunks);
  }

  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > png.length) break;
    const data = png.subarray(dataStart, dataEnd);

    if (type === "tEXt") {
      const nul = data.indexOf(0);
      if (nul > 0) {
        const key = data.subarray(0, nul).toString("latin1");
        const value = data.subarray(nul + 1).toString("latin1");
        textChunks[key] = value;
      }
    } else if (type === "zTXt") {
      const nul = data.indexOf(0);
      if (nul > 0 && data.length > nul + 2) {
        const key = data.subarray(0, nul).toString("latin1");
        const compression = data[nul + 1];
        if (compression === 0) {
          try {
            const inflated = inflateSync(data.subarray(nul + 2));
            textChunks[key] = inflated.toString("latin1");
          } catch {
            /* skip corrupt */
          }
        }
      }
    } else if (type === "iTXt") {
      // keyword\0 compressionFlag compressionMethod languageTag\0 translated\0 text
      const nul = data.indexOf(0);
      if (nul > 0 && data.length > nul + 2) {
        const key = data.subarray(0, nul).toString("utf8");
        const compressionFlag = data[nul + 1];
        let p = nul + 3;
        // skip language tag
        const langEnd = data.indexOf(0, p);
        if (langEnd < 0) {
          offset = dataEnd + 4;
          continue;
        }
        p = langEnd + 1;
        const trEnd = data.indexOf(0, p);
        if (trEnd < 0) {
          offset = dataEnd + 4;
          continue;
        }
        p = trEnd + 1;
        try {
          const textBuf = data.subarray(p);
          const value =
            compressionFlag === 1
              ? inflateSync(textBuf).toString("utf8")
              : textBuf.toString("utf8");
          textChunks[key] = value;
        } catch {
          /* skip */
        }
      }
    }

    if (type === "IEND") break;
    offset = dataEnd + 4; // skip CRC
  }

  return finalize(textChunks);
}

function emptyMeta(textChunks: Record<string, string>): ExtractedPngMetadata {
  return {
    textChunks,
    prompt: null,
    negativePrompt: null,
    seed: null,
    rawJson: JSON.stringify({ textChunks }),
  };
}

function finalize(textChunks: Record<string, string>): ExtractedPngMetadata {
  const prompt =
    firstPresent(textChunks, [
      "prompt",
      "Prompt",
      "Description",
      "Comment",
      "parameters",
      "Source",
    ]) ?? parsePromptFromParameters(textChunks.parameters ?? textChunks.Comment);

  const negativePrompt =
    firstPresent(textChunks, [
      "uc",
      "negative_prompt",
      "Negative prompt",
      "Negative Prompt",
    ]) ?? parseNegativeFromParameters(textChunks.parameters ?? textChunks.Comment);

  const seed =
    firstPresent(textChunks, ["seed", "Seed"]) ??
    parseSeedFromParameters(textChunks.parameters ?? textChunks.Comment);

  return {
    textChunks,
    prompt,
    negativePrompt,
    seed,
    rawJson: JSON.stringify({ textChunks, prompt, negativePrompt, seed }),
  };
}

function firstPresent(
  map: Record<string, string>,
  keys: string[],
): string | null {
  for (const k of keys) {
    const v = map[k]?.trim();
    if (v) return v;
  }
  return null;
}

/** A1111-style parameters blob: "prompt\nNegative prompt: ...\nSteps: ... Seed: 123" */
function parsePromptFromParameters(blob: string | undefined): string | null {
  if (!blob?.trim()) return null;
  const negIdx = blob.search(/\nNegative prompt:/i);
  if (negIdx >= 0) return blob.slice(0, negIdx).trim() || null;
  const stepsIdx = blob.search(/\nSteps:/i);
  if (stepsIdx >= 0) return blob.slice(0, stepsIdx).trim() || null;
  // NovelAI-style JSON in Comment
  try {
    const j = JSON.parse(blob) as { prompt?: string; input?: string };
    if (typeof j.prompt === "string") return j.prompt;
    if (typeof j.input === "string") return j.input;
  } catch {
    /* not json */
  }
  return blob.trim() || null;
}

function parseNegativeFromParameters(blob: string | undefined): string | null {
  if (!blob) return null;
  const m = blob.match(/\nNegative prompt:\s*([^\n]*)/i);
  return m?.[1]?.trim() || null;
}

function parseSeedFromParameters(blob: string | undefined): string | null {
  if (!blob) return null;
  const m = blob.match(/\bSeed:\s*(-?\d+)/i);
  return m?.[1] ?? null;
}

/** Build a minimal valid PNG with tEXt chunks — used by tests as a real fixture. */
export function buildPngWithTextChunks(
  chunks: Record<string, string>,
): Buffer {
  const parts: Buffer[] = [PNG_SIG];
  // IHDR: 1x1 RGB
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  parts.push(chunk("IHDR", ihdr));

  for (const [key, value] of Object.entries(chunks)) {
    const keyB = Buffer.from(key, "latin1");
    const valB = Buffer.from(value, "latin1");
    parts.push(chunk("tEXt", Buffer.concat([keyB, Buffer.from([0]), valB])));
  }

  // Minimal IDAT: filter none + RGB black pixel
  const raw = Buffer.from([0, 0, 0, 0]);
  parts.push(chunk("IDAT", deflateSync(raw)));
  parts.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}

function chunk(type: string, data: Buffer): Buffer {
  const typeB = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
  return Buffer.concat([len, typeB, data, crc]);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}
