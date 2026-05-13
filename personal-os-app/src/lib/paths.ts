import path from "node:path";

export function vaultDir() {
  return resolveDataPath(process.env.PERSONAL_OS_VAULT_DIR, "vault");
}

export function attachmentDir() {
  return resolveDataPath(process.env.PERSONAL_OS_ATTACHMENT_DIR, "attachments");
}

export function resolveDataPath(
  configuredPath: string | undefined,
  fallback: string,
) {
  const dataRoot = path.resolve(process.cwd(), "data");
  const rawPath = configuredPath?.trim() || fallback;
  const candidate = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(dataRoot, stripDataPrefix(rawPath));
  const relative = path.relative(dataRoot, candidate);

  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return candidate;
  }

  throw new Error("Configured data path must stay inside the data directory");
}

function stripDataPrefix(value: string) {
  const normalized = value.replaceAll("\\", "/").replace(/^\.?\//, "");
  if (normalized === "data") {
    return "";
  }
  return normalized.replace(/^data\//, "");
}

export function slugifyTitle(title: string) {
  const ascii = title
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return ascii || "note";
}

export function markdownPathForTitle(title: string, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  const stamp = date
    .toISOString()
    .slice(11, 23)
    .replaceAll(":", "")
    .replace(".", "");
  return path.join(day, `${slugifyTitle(title)}-${stamp}.md`);
}
