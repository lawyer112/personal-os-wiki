"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { captureToInboxInput } from "@/lib/capture";
import { createInboxItem } from "@/lib/inbox";
import { captureCreateSchema } from "@/lib/validation";
import { HttpError, requireWriteAccess } from "@/lib/http";
export type CaptureActionState = { ok: boolean; itemId?: string; error?: string; values?: { content?: string } };
export async function createCaptureAction(_previousState: CaptureActionState, formData: FormData): Promise<CaptureActionState> {
  const values = { content: String(formData.get("content") ?? "") };
  try {
    // Server Action 也需要管理凭证，不能仅依赖页面的读取权限。
    requireWriteAccess(new Request("http://internal.invalid/capture", { headers: await headers() }));
    const parsed = captureCreateSchema.safeParse({ ...values, sourcePlatform: "web", createdBy: "user" });
    if (!parsed.success) return { ok: false, error: "请填写有效的链接或原始内容，并检查内容是否过长。", values };
    const item = await createInboxItem(prisma, captureToInboxInput(parsed.data));
    revalidatePath("/inbox");
    return { ok: true, itemId: item.id, values: {} };
  } catch (error) {
    return { ok: false, error: error instanceof HttpError && [401, 403].includes(error.status) ? "当前身份没有保存权限，请使用管理凭证登录。" : "资料暂时无法保存，请检查服务连接后重试。", values };
  }
}
