// Proxy aman ke Claude API. API key hanya ada di server (env ANTHROPIC_API_KEY).
// Hanya user yang sudah login Supabase yang bisa memakai endpoint ini.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID;

const MODELS = {
  quick: process.env.MODEL_QUICK || "claude-haiku-5-5",
  default: process.env.MODEL_DEFAULT || "claude-sonnet-5-5",
};
const MAX_TOKENS = { quick: 1500, default: 3000 };
const MAX_PROMPT_CHARS = 80000;
const LIMIT = parseInt(process.env.RATE_LIMIT_PER_MIN || "20", 10);
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || "")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

// Pembatas sederhana per instance serverless (best-effort). Batas sungguhan: set spend limit di console Anthropic.
const buckets = new Map();
function limited(uid) {
  const now = Date.now();
  const arr = (buckets.get(uid) || []).filter(t => now - t < 60000);
  if (arr.length >= LIMIT) { buckets.set(uid, arr); return true; }
  arr.push(now); buckets.set(uid, arr);
  return false;
}

async function getUser(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!r.ok) return null;
  return r.json();
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY)
    return res.status(500).json({ error: "server_not_configured" });

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "unauthorized" });

  let user;
  try { user = await getUser(token); } catch (e) { return res.status(502).json({ error: "auth_unreachable" }); }
  if (!user || !user.id) return res.status(401).json({ error: "unauthorized" });

  if (ALLOWED_DOMAINS.length) {
    const dom = String(user.email || "").split("@")[1]?.toLowerCase();
    if (!ALLOWED_DOMAINS.includes(dom)) return res.status(403).json({ error: "domain_not_allowed" });
  }
  if (limited(user.id)) return res.status(429).json({ error: "rate_limited" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const prompt = body && body.prompt;
  const tier = body && body.modelTier === "quick" ? "quick" : "default";
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS)
    return res.status(400).json({ error: "bad_request" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
  "content-type": "application/json",
  "x-api-key": ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
  ...(ANTHROPIC_WORKSPACE_ID && { "anthropic-workspace-id": ANTHROPIC_WORKSPACE_ID }),
},
      body: JSON.stringify({
        model: MODELS[tier],
        max_tokens: MAX_TOKENS[tier],
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("Anthropic error", r.status, detail.slice(0, 500));
      return res.status(r.status === 429 ? 429 : 502).json({ error: r.status === 429 ? "rate_limited" : "upstream_error" });
    }
    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    return res.status(200).json({ text });
  } catch (e) {
    console.error("claude proxy failed", e);
    return res.status(502).json({ error: "upstream_unreachable" });
  }
};
