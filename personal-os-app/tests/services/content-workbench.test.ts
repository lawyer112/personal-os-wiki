import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getContentWorkbenchSnapshot } from "@/lib/content-workbench";

describe("content workbench scanner", () => {
  it("indexes article packages, workflow evidence, and hash-deduped images", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "content-workbench-"));
    try {
      const pkg = path.join(root, "20260709_7am");
      await mkdir(path.join(pkg, "01_ai_daily", "images"), { recursive: true });
      await mkdir(path.join(pkg, "sources"), { recursive: true });
      const imageBytes = Buffer.from("fake-png-bytes");
      await writeFile(path.join(pkg, "01_ai_daily", "article.md"), "# AI日报 7月9日\n正文");
      await writeFile(path.join(pkg, "01_ai_daily", "article.html"), "<html><title>AI日报 HTML</title></html>");
      await writeFile(path.join(pkg, "01_ai_daily", "images", "cover.png"), imageBytes);
      await writeFile(path.join(pkg, "01_ai_daily", "images", "duplicate.png"), imageBytes);
      await writeFile(path.join(pkg, "sources", "evidence.json"), "{}");
      await writeFile(path.join(pkg, "final_gate.json"), "{\"status\":\"pass\"}");

      const snapshot = await getContentWorkbenchSnapshot({ roots: [root], packageLimit: 10, assetLimit: 10 });
      const expectedHash = createHash("sha256").update(imageBytes).digest("hex");

      expect(snapshot.packageCount).toBe(1);
      expect(snapshot.articleCount).toBe(2);
      expect(snapshot.imageCount).toBe(2);
      expect(snapshot.uniqueImageCount).toBe(1);
      expect(snapshot.duplicateImageCount).toBe(1);
      expect(snapshot.assets.map((asset) => asset.hash)).toEqual([expectedHash, expectedHash]);
      expect(snapshot.packages[0].articles.map((article) => article.title)).toContain("AI日报 7月9日");
      expect(snapshot.packages[0].workflow.find((step) => step.key === "source_collected")?.status).toBe("done");
      expect(snapshot.packages[0].workflow.find((step) => step.key === "verified")?.status).toBe("done");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
