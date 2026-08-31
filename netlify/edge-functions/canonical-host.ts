// Netlify 기본 주소와 www 요청은 검색용 정규 도메인으로 한 번에 보낸다.
// deploy-preview 주소는 제외해 Preview QA를 계속 사용할 수 있게 한다.
const CANONICAL_ORIGIN = "https://prodaco.kr";
const LEGACY_HOSTS = new Set([
  "stirring-strudel-d081f4.netlify.app",
  "www.prodaco.kr",
]);

export default function canonicalHost(request: Request) {
  const current = new URL(request.url);
  const requiresCanonicalHost = LEGACY_HOSTS.has(current.hostname.toLowerCase());
  const requiresHttps = current.hostname.toLowerCase() === "prodaco.kr" && current.protocol !== "https:";
  if (!requiresCanonicalHost && !requiresHttps) return;

  const destination = new URL(`${current.pathname}${current.search}`, CANONICAL_ORIGIN);
  return Response.redirect(destination, 301);
}

export const config = { path: "/*" };
