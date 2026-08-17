// 시공사례를 '목록 안의 카드' 가 아니라 '독립 웹문서' 로 다루기 위한 단일 출처.
//
// URL 은 /gallery/<id> 다. 요구사항의 예시는 /cases/<id> 였지만 목록 페이지가 이미
// /gallery 로 색인돼 있어서, 목록만 /gallery 이고 상세만 /cases 로 갈라지면 경로 체계가
// 어긋나고 /cases 를 새로 만들면 목록이 중복된다. 기존 URL 을 바꾸지 않는다는 원칙
// (요구사항 13)에 맞춰 상세를 /gallery 아래에 붙였다 — 301 도 필요 없다.
//
// 색인 판정은 여기 한 곳에서만 한다. 페이지 robots·사이트맵·RSS·내부링크가 전부 이 값을
// 읽으므로 "사이트맵에는 있는데 noindex" 같은 어긋남이 구조적으로 생기지 않는다.
import type { GalleryItem } from "@/types";
import { galleryItems } from "@/data/gallery";
import { getKeywordBySlug, hubDecisionFor } from "@/data/keywords";
import { indexabilityFor } from "@/lib/seo/indexability";
import { caseDates, newestDate } from "@/lib/contentDates";

/** 사이트 내부 경로 — <Link href> 용. */
export function casePath(id: string): string {
  return `/gallery/${encodeURIComponent(id)}`;
}

/** 절대 URL — canonical·사이트맵·구조화데이터용. */
export function caseUrl(siteUrl: string, id: string): string {
  return `${siteUrl}${casePath(id)}`;
}

/** 라우트 params 의 [id] → 실제 사례 id(한글 id 대비 디코딩). */
export function decodeCaseId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// 색인 최소 요건 — 설명이 이 길이 미만이면 사진 두 장 말고는 읽을 게 없는 페이지다.
// 그런 페이지를 색인시키면 지금까지 지켜 온 "얇은 페이지 대량 색인 금지" 를 스스로 깨는 셈이다.
export const CASE_MIN_DESCRIPTION = 40;

/**
 * 검색 색인 대상인가.
 *   · verified === false        → 운영자가 실제 현장이 아니라고 표시한 사례. 제외.
 *   · 전/후 사진이 없음         → 시공사례로서 성립하지 않음. 제외.
 *   · 설명이 너무 짧음          → 얇은 페이지. 제외.
 * (CMS 사례가 하나도 없을 때만 쓰이는 레거시 폴백 사례들은 설명이 짧아 여기서 자동 제외된다.)
 */
export function isCaseIndexable(g: GalleryItem): boolean {
  if (g.verified === false) return false;
  if (!g.beforeImage || !g.afterImage) return false;
  return (g.description || "").trim().length >= CASE_MIN_DESCRIPTION;
}

/** 상세 페이지를 만들 사례 — id 가 있는 모든 사례(색인 여부와 무관하게 URL 은 준다). */
export function casePageItems(): GalleryItem[] {
  const seen = new Set<string>();
  return galleryItems.filter((g) => {
    if (!g.id || seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });
}

/** 사이트맵·RSS 에 실을 사례 — 색인 대상만. */
export function indexableCases(): GalleryItem[] {
  return casePageItems().filter(isCaseIndexable);
}

export function caseById(id: string): GalleryItem | undefined {
  return casePageItems().find((g) => g.id === id);
}

/**
 * 사례의 발행일·수정일.
 *   발행일 = 운영자가 적은 작업일이 있으면 그 날, 없으면 파일이 처음 커밋된 날
 *   수정일 = 파일이 마지막으로 커밋된 날(발행일보다 이르면 발행일로 맞춘다)
 * git 을 못 읽는 환경이면 workDate 만 남고, 그것도 없으면 undefined 다 — 그때는
 * 구조화데이터에서 날짜 필드를 아예 빼서 없는 값을 지어내지 않는다.
 */
export function caseDateInfo(g: GalleryItem): { published?: string; modified?: string } {
  const git = caseDates(g.id);
  const published = g.workDate?.slice(0, 10) || git.created;
  const modified = newestDate(git.modified, published);
  return { published, modified };
}

export interface CaseLink {
  href: string;
  label: string;
}

/**
 * 사례에서 나가는 내부 링크 — 지역 허브와 지역×품목 페이지.
 * 색인 대상인 페이지만 건다(noindex 페이지로 링크 자산을 흘려보내지 않기 위해).
 */
export function caseRelatedLinks(g: GalleryItem): CaseLink[] {
  const out: CaseLink[] = [];
  const comboSlug = `${g.region}-${g.item.replace(/\s+/g, "")}`;
  const combo = getKeywordBySlug(comboSlug);
  if (combo && indexabilityFor(combo).indexable) {
    out.push({ href: `/${encodeURIComponent(comboSlug)}`, label: `${g.region} ${g.item}` });
  }
  if (hubDecisionFor(g.region).index) {
    out.push({ href: `/services/${encodeURIComponent(g.region)}`, label: `${g.region} 전체 서비스` });
  }
  return out;
}

/** 같은 품목의 다른 사례 — 부족하면 같은 지역 사례로 채운다. */
export function siblingCases(g: GalleryItem, limit = 3): GalleryItem[] {
  const rest = casePageItems().filter((x) => x.id !== g.id && isCaseIndexable(x));
  const sameItem = rest.filter((x) => x.item === g.item);
  const sameRegion = rest.filter((x) => x.item !== g.item && x.region === g.region);
  return [...sameItem, ...sameRegion, ...rest.filter((x) => !sameItem.includes(x) && !sameRegion.includes(x))].slice(0, limit);
}
