// 시공사례 영상 — 값이 있을 때만 렌더된다. 없으면 이 컴포넌트가 null 을 돌려준다.
//
// 아직 실제 영상이 없어도 기능은 지금 넣어 둔다. 운영자가 CMS 에 주소만 넣으면
// 화면과 VideoObject 구조화데이터가 함께 붙는다(코드 수정 불필요).
import type { GalleryItem } from "@/types";

/** 주소에서 플랫폼을 추정한다. 명시값이 있으면 그것을 우선한다. */
export function videoPlatformOf(g: GalleryItem): "youtube" | "vimeo" | "file" | null {
  if (!g.videoUrl) return null;
  if (g.videoPlatform) return g.videoPlatform;
  if (/youtu\.be|youtube\.com/.test(g.videoUrl)) return "youtube";
  if (/vimeo\.com/.test(g.videoUrl)) return "vimeo";
  return "file";
}

/** 임베드용 주소. 추출 실패 시 null → 그때는 링크로만 안내한다. */
export function videoEmbedUrl(g: GalleryItem): string | null {
  const platform = videoPlatformOf(g);
  if (!platform || !g.videoUrl) return null;
  if (platform === "youtube") {
    const m = g.videoUrl.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  }
  if (platform === "vimeo") {
    const m = g.videoUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  }
  return g.videoUrl;
}

export default function CaseVideo({ item }: { item: GalleryItem }) {
  const platform = videoPlatformOf(item);
  const embed = videoEmbedUrl(item);
  if (!platform || !embed) return null;

  const title = item.videoTitle || `${item.region} ${item.item} 시공 영상`;

  return (
    <section className="mt-10">
      <h2 className="font-mono-pd mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9A8A2E]">시공 영상</h2>
      <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: "16 / 9" }}>
        {platform === "file" ? (
          // 직접 파일은 브라우저 기본 플레이어로 — 외부 스크립트를 붙이지 않는다.
          <video
            src={embed}
            controls
            preload="none"
            poster={item.videoThumbnail || item.afterImage}
            className="h-full w-full"
            title={title}
          />
        ) : (
          <iframe
            src={embed}
            title={title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        )}
      </div>
      <p className="mt-2 text-[13px] text-gray-500">{title}</p>
    </section>
  );
}
