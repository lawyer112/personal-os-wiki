import { Readable } from "node:stream";
import { findContentWorkbenchAsset } from "@/lib/content-workbench";
import { handleRouteError, requireReadAccess } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    requireReadAccess(request);
    const { hash } = await params;
    const asset = await findContentWorkbenchAsset(hash);
    if (!asset) {
      return Response.json({ ok: false, error: "Asset not found" }, { status: 404 });
    }

    return new Response(Readable.toWeb(asset.stream) as BodyInit, {
      headers: {
        "content-type": asset.mimeType,
        "cache-control": "private, max-age=3600",
        "x-content-workbench-asset-hash": asset.hash,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
