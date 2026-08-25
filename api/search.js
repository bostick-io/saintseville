/* Saint Seville — retrieval endpoint.

   Passages only. No model call, so this is fast and costs nothing but
   compute, which is why its rate limits are generous compared to /ask.

   The home page calls this first to put cited passages on screen, then
   calls /ask for the grounded answer that sits above them. The advanced
   search page calls this with the reader's source, tier and year
   filters already resolved to a list of document indexes. */

"use strict";

var E = require("./_engine");
var N = require("./_native");

var MAX_Q_LEN = 300;
var LANGS = { en: 1, it: 1, es: 1, fr: 1, de: 1 };
var limited = E.makeLimiter(40, 600);

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method not allowed" });
    return;
  }

  var origin = req.headers.origin;
  if (origin && !E.ALLOWED_ORIGINS[origin]) {
    res.status(403).json({ ok: false, error: "origin not allowed" });
    return;
  }

  if (limited(E.clientIp(req))) {
    res.status(429).json({ ok: false, error: "Too many searches from this connection just now. Try again in a minute." });
    return;
  }

  var body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  var q = String(body.q || "").trim().slice(0, MAX_Q_LEN);
  if (q.length < 2) {
    res.status(400).json({ ok: false, error: "question too short" });
    return;
  }

  var docs = Array.isArray(body.docs) ? body.docs.filter(function (d) { return typeof d === "number"; }) : null;
  var articleIds = Array.isArray(body.articleIds) ? body.articleIds.map(String) : null;
  var limit = Math.min(Math.max(parseInt(body.limit, 10) || E.TOP_N_CORPUS, 1), 12);

  var lang = String(body.lang || "en").toLowerCase();
  if (!LANGS[lang]) lang = "en";

  var hits = E.searchCorpus(q, { docs: docs, limit: limit });
  var arts = E.searchArticles(q, 6, articleIds);

  /* Retrieval scores against the English index either way. What changes
     with lang is which edition of the winning paragraph gets shown, so a
     reader sees the Holy See's own Italian rather than a translation of
     a translation. Unlike /api/ask there is no model here to carry a
     non-English query across first, so an Italian query typed into the
     advanced search still matches on names and shared roots only. */
  var passages = E.shapePassages(hits);
  try {
    passages = await N.localize(passages, lang);
  } catch (e) { /* fall through with the English text */ }

  res.status(200).json({
    ok: true,
    q: q,
    lang: lang,
    passages: passages,
    articles: E.shapeArticles(arts)
  });
};
