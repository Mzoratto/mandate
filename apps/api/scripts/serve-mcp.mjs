import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const outfile = `${root}/dist/mcp/server.cjs`;
await build({
  entryPoints: [`${root}/apps/api/src/mcp/server.ts`],
  outfile,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  external: ["pg-native"],
  logLevel: "warning",
});
const { close } = createRequire(import.meta.url)(outfile).startMandateMcpServer(process.env);
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, close);
