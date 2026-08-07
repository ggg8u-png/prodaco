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

// 품목 → 문맥상 이어지는 수요형·협력 페이지(명시 매핑).
//
// 이 페이지들은 keywords.json 에 item 필드가 없어(type 만 consumer/target/b2b) 자동
// 연결이 불가능하다. 1차 감사에서 Tier A 인데 /services 한 곳에서만 링크를 받던
// 페이지들이 여기 해당한다. 새 SEO 페이지를 만들지 않고, 실제로 의미가 이어지는
// 기존 페이지만 손으로 연결한다. 대상이 Tier A 가 아니면 아래에서 자동으로 걸러진다.
const RELATED_DEMAND_PAGES: Record<string, string[]> = {
  마루철거: ["마루-꺼짐-보수", "마루-변색-교체"],
  강마루철거: ["마루-꺼짐-보수", "마루-변색-교체"],
  강화마루철거: ["마루-꺼짐-보수", "마루-변색-교체"],
  온돌마루철거: ["마루-꺼짐-보수", "마루-변색-교체"],
  장판철거: ["곰팡이-장판-교체"],
  륨장판철거: ["곰팡이-장판-교체"],
  바닥철거: ["인테리어-바닥철거-외주", "철거-단가표"],
  바닥재철거: ["인테리어-바닥철거-외주", "철거-단가표"],
};

/**
 * 같은 품목에서 이어지는 색인 대상(Tier A) 안내 페이지 — 자기 자신 제외.
 * ① 같은 품목의 정보형 페이지(비용·평당비용·방법…)
 * ② 문맥상 이어지는 수요형·협력 페이지(위 명시 매핑)
 */
export function itemGuidesFor(item: string | undefined, selfSlug: string): KeywordEntry[] {
  if (!item) return [];
  const all = getKeywords();
  const tails = all.filter(
    (k) => k.type === "item-tail" && k.item === item && k.slug !== selfSlug && indexabilityFor(k).inSitemap
  );
  const bySlug = new Map(all.map((k) => [k.slug, k]));
  const related = (RELATED_DEMAND_PAGES[item] || [])
    .map((s) => bySlug.get(s))
    .filter((k): k is KeywordEntry => !!k && k.slug !== selfSlug && indexabilityFor(k).inSitemap);
  const seen = new Set<string>();
  return [...tails, ...related].filter((k) => (seen.has(k.slug) ? false : seen.add(k.slug)));
}
