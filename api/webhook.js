import { MongoClient } from "mongodb";
import fetch from "node-fetch";

/* =============== ENV =============== */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null;
const MINI_APP_NAME = process.env.MINI_APP_NAME || "earn";

/* =============== DB =============== */

let cachedClient = null;

async function connectDB() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

/* =============== HELPERS =============== */

function generateVideoId() {
  return "vid_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
}

function generateTitle() {
  const titles = [
    "Desi Romance - Full Video HD",
    "Indian Love Story - New Episode",
    "Bollywood Hot Scene - Viral Video",
    "Romantic Bhabhi - Latest Video",
    "Love After Marriage - Full Movie",
    "Secret Romance - New Release"
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

/* =============== TELEGRAM HELPERS =============== */

async function sendMessage(chatId, text, options = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...options })
  });
}

async function editMessage(chatId, messageId, text, options = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options
    })
  });
}

async function getBotUsername() {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
  const j = await r.json();
  return j?.result?.username;
}

/* =============== START MESSAGES =============== */

const USER_START_MESSAGE = `
Join All Videos🥵👇👇👇
https://t.me/+fdC1pnvj14IwZDA1
https://t.me/+fdC1pnvj14IwZDA1
https://t.me/+fdC1pnvj14IwZDA1

19:34 M!N
https://t.me/+VdRJje_pmJtlNjg9
https://t.me/+VdRJje_pmJtlNjg9
https://t.me/+VdRJje_pmJtlNjg9

Pyal gaming 🎮
https://t.me/+yZlUQ8ZBhiA3YzY1
https://t.me/+yZlUQ8ZBhiA3YzY1
https://t.me/+yZlUQ8ZBhiA3YzY1

Join Get Movies And 🔞 Videos 👙👇👇
`;

const ADMIN_START_MESSAGE = `
🎬 Video Bot Admin

📋 Commands:
/link <url>   Add video
/list         List videos
/delete <id>  Delete video
/stats        Statistics
`;

/* =============== CORE FUNCTIONS =============== */

async function addVideo(chatId, userId, url) {
  const client = await connectDB();
  const db = client.db("video_bot");

  const videoId = generateVideoId();
  const title = generateTitle();

  await db.collection("videos").insertOne({
    video_id: videoId,
    video_url: url,
    title,
    created_at: new Date(),
    created_by: userId
  });

  const bot = await getBotUsername();
  const link = `https://t.me/${bot}/${MINI_APP_NAME}?startapp=${videoId}`;

  await sendMessage(chatId, `✅ Video Added\n\n▶️ ${link}`);
}

/* =============== LIST WITH PAGINATION =============== */

async function sendList(chatId, page = 1, messageId = null) {
  const limit = 5;
  const skip = (page - 1) * limit;

  const client = await connectDB();
  const db = client.db("video_bot");

  const total = await db.collection("videos").countDocuments();
  const videos = await db.collection("videos")
    .find({})
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  if (!videos.length) {
    await sendMessage(chatId, "📭 No videos found");
    return;
  }

  let text = `📋 Videos (Page ${page})\n\n`;
  videos.forEach((v, i) => {
    text += `${skip + i + 1}. ${v.video_id}\n${v.title}\n\n`;
  });

  const keyboard = [];
  if (page > 1) keyboard.push({ text: "⬅️ Prev", callback_data: `list_${page - 1}` });
  if (skip + limit < total) keyboard.push({ text: "➡️ Next", callback_data: `list_${page + 1}` });

  const reply_markup = keyboard.length
    ? { inline_keyboard: [keyboard] }
    : undefined;

  if (messageId) {
    await editMessage(chatId, messageId, text, { reply_markup });
  } else {
    await sendMessage(chatId, text, { reply_markup });
  }
}

/* =============== MESSAGE HANDLER =============== */

async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  const userId = msg.from?.id;
  const text = msg.text?.trim() || "";
  const isAdmin = ADMIN_ID && userId === ADMIN_ID;

  if (!chatId || !userId) return;

  /* START */
  if (text === "/start") {
    await sendMessage(chatId, isAdmin ? ADMIN_START_MESSAGE : USER_START_MESSAGE, {
      parse_mode: undefined
    });
    return;
  }

  if (!isAdmin) return;

  if (text.startsWith("/link ")) {
    const url = text.replace("/link ", "").trim();
    await addVideo(chatId, userId, url);
    return;
  }

  if (text === "/list") {
    await sendList(chatId, 1);
    return;
  }

  if (text.startsWith("/delete ")) {
    const videoId = text.replace("/delete ", "").trim();
    const client = await connectDB();
    const db = client.db("video_bot");

    const r = await db.collection("videos").deleteOne({ video_id: videoId });
    await sendMessage(chatId, r.deletedCount ? "✅ Deleted" : "❌ Not found");
  }
}

/* =============== CALLBACK HANDLER =============== */

async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const messageId = cb.message.message_id;
  const data = cb.data;

  if (data.startsWith("list_")) {
    const page = Number(data.split("_")[1]);
    await sendList(chatId, page, messageId);
  }
}

/* =============== WEBHOOK =============== */

export default async function handler(req, res) {
  if (req.method === "POST") {
    if (req.body.message) await handleMessage(req.body.message);
    if (req.body.callback_query) await handleCallback(req.body.callback_query);
    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ status: "ok" });
}
