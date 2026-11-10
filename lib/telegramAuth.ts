import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type TgUser = { id?: number; username?: string };

const WIDGET_MAX_AGE_S = 5 * 60; // Login Widget
const INIT_DATA_MAX_AGE_S = 60 * 60; // Mini App initData

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function isFresh(authDate: unknown, maxAgeS: number): boolean {
  const age = Date.now() / 1000 - Number(authDate);
  return Number.isFinite(age) && age >= 0 && age < maxAgeS;
}

/** Mini App: рядок window.Telegram.WebApp.initData */
export function verifyInitData(initData: string, botToken: string): TgUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest('hex');
  if (!safeEqual(expected, hash)) return null;
  if (!isFresh(params.get('auth_date'), INIT_DATA_MAX_AGE_S)) return null;

  try {
    const user = JSON.parse(params.get('user') ?? 'null') as TgUser | null;
    return user && typeof user === 'object' ? user : null;
  } catch {
    return null;
  }
}

/** Звичайний сайт у браузері: Telegram Login Widget */
export function verifyLoginWidget(data: unknown, botToken: string): TgUser | null {
  if (!data || typeof data !== 'object') return null;
  const { hash, ...rest } = data as Record<string, string | number | undefined>;
  if (typeof hash !== 'string') return null;

  const checkString = Object.keys(rest)
    .filter((k) => rest[k] !== undefined)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('\n');

  const secret = createHash('sha256').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest('hex');
  if (!safeEqual(expected, hash)) return null;
  if (!isFresh(rest.auth_date, WIDGET_MAX_AGE_S)) return null;

  return { id: Number(rest.id), username: typeof rest.username === 'string' ? rest.username : undefined };
}

const list = (v: string | undefined) =>
  (v ?? '').split(',').map((s) => s.trim().replace(/^@/, '').toLowerCase()).filter(Boolean);

/** Дозволені: ALLOWED_USERNAMES (без @, через кому) та/або ALLOWED_IDS */
export function isAllowed(user: TgUser): boolean {
  const names = list(process.env.ALLOWED_USERNAMES);
  const ids = list(process.env.ALLOWED_IDS);
  const byName = !!user.username && names.includes(user.username.toLowerCase());
  const byId = user.id !== undefined && ids.includes(String(user.id));
  return byName || byId;
}

export { safeEqual };
