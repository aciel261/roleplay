// Memberi konfigurasi publik Supabase ke browser, supaya tidak perlu edit file saat deploy.
// (anon key memang dirancang untuk publik; keamanan data dijaga oleh Row Level Security)
module.exports = (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({ supabaseUrl, supabaseAnonKey });
};
