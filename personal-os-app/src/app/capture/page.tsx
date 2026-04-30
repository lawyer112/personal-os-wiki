import { CaptureForm } from "@/components/CaptureForm";

export const dynamic = "force-dynamic";

type CapturePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CapturePage({ searchParams }: CapturePageProps) {
  const params = (await searchParams) ?? {};
  const initialValues = {
    url: first(params.url),
    title: first(params.title),
    selection: first(params.selection),
    note: first(params.note),
  };

  return (
    <section className="mx-auto max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Capture</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Save links, selections, and loose thoughts into the Personal OS Inbox.
            Processing cadence stays with your agent workflow.
          </p>

          <div className="mt-5 rounded-lg border border-zinc-200 bg-white p-5">
            <CaptureForm initialValues={initialValues} />
          </div>
        </div>

        <aside className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="text-sm font-bold text-zinc-950">Bookmarklet</div>
          <code className="mt-3 block overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs leading-5 text-zinc-50">
            {bookmarklet()}
          </code>
        </aside>
      </div>
    </section>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function bookmarklet() {
  return `javascript:(()=>{const b="http://localhost:3000/capture";const q=new URLSearchParams({url:location.href,title:document.title,selection:String(getSelection())});open(b+"?"+q.toString(),"_blank","noopener,noreferrer");})();`;
}
