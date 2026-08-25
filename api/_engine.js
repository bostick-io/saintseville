/* Saint Seville — shared retrieval engine.

   Both /api/search (passages only, no model, cheap) and /api/ask
   (passages plus a grounded answer) run this exact code, so the two
   can never drift apart and disagree about what the corpus says.

   This used to live in the browser as well, which meant every visitor
   downloaded the whole index before they could ask anything. At four
   documents that was already 932KB. The corpus is meant to grow into
   the thirties, so retrieval moved here and the browser now asks a
   question instead of carrying a library.

   Underscore prefix keeps Vercel from routing this file as an endpoint. */

"use strict";

var registry = require("../sources.json");
var idx = require("../index.json");

var TOP_N_CORPUS = 6;
var TOP_N_ARTICLES = 3;
var SCORE_FLOOR = 3.0;

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

/* Modern working vocabulary rarely appears in a magisterial text. The
   Church writes "labour" where a reader types "layoffs", and "the
   technocratic paradigm" where a reader types "big tech". These bridges
   carry a question into the corpus's own words at reduced weight, so a
   term the reader actually typed still outranks one we inferred. */
var BRIDGE = {
  layoff: ["work", "labour", "labor", "employment", "worker"],
  layoffs: ["work", "labour", "labor", "employment", "worker"],
  job: ["work", "labour", "labor", "employment", "vocation"],
  jobs: ["work", "labour", "labor", "employment", "worker"],
  unemployment: ["work", "labour", "labor", "employment", "poverty"],
  automation: ["machine", "technology", "work", "labour", "labor"],
  robot: ["machine", "automation", "technology"],
  robots: ["machine", "automation", "technology"],
  chatbot: ["machine", "intelligence", "communication", "language"],
  chatbots: ["machine", "intelligence", "communication", "language"],
  llm: ["intelligence", "machine", "system"],
  algorithm: ["technology", "machine", "system", "decision"],
  algorithmic: ["technology", "machine", "system", "decision"],
  hiring: ["work", "labour", "labor", "employment", "worker"],
  hire: ["work", "labour", "labor", "employment", "worker"],
  recruitment: ["work", "labour", "labor", "employment"],
  workplace: ["work", "labour", "labor", "employment", "worker"],
  algorithms: ["technology", "machine", "system", "decision"],
  bias: ["discrimination", "prejudice", "justice", "dignity", "equality"],
  biased: ["discrimination", "prejudice", "justice", "equality"],
  surveillance: ["privacy", "freedom", "control", "dignity"],
  privacy: ["dignity", "freedom", "person", "intimacy"],
  data: ["information", "knowledge", "person"],
  deepfake: ["truth", "deception", "image", "communication"],
  deepfakes: ["truth", "deception", "image", "communication"],
  misinformation: ["truth", "deception", "communication", "conscience"],
  disinformation: ["truth", "deception", "communication", "conscience"],
  weapon: ["war", "peace", "arms", "violence"],
  weapons: ["war", "peace", "arms", "violence"],
  drone: ["war", "weapon", "arms", "violence"],
  drones: ["war", "weapon", "arms", "violence"],
  autonomous: ["decision", "responsibility", "control", "freedom"],
  consciousness: ["soul", "person", "intelligence", "spirit", "experience"],
  conscious: ["soul", "person", "intelligence", "spirit"],
  sentient: ["soul", "person", "experience", "spirit"],
  sentience: ["soul", "person", "experience", "spirit"],
  personhood: ["person", "dignity", "soul", "human"],
  creativity: ["creation", "art", "gift", "person"],
  productivity: ["work", "labour", "labor", "efficiency"],
  efficiency: ["work", "technocratic", "production"],
  regulation: ["law", "governance", "authority", "common good"],
  governance: ["authority", "law", "common good", "power"],
  accountability: ["responsibility", "justice", "conscience"],
  responsibility: ["conscience", "moral", "person", "accountability"],
  inequality: ["justice", "poverty", "solidarity", "common good"],
  poverty: ["poor", "justice", "solidarity", "development"],
  education: ["formation", "teaching", "school", "learning", "wisdom"],
  teacher: ["formation", "teaching", "education"],
  student: ["formation", "education", "learning"],
  healthcare: ["health", "medicine", "care", "sick"],
  medicine: ["health", "care", "healing", "sick"],
  therapy: ["care", "health", "healing", "accompaniment"],
  loneliness: ["relationship", "communion", "solitude", "encounter"],
  friendship: ["relationship", "communion", "encounter", "love"],
  company: ["enterprise", "business", "economy"],
  companies: ["enterprise", "business", "economy"],
  corporation: ["enterprise", "business", "economy", "power"],
  startup: ["enterprise", "business", "economy"],
  profit: ["economy", "gain", "business", "common good"],
  market: ["economy", "commerce", "common good"],
  power: ["authority", "domination", "control"],
  war: ["peace", "conflict", "violence", "arms"],
  military: ["war", "arms", "peace", "violence"],
  transhumanism: ["human", "nature", "person", "immortality", "enhancement"],
  singularity: ["human", "nature", "future", "technology"],
  agi: ["intelligence", "machine", "human"],
  copyright: ["property", "creation", "author", "justice"],
  art: ["beauty", "creation", "culture", "artist"],
  music: ["beauty", "art", "culture"],
  environment: ["creation", "ecology", "common home", "nature"],
  climate: ["creation", "ecology", "common home", "environment"],
  energy: ["creation", "resource", "ecology"]
};

