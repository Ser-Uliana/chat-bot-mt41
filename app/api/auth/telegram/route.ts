import { NextResponse } from 'next/server';
import { isAllowed, verifyInitData, verifyLoginWidget } from '@/lib/telegramAuth';

export async function POST(req: Request) {
  const token = process.env.BOT_TOKEN;
  if (!token) return NextResponse.json({ allowed: false }, { status: 500 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ allowed: false }, { status: 400 });
  }

  const initData = (body as { initData?: unknown } | null)?.initData;
  const user =
    typeof initData === 'string' ? verifyInitData(initData, token) : verifyLoginWidget(body, token);

  return NextResponse.json({ allowed: !!user && isAllowed(user) });
}
