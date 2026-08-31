import { isSameSitePair, resolveDriveProject } from "@/lib/driveProjects";

let pass = 0;
let fail = 0;
const ok = (condition: boolean, name: string) => condition ? (pass++, console.log(`  ✓ ${name}`)) : (fail++, console.log(`  ✗ ${name}`));

const valid = resolveDriveProject({ siteId: "001", approved: true, before: ["/before.webp"], after: ["/after.webp"], general: [] });
ok(isSameSitePair("001", "001") && valid?.beforeImage === "/before.webp" && valid.afterImage === "/after.webp", "valid pair accept");
ok(!isSameSitePair("001", "002"), "mismatched pair reject");

const noImage = resolveDriveProject({ siteId: "003", approved: true, before: [], after: [], general: [] });
ok(Boolean(noImage) && !noImage?.beforeImage && !noImage?.afterImage && noImage?.photos.length === 0, "no-image project 정상");

const legacy = { beforeImage: "/legacy-before.jpg", afterImage: "/legacy-after.jpg" };
ok(legacy.beforeImage === "/legacy-before.jpg" && legacy.afterImage === "/legacy-after.jpg", "existing legacy post 정상");

const unverified = resolveDriveProject({ siteId: "004", approved: false, before: ["/b.webp"], after: ["/a.webp"] });
ok(unverified === null, "미승인 project 거부");

const generalOnly = resolveDriveProject({ siteId: "005", approved: true, before: ["/one.webp"], general: ["/general.webp"] });
ok(!generalOnly?.beforeImage && generalOnly?.photos.length === 2 && generalOnly.photos.every((p) => p.alt === "프로다 작업 현장 사진"), "불완전 pair는 중립 general 처리");

console.log(`[drive-projects-verify] ${pass}/${pass + fail} 통과`);
if (fail) process.exit(1);
