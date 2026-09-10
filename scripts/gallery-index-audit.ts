// 시공사례 원본 JSON + 실제 HTTP 응답 + sitemap + IndexNow + 수동 관측을 URL별로 결합한다.
// 검색결과를 scraping하지 않으며, 기술적 색인 가능성과 실제 색인/노출을 별도 상태로 유지한다.
//
//   npm run seo:gallery-index -- --base-url http://127.0.0.1:3000
//   npm run seo:gallery-index -- --base-url https://prodaco.kr --no-write
import fs from "node:fs";
import path from "node:path";
import { galleryItems } from "@/data/gallery";
import {
  caseMetaDescription,
  casePageItems,
  casePath,
  caseUrl,
  isCaseIndexable,
} from "@/lib/caseDoc";
import { caseRegisteredDate } from "@/lib/caseDates";
import { caseFeaturedImage, absoluteImageUrl } from "@/lib/featuredImage";
import { CASE_PAGE_SIZE } from "@/lib/pagination";

type Json = Record<string, unknown>;
type Observation = {
  url?: string;
  engine?: "naver" | "google";
  indexStatus?: "unknown" | "indexed" | "not_indexed";
  lastIndexCheckAt?: string;
  exactTitleStatus?: "unknown" | "visible" | "not_visible";
  keywordStatus?: "unknown" | "visible" | "not_visible";
  lastSearchCheckAt?: string;
  query?: string;
  note?: string;
};

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const optionValue = (name: string) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};
const baseUrl = (optionValue("--base-url") || process.env.GALLERY_AUDIT_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = path.resolve(ROOT, optionValue("--output-dir") || "reports");
const writeReports = !argv.includes("--no-write");
const checkedAt = new Date().toISOString();
const siteUrl = "https://prodaco.kr";

// The audit process itself does not run with NODE_ENV=production, while the
// built page does. Mirror uploadedImage()'s production rule explicitly so the
// check compares against the metadata emitted by `next build`.
const productionUploadedImage = (src: string) =>
  src.startsWith("/uploads/")
    ? `/.netlify/images?url=${encodeURIComponent(src)}&w=1600&fm=webp&q=74`
    : src;

// Shared queue can legitimately contain non-gallery prodaco.kr URLs, including
// the site root. Keep this validation aligned with scripts/indexnow.mjs.
const validIndexNowQueueUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.host !== "prodaco.kr" || parsed.username || parsed.password) return false;
    if (parsed.search || parsed.hash || /%2f|%5c/i.test(parsed.pathname)) return false;
    const decoded = decodeURIComponent(parsed.pathname);
    return !decoded.includes("\\") && !decoded.split("/").includes("..") && parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
};

