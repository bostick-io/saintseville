/* Saint Seville — Live Ask backend (Vercel serverless function).

   Retrieval stays identical to the client-side engine in ask.js: BM25
   over index.json for the approved corpus, plus a plain term-overlap
   match over the article abstracts in sources.json. Nothing here ever
   calls out to the open web. The model only ever sees the passages and
   abstracts retrieved below and is instructed to use nothing else.

   Protection, per the "simple, no new accounts" choice: a same-origin
   check, a best-effort in-memory rate limit (per warm instance, not
   durable across cold starts or regions — a soft first line, not the
   backstop), and a short question length cap. The real budget backstop
   is the spend limit set on the Anthropic API key itself in the
   Anthropic Console, which is outside this code by design. */

"use strict";

var registry = require("../sources.json");
var idx = require("../index.json");

var MODEL = "claude-haiku-4-5";
var MAX_Q_LEN = 300;
var TOP_N_CORPUS = 6;
var TOP_N_ARTICLES = 3;
var SCORE_FLOOR = 3.0;

var ALLOWED_ORIGINS = {
  "https://www.saintseville.org": 1,
  "https://saintseville.org": 1
};

var STOP = {};
("a an and are as at be but by for from has have how i in is it its of on or " +
 "so that the their there these this to was we what when where which who why " +
 "will with about does do did can could should would may might must not no if")
  .split(" ").forEach(function (w) { STOP[w] = 1; });

function tokens(s) {
  return String(s).toLowerCase().replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter(function (w) { return w.length > 1 && !STOP[w]; });
}

/* ---- BM25 over the prebuilt corpus index, same algorithm as ask.js ---- */
function searchCorpus(q) {
  var qts = tokens(q);
  if (!qts.length) return [];
  var seen = Object.create(null);
  qts = qts.filter(function (t) { if (seen[t]) return false; seen[t] = 1; return true; });
  var N = idx.meta.length;

  var unknown = qts.filter(function (t) { return !idx.terms[t]; });
  if (unknown.length * 2 > qts.length) return [];

  var informative = qts.filter(function (t) {
    return idx.terms[t] && idx.terms[t].length / 2 < N * 0.25;
  });
  var isInformative = Object.create(null);
  informative.forEach(function (t) { isInformative[t] = 1; });

  var scores = Object.create(null);
  var covered = Object.create(null);
  var k1 = 1.4, b = 0.6;
  qts.forEach(function (t) {
    var post = idx.terms[t];
    if (!post) return;
    var df = post.length / 2;
    var idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    for (var j = 0; j < post.length; j += 2) {
      var i = post[j], tf = post[j + 1];
      var norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * idx.lengths[i] / idx.avgLen));
      scores[i] = (scores[i] || 0) + idf * norm;
      if (isInformative[t]) covered[i] = (covered[i] || 0) + 1;
    }
  });

  var need = Math.min(3, Math.ceil(informative.length / 2));
  var hits = Object.keys(scores).filter(function (i) {
    return (covered[i] || 0) >= need;
  }).map(function (i) { return { i: +i, score: scores[i] }; });
  hits.sort(function (a, c) { return c.score - a.score; });
  return hits.slice(0, TOP_N_CORPUS).filter(function (h) { return h.score >= SCORE_FLOOR; });
}

/* ---- plain term-overlap match over indexed commentary abstracts ---- */
function searchArticles(q, limit) {
  var qts = tokens(q);
  if (!qts.length) return [];
  var arts = (registry.sources || []).filter(function (s) { return s.kind === "article"; });
  var scored = arts.map(function (a) {
    var hay = tokens((a.title || "") + " " + (a.abstract || "") + " " + (a.tags || []).join(" "));
    var hset = Object.create(null);
    hay.forEach(function (w) { hset[w] = 1; });
    var score = 0;
    qts.forEach(function (t) { if (hset[t]) score++; });
    return { a: a, score: score };
  }).filter(function (x) { return x.score > 0; });
  scored.sort(function (x, y) { return y.score - x.score; });
  return scored.slice(0, limit).map(function (x) { return x.a; });
}

/* ---- best-effort in-memory rate limit, lives for one warm instance ---- */
var minuteBuckets = new Map();
var dayBuckets = new Map();
var MINUTE_MS = 60 * 1000;
var MAX_PER_MINUTE = 8;
var MAX_PER_DAY = 60;

function rateLimited(ip) {
  var now = Date.now();
  var mb = minuteBuckets.get(ip);
  if (!mb || now > mb.reset) { mb = { count: 0, reset: now + MINUTE_MS }; minuteBuckets.set(ip, mb); }
  mb.count++;
  if (mb.count > MAX_PER_MINUTE) return true;

  var dayKey = ip + ":" + new Date().toISOString().slice(0, 10);
  var d = (dayBuckets.get(dayKey) || 0) + 1;
  dayBuckets.set(dayKey, d);
  if (d > MAX_PER_DAY) return true;
  return false;
}

