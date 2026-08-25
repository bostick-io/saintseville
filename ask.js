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

  var STOP = {};
  ("a an and are as at be but by for from has have how i in is it its of on or " +
   "so that the their there these this to was we what when where which who why " +
   "will with about does do did can could should would may might must not no if")
    .split(" ").forEach(function (w) { STOP[w] = 1; });

  /* Only used to decide what to highlight in a passage. Scoring lives
     on the server now. */
  function tokens(s) {
    return String(s).toLowerCase().replace(/[’']/g, "")
      .split(/[^a-z0-9]+/)
      .filter(function (w) { return w.length > 1 && !STOP[w]; });
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
      return (
        '<blockquote class="ask-passage">' +
        "<p>" + highlight(p.text, q) + "</p>" +
        '<footer><a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.cite) + " &middot; read the full text</a></footer>" +
        "</blockquote>"
      );
    }).join("");
    box.innerHTML =
      '<div class="ask-answer" id="ask-passages-heading"><p>Passages from the approved sources that speak to <strong>' + esc(q) + "</strong>:</p></div>" +
      items +
      '<p class="ask-note">Each excerpt is quoted verbatim with its official paragraph number. Follow any citation to read the complete passage at the source.</p>';
  }

  function renderMiss(box) {
    box.innerHTML =
      '<div class="ask-answer"><p>The approved sources do not appear to address that question.</p></div>' +
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
    d.innerHTML = '<p class="ask-note">Working out a fuller answer from these sources…</p>';
    /* The answer belongs at the top. The passages underneath are the
       evidence for it, which is a different job from being the result. */
    box.insertBefore(d, box.firstChild);
    return d;
  }

  function renderSynthesis(node, data) {
    if (!data || data.refused || !data.answer) { node.remove(); return; }
    var html = '<p class="ask-cites-heading">What the sources say</p><div class="ask-answer"><p>' + esc(data.answer) + "</p></div>";
    /* Always render this block. When the retrieved sources genuinely
       disagree it carries the disagreement; when they do not it explains
       what the section is for, so the capability is visible either way. */
    html += '<div class="ask-differ' + (data.differ ? "" : " ask-differ-none") + '">' +
      "<h4>Where serious minds differ</h4><p>" +
      (data.differ
        ? esc(data.differ)
        : "The sources retrieved for this question line up with one another. When they pull in different directions, this is where the disagreement gets named, with each position attributed to whoever holds it. Seven live ones are set out in the <a href=\"thinkers/index.html#differ\">register of who is arguing about this</a>.") +
      "</p></div>";
    if (data.articles && data.articles.length) {
      html += '<div class="ask-articles"><h4>Commentary drawn on</h4>' + data.articles.map(function (a) {
        return '<p><a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title) + "</a>, " + esc(a.author) + ", " + esc(a.publisher) + "</p>";
      }).join("") + "</div>";
    }
    if (data.next && data.next.length) {
      html += '<div class="ask-next"><h4>Where to go from here</h4><p>' + data.next.map(esc).join(" &middot; ") + "</p></div>";
    }
    node.className = "ask-synthesis";
    node.innerHTML = html;
    /* Once an answer is on the page the passages are supporting evidence,
       so they stop announcing themselves as the result. */
    var ph = document.getElementById("ask-passages-heading");
    if (ph) ph.innerHTML = "<p>The passages this rests on, quoted in full:</p>";
  }

  function askLive(q, box) {
    var node = renderSynthesisLoading(box);
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
    fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: q }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        clearTimeout(timer);
        if (!data || !data.ok) { node.remove(); return; }
        renderSynthesis(node, data);
      })
      .catch(function () { clearTimeout(timer); node.remove(); });
  }

  /* ---- wiring ---- */
  var box, input, button;

  function setBusy(b) {
    button.disabled = b;
    button.textContent = b ? "Searching…" : "Ask";
  }

  /* Retrieval now happens on the server. The browser used to download
     the whole index before it could answer anything, which was 932KB at
     four documents and does not survive a corpus in the thirties. Two
     calls: passages first because they are fast and cost nothing, then
     the grounded answer, which lands above them. */
  function ask(q) {
    q = (q || "").trim();
    if (q.length < 3) return;
    box.hidden = false;
    box.innerHTML = '<p class="ask-note">Searching the approved sources…</p>';
    setBusy(true);

    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 12000) : null;

    fetch("/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: q }),
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
  });
})();
