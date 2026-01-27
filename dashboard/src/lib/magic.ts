"use client";

type MagicUserMetadata = {
  issuer?: string | null;
  publicAddress?: string | null;
  email?: string | null;
  userId?: string | null;
};

export type PendingWallet = {
  provider: "magic";
  chain: "ethereum" | "solana";
  address: string;
  network?: string | null;
  magic_issuer?: string | null;
  magic_user_id?: string | null;
};

type MagicLoginResult = {
  metadata: MagicUserMetadata;
  wallets: PendingWallet[];
};

const PENDING_WALLETS_KEY = "ba6:pending_wallets";

const MAGIC_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
const MAGIC_ETH_NETWORK = process.env.NEXT_PUBLIC_MAGIC_ETH_NETWORK ?? "mainnet";
const MAGIC_SOLANA_NETWORK = process.env.NEXT_PUBLIC_MAGIC_SOLANA_NETWORK ?? "mainnet";
const MAGIC_SOLANA_RPC = process.env.NEXT_PUBLIC_MAGIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

let ethMagic: any | null = null;
let solanaMagic: any | null = null;

function requireMagicKey() {
  if (!MAGIC_PUBLISHABLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY");
  }
  return MAGIC_PUBLISHABLE_KEY;
}

async function getEthereumMagic() {
  if (ethMagic) return ethMagic;
  if (typeof window === "undefined") {
    throw new Error("Magic can only be used in the browser");
  }
  const { Magic } = await import("magic-sdk");
  ethMagic = new Magic(requireMagicKey(), { network: MAGIC_ETH_NETWORK });
  return ethMagic;
}

async function getSolanaMagic() {
  if (solanaMagic) return solanaMagic;
  if (typeof window === "undefined") {
    throw new Error("Magic can only be used in the browser");
  }
  const { Magic } = await import("magic-sdk");
  const { SolanaExtension } = await import("@magic-ext/solana");
  solanaMagic = new Magic(requireMagicKey(), {
    extensions: [new SolanaExtension({ rpcUrl: MAGIC_SOLANA_RPC })]
  });
  return solanaMagic;
}

export function storePendingWallets(wallets: PendingWallet[]) {
  if (typeof window === "undefined") return;
  if (!wallets.length) return;
  window.localStorage.setItem(PENDING_WALLETS_KEY, JSON.stringify(wallets));
}

export function consumePendingWallets(): PendingWallet[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(PENDING_WALLETS_KEY);
  if (!raw) return [];
  window.localStorage.removeItem(PENDING_WALLETS_KEY);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as PendingWallet[];
  } catch {
    return [];
  }
  return [];
}

export async function loginWithEmail(email: string): Promise<MagicLoginResult> {
  const magic = await getEthereumMagic();
  await magic.auth.loginWithEmailOTP({ email });
  const metadata = (await magic.user.getMetadata()) as MagicUserMetadata;
  const wallets: PendingWallet[] = [];
  if (metadata?.publicAddress) {
    wallets.push({
      provider: "magic",
      chain: "ethereum",
      address: metadata.publicAddress,
      network: MAGIC_ETH_NETWORK,
      magic_issuer: metadata.issuer ?? null,
      magic_user_id: metadata.userId ?? null
    });
  }
  return { metadata, wallets };
}

export async function connectEthereum(email: string): Promise<PendingWallet> {
  const magic = await getEthereumMagic();
  await magic.auth.loginWithEmailOTP({ email });
  const metadata = (await magic.user.getMetadata()) as MagicUserMetadata;
  if (!metadata?.publicAddress) {
    throw new Error("No Ethereum address returned from Magic");
  }
  return {
    provider: "magic",
    chain: "ethereum",
    address: metadata.publicAddress,
    network: MAGIC_ETH_NETWORK,
    magic_issuer: metadata.issuer ?? null,
    magic_user_id: metadata.userId ?? null
  };
}

export async function connectSolana(email: string): Promise<PendingWallet> {
  const magic = await getSolanaMagic();
  await magic.auth.loginWithEmailOTP({ email });
  const metadata = (await magic.user.getMetadata()) as MagicUserMetadata;
  const solanaAddress = await magic.solana?.getPublicAddress();
  const address =
    typeof solanaAddress === "string"
      ? solanaAddress
      : Array.isArray(solanaAddress)
        ? solanaAddress[0]
        : (solanaAddress as { publicAddress?: string } | undefined)?.publicAddress ??
          metadata?.publicAddress;
  if (!address) {
    throw new Error("No Solana address returned from Magic");
  }
  return {
    provider: "magic",
    chain: "solana",
    address,
    network: MAGIC_SOLANA_NETWORK,
    magic_issuer: metadata.issuer ?? null,
    magic_user_id: metadata.userId ?? null
  };
}

export async function logoutMagic() {
  const instances = await Promise.all([getEthereumMagic().catch(() => null), getSolanaMagic().catch(() => null)]);
  await Promise.all(
    instances.filter(Boolean).map((instance) => (instance as any).user?.logout?.())
  );
}
