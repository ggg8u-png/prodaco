// 목록 페이지 하단 페이지 이동 — 서버 컴포넌트(실제 <a href>).
// 페이지가 하나뿐이면 아무것도 그리지 않는다.
import Link from "next/link";
import { pageHref, type Paged } from "@/lib/pagination";

export default function Pagination<T>({ paged, label }: { paged: Paged<T>; label: string }) {
  if (paged.totalPages <= 1) return null;
  const numbers = Array.from({ length: paged.totalPages }, (_, i) => i + 1);
  return (
    <nav aria-label={label} className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {paged.prevHref && (
        <Link
          href={paged.prevHref}
          rel="prev"
          className="border border-gray-300 bg-white px-3.5 py-2 text-sm font-bold text-[#16181D] transition-colors hover:border-[#9A8A2E] hover:text-[#9A8A2E]"
        >
          ← 이전
        </Link>
      )}
      {numbers.map((n) =>
        n === paged.page ? (
          <span
            key={n}
            aria-current="page"
            className="border border-[#16181D] bg-[#16181D] px-3.5 py-2 text-sm font-bold text-white"
          >
            {n}
          </span>
        ) : (
          <Link
            key={n}
            href={pageHref(paged.basePath, n)}
            className="border border-gray-300 bg-white px-3.5 py-2 text-sm font-bold text-[#16181D] transition-colors hover:border-[#9A8A2E] hover:text-[#9A8A2E]"
          >
            {n}
          </Link>
        )
      )}
      {paged.nextHref && (
        <Link
          href={paged.nextHref}
          rel="next"
          className="border border-gray-300 bg-white px-3.5 py-2 text-sm font-bold text-[#16181D] transition-colors hover:border-[#9A8A2E] hover:text-[#9A8A2E]"
        >
          다음 →
        </Link>
      )}
    </nav>
  );
}
