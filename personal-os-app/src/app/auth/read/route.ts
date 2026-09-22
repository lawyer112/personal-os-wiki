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
      *{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 20% 20%,#566d3226,transparent 60%),#101512;color:#e8ecdf;font-family:"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif}
      main{width:min(920px,100%);display:grid;grid-template-columns:1fr 1fr;border:1px solid #404c36;border-radius:18px;overflow:hidden;background:#191f1b;box-shadow:0 30px 90px #0003;animation:arrive .7s cubic-bezier(.22,1,.36,1) both}.intro{padding:45px 40px;background:radial-gradient(ellipse at 60% 80%,#7a934323,transparent 65%),#222d21;border-right:1px solid #404c36;position:relative;overflow:hidden}.seal{height:36px;width:36px;border:1px solid #acc48d;transform:rotate(45deg);display:grid;place-items:center;margin:8px 0 35px}.seal:after{content:"";width:20px;height:20px;border:1px solid #acc48d}.intro h2{font-family:"Songti SC","SimSun",serif;font-size:35px;font-weight:400;line-height:1.6;letter-spacing:.04em;margin:0;color:#d9e3c6}.intro p{font-size:12px;line-height:2;color:#afbea3}.rings{width:230px;height:100px;position:relative;margin:34px auto 15px;transform:rotate(-22deg);animation:unfold 1.5s cubic-bezier(.22,1,.36,1) both}.rings i{position:absolute;inset:0;border:1px solid #b8c79a55;border-radius:50%;transform:rotate(calc(var(--i)*7deg))}.caption{font-size:10px;color:#a2b28f;letter-spacing:.1em}.access{padding:57px 40px 43px;align-self:center}.eyebrow{color:#b8ce9d;font-size:11px;letter-spacing:.1em;margin:0 0 17px}h1{font-size:24px;font-weight:550;letter-spacing:.03em;margin:0 0 18px}p{color:#a5b09e;font-size:12px;line-height:1.9}label{display:grid;gap:11px;font-size:12px;font-weight:500;margin-top:27px}input{width:100%;min-height:46px;border:1px solid #4a5940;border-radius:8px;background:#101810;color:#edf0e1;padding:12px;font:inherit}button{width:100%;min-height:45px;border:1px solid #c7dda8;background:#c7dda8;color:#20311a;border-radius:8px;font:inherit;font-weight:550;font-size:13px;cursor:pointer;transition:transform .2s,background .2s}button:hover{background:#daebbe;transform:translateY(-2px)}input:focus-visible,button:focus-visible{outline:2px solid #a5c48b;outline-offset:3px}.error{color:#edaf94;font-size:12px;border-left:2px solid #ca9678;padding-left:12px}.privacy{border-top:1px solid #34412f;padding-top:19px;margin-top:23px;font-size:10px;color:#9eae96}.footer{text-align:center;font-size:10px;color:#8c9b80;letter-spacing:.12em;margin-top:24px}@keyframes arrive{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes unfold{from{opacity:0;transform:rotate(-35deg) scale(.8)}to{opacity:1;transform:rotate(-22deg) scale(1)}}@media(max-width:640px){main{grid-template-columns:1fr;max-width:410px}.intro{padding:28px;border-right:0;border-bottom:1px solid #404c36}.intro h2{font-size:29px;line-height:1.45}.seal{margin:5px 0 22px;height:28px;width:28px}.seal:after{width:15px;height:15px}.rings,.caption{display:none}.intro p{margin-bottom:0}.access{padding:29px}h1{font-size:22px}.eyebrow{font-size:10px}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}
    </style>
  </head>
  <body>
    <div><main>
      <section class="intro" aria-label="关于知行"><div class="seal" aria-hidden="true"></div><h2>把想法，<br>写成下一步。</h2><p>你的知识，自成宇宙。<br>从每一次记录，到每一份可验证的交付。</p><div class="rings" aria-hidden="true">${Array.from({length:12}, (_,i) => `<i style="--i:${i}"></i>`).join("")}</div><span class="caption">知识沉淀 / 行动发生</span></section>
      <section class="access"><p class="eyebrow">个人知识与协作系统</p><h1>进入知行工作台</h1>
      <p>使用读取凭证浏览资料，使用管理凭证<br>处理任务与复核成果。</p>
      ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/auth/read">
        <input type="hidden" name="next" value="${escapeHtml(next)}" />
        <label>访问凭证<input name="token" type="password" autocomplete="current-password" placeholder="输入你的访问凭证" required /></label>
        <p><button type="submit">验证并进入　↗</button></p>
      </form><p class="privacy">凭证不会出现在页面地址中。<br>请仅在你信任的内部入口使用管理凭证。</p></section>
    </main><p class="footer">知行工作台 · 本地优先</p></div>
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
