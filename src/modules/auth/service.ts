import type { Prisma } from "@prisma/client";
import { hash, verify } from "argon2";
import type { FastifyInstance } from "fastify";

function isPrismaKnownRequestError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return !!e && typeof e === "object" && "code" in e;
}

export async function hashPassword(password: string): Promise<string> {
  return await hash(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await verify(hash, password);
  } catch {
    return false;
  }
}

export async function registerUser(app: FastifyInstance, email: string, password: string) {
  const passwordHash = await hashPassword(password);

  try {
    return await app.prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });
  } catch (error: unknown) {
    if (isPrismaKnownRequestError(error) && error.code === "P2002") {
      throw new Error("Email already registered");
    }
    throw error instanceof Error ? error : new Error("Unknown error");
  }
}

export async function loginUser(app: FastifyInstance, email: string, password: string) {
  const user = await app.prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  const token = await app.jwt.sign({ id: user.id, email: user.email });
  return { token };
}
