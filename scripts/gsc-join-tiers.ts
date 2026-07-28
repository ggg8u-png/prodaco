// content/gsc/crawled-not-indexed-*.csv 의 URL을 현재 색인 판정(indexabilityFor)과 조인.
// → reports/google-crawled-not-indexed.csv (url, last_crawled, current_tier, indexable_now, reason)
// 실행: node scripts/ts-run.mjs scripts/gsc-join-tiers.ts
import fs from "node:fs";
import path from "node:path";
import { indexabilityFor } from "@/lib/seo/indexability";
import { getKeywordBySlug } from "@/data/keywords";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "content", "gsc", "crawled-not-indexed-2026-07-27.csv");
const OUT = path.join(ROOT, "reports", "google-crawled-not-indexed.csv");

const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/).filter(Boolean).slice(1);
const rows: string[] = ["url,last_crawled,route_type,current_tier,indexable_now,in_sitemap_now,reason"];
const stats: Record<string, number> = {};

for (const line of lines) {
  const [url, lastCrawl] = line.split(",");
  if (!url) continue;
  let slug = "";
  try {
    slug = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    continue;
  }
  let tier = "static/other";
  let indexable = "";
  let inSitemap = "";
  let reason = "";
  let routeType = "static";
  if (slug && !slug.includes("/")) {
    const k = getKeywordBySlug(slug);
    if (k) {
      const ix = indexabilityFor(k);
      tier = ix.tier;
      indexable = String(ix.indexable);
      inSitemap = String(ix.inSitemap);
      reason = ix.reasons[0] || "";
      routeType = k.type;
    } else if (slug.startsWith("services/")) {
      routeType = "region-hub";
    } else {
      tier = "C(미존재)";
      routeType = "unknown-slug";
    }
  } else if (slug.startsWith("services/")) {
    routeType = "region-hub";
  } else if (slug.startsWith("blog/")) {
    routeType = "blog";
  }
  const key = `${routeType}|tier=${tier}|indexableNow=${indexable || "n/a"}`;
  stats[key] = (stats[key] || 0) + 1;
  rows.push([url, lastCrawl || "", routeType, tier, indexable, inSitemap, `"${reason.replace(/"/g, "'")}"`].join(","));
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, "﻿" + rows.join("\n"), "utf8");
console.log(`rows=${rows.length - 1} → reports/google-crawled-not-indexed.csv`);
console.log(JSON.stringify(stats, null, 1));
