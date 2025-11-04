const fetch = require('node-fetch');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { message } = req.body;

  if (!message || !message.text) {
    return res.status(200).send('No message to process');
  }

  const chatId = message.chat.id;
  const text = message.text;

  let replyText = 'Sorry, I do not understand that command.';

  if (text === '/start') {
    replyText = 'Welcome to the Telegram Bot hosted on Vercel!';
  } else if (text === '/help') {
    replyText = 'Send any message and I will echo it back to you.';
  } else {
    replyText = `You said: ${text}`;
  }

  const sendMessageUrl = `${TELEGRAM_API_URL}/sendMessage`;

  await fetch(sendMessageUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: replyText,
    })
  });

  res.status(200).send('OK');
};
