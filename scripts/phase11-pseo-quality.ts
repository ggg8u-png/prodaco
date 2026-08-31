import fs from "node:fs";
import path from "node:path";
import { getKeywords } from "@/data/keywords";
import { getContentForKeyword, getRelatedKeywords } from "@/lib/content";
import { uniqueTitle, uniqueDescription, pickFaqs } from "@/lib/seo";
import { indexabilityFor } from "@/lib/seo/indexability";
import { relatedGuidesFor } from "@/lib/relatedGuides";
import { company } from "@/data/company";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "reports");
const keywords = getKeywords();

const clean = (s: string) => s.toLowerCase().replace(/[^0-9a-z가-힣\s]/g, " ").replace(/\s+/g, " ").trim();
const sentences = (s: string) => s.split(/(?:\n+|(?<=[.!?])\s+)/).map(clean).filter((x) => x.length >= 20);
const tokens = (s: string) => new Set(clean(s).split(" ").filter((x) => x.length > 1));
const jaccard = (a: Set<string>, b: Set<string>) => {
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  return intersection / Math.max(1, a.size + b.size - intersection);
};
const stripTerms = (text: string, terms: Array<string | undefined>) => {
  let out = text;
  for (const term of terms) if (term) out = out.replaceAll(term, " ");
  return clean(out);
};
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const urlKey = (url: string) => {
  try { return decodeURIComponent(new URL(url).pathname); } catch { return url; }
};

const gsc = new Map<string, { clicks: number; impressions: number; ctr: string }>();
const gscFile = path.join(ROOT, "content", "gsc", "performance-pages-2026-07-13.csv");
if (fs.existsSync(gscFile)) {
  for (const line of fs.readFileSync(gscFile, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).slice(1)) {
    const cols = line.split(",");
    if (cols.length >= 4) gsc.set(urlKey(cols[0]), { clicks: Number(cols[1]) || 0, impressions: Number(cols[2]) || 0, ctr: cols[3] });
  }
}
const crawled = new Set<string>();
const coverageFile = path.join(ROOT, "content", "gsc", "crawled-not-indexed-2026-07-27.csv");
if (fs.existsSync(coverageFile)) {
  for (const line of fs.readFileSync(coverageFile, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).slice(1)) {
    const [url] = line.split(",");
    if (url) crawled.add(urlKey(url));
  }
}

const sentenceFrequency = new Map<string, number>();
const raw = keywords.map((k) => {
  const body = getContentForKeyword(k);
  const bodySentences = sentences(body);
  for (const sentence of new Set(bodySentences)) sentenceFrequency.set(sentence, (sentenceFrequency.get(sentence) ?? 0) + 1);
  return { k, body, bodySentences };
});

const groups = new Map<string, typeof raw>();
for (const row of raw) {
  const key = `${row.k.type}|${row.k.item || "-"}`;
  groups.set(key, [...(groups.get(key) ?? []), row]);
}

type Grade = "A" | "B" | "C" | "D";
const results = raw.map((row) => {
  const { k, body, bodySentences } = row;
  const stripped = stripTerms(body, [k.region, k.item, k.keyword]);
  const set = tokens(stripped);
  let nearest = 0;
  for (const other of groups.get(`${k.type}|${k.item || "-"}`) ?? []) {
    if (other.k.slug === k.slug) continue;
    const otherStripped = stripTerms(other.body, [other.k.region, other.k.item, other.k.keyword]);
    nearest = Math.max(nearest, jaccard(set, tokens(otherStripped)));
  }
  const uniqueSentences = bodySentences.filter((s) => sentenceFrequency.get(s) === 1).length;
  const uniqueRatio = uniqueSentences / Math.max(1, bodySentences.length);
  const templateRatio = 1 - uniqueRatio;
  let grade: Grade = body.length < 700 || nearest >= 0.95 ? "D"
    : nearest >= 0.85 || uniqueRatio < 0.08 ? "C"
      : nearest >= 0.68 || uniqueRatio < 0.2 ? "B" : "A";
  const ix = indexabilityFor(k);
  if (!ix.inSitemap && grade === "A") grade = "B";
  const title = uniqueTitle(k);
  const description = uniqueDescription(k, company.phone);
  const faqSignature = pickFaqs(k, 4).map((f) => f.id).sort().join("|");
  const url = `https://prodaco.kr/${encodeURIComponent(k.slug)}`;
  const perf = gsc.get(urlKey(url));
  const internalLinks = getRelatedKeywords(k, keywords, 10).filter((x) => indexabilityFor(x).inSitemap).slice(0, 6).length
    + relatedGuidesFor(k, 3).length + 4;
  return {
    url, slug: k.slug, routeType: String(k.type), indexable: ix.inSitemap, grade,
    title, description, h1: k.keyword, faqSignature,
    bodyLength: body.length, nearestSimilarity: nearest, templateRatio, uniqueRatio,
    imageCount: 4 + ([...k.slug].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261) % 3),
    internalLinks, clicks: perf?.clicks ?? 0, impressions: perf?.impressions ?? 0, ctr: perf?.ctr ?? "",
    gscCrawledNotIndexed: crawled.has(urlKey(url)),
  };
});

