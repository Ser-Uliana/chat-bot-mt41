import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Telegram-теги, яким дозволено редагувати (малими літерами, без @)
export const ALLOWED_USERNAMES = ['@SerUliana',];

type TgPayload = Record<string, string | number | undefined> & { hash: string; auth_date: number; username?: string };

/**
 * Перевіряє підпис Telegram Login Widget (HMAC-SHA256 з токеном бота)
 * і чи є @тег серед дозволених. Підключи до POST /api/auth/telegram:
 *   res.json({ allowed: verifyTelegram(req.body, process.env.BOT_TOKEN!) })
 */
export function verifyTelegram(data: TgPayload, botToken: string): boolean {
  const { hash, ...rest } = data;
  const checkString = Object.keys(rest)
    .filter((k) => rest[k] !== undefined)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('\n');

  const secret = createHash('sha256').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(String(hash));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const fresh = Date.now() / 1000 - Number(data.auth_date) < 5 * 60; // не старше 5 хв
  const tag = (data.username ?? '').toLowerCase();
  return fresh && ALLOWED_USERNAMES.includes(tag);
}
