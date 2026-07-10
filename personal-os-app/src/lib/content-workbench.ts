import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import * as path from "node:path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);
const ARTICLE_EXTENSIONS = new Set([".html", ".md", ".markdown"]);
const DATA_EXTENSIONS = new Set([".json", ".yaml", ".yml"]);
const IGNORE_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "__pycache__",
  "reference_repos",
  "dist",
  "build",
]);

export type ContentWorkbenchStepStatus = "done" | "missing" | "partial";

export type ContentWorkbenchWorkflowStep = {
  key: string;
  label: string;
  status: ContentWorkbenchStepStatus;
  evidence: string;
};

export type ContentWorkbenchArticle = {
  title: string;
  path: string;
  relativePath: string;
  extension: string;
  bytes: number;
  modifiedAt: string;
};

export type ContentWorkbenchAsset = {
  hash: string;
  path: string;
  relativePath: string;
  packageId: string;
  packageTitle: string;
  extension: string;
  bytes: number;
  modifiedAt: string;
  previewUrl: string;
};

export type ContentWorkbenchPackage = {
  id: string;
  title: string;
  rootLabel: string;
  path: string;
  relativePath: string;
  modifiedAt: string;
  articleCount: number;
  htmlCount: number;
  markdownCount: number;
  imageCount: number;
  dataFileCount: number;
  totalBytes: number;
  articles: ContentWorkbenchArticle[];
  assets: ContentWorkbenchAsset[];
  workflow: ContentWorkbenchWorkflowStep[];
};

export type ContentWorkbenchSnapshot = {
  generatedAt: string;
  roots: string[];
  packageCount: number;
  articleCount: number;
  imageCount: number;
  uniqueImageCount: number;
  duplicateImageCount: number;
  packages: ContentWorkbenchPackage[];
  assets: ContentWorkbenchAsset[];
  missingRoots: string[];
};

type WalkFile = {
  absolutePath: string;
  relativePath: string;
  extension: string;
  bytes: number;
  modifiedMs: number;
};

type SnapshotOptions = {
  roots?: string[];
  packageLimit?: number;
  assetLimit?: number;
  maxDepth?: number;
};

export async function getContentWorkbenchSnapshot(
  options: SnapshotOptions = {},
): Promise<ContentWorkbenchSnapshot> {
  const configuredRoots = options.roots ?? getConfiguredRoots();
  const existingRoots: string[] = [];
  const missingRoots: string[] = [];

  for (const root of configuredRoots) {
    if (await pathExists(root)) {
      existingRoots.push(root);
    } else {
      missingRoots.push(root);
    }
  }

  const discovered: ContentWorkbenchPackage[] = [];
  for (const root of existingRoots) {
    const packageRoots = await discoverPackageRoots(root);
    for (const packageRoot of packageRoots) {
      const summary = await summarizePackage(root, packageRoot, {
        maxDepth: options.maxDepth ?? 8,
        assetLimit: options.assetLimit ?? 320,
      });
      if (summary.articleCount || summary.imageCount || summary.dataFileCount) {
        discovered.push(summary);
      }
    }
  }

  const packages = discovered
    .sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))
    .slice(0, options.packageLimit ?? 80);
  const assets = packages.flatMap((pkg) => pkg.assets);
  const uniqueHashes = new Set(assets.map((asset) => asset.hash));

  return {
    generatedAt: new Date().toISOString(),
    roots: existingRoots,
    packageCount: packages.length,
    articleCount: packages.reduce((sum, pkg) => sum + pkg.articleCount, 0),
    imageCount: packages.reduce((sum, pkg) => sum + pkg.imageCount, 0),
    uniqueImageCount: uniqueHashes.size,
    duplicateImageCount: Math.max(0, assets.length - uniqueHashes.size),
    packages,
    assets: assets
      .sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))
      .slice(0, options.assetLimit ?? 320),
    missingRoots,
  };
}

export async function findContentWorkbenchAsset(hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return null;
  }

  const snapshot = await getContentWorkbenchSnapshot({
    packageLimit: 200,
    assetLimit: 5000,
  });
  const asset = snapshot.assets.find((item) => item.hash === hash);
  if (!asset || !IMAGE_EXTENSIONS.has(asset.extension)) {
    return null;
  }

  return {
    ...asset,
    mimeType: imageMimeType(asset.extension),
    stream: createReadStream(asset.path),
  };
}

