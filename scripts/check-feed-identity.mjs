#!/usr/bin/env node
const DEFAULT_HOST = "https://feeds.ba6-bsky-suite.com";

function parseArgs(argv) {
  const args = { host: DEFAULT_HOST, didHost: null, followRedirects: true };
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
    if (key === "--didHost") {
      const val = argv[i + 1];
      if (val) {
        args.didHost = val;
        i += 1;
      }
      continue;
    }
    if (key?.startsWith("--didHost=")) {
      args.didHost = key.slice("--didHost=".length);
    }
    if (key === "--noFollow") {
      args.followRedirects = false;
    }
  }
  return args;
}

function normalizeHost(host) {
  if (!host) return DEFAULT_HOST;
  return host.endsWith("/") ? host.slice(0, -1) : host;
}

function ensureUrl(host) {
  if (!/^https?:\/\//i.test(host)) {
    return `https://${host}`;
  }
  return host;
}

const REDIRECT_STATUSES = new Set([301, 302, 307, 308]);

function isRedirectStatus(status) {
  return REDIRECT_STATUSES.has(status);
}

function stripWww(hostname) {
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

function isWwwMatchUrl(inputUrl, targetUrl) {
  try {
    const input = new URL(inputUrl);
    const target = new URL(targetUrl);
    return stripWww(input.hostname) === stripWww(target.hostname);
  } catch {
    return false;
  }
}

function resolveRedirectUrl(inputUrl, location) {
  try {
    return new URL(location, inputUrl).toString();
  } catch {
    return null;
  }
}

function headerSummary(res) {
  const headers = {
    server: res.headers.get("server") ?? "",
    "cf-ray": res.headers.get("cf-ray") ?? "",
    "x-render-origin-server": res.headers.get("x-render-origin-server") ?? "",
    location: res.headers.get("location") ?? ""
  };
  return Object.entries(headers)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
}

function bodyPreview(text) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.slice(0, 200);
}

async function fetchText(url, options = {}) {
  const { followRedirects = true, maxRedirects = 5 } = options;
  void maxRedirects;
  try {
    const res = await fetch(url, { method: "GET", redirect: followRedirects ? "follow" : "manual" });
    const body = await res.text();
    let finalUrl = res.url || url;
    let redirectUrl = null;
    if (!followRedirects && isRedirectStatus(res.status)) {
      const location = res.headers.get("location");
      if (location) {
        redirectUrl = resolveRedirectUrl(url, location);
        if (redirectUrl) {
          finalUrl = redirectUrl;
        }
      }
    }
    return { res, body, finalUrl, redirectUrl, followRedirects };
  } catch (err) {
    return { error: err };
  }
}

async function checkHealth(host, options) {
  const url = `${host}/healthz`;
  try {
    const result = await fetchText(url, options);
    if (result.error) {
      return { ok: false, message: `Request failed: ${result.error?.message ?? String(result.error)}` };
    }
    const { res, body, finalUrl, redirectUrl, followRedirects } = result;
    if (!followRedirects && isRedirectStatus(res.status)) {
      if (redirectUrl && isWwwMatchUrl(url, redirectUrl)) {
        return { ok: true, message: "PASS healthz", redirected: true, finalUrl: redirectUrl };
      }
      return {
        ok: false,
        message: `Expected 200 with body including "ok", got ${res.status}`,
        status: res.status,
        headers: headerSummary(res),
        body: bodyPreview(body),
        location: res.headers.get("location") ?? ""
      };
    }
    if (followRedirects && finalUrl !== url && !isWwwMatchUrl(url, finalUrl)) {
      return {
        ok: false,
        message: `Redirected to unexpected host ${finalUrl}`,
        status: res.status,
        headers: headerSummary(res),
        body: bodyPreview(body)
      };
    }
    const ok = res.status === 200 && body.toLowerCase().includes("ok");
    if (!ok) {
      return {
        ok: false,
        message: `Expected 200 with body including "ok", got ${res.status}`,
        status: res.status,
        headers: res.status !== 200 ? headerSummary(res) : "",
        body: bodyPreview(body),
        location: res.headers.get("location") ?? "",
        finalUrl
      };
    }
    return { ok: true, message: "PASS healthz", finalUrl, redirected: finalUrl !== url };
  } catch (err) {
    return { ok: false, message: `Request failed: ${err?.message ?? String(err)}` };
  }
}

