"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { TaskView } from "@/lib/view-models";

type FormState = {
  title: string;
  description: string;
  nextAction: string;
  definitionOfDone: string;
  priority: string;
  estimateMinutes: string;
};

export function TaskEditForm({ task }: { task: TaskView }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    title: task.title,
    description: task.description ?? "",
    nextAction: task.nextAction,
    definitionOfDone: task.definitionOfDone,
    priority: task.priority,
    estimateMinutes: task.estimateMinutes?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateField(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const estimate = form.estimateMinutes.trim();
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      nextAction: form.nextAction.trim(),
      definitionOfDone: form.definitionOfDone.trim(),
      priority: form.priority,
      estimateMinutes: estimate ? Number(estimate) : undefined,
    };

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setMessage("已保存。");
      router.refresh();
    } catch {
      setMessage("保存失败，检查输入后再试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3"
    >
      <h3 className="text-sm font-bold text-[var(--ink)]">调整内容</h3>
      <div className="mt-3 grid gap-3 text-sm">
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">标题</span>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--ink)] outline-none focus:border-[var(--brand)] px-2 py-1.5"
            required
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">今日目标</span>
          <textarea
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            className="min-h-20 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--ink)] outline-none focus:border-[var(--brand)] px-2 py-1.5"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">下一步</span>
          <textarea
            value={form.nextAction}
            onChange={(event) => updateField("nextAction", event.target.value)}
            className="min-h-16 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--ink)] outline-none focus:border-[var(--brand)] px-2 py-1.5"
            required
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">完成标准</span>
          <textarea
            value={form.definitionOfDone}
            onChange={(event) =>
              updateField("definitionOfDone", event.target.value)
            }
            className="min-h-16 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--ink)] outline-none focus:border-[var(--brand)] px-2 py-1.5"
            required
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">优先级</span>
            <select
              value={form.priority}
              onChange={(event) => updateField("priority", event.target.value)}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--ink)] outline-none focus:border-[var(--brand)] px-2 py-1.5"
            >
              <option value="P0">最高优先</option>
              <option value="P1">重要</option>
              <option value="P2">普通</option>
              <option value="P3">低优先</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">预计分钟</span>
            <input
              value={form.estimateMinutes}
              onChange={(event) =>
                updateField("estimateMinutes", event.target.value)
              }
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--ink)] outline-none focus:border-[var(--brand)] px-2 py-1.5"
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </label>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[var(--brand-strong)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          保存修改
        </button>
        {message ? <span className="text-xs text-[var(--ink-muted)]">{message}</span> : null}
      </div>
    </form>
  );
}
