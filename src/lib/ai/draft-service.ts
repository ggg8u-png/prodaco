import { aiConfiguration } from "./config";
import { contentGenerationProvider } from "./provider";
import { assertSafeGenerationInput } from "./safety";
import type { AiDraftArtifact, ContentGenerationInput, ContentGenerationProvider } from "./types";

/**
 * 향후 CMS의 "AI로 초안 만들기" 버튼이 호출할 서비스 계층.
 * 흐름은 입력 → 개요 → 초안 → 품질 게이트 → draft 반환이며, 저장·검토·발행은 운영자 흐름이다.
 */
export class AiDraftService {
  constructor(private readonly provider: ContentGenerationProvider = contentGenerationProvider()) {}

  async createDraft(input: ContentGenerationInput): Promise<AiDraftArtifact> {
    assertSafeGenerationInput(input);
    const outline = await this.provider.generateOutline(input);
    const content = await this.provider.generateDraft(input, outline);
    const [summary, meta, suggestedInternalLinks, suggestedFaq] = await Promise.all([
      this.provider.generateSummary(input, content),
      this.provider.generateMeta(input, content),
      this.provider.suggestInternalLinks(input, content),
      this.provider.suggestFaq(input, content),
    ]);
    return {
      status: "draft",
      autoPublish: false,
      indexStatus: "unknown",
      requiresOperatorReview: true,
      provider: this.provider.name,
      model: this.provider.model,
      input,
      outline,
      content,
      summary,
      meta,
      suggestedInternalLinks,
      suggestedFaq,
    };
  }
}

export function aiDraftService(): AiDraftService {
  // 설정의 autoPublish 값은 항상 false이며, 이 서비스는 published 콘텐츠를 쓰지 않는다.
  void aiConfiguration();
  return new AiDraftService();
}
