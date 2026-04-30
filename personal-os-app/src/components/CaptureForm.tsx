"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  type CaptureActionState,
  createCaptureAction,
} from "@/app/capture/actions";

type CaptureFormProps = {
  initialValues: {
    url?: string;
    title?: string;
    selection?: string;
    note?: string;
  };
};

const initialState: CaptureActionState = { ok: false };

export function CaptureForm({ initialValues }: CaptureFormProps) {
  const [state, formAction, pending] = useActionState(
    createCaptureAction,
    initialState,
  );
  const values = state.values ?? initialValues;

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
        URL
        <input
          name="url"
          type="url"
          defaultValue={values.url}
          placeholder="https://example.com/article"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-emerald-500"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Title
        <input
          name="title"
          defaultValue={values.title}
          placeholder="Page title or thought title"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-emerald-500"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Selection
        <textarea
          name="selection"
          defaultValue={values.selection}
          rows={7}
          placeholder="Selected text, quote, or rough idea"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-zinc-950 outline-none focus:border-emerald-500"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Note
        <textarea
          name="note"
          defaultValue={values.note}
          rows={4}
          placeholder="Why this matters, or what the agent should consider later"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-zinc-950 outline-none focus:border-emerald-500"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {pending ? "Saving..." : "Save to Inbox"}
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
