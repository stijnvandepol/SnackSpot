import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from './env.js';

export type AuthPayload = { sub: string; role: 'user' | 'mod' | 'admin' };

export async function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export function signAccessToken(payload: AuthPayload) {
  return jwt.sign(payload, env.accessSecret, { expiresIn: env.accessTtl });
}

export function signRefreshToken(payload: AuthPayload) {
  return jwt.sign(payload, env.refreshSecret, { expiresIn: env.refreshTtl });
}

export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, env.accessSecret) as AuthPayload;
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, env.refreshSecret) as AuthPayload;
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createCsrfToken(sessionId: string) {
  return crypto.createHmac('sha256', env.csrfSecret).update(sessionId).digest('hex');
}
