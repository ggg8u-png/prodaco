// CMS(content/ui.json) 템플릿 치환 — 조사 병기 표기까지 자동 교정한다.
//
// 문제: "{region}을(를) 포함한 …" 템플릿을 단순 replace 하면 "판교을(를)"처럼
// 병기 표기가 그대로 노출된다(실사이트에서 발견된 오류). 이 함수는 변수 치환 시
// 바로 뒤에 붙은 조사 병기("을(를)"·"이(가)"·"은(는)"·"과(와)"·"으로(로)"·"(으)로")를
// 치환된 단어의 받침에 맞는 올바른 조사 하나로 바꿔 준다.
//
// CMS 편집자는 자연스러운 병기 표기("{region}을(를)")를 그대로 써도 되고,
// 병기 없이 "{region}" 만 써도 된다 — 둘 다 안전하게 렌더링된다.
import { josaEnd } from "@/lib/josa";

type JosaPair = Parameters<typeof josaEnd>[1];

// 병기 표기 → josa 페어 매핑(양쪽 순서 모두 허용: "을(를)"·"를(을)").
const PAIR_OF: Record<string, JosaPair> = {
  "을(를)": "을를", "를(을)": "을를",
  "이(가)": "이가", "가(이)": "이가",
  "은(는)": "은는", "는(은)": "은는",
  "과(와)": "과와", "와(과)": "과와",
  "으로(로)": "으로로", "로(으로)": "으로로", "(으)로": "으로로",
};

// 병기 패턴(긴 것 먼저 — "으로(로)"가 "로(으로)"보다 앞서 매칭되도록 정렬됨).
const PAIR_PATTERN = "으로\\(로\\)|로\\(으로\\)|\\(으\\)로|을\\(를\\)|를\\(을\\)|이\\(가\\)|가\\(이\\)|은\\(는\\)|는\\(은\\)|과\\(와\\)|와\\(과\\)";

/**
 * 템플릿의 {변수} 를 값으로 치환한다. 변수 바로 뒤에 조사 병기 표기가 있으면
 * 치환 값의 받침에 맞는 조사로 교정한다.
 *
 *   fillTemplate("{region}을(를) 포함한 {cluster} 전역", { region: "판교", cluster: "성남권" })
 *     → "판교를 포함한 성남권 전역"
 *   fillTemplate("{region}을(를) 포함", { region: "성남" }) → "성남을 포함"
 */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  const re = new RegExp(`\\{(\\w+)\\}(${PAIR_PATTERN})?`, "g");
  return template.replace(re, (whole, name: string, pairMark?: string) => {
    const value = vars[name];
    if (value === undefined) return whole; // 모르는 변수는 그대로 둔다(파괴 방지)
    if (!pairMark) return value;
    return value + josaEnd(value, PAIR_OF[pairMark]);
  });
}
