import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const output = `${root}/dist/aws/control-plane`;
await rm(output, { recursive: true, force: true });
await build({
  entryPoints: [`${root}/apps/api/src/aws-handler.ts`],
  outfile: `${output}/index.mjs`,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: false,
  minify: true,
  external: ["pg-native"],
});
