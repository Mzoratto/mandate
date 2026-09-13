"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector2 } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/** Bloom operates in linear light; OutputPass handles the single display conversion. */
export default function PortraitBloom() {
  const { gl, scene, camera, size } = useThree();
  const composer = useRef<EffectComposer | null>(null);
  useEffect(() => {
    const chain = new EffectComposer(gl);
    const render = new RenderPass(scene, camera);
    const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.32, 0.2, 0.6);
    const output = new OutputPass();
    chain.addPass(render);
    chain.addPass(bloom);
    chain.addPass(output);
    composer.current = chain;
    return () => {
      composer.current = null;
      render.dispose();
      bloom.dispose();
      output.dispose();
      chain.dispose();
    };
  }, [gl, scene, camera]);
  useEffect(() => {
    composer.current?.setPixelRatio(gl.getPixelRatio());
    composer.current?.setSize(size.width, size.height);
  }, [gl, size.width, size.height]);
  useFrame((_, delta) => composer.current?.render(delta), 1);
  return null;
}
