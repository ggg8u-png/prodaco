// 전역 문구 치환/삭제 레이어.
// -----------------------------------------------------------------------------
// 어드민(/admin → "⑫ 전역 문구 치환·삭제", content/replacements.json)에서 규칙을
// 추가하면, 자동 생성되는 키워드 페이지를 포함한 사이트 전체 텍스트에 적용된다.
//   · from(찾을 문구) → to(바꿀 문구).  to 를 비우면 해당 문구를 "삭제".
//   · 정규식이 아니라 "있는 그대로" 문자열 치환(단순/안전). 위에서부터 순서대로 적용.
// 빌드 시 적용되므로, 규칙을 저장(게시)하면 재빌드 후 전 페이지에 반영된다.
import data from "../../content/replacements.json";

interface Rule {
  from: string;
  to?: string;
}

const rules: Rule[] = ((data as { rules?: Rule[] }).rules || []).filter(
  (r) => r && typeof r.from === "string" && r.from.length > 0
);

/** 등록된 모든 치환 규칙을 문자열에 순서대로 적용한다. (없으면 원문 그대로) */
export function applyReplacements(text: string): string {
  if (!text || rules.length === 0) return text;
  let out = text;
  for (const r of rules) {
    // split/join = 정규식 이스케이프 없이 전역 리터럴 치환.
    out = out.split(r.from).join(r.to ?? "");
  }
  return out;
}

/** 치환 규칙이 하나라도 있는지(렌더 최적화용). */
export const hasReplacements: boolean = rules.length > 0;
