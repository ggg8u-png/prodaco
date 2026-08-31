// PHASE 19 — Netlify Scheduled Function이 나중에 호출할 서버측 draft runner.
// 이 파일 자체는 Function이 아니므로, 현재 배포에서는 cron이 활성화되지 않는다.
import type { AiContentQueueItem } from "@/lib/ai/queue";

export interface SchedulerConfiguration {
  enabled: boolean;
  autoPublish: boolean;
  maxItemsPerRun: number;
  maxRetries: number;
  minimumIntervalMinutes: 60;
}

export interface SchedulerRunRecord {
  state: "running" | "complete";
  startedAt: string;
  completedAt?: string;
  processed: number;
  failed: number;
}

export interface SchedulerLockStore {
  get(runId: string): Promise<SchedulerRunRecord | null>;
  set(runId: string, record: SchedulerRunRecord): Promise<void>;
}

export interface DraftExecutor {
  generateDraft(item: AiContentQueueItem): Promise<void>;
}

export interface SchedulerRunResult {
  status: "disabled" | "duplicate" | "complete";
  items: AiContentQueueItem[];
  processed: number;
  failed: number;
  // 이 runner는 publisher를 갖지 않는다. autoPublish 요청이 있어도 0이다.
  published: 0;
}

const boundedInt = (value: string | undefined, fallback: number, max: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};

/** 서버 환경변수에서만 읽는다. 기본은 완전 비활성·초안 전용이다. */
export function schedulerConfiguration(env: Record<string, string | undefined>): SchedulerConfiguration {
  const enabled = env.AI_SCHEDULER_ENABLED === "true";
  return {
    enabled,
    // 명시적으로 두 플래그를 모두 켠 경우에만 요청값을 기록한다.
    // 현재 runner에는 publisher adapter가 없으므로 실제 published 전환은 절대 하지 않는다.
    autoPublish: enabled && env.AI_AUTO_PUBLISH === "true",
    maxItemsPerRun: boundedInt(env.AI_SCHEDULER_MAX_ITEMS, 5, 5),
    maxRetries: boundedInt(env.AI_SCHEDULER_MAX_RETRIES, 3, 3),
    minimumIntervalMinutes: 60,
  };
}

/**
 * idempotency key는 Scheduled Function payload의 next_run(UTC)을 사용한다.
 * Netlify Blobs 같은 site-scoped strong-consistency store를 넣어 배포 간에도 기록을 유지한다.
 */
export async function runScheduledDrafts(args: {
  config: SchedulerConfiguration;
  runId: string;
  now: string;
  items: AiContentQueueItem[];
  store: SchedulerLockStore;
  executor: DraftExecutor;
}): Promise<SchedulerRunResult> {
  const copied = args.items.map((item) => ({ ...item }));
  if (!args.config.enabled) return { status: "disabled", items: copied, processed: 0, failed: 0, published: 0 };

  const previous = await args.store.get(args.runId);
  if (previous) return { status: "duplicate", items: copied, processed: 0, failed: 0, published: 0 };

  await args.store.set(args.runId, { state: "running", startedAt: args.now, processed: 0, failed: 0 });
  let processed = 0;
  let failed = 0;
  const eligible = copied.filter((item) =>
    item.status === "queued" || (item.status === "scheduled" && !!item.scheduledAt && item.scheduledAt <= args.now)
  ).slice(0, args.config.maxItemsPerRun);

  for (const item of eligible) {
    try {
      item.status = "generating";
      await args.executor.generateDraft(item);
      // executor는 품질 게이트 결과에 따라 draft 또는 review로만 상태를 바꾼다.
      if (item.status === "generating") item.status = "draft";
      item.generatedAt = args.now;
      processed++;
    } catch (error) {
      const attempts = Number(item.attempts || 0) + 1;
      Object.assign(item, { attempts, lastError: String(error instanceof Error ? error.message : error) });
      item.status = attempts >= args.config.maxRetries ? "failed" : "queued";
      failed++;
    }
  }
  await args.store.set(args.runId, { state: "complete", startedAt: args.now, completedAt: new Date().toISOString(), processed, failed });
  return { status: "complete", items: copied, processed, failed, published: 0 };
}
