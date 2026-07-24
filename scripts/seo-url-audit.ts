// =============================================================================
// 전체 SEO URL 감사 — 사이트가 내보내는 모든 SEO 대상 URL 의 색인 상태 인벤토리.
//   실행: npm run seo:urls   (node scripts/ts-run.mjs scripts/seo-url-audit.ts)
//   출력: reports/seo-url-audit.csv / reports/seo-url-audit.json
//         reports/seo-redirect-plan.csv  (통합 후보 제안 — 자동 적용하지 않음)
//
// 실제 서비스 코드(키워드·본문·색인 판정 모듈)를 그대로 불러 판정하므로,
// 리포트와 실제 페이지 동작이 어긋날 수 없다(단일 출처: src/lib/seo/indexability.ts).
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { getKeywords } from "@/data/keywords";
import { indexabilityFor, siteUrl, keywordUrl, regionHubUrl } from "@/lib/seo/indexability";
import { uniqueTitle, uniqueDescription, pickFaqs } from "@/lib/seo";
import { getContentForKeyword } from "@/lib/content";
import { galleryItems } from "@/data/gallery";
import { posts } from "@/data/posts";
import { company } from "@/data/company";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "reports");

interface UrlRow {
  url: string;
  routeType: string; // core | region-hub | keyword:<type> | blog
  region: string;
  service: string;
  title: string;
  description: string;
  canonical: string;
  robots: string; // "index,follow" | "noindex,follow"
  inSitemap: boolean;
  expectedStatus: number;
  tier: string;
  reasons: string;
  hasRealCase: boolean; // 지역+품목 일치 검증 사례 존재
  regionPhotoCount: number; // 해당 지역 시공사례 수(사진 근거)
  uniqueFaqCount: number;
  uniqueBlockCount: number; // 본문 "## " 섹션 수
  bodyChars: number;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))];
  fs.writeFileSync(file, "﻿" + lines.join("\n"), "utf8"); // BOM: 엑셀 한글 호환
}

