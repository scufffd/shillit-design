/**
 * Create the Meteora DBC config on-chain from config/dbc_config.jsonc.
 * Run from repo root: node scripts/create-dbc-config.mjs
 *
 * Requires Node.js >= 18 (e.g. nvm use 18).
 *
 * Requires:
 *   - RPC_URL in .env (or pass --rpc)
 *   - DBC_PAYER_KEYPAIR_PATH in .env pointing to keypair.json (payer + signer)
 *
 * Creates a new config keypair, sends createConfig tx, then prints the config
 * public key. Add it to .env as POOL_CONFIG_KEY and NEXT_PUBLIC_POOL_CONFIG_KEY.
 */

const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
if (nodeMajor < 18) {
  console.error("This script requires Node.js >= 18. You have " + process.versions.node + ".");
  console.error("Switch with: nvm use 18  (or install Node 18+)");
  process.exit(1);
}

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) {
    console.warn("No .env at repo root");
    return {};
  }
  const text = readFileSync(envPath, "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function stripJsonc(text) {
  // Remove only whole-line // comments (so we don't strip // inside URLs)
  const lines = text.split("\n").map((line) => (line.trimStart().startsWith("//") ? "" : line));
  const withoutLineComments = lines.join("\n");
  // Remove block comments /* ... */
  return withoutLineComments.replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

function loadDbcConfig() {
  const path = join(ROOT, "config", "dbc_config.jsonc");
  const text = readFileSync(path, "utf8");
  return JSON.parse(stripJsonc(text));
}

function loadKeypair(path) {
  const full = path.startsWith("/") ? path : join(ROOT, path);
  const json = JSON.parse(readFileSync(full, "utf8"));
  const secret = Uint8Array.from(json);
  return Keypair.fromSecretKey(secret);
}

async function main() {
  const dryRunCli = process.argv.includes("--dry-run");
  const env = loadEnv();
  const rpc = process.env.RPC_URL || env.RPC_URL || process.argv.find((a) => a.startsWith("--rpc="))?.slice(6) || "https://api.mainnet-beta.solana.com";
  const payerPath = process.env.DBC_PAYER_KEYPAIR_PATH || env.DBC_PAYER_KEYPAIR_PATH;
  if (!payerPath && !dryRunCli) {
    console.error("Set DBC_PAYER_KEYPAIR_PATH in .env to your keypair.json path (e.g. config/keypair.json)");
    console.error("To create one: solana-keygen new -o config/keypair.json (then fund it with SOL)");
    console.error("Or run with --dry-run to validate config and print the key that would be created.");
    process.exit(1);
  }

  const raw = loadDbcConfig();
  const dryRun = dryRunCli || raw.dryRun;
  const dbc = raw.dbcConfig;

  const { Connection, Keypair, PublicKey } = await import("@solana/web3.js");
  const {
    DynamicBondingCurveClient,
    buildCurve,
    BaseFeeMode,
    CollectFeeMode,
    MigrationOption,
    TokenType,
    ActivationType,
  } = await import("@meteora-ag/dynamic-bonding-curve-sdk");

  const quoteMint = new PublicKey(raw.quoteMint);
  const feeClaimer = new PublicKey(dbc.feeClaimer);
  const leftoverReceiver = new PublicKey(dbc.leftoverReceiver);

  const buildParams = {
    percentageSupplyOnMigration: dbc.percentageSupplyOnMigration,
    migrationQuoteThreshold: dbc.migrationQuoteThreshold,
    token: {
      totalTokenSupply: dbc.token.totalTokenSupply,
      tokenBaseDecimal: dbc.token.tokenBaseDecimal,
      tokenQuoteDecimal: dbc.token.tokenQuoteDecimal,
      tokenType: dbc.token.tokenType === 1 ? TokenType.Token2022 : TokenType.SPL,
      tokenUpdateAuthority: dbc.token.tokenUpdateAuthority,
      leftover: dbc.token.leftover,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: dbc.fee.baseFeeParams.baseFeeMode === 2 ? BaseFeeMode.RateLimiter : BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: dbc.fee.baseFeeParams.feeSchedulerParam,
      },
      dynamicFeeEnabled: dbc.fee.dynamicFeeEnabled,
      collectFeeMode: dbc.fee.collectFeeMode === 1 ? CollectFeeMode.OutputToken : CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: dbc.fee.creatorTradingFeePercentage,
      poolCreationFee: dbc.fee.poolCreationFee,
      enableFirstSwapWithMinFee: dbc.fee.enableFirstSwapWithMinFee,
    },
    migration: {
      migrationOption: dbc.migration.migrationOption === 1 ? MigrationOption.MET_DAMM_V2 : MigrationOption.MET_DAMM,
      migrationFeeOption: dbc.migration.migrationFeeOption,
      migrationFee: dbc.migration.migrationFee,
    },
    liquidityDistribution: dbc.liquidityDistribution,
    lockedVesting: dbc.lockedVesting,
    activationType: dbc.activationType === 1 ? ActivationType.Timestamp : ActivationType.Slot,
  };

  const configParams = buildCurve(buildParams);
  const payerKeypair = payerPath ? loadKeypair(payerPath) : new Keypair();
  const configKeypair = new Keypair();

  const connection = new Connection(rpc, "confirmed");
  const client = DynamicBondingCurveClient.create(connection, "confirmed");

  const createConfigParams = {
    config: configKeypair.publicKey,
    feeClaimer,
    leftoverReceiver,
    quoteMint,
    payer: payerKeypair.publicKey,
    ...configParams,
  };

  console.log("Creating DBC config on-chain...");
  console.log("  RPC:", rpc);
  console.log("  Payer:", payerKeypair.publicKey.toBase58());
  console.log("  Config (new):", configKeypair.publicKey.toBase58());
  console.log("  Fee claimer:", feeClaimer.toBase58());

  if (dryRun) {
    console.log("  [dry-run: no tx sent. Run without --dry-run and set DBC_PAYER_KEYPAIR_PATH to create on-chain.]");
    console.log("\nConfig key to use in .env after creating:");
    console.log("  POOL_CONFIG_KEY=" + configKeypair.publicKey.toBase58());
    console.log("  NEXT_PUBLIC_POOL_CONFIG_KEY=" + configKeypair.publicKey.toBase58());
    return;
  }

  try {
    const sig = await client.partner
      .createConfig(createConfigParams)
      .then((tx) => {
        tx.partialSign(configKeypair);
        tx.sign(payerKeypair);
        const rawTx = tx.serialize();
        return connection.sendRawTransaction(rawTx, { skipPreflight: false, maxRetries: 3 });
      });
    console.log("  Tx:", sig);
    const keypairPath = join(ROOT, "config", "config-keypair.json");
    writeFileSync(keypairPath, JSON.stringify(Array.from(configKeypair.secretKey)), "utf8");
    console.log("\nConfig created. Add to .env:");
    console.log("  POOL_CONFIG_KEY=" + configKeypair.publicKey.toBase58());
    console.log("  NEXT_PUBLIC_POOL_CONFIG_KEY=" + configKeypair.publicKey.toBase58());
    console.log("\nConfig keypair saved to config/config-keypair.json (keep private).");
  } catch (err) {
    console.error("Create config failed:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
