import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/telegramAuth';

type Update = { message?: { text?: string; chat: { id: number; type: string } } };

async function tg(method: string, body: unknown) {
  return fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function POST(req: Request) {
  const { BOT_TOKEN, WEBAPP_URL, WEBHOOK_SECRET } = process.env;
  if (!BOT_TOKEN || !WEBAPP_URL || !WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Telegram додає цей заголовок, якщо secret_token задано в setWebhook
  const got = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!safeEqual(got, WEBHOOK_SECRET)) return NextResponse.json({ ok: false }, { status: 401 });

  const update = (await req.json().catch(() => null)) as Update | null;
  const msg = update?.message;
  // "/schedule@MyBot arg" -> "schedule"
  const cmd = msg?.text?.match(/^\/(\w+)/)?.[1]?.toLowerCase();

  if (msg && cmd) {
    // web_app-кнопки працюють лише в особистому чаті; у групі — звичайні посилання
    const open = msg.chat.type === 'private';
    const btn = (text: string, path: string) =>
      open ? { text, web_app: { url: `${WEBAPP_URL}${path}` } } : { text, url: `${WEBAPP_URL}${path}` };

    const schedule = btn('📅 Розклад пар', '/schedule');
    const absent = btn('🗓️ Відсутність', '/absentStudents');

    const reply: Record<string, { text: string; row: unknown[] }> = {
      start: { text: 'Оберіть розділ:', row: [schedule, absent] },
      schedule: { text: 'Розклад пар:', row: [schedule] },
      absent: { text: 'Відсутність студентів:', row: [absent] },
    };

    const r = reply[cmd];
    if (r) {
      await tg('sendMessage', {
        chat_id: msg.chat.id,
        text: r.text,
        reply_markup: { inline_keyboard: [r.row] },
      });
    }
  }

  return NextResponse.json({ ok: true }); // завжди 200, щоб Telegram не повторював запити
}