import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const PRIMARY = "https://prodaco.kr";
const site = await fetch("https://api.netlify.com/api/v1/sites/prodaco.kr").then((r) => {
  if (!r.ok) throw new Error(`Netlify site lookup HTTP ${r.status}`);
  return r.json();
});
const defaultHost = `https://${site.name}.netlify.app`;
const netlifyConfig = fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8");
const redirectConfigured = netlifyConfig.includes(`from = "${defaultHost}/*"`)
  && netlifyConfig.includes('to = "https://prodaco.kr/:splat"');
const paths = ["/", "/services", "/blog/tile-removal", "/gallery/case-20260826-1031", `/${encodeURIComponent("서울-강마루철거")}`];
const origins = [PRIMARY, "http://prodaco.kr", "https://www.prodaco.kr", `http://${site.name}.netlify.app`, defaultHost];

async function inspect(url) {
  let current = url;
  const hops = [];
  let response;
  for (let i = 0; i < 8; i++) {
    response = await fetch(current, { redirect: "manual", headers: { "user-agent": "PRODACO-Phase13-Audit/1.0" } });
    const location = response.headers.get("location");
    hops.push({ status: response.status, url: current, location: location || "" });
    if (!location || response.status < 300 || response.status >= 400) break;
    current = new URL(location, current).href;
  }
  if (!response) throw new Error(`응답 없음: ${url}`);
  const body = await response.text();
  const canonical = body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]
    || body.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] || "";
  const metaRobots = body.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)/i)?.[1] || "";
  const headerRobots = response.headers.get("x-robots-tag") || "";
  return {
    requestedUrl: url,
    status: hops[0].status,
    location: hops[0].location,
    hopCount: hops.length - 1,
    finalUrl: current,
    finalStatus: response.status,
    canonical,
    robots: [metaRobots, headerRobots].filter(Boolean).join(" / ") || "(기본 index 허용)",
    bodyHash: crypto.createHash("sha256").update(body).digest("hex").slice(0, 16),
  };
}

const rows = [];
for (const origin of origins) for (const pathname of paths) rows.push(await inspect(`${origin}${pathname}`));

const defaultRows = rows.filter((r) => r.requestedUrl.startsWith(defaultHost) || r.requestedUrl.startsWith(`http://${site.name}.netlify.app`));
const duplicateDefault = defaultRows.filter((r) => r.status === 200 && new URL(r.finalUrl).host === `${site.name}.netlify.app`);
const wrongCanonical = rows.filter((r) => r.finalStatus === 200 && r.canonical && !r.canonical.startsWith(PRIMARY));
const sitemapText = await fetch(`${PRIMARY}/sitemap.xml`).then((r) => r.text());
const netlifyInSitemap = /netlify\.app/i.test(sitemapText);

const report = [
  "# PHASE 13 호스트 정규화 감사", "",
  `- Netlify site: ${site.name}`,
  `- production default domain: ${defaultHost}`,
  `- custom primary domain: ${site.custom_domain}`,
  `- repository: ${site.repo_url}`,
  `- default host 200 중복: ${duplicateDefault.length}건`,
  `- apex 이외 canonical: ${wrongCanonical.length}건`,
  `- sitemap 내 netlify.app: ${netlifyInSitemap ? "있음" : "없음"}`, "",
  `- repository 301 rule: ${redirectConfigured ? "설정됨(다음 production deploy 반영)" : "없음"}`, "",
  "| 요청 | status | Location | hop | final | canonical | robots | body hash |",
  "|---|---:|---|---:|---|---|---|---|",
  ...rows.map((r) => `| ${r.requestedUrl} | ${r.status} | ${r.location || "-"} | ${r.hopCount} | ${r.finalStatus} ${r.finalUrl} | ${r.canonical || "-"} | ${r.robots} | ${r.bodyHash} |`), "",
  "## 판정", "",
  ...(duplicateDefault.length
    ? [redirectConfigured
      ? "- PENDING DEPLOY: 라이브 default host는 아직 200이지만 저장소에 apex 301 규칙을 추가했습니다."
      : "- FAIL: Netlify production default host가 자체 200 콘텐츠를 제공합니다."]
    : ["- PASS: Netlify production default host는 apex로 정규화됩니다."]),
  ...(wrongCanonical.length ? ["- FAIL: prodaco.kr 이외 canonical이 있습니다."] : ["- PASS: 확인된 canonical은 prodaco.kr 기준입니다."]),
  `- ${netlifyInSitemap ? "FAIL" : "PASS"}: sitemap에 Netlify URL이 ${netlifyInSitemap ? "있습니다" : "없습니다"}.`, "",
].join("\n");

fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "reports", "phase13-host-normalization.md"), report, "utf8");
console.log(`[phase13-host-audit] default=${site.name}.netlify.app duplicate200=${duplicateDefault.length} wrongCanonical=${wrongCanonical.length} sitemapNetlify=${netlifyInSitemap}`);
if ((duplicateDefault.length && !redirectConfigured) || wrongCanonical.length || netlifyInSitemap) process.exit(1);
