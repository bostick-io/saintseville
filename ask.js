/* Saint Seville — Ask box.
   Retrieval-only search over the full approved corpus, running entirely
   in the browser. index.json is exported from the RAG database and holds
   a term-frequency index over all 958 numbered passages of the four
   approved documents, plus a short attributed excerpt of each passage
   for display. Full texts are never served here; every citation links
   to the official text at vatican.va (or romecall.org).

   Nothing is generated. Every result is a real excerpt with its official
   paragraph citation. If nothing in the corpus scores above the relevance
   floor, Saint Seville says so instead of stretching.

   The curated FALLBACK set below is kept only for the case where
   index.json itself fails to load. */
(function () {
  "use strict";

  var INDEX_URL = "index.json";
  var TOP_N = 6;
  var SCORE_FLOOR = 3.0; /* below this bm25 score, refuse */

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

  /* ---- prebuilt index, fetched lazily ---- */
  var idx = null;         /* {docs, meta, excerpts, lengths, avgLen, terms} */
  var loadPromise = null;

  function loadIndex() {
    if (loadPromise) return loadPromise;
    loadPromise = fetch(INDEX_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) { idx = data; return true; });
    return loadPromise;
  }

  /* BM25 scoring over the prebuilt term index. */
  function search(q) {
    var qts = tokens(q);
    if (!qts.length) return [];
    var seen = Object.create(null);
    qts = qts.filter(function (t) {
      if (seen[t]) return false; seen[t] = 1; return true;
    });
    var N = idx.meta.length;

    /* Refuse outright when the question is mostly about things the
       corpus has no words for at all — better silence than stretch. */
    var unknown = qts.filter(function (t) { return !idx.terms[t]; });
    if (unknown.length * 2 > qts.length) return [];

    /* Terms that appear in under a quarter of passages carry real
       signal here; ubiquitous words (church, human, ai, ...) score
       but do not count toward the coverage requirement. */
    var informative = qts.filter(function (t) {
      return idx.terms[t] && idx.terms[t].length / 2 < N * 0.25;
    });
    var isInformative = Object.create(null);
    informative.forEach(function (t) { isInformative[t] = 1; });

    var scores = Object.create(null);
    var covered = Object.create(null); /* distinct informative terms present */
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

    /* A passage must contain at least half the informative terms
       (capped at 3) as well as clear the score floor. */
    var need = Math.min(3, Math.ceil(informative.length / 2));
    var hits = Object.keys(scores).filter(function (i) {
      return (covered[i] || 0) >= need;
    }).map(function (i) {
      return { i: +i, score: scores[i] };
    });
    hits.sort(function (a, b2) { return b2.score - a.score; });
    return hits.slice(0, TOP_N).filter(function (h) { return h.score >= SCORE_FLOOR; });
  }

  /* ---- rendering ---- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function highlight(text, q) {
    var qts = tokens(q);
    var out = esc(text);
    qts.forEach(function (t) {
      if (t.length < 3) return;
      out = out.replace(new RegExp("(^|[^A-Za-z])(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "$1<mark>$2</mark>");
    });
    return out;
  }

  function renderHits(box, q, hits) {
    var items = hits.map(function (h) {
      var m = idx.meta[h.i];
      var d = idx.docs[m[0]];
      var cite = d.cite + " §" + m[1];
      return (
        '<blockquote class="ask-passage">' +
        "<p>" + highlight(idx.excerpts[h.i], q) + "</p>" +
        '<footer><a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(cite) + " — read the full text</a></footer>" +
        "</blockquote>"
      );
    }).join("");
    box.innerHTML =
      '<div class="ask-answer"><p>Passages from the approved sources that speak to <strong>' + esc(q) + "</strong>:</p></div>" +
      items +
      '<p class="ask-note">Each excerpt is quoted verbatim with its official paragraph number. Follow any citation to read the complete passage at the source.</p>';
  }

  function renderMiss(box) {
    box.innerHTML =
      '<div class="ask-answer"><p>The approved sources do not appear to address that question.</p></div>' +
      '<p class="ask-note">Saint Seville answers only from the approved corpus: Antiqua et Nova, Magnifica Humanitas, the Compendium of the Social Doctrine, and the Rome Call for AI Ethics. Try asking about AI and human dignity, work, education, warfare, truth, or the common good — or browse the <a href="sources/index.html">approved sources</a> directly.</p>';
  }

  /* Curated last-resort fallback if index.json cannot load. */
  var FALLBACK = [
    {
      topic: "what is ai, ai vs human intelligence, definition, difference, intelligence",
      q: "What is AI, and how does it differ from human intelligence?",
      cites: [
        {
          cite: "Magnifica Humanitas §99",
          url: "https://www.vatican.va/content/leo-xiv/en/encyclicals/documents/20260515-magnifica-humanitas.html",
          text: "It is not possible to provide a single, comprehensive definition of AI. What can be stated, however, is that we must avoid the misconception of equating this type of “intelligence” with that of human beings. These systems merely imitate certain functions of human intelligence."
        },
        {
          cite: "Antiqua et Nova §34",
          url: "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20250128_antiqua-et-nova_en.html",
          text: "Drawing an overly close equivalence between human intelligence and AI risks succumbing to a functionalist perspective, where people are valued based on the work they can perform."
        }
      ]
    },
    {
      topic: "work, jobs, workers, labor, employment, replace",
      q: "What does the Church say about AI and work?",
      cites: [
        {
          cite: "Antiqua et Nova §70",
          url: "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20250128_antiqua-et-nova_en.html",
          text: "Since work is a “part of the meaning of life on this earth, a path to growth, human development and personal fulfillment,” “the goal should not be that technological progress increasingly replaces human work.”"
        }
      ]
    },
    {
      topic: "war, warfare, weapons, autonomous weapons, military, peace",
      q: "What does the Church teach about AI and warfare?",
      cites: [
        {
          cite: "Antiqua et Nova §100",
          url: "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20250128_antiqua-et-nova_en.html",
          text: "Lethal Autonomous Weapon Systems, which are capable of identifying and striking targets without direct human intervention, are a “cause for grave ethical concern” because they lack the uniquely human capacity for moral judgment and ethical decision-making."
        }
      ]
    },
    {
      topic: "education, students, school, learning, teaching, children",
      q: "How should AI be used in education?",
      cites: [
        {
          cite: "Antiqua et Nova §82",
          url: "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20250128_antiqua-et-nova_en.html",
          text: "While some AI systems are designed to help people develop their critical thinking abilities and problem-solving skills, many others merely provide answers instead of prompting students to arrive at answers themselves. Education should encourage “the responsible use of freedom.”"
        }
      ]
    },
    {
      topic: "common good, society, social conditions, community",
      q: "What is the common good?",
      cites: [
        {
          cite: "Compendium §164",
          url: "https://www.vatican.va/roman_curia/pontifical_councils/justpeace/documents/rc_pc_justpeace_doc_20060526_compendio-dott-soc_en.html",
          text: "The principle of the common good, to which every aspect of social life must be related if it is to attain its fullest meaning, stems from the dignity, unity and equality of all people."
        }
      ]
    }
  ];

  function renderCites(cites) {
    return cites.map(function (c) {
      return (
        '<blockquote class="ask-passage">' +
        "<p>" + esc(c.text) + "</p>" +
        '<footer><a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.cite) + "</a></footer>" +
        "</blockquote>"
      );
    }).join("");
  }

  function renderFallback(box, q) {
    var words = q.toLowerCase().split(/[^a-z]+/).filter(function (w) { return w.length > 2; });
    var best = null, bestScore = 0;
    FALLBACK.forEach(function (item) {
      var hay = (item.topic + " " + item.q).toLowerCase();
      var score = 0;
      words.forEach(function (w) { if (hay.indexOf(w) !== -1) score += 1; });
      if (score > bestScore) { bestScore = score; best = item; }
    });
    var note = '<p class="ask-note">The full search index could not be loaded, so this is drawn from a small built-in set of cited passages.</p>';
    if (best) {
      box.innerHTML = note +
        '<div class="ask-answer"><p><strong>' + esc(best.q) + "</strong></p></div>" +
        renderCites(best.cites);
    } else {
      box.innerHTML = note +
        "<p>No built-in passage matches that question. Browse the " +
        '<a href="sources/index.html">approved sources</a> directly.</p>';
    }
  }

  /* ---- wiring ---- */
  var box, input, button;

  function setBusy(b) {
    button.disabled = b;
    button.textContent = b ? "Searching…" : "Ask";
  }

  function ask(q) {
    q = (q || "").trim();
    if (q.length < 3) return;
    box.hidden = false;
    box.innerHTML = '<p class="ask-note">Searching the approved sources…</p>';
    setBusy(true);
    loadIndex()
      .then(function () {
        var hits = search(q);
        if (hits.length) renderHits(box, q, hits);
        else renderMiss(box);
      })
      .catch(function () { renderFallback(box, q); })
      .finally(function () { setBusy(false); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    input = document.getElementById("seville-search");
    button = document.querySelector(".search-button");
    box = document.getElementById("ask-results");
    if (!input || !button || !box) return;
    button.addEventListener("click", function () { ask(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") ask(input.value);
    });
    /* Warm the index in the background so the first search is instant. */
    if (window.requestIdleCallback) {
      requestIdleCallback(function () { loadIndex().catch(function () {}); });
    } else {
      setTimeout(function () { loadIndex().catch(function () {}); }, 1500);
    }
  });
})();
