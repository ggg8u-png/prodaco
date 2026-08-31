import { aiConfiguration } from "@/lib/ai/config";
import { contentGenerationProvider } from "@/lib/ai/provider";
import { AiDraftService } from "@/lib/ai/draft-service";
import { assertSafeGenerationInput } from "@/lib/ai/safety";

async function main() {
  const config = aiConfiguration({ AI_PROVIDER: "anthropic", AI_MODEL: "future-model", AI_AUTO_PUBLISH: "true" });
  if (config.provider !== "anthropic" || config.model !== "future-model" || config.autoPublish !== false) throw new Error("AI config 안전 기본값 실패");

  const provider = contentGenerationProvider(config);
  if (provider.name !== "anthropic" || provider.model !== "future-model") throw new Error("provider 선택 정보 실패");

  await provider.generateTitle({ keyword: "마루 철거" }).then(
    () => { throw new Error("adapter 없는 호출이 성공하면 안 됩니다"); },
    (error) => { if (!/API 호출은 수행하지 않았습니다/.test(String(error.message))) throw error; },
  );

  const service = new AiDraftService(provider);
  await service.createDraft({ keyword: "마루 철거" }).then(
    () => { throw new Error("AI 초안이 가짜 성공하면 안 됩니다"); },
    () => undefined,
  );

  try {
    assertSafeGenerationInput({ keyword: "마루 철거", actualCost: "100만원" } as never);
    throw new Error("금지 사실 입력이 차단되지 않았습니다");
  } catch (error) {
    if (!/AI 입력 금지 사실 필드/.test(String((error as Error).message))) throw error;
  }

  console.log("[phase17-ai-verify] provider 계약·무호출 실패·금지 사실 차단·autoPublish=false 통과");
}

void main();
