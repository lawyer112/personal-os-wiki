import { NextResponse } from "next/server";
import {
  PERSONAL_OS_READ_COOKIE,
  configuredReadTokens,
  tokenAllowed,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const next = normalizeNext(new URL(request.url).searchParams.get("next"));
  const locale = resolveLocale(request);
  return html(loginPage(next, locale), 200, locale);
}

export async function POST(request: Request) {
  const locale = resolveLocale(request);
  const tokens = configuredReadTokens();
  if (tokens.length === 0) {
    return html(`<p>${escapeHtml(copy(locale).notConfigured)}</p>`, 503, locale);
  }

  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const next = normalizeNext(String(form.get("next") ?? "/"));

  if (!tokenAllowed(token, tokens)) {
    return html(loginPage(next, locale, copy(locale).invalidToken), 401, locale);
  }

  const response = NextResponse.redirect(readRedirectUrl(next, request));
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

function readRedirectUrl(next: string, request: Request) {
  return new URL(next, publicRequestBaseUrl(request));
}

function publicRequestBaseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto")?.trim() || "http";
    return `${proto}://${forwardedHost}`;
  }

  const host = request.headers.get("host")?.trim();
  if (host) {
    const proto = isHttps(request) ? "https" : "http";
    return `${proto}://${host}`;
  }

  return request.url;
}

function html(body: string, status: number, locale: Locale) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Language": locale,
    },
  });
}

type Locale =
  | "en"
  | "zh-CN"
  | "zh-TW"
  | "ja"
  | "ko"
  | "es"
  | "fr"
  | "de";

type LoginCopy = {
  title: string;
  heading: string;
  intro: string;
  label: string;
  placeholder: string;
  button: string;
  hintLabel: string;
  notConfigured: string;
  invalidToken: string;
};

const DEFAULT_LOCALE: Locale = "en";

const LOGIN_COPY: Record<Locale, LoginCopy> = {
  en: {
    title: "Personal OS access",
    heading: "Personal OS access",
    intro:
      "This is not an account/password login. Paste the read access token for this private preview.",
    label: "Access token",
    placeholder: "read access token",
    button: "Open Personal OS",
    hintLabel: "Preview token",
    notConfigured: "Personal OS read access is not configured.",
    invalidToken: "Invalid access token.",
  },
  "zh-CN": {
    title: "Personal OS 访问",
    heading: "Personal OS 访问",
    intro: "这里不是账号密码登录。当前私有预览只需要输入只读访问口令。",
    label: "访问口令",
    placeholder: "输入只读访问口令",
    button: "打开 Personal OS",
    hintLabel: "预览口令",
    notConfigured: "Personal OS 只读访问还没有配置。",
    invalidToken: "访问口令不正确。",
  },
  "zh-TW": {
    title: "Personal OS 存取",
    heading: "Personal OS 存取",
    intro: "這裡不是帳號密碼登入。當前私有預覽只需要輸入唯讀存取口令。",
    label: "存取口令",
    placeholder: "輸入唯讀存取口令",
    button: "開啟 Personal OS",
    hintLabel: "預覽口令",
    notConfigured: "Personal OS 唯讀存取尚未設定。",
    invalidToken: "存取口令不正確。",
  },
  ja: {
    title: "Personal OS アクセス",
    heading: "Personal OS アクセス",
    intro:
      "これはアカウント/パスワードのログインではありません。この非公開プレビューの読み取り用アクセス token を入力してください。",
    label: "アクセス token",
    placeholder: "読み取り用アクセス token",
    button: "Personal OS を開く",
    hintLabel: "プレビュー token",
    notConfigured: "Personal OS の読み取りアクセスが設定されていません。",
    invalidToken: "アクセス token が正しくありません。",
  },
  ko: {
    title: "Personal OS 접근",
    heading: "Personal OS 접근",
    intro:
      "계정/비밀번호 로그인이 아닙니다. 이 비공개 프리뷰의 읽기 접근 토큰을 입력하세요.",
    label: "접근 토큰",
    placeholder: "읽기 접근 토큰",
    button: "Personal OS 열기",
    hintLabel: "프리뷰 토큰",
    notConfigured: "Personal OS 읽기 접근이 설정되지 않았습니다.",
    invalidToken: "접근 토큰이 올바르지 않습니다.",
  },
  es: {
    title: "Acceso a Personal OS",
    heading: "Acceso a Personal OS",
    intro:
      "No es un inicio de sesión con usuario y contraseña. Pega el token de lectura de esta vista previa privada.",
    label: "Token de acceso",
    placeholder: "token de lectura",
    button: "Abrir Personal OS",
    hintLabel: "Token de vista previa",
    notConfigured: "El acceso de lectura de Personal OS no está configurado.",
    invalidToken: "Token de acceso no válido.",
  },
  fr: {
    title: "Accès Personal OS",
    heading: "Accès Personal OS",
    intro:
      "Ce n'est pas une connexion par compte et mot de passe. Collez le token de lecture de cet aperçu privé.",
    label: "Token d'accès",
    placeholder: "token de lecture",
    button: "Ouvrir Personal OS",
    hintLabel: "Token de prévisualisation",
    notConfigured: "L'accès en lecture de Personal OS n'est pas configuré.",
    invalidToken: "Token d'accès invalide.",
  },
  de: {
    title: "Personal OS Zugriff",
    heading: "Personal OS Zugriff",
    intro:
      "Dies ist kein Konto/Passwort-Login. Füge das Lesezugriffs-Token für diese private Vorschau ein.",
    label: "Zugriffs-Token",
    placeholder: "Lesezugriffs-Token",
    button: "Personal OS öffnen",
    hintLabel: "Vorschau-Token",
    notConfigured: "Der Lesezugriff für Personal OS ist nicht konfiguriert.",
    invalidToken: "Ungültiges Zugriffstoken.",
  },
};

