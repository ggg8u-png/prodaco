// 블로그 글 주소(URL) 생성 — 한 곳에서만 만든다.
//
// 글 id 는 이제 CMS 가 제목에서 자동으로 만든다(한글 슬러그 허용 — 키워드 페이지와 동일 방식).
// 한글 id 는 sitemap·canonical 에서 반드시 퍼센트 인코딩돼야 하므로 여기서 일괄 처리한다.
// 기존 영문 id(deco-tile-cost 등)는 인코딩해도 그대로라 URL 이 바뀌지 않는다.

/** 사이트 내부 경로 — <Link href> 용. */
export function blogPath(id: string): string {
  return `/blog/${encodeURIComponent(id)}`;
}

/** 절대 URL — canonical·sitemap·구조화데이터용. */
export function blogUrl(siteUrl: string, id: string): string {
  return `${siteUrl}${blogPath(id)}`;
}

/**
 * 라우트 params 의 [id] → 실제 글 id.
 * 한글 id 는 런타임에 퍼센트 인코딩(%ED%85%8C…)되어 들어오므로 디코딩한다
 * (키워드 페이지 [slug]·[region] 과 동일한 처리). 영문 id 는 그대로다.
 */
export function decodeBlogId(rawId: string): string {
  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
}

/** 절대 URL 에서 글 id 를 되돌린다(디코딩 포함). 블로그 URL 이 아니면 null. */
export function blogIdFromUrl(siteUrl: string, url: string): string | null {
  const prefix = `${siteUrl}/blog/`;
  if (!url.startsWith(prefix)) return null;
  const raw = url.slice(prefix.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
