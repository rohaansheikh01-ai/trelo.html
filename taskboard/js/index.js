const _scripts = [
  'js/storage.js',
  'js/board.js',
  'js/modal.js',
  'js/search.js',
  'js/theme.js',
  'js/main.js'
];

(async () => {
  for (const src of _scripts) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
})();
