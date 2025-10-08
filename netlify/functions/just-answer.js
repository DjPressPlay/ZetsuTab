// =======================================================
// ✅ Jessica "Just Answer" Function — Fixed Version
// Fetches a short Gemini AI answer for a given query (q)
// =======================================================

// 1️⃣ Load environment variables from .env file
require('dotenv').config();

// 2️⃣ Pull API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 3️⃣ Set CORS headers
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// =======================================================
// 🔹 Netlify Handler
// =======================================================
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing GEMINI_API_KEY in .env" }),
    };
  }

  try {
    const { q } = JSON.parse(event.body || "{}");
    if (!q?.trim()) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: "Missing 'q' parameter" }),
      };
    }

    // === Gemini payload
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: `Answer clearly in 1–3 sentences:\n${q}` }],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 120 },
    };

    // === Fetch from Gemini
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await resp.json();

    // --- Flexible text extraction ---
    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      data?.candidates?.[0]?.content?.[0]?.parts?.[0]?.text?.trim() ||
      data?.candidates?.[0]?.output_text?.trim() ||
      data?.candidates?.[0]?.text?.trim() ||
      "No answer found.";

    // Debug log (remove later)
    console.log("Gemini raw:", JSON.stringify(data, null, 2));

    // === Return to client
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ answer }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
