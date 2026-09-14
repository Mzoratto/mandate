import fs from "node:fs";
import path from "node:path";
import MandateShell from "@/components/mandate/MandateShell";
import { loadDashboardSource } from "@/lib/mandate/live";
export default async function Page() {
  const directory = path.join(process.cwd(), "src/components/agent/shaders");
  const source = await loadDashboardSource();
  return (
    <MandateShell
      source={source}
      shaders={{
        vertex:
          fs.readFileSync(path.join(directory, "noise3D.glsl"), "utf8") +
          "\n" +
          fs.readFileSync(path.join(directory, "head.vert.glsl"), "utf8"),
        fragment: fs.readFileSync(
          path.join(directory, "head.frag.glsl"),
          "utf8",
        ),
      }}
    />
  );
}
