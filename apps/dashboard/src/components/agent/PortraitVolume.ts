import {
  BufferGeometry,
  Mesh,
  Vector3,
  SphereGeometry,
  MathUtils,
} from "three";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import {
  mergeVertices,
  mergeGeometries,
} from "three/addons/utils/BufferGeometryUtils.js";

/** Normalize the bundled CC0 head mesh into Mandate's portrait stage. */
export function createPortraitVolume(source: BufferGeometry) {
  const copy = source.clone();
  copy.deleteAttribute("uv");
  copy.deleteAttribute("normal");
  const skin = mergeVertices(copy);
  copy.dispose();
  skin.computeVertexNormals();
  const parts = [skin];
  for (const side of [-1, 1]) {
    const eye = new SphereGeometry(0.14, 32, 24);
    eye.translate(side * 0.31, 0.24, 0.7);
    eye.deleteAttribute("uv");
    parts.push(eye);
  }
  const surface = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  const positions = surface.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const sourceY = positions.getY(i);
    const y = sourceY * 0.87 + 0.06;
    const z = positions.getZ(i) + 0.1;
    const shoulderTaper = 1 - 0.43 * MathUtils.smoothstep(-sourceY, 0.8, 1.5);
    const projection = (6.1 - z) / 6.1;
    positions.setXYZ(i, positions.getX(i) * 0.9 * shoulderTaper * projection, y * projection, z);
  }
  surface.computeVertexNormals();

  return {
    surface,
    sample(random: () => number, count = 30000) {
      const sampler = new MeshSurfaceSampler(new Mesh(surface));
      (
        sampler as MeshSurfaceSampler & {
          setRandomGenerator: (generator: () => number) => MeshSurfaceSampler;
        }
      ).setRandomGenerator(random);
      sampler.build();
      const samples: { position: Vector3; normal: Vector3 }[] = [];
      for (let i = 0; i < count; i++) {
        const position = new Vector3();
        const normal = new Vector3();
        sampler.sample(position, normal);
        position.addScaledVector(normal, 0.006);
        samples.push({ position, normal });
      }
      return samples;
    },
  };
}
