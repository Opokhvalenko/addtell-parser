import type { Prisma } from "@prisma/client";
import { hash, verify } from "argon2";
import type { FastifyInstance } from "fastify";
import type { SessionUser } from "./session.js";

export class EmailTakenError extends Error {
  constructor() {
    super("Email already registered");
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials");
  }
}

function isPrismaKnownRequestError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return !!e && typeof e === "object" && "code" in e;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  return await hash(password);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Hash checked when the email is unknown, so login takes the same time for both cases. */
let dummyPasswordHash: Promise<string> | undefined;
function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= hashPassword("timing-equalizer-password");
  return dummyPasswordHash;
}

/** Computes the dummy hash at startup, so even the first unknown-email login is not faster. */
export async function warmUpLoginTiming(): Promise<void> {
  await getDummyPasswordHash();
}

/** Case-insensitive lookup: accounts created before e-mails were normalized keep working. */
async function findUserByEmail(app: FastifyInstance, email: string) {
  return app.prisma.user.findFirst({
    where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
  });
}

export async function registerUser(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<SessionUser> {
  if (await findUserByEmail(app, email)) throw new EmailTakenError();

  try {
    const user = await app.prisma.user.create({
      data: { email: normalizeEmail(email), passwordHash: await hashPassword(password) },
      select: { id: true, email: true },
    });
    return user;
  } catch (error: unknown) {
    if (isPrismaKnownRequestError(error) && error.code === "P2002") throw new EmailTakenError();
    throw error;
  }
}

export async function loginUser(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<SessionUser> {
  const user = await findUserByEmail(app, email);
  const isValid = await verifyPassword(
    password,
    user?.passwordHash ?? (await getDummyPasswordHash()),
  );
  if (!user || !isValid) throw new InvalidCredentialsError();
  return { id: user.id, email: user.email };
}