function loginPage(next: string, locale: Locale, error = "") {
  const text = copy(locale);
  const hint = process.env.PERSONAL_OS_READ_ACCESS_HINT?.trim();
  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(text.title)}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #eef1f4; color: #0f172a; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(440px, calc(100vw - 32px)); border: 1px solid #d4d4d8; border-radius: 18px; background: white; padding: 28px; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12); }
      h1 { margin: 0; font-size: 24px; }
      p { color: #52525b; line-height: 1.6; }
      label { display: grid; gap: 8px; font-weight: 700; }
      input { border: 1px solid #d4d4d8; border-radius: 12px; padding: 12px; font: inherit; }
      button { border: 0; border-radius: 12px; background: #047857; color: white; padding: 12px 16px; font-weight: 800; cursor: pointer; }
      code { border-radius: 8px; background: #f4f4f5; padding: 3px 6px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
      .error { color: #b91c1c; font-weight: 700; }
      .hint { border: 1px solid #bbf7d0; border-radius: 12px; background: #f0fdf4; color: #166534; padding: 10px 12px; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(text.heading)}</h1>
      <p>${escapeHtml(text.intro)}</p>
      ${hint ? `<p class="hint">${escapeHtml(text.hintLabel)}: <code>${escapeHtml(hint)}</code></p>` : ""}
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/auth/read">
        <input type="hidden" name="next" value="${escapeHtml(next)}" />
        <label>${escapeHtml(text.label)}<input name="token" type="password" autocomplete="current-password" placeholder="${escapeHtml(text.placeholder)}" /></label>
        <p><button type="submit">${escapeHtml(text.button)}</button></p>
      </form>
    </main>
  </body>
</html>`;
}

function copy(locale: Locale) {
  return LOGIN_COPY[locale] ?? LOGIN_COPY[DEFAULT_LOCALE];
}

function resolveLocale(request: Request): Locale {
  const url = new URL(request.url);
  const explicit = normalizeLocale(url.searchParams.get("lang") ?? "");
  if (explicit) {
    return explicit;
  }

  for (const part of (request.headers.get("accept-language") ?? "").split(",")) {
    const tag = normalizeLocale(part.split(";")[0]?.trim() ?? "");
    if (tag) {
      return tag;
    }
  }

  return DEFAULT_LOCALE;
}

function normalizeLocale(value: string): Locale | undefined {
  const tag = value.trim().replace("_", "-").toLowerCase();
  if (!tag) {
    return undefined;
  }
  if (tag === "zh" || tag === "zh-cn" || tag === "zh-hans") {
    return "zh-CN";
  }
  if (tag === "zh-tw" || tag === "zh-hk" || tag === "zh-hant") {
    return "zh-TW";
  }
  if (tag.startsWith("ja")) return "ja";
  if (tag.startsWith("ko")) return "ko";
  if (tag.startsWith("es")) return "es";
  if (tag.startsWith("fr")) return "fr";
  if (tag.startsWith("de")) return "de";
  if (tag.startsWith("en")) return "en";
  return undefined;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
