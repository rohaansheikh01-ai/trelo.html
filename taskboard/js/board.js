function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function announce(msg) {
  const el = document.getElementById('aria-announce');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = msg; });
}



function buildCardEl(card) {
  const art = document.createElement('article');
  art.className = 'card';
  art.tabIndex = 0;
  art.setAttribute('role', 'button');
  art.setAttribute('aria-label', 'Edit card: ' + card.title);
  art.dataset.cardId = card.id;

  let html = card.label
    ? `<div class="card-label-strip" style="background:${esc(card.label)}"></div>`
    : '';

  html += `<p class="card-title">${esc(card.title)}</p>`;

  if (card.priority || card.dueDate) {
    html += '<div class="card-meta">';
    if (card.priority) {
      html += `<span class="card-badge priority-${esc(card.priority)}">${esc(card.priority)}</span>`;
    }
    if (card.dueDate) {
      const overdue = card.dueDate < new Date().toISOString().slice(0, 10);
      html += `<time class="card-due${overdue ? ' is-overdue' : ''}" datetime="${esc(card.dueDate)}">${formatDate(card.dueDate)}</time>`;
    }
    html += '</div>';
  }

  art.innerHTML = html;

  const open = () => openCardModal(card.id);
  art.addEventListener('click', open);
  art.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });

  return art;
}


function startRename(listEl, list) {
  const titleEl = listEl.querySelector('.list-title');
  if (!titleEl) return;

  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'list-title-input';
  inp.value = list.title;
  inp.maxLength = 100;
  titleEl.replaceWith(inp);
  inp.focus();
  inp.select();

  const commit = () => {
    const newTitle = inp.value.trim() || list.title;
    list.title = newTitle;
    listEl.querySelector('.list-cards').setAttribute('aria-label', newTitle + ' cards');
    const state = window._tbState;
    try { saveState(state); } catch (_) {}
    const h2 = document.createElement('h2');
    h2.className = 'list-title';
    h2.tabIndex = 0;
    h2.textContent = newTitle;
    inp.replaceWith(h2);
    announce(`List renamed to "${newTitle}".`);
  };

  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { inp.value = list.title; inp.blur(); }
  });
}

function wireListMenu(listEl, list) {
  const menuBtn = listEl.querySelector('.btn-list-menu');
  const header  = listEl.querySelector('.list-header');

  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelectorAll('.list-menu').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'list-menu';

    const renameItem = document.createElement('button');
    renameItem.type = 'button';
    renameItem.className = 'list-menu-item';
    renameItem.textContent = 'Rename list';

    const deleteItem = document.createElement('button');
    deleteItem.type = 'button';
    deleteItem.className = 'list-menu-item list-menu-danger';
    deleteItem.textContent = 'Delete list';

    renameItem.addEventListener('click', () => {
      menu.remove();
      startRename(listEl, list);
    });

    deleteItem.addEventListener('click', () => {
      menu.remove();
      const state = window._tbState;
      state.lists = state.lists.filter(l => l.id !== list.id);
      try { saveState(state); } catch (_) {}
      renderBoard(state);
      if (typeof applyFilter === 'function') applyFilter();
      announce(`List "${list.title}" deleted.`);
    });

    menu.appendChild(renameItem);
    menu.appendChild(deleteItem);
    header.appendChild(menu);

    const closeMenu = ev => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    document.addEventListener('click', closeMenu);
  });
}

