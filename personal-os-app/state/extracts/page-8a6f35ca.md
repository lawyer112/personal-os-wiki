import { prisma } from "@/lib/db";
import { wikiUrl } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = await prisma.note.findUniqueOrThrow({
    where: { id },
    include: { projects: { include: { project: true } } },
  });

  return (
    <article className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6">
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
        这是项目记录，不是长期知识页。长期资料请看{" "}
        <a
          href={wikiUrl("/notes")}
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline"
        >
          Personal Wiki
        </a>
        。 
      </div>
      <h1 className="text-3xl font-bold tracking-tight">{note.title}</h1>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600">
        {note.tags.map((tag) => (
          <span key={tag} className="rounded-lg border border-zinc-200 px-2 py-1">
            #{tag}
          </span>
        ))}
        {note.concepts.map((concept) => (
          <span
            key={concept}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700"
          >
            [[{concept}]]
          </span>
        ))}
      </div>
      <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
        {note.body}
      </div>
      <div className="mt-6 rounded-lg bg-zinc-50 p-3 text-xs leading-5 text-zinc-500">
        存档路径：{note.markdownPath}
      </div>
    </article>
  );
}
