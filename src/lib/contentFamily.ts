// 품목군(family) 분류 — 본문 엔진·품목 지식·감사 스크립트가 공유하는 단일 출처.
//
// content.ts 안에 있던 것을 여기로 뺐다. 품목 지식(itemKnowledge)이 이 분류를 쓰는데,
// content.ts 는 다시 itemKnowledge 를 쓰기 때문에 그대로 두면 순환 참조가 된다.
// 분류 규칙 자체는 바뀌지 않았다(seo-quality-audit 의 품목 분류 일관성 검사가 그대로 통과).
export type Family = "maru" | "vinyl" | "tile" | "coating" | "sanding" | "bond" | "generic";

export function familyOf(item: string): Family {
  const s = item || "";
  if (/(샌딩|면갈이|마루재생|마루코팅)/.test(s)) return "sanding";
  if (/(에폭시|우레탄)/.test(s)) return "coating";
  if (/본드/.test(s)) return "bond";
  if (/(폴리싱|도기|바닥타일)/.test(s)) return "tile";
  if (/타일/.test(s) && !/(데코|디럭스)/.test(s)) return "tile";
  if (/(데코|디럭스|륨|장판)/.test(s)) return "vinyl";
  if (/마루/.test(s)) return "maru";
  return "generic";
}
