import {
  BufferGeometry,
  Float32BufferAttribute,
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

const landmarkY = [
  [-2.5, -1.7],
  [-1.2, -1.0],
  [-0.76, -0.56],
  [-0.35, -0.22],
  [0.234, 0.315],
  [1.27, 1.14],
];
function fitY(y: number) {
  for (let i = 1; i < landmarkY.length; i++)
    if (y <= landmarkY[i][0]) {
      const [a, b] = landmarkY[i - 1],
        [c, d] = landmarkY[i];
      return MathUtils.lerp(b, d, (y - a) / (c - a));
    }
  return 1.14;
}
/** Fit a CC0 anatomical mesh to the approved portrait's frontal landmarks. */
export function createPortraitVolume(source: BufferGeometry) {
  const copy = source.clone();
  copy.deleteAttribute("uv");
  copy.deleteAttribute("normal");
  const skin = mergeVertices(copy);
  copy.dispose();
  skin.computeVertexNormals();
  const parts = [skin];
  for (const side of [-1, 1]) {
    const eye = new SphereGeometry(0.139, 32, 24);
    eye.translate(side * 0.30775, 0.23415, 0.69535);
    eye.deleteAttribute("uv");
    parts.push(eye);
  }
  const surface = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  const positions = surface.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i),
      z = positions.getZ(i) + 0.1;
    const x =
      positions.getX(i) * 0.9 * (1 - 0.43 * MathUtils.smoothstep(-y, 0.8, 1.5));
    const projection = (6.1 - z) / 6.1;
    positions.setXYZ(i, x * projection, fitY(y) * projection, z);
  }
  surface.computeVertexNormals();
  // Rasterize the frontmost surface once. Particle colors keep their approved
  // projection; depth and normals come from the corresponding anatomical triangle.
  const size = 512,
    depth = new Float32Array(size * size).fill(-Infinity);
  const normalMap = new Float32Array(size * size * 3);
  const normals = surface.getAttribute("normal"),
    index = surface.getIndex()!;
  const projected = Array.from({ length: positions.count }, (_, i) => {
    const z = positions.getZ(i),
      q = 6.1 / (6.1 - z);
    return [
      ((positions.getX(i) * q) / 3.78 + 0.5) * (size - 1),
      (0.5 - (positions.getY(i) * q) / 3.5) * (size - 1),
      z,
    ];
  });
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)],
      [a, b, c] = ids.map((id) => projected[id]);
    const denominator =
      (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(denominator) < 1e-7) continue;
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))),
      maxX = Math.min(size - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))),
      maxY = Math.min(size - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const w0 =
          ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) /
          denominator;
        const w1 =
            ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) /
            denominator,
          w2 = 1 - w0 - w1;
        if (Math.min(w0, w1, w2) < -0.001) continue;
        const z = w0 * a[2] + w1 * b[2] + w2 * c[2],
          pixel = y * size + x;
        if (z <= depth[pixel]) continue;
        depth[pixel] = z;
        for (let axis = 0; axis < 3; axis++)
          normalMap[pixel * 3 + axis] =
            w0 * normals.array[ids[0] * 3 + axis] +
            w1 * normals.array[ids[1] * 3 + axis] +
            w2 * normals.array[ids[2] * 3 + axis];
      }
  }
  return {
    surface,
    lift(x: number, y: number) {
      const u = MathUtils.clamp(
        Math.round((x / 3.78 + 0.5) * (size - 1)),
        0,
        size - 1,
      );
      const v = MathUtils.clamp(
        Math.round((0.5 - y / 3.5) * (size - 1)),
        0,
        size - 1,
      );
      let pixel = v * size + u;
      if (!Number.isFinite(depth[pixel])) {
        // Nearby silhouette samples inherit the closest modeled surface.
        outer: for (let radius = 1; radius <= 10; radius++)
          for (let dy = -radius; dy <= radius; dy++)
            for (const dx of [-radius, radius]) {
              const xx = u + dx,
                yy = v + dy;
              if (xx < 0 || xx >= size || yy < 0 || yy >= size) continue;
              const candidate = yy * size + xx;
              if (Number.isFinite(depth[candidate])) {
                pixel = candidate;
                break outer;
              }
            }
      }
      const found = Number.isFinite(depth[pixel]);
      let z = found ? depth[pixel] : 0.1;
      const normal = found
        ? new Vector3().fromArray(normalMap, pixel * 3)
        : new Vector3(0, 0, 1);
      const fx = MathUtils.clamp((x / 3.78 + 0.5) * (size - 1), 0, size - 2),
        fy = MathUtils.clamp((0.5 - y / 3.5) * (size - 1), 0, size - 2);
      const ix = Math.floor(fx),
        iy = Math.floor(fy),
        tx = fx - ix,
        ty = fy - iy;
      const pixels = [
        iy * size + ix,
        iy * size + ix + 1,
        (iy + 1) * size + ix,
        (iy + 1) * size + ix + 1,
      ];
      if (pixels.every((p) => Number.isFinite(depth[p]))) {
        const weights = [
          (1 - tx) * (1 - ty),
          tx * (1 - ty),
          (1 - tx) * ty,
          tx * ty,
        ];
        z = 0;
        normal.set(0, 0, 0);
        pixels.forEach((p, i) => {
          z += depth[p] * weights[i];
          normal.addScaledVector(
            new Vector3().fromArray(normalMap, p * 3),
            weights[i],
          );
        });
      }
      z += 0.012;
      const q = (6.1 - z) / 6.1;
      return {
        position: new Vector3(x * q, y * q, z),
        normal: normal.normalize(),
      };
    },
    sample(random: () => number, count = 22000) {
      const sampler = new MeshSurfaceSampler(new Mesh(surface));
      (
        sampler as MeshSurfaceSampler & {
          setRandomGenerator: (r: () => number) => MeshSurfaceSampler;
        }
      ).setRandomGenerator(random);
      sampler.build();
      const samples: { position: Vector3; normal: Vector3 }[] = [];
      for (let i = 0; i < count; i++) {
        const position = new Vector3(),
          normal = new Vector3();
        sampler.sample(position, normal);
        // The reference already supplies the forward-facing detail.
        if (normal.z > 0.45 && position.z > 0.25) continue;
        position.addScaledVector(normal, 0.006);
        samples.push({ position, normal });
      }
      return samples;
    },
  };
}
