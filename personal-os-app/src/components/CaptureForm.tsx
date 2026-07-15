"use client";

import Link from "next/link";
import { useActionState, type DragEvent } from "react";
import {
  type CaptureActionState,
  createCaptureAction,
} from "@/app/capture/actions";

type CaptureFormProps = {
  initialValues: {
    content?: string;
  };
};

const initialState: CaptureActionState = { ok: false };

export function CaptureForm({ initialValues }: CaptureFormProps) {
  const [state, formAction, pending] = useActionState(
    createCaptureAction,
    initialState,
  );
  const values = state.values ?? initialValues;

  function onDrop(event: DragEvent<HTMLTextAreaElement>) {
    const dropped =
      event.dataTransfer.getData("text/uri-list") ||
      event.dataTransfer.getData("text/plain");
    if (!dropped) {
      return;
    }
    event.preventDefault();
    event.currentTarget.value = dropped.trim();
  }

  return (
    <form action={formAction} className="grid gap-5">
      {state.ok ? (
        <div className="rounded-2xl border border-[var(--brand)] bg-[var(--brand-soft)] px-4 py-3 text-sm font-semibold text-[var(--brand-strong)]">
          已保存到输入箱
          {state.itemId ? (
            <span className="ml-2 font-mono text-xs text-[var(--ink-muted)]">
              {state.itemId}
            </span>
          ) : null}
          <Link href="/inbox" className="ml-3 underline">
            打开输入箱
          </Link>
        </div>
      ) : null}

      {state.error ? (
        <div className="rounded-2xl border border-[var(--blocked)] bg-[var(--blocked-soft)] px-4 py-3 text-sm font-semibold text-[var(--blocked)]">
          {state.error}
        </div>
      ) : null}

      <label className="grid gap-2 text-sm font-bold text-[var(--ink)]">
        链接、片段或临时想法
        <textarea
          name="content"
          defaultValue={values.content}
          rows={9}
          onDrop={onDrop}
          placeholder="粘贴链接、想法、聊天片段或待整理材料"
          className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm font-normal leading-6 text-[var(--ink)] outline-none focus:border-[var(--brand)]"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[var(--brand-strong)] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "保存中..." : "收进输入箱"}
        </button>
        <Link
          href="/inbox"
          className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[var(--ink-muted)] hover:border-[var(--border-strong)]"
        >
          查看输入箱
        </Link>
      </div>
    </form>
  );
}
