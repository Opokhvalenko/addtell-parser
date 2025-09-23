import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { FastifyInstance } from "fastify";
import { hashPassword, verifyPassword } from "../utils/crypto.js";

export async function registerUser(fastify: FastifyInstance, email: string, password: string) {
  const passwordHash = await hashPassword(password);

  try {
    const user = await fastify.prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });
    return user;
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw fastify.httpErrors.conflict("Email already registered");
    }
    throw e;
  }
}

export async function loginUser(fastify: FastifyInstance, email: string, password: string) {
  const user = await fastify.prisma.user.findUnique({ where: { email } });
  if (!user) throw fastify.httpErrors.unauthorized("Invalid credentials");

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw fastify.httpErrors.unauthorized("Invalid credentials");

  const token = fastify.jwt.sign({ id: user.id, email: user.email });

  return {
    token,
    user: { id: user.id, email: user.email },
  };
}
