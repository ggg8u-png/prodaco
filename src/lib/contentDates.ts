// 글당 1파일 콘텐츠(블로그·시공사례)의 실제 발행일·수정일.
//
// 출처는 content/lastmod.json — scripts/build-lastmod.mjs 가 빌드 전에 git 커밋 날짜로
// 만든다(커밋되지 않는 산출물). mtime·now() 를 쓰지 않으므로 같은 커밋을 다시 빌드하면
// 항상 같은 값이 나온다 = 거짓 신선도 신호를 만들지 않는다.
//
//   created  : 그 파일이 처음 커밋된 날 → datePublished
//   modified : 마지막으로 커밋된 날      → dateModified
//
// 발행일과 수정일을 분리해 두는 이유는 "글을 고쳤다고 발행일까지 새로 잡지 않는다" 를
// 지키기 위해서다. git 을 못 읽는 환경이면 맵이 비고, 호출부가 각자 폴백을 쓴다.
import fs from "node:fs";
import path from "node:path";

export interface DocDates {
  created?: string;
  modified?: string;
}

interface DatesFile {
  posts?: Record<string, DocDates>;
  cases?: Record<string, DocDates>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const file: DatesFile = (() => {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "content", "lastmod.json"), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as DatesFile) : {};
  } catch {
    return {};
  }
})();

const clean = (d?: string): string | undefined => (d && DATE_RE.test(d) ? d : undefined);

/** 블로그 글의 git 기준 발행일·수정일. 없으면 빈 객체. */
export function postDates(id: string): DocDates {
  const d = file.posts?.[id];
  return d ? { created: clean(d.created), modified: clean(d.modified) } : {};
}

/** 시공사례의 git 기준 발행일·수정일. 없으면 빈 객체. */
export function caseDates(id: string): DocDates {
  const d = file.cases?.[id];
  return d ? { created: clean(d.created), modified: clean(d.modified) } : {};
}

/** 후보 날짜 중 가장 최신(형식이 맞는 값만). 하나도 없으면 undefined. */
export function newestDate(...candidates: (string | undefined)[]): string | undefined {
  const valid = candidates.map(clean).filter((d): d is string => !!d);
  return valid.length ? valid.sort().slice(-1)[0] : undefined;
}
