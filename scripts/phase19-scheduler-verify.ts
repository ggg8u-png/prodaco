import { runScheduledDrafts, schedulerConfiguration, type SchedulerLockStore, type SchedulerRunRecord } from "../netlify/functions/_shared/ai-draft-scheduler";
import type { AiContentQueueItem } from "@/lib/ai/queue";

class MemoryStore implements SchedulerLockStore {
  records = new Map<string, SchedulerRunRecord>();
  async get(runId: string) { return this.records.get(runId) || null; }
  async set(runId: string, record: SchedulerRunRecord) { this.records.set(runId, record); }
}

async function main() {
  const base: AiContentQueueItem = { id: "ai-1", keyword: "마루 철거", status: "queued" };
  const disabled = await runScheduledDrafts({
    config: schedulerConfiguration({}), runId: "2026-08-31T00:00:00Z", now: "2026-08-31T00:00:00Z", items: [base], store: new MemoryStore(), executor: { generateDraft: async () => { throw new Error("실행되면 안 됨"); } },
  });
  if (disabled.status !== "disabled" || disabled.processed !== 0) throw new Error("disabled scheduler 실패");

  const store = new MemoryStore();
  const config = schedulerConfiguration({ AI_SCHEDULER_ENABLED: "true", AI_AUTO_PUBLISH: "true", AI_SCHEDULER_MAX_ITEMS: "99" });
  const run = await runScheduledDrafts({
    config, runId: "2026-08-31T01:00:00Z", now: "2026-08-31T01:00:00Z", items: [base], store,
    executor: { generateDraft: async (item) => { item.status = "review"; } },
  });
  if (run.status !== "complete" || run.processed !== 1 || run.published !== 0 || run.items[0].status !== "review" || config.maxItemsPerRun !== 5) throw new Error("draft-only scheduler 실패");
  const duplicate = await runScheduledDrafts({ config, runId: "2026-08-31T01:00:00Z", now: "2026-08-31T01:00:00Z", items: [base], store, executor: { generateDraft: async () => undefined } });
  if (duplicate.status !== "duplicate") throw new Error("idempotency lock 실패");
  console.log("[phase19-scheduler-verify] disabled·rate limit·idempotency·draft-only 통과");
}

void main();
