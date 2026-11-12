import type { MessRecord } from "./mess-store";

/**
 * Cloud Sync Security Hardening:
 * Public ntfy.sh broadcast sync has been removed to prevent sensitive data exposure
 * (CWE-200) and unauthorized external record tampering.
 * All workspace persistence and synchronization now strictly route through
 * authenticated server functions and access-controlled database APIs.
 */

/**
 * Formerly published unencrypted mess data to public ntfy topics.
 * Now securely disabled. Server synchronization occurs via authenticated APIs.
 */
export async function publishMessToCloud(_record: MessRecord): Promise<boolean> {
  // Public ntfy publishing permanently removed for data privacy & access control
  return true;
}

/**
 * Formerly read untrusted mess records from public ntfy topics.
 * Permanently disabled to prevent forged external records from hijacking workspace state.
 */
export async function fetchMessFromCloudByCode(_code: string): Promise<MessRecord | null> {
  return null;
}

/**
 * Formerly read untrusted mess records from public ntfy topics.
 * Permanently disabled to prevent forged external records from hijacking workspace state.
 */
export async function fetchMessFromCloudById(_messId: string): Promise<MessRecord | null> {
  return null;
}
