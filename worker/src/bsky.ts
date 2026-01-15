import { BskyAgent } from "@atproto/api";

export function agentFor(service: string) {
  return new BskyAgent({ service });
}
