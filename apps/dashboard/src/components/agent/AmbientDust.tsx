"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PARTICLE_STATE } from "@/lib/mandate/state";
import type { MandateState } from "@/lib/mandate/types";
export default function AmbientDust({
  state,
  reducedMotion,
}: {
  state: MandateState;
  reducedMotion: boolean;
}) {
  const points = useRef<THREE.Points>(null),
    material = useRef<THREE.PointsMaterial>(null);
  const geometry = useMemo(() => {
    let seed = 6891;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const positions = [];
    for (let i = 0; i < 1500; i++) {
      const a = rnd() * Math.PI * 2,
        r = 0.8 + rnd() * 0.8;
      positions.push(
        Math.cos(a) * r,
        i < 1050 ? -1.05 - rnd() * 0.6 : Math.sin(a) * 1.4,
        (rnd() - 0.5) * 1.3 - 0.3,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, []);
  const color = useMemo(
    () => new THREE.Color(PARTICLE_STATE[state].secondary),
    [state],
  );
  useFrame((_, delta) => {
    if (points.current && !reducedMotion)
      points.current.rotation.y +=
        delta * PARTICLE_STATE[state].dustVelocity * 0.07;
    material.current?.color.lerp(color, 1 - Math.exp(-delta * 3));
  });
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        ref={material}
        color="#2AAEC0"
        size={0.007}
        transparent
        opacity={0.055}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
