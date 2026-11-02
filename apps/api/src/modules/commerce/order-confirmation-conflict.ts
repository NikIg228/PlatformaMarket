import { Prisma } from "@prisma/client";

export function orderConfirmationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" ||
    (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))));
}
