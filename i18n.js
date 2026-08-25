/* Saint Seville — language layer.

   Five languages, chosen because the Holy See publishes its own texts in
   them. That is the whole reason this is worth doing: an Italian reader
   does not get a machine translation of an English translation, they get
   the Italian the Vatican itself published, quoted verbatim with the same
   paragraph number.

   No IP geolocation. A site that speaks for a tradition should not guess
   at someone's nationality from a network hop. The browser already states
   a language preference, so we read that once, show a visible switcher,
   and remember whatever the reader chooses. */

(function (w, d) {
  "use strict";

  var KEY = "ss-lang";
  var DEFAULT = "en";

  var LANGS = ["en", "it", "es", "fr", "de"];

  var NAMES = {
    en: "English",
    it: "Italiano",
    es: "Espanol",
    fr: "Francais",
    de: "Deutsch"
  };

  /* Flags as inline SVG, not emoji. Windows renders regional indicator
     pairs as letters rather than flags, and Paul's readers are not going
     to squint at "IT" in a box and call it a flag. */
  var FLAGS = {
    en: '<svg viewBox="0 0 60 30" aria-hidden="true"><clipPath id="ssuk"><path d="M0 0v30h60V0z"/></clipPath><g clip-path="url(#ssuk)"><path d="M0 0v30h60V0z" fill="#012169"/><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30m0-30L0 30" stroke="#C8102E" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/></g></svg>',
    it: '<svg viewBox="0 0 3 2" aria-hidden="true"><path fill="#008C45" d="M0 0h1v2H0z"/><path fill="#F4F5F0" d="M1 0h1v2H1z"/><path fill="#CD212A" d="M2 0h1v2H2z"/></svg>',
    es: '<svg viewBox="0 0 3 2" aria-hidden="true"><path fill="#AA151B" d="M0 0h3v2H0z"/><path fill="#F1BF00" d="M0 .5h3v1H0z"/></svg>',
    fr: '<svg viewBox="0 0 3 2" aria-hidden="true"><path fill="#002395" d="M0 0h1v2H0z"/><path fill="#fff" d="M1 0h1v2H1z"/><path fill="#ED2939" d="M2 0h1v2H2z"/></svg>',
    de: '<svg viewBox="0 0 3 2" aria-hidden="true"><path fill="#000" d="M0 0h3v.667H0z"/><path fill="#DD0000" d="M0 .667h3v.666H0z"/><path fill="#FFCE00" d="M0 1.333h3v.667H0z"/></svg>'
  };

  var S = {
    en: {
      "nav.home": "Home",
      "nav.briefings": "Briefings",
      "nav.thinkers": "Thinkers",
      "nav.notes": "Notes",
      "nav.saint": "The Saint",
      "nav.sources": "Sources",
      "nav.about": "About",
      "hero.eyebrow": "Ethics and Thought for the AI Age",
      "hero.mission": "Engineering can tell us what AI does. What it means for human beings is a different kind of question. Saint Seville catalogues the serious thinking in the space where engineering ends and ethics takes over.",
      "hero.promise": "Rooted in the Catholic intellectual tradition and its two thousand years of reflection on what a human being is. Every answer cites the approved source it came from. No open web, only the sources on our list.",
      "ask.label": "Ask Saint Seville",
      "ask.placeholder": "Ask about AI, work, dignity, education…",
      "ask.button": "Ask",
      "ask.note": "Every answer names and links the approved source behind it. If a claim is not in an approved source, Saint Seville does not make it.",
      "ask.adv": "Advanced search: choose exactly which sources are in scope",
      "ask.thinking": "Reading the sources…",
      "ask.cites": "What the sources say",
      "ask.passages": "The passages this rests on, quoted in full:",
      "ask.differ": "Where the sources differ",
      "ask.next": "Read next",
      "ask.commentary": "Indexed commentary",
      "ask.none": "The approved sources do not appear to address that question.",
      "ask.error": "Something went wrong reaching the sources. Try again in a moment.",
      "ask.short": "Ask a fuller question and Saint Seville will look it up.",
      "page.untranslated": "This page is written in English. The Ask box and its cited passages are available in every language listed above.",
      "ask.differNone": "The sources retrieved for this question line up with one another. When they pull in different directions, this is where the disagreement gets named, with each position attributed to whoever holds it.",
      "ask.differRegister": "Seven live ones are set out in the register of who is arguing about this.",
      "lang.label": "Language",
      "lang.native": "Quoted from the official text in this language.",
      "lang.fallback": "This document has no published text in this language, so the passage below is quoted in English.",
      "pillar1.h": "Cite the source",
      "pillar1.p": "Nothing is offered without attribution. Each answer carries the document and link it rests on, so anyone can read the original for themselves.",
      "pillar2.h": "Approved sources only",
      "pillar2.p": "The corpus is a reviewed set of Vatican primary texts and official Church documents on artificial intelligence, alongside clearly labeled commentary we index and link.",
      "pillar3.h": "Ordered for clarity",
      "pillar3.p": "Named for Isidore of Seville, the great encyclopedist venerated as patron of the internet. In his spirit, the aim is a calm, well arranged path from your question to the tradition's own words.",
      "foot.note": "An approved sources only project. Answers cite their source.",
      "foot.rights": "Excerpts from Vatican documents © Libreria Editrice Vaticana, quoted briefly with attribution. Full texts at"
    },
    it: {
      "nav.home": "Home",
      "nav.briefings": "Dossier",
      "nav.thinkers": "Pensatori",
      "nav.notes": "Note",
      "nav.saint": "Il Santo",
      "nav.sources": "Fonti",
      "nav.about": "Chi siamo",
      "hero.eyebrow": "Etica e pensiero per l'età dell'intelligenza artificiale",
      "hero.mission": "L'ingegneria può dirci che cosa fa l'intelligenza artificiale. Che cosa significhi per l'essere umano è una domanda di altra natura. Saint Seville raccoglie il pensiero serio nello spazio in cui l'ingegneria finisce e comincia l'etica.",
      "hero.promise": "Radicato nella tradizione intellettuale cattolica e nei suoi duemila anni di riflessione su che cosa sia l'essere umano. Ogni risposta cita la fonte approvata da cui proviene. Nessun web aperto, solo le fonti del nostro elenco.",
      "ask.label": "Chiedi a Saint Seville",
      "ask.placeholder": "Chiedi di intelligenza artificiale, lavoro, dignità, educazione…",
      "ask.button": "Chiedi",
      "ask.note": "Ogni risposta indica e collega la fonte approvata da cui proviene. Se un'affermazione non si trova in una fonte approvata, Saint Seville non la fa.",
      "ask.adv": "Ricerca avanzata: scegli esattamente quali fonti includere",
      "ask.thinking": "Lettura delle fonti in corso…",
      "ask.cites": "Che cosa dicono le fonti",
      "ask.passages": "I passi su cui questa risposta si fonda, citati per intero:",
      "ask.differ": "Dove le fonti divergono",
      "ask.next": "Da leggere",
      "ask.commentary": "Commento indicizzato",
      "ask.none": "Le fonti approvate non sembrano trattare questa domanda.",
      "ask.error": "Si è verificato un problema nel raggiungere le fonti. Riprova tra poco.",
      "ask.short": "Formula una domanda più completa e Saint Seville la cercherà.",
      "page.untranslated": "Questa pagina è in inglese. Il riquadro delle domande e i passi citati sono disponibili in tutte le lingue elencate qui sopra.",
      "ask.differNone": "Le fonti trovate per questa domanda concordano tra loro. Quando invece tirano in direzioni diverse, è qui che il disaccordo viene nominato, con ogni posizione attribuita a chi la sostiene.",
      "ask.differRegister": "Sette casi vivi sono elencati nel registro di chi sta discutendo di questo.",
      "lang.label": "Lingua",
      "lang.native": "Citato dal testo ufficiale in questa lingua.",
      "lang.fallback": "Di questo documento non esiste un testo pubblicato in questa lingua, perciò il passo qui sotto è citato in inglese.",
      "pillar1.h": "Citare la fonte",
      "pillar1.p": "Nulla viene offerto senza attribuzione. Ogni risposta porta con sé il documento e il collegamento su cui si fonda, così chiunque può leggere l'originale.",
      "pillar2.h": "Solo fonti approvate",
      "pillar2.p": "Il corpus è un insieme verificato di testi primari vaticani e documenti ufficiali della Chiesa sull'intelligenza artificiale, accanto a commenti chiaramente etichettati che indicizziamo e colleghiamo.",
      "pillar3.h": "Ordinato per chiarezza",
      "pillar3.p": "Intitolato a Isidoro di Siviglia, il grande enciclopedista venerato come patrono di internet. Nel suo spirito, l'obiettivo è un percorso sereno e ben ordinato dalla tua domanda alle parole stesse della tradizione.",
      "foot.note": "Un progetto di sole fonti approvate. Le risposte citano la loro fonte.",
      "foot.rights": "Gli estratti dai documenti vaticani sono © Libreria Editrice Vaticana, citati brevemente con attribuzione. Testi integrali su"
    },
    es: {
      "nav.home": "Inicio",
      "nav.briefings": "Informes",
      "nav.thinkers": "Pensadores",
      "nav.notes": "Notas",
      "nav.saint": "El Santo",
      "nav.sources": "Fuentes",
      "nav.about": "Acerca de",
      "hero.eyebrow": "Ética y pensamiento para la era de la inteligencia artificial",
      "hero.mission": "La ingeniería puede decirnos qué hace la inteligencia artificial. Qué significa para el ser humano es una pregunta de otro orden. Saint Seville reúne el pensamiento serio en el espacio donde termina la ingeniería y empieza la ética.",
      "hero.promise": "Arraigado en la tradición intelectual católica y en sus dos mil años de reflexión sobre qué es el ser humano. Cada respuesta cita la fuente aprobada de la que procede. Nada de web abierta, solo las fuentes de nuestra lista.",
      "ask.label": "Pregunta a Saint Seville",
      "ask.placeholder": "Pregunta sobre inteligencia artificial, trabajo, dignidad, educación…",
      "ask.button": "Preguntar",
      "ask.note": "Cada respuesta nombra y enlaza la fuente aprobada que la sostiene. Si una afirmación no está en una fuente aprobada, Saint Seville no la hace.",
      "ask.adv": "Búsqueda avanzada: elige exactamente qué fuentes entran",
      "ask.thinking": "Leyendo las fuentes…",
      "ask.cites": "Lo que dicen las fuentes",
      "ask.passages": "Los pasajes en que se apoya, citados íntegramente:",
      "ask.differ": "Dónde difieren las fuentes",
      "ask.next": "Leer después",
      "ask.commentary": "Comentario indexado",
      "ask.none": "Las fuentes aprobadas no parecen tratar esa pregunta.",
      "ask.error": "Hubo un problema al alcanzar las fuentes. Inténtalo de nuevo en un momento.",
      "ask.short": "Formula una pregunta más completa y Saint Seville la buscará.",
      "page.untranslated": "Esta página está en inglés. El cuadro de preguntas y los pasajes citados están disponibles en todos los idiomas de arriba.",
      "ask.differNone": "Las fuentes recuperadas para esta pregunta coinciden entre sí. Cuando tiran en direcciones distintas, aquí es donde se nombra el desacuerdo, con cada postura atribuida a quien la sostiene.",
      "ask.differRegister": "Siete casos vivos figuran en el registro de quién está discutiendo esto.",
      "lang.label": "Idioma",
      "lang.native": "Citado del texto oficial en este idioma.",
      "lang.fallback": "Este documento no tiene texto publicado en este idioma, por lo que el pasaje siguiente se cita en inglés.",
      "pillar1.h": "Citar la fuente",
      "pillar1.p": "Nada se ofrece sin atribución. Cada respuesta lleva el documento y el enlace en que se apoya, para que cualquiera pueda leer el original.",
      "pillar2.h": "Solo fuentes aprobadas",
      "pillar2.p": "El corpus es un conjunto revisado de textos primarios vaticanos y documentos oficiales de la Iglesia sobre inteligencia artificial, junto a comentarios claramente etiquetados que indexamos y enlazamos.",
      "pillar3.h": "Ordenado para la claridad",
      "pillar3.p": "Lleva el nombre de Isidoro de Sevilla, el gran enciclopedista venerado como patrono de internet. En su espíritu, el objetivo es un camino sereno y bien ordenado desde tu pregunta hasta las palabras mismas de la tradición.",
      "foot.note": "Un proyecto de solo fuentes aprobadas. Las respuestas citan su fuente.",
      "foot.rights": "Los extractos de documentos vaticanos son © Libreria Editrice Vaticana, citados brevemente con atribución. Textos completos en"
    },
    fr: {
      "nav.home": "Accueil",
      "nav.briefings": "Dossiers",
      "nav.thinkers": "Penseurs",
      "nav.notes": "Notes",
      "nav.saint": "Le Saint",
      "nav.sources": "Sources",
      "nav.about": "À propos",
      "hero.eyebrow": "Éthique et pensée pour l'âge de l'intelligence artificielle",
      "hero.mission": "L'ingénierie peut nous dire ce que fait l'intelligence artificielle. Ce qu'elle signifie pour l'être humain est une question d'un autre ordre. Saint Seville rassemble la pensée sérieuse là où l'ingénierie s'arrête et où l'éthique commence.",
      "hero.promise": "Enraciné dans la tradition intellectuelle catholique et ses deux mille ans de réflexion sur ce qu'est un être humain. Chaque réponse cite la source approuvée dont elle provient. Pas de web ouvert, seulement les sources de notre liste.",
      "ask.label": "Demandez à Saint Seville",
      "ask.placeholder": "Posez une question sur l'IA, le travail, la dignité, l'éducation…",
      "ask.button": "Demander",
      "ask.note": "Chaque réponse nomme et relie la source approuvée qui la fonde. Si une affirmation ne figure pas dans une source approuvée, Saint Seville ne la fait pas.",
      "ask.adv": "Recherche avancée: choisissez exactement quelles sources sont retenues",
      "ask.thinking": "Lecture des sources…",
      "ask.cites": "Ce que disent les sources",
      "ask.passages": "Les passages sur lesquels cela repose, cités en entier:",
      "ask.differ": "Là où les sources divergent",
      "ask.next": "À lire ensuite",
      "ask.commentary": "Commentaire indexé",
      "ask.none": "Les sources approuvées ne semblent pas traiter cette question.",
      "ask.error": "Un problème est survenu pour atteindre les sources. Réessayez dans un instant.",
      "ask.short": "Posez une question plus complète et Saint Seville la cherchera.",
      "page.untranslated": "Cette page est en anglais. Le champ de question et les passages cités sont disponibles dans toutes les langues ci-dessus.",
      "ask.differNone": "Les sources trouvées pour cette question vont dans le même sens. Lorsqu'elles divergent, c'est ici que le désaccord est nommé, chaque position étant attribuée à celui qui la défend.",
      "ask.differRegister": "Sept cas actifs figurent dans le registre de qui en débat.",
      "lang.label": "Langue",
      "lang.native": "Cité du texte officiel dans cette langue.",
      "lang.fallback": "Ce document n'a pas de texte publié dans cette langue, le passage ci-dessous est donc cité en anglais.",
      "pillar1.h": "Citer la source",
      "pillar1.p": "Rien n'est proposé sans attribution. Chaque réponse porte le document et le lien sur lesquels elle repose, afin que chacun puisse lire l'original.",
      "pillar2.h": "Sources approuvées uniquement",
      "pillar2.p": "Le corpus est un ensemble vérifié de textes primaires du Vatican et de documents officiels de l'Église sur l'intelligence artificielle, aux côtés de commentaires clairement identifiés que nous indexons et relions.",
      "pillar3.h": "Ordonné pour la clarté",
      "pillar3.p": "Nommé d'après Isidore de Séville, le grand encyclopédiste vénéré comme patron d'internet. Dans son esprit, le but est un chemin calme et bien ordonné de votre question jusqu'aux mots mêmes de la tradition.",
      "foot.note": "Un projet fondé sur les seules sources approuvées. Les réponses citent leur source.",
      "foot.rights": "Les extraits de documents du Vatican sont © Libreria Editrice Vaticana, cités brièvement avec attribution. Textes intégraux sur"
    },
    de: {
      "nav.home": "Start",
      "nav.briefings": "Dossiers",
      "nav.thinkers": "Denker",
      "nav.notes": "Notizen",
      "nav.saint": "Der Heilige",
      "nav.sources": "Quellen",
      "nav.about": "Über uns",
      "hero.eyebrow": "Ethik und Denken für das Zeitalter der künstlichen Intelligenz",
      "hero.mission": "Die Technik kann uns sagen, was künstliche Intelligenz tut. Was sie für den Menschen bedeutet, ist eine Frage anderer Art. Saint Seville sammelt das ernsthafte Denken dort, wo die Technik endet und die Ethik beginnt.",
      "hero.promise": "Verwurzelt in der katholischen Geistestradition und ihren zweitausend Jahren des Nachdenkens darüber, was ein Mensch ist. Jede Antwort nennt die zugelassene Quelle, aus der sie stammt. Kein offenes Web, nur die Quellen auf unserer Liste.",
      "ask.label": "Fragen Sie Saint Seville",
      "ask.placeholder": "Fragen Sie nach KI, Arbeit, Würde, Bildung…",
      "ask.button": "Fragen",
      "ask.note": "Jede Antwort nennt und verlinkt die zugelassene Quelle, auf der sie beruht. Steht eine Aussage in keiner zugelassenen Quelle, trifft Saint Seville sie nicht.",
      "ask.adv": "Erweiterte Suche: wählen Sie genau, welche Quellen gelten",
      "ask.thinking": "Die Quellen werden gelesen…",
      "ask.cites": "Was die Quellen sagen",
      "ask.passages": "Die Stellen, auf denen dies beruht, vollständig zitiert:",
      "ask.differ": "Wo die Quellen auseinandergehen",
      "ask.next": "Weiterlesen",
      "ask.commentary": "Indexierter Kommentar",
      "ask.none": "Die zugelassenen Quellen scheinen diese Frage nicht zu behandeln.",
      "ask.error": "Beim Zugriff auf die Quellen ist ein Fehler aufgetreten. Bitte gleich noch einmal versuchen.",
      "ask.short": "Stellen Sie eine ausführlichere Frage, dann schlägt Saint Seville sie nach.",
      "page.untranslated": "Diese Seite ist auf Englisch. Das Fragefeld und die zitierten Stellen gibt es in allen oben aufgeführten Sprachen.",
      "ask.differNone": "Die zu dieser Frage gefundenen Quellen stimmen überein. Wo sie auseinandergehen, wird der Widerspruch hier benannt, jede Position dem zugeschrieben, der sie vertritt.",
      "ask.differRegister": "Sieben laufende Fälle stehen im Verzeichnis derer, die darüber streiten.",
      "lang.label": "Sprache",
      "lang.native": "Zitiert aus dem amtlichen Text in dieser Sprache.",
      "lang.fallback": "Von diesem Dokument gibt es keinen veröffentlichten Text in dieser Sprache, daher wird die folgende Stelle auf Englisch zitiert.",
      "pillar1.h": "Die Quelle nennen",
      "pillar1.p": "Nichts wird ohne Nachweis angeboten. Jede Antwort trägt das Dokument und den Link, auf denen sie beruht, damit jeder das Original selbst lesen kann.",
      "pillar2.h": "Nur zugelassene Quellen",
      "pillar2.p": "Das Korpus ist eine geprüfte Sammlung vatikanischer Primärtexte und offizieller Kirchendokumente zur künstlichen Intelligenz, dazu klar gekennzeichnete Kommentare, die wir indexieren und verlinken.",
      "pillar3.h": "Geordnet für Klarheit",
      "pillar3.p": "Benannt nach Isidor von Sevilla, dem großen Enzyklopädisten, der als Schutzpatron des Internets verehrt wird. In seinem Sinn ist das Ziel ein ruhiger, wohlgeordneter Weg von Ihrer Frage zu den Worten der Tradition selbst.",
      "foot.note": "Ein Projekt allein aus zugelassenen Quellen. Antworten nennen ihre Quelle.",
      "foot.rights": "Auszüge aus vatikanischen Dokumenten sind © Libreria Editrice Vaticana, kurz und mit Nachweis zitiert. Volltexte auf"
    }
  };

  function normalize(tag) {
    if (!tag) return null;
    var base = String(tag).toLowerCase().split("-")[0];
    return LANGS.indexOf(base) >= 0 ? base : null;
  }

  function stored() {
    try { return normalize(w.localStorage.getItem(KEY)); } catch (e) { return null; }
  }

  function remember(lang) {
    try { w.localStorage.setItem(KEY, lang); } catch (e) {}
  }

  /* Order of authority: an explicit ?lang= in the address, then what the
     reader chose here before, then what the browser says it wants, then
     English. The browser is asked, never the network location. */
  function pick() {
    var q = null;
    try {
      q = normalize(new URLSearchParams(w.location.search).get("lang"));
    } catch (e) {}
    if (q) return q;
    var s = stored();
    if (s) return s;
    var list = w.navigator.languages || [w.navigator.language];
    for (var i = 0; i < list.length; i++) {
      var n = normalize(list[i]);
      if (n) return n;
    }
    return DEFAULT;
  }

  var current = DEFAULT;

  function t(key) {
    var pack = S[current] || S[DEFAULT];
    if (pack && pack[key] != null) return pack[key];
    return S[DEFAULT][key] != null ? S[DEFAULT][key] : "";
  }

  function apply(lang) {
    current = normalize(lang) || DEFAULT;
    d.documentElement.setAttribute("lang", current);

    var nodes = d.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var val = t(el.getAttribute("data-i18n"));
      if (val) el.textContent = val;
    }

    var ph = d.querySelectorAll("[data-i18n-placeholder]");
    for (var j = 0; j < ph.length; j++) {
      var v = t(ph[j].getAttribute("data-i18n-placeholder"));
      if (v) ph[j].setAttribute("placeholder", v);
    }

    var btns = d.querySelectorAll(".lang-switch button");
    for (var k = 0; k < btns.length; k++) {
      var on = btns[k].getAttribute("data-lang") === current;
      btns[k].setAttribute("aria-pressed", on ? "true" : "false");
      btns[k].className = on ? "on" : "";
    }

    banner();

    try {
      d.dispatchEvent(new CustomEvent("ss-lang", { detail: { lang: current } }));
    } catch (e) {}
  }

  /* Pages whose body copy is still English say so, in the reader's own
     language, instead of quietly serving English under Italian
     navigation. A page marks itself finished with data-i18n-full on the
     body, so the notice disappears on its own as pages get translated
     rather than needing to be hunted down and deleted. */
  function banner() {
    var host = d.querySelector("main") || d.body;
    var existing = d.getElementById("ss-untranslated");
    var full = d.body && d.body.hasAttribute("data-i18n-full");
    if (current === "en" || full) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      existing = d.createElement("p");
      existing.id = "ss-untranslated";
      existing.className = "untranslated-note";
      host.insertBefore(existing, host.firstChild);
    }
    existing.textContent = t("page.untranslated");
  }

  function set(lang) {
    var n = normalize(lang);
    if (!n || n === current) return;
    remember(n);
    apply(n);
  }

  function mount() {
    var host = d.querySelector(".lang-switch");
    if (!host) {
      host = d.createElement("div");
      host.className = "lang-switch";
      var header = d.querySelector(".site-header");
      if (!header) return;
      header.appendChild(host);
    }
    host.setAttribute("role", "group");
    host.setAttribute("aria-label", "Language");

    var html = "";
    for (var i = 0; i < LANGS.length; i++) {
      var L = LANGS[i];
      html += '<button type="button" data-lang="' + L + '" lang="' + L +
        '" title="' + NAMES[L] + '" aria-label="' + NAMES[L] + '">' +
        FLAGS[L] + '<span class="lang-code">' + L.toUpperCase() + '</span></button>';
    }
    host.innerHTML = html;

    host.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button[data-lang]") : null;
      if (!b) return;
      set(b.getAttribute("data-lang"));
    });
  }

  var api = {
    langs: LANGS,
    names: NAMES,
    get: function () { return current; },
    set: set,
    t: t
  };
  w.SSLang = api;

  function boot() {
    mount();
    apply(pick());
  }

  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window, document);
