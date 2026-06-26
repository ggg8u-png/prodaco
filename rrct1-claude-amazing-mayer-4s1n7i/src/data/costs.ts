// 품목별 비용 참고 데이터.
//
// 아래 평당 단가는 운영자가 블로그(content/blog/maru-cost.json)에 공개한
// "2024년 현장 기준" 일반 시장 평균값을 그대로 옮긴 것입니다. 임의로 만든 숫자가
// 아니며, 보장가가 아니라 '참고가'입니다. 실제 정산은 유선 가견적 후 실측 면적
// 기준으로 이뤄집니다(company.consultSteps 참고).

import costsData from "../../content/costs.json";

export interface CostRow {
  key: string;
  label: string;
  /** 평당 단가(만원). 숫자 범위가 있으면 [min,max], 없으면 null(=현장 별도 산정). */
  perPyeong: [number, number] | null;
  note: string;
}

// 실데이터(블로그 공개가) + 숫자가 없는 품목은 정직하게 '별도 산정'으로 표기.
// CMS(content/costs.json)는 편집 편의를 위해 minPrice/maxPrice(만원) 숫자로 저장하고,
// 여기서 perPyeong 튜플([min,max] | null)로 변환한다. (비워두면 '별도 산정')
interface CostJsonRow {
  key: string;
  label: string;
  minPrice: number | null;
  maxPrice: number | null;
  note: string;
}

export const FLOOR_COSTS: CostRow[] = (costsData.floorCosts as CostJsonRow[]).map((r) => ({
  key: r.key,
  label: r.label,
  note: r.note,
  perPyeong:
    r.minPrice != null && r.maxPrice != null ? [r.minPrice, r.maxPrice] : null,
}));

// 품목명(item)을 비용표의 어느 행에 해당시킬지 결정. 없으면 null.
export function costKeyOf(item: string | undefined): string | null {
  const s = item || "";
  if (/(샌딩|면갈이|마루재생|마루코팅)/.test(s)) return "sanding";
  if (/(에폭시|우레탄)/.test(s)) return "coating";
  if (/(폴리싱|도기|바닥타일)/.test(s)) return "tile";
  if (/타일/.test(s) && !/(데코|디럭스)/.test(s)) return "tile";
  if (/(데코|디럭스)/.test(s)) return "deco";
  if (/(륨|장판)/.test(s)) return "jangpan";
  if (/원목마루/.test(s)) return "wonmok";
  if (/(강화마루|합판마루)/.test(s)) return "ganghwa";
  if (/(강마루|온돌마루|마루)/.test(s)) return "ganmaru";
  return null;
}

// 평당 단가 텍스트. null이면 '현장 별도 산정'.
export function perPyeongText(row: CostRow): string {
  if (!row.perPyeong) return "현장 별도 산정";
  const [min, max] = row.perPyeong;
  return `평당 ${min}만~${max}만원`;
}
