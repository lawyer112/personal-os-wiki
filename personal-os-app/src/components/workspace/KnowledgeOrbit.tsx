"use client";
import { useEffect, useId, useRef } from "react";
/** 原创参数化带状曲面。仅为知识循环的视觉隐喻，不表示运行状态或数据量。 */
function ribbon(offset: number) {
  return Array.from({ length: 145 }, (_, i) => {
    const t = i / 144 * Math.PI * 2;
    const r = 126 + offset * Math.cos(t / 2);
    const x = r * Math.cos(t), y = r * Math.sin(t) * .62 - offset * Math.sin(t / 2) * .92;
    const angle = -.36;
    return `${i ? "L" : "M"}${(x * Math.cos(angle) - y * Math.sin(angle) + 280).toFixed(2)},${(x * Math.sin(angle) + y * Math.cos(angle) + 169).toFixed(2)}`;
  }).join(" ");
}
const ribbons = Array.from({ length: 27 }, (_, i) => ribbon((i - 13) * 4));
export function KnowledgeOrbit() {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => { element.dataset.visible = String(entry.isIntersecting); }, { threshold: .05 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="os-knowledge-orbit" data-ambient="true" aria-hidden="true">
    <div className="os-orbit-halo" />
    <svg viewBox="0 0 560 338" fill="none">
      <defs><linearGradient id={`${id}-ink`} x1="115" y1="254" x2="435" y2="69" gradientUnits="userSpaceOnUse"><stop stopColor="#5eb896" /><stop offset=".44" stopColor="#d7ebc6" /><stop offset=".73" stopColor="#d6bc8e" /><stop offset="1" stopColor="#9a784c" /></linearGradient></defs>
      <g className="os-orbit-grid" stroke="currentColor" strokeWidth=".65"><path d="M24 169h512M280 23v292" strokeDasharray="2 7" /><ellipse cx="280" cy="169" rx="222" ry="146" strokeDasharray="1 10" /><path d="M37 42h24M49 30v24M498 281h24M510 269v24" /></g>
      <g className="os-orbit-sculpture" stroke={`url(#${id}-ink)`} strokeWidth=".85">{ribbons.map((path, i) => <path key={i} d={path} opacity={.35 + Math.abs(i - 13) / 22} />)}</g>
      <g className="os-orbit-trace"><ellipse cx="280" cy="169" rx="208" ry="115" transform="rotate(-18 280 169)" stroke={`url(#${id}-ink)`} strokeWidth="1.2" strokeDasharray="8 650" /></g>
      <g transform="translate(280 169) rotate(-18) scale(1 .55)"><g className="os-orbit-satellite"><circle cx="208" cy="0" r="7" stroke="#d7deb1" strokeWidth=".8" opacity=".35" /><circle cx="208" cy="0" r="2.7" fill="#e2ebc3" /></g></g>
      <g stroke="currentColor" className="os-orbit-leaders" strokeWidth=".75"><path d="M167 104H89l-20-19H30M397 154h61l18-22h51M318 263v27h113" /><circle cx="167" cy="104" r="3" /><circle cx="397" cy="154" r="3" /><circle cx="318" cy="263" r="3" /></g>
      <g className="os-orbit-type" fill="currentColor"><text x="31" y="75">沉淀知识</text><text x="464" y="119">付诸行动</text><text x="346" y="310">复核 · 回流</text></g>
      <text className="os-orbit-center" x="280" y="168" textAnchor="middle" fill="currentColor">知 · 行</text>
      <text className="os-orbit-caption" x="280" y="192" textAnchor="middle" fill="currentColor">持续生长的知识循环</text>
    </svg>
    <span className="os-orbit-footnote">知识循环 · 概念示意</span>
  </div>;
}
