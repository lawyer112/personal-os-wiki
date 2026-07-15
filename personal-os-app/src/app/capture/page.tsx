import { CaptureForm } from "@/components/CaptureForm";
import { captureBookmarklet } from "@/lib/bookmarklet";

export const dynamic = "force-dynamic";

type CapturePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CapturePage({ searchParams }: CapturePageProps) {
  const params = (await searchParams) ?? {};
  const initialValues = {
    content: first(params.content) ?? first(params.url),
  };

  return (
    <section className="mx-auto grid max-w-5xl gap-5">
      <div>
        <p className="ui-eyebrow">收集</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">
          先收下，不急着整理
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
          链接、片段和临时想法先进入输入箱。后续再整理成任务、记录或暂存内容。
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
          <CaptureForm initialValues={initialValues} />
        </div>

        <aside className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-bold text-[var(--ink)]">浏览器快速采集</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            把下面这段保存成书签。以后看到网页或资料，点一下就能送进输入箱。
          </p>
          <code className="mt-4 block overflow-x-auto rounded-2xl bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--ink-muted)]">
            {captureBookmarklet()}
          </code>
        </aside>
      </div>
    </section>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
