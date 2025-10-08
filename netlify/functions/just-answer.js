require("dotenv").config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 204, headers: CORS, body: "" };

  const log = (msg, data) => console.log("🔍", msg, data || "");

  try {
    const { q } = JSON.parse(event.body || "{}");
    if (!q?.trim()) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: "Missing 'q' parameter" }),
      };
    }

    const model = "gemini-1.5-flash"; // 👈 safer default
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: q }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 250 },
    };

    log("→ Sending to Gemini", { model, q });
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    log("↩ Status", resp.status);
    const raw = await resp.text();
    log("↩ Raw body", raw);

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: "Invalid JSON from Gemini", raw }),
      };
    }

    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      data?.candidates?.[0]?.text?.trim() ||
      data?.error?.message ||
      "";

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ answer, debug: { model, status: resp.status } }),
    };
  } catch (err) {
    log("🔥 Caught Error", err);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
