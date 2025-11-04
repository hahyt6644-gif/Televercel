import { MongoClient } from 'mongodb';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const WEBAPP_URL = process.env.WEBAPP_URL;

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

// ✅ Replaced adult titles with clean Hinglish/Desi-style ones
function generateHinglishTitle() {
  const titles = [
    "Desi Vlogger New Travel Vlog",
    "Funny College Moments Compilation",
    "Dance Performance by Indian Crew",
    "Best Cooking Recipe of the Day",
    "Motivational Story in Hindi",
    "Bollywood Behind The Scenes",
    "Daily Life Vlog - Indian Family",
    "Comedy Short Film 2025",
    "Desi Wedding Highlights",
    "Village Life Documentary",
    "Indian Street Food Special",
    "Beautiful Nature Scenes - India",
    "Tech Review in Hindi",
    "Gaming Highlights in Hinglish",
    "Travel Journey to Manali",
    "Desi Singer Cover Song",
    "Cricket Funny Moments",
    "Inspirational Talk in Hindi",
    "Lifestyle Vlog - Morning Routine",
    "Desi Talent Show Performance"
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

async function sendMessage(chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...extra })
  });
}

async function addVideo(chatId, userId, videoUrl) {
  try {
    const client = await connectDB();
    const db = client.db('video_bot');

    const videoId = generateVideoId();
    const title = generateHinglishTitle();

    await db.collection('videos').insertOne({
      video_id: videoId,
      video_url: videoUrl.trim(),
      title: title,
      created_at: new Date(),
      created_by: userId
    });

    const successMsg = `
✅ *Video Added Successfully!*

📹 *Video ID:* ${videoId}
📝 *Title:* ${title}

🔗 *Share Link:*
${WEBAPP_URL}?video_id=${videoId}

📱 *Telegram Mini App:*
https://t.me/YOUR_BOT_USERNAME/app?startapp=${videoId}
`;

    await sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
  } catch (e) {
    await sendMessage(chatId, '❌ Error adding video: ' + e.message);
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text?.trim() || '';

  // Check if user is admin
  if (userId !== ADMIN_ID) {
    await sendMessage(chatId, '⛔ You are not authorized to use this bot.');
    return;
  }

  if (text === '/start') {
    const welcomeMsg = `
🎬 *Video Bot Admin Panel*

📋 *Available Commands:*
/link <terabox_url> - Add new video
/list - View recent videos
/stats - Show statistics
/delete <video_id> - Delete a video

💡 *Quick Add:*
Just send a Terabox link directly!
`;
    await sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
    return;
  }

  // /link command
  if (text.startsWith('/link')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendMessage(chatId, '❌ Usage: /link <terabox_url>');
      return;
    }

    const url = parts.slice(1).join(' ').trim();

    if (
      !url.includes('terabox.com') &&
      !url.includes('1024terabox.com') &&
      !url.includes('teraboxurl.com')
    ) {
      await sendMessage(chatId, '❌ Please provide a valid Terabox link!');
      return;
    }

    await addVideo(chatId, userId, url);
    return;
  }

  // List videos
  if (text === '/list') {
    try {
      const client = await connectDB();
      const db = client.db('video_bot');
      const videos = await db
        .collection('videos')
        .find()
        .sort({ created_at: -1 })
        .limit(20)
        .toArray();

      if (videos.length === 0) {
        await sendMessage(chatId, '📭 No videos found.');
        return;
      }

      let list = '📋 *Recent Videos (Last 20):*\n\n';
      videos.forEach((v, i) => {
        list += `${i + 1}. *${v.title}*\n`;
        list += `🆔 ${v.video_id}\n`;
        list += `🔗 ${WEBAPP_URL}?video_id=${v.video_id}\n\n`;
      });

      await sendMessage(chatId, list, { parse_mode: 'Markdown' });
    } catch (e) {
      await sendMessage(chatId, '❌ Error: ' + e.message);
    }
    return;
  }

  // Stats
  if (text === '/stats') {
    try {
      const client = await connectDB();
      const db = client.db('video_bot');
      const videoCount = await db.collection('videos').countDocuments();

      const statsMsg = `
📊 *Bot Statistics*

📹 Total Videos: ${videoCount}
👤 Admin ID: ${ADMIN_ID}
🌐 WebApp URL: ${WEBAPP_URL}
`;
      await sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
    } catch (e) {
      await sendMessage(chatId, '❌ Error: ' + e.message);
    }
    return;
  }

  // Delete video
  if (text.startsWith('/delete')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendMessage(chatId, '❌ Usage: /delete <video_id>');
      return;
    }

    const videoId = parts[1].trim();

    try {
      const client = await connectDB();
      const db = client.db('video_bot');
      const result = await db.collection('videos').deleteOne({ video_id: videoId });

      if (result.deletedCount > 0) {
        await sendMessage(chatId, `✅ Video *${videoId}* deleted successfully!`, { parse_mode: 'Markdown' });
      } else {
        await sendMessage(chatId, '❌ Video not found!');
      }
    } catch (e) {
      await sendMessage(chatId, '❌ Error: ' + e.message);
    }
    return;
  }

  // Auto-detect Terabox links
  if (
    text.includes('terabox.com') ||
    text.includes('1024terabox.com') ||
    text.includes('teraboxurl.com')
  ) {
    await addVideo(chatId, userId, text);
    return;
  }

  await sendMessage(chatId, '❓ Unknown command. Use /start to see available commands.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  try {
    const update = req.body;

    if (update.message) {
      await handleMessage(update.message);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ ok: true });
  }
}
