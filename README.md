# Latihan Roleplay SC · HydroClean x SiriBersih

Versi hosting sendiri: **Vercel** (web + server) · **Supabase** (login + database) · **Claude API** (klien simulasi & penilai).

```
public/index.html     Aplikasi (artifact aslimu, hanya diubah sedikit)
public/runtime.js     Pengganti fitur claude.ai: login, chat AI, database
api/claude.js         Proxy ke Claude API (API key aman di server)
api/config.js         Memberi URL & anon key Supabase ke browser
supabase/schema.sql   Tabel + keamanan (RLS)
vercel.json           Timeout 60 detik untuk penilaian
```

## 1. Siapkan Supabase (±5 menit)
1. Buat project di https://supabase.com/dashboard (simpan password database).
2. Buka **SQL Editor → New query**, tempel seluruh isi `supabase/schema.sql`, klik **Run**.
3. Buka **Project Settings → API**, catat **Project URL** dan **anon / publishable key**.
4. (Disarankan) **Authentication → Providers → Email**: matikan *Confirm email* jika ingin peserta bisa langsung masuk tanpa verifikasi.

## 2. Upload ke GitHub
```bash
cd hydroclean-roleplay
git init && git add . && git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/USERNAME/hydroclean-roleplay.git
git push -u origin main
```
(Boleh juga drag & drop folder lewat tombol *Upload files* di GitHub.) Gunakan repo **private** bila perlu.

## 3. Deploy di Vercel
1. https://vercel.com/new → **Import** repo tadi.
2. **Framework Preset: Other**. Kosongkan Build Command dan Output Directory.
3. Buka **Environment Variables**, isi:

| Nama | Isi |
|---|---|
| `ANTHROPIC_API_KEY` | API key Claude kamu |
| `SUPABASE_URL` | Project URL Supabase |
| `SUPABASE_ANON_KEY` | anon / publishable key |
| `ALLOWED_EMAIL_DOMAINS` | (opsional) mis. `perusahaan.com` |

4. Klik **Deploy**. Jika kamu mengisi env var setelah deploy pertama, lakukan **Deployments → ⋯ → Redeploy**.

## 4. Jadikan dirimu Leader
Buka situs, **Daftar** dengan emailmu, lalu di Supabase SQL Editor jalankan:
```sql
update public.profiles set role = 'leader' where email = 'emailkamu@perusahaan.com';
```
Muat ulang situs: tab **Rekap tim** akan muncul. Peserta biasa hanya melihat riwayat miliknya sendiri.

## 5. Domain sendiri
Vercel → **Settings → Domains** → tambahkan domainmu dan ikuti instruksi DNS.
Setelah itu, di Supabase **Authentication → URL Configuration** isi *Site URL* dengan domainmu (penting bila email konfirmasi dipakai).

## Keamanan & biaya
- API key hanya ada di Vercel (server). Tidak pernah terkirim ke browser.
- Hanya user yang login yang bisa memanggil AI; ada batas 20 permintaan/menit/user (`RATE_LIMIT_PER_MIN`).
- **Pasang Spend Limit** di https://console.anthropic.com agar biaya tidak membengkak.
- Untuk tim tertutup: isi `ALLOWED_EMAIL_DOMAINS`, dan aktifkan opsi pembatasan domain pendaftaran di bagian 5 `schema.sql`.
- Satu sesi chat ≈ 8–12 panggilan model cepat + 1 penilaian. Ganti model lewat `MODEL_QUICK` / `MODEL_DEFAULT` bila ingin lebih hemat.

## Pemecahan masalah
| Gejala | Penyebab / solusi |
|---|---|
| Layar "Konfigurasi belum lengkap" | Env var Supabase belum diisi / belum Redeploy |
| "Claude sedang tidak bisa dihubungi" | Cek `ANTHROPIC_API_KEY` dan saldo; lihat **Vercel → Logs** |
| Penilaian time-out | Plan Hobby mungkin membatasi durasi fungsi. Aktifkan *Fluid Compute* di Project Settings → Functions, atau turunkan `MODEL_DEFAULT` ke model lebih cepat |
| Riwayat tidak tersimpan | Pastikan `schema.sql` sudah dijalankan penuh tanpa error |
| Tab Rekap tim tidak muncul | Akunmu belum `leader` (langkah 4); muat ulang setelah update |
