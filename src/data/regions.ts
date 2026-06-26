// 지역 인접 데이터 — 로컬 SEO/내부링크용.
//
// 수도권 66개 지역을 실제 지리 권역으로 묶고, 같은 권역의 인접 지역을 제공한다.
// 용도: ① 지역 페이지에 '인근 지역' 실링크(같은 품목)로 로컬 사일로 강화,
//       ② 본문에 실제 인접 권역을 노출해 페이지별 지역 적합성을 높임.
// 임의 데이터가 아니라 실제 행정구역 인접성에 기반한다.

interface Cluster {
  label: string; // 권역 명칭 (본문 노출용)
  members: string[];
}

export const CLUSTERS: Cluster[] = [
  { label: "서울 강남권", members: ["강남", "서초", "송파", "강동", "동작", "관악"] },
  { label: "서울 서남권", members: ["강서", "양천", "영등포", "구로", "금천"] },
  { label: "서울 도심권", members: ["마포", "서대문", "은평", "용산", "중구"] },
  { label: "서울 동북권", members: ["성동", "광진", "동대문", "중랑", "성북", "강북", "노원", "도봉"] },
  { label: "경기 수원·용인권", members: ["수원", "용인", "화성", "동탄", "오산", "광교", "평택"] },
  { label: "경기 안양·과천권", members: ["안양", "군포", "의왕", "과천", "평촌", "산본", "광명"] },
  { label: "경기 안산·시흥권", members: ["안산", "시흥", "부천"] },
  { label: "경기 성남·하남권", members: ["성남", "판교", "위례", "하남"] },
  { label: "경기 동북부권", members: ["의정부", "남양주", "구리", "양주", "동두천"] },
  { label: "경기 고양·파주권", members: ["고양", "일산", "파주", "운정", "김포"] },
  { label: "인천권", members: ["인천", "부평", "계양", "남동구", "서구", "연수구", "미추홀구", "송도"] },
];

const regionToCluster = new Map<string, Cluster>();
for (const c of CLUSTERS) {
  for (const m of c.members) regionToCluster.set(m, c);
}

// 넓은 지역(서울/경기/인천/수도권)의 대표 인접/하위 지역.
const BROAD: Record<string, string[]> = {
  서울: ["강남", "마포", "송파", "영등포", "성동", "노원"],
  경기: ["수원", "성남", "고양", "용인", "부천", "안양"],
  인천: ["부평", "계양", "남동구", "연수구", "서구"],
  수도권: ["서울", "성남", "고양", "인천", "수원", "용인"],
};

// 해당 지역의 권역 명칭(없으면 '수도권').
export function clusterLabelOf(region: string | undefined): string {
  if (!region) return "수도권";
  return regionToCluster.get(region)?.label || "수도권";
}

// 인접 지역 목록 — 같은 권역의 다른 지역(최대 n개). 넓은 지역은 대표 하위 지역.
export function neighborsOf(region: string | undefined, n = 5): string[] {
  if (!region) return [];
  if (BROAD[region]) return BROAD[region].slice(0, n);
  const c = regionToCluster.get(region);
  if (!c) return [];
  return c.members.filter((m) => m !== region).slice(0, n);
}