var BRIDGE_WEIGHT = 0.55;

function expand(qts) {
  var typed = Object.create(null);
  qts.forEach(function (t) { typed[t] = 1; });
  var out = qts.map(function (t) { return { t: t, w: 1 }; });
  qts.forEach(function (t) {
    var bridged = BRIDGE[t];
    if (!bridged) return;
    bridged.forEach(function (b) {
      if (typed[b]) return;
      typed[b] = 1;
      out.push({ t: b, w: BRIDGE_WEIGHT });
    });
  });
  return out;
}

/* BM25 with the bridge terms folded in at reduced weight.
   opts.docs, when given, is a whitelist of document indexes. */
function searchCorpus(q, opts) {
  opts = opts || {};
  var limit = opts.limit || TOP_N_CORPUS;
  var allow = opts.docs && opts.docs.length ? opts.docs : null;
  var allowSet = null;
  if (allow) { allowSet = Object.create(null); allow.forEach(function (d) { allowSet[d] = 1; }); }

  var qts = tokens(q);
  if (!qts.length) return [];
  var seen = Object.create(null);
  qts = qts.filter(function (t) { if (seen[t]) return false; seen[t] = 1; return true; });

  var N = idx.meta.length;
  var terms = expand(qts);

  /* A typed word counts as understood if the corpus knows it OR knows
     something it bridges to. Without this, a question asked entirely in
     modern vocabulary ("algorithmic bias in hiring") is rejected as
     gibberish before the bridge ever gets a chance to work. */
  var reachable = Object.create(null);
  terms.forEach(function (e) { if (idx.terms[e.t]) reachable[e.t] = 1; });
  var unknown = qts.filter(function (t) {
    if (reachable[t]) return false;
    var br = BRIDGE[t] || [];
    for (var k = 0; k < br.length; k++) { if (idx.terms[br[k]]) return false; }
    return true;
  });
  if (unknown.length * 2 > qts.length && !opts.lenient) return [];

  /* Coverage is judged on any term the corpus actually knows, typed or
     bridged, as long as it is selective enough to mean something. */
  var informative = terms.filter(function (e) {
    return idx.terms[e.t] && idx.terms[e.t].length / 2 < N * 0.25;
  }).map(function (e) { return e.t; });
  var isInformative = Object.create(null);
  informative.forEach(function (t) { isInformative[t] = 1; });

  var scores = Object.create(null);
  var covered = Object.create(null);
  var k1 = 1.4, b = 0.6;

  terms.forEach(function (entry) {
    var post = idx.terms[entry.t];
    if (!post) return;
    var df = post.length / 2;
    var idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    for (var j = 0; j < post.length; j += 2) {
      var i = post[j], tf = post[j + 1];
      if (allowSet && !allowSet[idx.meta[i][0]]) continue;
      var norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * idx.lengths[i] / idx.avgLen));
      scores[i] = (scores[i] || 0) + idf * norm * entry.w;
      if (isInformative[entry.t]) covered[i] = (covered[i] || 0) + 1;
    }
  });

  var need = Math.min(3, Math.ceil(informative.length / 2));
  var hits = Object.keys(scores).filter(function (i) {
    return (covered[i] || 0) >= need;
  }).map(function (i) { return { i: +i, score: scores[i] }; });
  hits.sort(function (a, c) { return c.score - a.score; });
  return hits.slice(0, limit).filter(function (h) { return h.score >= SCORE_FLOOR; });
}

