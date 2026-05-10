function initSearch(onChange) {
  document.getElementById('search-input').addEventListener('input', onChange);
  document.getElementById('priority-filter').addEventListener('change', onChange);
}

function applyFilter() {
  const query    = document.getElementById('search-input').value.toLowerCase().trim();
  const priority = document.getElementById('priority-filter').value;

  document.querySelectorAll('.card').forEach(cardEl => {
    const state = window._tbState;
    let card = null;
    state.lists.forEach(l => {
      const found = l.cards.find(c => c.id === cardEl.dataset.cardId);
      if (found) card = found;
    });
    if (!card) return;

    const matchQuery    = !query    || card.title.toLowerCase().includes(query)
                                    || (card.description || '').toLowerCase().includes(query);
    const matchPriority = !priority || card.priority === priority;

    cardEl.classList.toggle('card-hidden', !(matchQuery && matchPriority));
  });
}
