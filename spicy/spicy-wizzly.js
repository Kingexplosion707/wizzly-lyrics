// Spicy Lyrics for Wizzly: word-by-word lyrics in Wizzly's Dynamic Island (collapsed and opened),
// its karaoke window, plus Spotify Canvas and Apple Music animated covers on every Wizzly cover
// and media background. Injected into Wizzly's windows by loader.js; it only adds to the page,
// so Wizzly keeps working the same if this script stops.
//
// Where things come from:
//  - What plays and where: Wizzly itself (get_notch_state), and the Live Lyrics relay
//    (ws://127.0.0.1:8973, from the Live Lyrics wallpaper install) when it is running: it has
//    Spotify's own word-by-word lyrics, the Canvas and animated covers.
//  - Lyrics without the relay: Apple Music / Spicy Lyrics syncs (RMM Revival), then LRCLIB.
(function () {
  "use strict";
  if (window.__spicyWizzly) return;
  window.__spicyWizzly = { version: "1.0.0" };

  const VIEW = new URLSearchParams(location.search).get("view") || "dock";
  if (!["notch", "karaoke", "dock"].includes(VIEW)) return;

  // ---- settings (shared by all Wizzly windows: same origin) -------------------------------
  const DEFAULTS = { compact: "always", spicy: true, coverVideo: true, bgVideo: true, translate: "", offset: 0 };
  const settings = {
    get(k) {
      try {
        const v = localStorage.getItem("spicyWizzly:" + k);
        return v == null ? DEFAULTS[k] : JSON.parse(v);
      } catch (_) { return DEFAULTS[k]; }
    },
    set(k, v) {
      try { localStorage.setItem("spicyWizzly:" + k, JSON.stringify(v)); } catch (_) {}
      apply();
    },
  };
  window.addEventListener("storage", (e) => { if (e.key && e.key.startsWith("spicyWizzly:")) apply(); });

  const invoke = (cmd, args) => {
    const t = window.__TAURI_INTERNALS__;
    return t && typeof t.invoke === "function" ? t.invoke(cmd, args || {}) : Promise.reject(new Error("no tauri"));
  };

  // ---- text helpers -------------------------------------------------------------------------
  const plain = (text) =>
    String(text || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/\s*[([][^)\]]*(feat|ft\.|with|remaster|version|edit|live|mix|official|lyric|audio|video)[^)\]]*[)\]]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const loose = (a, b) => { const x = plain(a), y = plain(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
  const leadArtist = (a) => String(a || "").split(/\s*(?:,|;|&|\/| feat\.? | ft\.? | x | and )\s*/i)[0] || a || "";

  async function getJson(url) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      return r.ok ? await r.json() : null;
    } catch (_) { return null; } finally { clearTimeout(timer); }
  }

  // ---- lyrics lookup ------------------------------------------------------------------------
  const sec = (raw) => {
    if (raw == null || raw === "") return null;
    const t = String(raw).trim();
    if (t.endsWith("ms")) return parseFloat(t) / 1000;
    if (t.endsWith("s") && !t.includes(":")) return parseFloat(t);
    return t.split(":").map(parseFloat).reduce((a, p) => a * 60 + p, 0);
  };

  function parseTtml(text) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) return null;
    const META = "http://www.w3.org/ns/ttml#metadata";
    const role = (n) => n.getAttribute("ttm:role") || n.getAttributeNS(META, "role");
    const lines = [];
    let wordTimed = false;
    for (const p of Array.from(doc.getElementsByTagName("p"))) {
      const words = [];
      const bg = [];
      const walk = (node, into) => {
        let space = false;
        for (const c of Array.from(node.childNodes)) {
          if (c.nodeType === 3) { if (/\s/.test(c.nodeValue || "")) space = true; continue; }
          if (c.nodeType !== 1 || c.localName !== "span") continue;
          const r = role(c);
          if (r === "x-bg") { walk(c, bg); continue; }
          if (r === "x-translation" || r === "x-roman") continue;
          const s = sec(c.getAttribute("begin")), e = sec(c.getAttribute("end"));
          const v = c.textContent || "";
          if (s == null || !v.trim()) continue;
          wordTimed = true;
          if (into.length && !space && !/^\s/.test(v)) {
            const prev = into[into.length - 1];
            prev.text += v.trim();
            prev.end = (e != null ? e : s) * 1000;
          } else into.push({ text: v.trim(), start: s * 1000, end: (e != null ? e : s) * 1000 });
          space = /\s$/.test(v);
        }
      };
      walk(p, words);
      const start = (sec(p.getAttribute("begin")) || 0) * 1000;
      const end = (sec(p.getAttribute("end")) || 0) * 1000;
      const text = words.length ? words.map((w) => w.text).join(" ") : (p.textContent || "").trim();
      if (text) lines.push({ start, end: Math.max(start, end), text, words, bg: bg.map((w) => w.text).join(" ") });
    }
    return lines.length ? { synced: wordTimed ? "word" : "line", lines } : null;
  }

  const STAMP = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
  const stamp = (m, s) => (parseInt(m, 10) * 60 + parseFloat(String(s).replace(":", "."))) * 1000;

  function parseLrc(text) {
    const rows = [];
    for (const raw of String(text).split(/\r?\n/)) {
      const st = Array.from(raw.matchAll(STAMP));
      if (!st.length) continue;
      const body = raw.replace(STAMP, "").replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, "").trim();
      for (const x of st) rows.push({ start: stamp(x[1], x[2]), text: body });
    }
    rows.sort((a, b) => a.start - b.start);
    const lines = rows.map((r, i) => ({ start: r.start, end: rows[i + 1] ? rows[i + 1].start : r.start + 5000, text: r.text, words: [], bg: "" }))
      .filter((l) => l.text && l.text !== "♪");
    return lines.length ? { synced: "line", lines } : null;
  }

  /** Line-timed lines get words at a sung pace, so they still light up word by word. */
  function paceWords(lyrics) {
    for (const l of lyrics.lines) {
      if (l.words.length) continue;
      const parts = l.text.split(/\s+/).filter(Boolean);
      const span = Math.max(400, l.end - l.start);
      const natural = parts.reduce((a, t) => a + 180 + t.length * 55, 0);
      const sung = Math.min(span * 0.92, Math.max(span * 0.5, natural));
      const total = parts.reduce((a, t) => a + t.length + 1, 0) || 1;
      let at = l.start;
      l.words = parts.map((t) => { const d = (sung * (t.length + 1)) / total; const w = { text: t, start: at, end: at + d }; at += d; return w; });
    }
    return lyrics;
  }

  const lyricCache = new Map();
  function findLyrics(track) {
    const key = plain(track.artist) + "|" + plain(track.title);
    if (lyricCache.has(key)) return lyricCache.get(key);
    const job = (async () => {
      const artist = leadArtist(track.artist);
      const found = await getJson("https://itunes.apple.com/search?entity=song&limit=10&term=" + encodeURIComponent(artist + " " + track.title));
      const songs = ((found && found.results) || []).filter((s) => loose(s.artistName, artist) && loose(s.trackName, track.title));
      if (track.durationMs) songs.sort((a, b) => Math.abs((a.trackTimeMillis || 0) - track.durationMs) - Math.abs((b.trackTimeMillis || 0) - track.durationMs));
      const apple = songs[0];
      if (apple) {
        const d = await getJson("https://lyrics.rmmreviv.al/lyrics?id=" + apple.trackId);
        const text = d && ["ttml", "content", "syncedLyrics", "lyrics"].map((k) => d[k]).find((v) => typeof v === "string" && v.trim());
        const parsed = text ? (/<tt[\s>]/i.test(text) ? parseTtml(text) : parseLrc(text)) : null;
        if (parsed && parsed.synced === "word") return parsed;
      }
      const q = new URLSearchParams({ artist_name: artist, track_name: track.title });
      if (track.durationMs) q.set("duration", String(Math.round(track.durationMs / 1000)));
      let l = await getJson("https://lrclib.net/api/get?" + q);
      if (!(l && l.syncedLyrics)) {
        const list = await getJson("https://lrclib.net/api/search?" + new URLSearchParams({ artist_name: artist, track_name: track.title }));
        const hits = (Array.isArray(list) ? list : []).filter((h) => h && h.syncedLyrics);
        if (track.durationMs) hits.sort((a, b) => Math.abs(a.duration * 1000 - track.durationMs) - Math.abs(b.duration * 1000 - track.durationMs));
        l = hits[0];
      }
      return l && l.syncedLyrics ? paceWords(parseLrc(l.syncedLyrics) || { lines: [] }) : null;
    })();
    lyricCache.set(key, job);
    if (lyricCache.size > 40) lyricCache.delete(lyricCache.keys().next().value);
    job.then((r) => { if (!r) setTimeout(() => lyricCache.delete(key), 120000); });
    return job;
  }

  /** The relay's lyrics shape to ours. */
  function fromRelay(ly) {
    if (!ly || !Array.isArray(ly.lines) || !ly.lines.length || ly.type === "static") return null;
    const lines = [];
    for (const l of ly.lines) {
      const words = (l.words || []).map((w) => ({ text: String(w.text || "").trim(), start: w.startMs, end: w.endMs })).filter((w) => w.text);
      if (l.isBackground && lines.length) { lines[lines.length - 1].bg = l.text; continue; }
      if (!String(l.text || "").trim()) continue;
      lines.push({ start: l.startMs, end: l.endMs, text: String(l.text).trim(), words, bg: "" });
    }
    return lines.length ? paceWords({ synced: ly.type === "syllable" ? "word" : "line", lines }) : null;
  }

  // ---- now playing ------------------------------------------------------------------------
  const now = { key: "", title: "", artist: "", durationMs: 0, playing: false, base: 0, at: performance.now(), hasTimeline: false };
  let lyrics = null;
  let lyricsKey = "";
  const visuals = { canvas: "", art: "", artFor: "" };
  const relay = { ws: null, port: 0, key: "", lyrics: null, pos: 0, posAt: 0, playing: false, seenAt: 0 };

  const position = () => {
    // The relay's clock is exact for Spotify; Wizzly's is the fallback.
    if (relay.key && relay.key === now.key && performance.now() - relay.seenAt < 15000) {
      return relay.pos + (relay.playing ? Date.now() - relay.posAt : 0);
    }
    return now.base + (now.playing ? performance.now() - now.at : 0);
  };

  async function pollWizzly() {
    let state = null;
    try { state = await invoke("get_notch_state"); } catch (_) { return; }
    const m = state && state.media;
    if (!m || !m.title) {
      if (now.key) { now.key = ""; lyrics = null; lyricsKey = ""; }
      return;
    }
    const key = plain(m.artist) + "|" + plain(m.title);
    now.title = m.title;
    now.artist = m.artist || "";
    now.durationMs = Math.round((m.durationSeconds || 0) * 1000);
    now.hasTimeline = !!m.hasTimeline;
    const pos = Math.round((m.positionSeconds || 0) * 1000);
    const playing = !!m.isPlaying;
    const predicted = now.base + (now.playing ? performance.now() - now.at : 0);
    // Accept Wizzly's position when it moved for real (seek, new song, pause/play); small drift
    // keeps the smoother local clock.
    if (key !== now.key || playing !== now.playing || Math.abs(pos - predicted) > 900) {
      now.base = pos;
      now.at = performance.now();
    }
    now.playing = playing;
    if (key !== now.key) {
      now.key = key;
      loadLyrics();
    }
  }

  function loadLyrics() {
    const key = now.key;
    if (!key || lyricsKey === key) return;
    lyricsKey = key;
    lyrics = null;
    renderAll();
    const fromSpotify = relay.key === key ? fromRelay(relay.lyrics) : null;
    if (fromSpotify && fromSpotify.synced === "word") { lyrics = fromSpotify; renderAll(); return; }
    findLyrics({ title: now.title, artist: now.artist, durationMs: now.durationMs }).then((found) => {
      if (lyricsKey !== key) return;
      lyrics = found && found.lines.length ? found : fromSpotify;
      renderAll();
    });
  }

  // ---- the relay (Live Lyrics wallpaper helper) --------------------------------------------
  let relayIndex = 0;
  function connectRelay() {
    let sock;
    const port = 8973 + (relayIndex % 4);
    try { sock = new WebSocket("ws://127.0.0.1:" + port); } catch (_) { relayIndex++; setTimeout(connectRelay, 4000); return; }
    let opened = false;
    const timer = setTimeout(() => { if (sock.readyState === 0) sock.close(); }, 4000);
    sock.onopen = () => { opened = true; clearTimeout(timer); relay.ws = sock; relay.port = port; };
    sock.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }
      if (msg.command || msg.player) return;
      if (msg.canvasVideo) {
        visuals.canvas = msg.canvasVideo.url ? relayUrl(msg.canvasVideo.url) : "";
        applyVisuals();
        return;
      }
      if (msg.animatedArt) {
        visuals.art = msg.animatedArt.url ? relayUrl(msg.animatedArt.url) : "";
        visuals.artFor = plain(msg.animatedArt.artist) + "|" + plain(msg.animatedArt.album);
        applyVisuals();
        return;
      }
      relay.seenAt = performance.now();
      if (typeof msg.position === "number" && typeof msg.timestamp === "number") {
        relay.pos = msg.position;
        relay.posAt = msg.timestamp;
      }
      if (typeof msg.isPlaying === "boolean") relay.playing = msg.isPlaying;
      if (msg.track) {
        const key = plain(msg.track.artist) + "|" + plain(msg.track.title);
        if (key !== relay.key) { visuals.canvas = ""; visuals.art = ""; applyVisuals(); }
        relay.key = key;
        if (msg.lyrics) relay.lyrics = msg.lyrics;
        else if (!msg.pending && key !== relay.key) relay.lyrics = null;
        const better = key === now.key ? fromRelay(msg.lyrics) : null;
        if (better && better.synced === "word" && (!lyrics || lyrics.synced !== "word")) { lyrics = better; renderAll(); }
      }
    };
    sock.onclose = () => {
      clearTimeout(timer);
      if (relay.ws === sock) relay.ws = null;
      if (!opened) relayIndex++;
      setTimeout(connectRelay, opened ? 2000 : 6000);
    };
    sock.onerror = () => { try { sock.close(); } catch (_) {} };
  }
  const relayUrl = (u) => (/^https?:/i.test(u) ? u : "http://127.0.0.1:" + (relay.port || 8973) + (u.startsWith("/") ? "" : "/") + u);

  function seek(ms) {
    const target = Math.max(0, Math.round(ms - settings.get("offset")));
    invoke("seek_media", { positionSeconds: target / 1000 }).catch(() => {});
    now.base = target;
    now.at = performance.now();
    if (relay.key === now.key) { relay.pos = target; relay.posAt = Date.now(); }
  }

  // ---- rendering ---------------------------------------------------------------------------
  const CSS = `
  .spicy-view{position:absolute;inset:0;overflow:hidden;z-index:3;-webkit-mask-image:linear-gradient(transparent,#000 18%,#000 80%,transparent);pointer-events:auto}
  .spicy-scroll{position:absolute;left:0;right:0;top:0;padding:0 6px;will-change:transform;transition:transform .55s cubic-bezier(.22,1,.36,1)}
  .spicy-line{font-weight:800;letter-spacing:-.015em;line-height:1.2;margin:0 0 .55em;color:rgba(255,255,255,.34);cursor:pointer;transform-origin:left center;transition:color .35s,transform .45s cubic-bezier(.22,1,.36,1),filter .45s,opacity .45s;filter:blur(.8px)}
  .karaoke-viewport .spicy-line{text-align:center;transform-origin:center}
  .spicy-line:hover{color:rgba(255,255,255,.7);filter:none}
  .spicy-line.is-done{color:rgba(255,255,255,.5)}
  .spicy-line.is-now{transform:scale(1.04);filter:none;opacity:1}
  .spicy-w{display:inline-block;white-space:pre}
  .spicy-line.is-now .spicy-w{background:linear-gradient(90deg,#fff var(--p,-10%),rgba(255,255,255,.34) calc(var(--p,-10%) + 10%));-webkit-background-clip:text;background-clip:text;color:transparent}
  .spicy-w.is-singing{filter:drop-shadow(0 0 .22em rgba(255,255,255,.45))}
  .spicy-w.is-long{filter:drop-shadow(0 0 .35em rgba(var(--spicy-accent,255,255,255),.8))}
  .spicy-bgv{font-size:.62em;font-weight:700;opacity:.75;margin-top:.12em}
  .spicy-dots{display:inline-flex;gap:.32em;padding:.2em 0}
  .spicy-dots i{width:.32em;height:.32em;border-radius:50%;background:#fff;opacity:.3;transition:opacity .15s,transform .15s}
  .notch-lyrics-viewport:has(> .spicy-view) > :not(.spicy-view),.karaoke-viewport:has(> .spicy-view) > :not(.spicy-view){opacity:0!important;pointer-events:none!important}
  .notch-lyrics-viewport,.karaoke-viewport{position:relative}
  .notch-lyrics-viewport .spicy-view{font-size:14px}
  .karaoke-viewport .spicy-view{font-size:var(--spicy-karaoke-size,26px)}
  .spicy-compact{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:center;font-weight:700;font-size:13px;padding:0 8px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
  .spicy-compact .spicy-w{background:linear-gradient(90deg,#fff var(--p,-10%),rgba(255,255,255,.45) calc(var(--p,-10%) + 10%));-webkit-background-clip:text;background-clip:text;color:transparent}
  .notch-compact-lyric-wrap:has(> .spicy-compact) .notch-compact-lyric-text{opacity:0}
  .notch-compact-lyric-wrap{position:relative}
  .notch-compact-lyric-wrap > .spicy-compact{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
  .notch-pill.spicy-wide{width:auto!important;min-width:222px;max-width:min(736px,92vw)!important}
  .notch-pill.spicy-wide .notch-compact-clock{display:none}
  .spicy-cv{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;pointer-events:none;z-index:2;opacity:0;transition:opacity .6s}
  .spicy-cv.is-ready{opacity:1}
  .notch-art-box,.notch-mini-cover-wrap,.notch-alert-art-wrap,.karaoke-art,.cc-media-art{position:relative}
  .notch-art-box,.notch-mini-cover-wrap,.karaoke-art,.cc-media-art{overflow:hidden}
  .notch-pill.is-expanded,.karaoke-card,.cc-bento-media{isolation:isolate}
  .spicy-bgvideo{position:absolute;inset:-10%;width:120%;height:120%;object-fit:cover;z-index:-1;pointer-events:none;filter:blur(28px) saturate(1.3) brightness(.45);opacity:0;transition:opacity .8s}
  .spicy-bgvideo.is-ready{opacity:1}
  .spicy-btn{font:700 12px system-ui;color:#fff;background:rgba(255,255,255,.1);border:0;border-radius:999px;height:24px;min-width:24px;padding:0 8px;cursor:pointer}
  .spicy-btn.is-on{background:#fff;color:#000}
  .spicy-menu{position:fixed;z-index:99999;min-width:230px;padding:10px;border-radius:14px;background:rgba(14,14,20,.96);box-shadow:0 18px 40px rgba(0,0,0,.6);color:#fff;font:12.5px system-ui;display:flex;flex-direction:column;gap:6px}
  .spicy-menu b{font-size:13px;margin-bottom:2px}
  .spicy-menu label{display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer}
  .spicy-menu select{background:#222;color:#fff;border:1px solid #444;border-radius:6px;padding:2px 4px}
  `;

  function injectCss() {
    if (document.getElementById("spicy-wizzly-css")) return;
    const st = document.createElement("style");
    st.id = "spicy-wizzly-css";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  const views = new Set();        // {host, root, scroll, rows, lyricsRef}

  function buildRows(root, scroll) {
    scroll.textContent = "";
    const rows = [];
    if (!lyrics) return rows;
    let prevEnd = 0;
    lyrics.lines.forEach((line, i) => {
      const first = line.words.length ? line.words[0].start : line.start;
      if ((i === 0 ? first : line.start) - prevEnd >= 3000) {
        const d = document.createElement("div");
        d.className = "spicy-line spicy-gap";
        const dots = document.createElement("span");
        dots.className = "spicy-dots";
        dots.innerHTML = "<i></i><i></i><i></i>";
        d.appendChild(dots);
        scroll.appendChild(d);
        rows.push({ el: d, gap: true, start: prevEnd, end: i === 0 ? first : line.start, dots: Array.from(dots.children) });
      }
      const el = document.createElement("div");
      el.className = "spicy-line";
      const words = line.words.map((w, k) => {
        if (k) el.appendChild(document.createTextNode(" "));
        const s = document.createElement("span");
        s.className = "spicy-w";
        s.textContent = w.text;
        el.appendChild(s);
        return { el: s, w };
      });
      if (line.bg) {
        const b = document.createElement("div");
        b.className = "spicy-bgv";
        b.textContent = line.bg;
        el.appendChild(b);
      }
      el.addEventListener("click", (e) => { e.stopPropagation(); seek(line.start); });
      scroll.appendChild(el);
      rows.push({ el, line, words, start: line.start });
      const last = line.words[line.words.length - 1];
      prevEnd = Math.max(prevEnd, last ? last.end : line.start + 1000);
    });
    return rows;
  }

  function ensureView(host) {
    let v = null;
    for (const x of views) if (x.host === host) v = x;
    if (v && v.root.isConnected && v.lyricsRef === lyrics) return v;
    if (v) { v.root.remove(); views.delete(v); }
    const root = document.createElement("div");
    root.className = "spicy-view";
    const scroll = document.createElement("div");
    scroll.className = "spicy-scroll";
    root.appendChild(scroll);
    host.appendChild(root);
    v = { host, root, scroll, rows: buildRows(root, scroll), lyricsRef: lyrics, current: -2 };
    views.add(v);
    return v;
  }

  function currentRow(rows, pos) {
    let c = -1;
    for (let i = 0; i < rows.length; i++) if (rows[i].start <= pos) c = i; else break;
    return c;
  }

  function paintWords(words, pos) {
    for (const { el, w } of words) {
      const span = Math.max(1, w.end - w.start);
      const p = Math.min(1, Math.max(0, (pos - w.start) / span));
      el.style.setProperty("--p", (p * 110 - 10).toFixed(1) + "%");
      const singing = p > 0 && p < 1;
      el.classList.toggle("is-singing", singing);
      el.classList.toggle("is-long", singing && span > 900);
    }
  }

  function tickView(v, pos) {
    const c = currentRow(v.rows, pos);
    if (c !== v.current) {
      v.rows.forEach((r, i) => { r.el.classList.toggle("is-now", i === c); r.el.classList.toggle("is-done", i < c); });
      v.current = c;
      const target = v.rows[Math.max(0, c)];
      if (target) {
        const y = target.el.offsetTop - v.root.clientHeight * 0.38;
        v.scroll.style.transform = "translateY(" + (-Math.max(0, y)) + "px)";
      }
    }
    const r = v.rows[c];
    if (!r) return;
    if (r.gap) {
      const span = Math.max(1, r.end - r.start - 550);
      r.dots.forEach((d, i) => {
        const p = Math.min(1, Math.max(0, ((pos - r.start) / span) * 3 - i));
        d.style.opacity = (0.3 + 0.7 * p).toFixed(2);
        d.style.transform = "scale(" + (0.8 + 0.3 * p).toFixed(2) + ")";
      });
    } else paintWords(r.words, pos);
  }

  // The current line, word by word, for the collapsed island.
  let compactLine = null;
  let compactEl = null;
  function compactFor(host, pos) {
    if (!lyrics) return null;
    let line = null;
    for (const l of lyrics.lines) if (l.start <= pos) line = l; else break;
    const last = line && line.words[line.words.length - 1];
    if (line && last && pos > last.end + 2500) line = null;     // singing rests
    if (!compactEl || !compactEl.isConnected || compactEl.parentNode !== host) {
      compactEl = document.createElement("div");
      compactEl.className = "spicy-compact";
      host.appendChild(compactEl);
      compactLine = undefined;
    }
    if (line !== compactLine) {
      compactLine = line;
      compactEl.textContent = "";
      compactEl._words = [];
      if (line) {
        line.words.forEach((w, k) => {
          if (k) compactEl.appendChild(document.createTextNode(" "));
          const s = document.createElement("span");
          s.className = "spicy-w";
          s.textContent = w.text;
          compactEl.appendChild(s);
          compactEl._words.push({ el: s, w });
        });
      } else compactEl.textContent = "♪  " + now.title;
    }
    paintWords(compactEl._words || [], pos);
    return compactEl;
  }

  function renderAll() {
    for (const v of views) v.root.remove();
    views.clear();
    compactLine = undefined;
  }

  function frame() {
    if (document.hidden) return;
    injectCss();
    const pos = position() + settings.get("offset");
    const spicy = settings.get("spicy") && lyrics;
    // Opened island and karaoke window: Spicy lyrics over Wizzly's list.
    for (const host of document.querySelectorAll(".notch-lyrics-viewport, .karaoke-viewport")) {
      if (spicy) tickView(ensureView(host), pos);
    }
    if (!spicy) for (const v of views) { v.root.remove(); views.delete(v); }
    // Collapsed island.
    if (VIEW === "notch") {
      const mode = settings.get("compact");
      const pill = document.querySelector(".notch-pill");
      const wrap = document.querySelector(".notch-compact-lyric-wrap");
      const clock = document.querySelector(".notch-compact-clock");
      const row = document.querySelector(".notch-compact-row");
      const expanded = pill && pill.classList.contains("is-expanded");
      if (spicy && mode !== "off" && wrap) {
        compactFor(wrap, pos);
      } else if (spicy && mode === "always" && clock && row && !expanded && now.playing) {
        pill.classList.add("spicy-wide");
        compactFor(row, pos);
        if (compactEl && compactEl.previousSibling !== clock) row.insertBefore(compactEl, clock.nextSibling);
      } else {
        if (pill) pill.classList.remove("spicy-wide");
        if (compactEl && (!wrap || compactEl.parentNode !== wrap)) { compactEl.remove(); compactEl = null; }
      }
    }
    addButtons();
  }

  // ---- Canvas & animated covers, everywhere Wizzly shows a cover or a media background -------
  const COVERS = ".notch-art-box, .notch-mini-cover-wrap, .notch-alert-art-wrap, .karaoke-art, .cc-media-art";
  const BACKGROUNDS = ".notch-pill.is-expanded, .karaoke-card, .cc-bento-media";

  function videoIn(host, cls, src) {
    let v = host.querySelector(":scope > video." + cls);
    if (!src) { if (v) v.remove(); return; }
    if (!v) {
      v = document.createElement("video");
      v.className = cls;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.autoplay = true;
      v.addEventListener("loadeddata", () => v.classList.add("is-ready"));
      v.addEventListener("error", () => v.classList.remove("is-ready"));
      host.appendChild(v);
    }
    if (v.getAttribute("src") !== src) { v.classList.remove("is-ready"); v.src = src; v.play().catch(() => {}); }
  }

  function applyVisuals() {
    const coverSrc = settings.get("coverVideo") ? visuals.art || visuals.canvas : "";
    const bgSrc = settings.get("bgVideo") ? visuals.canvas || visuals.art : "";
    // React reuses elements: drop our videos from ones that are no longer a cover / background.
    for (const v of document.querySelectorAll("video.spicy-cv")) if (!v.parentElement.matches(COVERS)) v.remove();
    for (const v of document.querySelectorAll("video.spicy-bgvideo")) if (!v.parentElement.matches(BACKGROUNDS)) v.remove();
    for (const host of document.querySelectorAll(COVERS)) videoIn(host, "spicy-cv", coverSrc);
    for (const host of document.querySelectorAll(BACKGROUNDS)) videoIn(host, "spicy-bgvideo", bgSrc);
  }

  // ---- settings menu (🌶 next to Wizzly's lyrics buttons) ------------------------------------
  function addButtons() {
    for (const bar of document.querySelectorAll(".notch-lyrics-head-btns, .karaoke-controls")) {
      if (bar.querySelector(".spicy-btn")) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "spicy-btn";
      b.title = "Spicy Lyrics";
      b.textContent = "🌶";
      b.addEventListener("click", (e) => { e.stopPropagation(); openMenu(b); });
      bar.insertBefore(b, bar.firstChild);
    }
  }

  let menu = null;
  function openMenu(anchor) {
    if (menu) { menu.remove(); menu = null; return; }
    menu = document.createElement("div");
    menu.className = "spicy-menu";
    const r = anchor.getBoundingClientRect();
    menu.style.top = Math.round(r.bottom + 6) + "px";
    menu.style.right = Math.max(8, Math.round(innerWidth - r.right)) + "px";
    const toggle = (key, label) => {
      const l = document.createElement("label");
      l.innerHTML = "<span></span><input type=checkbox>";
      l.firstChild.textContent = label;
      const i = l.lastChild;
      i.checked = !!settings.get(key);
      i.addEventListener("change", () => settings.set(key, i.checked));
      return l;
    };
    const title = document.createElement("b");
    title.textContent = "🌶 Spicy Lyrics";
    const compact = document.createElement("label");
    compact.innerHTML = "<span>Lyrics in the closed island</span><select><option value=always>Always</option><option value=lyrics>In lyrics mode</option><option value=off>Off</option></select>";
    const sel = compact.querySelector("select");
    sel.value = settings.get("compact");
    sel.addEventListener("change", () => settings.set("compact", sel.value));
    const offset = document.createElement("label");
    offset.innerHTML = "<span>Timing</span><span><button class=spicy-btn>−</button> <em></em> <button class=spicy-btn>+</button></span>";
    const em = offset.querySelector("em");
    const show = () => { const o = settings.get("offset"); em.textContent = (o > 0 ? "+" : "") + (o / 1000).toFixed(1) + "s"; };
    const [minus, plus] = offset.querySelectorAll("button");
    minus.addEventListener("click", (e) => { e.preventDefault(); settings.set("offset", settings.get("offset") - 100); show(); });
    plus.addEventListener("click", (e) => { e.preventDefault(); settings.set("offset", settings.get("offset") + 100); show(); });
    show();
    menu.append(title, compact, toggle("spicy", "Word-by-word lyrics"), toggle("coverVideo", "Animated cover / Canvas on covers"),
      toggle("bgVideo", "Canvas background"), offset);
    const note = document.createElement("small");
    note.style.opacity = ".55";
    note.textContent = relay.ws ? "Live Lyrics relay connected (Canvas, animated covers)" : "Canvas & animated covers need the Live Lyrics relay";
    menu.appendChild(note);
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener("click", function close(e) {
      if (menu && !menu.contains(e.target)) { menu.remove(); menu = null; document.removeEventListener("click", close); }
    }), 0);
  }

  function apply() { renderAll(); applyVisuals(); }

  // ---- start --------------------------------------------------------------------------------
  injectCss();
  pollWizzly();
  setInterval(pollWizzly, 1000);
  connectRelay();
  let visualsQueued = false;
  new MutationObserver(() => {
    if (visualsQueued) return;
    visualsQueued = true;
    requestAnimationFrame(() => { visualsQueued = false; applyVisuals(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  let last = 0;
  (function loop(t) {
    requestAnimationFrame(loop);
    if (t - last < 33) return;      // ~30 fps is plenty for text
    last = t;
    try { frame(); } catch (e) { console.warn("[spicy-wizzly]", e); }
  })(0);
})();
