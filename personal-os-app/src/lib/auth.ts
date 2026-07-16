import { createHash, timingSafeEqual } from "node:crypto";

export const PERSONAL_OS_READ_COOKIE = "personal_os_read";

export function configuredReadTokens() {
  return [
    process.env.PERSONAL_OS_READ_TOKEN,
    process.env.PERSONAL_OS_API_TOKEN,
  ].filter((token): token is string => Boolean(token && token !== "change-me"));
}

export function bearerToken(headers: Headers) {
  const header = headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    return "";
  }
  return header.slice("Bearer ".length);
}

export function cookieToken(cookieHeader: string | null, name = PERSONAL_OS_READ_COOKIE) {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) {
      return rawValue.join("=");
    }
  }
  return "";
}

export function tokenAllowed(token: string, allowedTokens: string[]) {
  if (!token) {
    return false;
  }

  const tokenDigest = digestToken(token);
  return allowedTokens.some((allowed) => {
    if (!allowed) {
      return false;
    }
    return timingSafeEqual(tokenDigest, digestToken(allowed));
  });
}

function digestToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest();
}

export function requestHasTokenAccess(headers: Headers, allowedTokens: string[]) {
  return (
    tokenAllowed(bearerToken(headers), allowedTokens) ||
    tokenAllowed(cookieToken(headers.get("cookie")), allowedTokens)
  );
}

export function requestHasReadAccess(
  headers: Headers,
  allowedTokens = configuredReadTokens(),
) {
  return requestHasTokenAccess(headers, allowedTokens);
}
