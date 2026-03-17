/**
 * Add a token to tracked_tokens and run the auto-detect job.
 * Usage: pnpm run bagworker:detect <token_mint>
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { createClient } = require("@supabase/supabase-js");
const { runAutoDetectJob } = require("./bagworker-auto-detect-job");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const tokenMint = process.argv.slice(2).find((a) => a !== "--" && a.length > 20);
  if (!tokenMint) {
    console.error("Usage: node add-tracked-token-and-run-detect.ts <token_mint>");
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env)");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabase.from("tracked_tokens").upsert(
    { token_mint: tokenMint, search_query: tokenMint },
    { onConflict: "token_mint" }
  );

  if (error) {
    console.error("Failed to add tracked token:", error.message);
    process.exit(1);
  }

  console.log("Added to tracked_tokens:", tokenMint);

  await runAutoDetectJob();
  console.log("Auto-detect job finished.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
