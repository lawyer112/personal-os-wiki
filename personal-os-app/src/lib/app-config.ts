export const personalOsUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const personalWikiUrl =
  process.env.NEXT_PUBLIC_WIKI_URL ?? "http://localhost:3422";

export const personalWikiInternalUrl =
  process.env.PERSONAL_WIKI_INTERNAL_URL ?? personalWikiUrl;

function joinUrl(baseUrl: string, path = "") {
  const base = baseUrl.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function wikiUrl(path = "") {
  return joinUrl(personalWikiUrl, path);
}

export function wikiApiUrl(path = "") {
  return joinUrl(personalWikiInternalUrl, path);
}

export function wikiOpenUrl(path = "/") {
  const base = personalOsUrl.replace(/\/$/, "");
  const next = path.startsWith("/") ? path : `/${path}`;
  return `${base}/api/wiki/open?next=${encodeURIComponent(next)}`;
}
