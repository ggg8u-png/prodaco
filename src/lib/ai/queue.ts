export const AI_QUEUE_STATUSES = ["queued", "generating", "draft", "review", "scheduled", "published", "failed"] as const;
export type AiQueueStatus = (typeof AI_QUEUE_STATUSES)[number];

export interface AiContentQueueItem {
  id: string;
  keyword: string;
  service?: string;
  region?: string;
  intent?: string;
  priority?: "low" | "normal" | "high";
  status: AiQueueStatus;
  scheduledAt?: string;
  generatedAt?: string;
  publishedAt?: string;
  attempts?: number;
  lastError?: string;
  note?: string;
}

/** scheduler는 의도적으로 제공하지 않는다. scheduled는 운영자 검토 후의 기록 상태일 뿐이다. */
export function canAutoPublish(): false { return false; }

export function queueStatusOf(value: unknown): AiQueueStatus {
  return (AI_QUEUE_STATUSES as readonly string[]).includes(String(value))
    ? value as AiQueueStatus
    : "queued";
}
