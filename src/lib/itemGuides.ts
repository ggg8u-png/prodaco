// 품목 정보형 페이지(비용·평당비용·방법·기간…) 로의 역방향 내부링크 단일 출처.
//
// 왜 분리했나:
//   내부링크가 "정보형 → 지역" 한 방향만 걸려 있어, 상업 의도가 가장 높은
//   마루철거-비용·바닥철거-비용 류가 /services 한 곳에서만 링크를 받고 있었다
//   (지역 페이지 인바운드 70~90개 vs 비용 페이지 1개). 링크가 안 모이면 색인
//   대상이어도 크롤 우선순위·평가가 밀린다.
//   선택 규칙을 페이지 컴포넌트 안에 두면 회귀 테스트가 불가능해 여기로 뺀다.
import { getKeywords } from "@/data/keywords";
import { indexabilityFor } from "@/lib/seo/indexability";
import type { KeywordEntry } from "@/data/taxonomy";

/** 같은 품목의 색인 대상(Tier A) 정보형 페이지 — 자기 자신 제외. */
export function itemGuidesFor(item: string | undefined, selfSlug: string): KeywordEntry[] {
  if (!item) return [];
  return getKeywords().filter(
    (k) =>
      k.type === "item-tail" &&
      k.item === item &&
      k.slug !== selfSlug &&
      indexabilityFor(k).inSitemap
  );
}
