"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { displayTime, label, safeLink } from "@/lib/workspace";

export function errorText(status: number, message?: string) {
  if (message && /[\u4e00-\u9fff]/.test(message)) return message;
  const messages: Record<number, string> = { 400: "输入内容不完整或格式不正确，请检查必填项。", 401: "登录已失效，请重新验证访问凭证。", 403: "当前身份没有操作权限。", 404: "记录不存在，可能已被移动或删除。", 409: "状态已发生变化，请刷新后重试。", 429: "操作过于频繁，请稍后重试。", 503: "服务暂不可用，请检查配置与连接。" };
  return messages[status] ?? "操作未成功，请检查服务连接后重试。";
}
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(errorText(response.status, body.error ?? body.message));
  return body as T;
}
export function useLiveData<T>(url: string | null, interval = 15000) {
  const [result, setResult] = useState<{ data: T | null; error: string; updated: string }>({ data: null, error: "", updated: "" });
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const reload = useCallback(() => setVersion(n => n + 1), []);
  useEffect(() => {
    if (!url) return;
    let controller: AbortController | undefined;
    let disposed = false;
    async function load() {
      controller?.abort(); controller = new AbortController();
      const current = ++sequence.current;
      try {
        const data = await requestJson<T>(url!, { signal: controller.signal });
        if (!disposed && current === sequence.current) setResult({ data, error: "", updated: new Date().toISOString() });
      } catch (error) {
        if (!disposed && current === sequence.current && !(error instanceof Error && error.name === "AbortError")) setResult(old => ({ ...old, error: error instanceof Error ? error.message : "连接中断，请重试。" }));
      }
    }
    void load();
    const timer = interval > 0 ? window.setInterval(() => { if (!document.hidden) void load(); }, interval) : undefined;
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => { disposed = true; controller?.abort(); if (timer) clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [url, version, interval]);
  return { ...result, reload };
}
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "操作失败，请重试。"); }
    finally { setBusy(false); }
  };
  return { busy, message, run };
}
export function Badge({ value, children }: { value?: string | null; children?: ReactNode }) {
  return <span className={`os-badge os-tone-${value ?? "neutral"}`}>{children ?? label(value)}</span>;
}
export function Empty({ title = "这里暂时没有内容", children }: { title?: string; children?: ReactNode }) {
  return <div className="os-empty"><span aria-hidden="true">◇</span><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}
export function Notice({ error, children }: { error?: boolean; children: ReactNode }) {
  return <div className={`os-notice${error ? " os-notice-error" : ""}`} role={error ? "alert" : "status"}>{children}</div>;
}
export function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="os-page-heading"><div><p className="os-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="os-description">{description}</p></div><div className="os-heading-actions">{actions}</div></header>;
}
export function Loading() { return <div className="os-loading" role="status"><span className="os-spinner" />正在读取工作数据…</div>; }
export function LiveStatus({ updated, error, reload }: { updated: string; error: string; reload: () => void }) {
  return <div className="os-live"><span className={`os-dot${error ? " os-dot-error" : ""}`} />{error ? "连接异常，保留最近数据" : updated ? `更新于 ${displayTime(updated)}` : "正在连接"}<button type="button" className="os-link" onClick={reload}>刷新</button></div>;
}
export function EvidenceLink({ url, title }: { url: string; title?: string | null }) {
  const href = safeLink(url);
  return href ? <a className="os-evidence-link" href={href} target={href.startsWith("/") ? undefined : "_blank"} rel="noreferrer">{title || url}<span aria-hidden="true">↗</span></a> : <span className="os-code">{title || url}（仅作记录）</span>;
}
export function Field({ title, children }: { title: string; children: ReactNode }) { return <label className="os-field"><span>{title}</span>{children}</label>; }
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav className="os-pagination" aria-label="结果分页"><span>共 {total} 条 · 第 {page} / {pages} 页</span><div><button className="os-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</button><button className="os-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>下一页</button></div></nav>;
}
