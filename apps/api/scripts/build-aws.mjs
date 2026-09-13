import { rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const output = `${root}/dist/aws/control-plane`;
await rm(output, { recursive: true, force: true });
await build({
  entryPoints: [`${root}/apps/api/src/aws-handler.ts`],
  outfile: `${output}/index.js`,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: false,
  minify: true,
  external: ["pg-native"],
});
await writeFile(`${output}/package.json`, '{"type":"commonjs"}\n');
