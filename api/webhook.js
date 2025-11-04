import { MongoClient } from 'mongodb';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_ID = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : null;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://watch-two-rho.vercel.app';
const BOT_USERNAME = process.env.BOT_USERNAME || '';
const MINI_APP_NAME = process.env.MINI_APP_NAME || 'app';

let cachedClient = null;

async function connectDB() {
  try {
    if (cachedClient) {
      return cachedClient;
    }
    
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not set');
    }

    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    
    await client.connect();
    cachedClient = client;
    return client;
  } catch (error) {
    console.error('DB Connection Error:', error);
    throw error;
  }
}

function generateVideoId() {
  return 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateTitle() {
  const titles = [
    "Desi Romance - Full Video HD",
    "Indian Love Story - New Episode",
    "Bollywood Scene - Viral Video",
    "Romantic Bhabhi - Latest Video",
    "Love After Marriage - Full Movie",
    "Secret Romance - New Release",
    "Late Night Romance - HD Video",
    "Romantic Moments - Full Video",
    "Love Triangle - Hot Scenes",
    "Passionate Romance - New Video",
    "Romantic Night - Full HD",
    "Love Story - Viral Video",
    "Romantic Encounter - New Movie",
    "Romance - Latest Release",
    "Bedroom Romance - Full Video",
    "Romantic Couple - HD Video",
    "Love After Dark - New Movie",
    "Passionate Moments - Full Video",
    "Romantic Dreams - HD Video",
    "Love & Romance - New Release"
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

async function sendMessage(chatId, text, options = {}) {
  try {
    if (!BOT_TOKEN) {
      console.error('BOT_TOKEN not set');
      return { ok: false };
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
        ...options
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error('Telegram API Error:', data);
    }
    
    return data;
  } catch (error) {
    console.error('Send Message Error:', error);
    return { ok: false };
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

    // Generate links
    const miniAppLink = BOT_USERNAME 
      ? `https://t.me/${BOT_USERNAME}/${MINI_APP_NAME}?startapp=${videoId}`
      : `${WEBAPP_URL}?video_id=${videoId}`;
    
    const webAppLink = `${WEBAPP_URL}?video_id=${videoId}`;

    const msg = `✅ *Video Added Successfully!*

📹 *Video ID:* `${videoId}`
📝 *Title:* ${title}

🔗 *Telegram Mini App:*
${miniAppLink}

🌐 *Web Link:*
${webAppLink}`;

    await sendMessage(chatId, msg);
  } catch (error) {
    console.error('Add Video Error:', error);
    await sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

async function handleMessage(msg) {
  try {
    const chatId = msg.chat?.id;
    const userId = msg.from?.id;
    const text = (msg.text || '').trim();

    if (!chatId || !userId) return;

    // Check admin
    if (ADMIN_ID && userId !== ADMIN_ID) {
      await sendMessage(chatId, '⛔ Not authorized');
      return;
    }

    // /start
    if (text === '/start') {
      const welcome = `🎬 *Video Bot Admin*

📋 *Commands:*
/link <url> - Add video
/list - Show videos
/stats - Statistics
/delete <id> - Delete video

💡 Just send Terabox link!`;

      await sendMessage(chatId, welcome);
      return;
    }

    // /link command
    if (text.startsWith('/link ')) {
      const url = text.replace('/link ', '').trim();
      
      if (!url) {
        await sendMessage(chatId, '❌ No URL provided');
        return;
      }
      
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

        if (videos.length === 0) {
          await sendMessage(chatId, '📭 No videos');
          return;
        }

        let list = '📋 *Recent Videos:*

';
        videos.forEach((v, i) => {
          list += `${i + 1}. `${v.video_id}`
${v.title}

`;
        });

        await sendMessage(chatId, list);
      } catch (error) {
        await sendMessage(chatId, '❌ DB Error');
      }
      return;
    }

    // /stats
    if (text === '/stats') {
      try {
        const client = await connectDB();
        const db = client.db('video_bot');
        const count = await db.collection('videos').countDocuments();

        await sendMessage(chatId, `📊 *Stats*

Videos: *${count}*
Admin: `${ADMIN_ID}``);
      } catch (error) {
        await sendMessage(chatId, '❌ DB Error');
      }
      return;
    }

    // /delete
    if (text.startsWith('/delete ')) {
      const videoId = text.replace('/delete ', '').trim();
      
      if (!videoId) {
        await sendMessage(chatId, '❌ No ID provided');
        return;
      }
      
      try {
        const client = await connectDB();
        const db = client.db('video_bot');
        const result = await db.collection('videos').deleteOne({ video_id: videoId });

        if (result.deletedCount > 0) {
          await sendMessage(chatId, `✅ Deleted: `${videoId}``);
        } else {
          await sendMessage(chatId, '❌ Not found');
        }
      } catch (error) {
        await sendMessage(chatId, '❌ DB Error');
      }
      return;
    }

    // Auto-detect Terabox links
    if (text.includes('terabox')) {
      await addVideo(chatId, userId, text);
      return;
    }

    await sendMessage(chatId, '❓ Unknown. Use /start');
    
  } catch (error) {
    console.error('Handle Message Error:', error);
  }
}

export default async function handler(req, res) {
  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      env: {
        bot_token: !!BOT_TOKEN,
        admin_id: !!ADMIN_ID,
        mongodb: !!MONGODB_URI,
        bot_username: !!BOT_USERNAME
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    
    if (!update) {
      return res.status(200).json({ ok: true });
    }

    if (update.message) {
      await handleMessage(update.message);
    }

    return res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Webhook Error:', error);
    // Always return 200 to Telegram even on error
    return res.status(200).json({ ok: true });
  }
        }
