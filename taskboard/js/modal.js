/* ── Checklist helpers ───────────────────────────────────────────────────── */

function addChecklistItem(text, done) {
  const frag = document.getElementById('tmpl-checklist-item').content.cloneNode(true);
  const li   = frag.querySelector('li');
  const cb   = frag.querySelector('.checklist-checkbox');
  const lbl  = frag.querySelector('.checklist-item-label');
  const del  = frag.querySelector('.checklist-item-remove');

  const id = 'chk-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  cb.id = id;
  cb.checked = !!done;
  lbl.setAttribute('for', id);
  lbl.textContent = text;

  del.addEventListener('click', () => li.remove());

  document.getElementById('checklist-items').appendChild(frag);
}

/* ── Open modal with a card's data ───────────────────────────────────────── */

function openCardModal(cardId) {
  const state = window._tbState;
  let card = null;
  state.lists.forEach(l => {
    const found = l.cards.find(c => c.id === cardId);
    if (found) card = found;
  });
  if (!card) return;

  const modal = document.getElementById('card-modal');
  modal.dataset.cardId = cardId;
  modal._opener = document.activeElement;

  document.getElementById('card-title').value    = card.title;
  document.getElementById('card-desc').value     = card.description || '';
  document.getElementById('card-due').value      = card.dueDate || '';
  document.getElementById('card-priority').value = card.priority || 'medium';
  document.getElementById('card-label').value    = card.label || '#0052cc';

  document.getElementById('card-title-error').textContent = '';
  document.getElementById('card-title').classList.remove('is-invalid');

  const listEl = document.getElementById('checklist-items');
  listEl.innerHTML = '';
  (card.checklist || []).forEach(item => addChecklistItem(item.text, item.done));

  modal.showModal();
  document.getElementById('card-title').focus();
}

/* ── Modal wiring (called once) ──────────────────────────────────────────── */

function initModal() {
  const modal     = document.getElementById('card-modal');
  const closeBtn  = document.getElementById('modal-close');
  const cancelBtn = document.getElementById('btn-cancel-modal');
  const deleteBtn = document.getElementById('btn-delete-card');
  const form      = document.getElementById('card-form');
  const addItemBtn = document.getElementById('btn-add-checklist-item');
  const newItemInp = document.getElementById('checklist-new-item');
  const newItemErr = document.getElementById('checklist-new-error');

  const close = () => {
    modal.close();
    if (modal._opener && modal._opener.focus) {
      modal._opener.focus();
      modal._opener = null;
    }
  };

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  // Click on backdrop closes modal
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  deleteBtn.addEventListener('click', () => {
    const cardId = modal.dataset.cardId;
    if (!cardId) return;
    const state = window._tbState;
    state.lists.forEach(l => {
      l.cards = l.cards.filter(c => c.id !== cardId);
    });
    saveState(state);
    renderBoard(state);
    close();
    announce('Card deleted.');
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const cardId = modal.dataset.cardId;
    const state  = window._tbState;
    let card = null;
    state.lists.forEach(l => {
      const found = l.cards.find(c => c.id === cardId);
      if (found) card = found;
    });
    if (!card) return;

    const titleInp = document.getElementById('card-title');
    const titleErr = document.getElementById('card-title-error');
    const title = titleInp.value.trim();

    if (!title) {
      titleErr.textContent = 'Title is required.';
      titleInp.classList.add('is-invalid');
      titleInp.focus();
      return;
    }
    titleErr.textContent = '';
    titleInp.classList.remove('is-invalid');

    card.title       = title;
    card.description = document.getElementById('card-desc').value;
    card.dueDate     = document.getElementById('card-due').value;
    card.priority    = document.getElementById('card-priority').value;
    card.label       = document.getElementById('card-label').value;

    card.checklist = [];
    document.querySelectorAll('#checklist-items .checklist-item').forEach(li => {
      const cb  = li.querySelector('.checklist-checkbox');
      const lbl = li.querySelector('.checklist-item-label');
      card.checklist.push({ text: lbl.textContent.trim(), done: cb.checked });
    });

    saveState(state);
    renderBoard(state);
    close();
    announce(`Card "${title}" saved.`);
  });

  // Checklist "Add" button
  const submitNewItem = () => {
    const text = newItemInp.value.trim();
    if (!text) {
      newItemErr.textContent = 'Enter item text.';
      newItemInp.focus();
      return;
    }
    newItemErr.textContent = '';
    addChecklistItem(text, false);
    newItemInp.value = '';
    newItemInp.focus();
  };

  addItemBtn.addEventListener('click', submitNewItem);
  newItemInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submitNewItem(); }
  });
}
