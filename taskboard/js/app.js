var STORAGE_KEY = 'tb-state';

function loadState() {
  var raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : { lists: [] };    // ternary operater //
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(str) {
  var div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  var parts = iso.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function announce(msg) {
  var el = document.getElementById('aria-announce');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(function() { el.textContent = msg; });
}

function findCard(cardId) {
  var found = null;
  window._tbState.lists.forEach(function(l) {
    l.cards.forEach(function(c) { if (c.id === cardId) found = c; });
  });
  return found;
}

/* ── Card ── */

function buildCardEl(card) {
  var art = document.createElement('article');
  art.className = 'card';
  art.tabIndex = 0;
  art.setAttribute('role', 'button');
  art.setAttribute('aria-label', 'Edit card: ' + card.title);
  art.dataset.cardId = card.id;

  var html = card.label ? '<div class="card-label-strip" style="background:' + esc(card.label) + '"></div>' : '';
  html += '<p class="card-title">' + esc(card.title) + '</p>';

  if (card.priority || card.dueDate) {
    html += '<div class="card-meta">';
    if (card.priority) {
      html += '<span class="card-badge priority-' + esc(card.priority) + '">' + esc(card.priority) + '</span>';
    }
    if (card.dueDate) {
      var isOverdue = card.dueDate < new Date().toISOString().slice(0, 10);
      html += '<time class="card-due' + (isOverdue ? ' is-overdue' : '') + '" datetime="' + esc(card.dueDate) + '">' + formatDate(card.dueDate) + '</time>';
    }
    html += '</div>';
  }

  art.innerHTML = html;
  art.addEventListener('click', function() { openCardModal(card.id); });
  art.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCardModal(card.id); }
  });
  return art;
}

/* ── List ── */

function startRename(listEl, list) {
  var titleEl = listEl.querySelector('.list-title');
  if (!titleEl) return;

  var inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'list-title-input';
  inp.value = list.title;
  inp.maxLength = 100;
  titleEl.replaceWith(inp);
  inp.focus();
  inp.select();

  function commit() {
    var newTitle = inp.value.trim() || list.title;
    list.title = newTitle;
    listEl.querySelector('.list-cards').setAttribute('aria-label', newTitle + ' cards');
    saveState(window._tbState);
    var h2 = document.createElement('h2');
    h2.className = 'list-title';
    h2.tabIndex = 0;
    h2.textContent = newTitle;
    inp.replaceWith(h2);
    announce('List renamed to "' + newTitle + '".');
  }

  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { inp.value = list.title; inp.blur(); }
  });
}

function wireListMenu(listEl, list) {
  var menuBtn = listEl.querySelector('.btn-list-menu');
  var header  = listEl.querySelector('.list-header');

  menuBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    document.querySelectorAll('.list-menu').forEach(function(m) { m.remove(); });

    var menu       = document.createElement('div');
    menu.className = 'list-menu';

    var renameItem = document.createElement('button');
    renameItem.type = 'button';
    renameItem.className = 'list-menu-item';
    renameItem.textContent = 'Rename list';

    var deleteItem = document.createElement('button');
    deleteItem.type = 'button';
    deleteItem.className = 'list-menu-item list-menu-danger';
    deleteItem.textContent = 'Delete list';

    renameItem.addEventListener('click', function() {
      menu.remove();
      startRename(listEl, list);
    });

    deleteItem.addEventListener('click', function() {
      menu.remove();
      var state = window._tbState;
      state.lists = state.lists.filter(function(l) { return l.id !== list.id; });
      saveState(state);
      renderBoard(state);
      if (typeof applyFilter === 'function') applyFilter();
      announce('List "' + list.title + '" deleted.');
    });

    menu.appendChild(renameItem);
    menu.appendChild(deleteItem);
    header.appendChild(menu);

    function closeMenu(ev) {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    }
    document.addEventListener('click', closeMenu);
  });
}

