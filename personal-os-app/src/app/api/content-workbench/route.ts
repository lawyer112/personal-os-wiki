import { getContentWorkbenchSnapshot } from "@/lib/content-workbench";
import { handleRouteError, json, requireReadAccess } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const url = new URL(request.url);
    const packageLimit = Number(url.searchParams.get("packageLimit") ?? 80);
    const assetLimit = Number(url.searchParams.get("assetLimit") ?? 320);
    const snapshot = await getContentWorkbenchSnapshot({
      packageLimit: clamp(packageLimit, 1, 200),
      assetLimit: clamp(assetLimit, 1, 1000),
    });
    return json({ ok: true, snapshot });
  } catch (error) {
    return handleRouteError(error);
  }
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return max;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
