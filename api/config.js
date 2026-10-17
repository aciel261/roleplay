// Memberi konfigurasi publik Supabase ke browser, supaya tidak perlu edit file saat deploy.
// (anon key memang dirancang untuk publik; keamanan data dijaga oleh Row Level Security)
module.exports = (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || "https://lkrjdxzlcnunppuesugc.supabase.co";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcmpkeHpsY251bnBwdWVzdWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxODIzNjEsImV4cCI6MjEwNzc1ODM2MX0.t9GzATTzV40Uz6KN72pmoxVAx2ohq18RN9EJghqbRmI";
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({ supabaseUrl, supabaseAnonKey });
};
