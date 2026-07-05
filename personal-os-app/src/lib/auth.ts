export const PERSONAL_OS_READ_COOKIE = "personal_os_read";

export function isPersonalOsAuthDisabled() {
  const value = process.env.PERSONAL_OS_AUTH_DISABLED?.trim().toLowerCase();
  return value === "true";
}

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
  return Boolean(token && allowedTokens.some((allowed) => token === allowed));
}

export function requestHasReadAccess(headers: Headers, allowedTokens = configuredReadTokens()) {
  return (
    tokenAllowed(bearerToken(headers), allowedTokens) ||
    tokenAllowed(cookieToken(headers.get("cookie")), allowedTokens)
  );
}
