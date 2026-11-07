import type { MessRecord } from "./mess-store";

const CLOUD_SYNC_BASE = "https://ntfy.sh";
const INVITE_TOPIC_PREFIX = "mm_shared_table_";
const MESS_TOPIC_PREFIX = "mm_mess_id_";

/**
 * Publishes a mess record to public cloud topics so that any member
 * on any browser, phone, or laptop can immediately discover and load it.
 */
export async function publishMessToCloud(record: MessRecord): Promise<boolean> {
  const invite = (record.mess as unknown as { invite_code?: string })?.invite_code;
  const messId = record.mess.id;
  const payload = JSON.stringify(record);

  const promises: Promise<unknown>[] = [];

  if (invite && invite.length === 6) {
    promises.push(
      fetch(`${CLOUD_SYNC_BASE}/${INVITE_TOPIC_PREFIX}${invite}`, {
        method: "POST",
        headers: {
          Title: `Mess ${record.mess.name}`,
          Tags: "mess",
        },
        body: payload,
      }).catch(() => null),
    );
  }

  if (messId) {
    promises.push(
      fetch(`${CLOUD_SYNC_BASE}/${MESS_TOPIC_PREFIX}${messId}`, {
        method: "POST",
        headers: {
          Title: `Mess ${record.mess.name}`,
          Tags: "mess",
        },
        body: payload,
      }).catch(() => null),
    );
  }

  await Promise.allSettled(promises);
  return true;
}

/**
 * Look up a mess record by 6-digit invitation code across the cloud.
 */
export async function fetchMessFromCloudByCode(code: string): Promise<MessRecord | null> {
  const clean = code.trim();
  if (clean.length !== 6) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `${CLOUD_SYNC_BASE}/${INVITE_TOPIC_PREFIX}${clean}/json?poll=1&since=all`,
      { cache: "no-store", signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return null;

    const raw = await res.text();
    const lines = raw
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const line = lines[i];
        if (!line) continue;
        const item = JSON.parse(line);
        if (item.event === "message" && item.message) {
          const record = JSON.parse(item.message) as MessRecord;
          if (record && record.mess && record.members) {
            return record;
          }
        }
      } catch {
        // continue
      }
    }
  } catch {
    // network failure / offline
  }

  return null;
}

/**
 * Look up a mess record by messId across the cloud.
 */
export async function fetchMessFromCloudById(messId: string): Promise<MessRecord | null> {
  if (!messId) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `${CLOUD_SYNC_BASE}/${MESS_TOPIC_PREFIX}${messId}/json?poll=1&since=all`,
      { cache: "no-store", signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return null;

    const raw = await res.text();
    const lines = raw
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const line = lines[i];
        if (!line) continue;
        const item = JSON.parse(line);
        if (item.event === "message" && item.message) {
          const record = JSON.parse(item.message) as MessRecord;
          if (record && record.mess && record.members) {
            return record;
          }
        }
      } catch {
        // continue
      }
    }
  } catch {
    // network failure / offline
  }

  return null;
}
