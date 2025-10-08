// functions/just-answer.js
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

  try {
    const { q } = JSON.parse(event.body || "{}");
    if (!q?.trim()) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: "Missing 'q' parameter" }),
      };
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: q }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 250
      }
    };

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await resp.json();
    console.log("Gemini raw:", JSON.stringify(data, null, 2));

    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      data?.candidates?.[0]?.text?.trim() ||
      data?.error?.message ||
      "";

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
