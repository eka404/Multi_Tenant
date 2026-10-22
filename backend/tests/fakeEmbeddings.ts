import type { EmbeddingProvider } from "../src/lib/embeddings.js";

const CONCEPTS: string[][] = [
  ["login", "logout", "signin", "sign", "password", "token", "auth", "session", "refresh", "jwt"],
  ["navbar", "layout", "button", "css", "mobile", "responsive", "page", "menu"],
  ["copy", "pricing", "text", "blog", "writing", "wording"],
];

export class FakeEmbeddings implements EmbeddingProvider {
  readonly model = "fake-concepts";
  calls: string[][] = [];
  failNext = false;

  async embed(texts: string[]): Promise<number[][]> {
    if (this.failNext) {
      this.failNext = false;
      throw Object.assign(new Error("rate limited"), { status: 429 });
    }
    this.calls.push(texts);
    return texts.map((text) => {
      const words = text.toLowerCase().split(/[^a-z]+/);
      return CONCEPTS.map((group) => words.filter((w) => group.includes(w)).length);
    });
  }
}