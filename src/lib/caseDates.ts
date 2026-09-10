// 시공사례의 "등록일(정렬 기준)"·"문서 게시/수정일"·"현장 작업일" — 단일 출처.
//
// ⚠ 두 날짜는 다른 값이고, 섞으면 안 된다.
//   · 등록일(registeredAt) = 이 사례를 사이트에 올린 날. 목록 최신순의 기준.
//   · 게시일(published)     = 이 사례 문서를 사이트에 공개한 날. Article datePublished.
//   · 작업일(workDate)      = 현장에서 실제 작업한 날. 상세 현장정보에 별도로 표시.
//   실제로 case-20260824-0958 은 8/24 에 등록했지만 작업일은 7/1 이다. 작업일로 목록을
//   정렬하면 "어제 올린 글이 목록 중간에 파묻히는" 원래 증상이 형태만 바꿔 되돌아온다.
//
// 왜 파일을 따로 두는가:
//   목록 정렬(src/data/gallery.ts)과 상세페이지·사이트맵(src/lib/caseDoc.ts)이 같은 규칙을
//   써야 어긋남이 안 생기는데, caseDoc 은 galleryItems 를 import 하므로 gallery 가 caseDoc 을
//   import 하면 순환이 된다 → 순환 없는 최하위 모듈로 규칙만 분리한다.
import { caseDates, newestDate } from "@/lib/contentDates";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_STAMP_RE = /^case-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/;

/** 정렬·날짜 계산에 필요한 최소 정보만 받는다(GalleryItem 전체를 요구하지 않는다). */
export interface CaseDateInput {
  id: string;
  /** 사이트에 게시한 날짜. 실제 현장 작업일(workDate)과 구분한다. */
  publishedAt?: string;
  /** 운영자가 명시한 실제 콘텐츠 수정일. */
  updatedAt?: string;
  workDate?: string;
  /** 운영자가 목록 맨 위에 고정한 사례. */
  featured?: boolean;
}

/** 자동 생성 id(case-YYYYMMDD-HHMM)에서 등록 날짜·시각을 뽑는다. 형식이 다르면 null. */
export function stampFromCaseId(id: string): { date: string; time: string } | null {
  const m = ID_STAMP_RE.exec(id);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) return null;
  return { date, time: `${m[4]}${m[5]}` };
}

const clean = (d?: string): string | undefined => {
  const s = (d || "").slice(0, 10);
  return DATE_RE.test(s) && !Number.isNaN(Date.parse(s)) ? s : undefined;
};

/**
 * 게시일(YYYY-MM-DD) — Article datePublished가 쓰는 문서 발행 날짜.
 *   ① 운영자가 CMS 에 적은 publishedAt
 *   ② 없으면 그 파일이 처음 커밋된 날(git)
 *   ③ 그것도 없으면 파일명(case-YYYYMMDD-HHMM)의 날짜
 *   ④ 레거시 수기 사례만 실제 작업일로 최종 폴백
 * 근거가 하나도 없으면 undefined — 없는 날짜를 지어내지 않는다.
 * workDate는 문서 게시 근거가 전혀 없는 레거시 사례에만 마지막 수단으로 쓴다.
 */
export function casePublishedDate(g: CaseDateInput): string | undefined {
  return clean(g.publishedAt) || clean(caseDates(g.id).created) || stampFromCaseId(g.id)?.date || clean(g.workDate);
}

/** 수정일 — 명시적 updatedAt·git 마지막 수정일·게시일 중 실제로 가장 최신 날짜. */
export function caseModifiedDate(g: CaseDateInput): string | undefined {
  const explicit = clean(g.updatedAt);
  return newestDate(explicit, caseDates(g.id).modified, casePublishedDate(g));
}

/**
 * 등록일(YYYY-MM-DD) — 목록 최신순의 기준. 작업일과 우선순위가 반대다.
 *   ① 그 파일이 처음 커밋된 날(git) = 실제로 사이트에 올린 날
 *   ② 없으면 파일명(case-YYYYMMDD-HHMM) 날짜 — CMS 가 등록 시각으로 지은 이름이다
 *   ③ 그것도 없으면(레거시 수기 사례) workDate 로 폴백
 */
export function caseRegisteredDate(g: CaseDateInput): string | undefined {
  return clean(g.publishedAt) || clean(caseDates(g.id).created) || stampFromCaseId(g.id)?.date || clean(g.workDate);
}

/**
 * 최신순 비교자 — 목록·홈 미리보기·관련 사례가 전부 이 하나를 쓴다.
 *   ① 고정(featured) 사례 먼저
 *   ② 등록일 내림차순 (문자열 비교가 아니라 Date 값으로 판정)
 *   ③ 같은 날이면 등록 시각(파일명 HHMM) 늦은 쪽 먼저
 *   ④ 그래도 같으면 id 역순 — 값이 같아도 순서가 흔들리지 않게 하는 최종 안정 장치
 * 날짜 근거가 전혀 없는 사례는 맨 뒤로 가되, 자기들끼리는 ④로 순서가 고정된다.
 */
export function compareCasesNewestFirst(a: CaseDateInput, b: CaseDateInput): number {
  if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;

  const ra = caseRegisteredDate(a);
  const rb = caseRegisteredDate(b);
  if (ra && rb) {
    const diff = Date.parse(rb) - Date.parse(ra);
    if (diff !== 0) return diff;
  } else if (ra || rb) {
    return ra ? -1 : 1; // 날짜를 아는 쪽이 앞
  }

  const ta = stampFromCaseId(a.id)?.time ?? "";
  const tb = stampFromCaseId(b.id)?.time ?? "";
  if (ta !== tb) return tb.localeCompare(ta);

  return b.id.localeCompare(a.id);
}
