import fs from "node:fs";
import path from "node:path";
import MandateShell from "@/components/mandate/MandateShell";
export default function Page() {
  const directory = path.join(process.cwd(), "src/components/agent/shaders");
  return (
    <MandateShell
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
