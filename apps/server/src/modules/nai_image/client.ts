/**
 * NovelAI image API client boundary — injectable for tests; HTTP impl for live use.
 * HUMAN-ONLY: callers must invoke only from an explicit request handler (no queues).
 */
import { inflateRawSync, inflateSync } from "node:zlib";

export type NovelAIGenerateParams = {
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  width?: number;
  height?: number;
  steps?: number;
  scale?: number;
  model?: string;
  /** Must be 1 — batch rejected at route layer */
  n?: number;
};

export type NovelAIGenerateResult = {
  /** First PNG from the ZIP (or raw PNG if client returns PNG directly) */
  pngBytes: Buffer;
};

export type NovelAIImageClient = {
  generateImage(params: NovelAIGenerateParams): Promise<NovelAIGenerateResult>;
};

const DEFAULT_ENDPOINT = "https://image.novelai.net/ai/generate-image";
const DEFAULT_MODEL = "nai-diffusion-4-5-full";

/**
 * Live HTTP client for NovelAI image generation (unofficial surface; may change).
 */
export function createHttpNovelAIClient(apiKey: string): NovelAIImageClient {
  return {
    async generateImage(params: NovelAIGenerateParams) {
      const model = params.model?.trim() || DEFAULT_MODEL;
      const width = params.width ?? 832;
      const height = params.height ?? 1216;
      const body = {
        input: params.prompt,
        model,
        action: "generate",
        parameters: {
          width,
          height,
          scale: params.scale ?? 5,
          sampler: "k_euler_ancestral",
          steps: params.steps ?? 28,
          seed: params.seed ?? Math.floor(Math.random() * 2 ** 32),
          n_samples: 1,
          uc: params.negativePrompt ?? "",
          negative_prompt: params.negativePrompt ?? "",
        },
      };

      const res = await fetch(DEFAULT_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json, application/zip, image/png, */*",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new NovelAIRequestError(
          `NovelAI generate failed: HTTP ${res.status} ${text.slice(0, 300)}`,
          res.status,
        );
      }

      const contentType = res.headers.get("content-type") ?? "";
      const ab = await res.arrayBuffer();
      const bytes = Buffer.from(ab);

      if (contentType.includes("png") || isPng(bytes)) {
        return { pngBytes: bytes };
      }

      // NovelAI typically returns a ZIP of PNG(s)
      const png = firstPngFromZip(bytes);
      if (!png) {
        throw new NovelAIRequestError(
          "NovelAI response did not contain a PNG image",
          502,
        );
      }
      return { pngBytes: png };
    },
  };
}

export class NovelAIRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "NovelAIRequestError";
  }
}

export function isPng(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

/**
 * Minimal ZIP local-file scanner: find first entry whose name ends with .png
 * or whose payload starts with PNG signature. Does not support ZIP64/encryption.
 */
export function firstPngFromZip(zip: Buffer): Buffer | null {
  let offset = 0;
  while (offset + 30 <= zip.length) {
    const sig = zip.readUInt32LE(offset);
    if (sig !== 0x04034b50) break; // local file header
    const method = zip.readUInt16LE(offset + 8);
    const compSize = zip.readUInt32LE(offset + 18);
    const uncompSize = zip.readUInt32LE(offset + 22);
    const nameLen = zip.readUInt16LE(offset + 26);
    const extraLen = zip.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    const dataStart = nameEnd + extraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > zip.length) break;
    const name = zip.subarray(nameStart, nameEnd).toString("utf8");
    const payload = zip.subarray(dataStart, dataEnd);
    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(payload);
    } else if (method === 8) {
      try {
        data = inflateRawSync(payload);
      } catch {
        try {
          data = inflateSync(payload);
        } catch {
          offset = dataEnd;
          continue;
        }
      }
    } else {
      offset = dataEnd;
      continue;
    }
    if (name.toLowerCase().endsWith(".png") || isPng(data)) {
      if (isPng(data) || uncompSize === 0 || data.length > 0) {
        if (isPng(data)) return data;
      }
    }
    offset = dataEnd;
  }
  // Fallback: scan for PNG signature anywhere in buffer
  for (let i = 0; i < zip.length - 8; i++) {
    if (
      zip[i] === 0x89 &&
      zip[i + 1] === 0x50 &&
      zip[i + 2] === 0x4e &&
      zip[i + 3] === 0x47
    ) {
      return zip.subarray(i);
    }
  }
  return null;
}
