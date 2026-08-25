/* Saint Seville — Live Ask backend (Vercel serverless function).

   Retrieval is not implemented here. It lives in ./_engine, which
   /api/search runs too, so the passages behind an answer are always
   the same passages the reader can see listed underneath it.

   Nothing here calls out to the open web for evidence. The model only
   ever sees passages and abstracts retrieved from the approved corpus
   and is instructed to use nothing else. The one outbound fetch is to
   vatican.va, in ./_native, to pull the Holy See's own published text
   of a paragraph we already selected, in the reader's language.

   Language handling, in order: the question is translated into English
   if it arrives in something else, because the index and its vocabulary
   bridge are English and one well tuned index beats five poorly tuned
   ones. Retrieval then runs once. The winning paragraphs are looked up
   in the target language text. The answer is written in the reader's
   language, quoting those native paragraphs.

   Protection: a same-origin check, a best-effort in-memory rate limit
   (per warm instance, not durable, a soft first line rather than the
   backstop), and a short question length cap. The real budget backstop
   is the spend limit on the Anthropic API key itself, which is outside
   this code by design. */

"use strict";

var E = require("./_engine");
var N = require("./_native");
var registry = E.registry;
var idx = E.idx;

var MODEL = "claude-haiku-4-5";
var MAX_Q_LEN = 300;
var TOP_N_CORPUS = E.TOP_N_CORPUS;
var TOP_N_ARTICLES = E.TOP_N_ARTICLES;
var ALLOWED_ORIGINS = E.ALLOWED_ORIGINS;

var LANGS = { en: "English", it: "Italian", es: "Spanish", fr: "French", de: "German" };

var limited = E.makeLimiter(8, 60);

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

function langClause(lang) {
  if (!lang || lang === "en") return "";
  var name = LANGS[lang] || "English";
  return " Write every value in the JSON object in " + name + ". The corpus passages you " +
    "are given are already the Holy See's own published " + name + " text where one exists, " +
    "so quote them exactly as given and do not translate a quotation yourself. A passage " +
    "marked (English text, no " + name + " edition published) must be paraphrased in " +
    name + " rather than quoted, and you should say that the original is in English. " +
    "Document titles and paragraph citations stay exactly as given.";
}

function noDashes(x) {
  return String(x || "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,\s*([.!?;:])/g, "$1");
}

async function callModel(system, user, maxTokens) {
  var upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: system,
      messages: [{ role: "user", content: user }]
    })
  });
  if (!upstream.ok) throw new Error("upstream " + upstream.status);
  var data = await upstream.json();
  return (data.content && data.content[0] && data.content[0].text) || "";
}

/* Retrieval is English. A question in another language is carried across
   before it reaches the index, not after, so the reader's own words are
   never the thing that fails to match. If the translation call falls
   over, the original question is used, which usually still finds the
   proper nouns. */
async function toEnglish(q, lang) {
  if (!lang || lang === "en") return q;
  try {
    var out = await callModel(
      "Translate the user's question into English. Return only the translation, " +
      "no quotes, no commentary, no explanation. Keep proper nouns as they are.",
      q, 200
    );
    var t = String(out).trim();
    return t.length > 2 ? t.slice(0, MAX_Q_LEN) : q;
  } catch (e) {
    return q;
  }
}

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

  var ip = E.clientIp(req);
  if (limited(ip)) {
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

  var lang = String((body && body.lang) || "en").toLowerCase();
  if (!LANGS[lang]) lang = "en";

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ ok: false, error: "The live analysis is not configured yet." });
    return;
  }

  var qEn = await toEnglish(q, lang);

  var corpusHits, articles;
  try {
    corpusHits = E.searchCorpus(qEn);
    articles = E.searchArticles(qEn, TOP_N_ARTICLES);
  } catch (e) {
    res.status(500).json({ ok: false, error: "retrieval failed" });
    return;
  }

  if (!corpusHits.length && !articles.length) {
    res.status(200).json({
      ok: true,
      refused: true,
      lang: lang,
      message: "The approved sources do not appear to address that question."
    });
    return;
  }

  var passages = E.shapePassages(corpusHits);
  try {
    passages = await N.localize(passages, lang);
  } catch (e) {
    passages = passages.map(function (p) {
      var c = Object.assign({}, p);
      c.textLang = "en";
      c.native = lang === "en";
      return c;
    });
  }

  var langName = LANGS[lang];
  var passageLines = passages.map(function (p, n) {
    var tag = p.native || lang === "en"
      ? ""
      : " (English text, no " + langName + " edition published)";
    return "[" + (n + 1) + "] " + p.cite + tag + ": \"" + p.text + "\"";
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
    "\n\nQUESTION: " + q +
    (lang === "en" ? "" : "\n(The same question in English, for your reference: " + qEn + ")");

  var raw;
  try {
    raw = await callModel(SYSTEM_PROMPT + langClause(lang), userMsg, 900);
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
    lang: lang,
    answer: noDashes(parsed.answer),
    differ: noDashes(parsed.differ),
    next: Array.isArray(parsed.next) ? parsed.next.slice(0, 3).map(noDashes) : [],
    passages: passages.map(function (p) {
      return {
        cite: p.cite, url: p.url, text: p.text,
        textLang: p.textLang, native: !!p.native
      };
    }),
    articles: articles.map(function (a) {
      return { title: a.title, author: a.author, publisher: a.publisher, url: a.url, date: a.date };
    })
  });
};
