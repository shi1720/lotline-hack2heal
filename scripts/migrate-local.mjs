import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
// Keep generated application build untouched. Wrangler tracks applied migrations.
const config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
config.main = resolve("dist/server", config.main);
if (config.assets?.directory)
  config.assets.directory = resolve("dist/server", config.assets.directory);
for (const binding of config.d1_databases ?? [])
  binding.migrations_dir = resolve("drizzle");
await mkdir(".sites-runtime", { recursive: true });
await writeFile(".sites-runtime/local-migrations.json", JSON.stringify(config));
const result = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    ".sites-runtime/local-migrations.json",
    "--persist-to",
    process.env.LOTLINE_DB_STATE ?? ".wrangler/state",
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
