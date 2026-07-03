import { ImageResponse } from "next/og";

// iOS·안드로이드 홈화면 바로가기 아이콘. 빌드 타임에 PNG로 생성(외부 호스팅 불필요).
// 브랜드 마크(PRODA.)와 동일한 톤: 어두운 타일 + 흰 P + 노란 액센트 점. 로마자만 사용.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16181D",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            color: "#FFFFFF",
            fontSize: 120,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          P<span style={{ color: "#FFD400" }}>.</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
