// ✅ Import dependencies
import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';

// ✅ Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_ID = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : null;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://watch-two-rho.vercel.app';

// ✅ MongoDB connection cache
let cachedClient = null;

async function connectDB() {
  if (cachedClient) return cachedClient;
  if (!MONGODB_URI) throw new Error("MONGODB_URI is missing");
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

// ✅ Utility functions
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
    "Romantic Night - Full HD", "Love Story - Viral Video",
    "Romantic Encounter - New Movie", "Hot Romance - Latest Release",
    "Bedroom Romance - Full Video", "Romantic Couple - HD Video",
    "Love After Dark - New Movie", "Passionate Moments - Full Video",
    "Romantic Dreams - HD Video", "Love & Romance - New Release"
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

async function sendMessage(chatId, text, options = {}) {
  try {
    if (!BOT_TOKEN) throw new Error("BOT_TOKEN missing");
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        ...options
      })
    });
    const data = await response.json();
    if (!data.ok) console.error("Telegram API error:", data);
    return data;
  } catch (error) {
    console.error('Send error:', error);
    return { ok: false, error: error.message };
  }
}

// ✅ Add video to DB
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

    const msg = `✅ *Video Added Successfully!*\n\n📹 *ID:* \`${videoId}\`\n📝 *Title:* ${title}\n\n🔗 *Share Link:*\n${WEBAPP_URL}?video_id=${videoId}`;
    await sendMessage(chatId, msg);
  } catch (error) {
    console.error("addVideo error:", error);
    await sendMessage(chatId, '❌ Error: ' + error.message);
  }
}

// ✅ Handle user messages
async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  const userId = msg.from?.id;
  const text = msg.text?.trim() || '';

  if (!chatId || !userId) return;

  // Only admin can use
  if (ADMIN_ID && userId !== ADMIN_ID) {
    await sendMessage(chatId, '⛔ Not authorized');
    return;
  }

  // /start
  if (text === '/start') {
    const welcome = `🎬 *Video Bot Admin*\n\n📋 *Commands:*\n/link <url> - Add video\n/list - Show videos\n/stats - Statistics\n/delete <id> - Delete video\n\n💡 Or just send a Terabox link!`;
    await sendMessage(chatId, welcome);
    return;
  }

  // /link
  if (text.startsWith('/link ')) {
    const url = text.replace('/link ', '').trim();
    if (url.includes('terabox')) {
      await addVideo(chatId, userId, url);
    } else {
      await sendMessage(chatId, '❌ Invalid Terabox link');
    }
    return;
  }

  // /list
  if (text === '/list') {
    try {
      const client = await connectDB();
      const db = client.db('video_bot');
      const videos = await db.collection('videos')
        .find()
        .sort({ created_at: -1 })
        .limit(10)
        .toArray();

      if (!videos.length) {
        await sendMessage(chatId, '📭 No videos found');
        return;
      }

      let list = '📋 *Recent Videos:*\n\n';
      for (const [i, v] of videos.entries()) {
        list += `${i + 1}. \`${v.video_id}\`\n${v.title}\n\n`;
      }
      await sendMessage(chatId, list);
    } catch (error) {
      console.error("list error:", error);
      await sendMessage(chatId, '❌ Error: ' + error.message);
    }
    return;
  }

  // /stats
  if (text === '/stats') {
    try {
      const client = await connectDB();
      const db = client.db('video_bot');
      const count = await db.collection('videos').countDocuments();

      await sendMessage(chatId, `📊 *Statistics*\n\nTotal Videos: *${count}*\nAdmin: \`${ADMIN_ID}\``);
    } catch (error) {
      console.error("stats error:", error);
      await sendMessage(chatId, '❌ Error: ' + error.message);
    }
    return;
  }

  // /delete
  if (text.startsWith('/delete ')) {
    const videoId = text.replace('/delete ', '').trim();
    try {
      const client = await connectDB();
      const db = client.db('video_bot');
      const result = await db.collection('videos').deleteOne({ video_id: videoId });

      if (result.deletedCount > 0) {
        await sendMessage(chatId, `✅ Deleted: \`${videoId}\``);
      } else {
        await sendMessage(chatId, '❌ Video not found');
      }
    } catch (error) {
      console.error("delete error:", error);
      await sendMessage(chatId, '❌ Error: ' + error.message);
    }
    return;
  }

  // Auto Terabox detection
  if (text.includes('terabox.com') || text.includes('1024terabox.com')) {
    await addVideo(chatId, userId, text);
    return;
  }

  await sendMessage(chatId, '❓ Unknown command. Use /start');
}

// ✅ Main webhook handler
export default async function handler(req, res) {
  try {
    // GET route: show webhook + env status
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

    // POST route: Telegram webhook
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const update = req.body;
    console.log("📩 Telegram update received:", update);

    if (update.message) {
      await handleMessage(update.message);
    } else {
      console.log("⚠️ Update without message:", update);
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("💥 Webhook error:", error.stack || error);
    // Always return 200 to avoid Telegram retries
    return res.status(200).json({ ok: false, error: error.message });
  }
}
