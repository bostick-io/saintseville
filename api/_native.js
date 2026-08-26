/* Saint Seville — native language passage text.

   The point of a translated Saint Seville is not a translated Saint
   Seville. It is that the Holy See publishes these documents in Italian,
   Spanish, French and German itself, so an Italian reader can be shown
   the Italian the Vatican actually wrote, at the same paragraph number,
   rather than a machine rendering of an English rendering. Anything less
   would undercut the one promise the site makes, which is that the quote
   is the source's own words.

   Retrieval still runs once, on the English index. A question asked in
   another language is translated to English first (see api/ask.js) and
   the winning paragraph numbers are then looked up in the target text.
   One index, one BM25 tuning, one bridge map, five languages.

   Text is fetched on demand and only for documents that actually turn up
   in a result, then held in module scope for the life of the warm
   instance. The Compendium is a megabyte of HTML, so this matters. */

"use strict";

/* vatican.va uses two different language code conventions. The old
   roman_curia tree wants sp and ge; the newer /content tree wants the
   ISO codes. Getting this wrong returns a 404, not a wrong language,
   which at least fails loudly. */
var V = { it: "it", es: "sp", fr: "fr", de: "ge" };

var SOURCES = {
  /* docIdx: { strategy, paragraphs expected, url per language } */
  0: {
    strat: "p",
    count: 117,
    url: function (L) {
      return "https://www.vatican.va/roman_curia/congregations/cfaith/documents/" +
        "rc_ddf_doc_20250128_antiqua-et-nova_" + V[L] + ".html";
    },
    langs: { it: 1, es: 1, fr: 1, de: 1 }
  },
  1: {
    strat: "p",
    count: 245,
    url: function (L) {
      return "https://www.vatican.va/content/leo-xiv/" + L +
        "/encyclicals/documents/20260515-magnifica-humanitas.html";
    },
    langs: { it: 1, es: 1, fr: 1, de: 1 }
  },
  2: {
    strat: "b",
    count: 583,
    url: function (L) {
      return "https://www.vatican.va/roman_curia/pontifical_councils/justpeace/documents/" +
        "rc_pc_justpeace_doc_20060526_compendio-dott-soc_" + V[L] + ".html";
    },
    /* No German Compendium is published. German readers get the English
       text for this document with a visible note saying why. */
    langs: { it: 1, es: 1, fr: 1 }
  }
  /* docIdx 3, the Rome Call, is hosted off vatican.va and has no
     paragraph-numbered translations we can align to. English only. */
};

/* The pages declare iso-8859-1 but write every accented character as a
   numeric entity, so the bytes are plain ASCII and decoding entities is
   the whole job. Named entities are matched case sensitively on purpose:
   folding Egrave into egrave turns a sentence-opening È into è, which is
   exactly the kind of small wrongness that makes a site look machine
   made. */
var NAMED = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'",
  laquo: "«", raquo: "»", ldquo: "“", rdquo: "”",
  lsquo: "‘", rsquo: "’", hellip: "…", ndash: "–",
  mdash: "—", middot: "·", bull: "•", deg: "°",
  agrave: "à", Agrave: "À", aacute: "á", Aacute: "Á",
  acirc: "â", Acirc: "Â", auml: "ä", Auml: "Ä",
  aring: "å", Aring: "Å", atilde: "ã", Atilde: "Ã",
  ccedil: "ç", Ccedil: "Ç",
  egrave: "è", Egrave: "È", eacute: "é", Eacute: "É",
  ecirc: "ê", Ecirc: "Ê", euml: "ë", Euml: "Ë",
  igrave: "ì", Igrave: "Ì", iacute: "í", Iacute: "Í",
  icirc: "î", Icirc: "Î", iuml: "ï", Iuml: "Ï",
  ntilde: "ñ", Ntilde: "Ñ",
  ograve: "ò", Ograve: "Ò", oacute: "ó", Oacute: "Ó",
  ocirc: "ô", Ocirc: "Ô", ouml: "ö", Ouml: "Ö",
  ugrave: "ù", Ugrave: "Ù", uacute: "ú", Uacute: "Ú",
  ucirc: "û", Ucirc: "Û", uuml: "ü", Uuml: "Ü",
  szlig: "ß", oelig: "œ", OElig: "Œ", aelig: "æ", AElig: "Æ"
};

function decode(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, function (m, h) {
      var c = parseInt(h, 16);
      return c ? String.fromCodePoint(c) : m;
    })
    .replace(/&#(\d+);/g, function (m, d) {
      var c = parseInt(d, 10);
      return c ? String.fromCodePoint(c) : m;
    })
    .replace(/&([A-Za-z]+);/g, function (m, n) {
      return NAMED[n] !== undefined ? NAMED[n] : m;
    });
}

/* Footnote markers live in <sup> and would otherwise land mid sentence
   as stray digits. Everything else becomes a space, then collapses. */
