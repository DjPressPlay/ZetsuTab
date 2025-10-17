// netlify/functions/encode.js
import crypto from "node:crypto";

const SUPABASE_URL = "https://mxjjkvudfapooaftftzp.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// --- Helpers ---
function encodeString(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}
function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}
function nowISO() {
  return new Date().toISOString();
}
function timeInOneMinute() {
  const date = new Date(Date.now() + 60 * 1000);
  // timetz expects only the time portion, not a full ISO timestamp
  return date.toISOString().split("T")[1].replace("Z", "");
}

// --- Handler ---
export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Use POST" }) };
  }

  try {
    const { email, password, display_name, device_id, mode } = JSON.parse(event.body || "{}");

    if (!email || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing email or password" }) };
    }

    const encoded = encodeString(password);

    // === 1️⃣ GET USER ===
    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/infinity_users?email=eq.${encodeURIComponent(email)}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const users = await userRes.json();
    let user = users[0];

    // === 2️⃣ SIGNUP ===
    if (mode === "signup") {
      if (user) return { statusCode: 409, body: JSON.stringify({ error: "User already exists" }) };

      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/infinity_users`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify([
          {
            email,
            encode: encoded,
            display_name: display_name || email.split("@")[0],
            created_at: nowISO(),
          },
        ]),
      });

      const newUser = await createRes.json();
      user = newUser[0];
      if (!createRes.ok || !user) throw new Error("User creation failed");

      // ✅ Create session
      const token = generateToken();
      const expires_at = timeInOneMinute();

      const sessionRes = await fetch(`${SUPABASE_URL}/rest/v1/infinity_sessions`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify([
          {
            user_id: user.id,               // must be valid uuid
            token,
            expires_at,                     // fixed: only time part for timetz
            device_id: device_id || "unknown",
            active: true,
            created_at: nowISO(),
          },
        ]),
      });

      const session = await sessionRes.json();
      if (!sessionRes.ok) {
        console.error("Supabase session insert error:", sessionRes.status, session);
        throw new Error("Session creation failed");
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Signup success", user, session: session[0] }),
      };
    }

    // === 3️⃣ LOGIN ===
    if (mode === "login") {
      if (!user)
        return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };
      if (user.encode !== encoded)
        return { statusCode: 401, body: JSON.stringify({ error: "Invalid password" }) };

      // deactivate old sessions
      const sessRes = await fetch(
        `${SUPABASE_URL}/rest/v1/infinity_sessions?user_id=eq.${user.id}&active=eq.true`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const activeSessions = await sessRes.json();

      const now = new Date();
      for (const s of activeSessions) {
        const expired = new Date(`1970-01-01T${s.expires_at}Z`) < now;
        const diffDevice = s.device_id !== device_id;
        if (expired || diffDevice) {
          await fetch(`${SUPABASE_URL}/rest/v1/infinity_sessions?id=eq.${s.id}`, {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ active: false }),
          });
        }
      }

      // create new session
      const token = generateToken();
      const expires_at = timeInOneMinute();

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/infinity_sessions`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify([
          {
            user_id: user.id,
            token,
            expires_at,
            device_id: device_id || "unknown",
            active: true,
            created_at: nowISO(),
          },
        ]),
      });

      const newSession = await insertRes.json();
      if (!insertRes.ok) {
        console.error("Supabase insert error:", insertRes.status, newSession);
        throw new Error("Session creation failed");
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Login success", user, session: newSession[0] }),
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: "Invalid mode" }) };
  } catch (err) {
    console.error("ZTAB encode.js error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
