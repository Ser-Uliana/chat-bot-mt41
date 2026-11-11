import { NextResponse } from 'next/server';
import { isAllowed, verifyInitData, verifyLoginWidget } from '@/lib/telegramAuth';

export async function POST(req: Request) {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.log('auth-debug: BOT_TOKEN is missing');
    return NextResponse.json({ allowed: false }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ allowed: false }, { status: 400 });
  }

  const initData = (body as { initData?: unknown } | null)?.initData;
  const viaInitData = typeof initData === 'string';
  const user = viaInitData ? verifyInitData(initData, token) : verifyLoginWidget(body, token);
  const allowed = !!user && isAllowed(user);

  console.log('auth-debug', {
    viaInitData,
    tokenLen: token.length, // довжина, не сам токен; має бути ~46
    verified: !!user,
    username: user?.username,
    id: user?.id,
    allowed,
    allowedCount: (process.env.ALLOWED_USERNAMES ?? '').split(',').filter(Boolean).length,
  });

  return NextResponse.json({ allowed });
}