async function checkDidJson(host, expectedDidHost, options) {
  const url = `${host}/.well-known/did.json`;
  try {
    const result = await fetchText(url, options);
    if (result.error) {
      return { ok: false, message: `Request failed: ${result.error?.message ?? String(result.error)}` };
    }
    const { res, body, finalUrl, redirectUrl, followRedirects } = result;
    if (!followRedirects && isRedirectStatus(res.status)) {
      if (redirectUrl && isWwwMatchUrl(url, redirectUrl)) {
        return { ok: true, message: "PASS did.json", redirected: true, finalUrl: redirectUrl };
      }
      return {
        ok: false,
        message: `Expected 200, got ${res.status}`,
        status: res.status,
        headers: headerSummary(res),
        body: bodyPreview(body),
        location: res.headers.get("location") ?? ""
      };
    }
    if (followRedirects && finalUrl !== url && !isWwwMatchUrl(url, finalUrl)) {
      return {
        ok: false,
        message: `Redirected to unexpected host ${finalUrl}`,
        status: res.status,
        headers: headerSummary(res),
        body: bodyPreview(body)
      };
    }
    if (res.status !== 200) {
      return {
        ok: false,
        message: `Expected 200, got ${res.status}`,
        status: res.status,
        headers: headerSummary(res),
        body: bodyPreview(body),
        location: res.headers.get("location") ?? "",
        finalUrl
      };
    }
    let json;
    try {
      json = JSON.parse(body);
    } catch (err) {
      return { ok: false, message: "Invalid JSON" };
    }
    const expectedUrl = new URL(ensureUrl(expectedDidHost));
    const expectedDid = `did:web:${expectedUrl.hostname}`;
    const expectedEndpoint = expectedUrl.origin;
    const id = json?.id;
    const service = Array.isArray(json?.service) ? json.service : [];
    const service0 = service[0] ?? {};
    const idOk = typeof id === "string" && id === expectedDid;
    const typeOk = service0?.type === "BskyFeedGenerator";
    const endpointOk =
      typeof service0?.serviceEndpoint === "string" && service0.serviceEndpoint.includes(expectedEndpoint);

    if (!idOk) {
      return { ok: false, message: `did.json id must equal ${expectedDid}` };
    }
    if (!typeOk) {
      return { ok: false, message: "did.json service[0].type must be BskyFeedGenerator" };
    }
    if (!endpointOk) {
      return { ok: false, message: `did.json service[0].serviceEndpoint must include ${expectedEndpoint}` };
    }
    return { ok: true, message: "PASS did.json", finalUrl, redirected: finalUrl !== url };
  } catch (err) {
    return { ok: false, message: `Request failed: ${err?.message ?? String(err)}` };
  }
}

async function checkVersion(host, options) {
  const url = `${host}/__version`;
  try {
    const result = await fetchText(url, options);
    if (result.error) {
      return { ok: false, message: `Request failed: ${result.error?.message ?? String(result.error)}` };
    }
    const { res, body, finalUrl, redirectUrl, followRedirects } = result;
    if (!followRedirects && isRedirectStatus(res.status)) {
      if (redirectUrl && isWwwMatchUrl(url, redirectUrl)) {
        return { ok: true, message: "PASS __version", redirected: true, finalUrl: redirectUrl };
      }
      return {
        ok: false,
        message: `Expected 200, got ${res.status}`,
        status: res.status,
        headers: headerSummary(res),
        body: bodyPreview(body),
        location: res.headers.get("location") ?? ""
      };
    }
    if (followRedirects && finalUrl !== url && !isWwwMatchUrl(url, finalUrl)) {
      return {
        ok: false,
        message: `Redirected to unexpected host ${finalUrl}`,
        status: res.status,
        headers: headerSummary(res),
        body: bodyPreview(body)
      };
    }
    if (res.status !== 200) {
      return {
        ok: false,
        message: `Expected 200, got ${res.status}`,
        status: res.status,
        headers: headerSummary(res),
        body: bodyPreview(body),
        location: res.headers.get("location") ?? "",
        finalUrl
      };
    }
    let json;
    try {
      json = JSON.parse(body);
    } catch (err) {
      return { ok: false, message: "Invalid JSON" };
    }
    return {
      ok: true,
      message: "PASS __version",
      commit: json?.commit ?? null,
      ts: json?.ts ?? null,
      finalUrl,
      redirected: finalUrl !== url
    };
  } catch (err) {
    return { ok: false, message: `Request failed: ${err?.message ?? String(err)}` };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = ensureUrl(normalizeHost(args.host));
  const didHost = ensureUrl(normalizeHost(args.didHost ?? args.host));
  const options = { followRedirects: args.followRedirects };

  const health = await checkHealth(host, options);
  if (health.ok) {
    const redirectInfo = health.redirected ? ` redirected to ${health.finalUrl}` : "";
    console.log(`PASS healthz ${host}${redirectInfo}`);
  } else {
    console.log(`FAIL healthz ${host} - ${health.message}`);
    if (health.status) console.log(`  status: ${health.status}`);
    if (health.location) console.log(`  location: ${health.location}`);
    if (health.headers) console.log(`  headers: ${health.headers}`);
    if (health.body) console.log(`  body: ${health.body}`);
  }

  const did = await checkDidJson(host, didHost, options);
  if (did.ok) {
    const redirectInfo = did.redirected ? ` redirected to ${did.finalUrl}` : "";
    console.log(`PASS did.json ${host} (didHost ${didHost})${redirectInfo}`);
  } else {
    console.log(`FAIL did.json ${host} - ${did.message}`);
    if (did.status) console.log(`  status: ${did.status}`);
    if (did.location) console.log(`  location: ${did.location}`);
    if (did.headers) console.log(`  headers: ${did.headers}`);
    if (did.body) console.log(`  body: ${did.body}`);
  }

  const version = await checkVersion(host, options);
  if (version.ok) {
    const redirectInfo = version.redirected ? ` redirected to ${version.finalUrl}` : "";
    console.log(
      `PASS __version ${host} commit=${version.commit ?? "null"} ts=${version.ts ?? "null"}${redirectInfo}`
    );
  } else {
    console.log(`FAIL __version ${host} - ${version.message}`);
    if (version.status) console.log(`  status: ${version.status}`);
    if (version.location) console.log(`  location: ${version.location}`);
    if (version.headers) console.log(`  headers: ${version.headers}`);
    if (version.body) console.log(`  body: ${version.body}`);
  }

  const ok = health.ok && did.ok && version.ok;
  process.exitCode = ok ? 0 : 1;
}

main();
