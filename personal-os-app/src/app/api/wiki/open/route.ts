import { personalOsUrl, wikiUrl } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = normalizeWikiNext(url.searchParams.get("next"));
  const token = process.env.WIKI_READ_TOKEN;

  if (!token) {
    return Response.json(
      { ok: false, error: "WIKI_READ_TOKEN is not configured" },
      { status: 503 },
    );
  }

  const targetUrl = wikiUrl(next);
  if (canShareCookie(personalOsUrl, targetUrl) || canShareCookie(request.url, targetUrl)) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: targetUrl,
        "Set-Cookie": readCookieHeader(token, targetUrl),
      },
    });
  }

  return Response.json(
    {
      ok: false,
      error:
        "Personal OS and Personal Wiki must share a hostname for browser handoff. Open Wiki directly or use a same-host reverse proxy.",
    },
    { status: 409 },
  );
}

function normalizeWikiNext(value: string | null) {
  const next = value?.trim() || "/";
  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

function canShareCookie(requestUrl: string, targetUrl: string) {
  return new URL(requestUrl).hostname === new URL(targetUrl).hostname;
}

function readCookieHeader(token: string, targetUrl: string) {
  const secure = new URL(targetUrl).protocol === "https:" ? "; Secure" : "";
  return `personal_wiki_read=${token}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}
