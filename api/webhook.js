import { MongoClient } from 'mongodb';

// Use BOT_TOKEN (not TELEGRAM_BOT_TOKEN)
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_ID = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : null;
const WEBAPP_URL = process.env.WEBAPP_URL;
const BOT_USERNAME = process.env.BOT_USERNAME;
const MINI_APP_NAME = process.env.MINI_APP_NAME;

let cachedClient = null;

async function connectDB() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

function generateVideoId() {
  return 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateTitle() {
  const titles = [
    "Desi Romance - Full Video",
    "Indian Love Story - Episode",
    "Romantic Moments - HD",
    "Love After Marriage - Movie",
    "Secret Romance - New",
    "Late Night Romance",
    "Romantic Dreams - Full",
    "Love Triangle - Scenes",
    "Passionate Romance",
    "Romantic Night - HD",
    "Love Story - Viral",
    "Romantic Encounter",
    "Bedroom Romance",
    "Romantic Couple - HD",
    "Love After Dark",
    "Passionate Moments",
    "Love & Romance",
    "Romantic Evening",
    "Couple Romance",
    "Love & Passion"
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

async function sendMessage(chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
  } catch (e) {
    console.error('Send error:', e);
  }
}

async function addVideo(chatId, userId, url) {
  try {
    const client = await connectDB();
    const db = client.db('video_bot');

    const videoId = generateVideoId();
    const title = generateTitle();

    await db.collection('videos').insertOne({
      video_id: videoId,
      video_url: url.trim(),
      title: title,
      created_at: new Date(),
      created_by: userId
    });

    const miniAppLink = `https://t.me/${BOT_USERNAME}/${MINI_APP_NAME}?startapp=${videoId}`;
    const webLink = `${WEBAPP_URL}?video_id=${videoId}`;

    const msg = `✅ *Video Added!*

📹 ID: `${videoId}`
📝 ${title}

🔗 Telegram:
${miniAppLink}

🌐 Web:
${webLink}`;

    await sendMessage(chatId, msg);
  } catch (e) {
    await sendMessage(chatId, '❌ Error: ' + e.message);
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  const userId = msg.from?.id;
  const text = (msg.text || '').trim();

  if (!chatId || !userId) return;

  if (ADMIN_ID && userId !== ADMIN_ID) {
    await sendMessage(chatId, '⛔ Not authorized');
    return;
  }

  if (text === '/start') {
    await sendMessage(chatId, `🎬 *Bot Admin*

/link <url> - Add video
/list - Show videos
/stats - Statistics

Send Terabox link!`);
    return;
  }

  if (text.startsWith('/link ')) {
    const url = text.replace('/link ', '').trim();
    if (url.includes('terabox')) {
      await addVideo(chatId, userId, url);
    } else {
      await sendMessage(chatId, '❌ Invalid link');
    }
    return;
  }

  if (text === '/list') {
    try {
      const client = await connectDB();
      const db = client.db('video_bot');
      const videos = await db.collection('videos')
        .find()
        .sort({ created_at: -1 })
        .limit(10)
        .toArray();

      if (videos.length === 0) {
        await sendMessage(chatId, '📭 No videos');
        return;
      }

      let list = '📋 *Videos:*

';
      videos.forEach((v, i) => {
        list += `${i + 1}. `${v.video_id}`
${v.title}

`;
      });

      await sendMessage(chatId, list);
    } catch (e) {
      await sendMessage(chatId, '❌ Error');
    }
    return;
  }

  if (text === '/stats') {
    try {
      const client = await connectDB();
      const db = client.db('video_bot');
      const count = await db.collection('videos').countDocuments();
      await sendMessage(chatId, `📊 Videos: *${count}*`);
    } catch (e) {
      await sendMessage(chatId, '❌ Error');
    }
    return;
  }

  if (text.includes('terabox')) {
    await addVideo(chatId, userId, text);
    return;
  }

  await sendMessage(chatId, '❓ Use /start');
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok' });
  }

  try {
    const update = req.body;
    if (update?.message) {
      await handleMessage(update.message);
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ ok: true });
  }
}
