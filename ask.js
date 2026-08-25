/* Saint Seville, Ask box.

   Retrieval runs on the server now, in /api/_engine, shared with the
   advanced search page so the two can never disagree about what the
   corpus says. The browser used to download the whole term index before
   it could answer anything, which was 932KB at four documents and does
   not survive a corpus meant to grow into the thirties.

   Two calls. /api/search returns cited passages and is fast and free.
   /api/ask returns a grounded answer built only from those same
   passages, and lands above them once it arrives.

   Nothing is generated without a source. Every citation links to the
   official text at vatican.va or romecall.org. If nothing in the corpus
   clears the relevance floor, Saint Seville says so instead of
   stretching.

   The curated FALLBACK set below is kept only for the case where the
   API itself is unreachable. */
(function () {
  "use strict";

  /* Used only to decide what to highlight inside a passage. It covers
     five languages now, because highlighting every "che" and "die" in a
     quoted Vatican paragraph turns the passage into a smear of yellow
     and hides the words the reader actually asked about. */
  var STOP = {};
  ("a an and are as at be but by for from has have how i in is it its of on or " +
   "so that the their there these this to was we what when where which who why " +
   "will with about does do did can could should would may might must not no if " +
   "che chi cosa come dice dice dei del della delle dello degli con per non " +
   "una uno gli lei loro nel nella sono essere piu quando dove perche " +
   "sul sulla sulle sui dal dalla dalle dai alla alle agli nei negli nelle " +
   "que quien como dice los las del las una uno por para con sus sea ser mas " +
   "cuando donde porque sobre este esta estos entre " +
   "qui quoi comme dit les des dans une pour avec sont etre plus quand " +
   "ou pourquoi sur cette ces leur leurs aux sobre " +
   "was wie sagt der die das den dem des ein eine einen fur mit sind sein mehr " +
   "wenn wo warum uber diese dieser ihre ihren nicht auch noch " +
   "aus vom zum zur beim vor nach bei auf")
    .split(" ").forEach(function (w) { STOP[w] = 1; });

  /* Only used to decide what to highlight in a passage. Scoring lives
     on the server now. */
  function tokens(s) {
    return String(s).toLowerCase().replace(/[’']/g, "")
      .split(/[^a-z0-9]+/)
      .filter(function (w) { return w.length > 1 && !STOP[w]; });
  }

  /* Strings come from i18n.js. If it has not booted yet, English is the
     honest default rather than a blank label. */
  function L(key, fallback) {
    if (window.SSLang && typeof window.SSLang.t === "function") {
      var v = window.SSLang.t(key);
      if (v) return v;
    }
    return fallback || "";
  }
  function lang() {
    return (window.SSLang && window.SSLang.get()) || "en";
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

  /* The server hands back {cite, url, text} directly, so nothing here
     needs to know how the index is laid out. */
  function renderPassages(box, q, passages) {
    var items = passages.map(function (p) {
      /* A passage the Holy See never published in this language is
         labelled as such rather than quietly served in English. The
         reader can then judge the quote for what it is. */
      var note = (p.native === false)
        ? '<p class="ask-passage-note">' + esc(L("lang.fallback")) + "</p>"
        : "";
      return (
        '<blockquote class="ask-passage" lang="' + esc(p.textLang || "en") + '">' +
        note +
        "<p>" + highlight(p.text, q) + "</p>" +
        '<footer><a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.cite) + "</a></footer>" +
        "</blockquote>"
      );
    }).join("");
    box.innerHTML =
      '<div class="ask-answer" id="ask-passages-heading"><p>' + esc(L("ask.passages")) + "</p></div>" +
      items;
  }

  function renderMiss(box) {
    box.innerHTML =
      '<div class="ask-answer"><p>' + esc(L("ask.none")) + "</p></div>" +
      '<p class="ask-note">Saint Seville answers only from the approved corpus: Antiqua et Nova, Magnifica Humanitas, the Compendium of the Social Doctrine, and the Rome Call for AI Ethics. Try asking about AI and human dignity, work, education, warfare, truth, or the common good. Or browse the <a href="sources/index.html">approved sources</a> directly.</p>';
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

  /* ---- live synthesis: same retrieved material, read by a model that
     writes a short grounded answer, notes real disagreement, and
     suggests what to read next. Purely additive — if it fails or is
     slow, the instant passages above already stand on their own. ---- */
  function renderSynthesisLoading(box) {
    var d = document.createElement("div");
    d.className = "ask-synthesis ask-synthesis-loading";
    d.innerHTML = '<p class="ask-note">' + esc(L("ask.thinking")) + "</p>";
    /* The answer belongs at the top. The passages underneath are the
       evidence for it, which is a different job from being the result. */
    box.insertBefore(d, box.firstChild);
    return d;
  }

  function renderSynthesis(node, data) {
    if (!data || data.refused || !data.answer) { node.remove(); return; }
    var html = '<p class="ask-cites-heading">' + esc(L("ask.cites")) + '</p><div class="ask-answer" lang="' +
      esc(data.lang || "en") + '"><p>' + esc(data.answer) + "</p></div>";
    /* Always render this block. When the retrieved sources genuinely
       disagree it carries the disagreement; when they do not it explains
       what the section is for, so the capability is visible either way. */
    html += '<div class="ask-differ' + (data.differ ? "" : " ask-differ-none") + '">' +
      "<h4>" + esc(L("ask.differ")) + "</h4><p>" +
      (data.differ
        ? esc(data.differ)
        : esc(L("ask.differNone")) + ' <a href="thinkers/index.html#differ">' +
          esc(L("ask.differRegister")) + "</a>") +
      "</p></div>";
    if (data.articles && data.articles.length) {
      html += '<div class="ask-articles"><h4>' + esc(L("ask.commentary")) + "</h4>" + data.articles.map(function (a) {
        return '<p><a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title) + "</a>, " + esc(a.author) + ", " + esc(a.publisher) + "</p>";
      }).join("") + "</div>";
    }
    if (data.next && data.next.length) {
      html += '<div class="ask-next"><h4>' + esc(L("ask.next")) + "</h4><p>" + data.next.map(esc).join(" &middot; ") + "</p></div>";
    }
    node.className = "ask-synthesis";
    node.innerHTML = html;
    /* Once an answer is on the page the passages are supporting evidence,
       so they stop announcing themselves as the result. */
    var ph = document.getElementById("ask-passages-heading");
    if (ph) ph.innerHTML = "<p>" + esc(L("ask.passages")) + "</p>";
  }

  function callAsk(q) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;
    return fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: q, lang: lang() }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { clearTimeout(timer); return r.json(); })
      .catch(function (e) { clearTimeout(timer); throw e; });
  }

  function askLive(q, box) {
    var node = renderSynthesisLoading(box);
    callAsk(q).then(function (data) {
      if (!data || !data.ok) { node.remove(); return; }
      renderSynthesis(node, data);
    }).catch(function () { node.remove(); });
  }

  /* ---- wiring ---- */
  var box, input, button;
  var lastQ = "";

  function setBusy(b) {
    button.disabled = b;
    button.textContent = b ? L("ask.thinking") : L("ask.button", "Ask");
  }

  /* Retrieval now happens on the server. The browser used to download
     the whole index before it could answer anything, which was 932KB at
     four documents and does not survive a corpus in the thirties. Two
     calls: passages first because they are fast and cost nothing, then
     the grounded answer, which lands above them. */
  function ask(q) {
    q = (q || "").trim();
    if (q.length < 3) return;
    lastQ = q;
    box.hidden = false;
    box.innerHTML = '<p class="ask-note">' + esc(L("ask.thinking")) + "</p>";
    setBusy(true);

    /* English takes the two call path: passages land immediately from
       /api/search, which costs nothing, and the grounded answer arrives
       above them a moment later.

       Every other language takes one call. Retrieval scores against the
       English index, so a question in Italian has to be carried into
       English before it touches the index, and only /api/ask can do that
       because only /api/ask has a model. Splitting it would mean showing
       a reader an empty result for a question that was going to be
       answered perfectly well one second later. */
    if (lang() !== "en") {
      callAsk(q).then(function (data) {
        if (!data || !data.ok) throw new Error("ask failed");
        if (data.refused || !data.passages || !data.passages.length) {
          renderMiss(box);
          return;
        }
        renderPassages(box, q, data.passages);
        var node = renderSynthesisLoading(box);
        renderSynthesis(node, data);
      }).catch(function () {
        renderFallback(box, q);
      }).finally(function () { setBusy(false); });
      return;
    }

    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 12000) : null;

    fetch("/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: q, lang: "en" }),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        clearTimeout(timer);
        if (!data || !data.ok) throw new Error("search failed");
        if (data.passages && data.passages.length) renderPassages(box, q, data.passages);
        else { renderMiss(box); setBusy(false); return; }
        askLive(q, box);
      })
      .catch(function () {
        clearTimeout(timer);
        renderFallback(box, q);
      })
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

    /* Switching language with an answer on screen re-asks the same
       question in the new one. Leaving a stale English answer under an
       Italian interface would be the worst of both. */
    document.addEventListener("ss-lang", function () {
      if (!button.disabled) setBusy(false);
      if (lastQ) ask(lastQ);
    });
  });
})();
