#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
};
const BASE = (valueAfter("--base") || "http://127.0.0.1:3000").replace(/\/$/, "");
const OUT = path.join(process.cwd(), "reports");

const decodePath = (value) => {
  try { return decodeURIComponent(new URL(value, BASE).pathname); }
  catch { return new URL(value, BASE).pathname; }
};
const normalizedPath = (value) => {
  const decoded = decodePath(value).replace(/\/+$/, "");
  return decoded || "/";
};
const xmlLocations = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

async function sitemapPaths() {
  const indexResponse = await fetch(`${BASE}/sitemap.xml`);
  if (!indexResponse.ok) throw new Error(`sitemap.xml HTTP ${indexResponse.status}`);
  const indexXml = await indexResponse.text();
  const locations = xmlLocations(indexXml);
  const sitemapLocations = locations.filter((location) => normalizedPath(location).endsWith(".xml"));
  const urls = sitemapLocations.length ? [] : locations;
  for (const location of sitemapLocations) {
    const response = await fetch(`${BASE}${new URL(location).pathname}`);
    if (!response.ok) throw new Error(`${new URL(location).pathname} HTTP ${response.status}`);
    urls.push(...xmlLocations(await response.text()));
  }
  return new Set(urls.map(normalizedPath));
}

const stripTags = (value) => value
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&(?:nbsp|amp|quot|#39);/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const attr = (html, tag, key, value, wanted) => {
  const tags = html.match(new RegExp(`<${tag}\\b[^>]*>`, "gi")) || [];
  for (const candidate of tags) {
    const has = candidate.match(new RegExp(`${key}=["']([^"']*)["']`, "i"));
    if (!has || has[1].toLowerCase() !== value.toLowerCase()) continue;
    return candidate.match(new RegExp(`${wanted}=["']([^"']*)["']`, "i"))?.[1] || "";
  }
  return "";
};
const countTags = (html, tag, key, value) => (html.match(new RegExp(`<${tag}\\b(?=[^>]*${key}=["']${value}["'])[^>]*>`, "gi")) || []).length;

function inspectJsonLd(html) {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let valid = true;
  let breadcrumbs = 0;
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (value["@type"] === "BreadcrumbList") breadcrumbs++;
    Object.values(value).forEach(walk);
  };
  for (const block of blocks) {
    try { walk(JSON.parse(block[1].replace(/&quot;/g, '"'))); }
    catch { valid = false; }
  }
  return { count: blocks.length, valid, breadcrumbs };
}

