const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req, res) {
  try {
    // Test if bot token is set
    if (!BOT_TOKEN) {
      return res.status(500).json({
        error: 'TELEGRAM_BOT_TOKEN not set in environment variables'
      });
    }

    // Get bot info
    const botInfoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;
    const botInfoRes = await fetch(botInfoUrl);
    const botInfo = await botInfoRes.json();

    if (!botInfo.ok) {
      return res.status(500).json({
        error: 'Invalid bot token',
        details: botInfo
      });
    }

    // Get webhook info
    const webhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
    const webhookRes = await fetch(webhookUrl);
    const webhookInfo = await webhookRes.json();

    return res.status(200).json({
      success: true,
      bot: botInfo.result,
      webhook: webhookInfo.result,
      env: {
        bot_token_set: !!BOT_TOKEN,
        admin_id_set: !!process.env.ADMIN_ID,
        mongodb_uri_set: !!process.env.MONGODB_URI,
        webapp_url_set: !!process.env.WEBAPP_URL
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
