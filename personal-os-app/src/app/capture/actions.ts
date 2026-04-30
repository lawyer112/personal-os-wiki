"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { captureToInboxInput } from "@/lib/capture";
import { createInboxItem } from "@/lib/inbox";
import { captureCreateSchema } from "@/lib/validation";

export type CaptureActionState = {
  ok: boolean;
  itemId?: string;
  error?: string;
  values?: {
    content?: string;
  };
};

export async function createCaptureAction(
  _previousState: CaptureActionState,
  formData: FormData,
): Promise<CaptureActionState> {
  const values = {
    content: String(formData.get("content") ?? ""),
  };
  const parsed = captureCreateSchema.safeParse({
    ...values,
    sourcePlatform: "web",
    createdBy: "user",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Capture validation failed.",
      values,
    };
  }

  const item = await createInboxItem(prisma, captureToInboxInput(parsed.data));
  revalidatePath("/inbox");

  return {
    ok: true,
    itemId: item.id,
    values: {},
  };
}
