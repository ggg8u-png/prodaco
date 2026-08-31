import type { ContentGenerationInput } from "./types";

// AI가 추정하거나 만들어서는 안 되는 사실. 실제 CMS 구조화 데이터가 별도로 있는 경우에만
// 운영자 검토 하에 페이지에 사용할 수 있으며, 이 초안 입력 계약에는 넣지 않는다.
export const AI_FORBIDDEN_FACTS = [
  "actual customer name",
  "actual address",
  "actual work date",
  "actual cost",
  "actual work duration",
  "actual review",
  "before/after relationship",
] as const;

const FORBIDDEN_KEYS = new Set([
  "customername", "clientname", "customer", "address", "actualaddress",
  "workdate", "actualworkdate", "cost", "actualcost", "worktime", "duration",
  "review", "testimonial", "beforeafter", "beforeafterrelationship",
]);

/** Provider adapter가 프롬프트에 반드시 포함해야 하는 안전 지침. */
export const AI_FACT_GUARDRAIL = [
  "Do not invent or claim actual customer names, addresses, work dates, costs, work durations, reviews, or before/after relationships.",
  "Use only the explicitly supplied verified CMS facts. If a fact is unavailable, write generally or request operator input.",
].join(" ");

/** 런타임에서도 금지 사실 필드를 막아, 타입을 우회한 호출이 그대로 provider로 가지 않게 한다. */
export function assertSafeGenerationInput(input: ContentGenerationInput): void {
  const walk = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key.replace(/[_\-\s]/g, "").toLowerCase())) {
        throw new Error(`AI 입력 금지 사실 필드: ${key}`);
      }
      walk(child);
    }
  };
  walk(input);
}
