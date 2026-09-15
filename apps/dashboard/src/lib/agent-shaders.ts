import fs from "node:fs";
import path from "node:path";
import type { HeadShaders } from "@/components/agent/shaders";

const directory = path.join(process.cwd(), "src/components/agent/shaders");

export const headShaders: HeadShaders = {
  vertex: `${fs.readFileSync(path.join(directory, "noise3D.glsl"), "utf8")}\n${fs.readFileSync(path.join(directory, "head.vert.glsl"), "utf8")}`,
  fragment: fs.readFileSync(path.join(directory, "head.frag.glsl"), "utf8"),
  surfaceVertex: fs.readFileSync(path.join(directory, "surface.vert.glsl"), "utf8"),
  surfaceFragment: fs.readFileSync(path.join(directory, "surface.frag.glsl"), "utf8"),
};