function getConfiguredRoots() {
  const env = process.env.CONTENT_WORKBENCH_ROOTS;
  const roots = env
    ? env.split(path.delimiter).map((item) => item.trim()).filter(Boolean)
    : [
        "/data/content-workbench",
        "/app/data/content-workbench",
        "/home/lawyer112/content-workbench-data",
        "/Users/xingqiwu/.hermes/profiles/honglang-poster/workspace/daily_content_package",
        "/Users/xingqiwu/.hermes/profiles/honglang-poster/workspace/draft_runs",
      ];

  return Array.from(new Set(roots.map((root) => path.resolve(root))));
}

async function discoverPackageRoots(root: string) {
  const entries = await safeReaddir(root);
  const dirs = entries
    .filter((entry) => entry.isDirectory() && !IGNORE_DIRS.has(entry.name))
    .map((entry) => path.join(root, entry.name));

  if (isKnownPackageContainer(root)) {
    return dirs;
  }

  const hasDirectContent = await directoryHasDirectContent(root);
  if (hasDirectContent) {
    return [root, ...dirs.filter((dir) => looksLikePackageDir(dir))];
  }

  return dirs.filter((dir) => looksLikePackageDir(dir));
}

async function summarizePackage(
  root: string,
  packageRoot: string,
  options: { maxDepth: number; assetLimit: number },
): Promise<ContentWorkbenchPackage> {
  const files = await walkFiles(packageRoot, packageRoot, options.maxDepth);
  const imageFiles = files.filter((file) => IMAGE_EXTENSIONS.has(file.extension));
  const articleFiles = files.filter((file) => ARTICLE_EXTENSIONS.has(file.extension));
  const dataFiles = files.filter((file) => DATA_EXTENSIONS.has(file.extension));
  const modifiedMs = Math.max(...files.map((file) => file.modifiedMs), 0);
  const packageId = stablePackageId(packageRoot);
  const title = titleFromPackagePath(packageRoot);
  const rootLabel = path.basename(root) || root;

  const articles: ContentWorkbenchArticle[] = [];
  for (const file of articleFiles.slice(0, 12)) {
    articles.push({
      title: await extractArticleTitle(file.absolutePath, file.relativePath),
      path: file.absolutePath,
      relativePath: file.relativePath,
      extension: file.extension,
      bytes: file.bytes,
      modifiedAt: new Date(file.modifiedMs).toISOString(),
    });
  }

  const assets: ContentWorkbenchAsset[] = [];
  for (const file of imageFiles.slice(0, options.assetLimit)) {
    const hash = await sha256File(file.absolutePath);
    assets.push({
      hash,
      path: file.absolutePath,
      relativePath: file.relativePath,
      packageId,
      packageTitle: title,
      extension: file.extension,
      bytes: file.bytes,
      modifiedAt: new Date(file.modifiedMs).toISOString(),
      previewUrl: `/api/content-workbench/assets/${hash}`,
    });
  }

  return {
    id: packageId,
    title,
    rootLabel,
    path: packageRoot,
    relativePath: path.relative(root, packageRoot) || ".",
    modifiedAt: new Date(modifiedMs || Date.now()).toISOString(),
    articleCount: articleFiles.length,
    htmlCount: articleFiles.filter((file) => file.extension === ".html").length,
    markdownCount: articleFiles.filter((file) => file.extension === ".md" || file.extension === ".markdown").length,
    imageCount: imageFiles.length,
    dataFileCount: dataFiles.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    articles,
    assets,
    workflow: buildWorkflow(files),
  };
}

