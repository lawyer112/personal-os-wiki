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
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Saved to Inbox
          {state.itemId ? (
            <span className="ml-2 font-mono text-xs text-emerald-700">
              {state.itemId}
            </span>
          ) : null}
          <Link href="/inbox" className="ml-3 underline">
            Open Inbox
          </Link>
        </div>
      ) : null}

      {state.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {state.error}
        </div>
      ) : null}

      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Link or raw thought
        <textarea
          name="content"
          defaultValue={values.content}
          rows={9}
          onDrop={onDrop}
          placeholder="https://example.com/article"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-zinc-950 outline-none focus:border-emerald-500"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        <Link
          href="/inbox"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-700"
        >
          Inbox
        </Link>
      </div>
    </form>
  );
}
