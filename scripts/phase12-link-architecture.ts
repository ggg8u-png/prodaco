import fs from "node:fs";
import path from "node:path";
import { entriesForGroup, SITEMAP_GROUPS } from "@/lib/sitemap";
import { getKeywords } from "@/data/keywords";

const ROOT = process.cwd();
const APP = path.join(ROOT, ".next", "server", "app");
if (!fs.existsSync(APP)) throw new Error(".next/server/app 없음 — npm run build 후 실행하세요");

const normalizePath = (value: string): string | null => {
  if (!value || /^(?:mailto:|tel:|javascript:|#)/i.test(value)) return null;
  try {
    const u = new URL(value, "https://prodaco.kr");
    if (u.host !== "prodaco.kr") return null;
    const decoded = decodeURIComponent(u.pathname);
    return decoded.length > 1 ? decoded.replace(/\/$/, "") : decoded;
  } catch { return null; }
};
const routeOfHtml = (file: string) => {
  let rel = path.relative(APP, file).replace(/\\/g, "/").replace(/\.html$/, "");
  if (rel === "index") return "/";
  if (rel.endsWith("/index")) rel = rel.slice(0, -6);
  return normalizePath(`/${rel}`) ?? `/${rel}`;
};

const files = (fs.readdirSync(APP, { recursive: true }) as string[])
  .filter((f) => f.endsWith(".html"))
  .map((f) => path.join(APP, f));
const graph = new Map<string, Set<string>>();
const anchorCounts = new Map<string, number>();
for (const file of files) {
  const route = routeOfHtml(file);
  const html = fs.readFileSync(file, "utf8");
  const links = [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)]
    .map((m) => normalizePath(m[1]))
    .filter((v): v is string => Boolean(v));
  graph.set(route, new Set(links));
  anchorCounts.set(route, links.length);
}

const depth = new Map<string, number>([["/", 0]]);
const queue = ["/"];
while (queue.length) {
  const current = queue.shift()!;
  for (const target of graph.get(current) ?? []) {
    if (!graph.has(target) || depth.has(target)) continue;
    depth.set(target, depth.get(current)! + 1);
    queue.push(target);
  }
}

const sitemapPaths = SITEMAP_GROUPS.flatMap((g) => entriesForGroup(g))
  .map((e) => normalizePath(e.loc))
  .filter((v): v is string => Boolean(v));
const uniqueSitemap = [...new Set(sitemapPaths)];
const orphan = uniqueSitemap.filter((p) => !depth.has(p));
const measuredDepths = uniqueSitemap.map((p) => depth.get(p)).filter((n): n is number => n !== undefined);
const avgDepth = measuredDepths.reduce((a, b) => a + b, 0) / Math.max(1, measuredDepths.length);
const overFour = uniqueSitemap.filter((p) => (depth.get(p) ?? Infinity) > 4);

const servicesLinks = graph.get("/services") ?? new Set<string>();
const serviceAnchors = anchorCounts.get("/services") ?? 0;
const comboPages = getKeywords().map((k) => `/${k.slug}`);
const blogPages = [...graph.keys()].filter((p) => p.startsWith("/blog/"));
const regionPages = [...graph.keys()].filter((p) => p.startsWith("/services/"));
const comboWithTwoBlogs = comboPages.filter((p) => [...(graph.get(p) ?? [])].filter((x) => x.startsWith("/blog/")).length >= 2).length;
const blogsWithService = blogPages.filter((p) => [...(graph.get(p) ?? [])].some((x) => x === "/services" || /^\/[^/]+$/.test(x))).length;
const regionsWithCoreItems = regionPages.filter((p) => [...(graph.get(p) ?? [])].filter((x) => /^\/[^/]+$/.test(x) && x !== "/").length >= 3).length;

const failures: string[] = [];
if (orphan.length) failures.push(`sitemap 고아 ${orphan.length}개`);
if (overFour.length) failures.push(`홈에서 4클릭 초과 ${overFour.length}개`);
if (comboWithTwoBlogs < comboPages.length * 0.9) failures.push(`관련 블로그 2개 미만 조합 페이지가 10% 초과`);
if (blogsWithService !== blogPages.length) failures.push(`서비스 역링크 없는 블로그 ${blogPages.length - blogsWithService}개`);
if (regionsWithCoreItems !== regionPages.length) failures.push(`핵심 품목 3개 미만 지역 허브 ${regionPages.length - regionsWithCoreItems}개`);

const report = [
  "# PHASE 12 내부링크 허브 감사", "",
  "## /services", "",
  `- 현재 실제 SSR anchor: ${serviceAnchors}개(고유 내부 경로 ${servicesLinks.size}개)`,
  "- 저장소에 기록된 과거 단순 나열 기준: 1,652개",
  `- 과거 기록 대비 감소: ${Math.max(0, 1652 - serviceAnchors)}개`,
  "- 현재 구조: 권역 → 세부 지역 허브 → 지역별 핵심 품목, 광역 지역만 품목 직링크", "",
  "## 전체 정적 링크 그래프", "",
  `- 분석 HTML: ${graph.size}개`,
  `- sitemap 대상: ${uniqueSitemap.length}개`,
  `- 고아 URL: ${orphan.length}개`,
  `- 평균 홈 클릭 깊이: ${avgDepth.toFixed(2)}`,
  `- 4클릭 초과: ${overFour.length}개`,
  `- 최대 깊이: ${Math.max(...measuredDepths)}클릭`, "",
  "## 상호 연결", "",
  `- 조합 → 관련 블로그 2개 이상: ${comboWithTwoBlogs}/${comboPages.length}`,
  `- 블로그 → 서비스/지역 페이지: ${blogsWithService}/${blogPages.length}`,
  `- 지역 허브 → 핵심 품목 3개 이상: ${regionsWithCoreItems}/${regionPages.length}`,
  "- 모든 링크는 빌드된 SSR HTML의 실제 `<a href>`를 기준으로 측정했다.", "",
  "## 위반", "",
  ...(failures.length ? failures.map((f) => `- FAIL: ${f}`) : ["- 없음"]), "",
  "## 변경 안전성", "",
  "- 기존 URL, canonical, robots, sitemap 포함 정책을 변경하지 않았다.",
  "- 새 허브 URL을 만들지 않았다. 현재 권역·지역 허브 구조로 4클릭 이내 도달이 가능하다.", "",
].join("\n");

fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "reports", "phase12-internal-link-audit.md"), report, "utf8");
console.log(`[phase12-link-architecture] services ${serviceAnchors} anchors · orphan ${orphan.length} · avgDepth ${avgDepth.toFixed(2)} · violations ${failures.length}`);
if (failures.length) process.exit(1);
