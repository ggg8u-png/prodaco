/** 본문에서 서식을 걷어낸 평문 — 요약(excerpt)·메타 설명 자동 생성용. */
export function markdownToPlainText(markdown: string): string {
  return (markdown || "")
    .replace(/\r\n?/g, "\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // 이미지 제거
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // 링크는 글자만
    .replace(/^\s*\|.*\|\s*$/gm, "") // 표 제거
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d{1,2}[.)]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
