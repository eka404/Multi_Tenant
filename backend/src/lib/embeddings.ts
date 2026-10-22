import { env } from "../config/env.js";

const DIMENSIONS = 256;

export interface EmbeddingProvider {
  readonly model: string;
  embed(texts: string[], kind: "document" | "query"): Promise<number[][]>;
}

class VoyageProvider implements EmbeddingProvider {
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async embed(texts: string[], kind: "document" | "query"): Promise<number[][]> {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        input_type: kind,
        output_dimension: DIMENSIONS,
        truncation: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      throw Object.assign(new Error(`Voyage API ${res.status}: ${detail}`), { status: res.status });
    }

    const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

let override: EmbeddingProvider | null | undefined;
let configured: EmbeddingProvider | null | undefined;

export function getEmbeddingProvider(): EmbeddingProvider | null {
  if (override !== undefined) return override;
  if (configured === undefined) {
    configured = env.voyageApiKey ? new VoyageProvider(env.voyageApiKey, env.embeddingModel) : null;
  }
  return configured;
}

export function setEmbeddingProvider(provider: EmbeddingProvider | null | undefined) {
  override = provider;
}