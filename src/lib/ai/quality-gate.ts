import { AI_FORBIDDEN_FACTS } from "./safety";

export type QualityIssueCode =
  | "duplicate_title" | "semantic_duplicate" | "duplicate_intent" | "keyword_stuffing"
  | "too_short" | "repeated_sentence" | "unverified_claim" | "duplicate_images";

export interface QualityCandidate {
  keyword: string;
  intent?: string;
  title: string;
  body: string;
  imageUrls?: string[];
}

export interface ExistingContentFingerprint {
  title: string;
  intent?: string;
  body: string;
  imageUrls?: string[];
}

export interface QualityIssue { code: QualityIssueCode; message: string; }
export interface QualityGateResult {
  passed: boolean;
  // 실패 여부와 상관없이 AI 결과는 운영자 검토 전 발행할 수 없다.
  publishAllowed: false;
  nextStatus: "draft" | "review";
  issues: QualityIssue[];
}

const tokenize = (text: string) => text.toLowerCase().replace(/[^0-9a-z가-힣\s]/g, " ").split(/\s+/).filter((x) => x.length >= 2);
const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").replace(/[^0-9a-z가-힣 ]/g, "").trim();

function similarity(a: string, b: string): number {
  const aa = new Set(tokenize(a));
  const bb = new Set(tokenize(b));
  const union = new Set([...aa, ...bb]);
  if (!union.size) return 0;
  let common = 0;
  for (const token of aa) if (bb.has(token)) common++;
  return common / union.size;
}

function hasUnverifiedClaim(body: string): boolean {
  // 사실처럼 보이는 현장 주장·가격·후기·전후 관계는 CMS 근거 없이 AI가 쓰면 검토로 보낸다.
  return /(실제\s*(시공|현장|후기|고객)|저희가\s*.*(작업|시공)|\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d[\d,]*(?:만|천)?\s*원|작업\s*시간|전\s*후\s*(사진|관계))/i.test(body);
}

export function qualityGate(candidate: QualityCandidate, existing: ExistingContentFingerprint[] = []): QualityGateResult {
  const issues: QualityIssue[] = [];
  const title = normalize(candidate.title);
  const body = normalize(candidate.body);
  const keyword = normalize(candidate.keyword);
  if (existing.some((item) => normalize(item.title) === title)) issues.push({ code: "duplicate_title", message: "기존 제목과 동일합니다." });
  const intent = candidate.intent;
  if (intent && existing.some((item) => normalize(item.intent || "") === normalize(intent))) {
    issues.push({ code: "duplicate_intent", message: "기존 콘텐츠와 검색의도가 동일합니다." });
  }
  if (existing.some((item) => similarity(body, normalize(item.body)) >= 0.82)) {
    issues.push({ code: "semantic_duplicate", message: "기존 본문과 의미상 지나치게 유사합니다." });
  }
  const occurrences = keyword ? body.split(keyword).length - 1 : 0;
  if (occurrences > 12 || (body.length > 0 && occurrences * keyword.length / body.length > 0.07)) {
    issues.push({ code: "keyword_stuffing", message: "키워드 반복 비율이 과도합니다." });
  }
  if (body.length < 800) issues.push({ code: "too_short", message: "본문이 800자보다 짧습니다." });
  const sentences = candidate.body.split(/[.!?。]\s*/).map(normalize).filter((s) => s.length >= 12);
  if (new Set(sentences).size !== sentences.length) issues.push({ code: "repeated_sentence", message: "동일 문장이 반복됩니다." });
  if (hasUnverifiedClaim(candidate.body)) {
    issues.push({ code: "unverified_claim", message: `CMS 근거 없는 현장·가격·후기·전후 주장 가능성 (${AI_FORBIDDEN_FACTS.join(", ")})` });
  }
  const candidateImages = new Set(candidate.imageUrls || []);
  const existingImages = new Set(existing.flatMap((item) => item.imageUrls || []));
  if ([...candidateImages].filter((url) => existingImages.has(url)).length >= 2) {
    issues.push({ code: "duplicate_images", message: "기존 콘텐츠와 대표·본문 이미지가 과도하게 중복됩니다." });
  }
  return { passed: issues.length === 0, publishAllowed: false, nextStatus: issues.length ? "review" : "draft", issues };
}
