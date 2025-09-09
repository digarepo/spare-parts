import { hash as argon2Hash, verify as argon2Verify } from 'argon2';

const OPTS = { type: 2 } as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2Hash(plain, OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2Verify(hash, plain);
}
