import { apiFetch } from "./api";

export type IdentityRow = { did: string | null; handle: string | null; did_type: string | null };

export async function fetchIdentity() {
  return apiFetch<IdentityRow>("/api/identity/me", { method: "GET" });
}

export function displayName(identity: IdentityRow | null, fallbackEmail?: string | null) {
  if (identity?.handle) return `@${identity.handle}`;
  if (identity?.did) return identity.did;
  return fallbackEmail ?? "Signed in";
}
