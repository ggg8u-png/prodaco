// =============================================================================
// 색인 판정 단일 출처 — 페이지 robots/canonical, 사이트맵 포함 여부, 감사 리포트가
// 전부 이 파일의 indexabilityFor() 하나를 기준으로 움직인다.
//
// Tier 정의:
//   A: 색인 대상(index,follow + self-canonical + 사이트맵 포함)
//      — 큐레이션 라이브 핵심 페이지, 검증된 실제 시공사례 보유 페이지, 수동 승인 슬러그.
//   B: 유지하되 색인 경쟁 제외
//      — noindex,follow(약한 롱테일 유형·staging 미검증) 또는 canonical 이 다른 대표
//        URL 로 통합된 중복 변형(동의어 꼬리말·지역 허브 통합). 사이트맵 제외.
//   C: 무효 — 존재하지 않는 슬러그(=404). 사이트맵 제외.
//
// 정책 레버(운영자가 코드 수정 없이 조정):
//   · content/seo.json — noindexTypes / extraIndexSlugs / autoIndexByGalleryCase / generateCount
//   · 어드민 ⑩ 시공사례 — 지역+품목 정확 태그 사례 추가 → 해당 페이지 자동 A 승급
// =============================================================================
import type { KeywordEntry } from "@/data/taxonomy";
import {
  getKeywordBySlug,
  indexDecisionFor,
  hubCanonicalRegionFor,
} from "@/data/keywords";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

export type IndexTier = "A" | "B" | "C";

export interface Indexability {
  /** robots 를 index,follow 로 낼지 여부 */
  indexable: boolean;
  tier: IndexTier;
  /** 판정 사유(감사 리포트용, 한국어) */
  reasons: string[];
  /** canonical 슬러그(디코딩 형태). C 티어는 빈 문자열 */
  canonicalSlug: string;
  /** 절대 canonical URL(퍼센트 인코딩 — 사이트맵 loc 과 완전 일치) */
  canonicalUrl: string;
  /** 사이트맵 포함 자격(200 · index · self-canonical 만 true) */
  inSitemap: boolean;
}

/** 키워드 슬러그의 절대 URL(퍼센트 인코딩) — canonical/사이트맵 공용 규칙. */
export function keywordUrl(slug: string): string {
  return `${siteUrl}/${encodeURIComponent(slug)}`;
}

/** 지역 허브의 절대 URL(퍼센트 인코딩). */
export function regionHubUrl(region: string): string {
  return `${siteUrl}/services/${encodeURIComponent(region)}`;
}

export function indexabilityFor(k: KeywordEntry | string): Indexability {
  const entry = typeof k === "string" ? getKeywordBySlug(k) : k;
  if (!entry) {
    return {
      indexable: false,
      tier: "C",
      reasons: ["존재하지 않는 지역×품목 조합 — 404(soft 404 아님)"],
      canonicalSlug: "",
      canonicalUrl: "",
      inSitemap: false,
    };
  }

  const decision = indexDecisionFor(entry);
  const hubRegion = hubCanonicalRegionFor(entry);
  const canonicalSlug = decision.canonicalSlug;
  const canonicalUrl = hubRegion ? regionHubUrl(hubRegion) : keywordUrl(canonicalSlug);
  const selfCanonical = !hubRegion && canonicalSlug === entry.slug;

  if (decision.index && selfCanonical) {
    return {
      indexable: true,
      tier: "A",
      reasons: ["큐레이션 라이브 또는 검증 사례 보유 — index,follow + self-canonical"],
      canonicalSlug,
      canonicalUrl,
      inSitemap: true,
    };
  }

  if (decision.index && !selfCanonical) {
    // 페이지는 살아 있고 robots 도 index 지만, canonical 이 대표 URL(동의어 대표 변형
    // 또는 지역 허브)로 통합된 중복 변형 — 색인 경쟁·사이트맵에서는 제외한다.
    return {
      indexable: true,
      tier: "B",
      reasons: [
        hubRegion
          ? `지역 허브(/services/${hubRegion})와 검색 의도 중복 — canonical 을 허브로 통합`
          : `동의어 꼬리말 중복 — canonical 을 대표 변형(${canonicalSlug})으로 통합`,
      ],
      canonicalSlug,
      canonicalUrl,
      inSitemap: false,
    };
  }

  // noindex,follow — 약한 롱테일 유형(content/seo.json noindexTypes) 또는 staging 미검증.
  return {
    indexable: false,
    tier: "B",
    reasons: [
      `색인 제외 유형(${entry.type}) 또는 미검증 자동 생성 — noindex,follow (검증 사례·수동 승인 시 A 승급)`,
    ],
    canonicalSlug,
    canonicalUrl,
    inSitemap: false,
  };
}
