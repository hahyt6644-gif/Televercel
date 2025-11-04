import { MongoClient } from 'mongodb';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_ID = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : null;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://watch-two-rho.vercel.app';

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
    "Desi Romance - Full Video HD",
    "Indian Love Story - New Episode",
    "Bollywood Hot Scene - Viral Video",
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
    "Hot Romance - Latest Release",
    "Bedroom Romance - Full Video",
    "Romantic Couple - HD Video",
    "Love After Dark - New Movie",
    "Passionate Moments - Full Video",
    "Romantic Dreams - HD Video",
    "Love & Romance - New Release",
    "Hot Couple Romance - Full Video",
    "Romantic Evening - HD Video",
    "Love Story 2024 - New Movie",
    "Romantic Scenes - Full HD",
    "Couple Romance - Latest Video",
    "Love & Passion - Full Movie",
    "Romantic Adventure - HD Video",
    "Secret Love - New Release",
    "Romantic Night Out - Full Video",
    "Love Moments - HD Video",
    "Romantic Story - New Movie",
    "Hot Romance Scenes - Full HD",
    "Love After Hours - New Video",
    "Romantic Drama - Full Movie",
    "Passionate Love - HD Video",
    "Romantic Comedy - New Release",
    "Love & Drama - Full Video",
    "Romantic Thriller - HD Movie",
    "Hot Love Story - New Video",
    "Romantic Mystery - Full HD"
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

async function sendMessage(chatId, text, options = {}) {
  try {
    const url = https://api.telegram.org/bot${BOT_TOKEN}/sendMessage;
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
    return await response.json();
  } catch (error) {
    console.error('Send error:', error);
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

    const msg = `✅ *Video Added Successfully*
