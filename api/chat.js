// Vercel Serverless Function: /api/chat
export default function handler(req, res) {
  // Basic CORS so Storyline can call this from anywhere
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const message = (body.message || "").toString().trim();

    const reply = message
      ? `You said: "${message}". Hello from your bot.`
      : "Hi there. I am connected and ready.";

    return res.status(200).json({ ok: true, reply });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      reply: "",
      error: "Could not read your message."
    });
  }
}
