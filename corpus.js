(function () {
  /* Complete corpus list, generated from the live search index. */
  var el = document.getElementById('corpus-list');
  if (el) {
    fetch('../index.json').then(function (r) { return r.json(); }).then(function (data) {
      var counts = {};
      (data.meta || []).forEach(function (m) { counts[m[0]] = (counts[m[0]] || 0) + 1; });
      var total = (data.meta || []).length;
      var html = '<ul>';
      (data.docs || []).forEach(function (d, i) {
        html += '<li><a href="' + d.url + '" target="_blank" rel="noopener">' + d.title + '</a> &middot; ' + (counts[i] || 0) + ' passages</li>';
      });
      html += '</ul><p>' + (data.docs || []).length + ' documents and ' + total + ' indexed passages in the current corpus. This list updates whenever the index does.</p>';
      el.innerHTML = html;
    }).catch(function () {
      el.innerHTML = '<p>The corpus list could not be loaded right now. The categories above describe the same approved set.</p>';
    });
  }

  /* Indexed commentary list, generated from the source registry. */
  var al = document.getElementById('article-list');
  if (al) {
    fetch('../sources.json').then(function (r) { return r.json(); }).then(function (reg) {
      var arts = (reg.sources || []).filter(function (s) { return s.kind === 'article'; });
      if (!arts.length) {
        al.innerHTML = '<p>No commentary indexed yet. The first entries arrive with the next weekly review.</p>';
        return;
      }
      arts.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      var html = '';
      arts.forEach(function (s) {
        html += '<p><a href="' + s.url + '" target="_blank" rel="noopener">' + s.title + '</a><br>' +
          s.author + ' &middot; ' + s.publisher + ' &middot; ' + String(s.date).slice(0, 4) +
          (s.abstract ? '<br><span class="article-abstract">' + s.abstract + '</span>' : '') + '</p>';
      });
      html += '<p>' + arts.length + ' commentary entr' + (arts.length === 1 ? 'y' : 'ies') + ' indexed. Every link goes to the publisher.</p>';
      al.innerHTML = html;
    }).catch(function () {
      al.innerHTML = '<p>The commentary index could not be loaded right now.</p>';
    });
  }
})();
