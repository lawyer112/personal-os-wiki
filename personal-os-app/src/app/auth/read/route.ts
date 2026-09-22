import { NextResponse } from "next/server";
import {
  PERSONAL_OS_READ_COOKIE,
  configuredReadTokens,
  tokenAllowed,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const next = normalizeNext(new URL(request.url).searchParams.get("next"));
  return html(loginPage(next), 200);
}

export async function POST(request: Request) {
  const tokens = configuredReadTokens();
  if (tokens.length === 0) {
    return html("访问凭证尚未配置，请联系管理员。", 503);
  }

  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const next = normalizeNext(String(form.get("next") ?? "/"));

  if (!tokenAllowed(token, tokens)) {
    return html(loginPage(next, "访问凭证无效，请检查后重新输入。"), 401);
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(PERSONAL_OS_READ_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(request),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

function normalizeNext(value: string | null) {
  const next = value?.trim() || "/";
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u0020]/.test(next)) {
    return "/";
  }
  return next;
}

function isHttps(request: Request) {
  return new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto")?.toLowerCase() === "https";
}

function html(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function loginPage(next: string, error = "") {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>知行工作台 · 访问验证</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #183a32; color: #203c33; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(440px, calc(100vw - 32px)); border: 1px solid #d4d4d8; border-radius: 18px; background: white; padding: 28px; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12); }
      h1 { margin: 0; font-size: 27px; letter-spacing: -.04em; }
      p { color: #52525b; line-height: 1.6; }
      label { display: grid; gap: 8px; font-weight: 700; }
      input { border: 1px solid #d4d4d8; border-radius: 12px; padding: 12px; font: inherit; }
      button { border: 0; border-radius: 12px; background: #047857; color: white; padding: 12px 16px; font-weight: 800; cursor: pointer; }
      .brand { display: grid; place-items: center; width: 50px; height: 50px; border-radius: 14px; background: #e8f1e5; color: #356447; font-size: 26px; font-weight: 700; }
      .eyebrow { margin: 22px 0 9px; font-size: 12px; letter-spacing: .1em; color: #5d825e; }
      input:focus { outline: 3px solid #a5cdb4; }
      button { width: 100%; min-height: 44px; }
      * { box-sizing: border-box; }
      .error { color: #b91c1c; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <div class="brand">知</div><p class="eyebrow">个人知识与协作系统</p><h1>进入知行工作台</h1>
      <p>使用读取凭证浏览资料，使用管理凭证处理任务和复核成果。凭证不会出现在页面地址中。</p>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/auth/read">
        <input type="hidden" name="next" value="${escapeHtml(next)}" />
        <label>访问凭证<input name="token" type="password" autocomplete="current-password" /></label>
        <p><button type="submit">验证并进入</button></p>
      </form>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
