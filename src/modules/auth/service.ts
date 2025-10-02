import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { FastifyInstance } from "fastify";
import { hashPassword, verifyPassword } from "../../utils/crypto.js";

const dummyHashPromise = hashPassword("__dummy__");
const norm = (s: string) => s.trim().toLowerCase();

export async function registerUser(app: FastifyInstance, email: string, password: string) {
  const passwordHash = await hashPassword(password);
  try {
    return await app.prisma.user.create({
      data: { email: norm(email), passwordHash },
      select: { id: true, email: true, createdAt: true },
    });
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw app.httpErrors.conflict("Email already registered");
    }
    throw e;
  }
}

export async function loginUser(app: FastifyInstance, email: string, password: string) {
  const user = await app.prisma.user.findUnique({ where: { email: norm(email) } });
  if (!user) {
    await verifyPassword(password, await dummyHashPromise);
    throw app.httpErrors.unauthorized("Invalid credentials");
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw app.httpErrors.unauthorized("Invalid credentials");

  const token = await app.jwt.sign({ id: user.id, email: user.email });
  return { token, user: { id: user.id, email: user.email } };
}
