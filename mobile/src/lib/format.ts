export function shortDid(did: string) {
  if (!did) return "";
  if (did.length <= 22) return did;
  return `${did.slice(0, 12)}...${did.slice(-8)}`;
}
