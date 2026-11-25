/**
 * Custom analytics events from app code (client-safe). The recorder picks these up;
 * when recording is off they are simply ignored.
 */
export function track(name: string, props: Record<string, string | number | boolean | null | undefined> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("bf:track", { detail: { name, props } }));
}

/** Field ids carry a per-item random suffix (title-komzdjiq); analytics groups by the stable part. */
export const fieldKey = (id: string) => id.replace(/[-_][a-z0-9]{6,12}$/i, "").slice(0, 40);
