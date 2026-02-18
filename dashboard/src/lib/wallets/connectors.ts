export type EvmInjectedProvider = {
  isMetaMask?: boolean;
  providers?: any[];
  request: (args: { method: string; params?: any[] | object }) => Promise<any>;
};

export type SolanaInjectedProvider = {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signMessage?: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
};

declare global {
  interface Window {
    ethereum?: EvmInjectedProvider;
    solana?: SolanaInjectedProvider;
  }
}

export function isMobile() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

export function getAppHost() {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_APP_HOST || "";
  return (process.env.NEXT_PUBLIC_APP_HOST || window.location.host).replace(/^https?:\/\//, "");
}

export function getCurrentUrl() {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

export function detectEvmInjected() {
  if (typeof window === "undefined") return { ok: false as const, provider: null as any };
  const eth = window.ethereum;
  if (!eth || typeof eth.request !== "function") return { ok: false as const, provider: null as any };

  // Some browsers expose multiple providers; pick MetaMask if present.
  const providers = Array.isArray((eth as any).providers) ? (eth as any).providers : null;
  if (providers?.length) {
    const mm = providers.find((p: any) => p?.isMetaMask);
    return { ok: true as const, provider: (mm || providers[0]) as EvmInjectedProvider };
  }

  return { ok: true as const, provider: eth };
}

export function detectPhantomInjected() {
  if (typeof window === "undefined") return { ok: false as const, provider: null as any };
  const sol = window.solana;
  if (!sol || typeof sol.connect !== "function") return { ok: false as const, provider: null as any };
  if (!sol.isPhantom) return { ok: true as const, provider: sol }; // could be other Solana wallets later
  return { ok: true as const, provider: sol };
}

export function openInMetaMaskDapp(host?: string) {
  const h = (host || getAppHost()).replace(/^https?:\/\//, "");
  if (!h) return false;
  const url = `https://metamask.app.link/dapp/${encodeURIComponent(h)}`;
  if (typeof window !== "undefined") window.location.href = url;
  return true;
}

export function openInPhantomDapp(host?: string) {
  const h = (host || getAppHost()).replace(/^https?:\/\//, "");
  if (!h) return false;
  const url = `https://phantom.app/ul/browse/https://${encodeURIComponent(h)}?ref=${encodeURIComponent(h)}`;
  if (typeof window !== "undefined") window.location.href = url;
  return true;
}

export async function connectEvmInjected() {
  const det = detectEvmInjected();
  if (!det.ok) return { ok: false as const, reason: "no_injected_provider" };
  const provider = det.provider;

  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0] || "";
  if (!address) return { ok: false as const, reason: "no_account" };

  return { ok: true as const, chain: "evm" as const, address };
}

export async function connectSolanaInjected() {
  const det = detectPhantomInjected();
  if (!det.ok) return { ok: false as const, reason: "no_injected_provider" };
  const provider = det.provider;

  const res = await provider.connect();
  const address = res?.publicKey?.toString?.() || "";
  if (!address) return { ok: false as const, reason: "no_account" };

  return { ok: true as const, chain: "solana" as const, address };
}

export type WalletConnectEvmResult =
  | { ok: true; chain: "evm"; address: string }
  | { ok: false; reason: "walletconnect_not_configured" | "walletconnect_failed" };

export async function connectWalletConnectEvm(): Promise<WalletConnectEvmResult> {
  return { ok: false, reason: "walletconnect_not_configured" };
}
