import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';

// === ENVIRONMENT ===
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_ID = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : null;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://watch-two-rho.vercel.app';

// === DATABASE CONNECTION ===
let cachedClient = null;

async function connectDB() {
  if (cachedClient) return cachedClient;
  if (!MONGODB_URI) throw new Error('MONGODB_URI is missing');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

// === HELPERS ===
function generateVideoId() {
  return 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateTitle() {
  const titles = [
    "Desi Romance - Full Video HD", "Indian Love Story - New Episode",
    "Bollywood Hot Scene - Viral Video", "Romantic Bhabhi - Latest Video",
    "Love After Marriage - Full Movie", "Secret Romance - New Release",
    "Late Night Romance - HD Video", "Romantic Moments - Full Video",
    "Love Triangle - Hot Scenes", "Passionate Romance - New Video",
    "Romantic Night - Full HD", "Love Story - Viral Video"
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

// === SAFE TELEGRAM SEND ===
async function sendMessage(chatId, text, options = {}) {
  try {
    if (!BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');

    // Escape MarkdownV2 special chars
    const escapeMarkdown = (txt) =>
      txt.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: escapeMarkdown(text),
      parse_mode: 'MarkdownV2',
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!data.ok) console.error('⚠️ Telegram API Error:', data);
    return data;
  } catch (err) {
    console.error('❌ sendMessage error:', err.message);
    return { ok: false, error: err.message };
  }
}

// === MAIN COMMAND FUNCTIONS ===
async function addVideo(chatId, userId, url) {
  try {
    const client = await connectDB();
    const db = client.db('video_bot');
    const videoId = generateVideoId();
    const title = generateTitle();

    await db.collection('videos').insertOne({
      video_id: videoId,
      video_url: url.trim(),
      title,
      created_at: new Date(),
      created_by: userId
    });

    const msg = `✅ Video Added Successfully\n\nID: ${videoId}\nTitle: ${title}\n\nShare Link:\n${WEBAPP_URL}?video_id=${videoId}`;
    await sendMessage(chatId, msg);
  } catch (err) {
    console.error('❌ addVideo error:', err);
    await sendMessage(chatId, `Error: ${err.message}`);
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  const userId = msg.from?.id;
  const text = msg.text?.trim() || '';

  if (!chatId || !userId) return;

  if (ADMIN_ID && userId !== ADMIN_ID) {
    await sendMessage(chatId, 'Not authorized.');
    return;
  }

  if (text === '/start') {
    await sendMessage(
      chatId,
      `🎬 Video Bot Admin\n\nCommands:\n/link <url> - Add video\n/list - Show videos\n/stats - Statistics\n/delete <id> - Delete video\n\nOr just send a Terabox link!`
    );
    return;
  }

  if (text.startsWith('/link ')) {
    const url = text.replace('/link ', '').trim();
    if (url.includes('terabox')) {
      await addVideo(chatId, userId, url);
    } else {
      await sendMessage(chatId, 'Invalid Terabox link.');
    }
    return;
  }

  if (text === '/list') {
    try {
      const client = await connectDB();
      const db = client.db('video_bot');
      const videos = await db
        .collection('videos')
        .find()
        .sort({ created_at: -1 })
        .limit(10)
        .toArray();

      if (!videos.length) {
        await sendMessage(chatId, 'No videos found.');
        return;
      }

      let list = 'Recent Videos:\n\n';
      for (const [i, v] of videos.entries()) {
        list += `${i + 1}. ${v.video_id}\n${v.title}\n\n`;
      }
      await sendMessage(chatId, list);
    } catch (err) {
      console.error('list error:', err);
      await sendMessage(chatId, `Error: ${err.message}`);
    }
    return;
  }

  if (text === '/stats') {
    try {
      const client = await connectDB();
      const db = client.db('video_bot');
      const count = await db.collection('videos').countDocuments();
      await sendMessage(chatId, `Total Videos: ${count}`);
    } catch (err) {
      await sendMessage(chatId, `Error: ${err.message}`);
    }
    return;
  }

  if (text.startsWith('/delete ')) {
    const videoId = text.replace('/delete ', '').trim();
    try {
      const client = await connectDB();
      const db = client.db('video_bot');
      const result = await db.collection('videos').deleteOne({ video_id: videoId });
      if (result.deletedCount > 0) {
        await sendMessage(chatId, `Deleted: ${videoId}`);
      } else {
        await sendMessage(chatId, `Video not found: ${videoId}`);
      }
    } catch (err) {
      await sendMessage(chatId, `Error: ${err.message}`);
    }
    return;
  }

  if (text.includes('terabox.com') || text.includes('1024terabox.com')) {
    await addVideo(chatId, userId, text);
    return;
  }

  await sendMessage(chatId, 'Unknown command. Use /start');
}

// === MAIN HANDLER ===
export default async function handler(req, res) {
  try {
    // GET route for status
    if (req.method === 'GET') {
      const envStatus = {
        bot_token: !!BOT_TOKEN,
        admin_id: !!ADMIN_ID,
        mongodb: !!MONGODB_URI,
        webapp_url: !!WEBAPP_URL
      };

      const missing = Object.entries({
        TELEGRAM_BOT_TOKEN: BOT_TOKEN,
        ADMIN_ID,
        MONGODB_URI,
        WEBAPP_URL
      })
        .filter(([_, v]) => !v)
        .map(([key]) => key);

      return res.status(200).json({
        status: 'ok',
        webhook: 'running',
        env: envStatus,
        missing: missing.length ? missing : 'none'
      });
    }

    // POST route for Telegram
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const update = req.body;
    console.log('📩 Telegram update received:', JSON.stringify(update, null, 2));

    if (update.message) {
      await handleMessage(update.message);
    } else {
      console.log('⚠️ No message in update:', update);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('💥 Webhook error:', err.stack || err);
    // Return 200 to stop Telegram retries
    return res.status(200).json({ ok: false, error: err.message });
  }
}
