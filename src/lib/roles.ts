/**
 * Staff roles. Client-safe (no server imports).
 * - admin: everything (staff, settings, exports)
 * - supervisor: everything an expert can do, plus shift planning; more may be added later
 * - expert: works on requests and products
 */
export const roles = ["admin", "supervisor", "expert"] as const;
export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
  admin: "مدیر",
  supervisor: "سرپرست",
  expert: "کارشناس",
};

export function parseRole(v: unknown): Role {
  return roles.find((r) => r === v) ?? "expert";
}

export const canManageShifts = (role: Role) => role === "admin" || role === "supervisor";

/** Admins and supervisors: visitor behaviour (recordings, heatmaps). */
export const canViewInsights = (role: Role) => role === "admin" || role === "supervisor";