function clientIp(req) {
  var xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

var SYSTEM_PROMPT =
  "You are the answer engine for SaintSeville.org, a site that catalogues serious " +
  "thinking on AI ethics drawn from the Catholic intellectual tradition. You are given " +
  "retrieved corpus passages (the Church's own words, numbered [1], [2], ...) and, " +
  "separately, indexed commentary abstracts (secondary sources, lettered [A], [B], ...). " +
  "Use nothing outside what is given to you in this message. Never invent a quote, a " +
  "citation, or a source. When you rely on a corpus passage, cite it exactly as given, " +
  "for example (Magnifica Humanitas §99). Describe commentary sources in your own " +
  "words and attribute them by author and publication; never present a commentary " +
  "author's claim as if it were Church teaching. If the material given does not address " +
  "the question, say so plainly rather than guessing. Write in plain prose: no bullet " +
  "points, no headers, no em dashes, no rhetorical question-answer pairs, no AI-sounding " +
  "phrases like 'delve', 'moreover', or 'let's dive in'. Conversational and precise, " +
  "grounded only in the material given. Respond with ONLY a JSON object and nothing else, " +
  "no markdown code fences: {\"answer\": string, \"differ\": string, \"next\": [string, ...]}. " +
  "\"answer\" is your grounded response to the question, two to four sentences unless the " +
  "material genuinely supports more. \"differ\" names any real disagreement visible in the " +
  "material given between the magisterial sources and the commentary, or between commentary " +
  "authors; use an empty string if there is none. \"next\" lists two or three short items, " +
  "each naming one source given above by its short title, worth reading next; use an empty " +
  "array if nothing fits.";

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method not allowed" });
    return;
  }

  var origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS[origin]) {
    res.status(403).json({ ok: false, error: "origin not allowed" });
    return;
  }

  var ip = clientIp(req);
  if (rateLimited(ip)) {
    res.status(429).json({ ok: false, error: "Too many questions from this connection right now. Try again in a minute." });
    return;
  }

  var body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  var q = String((body && body.q) || "").trim().slice(0, MAX_Q_LEN);
  if (q.length < 3) {
    res.status(400).json({ ok: false, error: "question too short" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ ok: false, error: "The live analysis is not configured yet." });
    return;
  }

  var corpusHits, articles;
  try {
    corpusHits = searchCorpus(q);
    articles = searchArticles(q, TOP_N_ARTICLES);
  } catch (e) {
    res.status(500).json({ ok: false, error: "retrieval failed" });
    return;
  }

  if (!corpusHits.length && !articles.length) {
    res.status(200).json({
      ok: true,
      refused: true,
      message: "The approved sources do not appear to address that question."
    });
    return;
  }

  var passageLines = corpusHits.map(function (h, n) {
    var m = idx.meta[h.i];
    var d = idx.docs[m[0]];
    var cite = d.cite + " §" + m[1];
    return "[" + (n + 1) + "] " + cite + ": \"" + idx.excerpts[h.i] + "\"";
  }).join("\n");

  var articleLines = articles.map(function (a, n) {
    return "[" + String.fromCharCode(65 + n) + "] \"" + a.title + "\" — " + a.author + ", " +
      a.publisher + ", " + String(a.date).slice(0, 4) + ". " + a.url + "\nAbstract: " + a.abstract;
  }).join("\n\n");

  var userMsg =
    "CORPUS PASSAGES (quote verbatim, cite exactly as shown — these are the Church's own words):\n" +
    (passageLines || "(none retrieved)") +
    "\n\nCOMMENTARY (describe only in your own words, never quote as Church teaching, always attribute):\n" +
    (articleLines || "(none retrieved)") +
    "\n\nQUESTION: " + q;

  var raw;
  try {
    var upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMsg }]
      })
    });
    if (!upstream.ok) {
      res.status(502).json({ ok: false, error: "The analysis service is unavailable right now." });
      return;
    }
    var data = await upstream.json();
    raw = (data.content && data.content[0] && data.content[0].text) || "";
  } catch (e) {
    res.status(502).json({ ok: false, error: "The analysis service is unavailable right now." });
    return;
  }

  var parsed;
  try {
    var cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
    parsed = JSON.parse(cleaned);
  } catch (e) {
    parsed = { answer: raw, differ: "", next: [] };
  }

  res.status(200).json({
    ok: true,
    refused: false,
    answer: String(parsed.answer || ""),
    differ: String(parsed.differ || ""),
    next: Array.isArray(parsed.next) ? parsed.next.slice(0, 3).map(String) : [],
    passages: corpusHits.map(function (h) {
      var m = idx.meta[h.i];
      var d = idx.docs[m[0]];
      return { cite: d.cite + " §" + m[1], url: d.url, text: idx.excerpts[h.i] };
    }),
    articles: articles.map(function (a) {
      return { title: a.title, author: a.author, publisher: a.publisher, url: a.url, date: a.date };
    })
  });
};
