import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let prismaClient = globalForPrisma.prisma;

function getPrismaClient() {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: requireDatabaseUrl(),
      }),
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prismaClient;
    }
  }

  return prismaClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  return url;
}