const decodeEntities = (value: string) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const plainText = (value: string) =>
  decodeEntities(value.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
const attribute = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match ? decodeEntities(match[2]) : "";
};
const metaContent = (html: string, key: "name" | "property", value: string) => {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (attribute(tag, key).toLowerCase() === value.toLowerCase()) return attribute(tag, "content");
  }
  return "";
};
const canonicalOf = (html: string) => {
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (attribute(tag, "rel").toLowerCase().split(/\s+/).includes("canonical")) return attribute(tag, "href");
  }
  return "";
};
const titleOf = (html: string) => decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
const h1Of = (html: string) => plainText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
const hrefsOf = (html: string) =>
  (html.match(/<a\b[^>]*\bhref\s*=\s*(["'])[\s\S]*?\1[^>]*>/gi) || [])
    .map((tag) => attribute(tag, "href"))
    .filter(Boolean);

function jsonLdOf(html: string): Json[] {
  const out: Json[] = [];
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const parsed = JSON.parse(decodeEntities(match[1]));
      if (parsed && typeof parsed === "object") out.push(parsed as Json);
    } catch {
      out.push({ "@type": "INVALID_JSON_LD" });
    }
  }
  return out;
}

function schemasOfType(items: Json[], type: string): Json[] {
  const out: Json[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const object = value as Json;
    const types = Array.isArray(object["@type"]) ? object["@type"] : [object["@type"]];
    if (types.includes(type)) out.push(object);
    if (Array.isArray(object["@graph"])) object["@graph"].forEach(visit);
  };
  items.forEach(visit);
  return out;
}

/** Internal hrefs may use the local smoke-test origin; compare them as site paths. */
function normalizeNavigableUrl(value: string): string {
  try {
    const parsed = new URL(value, baseUrl);
    parsed.hash = "";
    parsed.search = "";
    const baseOrigin = new URL(baseUrl).origin;
    const origin = parsed.origin === baseOrigin || parsed.origin === siteUrl ? siteUrl : parsed.origin;
    return `${origin}${parsed.pathname.replace(/\/$/, "") || "/"}`;
  } catch {
    return value;
  }
}

/** Canonical/OG/schema/sitemap URLs must themselves use the production origin. */
function normalizeAbsoluteDocumentUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) return value;
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "") || "/"}${parsed.search}${parsed.hash}`;
  } catch {
    return value;
  }
}

async function fetchPage(route: string) {
  try {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "manual", headers: { "user-agent": "PRODACO-Gallery-Index-Audit/1.0" } });
    return { route, status: response.status, html: await response.text(), error: "" };
  } catch (error) {
    return { route, status: 0, html: "", error: String((error as Error)?.message || error) };
  }
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    })
  );
  return results;
}

function rawGallery() {
  const directory = path.join(ROOT, "content", "gallery");
  const byId = new Map<string, { file: string; raw: Json; issue: string[] }>();
  const globalIssues: string[] = [];
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort()) {
    const issues: string[] = [];
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")) as Json;
      const fromFile = file.replace(/\.json$/, "");
      const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : fromFile;
      if (raw.id && raw.id !== fromFile) issues.push("id_file_mismatch");
      if (raw.status && raw.status !== "draft" && raw.status !== "published") issues.push("invalid_status");
      if (byId.has(id)) issues.push("duplicate_id");
      if (raw.status !== "draft") {
        if (!raw.beforeImage && !raw.driveProjectId) issues.push("missing_before_image");
        if (!raw.afterImage && !raw.driveProjectId) issues.push("missing_after_image");
        if (!String(raw.title || "").trim()) issues.push("fallback_title");
        if (String(raw.description || "").trim().length < 40) issues.push("thin_description");
      }
      byId.set(id, { file, raw, issue: issues });
    } catch (error) {
      globalIssues.push(`${file}: invalid_json (${String((error as Error)?.message || error)})`);
    }
  }
  return { byId, globalIssues };
}

function readRequiredJson(file: string, issues: string[]): Json {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("root must be an object");
    return value as Json;
  } catch (error) {
    issues.push(`${file}: invalid_required_json (${String((error as Error)?.message || error)})`);
    return { entries: [] };
  }
}

function newest<T extends { [key: string]: unknown }>(items: T[], dateKey: keyof T): T | undefined {
  return items.slice().sort((a, b) => String(b[dateKey] || "").localeCompare(String(a[dateKey] || "")))[0];
}

function trigrams(value: string) {
  const compact = value.replace(/\s+/g, "").toLowerCase();
  const out = new Set<string>();
  for (let i = 0; i <= compact.length - 3; i++) out.add(compact.slice(i, i + 3));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>) {
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection++;
  return a.size || b.size ? intersection / (a.size + b.size - intersection) : 0;
}

const csvCell = (value: unknown) => {
  let text = String(value ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
const mdCell = (value: unknown) => String(value ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
const yn = (value: boolean) => (value ? "YES" : "NO");

async function main() {
  const raw = rawGallery();
  const sourceFailures = [...raw.globalIssues];
  const cases = casePageItems();
  const casePages = await mapLimit(cases, 6, (item) => fetchPage(casePath(item.id)));
  const totalListPages = Math.max(1, Math.ceil(cases.length / CASE_PAGE_SIZE));
  const listRoutes = ["/", ...Array.from({ length: totalListPages }, (_, index) => (index === 0 ? "/gallery" : `/gallery/page/${index + 1}`))];
  const listPages = await mapLimit(listRoutes, 3, fetchPage);
  const sitemapPage = await fetchPage("/sitemaps/cases.xml");
  const missingPage = await fetchPage("/gallery/__gallery-index-audit-missing__");
  const sitemapUrls = new Set(
    [...sitemapPage.html.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => normalizeAbsoluteDocumentUrl(decodeEntities(match[1].trim())))
  );

  const allHtml = [...listPages, ...casePages];
  const inbound = new Map<string, number>();
  for (const page of allHtml) {
    for (const href of hrefsOf(page.html)) {
      const normalized = normalizeNavigableUrl(href);
      inbound.set(normalized, (inbound.get(normalized) || 0) + 1);
    }
  }
  const galleryListInbound = new Map<string, number>();
  for (const page of listPages.filter((item) => item.route !== "/")) {
    for (const href of hrefsOf(page.html)) {
      const normalized = normalizeNavigableUrl(href);
      galleryListInbound.set(normalized, (galleryListInbound.get(normalized) || 0) + 1);
    }
  }

  const queue = readRequiredJson("content/indexnow-queue.json", sourceFailures);
  if (!Array.isArray(queue.entries)) sourceFailures.push("content/indexnow-queue.json: entries_must_be_array");
  const queueEntries = Array.isArray(queue.entries) ? (queue.entries as Json[]) : [];
  for (const [index, entry] of queueEntries.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      sourceFailures.push(`content/indexnow-queue.json: entries[${index}]_must_be_object`);
      continue;
    }
    if (!validIndexNowQueueUrl(entry.url)) {
      sourceFailures.push(`content/indexnow-queue.json: entries[${index}]_invalid_url`);
    }
    if (!new Set(["publish", "content_update", "delete"]).has(String(entry.event || ""))) {
      sourceFailures.push(`content/indexnow-queue.json: entries[${index}]_invalid_event`);
    }
    if (!new Set(["pending", "submitted", "failed"]).has(String(entry.status || ""))) {
      sourceFailures.push(`content/indexnow-queue.json: entries[${index}]_invalid_status`);
    }
  }
  const checks = readRequiredJson("content/gallery-index-checks.json", sourceFailures);
  if (!Array.isArray(checks.entries)) sourceFailures.push("content/gallery-index-checks.json: entries_must_be_array");
  const observations = Array.isArray(checks.entries) ? (checks.entries as Observation[]) : [];
  const tri = new Map(cases.map((item) => [item.id, trigrams(item.description)]));
  const runtimeIds = new Set(cases.map((item) => item.id));
  const runtimeUrls = new Set(cases.map((item) => caseUrl(siteUrl, item.id)));
  const observationEnum = {
    engine: new Set(["naver", "google"]),
    indexStatus: new Set(["unknown", "indexed", "not_indexed"]),
    exactTitleStatus: new Set(["unknown", "visible", "not_visible"]),
    keywordStatus: new Set(["unknown", "visible", "not_visible"]),
  };
  for (const [index, observation] of observations.entries()) {
    const prefix = `content/gallery-index-checks.json: entries[${index}]`;
    if (!observation || typeof observation !== "object" || Array.isArray(observation)) {
      sourceFailures.push(`${prefix}_must_be_object`);
      continue;
    }
    const observedUrl = observation.url;
    let urlValid = typeof observedUrl === "string" && runtimeUrls.has(observedUrl);
    try {
      const parsed = new URL(String(observedUrl || ""));
      urlValid = urlValid && parsed.origin === siteUrl && !parsed.search && !parsed.hash && /^\/gallery\/[^/]+$/.test(parsed.pathname);
    } catch {
      urlValid = false;
    }
    if (!urlValid) sourceFailures.push(`${prefix}_invalid_or_orphan_url`);
    for (const key of Object.keys(observationEnum) as Array<keyof typeof observationEnum>) {
      const value = observation[key];
      if (!observationEnum[key].has(String(value || ""))) sourceFailures.push(`${prefix}_invalid_or_missing_${key}`);
    }
    for (const key of ["lastIndexCheckAt", "lastSearchCheckAt"] as const) {
      const value = observation[key];
      if (value && Number.isNaN(Date.parse(value))) sourceFailures.push(`${prefix}_invalid_${key}`);
    }
    if (observation.indexStatus && observation.indexStatus !== "unknown" && !observation.lastIndexCheckAt) {
      sourceFailures.push(`${prefix}_index_status_without_check_time`);
    }
    if (
      ((observation.exactTitleStatus && observation.exactTitleStatus !== "unknown") ||
        (observation.keywordStatus && observation.keywordStatus !== "unknown")) &&
      !observation.lastSearchCheckAt
    ) {
      sourceFailures.push(`${prefix}_search_status_without_check_time`);
    }
  }
  for (const [id, source] of raw.byId) {
    const status = source.raw.status;
    for (const issue of source.issue.filter((value) =>
      ["id_file_mismatch", "invalid_status", "duplicate_id"].includes(value)
    )) {
      sourceFailures.push(`${source.file}: ${issue}`);
    }
    if (status === "draft" && runtimeIds.has(id)) sourceFailures.push(`${source.file}: draft_present_in_runtime`);
    if (status !== "draft" && !runtimeIds.has(id)) sourceFailures.push(`${source.file}: published_missing_from_runtime`);
  }
  if (raw.byId.size > 0) {
    for (const id of runtimeIds) {
      if (!raw.byId.has(id)) sourceFailures.push(`${id}: runtime_case_missing_source_json`);
    }
  }

  const rows = cases.map((item, index) => {
    const page = casePages[index];
    const source = raw.byId.get(item.id);
    const sourceRaw = source?.raw || {};
    const url = caseUrl(siteUrl, item.id);
    const expectedDescription = caseMetaDescription(item);
    const expectedFeatured = absoluteImageUrl(siteUrl, productionUploadedImage(caseFeaturedImage(item).src));
    const title = titleOf(page.html);
    const h1 = h1Of(page.html);
    const canonical = normalizeAbsoluteDocumentUrl(canonicalOf(page.html));
    const robots = metaContent(page.html, "name", "robots").toLowerCase();
    const robotsTokens = new Set(robots.split(/[\s,]+/).filter(Boolean));
    const robotsIndexable =
      robotsTokens.has("index") &&
      robotsTokens.has("follow") &&
      !robotsTokens.has("noindex") &&
      !robotsTokens.has("nofollow");
    const metaDescription = metaContent(page.html, "name", "description");
    const ogTitle = metaContent(page.html, "property", "og:title");
    const ogDescription = metaContent(page.html, "property", "og:description");
    const ogUrl = normalizeAbsoluteDocumentUrl(metaContent(page.html, "property", "og:url"));
    // Image CDN URLs use their query string as transformation parameters. Do not
    // pass them through normalizeUrl(), which intentionally strips query strings
    // when comparing canonical document URLs.
    const ogImage = metaContent(page.html, "property", "og:image");
    const schemas = jsonLdOf(page.html);
    const articles = schemasOfType(schemas, "Article");
    const breadcrumbs = schemasOfType(schemas, "BreadcrumbList");
    const article = articles[0] || {};
    const expectedIndexable = isCaseIndexable(item);
    const visible = plainText(page.html);
    const bodyNeedle = plainText(item.description).slice(0, 80);
    const ssrBodyPresent = Boolean(bodyNeedle && visible.includes(bodyNeedle));
    const technicalIssues: string[] = [];
    if (page.status !== 200) technicalIssues.push(`http_${page.status || "error"}`);
    if (title !== `${item.title} | 프로다`) technicalIssues.push("title_mismatch");
    if (h1 !== item.title) technicalIssues.push("h1_mismatch");
    if (metaDescription !== expectedDescription) technicalIssues.push("description_mismatch");
    if (canonical !== url) technicalIssues.push("canonical_mismatch");
    if (expectedIndexable !== robotsIndexable) technicalIssues.push("robots_mismatch");
    if (!ssrBodyPresent) technicalIssues.push("ssr_body_missing");
    if (expectedIndexable !== sitemapUrls.has(url)) technicalIssues.push("sitemap_mismatch");
    if (articles.length !== 1 || article.headline !== item.title || normalizeAbsoluteDocumentUrl(String(article.url || "")) !== url) technicalIssues.push("article_schema_invalid");
    if (breadcrumbs.length !== 1) technicalIssues.push("breadcrumb_schema_invalid");
    if (ogTitle !== `${item.title} | 프로다` || ogDescription !== expectedDescription || ogUrl !== url || ogImage !== expectedFeatured) technicalIssues.push("open_graph_mismatch");
    if (!(inbound.get(url) || 0)) technicalIssues.push("no_internal_inbound_link");
    if (!(galleryListInbound.get(url) || 0)) technicalIssues.push("missing_gallery_list_href");

    const related = cases.filter((other) => other.id !== item.id);
    const nearest = related
      .map((other) => ({ id: other.id, score: jaccard(tri.get(item.id)!, tri.get(other.id)!) }))
      .sort((a, b) => b.score - a.score)[0];
    const qualityWarnings = (source?.issue || []).filter(
      (value) => !["id_file_mismatch", "invalid_status", "duplicate_id"].includes(value)
    );
    if (item.description.trim().length < 80) qualityWarnings.push("description_under_80");
    if (nearest && nearest.score >= 0.8) qualityWarnings.push(`near_duplicate_${nearest.id}_${nearest.score.toFixed(3)}`);

    const urlQueue = queueEntries.filter((entry) => normalizeAbsoluteDocumentUrl(String(entry.url || "")) === url);
    const lastQueue = urlQueue[urlQueue.length - 1];
    const submitted = newest(urlQueue.filter((entry) => entry.status === "submitted"), "submittedToIndexNowAt");
    const submissionStatus = String(lastQueue?.status || "not_submitted");
    const urlObservations = observations.filter((entry) => normalizeAbsoluteDocumentUrl(String(entry.url || "")) === url);
    const naver = newest(urlObservations.filter((entry) => entry.engine === "naver"), "lastIndexCheckAt");
    const google = newest(urlObservations.filter((entry) => entry.engine === "google"), "lastIndexCheckAt");
    const naverSearch = newest(urlObservations.filter((entry) => entry.engine === "naver"), "lastSearchCheckAt");
    const googleSearch = newest(urlObservations.filter((entry) => entry.engine === "google"), "lastSearchCheckAt");
    const search = newest(urlObservations, "lastSearchCheckAt");
    const indexStatus =
      naver?.indexStatus === "indexed" || google?.indexStatus === "indexed" || sourceRaw.indexStatus === "confirmed"
        ? "confirmed"
        : "unknown";

    return {
      id: item.id,
      slug: item.id,
      title: item.title,
      description: item.description,
      region: item.region,
      item: item.item,
      publishStatus: item.status === "draft" ? "draft" : "published",
      publishedAt: item.publishedAt || caseRegisteredDate(item) || "",
      updatedAt: item.updatedAt || "",
      url,
      featuredImage: expectedFeatured,
      bodyLength: item.description.trim().length,
      indexStatusFieldExists: Object.hasOwn(sourceRaw, "indexStatus"),
      httpStatus: page.status,
      titleValid: title === `${item.title} | 프로다`,
      descriptionValid: metaDescription === expectedDescription,
      h1Valid: h1 === item.title,
      canonicalValid: canonical === url,
      robotsIndexable,
      ssrBodyPresent,
      sitemapIncluded: sitemapUrls.has(url),
      breadcrumbValid: breadcrumbs.length === 1,
      articleValid: articles.length === 1 && article.headline === item.title && normalizeAbsoluteDocumentUrl(String(article.url || "")) === url,
      openGraphValid: ogTitle === `${item.title} | 프로다` && ogDescription === expectedDescription && ogUrl === url && ogImage === expectedFeatured,
      internalLinks: inbound.get(url) || 0,
      galleryListLinks: galleryListInbound.get(url) || 0,
      outboundLinks: hrefsOf(page.html).length,
      indexSubmissionStatus: submissionStatus,
      submittedToIndexNowAt: String(submitted?.submittedToIndexNowAt || ""),
      indexStatus,
      naverIndexStatus: naver?.indexStatus || "unknown",
      googleIndexStatus: google?.indexStatus || "unknown",
      lastIndexCheckAt: String(newest(urlObservations, "lastIndexCheckAt")?.lastIndexCheckAt || ""),
      naverExactTitleStatus: naverSearch?.exactTitleStatus || "unknown",
      googleExactTitleStatus: googleSearch?.exactTitleStatus || "unknown",
      naverKeywordStatus: naverSearch?.keywordStatus || "unknown",
      googleKeywordStatus: googleSearch?.keywordStatus || "unknown",
      exactTitleStatus: search?.exactTitleStatus || "unknown",
      keywordStatus: search?.keywordStatus || "unknown",
      lastSearchEngine: search?.engine || "",
      lastSearchQuery: search?.query || "",
      lastSearchCheckAt: String(search?.lastSearchCheckAt || ""),
      technicalIndexability: technicalIssues.length ? "FAIL" : expectedIndexable ? "PASS" : "NOINDEX_EXPECTED",
      contentQualityWarning: qualityWarnings.join(";"),
      lastCheckedAt: checkedAt,
      issue: [...technicalIssues, ...(page.error ? [page.error] : [])].join(";"),
    };
  });

  const headers = Object.keys(rows[0] || {});
  const csv = [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header as keyof typeof row])).join(","))].join("\n") + "\n";
  const failures = rows.filter((row) => row.technicalIndexability === "FAIL");
  const noindex = rows.filter((row) => row.technicalIndexability === "NOINDEX_EXPECTED");
  const warnings = rows.filter((row) => row.contentQualityWarning);

  let priority = rows.slice(0, 10);
  const hasSameRegionPair = priority.some((row, index) => priority.slice(index + 1).some((other) => other.region === row.region));
  if (!hasSameRegionPair) {
    const pair = rows
      .map((row) => [row, rows.find((other) => other.id !== row.id && other.region === row.region)] as const)
      .find(([, other]) => Boolean(other));
    if (pair?.[1]) {
      const pairIds = new Set([pair[0].id, pair[1].id]);
      priority = [...rows.filter((row) => !pairIds.has(row.id)).slice(0, 8), pair[0], pair[1]];
    }
  }

  const md = [
    "# 시공사례 개별 글 색인 추적",
    "",
    `- 확인 시각: ${checkedAt}`,
    `- HTTP 기준: ${baseUrl}`,
    `- 원본 JSON: ${raw.byId.size}건 · 공개 상세: ${rows.length}건 · 기술 PASS: ${rows.length - failures.length - noindex.length}건 · 의도적 noindex: ${noindex.length}건 · FAIL: ${failures.length}건`,
    `- cases sitemap: HTTP ${sitemapPage.status} · ${sitemapUrls.size} URL`,
    `- 존재하지 않는 gallery slug: HTTP ${missingPage.status} (${missingPage.status === 404 ? "PASS" : "FAIL"})`,
    `- 내부링크 없는 사례: ${rows.filter((row) => row.internalLinks === 0).length}건`,
    `- 콘텐츠 품질 경고: ${warnings.length}건 (기술 색인 상태와 분리; 자동 noindex/delete 아님)`,
    "",
    "## 상태 해석 — 서로 추정하지 않음",
    "",
    "- A 기술적으로 indexable: HTTP·고유 title/H1/description·self-canonical·robots·SSR·schema·내부링크 정합.",
    "- B sitemap 포함: `/sitemaps/cases.xml`에 해당 상세 URL이 실제 존재.",
    "- C 제출됨: IndexNow API 접수 기록일 뿐 색인 완료가 아님.",
    "- D 실제 색인 확인: Naver Search Advisor 또는 Google Search Console URL 검사 근거가 있을 때만 기록.",
    "- E exact-title 노출: 참고 지표이며 안 보인다고 미색인으로 단정하지 않음.",
    "- F 일반 키워드 노출: 순위·검색 맥락에 따라 달라지며 색인 상태와 별개.",
    "",
    "## 확인 우선 — 최근 발행 10건",
    "",
    "| 제목 | URL | 발행 | 기술 | sitemap | IndexNow | 실제 색인 | 전체 제목 | 일반 검색 | 이슈 |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---|",
    ...priority.map((row) =>
      `| ${mdCell(row.title)} | ${mdCell(row.url)} | ${mdCell(row.publishedAt)} | ${row.technicalIndexability} | ${yn(row.sitemapIncluded)} | ${mdCell(row.indexSubmissionStatus)} | ${mdCell(row.indexStatus)} | ${mdCell(row.exactTitleStatus)} | ${mdCell(row.keywordStatus)} | ${mdCell(row.issue || row.contentQualityWarning)} |`
    ),
    "",
    "## 전수 요약",
    "",
    "| ID | 제목 | 지역·품목 | HTTP | title/H1/canonical | robots | SSR | sitemap | inbound | 제출 | 실제 색인 | 품질 경고 |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ...rows.map((row) =>
      `| ${mdCell(row.id)} | ${mdCell(row.title)} | ${mdCell(`${row.region}·${row.item}`)} | ${row.httpStatus} | ${yn(row.titleValid && row.h1Valid && row.canonicalValid)} | ${yn(row.robotsIndexable)} | ${yn(row.ssrBodyPresent)} | ${yn(row.sitemapIncluded)} | ${row.internalLinks} | ${mdCell(row.indexSubmissionStatus)} | ${mdCell(row.indexStatus)} | ${mdCell(row.contentQualityWarning)} |`
    ),
    "",
    ...(sourceFailures.length ? ["## 원본·런타임 정합 오류", "", ...sourceFailures.map((issue) => `- ${mdCell(issue)}`), ""] : []),
  ].join("\n");

  if (writeReports) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "gallery-index-status.csv"), csv, "utf8");
    fs.writeFileSync(path.join(outputDir, "gallery-index-status.md"), `${md}\n`, "utf8");
  }

  console.log(`[seo:gallery-index] 공개 ${rows.length} · PASS ${rows.length - failures.length - noindex.length} · noindex ${noindex.length} · FAIL ${failures.length}`);
  console.log(`[seo:gallery-index] sitemap ${sitemapUrls.size} · invalid slug ${missingPage.status} · 품질 경고 ${warnings.length}`);
  if (writeReports) console.log(`[seo:gallery-index] ${path.relative(ROOT, outputDir)}/gallery-index-status.{csv,md}`);
  if (failures.length || sitemapPage.status !== 200 || missingPage.status !== 404 || sourceFailures.length) {
    for (const row of failures.slice(0, 10)) console.error(`  ✗ ${row.id}: ${row.issue}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[seo:gallery-index] 오류: ${String((error as Error)?.message || error)}`);
  process.exit(1);
});
