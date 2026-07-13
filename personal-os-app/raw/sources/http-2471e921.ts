import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import {
  configuredReadTokens,
  isPersonalOsAuthDisabled,
  requestHasReadAccess,
} from "@/lib/auth";

export async function readJson<T>(request: Request, schema: ZodType<T>) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  return schema.parse(body);
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function requireWriteAccess(request: Request) {
  if (isPersonalOsAuthDisabled()) {
    return;
  }

  const token = process.env.PERSONAL_OS_API_TOKEN;

  if (!token || token === "change-me") {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    throw new HttpError(
      503,
      "PERSONAL_OS_API_TOKEN must be set to a real value in production",
    );
  }

  if (token.length < 16 && process.env.NODE_ENV === "production") {
    throw new HttpError(
      503,
      "PERSONAL_OS_API_TOKEN is too short for production writes",
    );
  }

  if (process.env.NODE_ENV !== "production" && token === "change-me") {
    return;
  }

  const expected = `Bearer ${token}`;
  if (request.headers.get("authorization") !== expected) {
    throw new HttpError(401, "Missing or invalid API token");
  }
}

export function requireReadAccess(request: Request) {
  if (isPersonalOsAuthDisabled()) {
    return;
  }

  const tokens = configuredReadTokens();

  if (tokens.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    throw new HttpError(
      503,
      "PERSONAL_OS_READ_TOKEN or PERSONAL_OS_API_TOKEN must be set in production",
    );
  }

  if (!requestHasReadAccess(request.headers, tokens)) {
    throw new HttpError(401, "Missing or invalid API token");
  }
}

export function handleRouteError(error: unknown) {
  if (error instanceof HttpError) {
    return json({ ok: false, error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return json(
      { ok: false, error: "Validation failed", issues: error.issues },
      { status: 400 },
    );
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return json({ ok: false, error: "Record not found" }, { status: 404 });
  }

  console.error(error);
  return json({ ok: false, error: "Internal server error" }, { status: 500 });
}
