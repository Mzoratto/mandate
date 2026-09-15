"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";

import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import * as THREE from "three";
import { generateProceduralPortrait } from "./ProceduralPortrait";
import { PARTICLE_STATE } from "@/lib/mandate/state";
import type { MandateState } from "@/lib/mandate/types";
import type { HeadShaders } from "./shaders";

// Four degrees either side keeps the approved frontal portrait in its reliable range.
const MAX_YAW = Math.PI / 45;
const clampYaw = (yaw: number) => THREE.MathUtils.clamp(yaw, -MAX_YAW, MAX_YAW);

export default function ParticlePortrait({
  state,
  shaders,
  reducedMotion,
}: {
  state: MandateState;
  shaders: HeadShaders;
  reducedMotion: boolean;
}) {
  const { gl } = useThree();
  const drag = useRef({ active: false, x: 0, yaw: 0, released: 0 });
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.touchAction = "pan-y";
    canvas.style.cursor = "grab";
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      drag.current.active = true;
      drag.current.x = event.clientX;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const move = (event: PointerEvent) => {
      if (!drag.current.active) return;
      drag.current.yaw = clampYaw(
        drag.current.yaw + (event.clientX - drag.current.x) * 0.001,
      );
      drag.current.x = event.clientX;
    };
    const up = () => {
      drag.current.active = false;
      drag.current.released = performance.now();
      canvas.style.cursor = "grab";
    };
    const target = canvas.closest(".agent-scene");
    const key = (event: Event) => {
      const e = event as KeyboardEvent;
      if (!["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) return;
      e.preventDefault();
      drag.current.yaw =
        e.key === "Home"
          ? 0
          : clampYaw(drag.current.yaw + (e.key === "ArrowLeft" ? -0.02 : 0.02));
      drag.current.released = performance.now();
    };
    target?.addEventListener("keydown", key);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      target?.removeEventListener("keydown", key);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, [gl]);
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const depthSurface = useRef<THREE.Mesh>(null);
  const entrance = useRef({ elapsed: 0, announced: false });
  const head = useLoader(OBJLoader, "/models/NeutralHead.obj");
  const model = useMemo(
    () => generateProceduralPortrait(
      (head.getObjectByProperty("isMesh", true) as THREE.Mesh).geometry,
    ),
    [head],
  );
  const [diagnostic, setDiagnostic] = useState<{
    assembly: number | null;
    yaw: number;
    freeze: boolean;
  }>({ assembly: null, yaw: 0, freeze: false });
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const params = new URLSearchParams(location.search);
      setDiagnostic({
        assembly: params.has("assembly")
          ? THREE.MathUtils.clamp(Number(params.get("assembly")) || 0, 0, 1)
          : null,
        yaw: clampYaw(Number(params.get("yaw") || 0) || 0),
        freeze: params.has("freeze"),
      });
    }
  }, []);
  const initialUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAssembly: { value: 0 },
      uThinking: { value: 0 },
      uTurn: { value: 0 },
      uColorize: { value: 0 },
      uJitter: { value: 0.004 },
      uDispersion: { value: 0 },
      uPulseSpeed: { value: 0.7 },
      uPixelRatio: { value: 1 },
      uViewportScale: { value: 1 },
      uPrimary: { value: new THREE.Color("#6FEFFF") },
    }),
    [],
  );

  const targets = useMemo(
    () => ({
      primary: new THREE.Color(PARTICLE_STATE[state].primary).lerp(
        new THREE.Color("#b5d7de"),
        state === "within" ? 0.58 : 0,
      ),
    }),
    [state],
  );
  const elapsed = useRef(0);
  useFrame(({ pointer, gl, size }, delta) => {
    const uniforms = material.current?.uniforms;
    if (!uniforms) return;
    const frozen = reducedMotion || diagnostic.freeze;
    if (!frozen)
      elapsed.current +=
        Math.min(delta, 0.05) *
        (state === "within" ? 1 : state === "attention" ? 0.5 : 0.2);
    entrance.current.elapsed = frozen
      ? 3.8
      : Math.min(3.8, entrance.current.elapsed + Math.min(delta, 0.05));
    const assembly = reducedMotion
      ? 1
      : (diagnostic.assembly ?? entrance.current.elapsed / 3.8);
    uniforms.uAssembly.value = assembly;
    uniforms.uThinking.value =
      !frozen && state === "within" && assembly === 1 ? 1 : 0;
    if (depthSurface.current) depthSurface.current.visible = assembly === 1;
    if (assembly === 1 && !entrance.current.announced) {
      entrance.current.announced = true;
      window.dispatchEvent(
        new CustomEvent("mandate:portrait-ready", {
          detail: { animate: !frozen },
        }),
      );
    }
    const t = frozen ? 0 : elapsed.current,
      config = PARTICLE_STATE[state],
      damp = 1 - Math.exp(-delta * 3);
    uniforms.uTime.value = t;
    uniforms.uColorize.value = THREE.MathUtils.lerp(
      uniforms.uColorize.value,
      state === "within" ? 0 : 1,
      damp,
    );
    uniforms.uPixelRatio.value = gl.getPixelRatio();
    uniforms.uViewportScale.value = size.height / 478;
    uniforms.uPrimary.value.lerp(targets.primary, damp);
    uniforms.uJitter.value = THREE.MathUtils.lerp(
      uniforms.uJitter.value,
      frozen ? 0 : config.jitter,
      damp,
    );
    uniforms.uDispersion.value = THREE.MathUtils.lerp(
      uniforms.uDispersion.value,
      config.dispersion,
      damp,
    );
    uniforms.uPulseSpeed.value = THREE.MathUtils.lerp(
      uniforms.uPulseSpeed.value,
      config.pulseSpeed,
      damp,
    );
    if (
      !drag.current.active &&
      !reducedMotion &&
      performance.now() - drag.current.released > 3000
    )
      drag.current.yaw *= Math.exp(-delta * 0.8);
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        clampYaw(
          diagnostic.yaw +
            drag.current.yaw +
            (frozen ? 0 : Math.sin(t * 0.18) * 0.012 + pointer.x * 0.018),
        ),
        1 - Math.exp(-delta * 1.2),
      );
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        frozen ? 0 : Math.sin(t * 0.15) * 0.006 - pointer.y * 0.01,
        damp,
      );
      group.current.position.y = 0 + Math.sin(t * 0.6) * 0.014;
      const breath = 1 + Math.sin(t * 0.7) * 0.0025;
      group.current.scale.setScalar(breath);
      if (diagnostic.freeze)
        group.current.rotation.y = clampYaw(diagnostic.yaw + drag.current.yaw);
      uniforms.uTurn.value =
        Math.abs(Math.sin(group.current.rotation.y * 0.5)) * 2;
    }
  });
  return (
    <group ref={group}>
      <mesh
        ref={depthSurface}
        geometry={model.surface}
        renderOrder={-1}
        visible={false}
      >
        <meshBasicMaterial
          colorWrite={false}
          depthWrite
          depthTest
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
      <points geometry={model.particles}>
        <shaderMaterial
          ref={material}
          uniforms={initialUniforms}
          vertexShader={shaders.vertex}
          fragmentShader={shaders.fragment}
          blending={THREE.NormalBlending}
          depthWrite={false}
          transparent
        />
      </points>
    </group>
  );
}