function wireAddCard(listEl, list) {
  var addBtn = listEl.querySelector('.btn-add-card');

  addBtn.addEventListener('click', function() {
    if (listEl.querySelector('.add-card-form')) return;

    var frag = document.getElementById('tmpl-add-card-form').content.cloneNode(true);
    var form = frag.querySelector('form');
    var inp  = frag.querySelector('input[type="text"]');
    var err  = frag.querySelector('.field-error');

    inp.id = 'act-' + list.id;
    err.id = 'ace-' + list.id;
    inp.setAttribute('aria-describedby', err.id);
    frag.querySelector('label').setAttribute('for', inp.id);
    form.classList.remove('hidden');

    addBtn.before(frag);
    addBtn.classList.add('hidden');
    addBtn.setAttribute('aria-expanded', 'true');

    var liveForm = listEl.querySelector('.add-card-form');
    var liveInp  = liveForm.querySelector('input[type="text"]');
    var liveErr  = liveForm.querySelector('.field-error');
    liveInp.focus();

    function close() {
      liveForm.remove();
      addBtn.classList.remove('hidden');
      addBtn.setAttribute('aria-expanded', 'false');
    }

    liveForm.querySelector('.btn-cancel-add-card').addEventListener('click', close);
    liveForm.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });

    liveForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var title = liveInp.value.trim();
      if (!title) {
        liveErr.textContent = 'Title is required.';
        liveInp.classList.add('is-invalid');
        liveInp.focus();
        return;
      }
      liveErr.textContent = '';
      liveInp.classList.remove('is-invalid');
      var card = { id: uid(), title: title, description: '', dueDate: '', priority: 'medium', label: '', checklist: [] };
      list.cards.push(card);
      saveState(window._tbState);
      listEl.querySelector('.list-cards').appendChild(buildCardEl(card));
      liveInp.value = '';
      liveInp.focus();
      announce('Card "' + title + '" added.');
    });
  });
}

function buildListEl(list) {
  var sec = document.createElement('section');
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

  var cardsContainer = sec.querySelector('.list-cards');
  list.cards.forEach(function(c) { cardsContainer.appendChild(buildCardEl(c)); });

  wireAddCard(sec, list);
  wireListMenu(sec, list);
  return sec;
}

function renderBoard(state) {
  window._tbState = state;
  var board = document.getElementById('board');
  var wrap  = board.querySelector('.add-list-wrap');
  board.querySelectorAll('.list').forEach(function(l) { l.remove(); });
  state.lists.forEach(function(list) { board.insertBefore(buildListEl(list), wrap); });
}

function initAddListForm() {
  var showBtn   = document.getElementById('btn-show-add-list');
  var form      = document.getElementById('form-add-list');
  var cancelBtn = document.getElementById('btn-cancel-add-list');
  var inp       = document.getElementById('new-list-title');
  var err       = document.getElementById('add-list-error');

  function open() {
    showBtn.classList.add('hidden');
    form.classList.remove('hidden');
    inp.value = '';
    err.textContent = '';
    inp.classList.remove('is-invalid');
    inp.focus();
  }

  function close() {
    form.classList.add('hidden');
    showBtn.classList.remove('hidden');
    err.textContent = '';
    inp.classList.remove('is-invalid');
    showBtn.focus();
  }

  showBtn.addEventListener('click', open);
  cancelBtn.addEventListener('click', close);
  form.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var title = inp.value.trim();
    if (!title) {
      err.textContent = 'List title is required.';
      inp.classList.add('is-invalid');
      inp.focus();
      return;
    }
    err.textContent = '';
    inp.classList.remove('is-invalid');
    var state = window._tbState;
    state.lists.push({ id: uid(), title: title, cards: [] });
    saveState(state);
    renderBoard(state);
    close();
    announce('List "' + title + '" added.');
  });
}

/* ── Modal ── */

function addChecklistItem(text, done) {
  var frag = document.getElementById('tmpl-checklist-item').content.cloneNode(true);
  var li   = frag.querySelector('li');
  var cb   = frag.querySelector('.checklist-checkbox');
  var lbl  = frag.querySelector('.checklist-item-label');
  var del  = frag.querySelector('.checklist-item-remove');

  var id = 'chk-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  cb.id = id;
  cb.checked = !!done;
  lbl.setAttribute('for', id);
  lbl.textContent = text;
  del.addEventListener('click', function() { li.remove(); });
  document.getElementById('checklist-items').appendChild(frag);
}

