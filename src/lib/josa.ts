// 한국어 조사 자동 선택 — "수원을(를)" 같은 병기 표기와 "경기은" 같은 오류를 없앤다.
// 마지막 글자의 받침 유무로 은/는·이/가·을/를·과/와·으로/로 를 고른다.
// (한글이 아닌 마지막 글자(영문·숫자 등)는 받침 있는 쪽을 기본값으로 쓴다.)

type JosaPair = "은는" | "이가" | "을를" | "과와" | "으로로";

function hasBatchim(word: string): boolean {
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return true; // 비한글은 보수적으로 받침 취급
  return (ch - 0xac00) % 28 !== 0;
}

// 조사만 돌려준다. 예: josaEnd("수원", "을를") === "을", josaEnd("경기", "은는") === "는"
export function josaEnd(word: string, pair: JosaPair): string {
  const b = hasBatchim(word);
  switch (pair) {
    case "은는": return b ? "은" : "는";
    case "이가": return b ? "이" : "가";
    case "을를": return b ? "을" : "를";
    case "과와": return b ? "과" : "와";
    case "으로로": {
      // 받침 ㄹ(종성 8)은 '로' — 예: 서울로
      const ch = word.charCodeAt(word.length - 1);
      const jong = ch >= 0xac00 && ch <= 0xd7a3 ? (ch - 0xac00) % 28 : 1;
      return jong === 0 || jong === 8 ? "로" : "으로";
    }
  }
}

// 단어+조사. 예: josa("수원", "을를") === "수원을", josa("경기", "은는") === "경기는"
export function josa(word: string, pair: JosaPair): string {
  return word + josaEnd(word, pair);
}