function buildWorkflow(files: WalkFile[]): ContentWorkbenchWorkflowStep[] {
  const rels = files.map((file) => file.relativePath.toLowerCase());
  const count = (predicate: (file: WalkFile) => boolean) => files.filter(predicate).length;
  const sources = rels.filter((rel) => rel.includes("source") || rel.includes("evidence"));
  const md = count((file) => file.extension === ".md" || file.extension === ".markdown");
  const html = count((file) => file.extension === ".html");
  const images = count((file) => IMAGE_EXTENSIONS.has(file.extension));
  const manifests = rels.filter((rel) => rel.includes("manifest") || rel.includes("package") || rel.includes("summary"));
  const draft = rels.filter((rel) => rel.includes("draft") || rel.includes("media_id") || rel.includes("upload"));
  const verify = rels.filter((rel) => rel.includes("verify") || rel.includes("gate") || rel.includes("validation"));

  return [
    step("source_collected", "信源 / 证据", sources.length > 0, `${sources.length} 个 source/evidence 文件`),
    step("articles_generated", "文章生成", md > 0, `${md} 个 Markdown`),
    step("images_ready", "图片就绪", images > 0, `${images} 张图片`),
    step("html_built", "HTML 包", html > 0, `${html} 个 HTML`),
    step("manifest_ready", "包清单", manifests.length > 0, `${manifests.length} 个 manifest/package/summary 文件`),
    step("draft_uploaded", "草稿上传记录", draft.length > 0, `${draft.length} 个 draft/upload 相关文件`),
    step("verified", "门禁 / 回查", verify.length > 0, `${verify.length} 个 gate/verify/validation 文件`),
    step(
      "archived",
      "可归档",
      md > 0 && html > 0 && images > 0,
      md > 0 && html > 0 && images > 0
        ? "文章、HTML、图片三件套齐全"
        : `缺少${[
            md === 0 ? "Markdown" : "",
            html === 0 ? "HTML" : "",
            images === 0 ? "图片" : "",
          ].filter(Boolean).join("、")}`,
    ),
  ];
}

function step(
  key: string,
  label: string,
  done: boolean,
  evidence: string,
): ContentWorkbenchWorkflowStep {
  return { key, label, status: done ? "done" : "missing", evidence };
}

async function walkFiles(base: string, current: string, maxDepth: number): Promise<WalkFile[]> {
  let currentStat;
  try {
    currentStat = await stat(current);
  } catch {
    return [];
  }

  if (currentStat.isFile()) {
    return [fileToWalkFile(base, current, currentStat)];
  }
  if (!currentStat.isDirectory() || maxDepth < 0) {
    return [];
  }

  const entries = await safeReaddir(current);
  const result: WalkFile[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || IGNORE_DIRS.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await walkFiles(base, absolutePath, maxDepth - 1)));
    } else if (entry.isFile()) {
      const fileStat = await stat(absolutePath);
      result.push(fileToWalkFile(base, absolutePath, fileStat));
    }
  }
  return result;
}

function fileToWalkFile(base: string, absolutePath: string, fileStat: { size: number; mtimeMs: number }) {
  return {
    absolutePath,
    relativePath: path.relative(base, absolutePath),
    extension: path.extname(absolutePath).toLowerCase(),
    bytes: fileStat.size,
    modifiedMs: fileStat.mtimeMs,
  };
}

async function safeReaddir(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function directoryHasDirectContent(dir: string) {
  const entries = await safeReaddir(dir);
  return entries.some((entry) => {
    if (!entry.isFile()) return false;
    const ext = path.extname(entry.name).toLowerCase();
    return ARTICLE_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext) || DATA_EXTENSIONS.has(ext);
  });
}

function isKnownPackageContainer(root: string) {
  const name = path.basename(root).toLowerCase();
  return ["daily_content_package", "draft_runs", "content-workbench", "content-workbench-data"].includes(name);
}

function looksLikePackageDir(dir: string) {
  const name = path.basename(dir).toLowerCase();
  return /20\d{6}/.test(name) || name.includes("wechat") || name.includes("draft") || name.includes("package");
}

function stablePackageId(value: string) {
  return createHash("sha1").update(path.resolve(value)).digest("hex").slice(0, 16);
}

function titleFromPackagePath(packageRoot: string) {
  return path.basename(packageRoot).replace(/[_-]/g, " ");
}

async function extractArticleTitle(filePath: string, fallback: string) {
  try {
    const head = (await readFile(filePath, "utf8")).slice(0, 8000);
    const htmlTitle = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    if (htmlTitle) return cleanTitle(htmlTitle);
    const h1 = head.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? head.match(/^#\s+(.+)$/m)?.[1];
    if (h1) return cleanTitle(h1);
  } catch {
    // keep fallback
  }
  return path.basename(fallback);
}

function cleanTitle(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

async function sha256File(filePath: string) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function pathExists(value: string) {
  try {
    await stat(value);
    return true;
  } catch {
    return false;
  }
}

function imageMimeType(extension: string) {
  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    default:
      return "image/png";
  }
}