async function inspectRoute(route, kind, sitemap) {
  const response = await fetch(`${BASE}${encodeURI(route)}`, { redirect: "follow" });
  const html = await response.text();
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const jsonLd = inspectJsonLd(html);
  const canonical = attr(html, "link", "rel", "canonical", "href");
  const canonicalCount = countTags(html, "link", "rel", "canonical");
  const robots = attr(html, "meta", "name", "robots", "content") || "(default index,follow)";
  const robotsCount = countTags(html, "meta", "name", "robots");
  const description = attr(html, "meta", "name", "description", "content");
  const ogImage = attr(html, "meta", "property", "og:image", "content");
  const bodyTextLength = stripTags(html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html).length;
  const internalLinks = [...html.matchAll(/<a\b[^>]*href=["'](\/[^"'#?]*)/gi)].length;
  const cta = /href=["'](?:tel:|sms:|https:\/\/open\.kakao\.com\/)/i.test(html);
  const finalPath = normalizedPath(response.url);
  const included = sitemap.has(normalizedPath(route));
  const isMissing = kind === "404";
  const failures = [];
  if (isMissing) {
    if (response.status !== 404) failures.push(`expected 404, got ${response.status}`);
  } else {
    if (!response.ok) failures.push(`HTTP ${response.status}`);
    if (finalPath !== normalizedPath(route)) failures.push(`final URL ${finalPath}`);
    if (!title) failures.push("missing title");
    if (h1s.length !== 1) failures.push(`H1 x${h1s.length}`);
    if (!description) failures.push("missing description");
    if (canonicalCount !== 1) failures.push(`canonical x${canonicalCount}`);
    if (canonical && normalizedPath(canonical) !== normalizedPath(route)) failures.push(`canonical ${normalizedPath(canonical)}`);
    if (robotsCount > 1) failures.push(`robots x${robotsCount}`);
    if (bodyTextLength < 200) failures.push(`SSR text ${bodyTextLength}`);
    if (!jsonLd.valid) failures.push("invalid JSON-LD");
    if (jsonLd.breadcrumbs > 1) failures.push(`BreadcrumbList x${jsonLd.breadcrumbs}`);
    if (!ogImage) failures.push("missing og:image");
    if (!included) failures.push("not in sitemap");
    if (!internalLinks) failures.push("no internal links");
    if (!cta) failures.push("missing CTA");
  }
  return {
    kind, route, status: response.status, finalUrl: response.url, title,
    h1: stripTags(h1s[0]?.[1] || ""), h1Count: h1s.length, canonical,
    canonicalCount, robots, robotsCount, description, bodyTextLength,
    jsonLdCount: jsonLd.count, jsonLdValid: jsonLd.valid,
    breadcrumbCount: jsonLd.breadcrumbs, ogImage, sitemapIncluded: included,
    internalLinks, cta, result: failures.length ? "FAIL" : "PASS", failures,
  };
}

function take(values, count) { return values.slice(0, count); }

async function main() {
  const sitemap = await sitemapPaths();
  const all = [...sitemap].sort((a, b) => a.localeCompare(b, "ko"));
  const core = ["/", "/services", "/faq", "/reviews", "/gallery", "/blog"];
  const gallery = take(all.filter((value) => /^\/gallery\/[^/]+$/.test(value)), 5);
  const blog = take(all.filter((value) => /^\/blog\/[^/]+$/.test(value)), 5);
  const regions = take(all.filter((value) => /^\/services\/[^/]+$/.test(value)), 5);
  const excluded = new Set(["/services", "/faq", "/reviews", "/gallery", "/blog", "/"]);
  const combos = take(all.filter((value) => /^\/[^/]+$/.test(value) && !excluded.has(value)), 10);
  const missing = [
    "/gallery/__stabilization-missing-case__",
    "/blog/__stabilization-missing-post__",
    "/services/__stabilization-missing-region__",
    "/__stabilization-missing-page__",
    "/존재하지-않는-안정화-주소",
  ];
  if ([gallery, blog, regions, combos].some((values, index) => values.length < [5, 5, 5, 10][index])) {
    throw new Error(`표본 부족: gallery ${gallery.length}, blog ${blog.length}, regions ${regions.length}, combos ${combos.length}`);
  }
  const targets = [
    ...core.map((route) => [route, "core"]),
    ...gallery.map((route) => [route, "gallery"]),
    ...blog.map((route) => [route, "blog"]),
    ...regions.map((route) => [route, "region"]),
    ...combos.map((route) => [route, "combo"]),
    ...missing.map((route) => [route, "404"]),
  ];
  const rows = [];
  for (const [route, kind] of targets) rows.push(await inspectRoute(route, kind, sitemap));

  const duplicateTitles = new Map();
  for (const row of rows.filter((item) => item.kind !== "404")) {
    duplicateTitles.set(row.title, [...(duplicateTitles.get(row.title) || []), row.route]);
  }
  for (const routes of duplicateTitles.values()) {
    if (routes.length < 2) continue;
    for (const row of rows.filter((item) => routes.includes(item.route))) {
      row.result = "FAIL";
      row.failures.push(`duplicate title: ${routes.join(", ")}`);
    }
  }

  fs.mkdirSync(OUT, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), base: BASE, sitemapUrls: sitemap.size, rows };
  fs.writeFileSync(path.join(OUT, "stabilization-route-smoke.json"), `${JSON.stringify(report, null, 2)}\n`);
  const markdown = [
    "# Stabilization Route Smoke Test", "",
    `- Base: ${BASE}`,
    `- Sitemap URLs: ${sitemap.size}`,
    `- Result: ${rows.filter((row) => row.result === "PASS").length}/${rows.length} PASS`, "",
    "| kind | route | HTTP | H1 | canonical | robots | SSR chars | JSON-LD | Breadcrumb | OG | sitemap | links | CTA | result |",
    "|---|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---|",
    ...rows.map((row) => `| ${row.kind} | ${row.route} | ${row.status} | ${row.h1Count} | ${row.canonicalCount} | ${row.robots} | ${row.bodyTextLength} | ${row.jsonLdValid ? row.jsonLdCount : "INVALID"} | ${row.breadcrumbCount} | ${row.ogImage ? "O" : "X"} | ${row.sitemapIncluded ? "O" : "X"} | ${row.internalLinks} | ${row.cta ? "O" : "X"} | ${row.result}${row.failures.length ? `: ${row.failures.join("; ")}` : ""} |`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "stabilization-route-smoke.md"), markdown);
  const failed = rows.filter((row) => row.result === "FAIL");
  console.log(`[test:routes] ${rows.length - failed.length}/${rows.length} PASS · sitemap ${sitemap.size}`);
  for (const row of failed) console.error(`  ✗ ${row.route}: ${row.failures.join("; ")}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(`[test:routes] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
