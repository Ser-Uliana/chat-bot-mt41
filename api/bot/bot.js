const TelegramBot = require('node-telegram-bot-api');

// Замініть своїм токеном від @BotFather
const token = env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Обробка команди /start або будь-якого повідомлення
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          // Варіант 1: Звичайна кнопка-посилання (відкриває браузер)
          {
            text: '🌐 Відкрити у браузері',
            url: 'https://google.com'
          }
        ],
        [
          // Варіант 2: Web App кнопка (відкриває сайт прямо в ТГ)
          // Примітка: Сайт обов'язково має бути на https://
          {
            text: '📱 Відкрити всередині Telegram',
            web_app: { url: 'https://wikipedia.org' }
          }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, 'Оберіть, як відкрити посилання:', options);
});
