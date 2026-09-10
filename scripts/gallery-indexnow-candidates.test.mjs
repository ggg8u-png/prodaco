import assert from "node:assert/strict";
import {
  assertCaseIdMatchesFile,
  classifyGalleryChange,
  meaningfulSnapshot,
  mergeCandidates,
  resolveDriveSnapshot,
} from "./gallery-indexnow-candidates.mjs";
import { validUrl } from "./indexnow.mjs";

const base = {
  status: "published",
  verified: true,
  beforeImage: "/before.jpg",
  afterImage: "/after.jpg",
  description: "실제 현장의 철거 전 상태와 바닥재 철거 및 샌딩 과정을 충분히 기록한 설명입니다.",
  title: "수원 아파트 강마루 철거",
};

assert.equal(classifyGalleryChange(null, base), "publish");
assert.equal(classifyGalleryChange({ ...base, status: "draft" }, base), "publish");
assert.equal(classifyGalleryChange(base, { ...base, status: "draft" }), "delete");
assert.equal(classifyGalleryChange(base, { ...base, verified: false }), "content_update");
assert.equal(classifyGalleryChange(base, { ...base, afterImage: "" }), "delete");
assert.equal(classifyGalleryChange(base, { ...base, description: `${base.description} 수정` }), "content_update");
assert.equal(classifyGalleryChange(base, { ...base, updatedAt: "2026-09-10" }), "content_update");
assert.equal(
  classifyGalleryChange(base, {
    ...base,
    indexStatus: "confirmed",
    indexSubmissionStatus: "submitted",
    submittedToIndexNowAt: "2026-09-10T00:00:00Z",
    lastIndexCheckAt: "2026-09-10T01:00:00Z",
  }),
  null
);
assert.equal(classifyGalleryChange(null, { ...base, description: "짧은 설명" }), null);
assert.equal(classifyGalleryChange(null, { ...base, beforeImage: "", afterImage: "", driveProjectId: "missing" }), null);
const driveCase = { ...base, driveProjectId: "site-a", beforeImage: "", afterImage: "" };
const driveBefore = resolveDriveSnapshot(driveCase, {
  siteId: "site-a",
  approved: true,
  before: ["/drive-before.jpg"],
  after: ["/drive-after.jpg"],
});
const driveAfter = resolveDriveSnapshot(driveCase, {
  siteId: "site-a",
  approved: true,
  before: ["/drive-before.jpg"],
  after: ["/drive-after-updated.jpg"],
});
assert.equal(classifyGalleryChange(driveBefore, driveAfter), "content_update");
assert.equal(
  meaningfulSnapshot({ ...base, photos: [{ src: " /x.jpg " }] }),
  meaningfulSnapshot({ ...base, photos: [{ src: "/x.jpg", alt: "", caption: "" }] }),
  "런타임에 같은 빈 사진 메타는 의미 변경이 아니다"
);
assert.doesNotThrow(() => assertCaseIdMatchesFile("content/gallery/case-a.json", { id: "case-a" }));
assert.throws(() => assertCaseIdMatchesFile("content/gallery/case-a.json", { id: "case-b" }), /파일명과 정확히/);
const legacyDefaults = { ...base };
delete legacyDefaults.status;
delete legacyDefaults.verified;
assert.equal(
  classifyGalleryChange(legacyDefaults, { ...base, thumbnailChoice: "after", photos: [] }),
  null,
  "CMS 기본값 저장만으로는 콘텐츠 수정이 아니다"
);

const entries = [];
const item = { id: "gallery-abc-publish-case-a", url: "https://prodaco.kr/gallery/case-a", event: "publish", status: "pending", sourceCommit: "abc", semanticHash: "hash-a" };
assert.deepEqual(mergeCandidates(entries, [item]), { added: 1, updated: 0 });
assert.deepEqual(mergeCandidates(entries, [item]), { added: 0, updated: 0 });
assert.equal(entries.length, 1);

const history = [
  { ...item, id: "gallery-a", status: "submitted", semanticHash: "hash-a" },
  { ...item, id: "gallery-b", status: "submitted", semanticHash: "hash-b" },
];
const reverted = { ...item, id: "gallery-a-revert", semanticHash: "hash-a" };
assert.deepEqual(mergeCandidates(history, [reverted]), { added: 1, updated: 0 });
assert.equal(history.at(-1)?.id, "gallery-a-revert", "A→B→A 되돌림은 새 후보로 유지");
assert.equal(validUrl("https://prodaco.kr/gallery/case-a"), true);
assert.equal(validUrl(["https://prodaco.kr/gallery/case-a"]), false);
assert.equal(validUrl("https://prodaco.kr/gallery/case-a?unexpected=1"), false);

console.log("[gallery-indexnow:test] 전체 통과 — 변경 분류·추적 필드 제외·중복 방지");
