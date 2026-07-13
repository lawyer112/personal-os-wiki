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
    return html("Personal OS read auth is not configured.", 503);
  }

  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const next = normalizeNext(String(form.get("next") ?? "/"));

  if (!tokenAllowed(token, tokens)) {
    return html(loginPage(next, "Invalid read token."), 401);
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
  if (!next.startsWith("/") || next.startsWith("//")) {
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
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Personal OS read access</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #eef1f4; color: #0f172a; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(440px, calc(100vw - 32px)); border: 1px solid #d4d4d8; border-radius: 18px; background: white; padding: 28px; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12); }
      h1 { margin: 0; font-size: 24px; }
      p { color: #52525b; line-height: 1.6; }
      label { display: grid; gap: 8px; font-weight: 700; }
      input { border: 1px solid #d4d4d8; border-radius: 12px; padding: 12px; font: inherit; }
      button { border: 0; border-radius: 12px; background: #047857; color: white; padding: 12px 16px; font-weight: 800; cursor: pointer; }
      .error { color: #b91c1c; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>Read access</h1>
      <p>Paste your Personal OS read token. It is submitted in the request body and stored as an HttpOnly cookie.</p>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/auth/read">
        <input type="hidden" name="next" value="${escapeHtml(next)}" />
        <label>Read token<input name="token" type="password" autocomplete="current-password" /></label>
        <p><button type="submit">Open Personal OS</button></p>
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
