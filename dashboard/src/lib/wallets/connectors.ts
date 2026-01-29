type EvmProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  providers?: EvmProvider[];
  isMetaMask?: boolean;
};

type SolanaProvider = {
  isPhantom?: boolean;
  connect: () => Promise<void>;
  signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature?: Uint8Array } | Uint8Array>;
  publicKey?: { toString?: () => string };
  providers?: SolanaProvider[];
};

const isClient = typeof window !== "undefined";

export const isMobile = () => {
  if (!isClient) return false;
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const detectEvmInjected = (): EvmProvider | null => {
  if (!isClient) return null;
  const eth = (window as any)?.ethereum as EvmProvider | undefined;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length) {
    const metamask = eth.providers.find((provider) => provider?.isMetaMask);
    return metamask ?? eth.providers[0] ?? eth;
  }
  return eth;
};

export const detectPhantomInjected = (): SolanaProvider | null => {
  if (!isClient) return null;
  const solana = (window as any)?.solana as SolanaProvider | undefined;
  if (!solana) return null;
  if (Array.isArray(solana.providers) && solana.providers.length) {
    const phantom = solana.providers.find((provider) => provider?.isPhantom);
    return phantom ?? solana.providers[0] ?? solana;
  }
  return solana;
};

export const openInMetaMaskDapp = () => {
  if (!isClient) return;
  const url = window.location.href.replace(/^https?:\/\//, "");
  window.location.href = `https://metamask.app.link/dapp/${url}`;
};

export const openInPhantomDapp = () => {
  if (!isClient) return;
  const target = encodeURIComponent(window.location.href);
  window.location.href = `https://phantom.app/ul/browse/${target}`;
};

export const connectEvmInjected = async () => {
  const provider = detectEvmInjected();
  if (!provider) return null;
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const address = Array.isArray(accounts) ? accounts[0] : (accounts as string | null);
  return { provider, address: address ?? "" };
};

export const connectSolanaInjected = async () => {
  const provider = detectPhantomInjected();
  if (!provider) return null;
  await provider.connect();
  const address = provider.publicKey?.toString?.() ?? "";
  return { provider, address };
};

export const connectWalletConnectEvm = async () => {
  throw new Error("WalletConnect is not enabled yet.");
};
