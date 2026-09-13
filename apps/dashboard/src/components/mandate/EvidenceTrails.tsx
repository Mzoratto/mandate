"use client";
import { useEffect, useRef, useState } from "react";

/** A single opening flourish connects the assembled portrait to existing evidence. */
export default function EvidenceTrails({ enabled }: { enabled: boolean }) {
  const anchor = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [box, setBox] = useState([1, 1]);
  useEffect(() => {
    setPaths([]);
    let timer: ReturnType<typeof setTimeout>;
    const ready = (event: Event) => {
      if (
        !(event as CustomEvent<{ animate: boolean }>).detail.animate ||
        !enabled
      )
        return;
      const main = anchor.current?.parentElement;
      const portrait = main?.querySelector(".agent-scene");
      if (!main || !portrait) return;
      const rect = main.getBoundingClientRect(),
        from = portrait.getBoundingClientRect();
      const sx = from.left - rect.left + from.width * 0.2;
      const sy = from.top - rect.top + from.height * 0.78;
      setBox([main.clientWidth, main.scrollHeight]);
      setPaths(
        Array.from(
          main.querySelectorAll(".timeline .complete .step-marker"),
        ).map((marker) => {
          const to = marker.getBoundingClientRect();
          const x = to.left - rect.left + to.width / 2,
            y = to.top - rect.top + to.height / 2;
          return `M ${sx} ${sy} C ${sx} ${y - 50}, ${x} ${sy + 50}, ${x} ${y}`;
        }),
      );
      main.classList.add("evidence-arriving");
      timer = setTimeout(() => {
        setPaths([]);
        main.classList.remove("evidence-arriving");
      }, 2800);
    };
    const clear = () => {
      setPaths([]);
      anchor.current?.parentElement?.classList.remove("evidence-arriving");
    };
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    window.addEventListener("mandate:portrait-ready", ready);
    window.addEventListener("resize", clear);
    media.addEventListener("change", clear);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mandate:portrait-ready", ready);
      window.removeEventListener("resize", clear);
      media.removeEventListener("change", clear);
      anchor.current?.parentElement?.classList.remove("evidence-arriving");
    };
  }, [enabled]);
  useEffect(() => {
    if (paths.length) anchor.current?.setCurrentTime(0);
  }, [paths]);
  return (
    <svg
      ref={anchor}
      className="evidence-trails"
      aria-hidden="true"
      viewBox={`0 0 ${box[0]} ${box[1]}`}
    >
      {enabled &&
        paths.map((path, i) => (
          <g key={path}>
            <path
              d={path}
              fill="none"
              stroke="#6fefff"
              strokeWidth="1"
              opacity=".07"
            />
            <circle r="2" fill="#a0f4ff" opacity="0">
              <animate
                attributeName="opacity"
                values="0;.85;.85;0"
                keyTimes="0;.12;.85;1"
                dur="1.5s"
                begin={`${i * 0.28}s`}
                fill="freeze"
              />
              <animateMotion
                path={path}
                dur="1.5s"
                begin={`${i * 0.28}s`}
                fill="freeze"
                calcMode="spline"
                keyTimes="0;1"
                keySplines=".25 .1 .25 1"
              />
            </circle>
          </g>
        ))}
    </svg>
  );
}
