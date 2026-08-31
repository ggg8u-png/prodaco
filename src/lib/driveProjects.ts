import fs from "node:fs";
import path from "node:path";
import type { CasePhoto } from "@/types";

export interface DriveProject {
  siteId: string;
  projectName?: string;
  approved: boolean;
  before?: string[];
  after?: string[];
  general?: string[];
  region?: string;
  service?: string;
}

export interface ResolvedDriveProject {
  siteId: string;
  beforeImage?: string;
  afterImage?: string;
  photos: CasePhoto[];
}

/** 단일 project 안의 사진만 전·후로 묶는다. 미승인/불완전 pair는 일반 사진만 반환한다. */
export function resolveDriveProject(project: DriveProject | null | undefined): ResolvedDriveProject | null {
  if (!project?.siteId || project.approved !== true) return null;
  const before = (project.before ?? []).filter(Boolean);
  const after = (project.after ?? []).filter(Boolean);
  const general = (project.general ?? []).filter(Boolean);
  const hasPair = before.length > 0 && after.length > 0;
  return {
    siteId: project.siteId,
    ...(hasPair ? { beforeImage: before[0], afterImage: after[0] } : {}),
    photos: [...(hasPair ? [...before.slice(1), ...after.slice(1)] : [...before, ...after]), ...general]
      .map((src) => ({ src, alt: "프로다 작업 현장 사진" })),
  };
}

export function loadDriveProject(siteId: string): ResolvedDriveProject | null {
  if (!siteId || !/^[A-Za-z0-9_-]+$/.test(siteId)) return null;
  try {
    const file = path.join(process.cwd(), "content", "drive-projects", `${siteId}.json`);
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as DriveProject;
    if (raw.siteId !== siteId) return null;
    return resolveDriveProject(raw);
  } catch {
    return null;
  }
}

/** 서로 다른 현장 ID로 만든 pair는 저장/렌더링 전에 거부한다. */
export function isSameSitePair(beforeSiteId?: string, afterSiteId?: string): boolean {
  return Boolean(beforeSiteId && afterSiteId && beforeSiteId === afterSiteId);
}
