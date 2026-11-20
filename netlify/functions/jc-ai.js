// JC CONNECT - JC AI Netlify Function

const FIREBASE_WEB_API_KEY = "AIzaSyBy6hCKpdC5Lp9pTVbNq442pTgzbSlPj0A";
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function reply(statusCode, data) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(data)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Method not allowed." });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return reply(500, { error: "JC AI is not configured." });
  }

  const auth = event.headers?.authorization || "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return reply(401, { error: "Please sign in again." });
  }

  try {
    const verify = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token })
      }
    );

    const verified = await verify.json();

    if (!verify.ok || !verified.users?.length) {
      return reply(401, { error: "Your session could not be verified." });
    }

    const payload = JSON.parse(event.body || "{}");

    if (!Array.isArray(payload.input)) {
      return reply(400, { error: "Invalid chat input." });
    }

    const contents = payload.input
      .filter(item =>
        item &&
        typeof item.content === "string" &&
        ["user_input", "model_output"].includes(item.type)
      )
      .slice(-20)
      .map(item => ({
        role: item.type === "model_output" ? "model" : "user",
        parts: [{ text: item.content.slice(0, 4000) }]
      }));

    if (!contents.length || contents.at(-1).role !== "user") {
      return reply(400, { error: "Please enter a message." });
    }

    
const GEMINI_FALLBACK_MODEL = "gemini-3.8-flash";

async function generateWithModel(model) {
  let result;
  let data;

  for (let attempt = 0; attempt < 2; attempt++) {
    result = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "You are JC AI, the helpful assistant inside JC CONNECT. Be friendly, accurate, respectful and concise."
            }]
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200
          }
        })
      }
    );

    data = await result.json();

    if (result.ok) return { result, data };

    const temporaryError = [429, 500, 502, 503, 504]
      .includes(result.status);

    if (!temporaryError || attempt === 1) break;

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { result, data };
}

let { result, data } = await generateWithModel(GEMINI_MODEL);

if (!result.ok && [429, 500, 502, 503, 504].includes(result.status)) {
  console.warn("Primary Gemini model unavailable. Trying backup model.");

  ({ result, data } = await generateWithModel(GEMINI_FALLBACK_MODEL));
}

if (!result.ok) {
  console.error("Gemini error:", result.status, data.error?.message);

  return reply(502, {
    error: "JC AI is temporarily unavailable. Please try again shortly."
  });
}

    const answer = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return reply(502, { error: "JC AI received an empty response." });
    }

    return reply(200, { reply: answer });

  } catch (error) {
    console.error("JC AI error:", error);
    return reply(500, { error: "JC AI encountered a server error." });
  }
};
