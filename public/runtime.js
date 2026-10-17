/* Pengganti window.claude (fitur claude.ai) untuk hosting sendiri.
   - sample.json  -> POST /api/claude (proxy server, API key tidak ada di browser)
   - db           -> Supabase (tabel runs & run_items, dilindungi RLS)
   - user         -> Supabase Auth (login email + password) */
(function () {
  "use strict";
  var sb = null, uid = null, profile = { name: "", role: "member" };

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  var css = el("style", {}, [
    ".rt-ov{position:fixed;inset:0;z-index:1000;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}",
    ".rt-box{width:100%;max-width:400px;display:flex;flex-direction:column;gap:12px}",
    ".rt-box label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;color:var(--ink-2)}",
    ".rt-box input{font:inherit;font-size:15px;color:var(--ink);background:var(--surface);border:1.5px solid var(--line);border-radius:10px;padding:10px 12px}",
    ".rt-link{appearance:none;background:none;border:0;color:var(--accent);font:inherit;font-weight:700;cursor:pointer;padding:0;text-align:left}",
    ".rt-bar{display:flex;justify-content:flex-end;align-items:center;gap:10px;font-size:13px;color:var(--ink-2);flex-wrap:wrap}"
  ].join(""));
  document.head.appendChild(css);

  function fatal(msg) {
    var ov = el("div", { "class": "rt-ov" }, '<div class="rt-box card"><h2>Konfigurasi belum lengkap</h2><p class="muted">' + esc(msg) + '</p></div>');
    document.body.appendChild(ov);
  }

  function showLogin() {
    var mode = "in";
    var ov = el("div", { "class": "rt-ov" });
    document.body.appendChild(ov);
    function draw(msg, ok) {
      ov.innerHTML = '<form class="rt-box card" id="rt-f" novalidate>' +
        '<p class="kicker">HydroClean x SiriBersih</p><h2>' + (mode === "in" ? "Masuk untuk berlatih" : "Buat akun latihan") + '</h2>' +
        (msg ? '<div class="notice" style="' + (ok ? "background:var(--good-soft);border-color:var(--good)" : "") + '">' + esc(msg) + '</div>' : "") +
        (mode === "up" ? '<label>Nama<input id="rt-n" autocomplete="name" required></label>' : "") +
        '<label>Email<input id="rt-e" type="email" autocomplete="email" required></label>' +
        '<label>Password<input id="rt-p" type="password" minlength="6" autocomplete="' + (mode === "in" ? "current-password" : "new-password") + '" required></label>' +
        '<button class="btn" id="rt-go" type="submit">' + (mode === "in" ? "Masuk" : "Daftar") + '</button>' +
        '<button class="rt-link" id="rt-sw" type="button">' + (mode === "in" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk") + '</button></form>';
      document.getElementById("rt-sw").onclick = function () { mode = mode === "in" ? "up" : "in"; draw(); };
      document.getElementById("rt-f").onsubmit = async function (ev) {
        ev.preventDefault();
        var email = document.getElementById("rt-e").value.trim(), pw = document.getElementById("rt-p").value;
        var nm = mode === "up" ? document.getElementById("rt-n").value.trim() : "";
        if (!email || pw.length < 6 || (mode === "up" && !nm)) return draw("Lengkapi data. Password minimal 6 karakter.");
        var btn = document.getElementById("rt-go"); btn.disabled = true; btn.textContent = "Memproses…";
        try {
          if (mode === "in") {
            var r = await sb.auth.signInWithPassword({ email: email, password: pw });
            if (r.error) throw r.error;
            location.reload();
          } else {
            var s = await sb.auth.signUp({ email: email, password: pw, options: { data: { name: nm } } });
            if (s.error) throw s.error;
            if (s.data && s.data.session) return location.reload();
            mode = "in"; draw("Akun dibuat. Cek email untuk konfirmasi, lalu masuk.", true);
          }
        } catch (e) {
          var m = String((e && e.message) || "");
          draw(/invalid login/i.test(m) ? "Email atau password salah." : /already|registered/i.test(m) ? "Email sudah terdaftar. Silakan masuk." : /confirm/i.test(m) ? "Email belum dikonfirmasi. Cek inbox kamu." : /rate|too many/i.test(m) ? "Terlalu banyak percobaan. Tunggu sebentar." : m || "Gagal. Coba lagi.");
        }
      };
    }
    draw();
  }

  function injectBar() {
    var wrap = document.querySelector(".wrap"); if (!wrap) return;
    var bar = el("div", { "class": "rt-bar" }, '<span>' + esc(profile.name || "Peserta") + (profile.role === "leader" ? " · Leader" : "") + '</span><button class="btn ghost sm" type="button" id="rt-out">Keluar</button>');
    wrap.insertBefore(bar, wrap.firstChild);
    document.getElementById("rt-out").onclick = async function () { await sb.auth.signOut(); location.reload(); };
  }

  function parseJSON(text) {
    var t = String(text || "").replace(/```json|```/g, "").trim();
    var a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a < 0 || b <= a) throw { code: "bad_output" };
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { throw { code: "bad_output" }; }
  }

  var sample = {
    json: async function (prompt, opts) {
      opts = opts || {};
      var sess = (await sb.auth.getSession()).data.session;
      if (!sess) throw { code: "not_granted" };
      var res;
      try {
        res = await fetch("/api/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + sess.access_token },
          body: JSON.stringify({ prompt: prompt, modelTier: opts.modelTier === "quick" ? "quick" : "default" }),
          signal: opts.signal
        });
      } catch (e) {
        if (e && e.name === "AbortError") throw { code: "cancelled" };
        throw { code: "network" };
      }
      if (res.status === 401 || res.status === 403) throw { code: "not_granted" };
      if (res.status === 429) throw { code: "rate_limited" };
      if (!res.ok) throw { code: "error" };
      var j = await res.json();
      return parseJSON(j.text);
    }
  };

  var user = {
    id: async function () { return uid; },
    canEdit: async function () { return profile.role === "leader"; },
    profiles: async function (ids) {
      var r = await sb.from("profiles").select("id,name,email").in("id", ids);
      var out = {};
      (r.data || []).forEach(function (p) { out[p.id] = { name: p.name || (p.email || "").split("@")[0] }; });
      return out;
    }
  };

  var seg = function (p) { return String(p).split("/").filter(Boolean); };
  var snap = function (rows, map) { return { docs: rows.map(function (r) { return { id: map.id(r), data: function () { return map.data(r); } }; }) }; };
  var must = function (r) { if (r.error) throw r.error; return r; };

  function collection(path) {
    var s = seg(path), order = ["at", "desc"], lim = 100;
    var api = {
      orderBy: function (f, d) { order = [f, d || "asc"]; return api; },
      limit: function (n) { lim = n; return api; },
      doc: function (id) {
        return { set: async function (obj) {
          if (s[0] === "runs" && s[2] === "items")
            must(await sb.from("run_items").upsert({ user_id: s[1], id: id, at: obj.at, data: obj }, { onConflict: "user_id,id" }));
          else throw new Error("path tidak didukung: " + path);
        } };
      },
      get: async function () {
        if (s.length === 1 && s[0] === "runs") {
          var r = must(await sb.from("runs").select("*"));
          return snap(r.data || [], { id: function (x) { return x.user_id; }, data: function (x) { return { n: x.n, best: x.best, avg: x.avg, last: x.last, lastScen: x.last_scen, lastAt: x.last_at, role: x.role }; } });
        }
        if (s[0] === "runs" && s[2] === "items") {
          var q = sb.from("run_items").select("id,data").eq("user_id", s[1]).order("at", { ascending: order[1] !== "desc" }).limit(lim);
          var r2 = must(await q);
          return snap(r2.data || [], { id: function (x) { return x.id; }, data: function (x) { return x.data; } });
        }
        throw new Error("path tidak didukung: " + path);
      }
    };
    return api;
  }
  function doc(path) {
    var s = seg(path);
    return { set: async function (o) {
      if (s[0] === "runs" && s.length === 2)
        must(await sb.from("runs").upsert({ user_id: s[1], n: o.n, best: o.best, avg: o.avg, last: o.last, last_scen: o.lastScen, last_at: o.lastAt, role: o.role, updated_at: new Date().toISOString() }, { onConflict: "user_id" }));
      else throw new Error("path tidak didukung: " + path);
    } };
  }
  var db = { collection: collection, doc: doc };

  var boot = (async function () {
    var r = await fetch("/api/config");
    var cfg = r.ok ? await r.json() : {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) { fatal("SUPABASE_URL dan SUPABASE_ANON_KEY belum diisi di Environment Variables Vercel. Isi, lalu Redeploy."); throw new Error("config"); }
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    var s = (await sb.auth.getSession()).data.session;
    if (!s) { showLogin(); return new Promise(function () {}); } // menunggu login (halaman reload setelah masuk)
    uid = s.user.id;
    var p = await sb.from("profiles").select("name,role").eq("id", uid).maybeSingle();
    if (p.data) profile = { name: p.data.name || "", role: p.data.role || "member" };
    try { injectBar(); } catch (e) {}
  })();

  window.claude = {
    use: async function (name) {
      await boot;
      return { sample: sample, db: db, user: user }[name] || null;
    }
  };
})();
