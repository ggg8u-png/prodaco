// AI 초안 서비스 공통 계약. 특정 모델 SDK·API 키에 의존하지 않는다.
export type AiProviderName = "none" | "openai" | "anthropic" | "gemini";
export type AiDraftStatus = "draft";
export type AiIndexStatus = "unknown" | "confirmed";

export interface VerifiedCmsFacts {
  // CMS 구조화 데이터로 확인된 값만 이 객체에 넣는다.
  // 고객명·주소·작업일·비용·작업시간·후기·전후 관계는 절대 AI 입력으로 만들지 않는다.
  service?: string;
  serviceArea?: string[];
  officialPhone?: string;
}

export interface ContentGenerationInput {
  keyword: string;
  goal?: string;
  audience?: string;
  verifiedCmsFacts?: VerifiedCmsFacts;
}

export interface GeneratedOutline {
  titleSuggestions: string[];
  sections: string[];
}

export interface GeneratedMeta {
  title: string;
  description: string;
}

export interface InternalLinkSuggestion {
  label: string;
  url: string;
  reason: string;
}

export interface FaqSuggestion {
  question: string;
  answer: string;
}

export interface ContentGenerationProvider {
  readonly name: AiProviderName;
  readonly model: string | null;
  generateTitle(input: ContentGenerationInput): Promise<string[]>;
  generateOutline(input: ContentGenerationInput): Promise<GeneratedOutline>;
  generateDraft(input: ContentGenerationInput, outline: GeneratedOutline): Promise<string>;
  generateSummary(input: ContentGenerationInput, draft: string): Promise<string>;
  generateMeta(input: ContentGenerationInput, draft: string): Promise<GeneratedMeta>;
  suggestInternalLinks(input: ContentGenerationInput, draft: string): Promise<InternalLinkSuggestion[]>;
  suggestFaq(input: ContentGenerationInput, draft: string): Promise<FaqSuggestion[]>;
}

export interface AiDraftArtifact {
  status: AiDraftStatus;
  autoPublish: false;
  indexStatus: AiIndexStatus;
  requiresOperatorReview: true;
  provider: AiProviderName;
  model: string | null;
  input: ContentGenerationInput;
  outline: GeneratedOutline;
  content: string;
  summary: string;
  meta: GeneratedMeta;
  suggestedInternalLinks: InternalLinkSuggestion[];
  suggestedFaq: FaqSuggestion[];
}
