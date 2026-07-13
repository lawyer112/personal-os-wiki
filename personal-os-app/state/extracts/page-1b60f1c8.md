import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const notes = await prisma.note.findMany({
    orderBy: { updatedAt: "desc" },
    include: { projects: { include: { project: true } } },
  });

  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight">项目记录</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        这里保留任务处理摘要和项目上下文。长期知识、链接摘要和语音转写沉淀在知识库。
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {notes.map((note) => (
          <Link
            key={note.id}
            href={`/notes/${note.id}`}
            className="rounded-lg border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
          >
            <div className="font-semibold text-zinc-950">{note.title}</div>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-600">
              {note.body}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg border border-zinc-200 px-2 py-1 text-zinc-600"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
