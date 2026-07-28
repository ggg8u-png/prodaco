// 권역 그룹 시공사례 — 특정 구(區)를 단정할 수 없지만 권역(그룹)은 운영자 확인으로
// 사실인 사례의 표기 규칙. (region-attestation 과 같은 근거: 2026-07-28 운영자 확인)
//
// 표기 원칙:
//   · 그룹 지역 페이지(강남/서초/송파)에서는 "강남·서초·송파 시공사례"로 표기 — 사실 그대로.
//   · "실제"라는 수식어와 특정 구 단정은 쓰지 않는다(구 단위 확인 시 개별 region 으로 승급).
//   · 그 밖의 지역 페이지에서는 기존 "수도권 유사" 폴백 규칙을 그대로 따른다.

/** 권역 그룹 사례의 region 필드 값(카드 표기와 동일). */
export const CASE_REGION_GROUPS: string[][] = [["강남", "서초", "송파"]];

/** 페이지 지역이 속한 권역 그룹의 사례 region 문자열("강남·서초·송파") — 없으면 null. */
export function caseGroupLabelFor(region?: string | null): string | null {
  if (!region) return null;
  for (const g of CASE_REGION_GROUPS) {
    if (g.includes(region)) return g.join("·");
  }
  return null;
}
