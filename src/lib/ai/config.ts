import type { AiProviderName } from "./types";

const PROVIDERS: readonly AiProviderName[] = ["none", "openai", "anthropic", "gemini"];

export interface AiConfiguration {
  provider: AiProviderName;
  model: string | null;
  // 이 프로젝트의 AI 기능은 검수 전 발행을 허용하지 않는다.
  autoPublish: false;
}

export function aiConfiguration(env: Record<string, string | undefined> = process.env): AiConfiguration {
  const requested = (env.AI_PROVIDER || "none").trim().toLowerCase();
  const provider = (PROVIDERS as readonly string[]).includes(requested)
    ? (requested as AiProviderName)
    : "none";
  const model = (env.AI_MODEL || "").trim() || null;
  return { provider, model, autoPublish: false };
}
