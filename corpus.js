(function () {
  var el = document.getElementById('corpus-list');
  if (!el) return;
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
})();
