import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
await mkdir(".test-build", { recursive: true });
await build({
  entryPoints: ["tests/domain.test.ts"],
  outfile: ".test-build/domain.test.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
});
const result = spawnSync(
  process.execPath,
  ["--test", ".test-build/domain.test.mjs"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
