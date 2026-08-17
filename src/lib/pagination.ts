// 목록 페이지 페이지네이션 — 블로그(/blog)와 시공사례(/gallery)가 같은 규칙을 쓴다.
//
// 설계:
//   · 1페이지는 항상 기존 URL(/blog, /gallery) 그대로다. /blog/page/1 은 만들지 않는다
//     — 같은 내용이 두 주소에 생기면 그게 바로 중복 콘텐츠다.
//   · 2페이지부터 /blog/page/2 처럼 붙는다. 각 페이지는 self-canonical 이고 index 대상이다
//     (2페이지를 1페이지로 canonical 하면 거기 실린 글들이 발견 경로를 잃는다).
//   · rel=prev/next 로 순서를 알린다.
//
// 페이지 크기는 현재 글 수보다 넉넉하게 잡았다. 지금은 전부 1페이지에 들어가서
// 페이지네이션이 실제로 갈라지지 않는다 — 목록에서 상세로 가는 링크 수를 지금 줄일
// 이유가 없기 때문이다. 글이 늘면 그때부터 자동으로 나뉜다.
export const BLOG_PAGE_SIZE = 20;
export const CASE_PAGE_SIZE = 36;

export interface Paged<T> {
  items: T[];
  page: number;
  totalPages: number;
  /** 이 목록의 1페이지 경로(예: "/blog"). */
  basePath: string;
  prevHref?: string;
  nextHref?: string;
}

/** n페이지 경로. 1페이지는 base 그대로. */
export function pageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}/page/${page}`;
}

export function paginate<T>(all: T[], basePath: string, pageSize: number, page: number): Paged<T> {
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  return {
    items: all.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    totalPages,
    basePath,
    prevHref: current > 1 ? pageHref(basePath, current - 1) : undefined,
    nextHref: current < totalPages ? pageHref(basePath, current + 1) : undefined,
  };
}

/** 2페이지부터의 번호 목록 — generateStaticParams 용(1페이지는 별도 라우트라 제외). */
export function extraPageNumbers(total: number, pageSize: number): number[] {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => i + 2);
}
