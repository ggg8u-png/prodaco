import { aiConfiguration, type AiConfiguration } from "./config";
import type {
  AiProviderName,
  ContentGenerationInput,
  ContentGenerationProvider,
  FaqSuggestion,
  GeneratedMeta,
  GeneratedOutline,
  InternalLinkSuggestion,
} from "./types";

type ProviderFactory = (config: AiConfiguration) => ContentGenerationProvider;
const factories = new Map<AiProviderName, ProviderFactory>();

/** 향후 Netlify Function의 서버 전용 adapter를 이 registry에 등록한다. */
export function registerContentGenerationProvider(provider: Exclude<AiProviderName, "none">, factory: ProviderFactory): void {
  factories.set(provider, factory);
}

class UnavailableProvider implements ContentGenerationProvider {
  readonly name: AiProviderName;
  readonly model: string | null;
  private readonly message: string;

  constructor(config: AiConfiguration) {
    this.name = config.provider;
    this.model = config.model;
    this.message = config.provider === "none"
      ? "AI_PROVIDER가 설정되지 않았습니다. AI 초안 생성은 호출되지 않았습니다."
      : `${config.provider} adapter가 아직 등록되지 않았습니다. API 호출은 수행하지 않았습니다.`;
  }

  private unavailable<T>(): Promise<T> { return Promise.reject(new Error(this.message)); }
  generateTitle(_input: ContentGenerationInput): Promise<string[]> { return this.unavailable(); }
  generateOutline(_input: ContentGenerationInput): Promise<GeneratedOutline> { return this.unavailable(); }
  generateDraft(_input: ContentGenerationInput, _outline: GeneratedOutline): Promise<string> { return this.unavailable(); }
  generateSummary(_input: ContentGenerationInput, _draft: string): Promise<string> { return this.unavailable(); }
  generateMeta(_input: ContentGenerationInput, _draft: string): Promise<GeneratedMeta> { return this.unavailable(); }
  suggestInternalLinks(_input: ContentGenerationInput, _draft: string): Promise<InternalLinkSuggestion[]> { return this.unavailable(); }
  suggestFaq(_input: ContentGenerationInput, _draft: string): Promise<FaqSuggestion[]> { return this.unavailable(); }
}

/**
 * 키·SDK·네트워크가 없는 기본 상태에서는 항상 명시적으로 실패한다.
 * 성공한 척한 텍스트나 가짜 초안을 반환하지 않는다.
 */
export function contentGenerationProvider(config = aiConfiguration()): ContentGenerationProvider {
  const factory = config.provider === "none" ? undefined : factories.get(config.provider);
  return factory ? factory(config) : new UnavailableProvider(config);
}
