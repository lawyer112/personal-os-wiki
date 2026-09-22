import type { CSSProperties } from "react";
const paths = {
  overview: "M3 10h7V3H3v7Zm11 11h7v-7h-7v7ZM3 21h7v-7H3v7Zm11-11h7V3h-7v7Z",
  book: "M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5Z",
  projects: "m12 3 10 5-10 5L2 8l10-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  tasks: "M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01",
  agents: "M9 3h6m-3 0v4M5 7h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm3 5v2m8-2v2m-7 4h6",
  check: "m5 12 4 4L19 6", plus: "M12 5v14M5 12h14",
  inbox: "m3 3-2 12v6h22v-6L21 3H3Zm-2 12h6l2 3h6l2-3h6",
  idea: "M9 18h6m-6 3h6M8 15c-6-5-3-13 4-13s10 8 4 13l-1 3H9l-1-3Z",
  clock: "M12 8v5l3 2m7-3a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  settings: "M4 7h10m4 0h2M4 17h2m4 0h10M18 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM10 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  search: "m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  arrow: "M5 12h14m-6-6 6 6-6 6", external: "M6 18 18 6M6 6h12v12",
  menu: "M4 6h16M4 12h16M4 18h16", close: "m6 6 12 12M6 18 18-18",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1m-2 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
  moon: "M21 13a9 9 0 1 1-10-10c-4 7 3 14 10 10Z",
  motion: "m9 5 10 7-10 7V5ZM3 7v10", pause: "M8 5v14M16 5v14",
  shield: "m12 2 9 4v6c0 5-5 8-9 10-4-2-9-5-9-10V6l9-4Zm-4 10 3 3 5-6",
  compass: "m16 8-3 5-5 3 3-5 5-3Zm6 4a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
} as const;
export type IconName = keyof typeof paths;
/** 统一的轻量矢量图标，不依赖远程字体或图标库。 */
export function Icon({ name, size = 18, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg className="os-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
export function BrandMark() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 3 37 20 20 37 3 20 20 3Z" stroke="currentColor" strokeWidth="1.1" /><path d="m20 9 11 11-11 11L9 20 20 9Z" stroke="currentColor" strokeWidth="1.1" /><path d="M20 3v34M3 20h34" stroke="currentColor" strokeWidth=".6" /><circle cx="20" cy="20" r="4" fill="currentColor" /></svg>;
}
