import bcrypt from "bcryptjs";
import type { Config } from "../config/schema.js";

export async function hashPassword(plain: string, config: Config) {
  return bcrypt.hash(plain, config.BCRYPT_ROUNDS);
}
export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