function openCardModal(cardId) {
  var card = findCard(cardId);
  if (!card) return;

  var modal = document.getElementById('card-modal');
  modal.dataset.cardId = cardId;
  modal._opener = document.activeElement;

  document.getElementById('card-title').value    = card.title;
  document.getElementById('card-desc').value     = card.description || '';
  document.getElementById('card-due').value      = card.dueDate || '';
  document.getElementById('card-priority').value = card.priority || 'medium';
  document.getElementById('card-label').value    = card.label || '#0052cc';

  document.getElementById('card-title-error').textContent = '';
  document.getElementById('card-title').classList.remove('is-invalid');

  var checklistEl = document.getElementById('checklist-items');
  checklistEl.innerHTML = '';
  (card.checklist || []).forEach(function(item) { addChecklistItem(item.text, item.done); });

  modal.showModal();
  document.getElementById('card-title').focus();
}

function initModal() {
  var modal      = document.getElementById('card-modal');
  var form       = document.getElementById('card-form');
  var addItemBtn = document.getElementById('btn-add-checklist-item');
  var newItemInp = document.getElementById('checklist-new-item');
  var newItemErr = document.getElementById('checklist-new-error');

  function close() {
    modal.close();
    if (modal._opener && modal._opener.focus) {
      modal._opener.focus();
      modal._opener = null;
    }
  }

  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('btn-cancel-modal').addEventListener('click', close);
  modal.addEventListener('click', function(e) { if (e.target === modal) close(); });

  document.getElementById('btn-delete-card').addEventListener('click', function() {
    var cardId = modal.dataset.cardId;
    if (!cardId) return;
    var state = window._tbState;
    state.lists.forEach(function(l) {
      l.cards = l.cards.filter(function(c) { return c.id !== cardId; });
    });
    saveState(state);
    renderBoard(state);
    if (typeof applyFilter === 'function') applyFilter();
    close();
    announce('Card deleted.');
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var card = findCard(modal.dataset.cardId);
    if (!card) return;

    var titleInp = document.getElementById('card-title');
    var titleErr = document.getElementById('card-title-error');
    var title    = titleInp.value.trim();

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
    document.querySelectorAll('#checklist-items .checklist-item').forEach(function(li) {
      card.checklist.push({
        text: li.querySelector('.checklist-item-label').textContent.trim(),
        done: li.querySelector('.checklist-checkbox').checked
      });
    });

    saveState(window._tbState);
    renderBoard(window._tbState);
    if (typeof applyFilter === 'function') applyFilter();
    close();
    announce('Card "' + title + '" saved.');
  });

  function submitNewItem() {
    var text = newItemInp.value.trim();
    if (!text) {
      newItemErr.textContent = 'Enter item text.';
      newItemInp.focus();
      return;
    }
    newItemErr.textContent = '';
    addChecklistItem(text, false);
    newItemInp.value = '';
    newItemInp.focus();
  }

  addItemBtn.addEventListener('click', submitNewItem);
  newItemInp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); submitNewItem(); }
  });
}

/* ── Search & Filter ── */

function initSearch(onChange) {
  document.getElementById('search-input').addEventListener('input', onChange);
  document.getElementById('priority-filter').addEventListener('change', onChange);
}

function applyFilter() {
  var query    = document.getElementById('search-input').value.toLowerCase().trim();
  var priority = document.getElementById('priority-filter').value;

  document.querySelectorAll('.card').forEach(function(cardEl) {
    var card = findCard(cardEl.dataset.cardId);
    if (!card) return;
    var matchesQuery    = !query || card.title.toLowerCase().includes(query) || (card.description || '').toLowerCase().includes(query);
    var matchesPriority = !priority || card.priority === priority;
    cardEl.classList.toggle('card-hidden', !(matchesQuery && matchesPriority));
  });
}

/* ── Theme ── */

function initTheme() {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', function() {
    var root      = document.documentElement;
    var nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', nextTheme);
    localStorage.setItem('tb-theme', nextTheme);
  });
}

/* ── App Start ── */

var state = loadState();
renderBoard(state);
initAddListForm();
initModal();
initSearch(applyFilter);
initTheme();
