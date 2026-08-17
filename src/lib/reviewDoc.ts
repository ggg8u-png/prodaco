// 고객후기를 독립 URL(/reviews/<id>)로 다루기 위한 단일 출처.
//
// 이 모듈은 클라이언트 컴포넌트(ReviewsClient)에서도 import 되므로 node:fs 를 쓰지 않는다
// (@/data/reviews 는 JSON import 뿐이라 클라이언트 안전).
//
// ── 왜 기본값이 '색인 안 함' 인가 ─────────────────────────────────────────────
// 현재 후기 14건 중 10건은 실제 후기가 아니라 '상황 예시(상담 사례)' 로 표시된 콘텐츠다.
// 예시 후기에는 애초에 상세 URL 을 만들지 않는다 — 지어낸 후기를 독립 문서로 발행하는
// 셈이 되기 때문이다. 남는 실제 후기도 본문이 88~217자로 짧아서, 그대로 색인시키면
// 지금까지 지켜 온 "얇은 페이지 대량 색인 금지" 를 스스로 깨게 된다.
// 그래서 색인은 운영자가 CMS 에서 '검색 노출 허용' 을 켠 후기 중, 본문이 충분히 긴
// 것만 대상으로 한다. 구조는 지금 다 갖춰 두고, 켤지 말지는 운영자가 판단한다.
import type { Review } from "@/types";
import { reviews as actualReviews, isExampleReview } from "@/data/reviews";

/** 사이트 내부 경로 — <Link href> 용. */
export function reviewPath(id: string): string {
  return `/reviews/${encodeURIComponent(id)}`;
}

/** 절대 URL — canonical·사이트맵·구조화데이터용. */
export function reviewUrl(siteUrl: string, id: string): string {
  return `${siteUrl}${reviewPath(id)}`;
}

/** 라우트 params 의 [id] → 실제 후기 id. */
export function decodeReviewId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// 색인 최소 본문 길이. 이보다 짧으면 검색결과에 띄울 만한 정보가 없는 페이지다.
export const REVIEW_MIN_LENGTH = 150;

/**
 * 상세 페이지를 만들 후기 — 예시(상담 사례)가 아닌 실제 후기만.
 * 예시 콘텐츠는 목록에서 '상황 예시' 라벨과 함께만 보이고 독립 URL 을 갖지 않는다.
 */
export function reviewPageItems(): Review[] {
  const seen = new Set<string>();
  return actualReviews.filter((r) => {
    if (!r.id || seen.has(r.id) || isExampleReview(r)) return false;
    seen.add(r.id);
    return true;
  });
}

/**
 * 검색 색인 대상인가 — 세 조건을 모두 만족해야 한다.
 *   ① 실제 후기(예시 아님) · verified 가 명시적 false 가 아님
 *   ② 운영자가 CMS 에서 '검색 노출 허용' 을 켬(searchIndexable === true)
 *   ③ 본문이 REVIEW_MIN_LENGTH 이상
 * ②를 뺀 자동 승격은 만들지 않는다 — 후기는 사람이 보고 판단할 콘텐츠다.
 */
export function isReviewIndexable(r: Review): boolean {
  if (isExampleReview(r)) return false;
  if (r.verified === false) return false;
  if (r.searchIndexable !== true) return false;
  return (r.content || "").trim().length >= REVIEW_MIN_LENGTH;
}

/** 사이트맵에 실을 후기 — 색인 대상만. */
export function indexableReviews(): Review[] {
  return reviewPageItems().filter(isReviewIndexable);
}

export function reviewById(id: string): Review | undefined {
  return reviewPageItems().find((r) => r.id === id);
}

/**
 * 후기 상세페이지의 meta description — 본문을 무작정 자르지 않고
 * 문장 경계에서 끊어 검색결과에서 말이 되게 만든다(요구사항 5).
 */
export function reviewDescription(r: Review): string {
  const head = `${r.region} ${r.item} 작업 후기.`;
  const body = (r.content || "").trim().replace(/\s+/g, " ");
  const room = 155 - head.length - 1;
  if (body.length <= room) return `${head} ${body}`;
  // 자를 지점 앞쪽에서 마지막 문장 끝을 찾는다. 없으면 어절 경계로 끊는다.
  const slice = body.slice(0, room);
  const sentence = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("다 "), slice.lastIndexOf("요 "));
  const cut = sentence > room * 0.5 ? slice.slice(0, sentence + 1) : slice.slice(0, slice.lastIndexOf(" "));
  return `${head} ${cut.trim()}…`;
}
