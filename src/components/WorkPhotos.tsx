// 프로다 작업 현장 사진 섹션 — URL별 고정(결정적) 조합, 자체 호스팅 WebP 전용.
// 서버 컴포넌트: 파일은 커밋된 public/images/work 에 항상 존재하므로 클라이언트
// 폴백(GalleryImage)이 필요 없다. 승인 사진이 없으면 섹션 자체를 렌더하지 않는다.
//
// 표기 원칙: 섹션 제목·alt·문구에 확인되지 않은 지역명·공정명을 쓰지 않는다.
// (해당 지역 시공사례처럼 보이게 하지 않기 — 고지 문구 포함)
import { selectWorkPhotos, workPhotoAlt, workPhotoFootnote } from "@/lib/workPhotos";

interface WorkPhotosProps {
  /** 결정적 선택 키 — 페이지 고유 경로(slug, "services/서울", "/", "gallery" 등) */
  routeKey: string;
  /** 노출 장수(기본 6) — 모바일 성능을 위해 12장 이하 권장 */
  count?: number;
  /** 섹션 제목(중립 명칭만 사용) */
  heading?: string;
  /** 홈 등 넓은 레이아웃 여부 */
  wide?: boolean;
  /** 배경 톤(인접 섹션과 교차) */
  tone?: "white" | "offwhite";
  /** 첫 줄 소개 문구(선택) */
  intro?: string;
}

export default function WorkPhotos({
  routeKey,
  count = 6,
  heading = "프로다 작업 현장 사진",
  wide = false,
  tone = "white",
  intro,
}: WorkPhotosProps) {
  const photos = selectWorkPhotos(routeKey, Math.min(count, 12));
  if (photos.length === 0) return null;

  const cols =
    photos.length >= 8
      ? "grid-cols-2 sm:grid-cols-4"
      : "grid-cols-3";

  return (
    <section className={`py-10 px-5 ${tone === "offwhite" ? "bg-[#F7F6F3]" : ""} border-t border-gray-100`}>
      <div className={`${wide ? "max-w-[1200px]" : "max-w-3xl"} mx-auto`}>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{heading}</p>
        {intro && <p className="text-xs text-gray-500 mb-5 leading-relaxed">{intro}</p>}
        <div className={`grid ${cols} gap-2 sm:gap-3 ${intro ? "" : "mt-3"}`}>
          {photos.map((p) => (
            <img
              key={p.id}
              src={p.thumb}
              alt={workPhotoAlt(routeKey, p.id)}
              width={p.thumbWidth}
              height={p.thumbHeight}
              loading="lazy"
              decoding="async"
              className="aspect-square w-full object-cover bg-[#EDEBE4]"
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3 leading-relaxed">{workPhotoFootnote(routeKey)}</p>
      </div>
    </section>
  );
}
