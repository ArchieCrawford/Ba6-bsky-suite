export async function getNonce(withAuthFetch: (url: string, init?: RequestInit) => Promise<Response>) {
  const res = await withAuthFetch("/api/wallets/nonce", { method: "GET" });
  if (!res.ok) throw new Error("Failed to get nonce");
  return (await res.json()) as { nonce: string; expires_at: string; message?: string };
}
