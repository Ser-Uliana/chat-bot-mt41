// Запуск: npm run set-webhook   (після деплою, з заповненим .env)
const { BOT_TOKEN, WEBAPP_URL, WEBHOOK_SECRET } = process.env;
if (!BOT_TOKEN || !WEBAPP_URL || !WEBHOOK_SECRET) {
  console.error('Потрібні BOT_TOKEN, WEBAPP_URL, WEBHOOK_SECRET у .env');
  process.exit(1);
}
if (!WEBAPP_URL.startsWith('https://')) {
  console.error('WEBAPP_URL має починатися з https://');
  process.exit(1);
}

const call = async (method, body) => {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(method, '→', JSON.stringify(json));
  if (!json.ok) process.exitCode = 1;
};

const commands = [
  { command: 'start', description: 'Відкрити меню' },
  { command: 'schedule', description: 'Розклад пар' },
  { command: 'absent', description: 'Відсутність студентів' },
];
for (const scope of [
  { type: 'default' },
  { type: 'all_private_chats' },
  { type: 'all_group_chats' },
  { type: 'all_chat_administrators' },
]) {
  await call('deleteMyCommands', { scope });
  await call('setMyCommands', { commands, scope });
  await call('setWebhook', {
  url: `${WEBAPP_URL}/api/bot`,
  secret_token: WEBHOOK_SECRET,
  allowed_updates: ['message'],
  drop_pending_updates: true,
});
}
