import { posts } from "@/data/posts";
import { blogUrl } from "@/lib/blogUrl";
import { caseUrl, caseDateInfo, indexableCases } from "@/lib/caseDoc";
import settings from "../../../content/settings.json";

// 네이버 서치어드바이저 RSS 제출용 피드. 빌드 타임에 정적 생성(외부 의존 없음).
// content/blog/*.json + content/gallery/*.json → /rss.xml.
//
// 시공사례를 함께 싣는 이유: 운영자가 실제로 자주 발행하는 새 콘텐츠가 시공사례다.
// RSS 는 네이버가 새 글을 발견하는 주 경로라, 블로그만 넣으면 새 사례는 사이트맵
// 재수집만 기다리게 된다. 색인 대상 사례만 넣어 피드와 색인 정책을 일치시킨다.
// 후기는 넣지 않는다 — 기본이 noindex 이고 본문이 짧아 피드에 실을 문서가 아니다.
export const dynamic = "force-static";

interface FeedItem {
  title: string;
  url: string;
  description: string;
  date: string;
  categories: string[];
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET(): Response {
  const feedUrl = `${siteUrl}/rss.xml`;
  const channelTitle = settings.seoTitle || "프로다";
  const channelDesc = settings.seoDescription || "";
  const feed: FeedItem[] = [
    ...posts
      .filter((p) => typeof p.id === "string" && p.id.length > 0)
      .map((p) => ({
        title: p.title,
        url: blogUrl(siteUrl, p.id),
        description: p.excerpt,
        // 발행일은 운영자가 적은 date 를 그대로 쓴다(글을 고쳤다고 새 글로 보이면 안 된다).
        date: p.date,
        categories: p.tags || [],
      })),
    ...indexableCases().map((g) => {
      const { published } = caseDateInfo(g);
      return {
        title: g.title,
        url: caseUrl(siteUrl, g.id),
        description: `${g.region} ${g.item} 시공사례. ${g.description}`.trim(),
        date: published || "",
        categories: [g.region, g.item],
      };
    }),
  ]
    // 날짜가 없는 항목은 피드에서 뺀다(pubDate 없이 내보내면 수집기가 순서를 못 잡는다).
    .filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.date))
    .sort((a, b) => (a.date === b.date ? a.url.localeCompare(b.url) : a.date < b.date ? 1 : -1));

  // 최신 글 날짜를 lastBuildDate 로 — 매 빌드 변경 신호(스팸)를 피함(사이트맵 lastmod 정책과 동일).
  const latest = feed[0]?.date;
  const lastBuild = latest ? new Date(latest).toUTCString() : "";

  const items = feed
    .map((i) => {
      const cats = i.categories
        .filter((t) => typeof t === "string" && t.trim())
        .map((t) => `<category>${xmlEscape(t)}</category>`)
        .join("");
      return `    <item>
      <title>${xmlEscape(i.title)}</title>
      <link>${i.url}</link>
      <guid isPermaLink="true">${i.url}</guid>
      <description>${xmlEscape(i.description)}</description>
      <pubDate>${new Date(i.date).toUTCString()}</pubDate>
      ${cats}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(channelTitle)}</title>
    <link>${siteUrl}</link>
    <description>${xmlEscape(channelDesc)}</description>
    <language>ko</language>${lastBuild ? `\n    <lastBuildDate>${lastBuild}</lastBuildDate>` : ""}
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
