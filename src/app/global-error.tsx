"use client";
// 루트 레이아웃(Header/Footer 포함)까지 깨졌을 때의 최후 폴백.
// global-error 는 레이아웃을 통째로 대체하므로 <html>/<body> 를 직접 그려야 하고,
// 레이아웃의 CSS·폰트가 없는 상태를 가정해야 한다(그래서 인라인 스타일).
// error.tsx 와 목적은 같다 — 크롤러에게 "Application error" 한 줄 대신 실제 내용을 남긴다.
import { company } from "@/data/company";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, background: "#F7F6F3", color: "#16181D", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 20px" }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "#7B818C" }}>PRODA</p>
          <h1 style={{ margin: "12px 0 0", fontSize: 28, lineHeight: 1.35, fontWeight: 800 }}>
            페이지를 표시하지 못했습니다
          </h1>
          <p style={{ margin: "16px 0 0", fontSize: 15, lineHeight: 1.75, color: "#4A4F58" }}>
            일시적인 오류입니다. 잠시 후 다시 시도해 주세요. 급하시면 아래로 바로 연락 주시면 상담 도와드립니다.
          </p>
          <p style={{ margin: "28px 0 0", display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              onClick={reset}
              style={{ border: 0, borderRadius: 2, background: "#16181D", color: "#fff", padding: "12px 20px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              다시 시도
            </button>
            <a
              href={company.phoneLink}
              style={{ borderRadius: 2, background: "#FFD400", color: "#16181D", padding: "12px 20px", fontSize: 14, fontWeight: 800, textDecoration: "none" }}
            >
              전화 {company.phone}
            </a>
            <a
              href={company.kakaoUrl}
              target="_blank"
              rel="noopener"
              style={{ borderRadius: 2, border: "2px solid rgba(22,24,29,0.15)", background: "#fff", color: "#16181D", padding: "10px 20px", fontSize: 14, fontWeight: 700, textDecoration: "none" }}
            >
              카카오톡 상담
            </a>
          </p>
          <nav style={{ marginTop: 40, borderTop: "1px solid rgba(22,24,29,0.1)", paddingTop: 24 }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#7B818C" }}>바로가기</p>
            {/* global-error 는 라우터 컨텍스트 밖일 수 있어 next/link 대신 <a> 를 쓴다. */}
            {[
              ["/", "홈"],
              ["/services", "지역·품목별 서비스"],
              ["/gallery", "시공 사례"],
              ["/reviews", "고객 후기"],
              ["/faq", "자주 묻는 질문"],
              ["/blog", "정보"],
            ].map(([href, label]) => (
              <a key={href} href={href} style={{ display: "inline-block", marginRight: 20, marginBottom: 8, fontSize: 14, fontWeight: 700, color: "#16181D" }}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </body>
    </html>
  );
}
