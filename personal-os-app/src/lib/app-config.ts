export const personalOsUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const personalWikiUrl =
  process.env.NEXT_PUBLIC_WIKI_URL ?? "http://localhost:3422";

export function wikiUrl(path = "") {
  const base = personalWikiUrl.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function wikiOpenUrl(path = "/") {
  const base = personalOsUrl.replace(/\/$/, "");
  const next = path.startsWith("/") ? path : `/${path}`;
  return `${base}/api/wiki/open?next=${encodeURIComponent(next)}`;
}
