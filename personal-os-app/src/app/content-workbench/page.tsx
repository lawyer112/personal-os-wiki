import { getContentWorkbenchSnapshot } from "@/lib/content-workbench";

export const dynamic = "force-dynamic";

const statusClasses = {
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  partial: "border-amber-200 bg-amber-50 text-amber-700",
  missing: "border-zinc-200 bg-zinc-50 text-zinc-400",
};

export default async function ContentWorkbenchPage() {
  const snapshot = await getContentWorkbenchSnapshot({ packageLimit: 80, assetLimit: 40 });
  const latestPackages = snapshot.packages.slice(0, 24);
  const latestAssets = snapshot.assets.slice(0, 40);

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl bg-zinc-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-emerald-300">Content Workbench v0</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">公众号内容包 / 图片库 / Workflow 总控台</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
              先上线可用版：扫描每日公众号 package、HTML、Markdown、图片和门禁文件；图片按 SHA-256 去重，支持全局预览和下载。
              Payload CMS 做长期底座，当前页面先把真实资产入口跑起来。
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-zinc-200">
            <div>生成时间：{formatDateTime(snapshot.generatedAt)}</div>
            <div>数据根：{snapshot.roots.length || 0} 个</div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        <MetricCard label="内容包" value={snapshot.packageCount} />
        <MetricCard label="文章文件" value={snapshot.articleCount} />
        <MetricCard label="图片文件" value={snapshot.imageCount} />
        <MetricCard label="去重后图片" value={snapshot.uniqueImageCount} />
        <MetricCard label="重复图片" value={snapshot.duplicateImageCount} muted />
      </section>

      {snapshot.missingRoots.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="font-bold">未挂载的数据根</div>
          <div className="mt-2 grid gap-1 font-mono text-xs">
            {snapshot.missingRoots.map((root) => (
              <span key={root}>{root}</span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">最近内容包</h2>
              <p className="mt-1 text-sm text-zinc-500">按修改时间排序，直接看每个包缺哪一步。</p>
            </div>
            <a
              href="/api/content-workbench?packageLimit=80&assetLimit=120"
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              JSON API
            </a>
          </div>
          <div className="grid gap-3">
            {latestPackages.map((pkg) => (
              <article key={pkg.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-base font-black">{pkg.title}</h3>
                    <div className="mt-1 text-xs text-zinc-500">
                      {pkg.rootLabel} / {pkg.relativePath} · {formatDateTime(pkg.modifiedAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge>{pkg.articleCount} 文</Badge>
                    <Badge>{pkg.htmlCount} HTML</Badge>
                    <Badge>{pkg.imageCount} 图</Badge>
                    <Badge>{formatBytes(pkg.totalBytes)}</Badge>
                  </div>
                </div>

                {pkg.articles.length > 0 ? (
                  <div className="mt-3 grid gap-1 text-sm text-zinc-700">
                    {pkg.articles.slice(0, 4).map((article) => (
                      <div key={article.path} className="truncate">
                        <span className="font-semibold">{article.title}</span>
                        <span className="ml-2 text-xs text-zinc-400">{article.relativePath}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  {pkg.workflow.map((step) => (
                    <div
                      key={step.key}
                      className={`rounded-lg border px-2.5 py-2 text-xs ${statusClasses[step.status]}`}
                      title={step.evidence}
                    >
                      <div className="font-bold">{step.label}</div>
                      <div className="mt-1 truncate opacity-80">{step.evidence}</div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-black">全局图片库</h2>
            <p className="mt-1 text-sm text-zinc-500">
              按文件内容 hash 去重；首屏只载入最近 40 张，缩略图可打开原图下载。
            </p>
          </div>
          <div className="grid max-h-[900px] grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            {latestAssets.map((asset) => (
              <a
                key={`${asset.hash}-${asset.path}`}
                href={asset.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.previewUrl}
                  alt={asset.relativePath}
                  loading="lazy"
                  className="h-36 w-full object-cover transition group-hover:scale-[1.02]"
                />
                <div className="p-2 text-xs">
                  <div className="truncate font-bold text-zinc-700">{asset.packageTitle}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-zinc-400">{asset.hash.slice(0, 12)}</div>
                  <div className="mt-1 text-zinc-500">{formatBytes(asset.bytes)} · {asset.extension}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-zinc-400">{label}</div>
      <div className={`mt-2 text-3xl font-black ${muted ? "text-zinc-500" : "text-zinc-950"}`}>{value}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-600">{children}</span>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