function wireAddCard(listEl, list) {
  const addBtn = listEl.querySelector('.btn-add-card');

  addBtn.addEventListener('click', () => {
    if (listEl.querySelector('.add-card-form')) return; // already open

    const frag = document.getElementById('tmpl-add-card-form').content.cloneNode(true);
    const form = frag.querySelector('form');

    // Give inputs unique IDs per list so label/for still works
    const inp = frag.querySelector('input[type="text"]');
    const err = frag.querySelector('.field-error');
    inp.id = `act-${list.id}`;
    err.id = `ace-${list.id}`;
    inp.setAttribute('aria-describedby', err.id);
    frag.querySelector('label').setAttribute('for', inp.id);
    form.classList.remove('hidden');

    addBtn.before(frag);
    addBtn.classList.add('hidden');
    addBtn.setAttribute('aria-expanded', 'true');

    const liveForm = listEl.querySelector('.add-card-form');
    const liveInp  = liveForm.querySelector('input[type="text"]');
    const liveErr  = liveForm.querySelector('.field-error');

    liveInp.focus();

    const close = () => {
      liveForm.remove();
      addBtn.classList.remove('hidden');
      addBtn.setAttribute('aria-expanded', 'false');
    };

    liveForm.querySelector('.btn-cancel-add-card').addEventListener('click', close);
    liveForm.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    liveForm.addEventListener('submit', e => {
      e.preventDefault();
      const title = liveInp.value.trim();
      if (!title) {
        liveErr.textContent = 'Title is required.';
        liveInp.classList.add('is-invalid');
        liveInp.focus();
        return;
      }
      liveErr.textContent = '';
      liveInp.classList.remove('is-invalid');

      const card = {
        id: uid(), title,
        description: '', dueDate: '', priority: 'medium', label: '', checklist: []
      };
      list.cards.push(card);
      saveState(window._tbState);

      listEl.querySelector('.list-cards').appendChild(buildCardEl(card));
      liveInp.value = '';
      liveInp.focus();
      announce(`Card "${title}" added.`);
    });
  });
}


function buildListEl(list) {
  const sec = document.createElement('section');
  sec.className = 'list';
  sec.dataset.listId = list.id;

  sec.innerHTML = `
    <header class="list-header">
      <h2 class="list-title" tabindex="0">${esc(list.title)}</h2>
      <button class="btn-icon btn-list-menu" aria-label="List options">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5"  r="1.5"/>
          <circle cx="12" cy="12" r="1.5"/>
          <circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>
    </header>
    <div class="list-cards" role="list" aria-label="${esc(list.title)} cards"></div>
    <button class="btn-add-card" aria-expanded="false">
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="5"  x2="12" y2="19"/>
        <line x1="5"  y1="12" x2="19" y2="12"/>
      </svg>
      Add a card
    </button>`;

  list.cards.forEach(c =>
    sec.querySelector('.list-cards').appendChild(buildCardEl(c))
  );

  wireAddCard(sec, list);
  wireListMenu(sec, list);
  return sec;
}


function renderBoard(state) {
  window._tbState = state;
  const board = document.getElementById('board');
  const wrap  = board.querySelector('.add-list-wrap');
  board.querySelectorAll('.list').forEach(l => l.remove());
  state.lists.forEach(list => board.insertBefore(buildListEl(list), wrap));
}

function initAddListForm() {
  const showBtn   = document.getElementById('btn-show-add-list');
  const form      = document.getElementById('form-add-list');
  const cancelBtn = document.getElementById('btn-cancel-add-list');
  const inp       = document.getElementById('new-list-title');
  const err       = document.getElementById('add-list-error');

  const open = () => {
    showBtn.classList.add('hidden');
    form.classList.remove('hidden');
    inp.value = '';
    err.textContent = '';
    inp.classList.remove('is-invalid');
    inp.focus();
  };

  const close = () => {
    form.classList.add('hidden');
    showBtn.classList.remove('hidden');
    err.textContent = '';
    inp.classList.remove('is-invalid');
    showBtn.focus();
  };

  showBtn.addEventListener('click', open);
  cancelBtn.addEventListener('click', close);
  form.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const title = inp.value.trim();
    if (!title) {
      err.textContent = 'List title is required.';
      inp.classList.add('is-invalid');
      inp.focus();
      return;
    }
    err.textContent = '';
    inp.classList.remove('is-invalid');

    const state = window._tbState;
    state.lists.push({ id: uid(), title, cards: [] });
    saveState(state);
    renderBoard(state);
    close();
    announce(`List "${title}" added.`);
  });
}
