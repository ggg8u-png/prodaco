import { ImageResponse } from "next/og";

// 자체 생성 기본 OG 이미지 (카톡·SNS 공유 썸네일). 빌드 타임에 PNG로 생성되어
// 외부 호스팅이 필요 없다. 한글 폰트 임베드 없이 안전하게 렌더되도록 로마자/숫자만 사용.
// TODO(운영): 실제 시공 사진 기반 디자인 이미지로 교체 권장.
export const alt = "PRODA — Floor Demolition & Sanding, Seoul·Gyeonggi·Incheon";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#16181D",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* 상단 액센트 바 */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 8, background: "#FFD400" }} />
          <div
            style={{
              color: "#FFD400",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 6,
            }}
          >
            SEOUL · GYEONGGI · INCHEON
          </div>
        </div>

        {/* 본문 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-end", color: "#FFFFFF", fontSize: 150, fontWeight: 900, lineHeight: 1 }}>
            PRODA<span style={{ color: "#FFD400" }}>.</span>
          </div>
          <div style={{ color: "#C9CDD4", fontSize: 40, fontWeight: 700, marginTop: 24 }}>
            FLOOR DEMOLITION &amp; SANDING
          </div>
        </div>

        {/* 하단: 경력 + 전화 */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ color: "#8B919B", fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>
            EST. 10YR · METRO AREA
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#FFD400",
              color: "#16181D",
              fontSize: 40,
              fontWeight: 900,
              padding: "14px 28px",
              borderRadius: 4,
            }}
          >
            010-8470-4965
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
