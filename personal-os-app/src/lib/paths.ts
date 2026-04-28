import path from "node:path";

export function vaultDir() {
  return resolveDataPath(process.env.PERSONAL_OS_VAULT_DIR, "vault");
}

export function attachmentDir() {
  return resolveDataPath(process.env.PERSONAL_OS_ATTACHMENT_DIR, "attachments");
}

function resolveDataPath(configuredPath: string | undefined, fallback: string) {
  if (!configuredPath) {
    return path.join(process.cwd(), "data", fallback);
  }

  const normalized = configuredPath
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .replace(/^data\//, "");
  return path.join(process.cwd(), "data", normalized);
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