function main(): void {
  fs.mkdirSync(OUT, { recursive: true });
  const keywords = getKeywords();
  const verifiedCaseKeys = new Set(
    galleryItems.filter((c) => c.region && c.item && c.verified !== false).map((c) => `${c.region}|${c.item}`)
  );
  const regionPhotoCount = new Map<string, number>();
  for (const c of galleryItems) regionPhotoCount.set(c.region, (regionPhotoCount.get(c.region) || 0) + 1);

  const rows: UrlRow[] = [];

  // ── 핵심 정적 페이지 ─────────────────────────────────────────────────────────
  const core: Array<[string, string, string]> = [
    ["/", "홈", "수도권 바닥재 철거·바닥 샌딩 전문"],
    ["/services", "서비스 안내", "지역·품목별 서비스 디렉터리"],
    ["/gallery", "시공 갤러리", "철거 전후·작업 현장"],
    ["/reviews", "고객 후기", "실제 후기·상담 사례"],
    ["/faq", "자주 묻는 질문", "철거 전 확인 사항"],
    ["/blog", "정보", "바닥재 철거 가이드"],
  ];
  for (const [p, t, d] of core) {
    rows.push({
      url: p === "/" ? siteUrl : `${siteUrl}${p}`,
      routeType: "core",
      region: "",
      service: "",
      title: t,
      description: d,
      canonical: p === "/" ? siteUrl : `${siteUrl}${p}`,
      robots: "index,follow",
      inSitemap: true,
      expectedStatus: 200,
      tier: "A",
      reasons: "핵심 정적 페이지",
      hasRealCase: false,
      regionPhotoCount: 0,
      uniqueFaqCount: 0,
      uniqueBlockCount: 0,
      bodyChars: 0,
    });
  }

  // ── 지역 허브 ────────────────────────────────────────────────────────────────
  const hubRegions = [...new Set(keywords.filter((k) => k.type === "region-item" && k.region).map((k) => k.region as string))];
  for (const region of hubRegions) {
    rows.push({
      url: regionHubUrl(region),
      routeType: "region-hub",
      region,
      service: "",
      title: `${region} 바닥재 철거 · 마루/타일/장판 전문`,
      description: `${region} 바닥재 철거 허브(품목 링크·비용표·FAQ)`,
      canonical: regionHubUrl(region),
      robots: "index,follow",
      inSitemap: true,
      expectedStatus: 200,
      tier: "A",
      reasons: "지역 허브(region-item 존재 지역만 생성)",
      hasRealCase: false,
      regionPhotoCount: regionPhotoCount.get(region) || 0,
      uniqueFaqCount: 4,
      uniqueBlockCount: 0,
      bodyChars: 0,
    });
  }

  // ── 키워드(지역×품목·롱테일) 페이지 ──────────────────────────────────────────
  for (const k of keywords) {
    const ix = indexabilityFor(k);
    const body = getContentForKeyword(k);
    rows.push({
      url: keywordUrl(k.slug),
      routeType: `keyword:${k.type}`,
      region: k.region || "",
      service: k.item || "",
      title: uniqueTitle(k),
      description: uniqueDescription(k, company.phone),
      canonical: ix.canonicalUrl,
      robots: ix.indexable ? "index,follow" : "noindex,follow",
      inSitemap: ix.inSitemap,
      expectedStatus: 200,
      tier: ix.tier,
      reasons: ix.reasons.join(" | "),
      hasRealCase: !!(k.region && k.item && verifiedCaseKeys.has(`${k.region}|${k.item}`)),
      regionPhotoCount: k.region ? regionPhotoCount.get(k.region) || 0 : 0,
      uniqueFaqCount: pickFaqs(k, 5).length,
      uniqueBlockCount: (body.match(/^## /gm) || []).length,
      bodyChars: body.length,
    });
  }

  // ── 블로그 ───────────────────────────────────────────────────────────────────
  for (const p of posts) {
    if (!p.id) continue;
    rows.push({
      url: `${siteUrl}/blog/${p.id}`,
      routeType: "blog",
      region: "",
      service: "",
      title: p.title || p.id,
      description: (p.excerpt || "").slice(0, 120),
      canonical: `${siteUrl}/blog/${p.id}`,
      robots: "index,follow",
      inSitemap: true,
      expectedStatus: 200,
      tier: "A",
      reasons: "실제 작성 가이드 콘텐츠",
      hasRealCase: false,
      regionPhotoCount: 0,
      uniqueFaqCount: 0,
      uniqueBlockCount: 0,
      bodyChars: (p.content || "").length,
    });
  }

  writeCsv(path.join(OUT, "seo-url-audit.csv"), rows as unknown as Record<string, unknown>[]);
  fs.writeFileSync(path.join(OUT, "seo-url-audit.json"), JSON.stringify(rows, null, 2), "utf8");

  // ── 리디렉션·통합 제안(자동 적용 금지 — 검토용) ──────────────────────────────
  interface RedirectRow {
    from: string;
    to: string;
    status: number;
    applied: string; // yes | proposal
    reason: string;
  }
  const plan: RedirectRow[] = [
    { from: "http://prodaco.kr/*", to: "https://prodaco.kr/:splat", status: 301, applied: "yes(netlify.toml)", reason: "프로토콜 통합 — 단일 홉" },
    { from: "http://www.prodaco.kr/*", to: "https://prodaco.kr/:splat", status: 301, applied: "yes(netlify.toml)", reason: "www+http 통합 — 단일 홉" },
    { from: "https://www.prodaco.kr/*", to: "https://prodaco.kr/:splat", status: 301, applied: "yes(netlify.toml)", reason: "www 통합 — 단일 홉" },
  ];
  // 동의어 꼬리말·지역 허브 통합 — 현행은 canonical 통합(URL 유지). 명백 중복이라
  // 완전 제거를 원할 때만 301 로 전환하라는 제안 목록.
  for (const k of keywords) {
    const ix = indexabilityFor(k);
    if (ix.tier === "B" && ix.indexable && ix.canonicalUrl !== keywordUrl(k.slug)) {
      plan.push({
        from: `/${k.slug}`,
        to: decodeURIComponent(ix.canonicalUrl.replace(siteUrl, "")),
        status: 301,
        applied: "proposal(현행: canonical 통합)",
        reason: ix.reasons[0] || "중복 변형",
      });
    }
  }
  // 검색 수요·사례가 약한 품목의 지역 조합 — 품목 허브(비용 페이지)·지역 허브로 통합 검토.
  const WEAK_ITEMS = new Set(["데코륨철거", "륨장판철거", "우레탄철거", "디럭스타일철거", "폴리싱타일철거", "바닥타일철거"]);
  const slugSet = new Set(keywords.map((k) => k.slug));
  for (const k of keywords) {
    if (k.type !== "region-item" || !k.item || !WEAK_ITEMS.has(k.item) || !k.region) continue;
    const itemCostSlug = `${k.item}-비용`;
    const target = slugSet.has(itemCostSlug) ? `/${itemCostSlug}` : `/services/${k.region}`;
    plan.push({
      from: `/${k.slug}`,
      to: target,
      status: 301,
      applied: "proposal(검토 필요 — 실제 유입 확인 후)",
      reason: "검색 수요·실사례가 약한 품목 조합 — 품목/지역 허브 통합 후보",
    });
  }
  writeCsv(path.join(OUT, "seo-redirect-plan.csv"), plan as unknown as Record<string, unknown>[]);

  // ── 요약 ─────────────────────────────────────────────────────────────────────
  const byTier = { A: 0, B: 0, C: 0 } as Record<string, number>;
  let indexable = 0, noindex = 0, inSitemap = 0;
  for (const r of rows) {
    byTier[r.tier] = (byTier[r.tier] || 0) + 1;
    if (r.robots.startsWith("index")) indexable++; else noindex++;
    if (r.inSitemap) inSitemap++;
  }
  console.log(`[seo:urls] URL ${rows.length}개 감사 완료`);
  console.log(`  Tier A ${byTier.A} · Tier B ${byTier.B} · Tier C ${byTier.C || 0}`);
  console.log(`  robots index ${indexable} · noindex ${noindex} · 사이트맵 포함 ${inSitemap}`);
  console.log(`  → reports/seo-url-audit.csv · seo-url-audit.json · seo-redirect-plan.csv`);
}

main();
