// netlify/functions/just-answer.js
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function handler(event) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  try {
    const { q } = JSON.parse(event.body || "{}");
    if (!q?.trim()) {
      return {
        statusCode: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing 'q' parameter" }),
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Answer clearly in 1–3 sentences:\n${q}`,
      config: {
        generationConfig: { temperature: 0.2, maxOutputTokens: 120 },
        thinkingConfig: { thinkingBudget: 0 }, // disables “thinking” mode
      },
    });

    const answer = response?.text?.trim() || "No answer found.";

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, answer }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
}