function searchArticles(q, limit, allowIds) {
  var qts = tokens(q);
  if (!qts.length) return [];
  var allowSet = null;
  if (allowIds && allowIds.length) {
    allowSet = Object.create(null);
    allowIds.forEach(function (id) { allowSet[id] = 1; });
  }
  var arts = (registry.sources || []).filter(function (s) {
    return s.kind === "article" && (!allowSet || allowSet[s.id]);
  });
  var scored = arts.map(function (a) {
    var hay = tokens((a.title || "") + " " + (a.abstract || "") + " " + (a.tags || []).join(" "));
    var hset = Object.create(null);
    hay.forEach(function (w) { hset[w] = 1; });
    var score = 0;
    qts.forEach(function (t) { if (hset[t]) score++; });
    return { a: a, score: score };
  }).filter(function (x) { return x.score > 0; });
  scored.sort(function (x, y) { return y.score - x.score; });
  return scored.slice(0, limit || TOP_N_ARTICLES).map(function (x) { return x.a; });
}

function shapePassages(hits) {
  return hits.map(function (h) {
    var m = idx.meta[h.i];
    var d = idx.docs[m[0]];
    return {
      cite: d.cite + " §" + m[1],
      short: d.short,
      url: d.url,
      docIdx: m[0],
      para: m[1],
      text: idx.excerpts[h.i]
    };
  });
}

function shapeArticles(arts) {
  return arts.map(function (a) {
    return { id: a.id, title: a.title, author: a.author, publisher: a.publisher, url: a.url, date: a.date, tier: a.tier };
  });
}

/* ---- best-effort in-memory rate limit, one warm instance ---- */
function makeLimiter(perMinute, perDay) {
  var minuteBuckets = new Map();
  var dayBuckets = new Map();
  return function (ip) {
    var now = Date.now();
    var mb = minuteBuckets.get(ip);
    if (!mb || now > mb.reset) { mb = { count: 0, reset: now + 60000 }; minuteBuckets.set(ip, mb); }
    mb.count++;
    if (mb.count > perMinute) return true;
    var dayKey = ip + ":" + new Date().toISOString().slice(0, 10);
    var d = (dayBuckets.get(dayKey) || 0) + 1;
    dayBuckets.set(dayKey, d);
    return d > perDay;
  };
}

function clientIp(req) {
  var xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

var ALLOWED_ORIGINS = {
  "https://www.saintseville.org": 1,
  "https://saintseville.org": 1
};

module.exports = {
  registry: registry,
  idx: idx,
  tokens: tokens,
  searchCorpus: searchCorpus,
  searchArticles: searchArticles,
  shapePassages: shapePassages,
  shapeArticles: shapeArticles,
  makeLimiter: makeLimiter,
  clientIp: clientIp,
  ALLOWED_ORIGINS: ALLOWED_ORIGINS,
  TOP_N_CORPUS: TOP_N_CORPUS,
  TOP_N_ARTICLES: TOP_N_ARTICLES
};
