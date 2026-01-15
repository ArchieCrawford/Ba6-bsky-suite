import "dotenv/config";
import { BskyAgent } from "@atproto/api";
import { supa } from "./supa.js";

type ConnectArgs = {
  userId?: string;
  handle?: string;
  appPassword?: string;
  service?: string;
};

function parseArgs(argv: string[]): ConnectArgs {
  const args: ConnectArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!key?.startsWith("--")) continue;
    switch (key) {
      case "--user":
      case "--user-id":
        args.userId = val;
        i += 1;
        break;
      case "--handle":
        args.handle = val;
        i += 1;
        break;
      case "--app-password":
        args.appPassword = val;
        i += 1;
        break;
      case "--service":
        args.service = val;
        i += 1;
        break;
      case "--help":
        printUsage();
        process.exit(0);
      default:
        break;
    }
  }
  return args;
}

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  npm run connect -- --user <uuid> --handle <handle> --app-password <app-password> [--service <url>]",
      "",
      "Or use env vars:",
      "  BSKY_USER_ID, BSKY_HANDLE, BSKY_APP_PASSWORD, BLUESKY_SERVICE",
      ""
    ].join("\n")
  );
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));

  const userId = cli.userId ?? process.env.BSKY_USER_ID;
  const handle = cli.handle ?? process.env.BSKY_HANDLE;
  const appPassword = cli.appPassword ?? process.env.BSKY_APP_PASSWORD;
  const service = cli.service ?? process.env.BLUESKY_SERVICE ?? "https://bsky.social";

  if (!userId || !handle || !appPassword) {
    printUsage();
    process.exit(1);
  }

  const agent = new BskyAgent({ service });
  const loginRes = await agent.login({ identifier: handle, password: appPassword });

  const did = loginRes.data.did;
  const accessJwt = loginRes.data.accessJwt;
  const refreshJwt = loginRes.data.refreshJwt;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const now = new Date().toISOString();

  const { error: accountError } = await supa
    .from("bsky_accounts")
    .upsert(
      {
        user_id: userId,
        did,
        handle: loginRes.data.handle,
        service
      },
      { onConflict: "user_id,did" }
    );

  if (accountError) throw accountError;

  const { error: sessionError } = await supa
    .from("bsky_sessions")
    .upsert(
      {
        user_id: userId,
        account_did: did,
        access_jwt: accessJwt,
        refresh_jwt: refreshJwt,
        expires_at: expiresAt.toISOString(),
        updated_at: now
      },
      { onConflict: "user_id,account_did" }
    );

  if (sessionError) throw sessionError;

  process.stdout.write(`Connected ${handle} (${did}) for user ${userId}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.message ?? String(err)}\n`);
  process.exit(1);
});