function strip(html) {
  var t = decode(
    String(html)
      .replace(/<sup[\s\S]*?<\/sup>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();

  /* Turning every tag into a space leaves gaps that were never in the
     printed text: an incipit set in italics comes out as "[ Antiqua et
     nova ]". Close them up, otherwise the quotation is not quite the
     quotation. */
  /* Footnote markers on the Italian and French pages are bracketed
     numbers in the flow of the text rather than <sup>, so they survive
     the tag strip and land inside the quotation as "[125]". They are
     apparatus, not the Holy See's sentence. */
  t = t.replace(/\s*\[\s*\d{1,4}\s*\]/g, "");

  return t
    .replace(/([(\[«“‘])\s+/g, "$1")
    .replace(/\s+([)\]»”’.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* Antiqua et Nova and Magnifica Humanitas number their paragraphs inside
   the paragraph itself: "1. Con antica e nuova sapienza..." */
function byParagraph(html) {
  var map = Object.create(null);
  var re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  var m;
  while ((m = re.exec(html))) {
    var t = strip(m[1]);
    var n = t.match(/^(\d{1,3})\.\s+(\S[\s\S]*)$/);
    if (!n) continue;
    var num = parseInt(n[1], 10);
    if (!num || map[num]) continue;
    map[num] = n[2].trim();
  }
  return map;
}

/* The Compendium marks each paragraph with a bold number and then runs
   on across several tags, so the paragraph is everything between one
   marker and the next. */
function byBoldMarker(html) {
  var map = Object.create(null);
  var re = /<b\b[^>]*>\s*(?:<[^>]+>\s*)*?(\d{1,3})\s*\.?\s*(?:<\/[^>]+>\s*)*?<\/b>/gi;
  var marks = [];
  var m;
  while ((m = re.exec(html))) {
    marks.push({ n: parseInt(m[1], 10), start: m.index + m[0].length });
  }
  for (var i = 0; i < marks.length; i++) {
    var end = i + 1 < marks.length ? marks[i + 1].start : html.length;
    var num = marks[i].n;
    if (!num || map[num]) continue;
    map[num] = strip(html.slice(marks[i].start, end)).replace(/^\.\s*/, "").trim();
  }
  return map;
}

var cache = Object.create(null);   /* "docIdx:lang" -> map or null */
var inflight = Object.create(null);

var FETCH_TIMEOUT_MS = 8000;

async function load(docIdx, lang) {
  var key = docIdx + ":" + lang;
  if (cache[key] !== undefined) return cache[key];
  if (inflight[key]) return inflight[key];

  var spec = SOURCES[docIdx];
  if (!spec || !spec.langs[lang]) {
    cache[key] = null;
    return null;
  }

  inflight[key] = (async function () {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, FETCH_TIMEOUT_MS);
    try {
      var r = await fetch(spec.url(lang), { signal: ctl.signal });
      if (!r.ok) throw new Error("http " + r.status);
      var html = await r.text();
      var map = spec.strat === "b" ? byBoldMarker(html) : byParagraph(html);

      /* A partial extraction is worse than none. If the page changed
         shape, a reader would silently get some paragraphs in Italian
         and some in English with no way to tell which. Demand almost
         everything or fall back cleanly to English. */
      var have = 0;
      for (var i = 1; i <= spec.count; i++) if (map[i]) have++;
      if (have < spec.count * 0.95) throw new Error("extracted " + have + " of " + spec.count);

      cache[key] = map;
      return map;
    } catch (e) {
      cache[key] = null;
      return null;
    } finally {
      clearTimeout(timer);
      delete inflight[key];
    }
  })();

  return inflight[key];
}

/* The English index stores each paragraph cut to roughly 360 characters
   at a word boundary, with an ellipsis, because the site quotes briefly
   and says so in its own footer. When the native-language text started
   coming from vatican.va it arrived whole, which quietly made an Italian
   reader's passage three times the length of an English reader's and made
   "quoted briefly" true in only one language. Same cut, same rule, every
   language. Anyone who wants the paragraph entire follows the citation
   to the Holy See, which is the point of the citation. */
var EXCERPT_MAX = 360;
var ELLIPSIS = "\u2026";

function excerpt(t) {
  t = String(t || "").trim();
  if (t.length <= EXCERPT_MAX) return t;
  var cut = t.slice(0, EXCERPT_MAX - 1);
  var sp = cut.lastIndexOf(" ");
  if (sp > EXCERPT_MAX * 0.85) cut = cut.slice(0, sp);
  return cut.replace(/[\s.,;:!?\u2013\u2014-]+$/, "") + ELLIPSIS;
}

/* Swaps passage text for the target language wherever a published text
   exists. Each passage says which it is, so the page can be honest
   about the one or two that stayed in English. */
async function localize(passages, lang) {
  if (!lang || lang === "en") {
    return passages.map(function (p) {
      var c = Object.assign({}, p);
      c.textLang = "en";
      c.native = true;
      return c;
    });
  }
  var needed = {};
  passages.forEach(function (p) { needed[p.docIdx] = 1; });
  var docIdxs = Object.keys(needed).map(Number);
  var maps = {};
  await Promise.all(docIdxs.map(async function (d) {
    maps[d] = await load(d, lang);
  }));

  return passages.map(function (p) {
    var c = Object.assign({}, p);
    var m = maps[p.docIdx];
    var t = m && m[p.para];
    if (t) {
      c.text = excerpt(t);
      c.full = t.length > c.text.length;
      c.textLang = lang;
      c.native = true;
      var spec = SOURCES[p.docIdx];
      if (spec) c.url = spec.url(lang);
    } else {
      c.textLang = "en";
      c.native = false;
    }
    return c;
  });
}

function available(lang) {
  if (!lang || lang === "en") return [0, 1, 2, 3];
  return Object.keys(SOURCES).filter(function (d) {
    return SOURCES[d].langs[lang];
  }).map(Number);
}

module.exports = {
  localize: localize,
  excerpt: excerpt,
  load: load,
  available: available,
  decode: decode,
  strip: strip,
  byParagraph: byParagraph,
  byBoldMarker: byBoldMarker,
  SOURCES: SOURCES
};
