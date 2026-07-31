import type { ReactNode } from "react";
import { uploadedImage } from "@/lib/cdnImage";
export { markdownToPlainText } from "@/lib/markdownText";

/**
 * 블로그 본문 렌더러 — CMS(/admin) 의 서식 버튼(굵게·목록·인용·사진)이 만들어내는
 * 마크다운을 사이트 디자인 그대로 그린다. 외부 라이브러리 없이 필요한 문법만 다룬다.
 *
 * 지원 문법
 *   # ~ ####            제목 (h1 은 페이지 제목이므로 h2 로 낮춰 그린다)
 *   **굵게**  *기울임*  `코드`  [링크](주소)
 *   - 항목 / 1. 항목     목록
 *   > 인용
 *   ![설명](사진주소)     사진(설명은 캡션)
 *   | 표 | 머리 |        표
 *   ---                  구분선
 *   문단 안의 줄바꿈은 그대로 줄바꿈으로 보인다(운영자가 엔터 친 대로).
 */

const H2_CLASS = "text-lg font-black mt-10 mb-3 pt-6 border-t border-gray-100";
const H3_CLASS = "text-base font-bold mt-6 mb-2";
const H4_CLASS = "text-sm font-bold mt-5 mb-2 text-[#3A4048]";
const P_CLASS = "text-gray-700 text-sm leading-relaxed";
const LINK_CLASS = "font-semibold text-[#9A8A2E] underline underline-offset-2 hover:text-[#16181D]";

const isBlank = (l: string) => l.trim() === "";
const HEADING_RE = /^(#{1,4})\s+(.*)$/;
const UL_RE = /^\s*[-*•]\s+(.*)$/;
const OL_RE = /^\s*\d{1,2}[.)]\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const HR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const IMAGE_RE = /^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/;
const TABLE_ROW_RE = /^\s*\|(.+)\|\s*$/;
const TABLE_DIVIDER_RE = /^\s*\|[\s:|-]+\|\s*$/;

/** 어떤 블록 시작 줄인가 — 문단을 어디서 끊을지 판단할 때 쓴다. */
function startsBlock(line: string): boolean {
  return (
    HEADING_RE.test(line) ||
    UL_RE.test(line) ||
    OL_RE.test(line) ||
    QUOTE_RE.test(line) ||
    HR_RE.test(line) ||
    IMAGE_RE.test(line) ||
    TABLE_ROW_RE.test(line)
  );
}

// ─── 인라인(굵게·기울임·코드·링크) ──────────────────────────────────────────────
const INLINE_RE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  let i = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyPrefix}-i${i++}`;
    if (token.startsWith("**") || token.startsWith("__")) {
      out.push(<strong key={key} className="font-bold text-[#16181D]">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      out.push(
        <code key={key} className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-[13px] text-[#16181D]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const cut = token.indexOf("](");
      const label = token.slice(1, cut);
      const href = token.slice(cut + 2, -1);
      const external = /^https?:\/\//.test(href) && !href.includes("prodaco.kr");
      out.push(
        <a
          key={key}
          href={href}
          className={LINK_CLASS}
          {...(external ? { target: "_blank", rel: "noopener nofollow" } : {})}
        >
          {label}
        </a>
      );
    } else {
      out.push(<em key={key} className="italic">{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** 문단 안의 줄바꿈을 <br> 로 살려서 렌더 (운영자가 엔터 친 대로 보이게). */
function renderLines(lines: string[], keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) out.push(<br key={`${keyPrefix}-br${idx}`} />);
    out.push(...renderInline(line.replace(/\s+$/, ""), `${keyPrefix}-l${idx}`));
  });
  return out;
}

function renderImage(alt: string, src: string, key: string): ReactNode {
  return (
    <figure key={key} className="my-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={uploadedImage(src, 1200)}
        alt={alt || "바닥재 철거 현장 사진"}
        loading="lazy"
        decoding="async"
        className="w-full rounded-sm border border-gray-200 bg-gray-100"
      />
      {alt && <figcaption className="mt-2 text-center text-xs text-gray-500">{alt}</figcaption>}
    </figure>
  );
}

/** 마크다운 본문 → 리액트 노드 배열. */
export function renderMarkdown(markdown: string): ReactNode[] {
  const lines = (markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let n = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i += 1;
      continue;
    }

    const key = `b${n++}`;

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const body = renderInline(heading[2], key);
      if (level <= 2) blocks.push(<h2 key={key} className={H2_CLASS}>{body}</h2>);
      else if (level === 3) blocks.push(<h3 key={key} className={H3_CLASS}>{body}</h3>);
      else blocks.push(<h4 key={key} className={H4_CLASS}>{body}</h4>);
      i += 1;
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push(<hr key={key} className="my-8 border-gray-200" />);
      i += 1;
      continue;
    }

    const image = line.match(IMAGE_RE);
    if (image) {
      blocks.push(renderImage(image[1], image[2], key));
      i += 1;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        items.push((lines[i].match(QUOTE_RE) as RegExpMatchArray)[1]);
        i += 1;
      }
      blocks.push(
        <blockquote key={key} className="my-4 border-l-[3px] border-[#FFD400] pl-4 text-sm italic text-gray-600">
          {renderLines(items, key)}
        </blockquote>
      );
      continue;
    }

    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL_RE.test(lines[i])) {
        items.push((lines[i].match(UL_RE) as RegExpMatchArray)[1]);
        i += 1;
      }
      blocks.push(
        <ul key={key} className="my-4 space-y-2 border-l-2 border-gray-100 pl-4">
          {items.map((item, j) => (
            <li key={j} className="text-sm text-gray-700">{renderInline(item, `${key}-${j}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (OL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL_RE.test(lines[i])) {
        items.push((lines[i].match(OL_RE) as RegExpMatchArray)[1]);
        i += 1;
      }
      blocks.push(
        <ol key={key} className="my-4 space-y-2">
          {items.map((item, j) => (
            <li key={j} className="flex gap-3 text-sm text-gray-700">
              <span className="shrink-0 font-bold text-[#9A8A2E]">{j + 1}.</span>
              <span>{renderInline(item, `${key}-${j}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (TABLE_ROW_RE.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && TABLE_ROW_RE.test(lines[i])) {
        if (!TABLE_DIVIDER_RE.test(lines[i])) {
          const cells = (lines[i].match(TABLE_ROW_RE) as RegExpMatchArray)[1]
            .split("|")
            .map((c) => c.trim());
          rows.push(cells);
        }
        i += 1;
      }
      if (rows.length > 0) {
        const [head, ...body] = rows;
        blocks.push(
          <div key={key} className="my-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#16181D] text-white">
                  {head.map((c, j) => (
                    <th key={j} className="border border-gray-200 px-3 py-2 text-left font-bold">
                      {renderInline(c, `${key}-h${j}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, r) => (
                  <tr key={r} className="odd:bg-white even:bg-[#F7F6F3]">
                    {row.map((c, j) => (
                      <td key={j} className="border border-gray-200 px-3 py-2 text-gray-700">
                        {renderInline(c, `${key}-${r}-${j}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // 그 밖에는 문단 — 빈 줄이나 다른 블록이 시작될 때까지 모은다.
    const para: string[] = [];
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    if (para.length > 0) {
      blocks.push(<p key={key} className={P_CLASS}>{renderLines(para, key)}</p>);
    } else {
      // 안전장치 — 어떤 규칙에도 걸리지 않는 줄(무한 루프 방지)
      blocks.push(<p key={key} className={P_CLASS}>{renderInline(lines[i], key)}</p>);
      i += 1;
    }
  }

  return blocks;
}
