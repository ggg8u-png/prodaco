"use client";
import { useEffect, useState } from "react";

interface Props {
  src: string;
  alt: string;
  label?: string;
  className?: string;
  priority?: boolean; // LCP 대상(히어로 등)은 즉시 로드
}

// 드라이브 URL(lh3 또는 thumbnail)에서 파일 ID 추출
function driveId(url: string): string | null {
  const m = url.match(/googleusercontent\.com\/d\/([^=/?]+)/) || url.match(/[?&]id=([^&]+)/);
  return m ? m[1] : null;
}

// 시공 사진 표시 컴포넌트.
// 1) lh3(구글 이미지 CDN) URL로 우선 로드 → 2) 실패 시 drive thumbnail로 자동 폴백 →
// 3) 그래도 실패하면 브랜드 톤 '시공 사진 준비 중' 플레이스홀더.
export default function GalleryImage({ src, alt, label, className = "", priority = false }: Props) {
  const [current, setCurrent] = useState(src);
  const [triedFallback, setTriedFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  // src prop이 바뀌면 상태 초기화
  useEffect(() => {
    setCurrent(src);
    setTriedFallback(false);
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div className={`relative flex flex-col items-center justify-center gap-1 overflow-hidden bg-[#1B1E24] text-center ${className}`}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ background: "repeating-linear-gradient(135deg,#FFD400 0 9px,transparent 9px 18px)" }}
        />
        <span className="font-mono-pd text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#FFD400]">PRODA</span>
        {label && <span className="text-[11px] font-semibold text-[#C7CBD2]">{label}</span>}
        <span className="text-[11px] text-[#7B818C]">시공 사진 준비 중</span>
      </div>
    );
  }

  const handleError = () => {
    const id = driveId(current);
    // lh3 실패 → drive thumbnail 형식으로 1회 폴백
    if (id && !triedFallback) {
      setTriedFallback(true);
      setCurrent(`https://drive.google.com/thumbnail?id=${id}&sz=w1600`);
    } else {
      setFailed(true);
    }
  };

  return (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={handleError}
        className="w-full h-full object-cover"
      />
      {label && (
        <span className="absolute top-2 left-2 bg-black/55 text-white text-xs font-semibold px-2 py-0.5 rounded">
          {label}
        </span>
      )}
    </div>
  );
}
