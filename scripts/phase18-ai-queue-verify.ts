import { canAutoPublish, queueStatusOf } from "@/lib/ai/queue";
import { qualityGate } from "@/lib/ai/quality-gate";

const body = Array.from({ length: 40 }, (_, i) => `바닥 철거를 준비할 때 점검할 안내 항목 ${i + 1}은 현장 조건과 바닥재 종류를 확인하는 것입니다`).join(". ");
const clean = qualityGate({ keyword: "마루 철거", intent: "준비 방법", title: "마루 철거 준비 안내", body });
if (!clean.passed || clean.publishAllowed || clean.nextStatus !== "draft") throw new Error("정상 초안 품질 판정 실패");

const blocked = qualityGate(
  { keyword: "마루 철거", intent: "준비 방법", title: "마루 철거 준비 안내", body: "실제 비용은 100만원입니다." },
  [{ title: "마루 철거 준비 안내", intent: "준비 방법", body, imageUrls: ["/a.webp", "/b.webp"] }],
);
const codes = new Set(blocked.issues.map((issue) => issue.code));
if (!codes.has("duplicate_title") || !codes.has("duplicate_intent") || !codes.has("unverified_claim") || blocked.publishAllowed || blocked.nextStatus !== "review") {
  throw new Error("차단 초안 품질 판정 실패");
}
if (canAutoPublish() || queueStatusOf("scheduled") !== "scheduled" || queueStatusOf("bad") !== "queued") throw new Error("큐 상태/자동발행 안전값 실패");
console.log("[phase18-ai-queue-verify] 큐 상태·품질 게이트·자동발행 금지 통과");
