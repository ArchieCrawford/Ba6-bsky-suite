#!/usr/bin/env node
const DEFAULT_HOST = "https://feeds.ba6-bsky-suite.com";

function parseArgs(argv) {
  const args = { host: DEFAULT_HOST };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--host") {
      const val = argv[i + 1];
      if (val) {
        args.host = val;
        i += 1;
      }
      continue;
    }
    if (key?.startsWith("--host=")) {
      args.host = key.slice("--host=".length);
    }
  }
  return args;
}

function normalizeHost(host) {
  if (!host) return DEFAULT_HOST;
  return host.endsWith("/") ? host.slice(0, -1) : host;
}

async function checkHealth(host) {
  const url = `${host}/healthz`;
  try {
    const res = await fetch(url, { method: "GET" });
    const body = await res.text();
    const ok = res.status === 200 && body.toLowerCase().includes("ok");
    if (!ok) {
      return { ok: false, message: `Expected 200 with body including "ok", got ${res.status}` };
    }
    return { ok: true, message: "PASS healthz" };
  } catch (err) {
    return { ok: false, message: `Request failed: ${err?.message ?? String(err)}` };
  }
}

async function checkDidJson(host) {
  const url = `${host}/.well-known/did.json`;
  try {
    const res = await fetch(url, { method: "GET" });
    if (res.status !== 200) {
      return { ok: false, message: `Expected 200, got ${res.status}` };
    }
    let json;
    try {
      json = await res.json();
    } catch (err) {
      return { ok: false, message: "Invalid JSON" };
    }
    const id = json?.id;
    const service = Array.isArray(json?.service) ? json.service : [];
    const service0 = service[0] ?? {};
    const idOk = typeof id === "string" && id.startsWith("did:web:");
    const typeOk = service0?.type === "BskyFeedGenerator";
    const endpointOk =
      typeof service0?.serviceEndpoint === "string" && service0.serviceEndpoint.startsWith("https://");

    if (!idOk) {
      return { ok: false, message: "did.json id must start with did:web:" };
    }
    if (!typeOk) {
      return { ok: false, message: "did.json service[0].type must be BskyFeedGenerator" };
    }
    if (!endpointOk) {
      return { ok: false, message: "did.json service[0].serviceEndpoint must start with https://" };
    }
    return { ok: true, message: "PASS did.json" };
  } catch (err) {
    return { ok: false, message: `Request failed: ${err?.message ?? String(err)}` };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = normalizeHost(args.host);

  const health = await checkHealth(host);
  if (health.ok) {
    console.log(`PASS healthz ${host}`);
  } else {
    console.log(`FAIL healthz ${host} - ${health.message}`);
  }

  const did = await checkDidJson(host);
  if (did.ok) {
    console.log(`PASS did.json ${host}`);
  } else {
    console.log(`FAIL did.json ${host} - ${did.message}`);
  }

  const ok = health.ok && did.ok;
  process.exitCode = ok ? 0 : 1;
}

main();