const dupRate = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return 100 * values.filter((v) => (counts.get(v) ?? 0) > 1).length / Math.max(1, values.length);
};
const headers = ["url", "slug", "route_type", "indexable", "grade", "title", "description", "h1", "faq_signature", "body_length", "normalized_nearest_similarity", "template_ratio", "unique_sentence_ratio", "image_count", "internal_link_count", "gsc_clicks", "gsc_impressions", "gsc_ctr", "gsc_crawled_not_indexed"];
const csv = [headers.join(","), ...results.map((r) => [r.url, r.slug, r.routeType, r.indexable, r.grade, r.title, r.description, r.h1, r.faqSignature, r.bodyLength, r.nearestSimilarity.toFixed(4), r.templateRatio.toFixed(4), r.uniqueRatio.toFixed(4), r.imageCount, r.internalLinks, r.clicks, r.impressions, r.ctr, r.gscCrawledNotIndexed].map(csvCell).join(","))].join("\n");

const gradeCounts = (["A", "B", "C", "D"] as Grade[]).map((grade) => ({ grade, rows: results.filter((r) => r.grade === grade) }));
const summary = [
  "# PHASE 11 pSEO 중복도 정밀 분석", "",
  `- 분석 URL: ${results.length}개`,
  `- title 중복 영향률: ${dupRate(results.map((r) => r.title)).toFixed(2)}%`,
  `- description 중복 영향률: ${dupRate(results.map((r) => r.description)).toFixed(2)}%`,
  `- H1 중복 영향률: ${dupRate(results.map((r) => r.h1)).toFixed(2)}%`,
  `- FAQ 조합 중복 영향률: ${dupRate(results.map((r) => r.faqSignature)).toFixed(2)}%`,
  `- GSC 성과 결합 URL: ${results.filter((r) => r.impressions > 0 || r.clicks > 0).length}개`,
  `- GSC 크롤됨-미색인 일치 URL: ${results.filter((r) => r.gscCrawledNotIndexed).length}개`, "",
  "## 등급", "",
  ...gradeCounts.flatMap(({ grade, rows }) => [
    `### ${grade} — ${rows.length}개`,
    ...rows.slice(0, 5).map((r) => `- ${r.url} (유사도 ${(r.nearestSimilarity * 100).toFixed(1)}%, 고유문장 ${(r.uniqueRatio * 100).toFixed(1)}%, ${r.indexable ? "sitemap" : "sitemap 제외"})`), "",
  ]),
  "## 해석 주의", "",
  "- 등급은 내부 휴리스틱이며 검색엔진의 공식 평가나 순위 보장이 아니다.",
  "- 지역명·품목명·키워드를 제거한 뒤 같은 route type·품목군 안에서 가장 가까운 본문을 비교했다.",
  "- 사진 배치 다양성은 콘텐츠 고유성으로 계산하지 않았다.",
  "- 이번 Phase에서는 URL 삭제, noindex, canonical 변경을 수행하지 않았다.", "",
].join("\n");

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "phase11-pseo-quality.csv"), "\uFEFF" + csv, "utf8");
fs.writeFileSync(path.join(OUT, "phase11-pseo-summary.md"), summary, "utf8");
console.log(`[phase11-pseo-quality] ${results.length} URLs · ${gradeCounts.map((g) => `${g.grade}:${g.rows.length}`).join(" ")}`);
