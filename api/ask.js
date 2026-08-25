/* Saint Seville — Live Ask backend (Vercel serverless function).

   Retrieval is not implemented here. It lives in ./_engine, which
   /api/search runs too, so the passages behind an answer are always
   the same passages the reader can see listed underneath it.

   Nothing here calls out to the open web. The model only ever sees the
   passages and abstracts retrieved from the approved corpus and is
   instructed to use nothing else.

   Protection: a same-origin check, a best-effort in-memory rate limit
   (per warm instance, not durable — a soft first line, not the
   backstop), and a short question length cap. The real budget backstop
   is the spend limit on the Anthropic API key itself, which is outside
   this code by design. */

"use strict";

var E = require("./_engine");
var registry = E.registry;
var idx = E.idx;
var tokens = E.tokens;
var searchCorpus = function (q) { return E.searchCorpus(q); };
var searchArticles = function (q, n) { return E.searchArticles(q, n); };

var MODEL = "claude-haiku-4-5";
var MAX_Q_LEN = 300;
var TOP_N_CORPUS = E.TOP_N_CORPUS;
var TOP_N_ARTICLES = E.TOP_N_ARTICLES;
var ALLOWED_ORIGINS = E.ALLOWED_ORIGINS;

/* Rate limit and client IP come from the shared engine. */
var limited = E.makeLimiter(8, 60);
function rateLimited(ip) { return limited(ip); }
function clientIp(req) { return E.clientIp(req); }

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
    return "[" + String.fromCharCode(65 + n) + "] \"" + a.title + "\", " + a.author + ", " +
      a.publisher + ", " + String(a.date).slice(0, 4) + ". " + a.url + "\nAbstract: " + a.abstract;
  }).join("\n\n");

  var userMsg =
    "CORPUS PASSAGES (quote verbatim, cite exactly as shown, these are the Church's own words):\n" +
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

  /* The prompt asks for no em dashes. Models comply most of the time,
     which is not the same as complying. This applies only to prose the
     model wrote; quoted corpus passages pass through untouched, because
     an em dash in a Vatican text is the Vatican's. */
  function noDashes(x) {
    return String(x || "")
      .replace(/\s*[\u2014\u2013]\s*/g, ", ")
      .replace(/,\s*,/g, ",")
      .replace(/\s+,/g, ",")
      .replace(/,\s*([.!?;:])/g, "$1");
  }

  res.status(200).json({
    ok: true,
    refused: false,
    answer: noDashes(parsed.answer),
    differ: noDashes(parsed.differ),
    next: Array.isArray(parsed.next) ? parsed.next.slice(0, 3).map(noDashes) : [],
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
