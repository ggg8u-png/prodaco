import { posts } from "@/data/posts";
import settings from "../../../content/settings.json";

// 네이버 서치어드바이저 RSS 제출용 블로그 피드. 빌드 타임에 정적 생성(외부 의존 없음).
// content/blog/*.json → /rss.xml. 사이트맵과 함께 블로그 글 수집·색인 발견을 앞당긴다.
export const dynamic = "force-static";

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
  // 최신 글 날짜를 lastBuildDate 로 — 매 빌드 변경 신호(스팸)를 피함(사이트맵 lastmod 정책과 동일).
  const latest = posts[0]?.date;
  const lastBuild = latest ? new Date(latest).toUTCString() : "";

  const items = posts
    .map((p) => {
      const url = `${siteUrl}/blog/${p.id}`;
      const pubDate = new Date(p.date).toUTCString();
      const cats = (p.tags || [])
        .map((t) => `<category>${xmlEscape(t)}</category>`)
        .join("");
      return `    <item>
      <title>${xmlEscape(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${xmlEscape(p.excerpt)}</description>
      <pubDate>${pubDate}</pubDate>
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
