// 한국어 조사 자동 선택 — "수원을(를)" 같은 병기 표기와 "경기은"·"철거을" 같은 오류를 없앤다.
// 마지막 한글 글자의 받침 유무로 은/는·이/가·을/를·과/와·으로/로·이라/라·이에요/예요 를 고른다.
// 괄호·따옴표 등 한글이 아닌 꼬리 문자는 건너뛰고 마지막 한글을 기준으로 판단한다.
// 예: "샌딩(면갈이)" → '이' 기준(받침 없음). 한글이 하나도 없으면 받침 있는 쪽을 기본값으로 쓴다.

type JosaPair = "은는" | "이가" | "을를" | "과와" | "으로로" | "이라라" | "이에요예요";

// 단어 끝에서부터 거슬러 올라가 마지막 '한글 음절' 문자 코드를 찾는다(없으면 -1).
function lastHangulCode(word: string): number {
  for (let i = word.length - 1; i >= 0; i--) {
    const ch = word.charCodeAt(i);
    if (ch >= 0xac00 && ch <= 0xd7a3) return ch;
  }
  return -1;
}

function hasBatchim(word: string): boolean {
  const ch = lastHangulCode(word);
  if (ch < 0) return true; // 한글이 없으면 보수적으로 받침 취급
  return (ch - 0xac00) % 28 !== 0;
}

// 받침이 ㄹ(종성 코드 8)인지 — '으로/로' 선택에만 쓰인다(서울→서울로).
function hasRieulBatchim(word: string): boolean {
  const ch = lastHangulCode(word);
  if (ch < 0) return false;
  return (ch - 0xac00) % 28 === 8;
}

// 조사만 돌려준다. 예: josaEnd("수원", "을를") === "을", josaEnd("경기", "은는") === "는"
export function josaEnd(word: string, pair: JosaPair): string {
  const b = hasBatchim(word);
  switch (pair) {
    case "은는": return b ? "은" : "는";
    case "이가": return b ? "이" : "가";
    case "을를": return b ? "을" : "를";
    case "과와": return b ? "과" : "와";
    case "으로로":
      // 받침 없음 또는 ㄹ 받침이면 '로' — 예: 철거로, 서울로 / 그 외 받침은 '으로' — 예: 샌딩으로
      return !b || hasRieulBatchim(word) ? "로" : "으로";
    case "이라라": return b ? "이라" : "라"; // 예: 바닥샌딩이라도 / 데코타일철거라도
    case "이에요예요": return b ? "이에요" : "예요";
  }
}

// 단어+조사. 예: josa("수원", "을를") === "수원을", josa("경기", "은는") === "경기는"
export function josa(word: string, pair: JosaPair): string {
  return word + josaEnd(word, pair);
}
