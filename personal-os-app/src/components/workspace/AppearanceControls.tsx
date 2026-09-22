"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icons";
/** 偏好仅保存在本机。系统减少动效设置优先于页面开关。 */
export function AppearanceControls() {
  const [theme, setTheme] = useState("night");
  const [motion, setMotion] = useState(true);
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const syncReduced = () => setSystemReduced(media.matches);
    const visibility = () => { root.dataset.paused = String(document.hidden); };
    const frame = requestAnimationFrame(() => {
      let savedTheme = "night", savedMotion = true;
      try { savedTheme = localStorage.getItem("os.appearance") === "paper" ? "paper" : "night"; savedMotion = localStorage.getItem("os.motion") !== "off"; } catch { /* 存储不可用时仍可调整当前会话。 */ }
      setTheme(savedTheme); setMotion(savedMotion); syncReduced(); visibility();
      root.dataset.appearance = savedTheme; root.dataset.motion = savedMotion ? "on" : "off";
    });
    media.addEventListener("change", syncReduced);
    document.addEventListener("visibilitychange", visibility);
    return () => { cancelAnimationFrame(frame); media.removeEventListener("change", syncReduced); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  function changeTheme() {
    const value = theme === "night" ? "paper" : "night";
    setTheme(value); document.documentElement.dataset.appearance = value;
    try { localStorage.setItem("os.appearance", value); } catch { /* 使用会话偏好。 */ }
  }
  function changeMotion() {
    const value = !motion;
    setMotion(value); document.documentElement.dataset.motion = value ? "on" : "off";
    try { localStorage.setItem("os.motion", value ? "on" : "off"); } catch { /* 使用会话偏好。 */ }
  }
  return <div className="os-appearance-controls" aria-label="显示偏好">
    <button type="button" className="os-icon-button" onClick={changeTheme} aria-label={theme === "night" ? "切换纸白主题" : "切换墨色主题"} title={theme === "night" ? "切换纸白主题" : "切换墨色主题"}><Icon name={theme === "night" ? "sun" : "moon"} /></button>
    <button type="button" className="os-motion-control" onClick={changeMotion} disabled={systemReduced} aria-pressed={motion && !systemReduced} title={systemReduced ? "已跟随系统减少动效" : "暂停或开启装饰动效"}><Icon name={motion && !systemReduced ? "motion" : "pause"} size={15} /><span>{systemReduced ? "静态模式" : motion ? "动效开启" : "动效暂停"}</span></button>
  </div>;
}
