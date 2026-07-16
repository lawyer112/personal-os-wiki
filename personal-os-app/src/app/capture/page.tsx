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
    <section className="mx-auto max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Capture</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Save one raw link or thought. Agent enrichment happens later.
          </p>

          <div className="mt-5 rounded-lg border border-zinc-200 bg-white p-5">
            <CaptureForm initialValues={initialValues} />
          </div>
        </div>

        <aside className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="text-sm font-bold text-zinc-950">Bookmarklet</div>
          <code className="mt-3 block overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs leading-5 text-zinc-50">
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
