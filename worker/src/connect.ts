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
  const now = new Date().toISOString();

  const { error: userError } = await supa.from("users").upsert({ id: userId }, { onConflict: "id" });
  if (userError) throw userError;

  const { data: secretId, error: secretError } = await supa.rpc("create_account_secret", {
    secret: appPassword,
    name: `bsky:${handle}`,
    description: `Bluesky app password for ${handle}`
  });
  if (secretError) throw secretError;
  if (!secretId) {
    throw new Error("Unable to store app password");
  }

  const { error: accountError } = await supa
    .from("accounts")
    .upsert(
      {
        user_id: userId,
        account_did: did,
        handle: loginRes.data.handle ?? handle,
        vault_secret_id: secretId,
        last_auth_at: now,
        is_active: true
      },
      { onConflict: "user_id,account_did" }
    );

  if (accountError) throw accountError;

  process.stdout.write(`Connected ${handle} (${did}) for user ${userId}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.message ?? String(err)}\n`);
  process.exit(1);
});
