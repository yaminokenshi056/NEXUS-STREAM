/* ── STORAGE CONFIGURATION ────────────────────────────── */
const ADMIN_PASSWORD = 'hinata056';
const BIN_ID = "6a3171abda38895dfeca8f58";
const MASTER_KEY = "$2a$10$FgiYpQN0p3RzvH0beA8kXOHGcgE3rqRVrtH3VD0wLGOgN/hdtJWei";

const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const SESSION_KEY = 'nexusSession';

/* ── Global State Storage ─────────────────────────────── */
let cachedRecord = { links: [], passes: [] };
let currentUser  = null;
let loginMode    = 'visitor';
let usernameCheckTimer = null;
let currentCategory = 'movie'; // Default Category

// Defined ordered sequence mappings
const categoriesInOrder = ['movie', 'game', 'education'];
const categoryDisplayNames = {
  'movie': '1. Anime / Movie',
  'game': '2. Game',
  'education': '3. Education / Books / Manga'
};

/* ================================================================
   ANTI-INSPECTION SYSTEM
   ================================================================ */
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', (e) => {
  const key = (e.key || '').toUpperCase();
  const blockCombo =
    key === 'F12' ||
    (e.ctrlKey && e.shiftKey && (key === 'I' || key === 'J' || key === 'C')) ||
    (e.ctrlKey && key === 'U');
  if (blockCombo) {
    e.preventDefault();
    e.stopPropagation();
  }
});

/* ================================================================
   GLOWING SPARK FIELD GENERATION
   ================================================================ */
(function spawnEmbers() {
  const field = document.getElementById('ember-field');
  const count = 15;
  for (let i = 0; i < count; i++) {
    const e = document.createElement('div');
    e.className = 'ember';
    const size = 2 + Math.random() * 4;
    e.style.width = size + 'px';
    e.style.height = size + 'px';
    e.style.left = Math.random() * 100 + 'vw';
    e.style.animationDuration = (7 + Math.random() * 9) + 's';
    e.style.animationDelay = (Math.random() * 8) + 's';
    field.appendChild(e);
  }
})();

/* ── Toast Dialog Layer ───────────────────────────────── */
let toastTimer = null;
function showToast(message, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = message;
  t.className = `show toast-${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 3200);
}

function escapeHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function cleanText(value) { return String(value || '').trim().replace(/\s+/g, ' '); }
function isValidUsername(username) { return /^[a-zA-Z0-9_]{3,20}$/.test(username); }
function isValidPasskey(passkey) { return passkey.length >= 4 && passkey.length <= 64 && !/^\s|\s$/.test(passkey); }

function togglePassword(btn) {
  const targetId = btn.getAttribute('data-target');
  const input = document.getElementById(targetId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? '🙈' : '👁';
}

function setBtnLoading(btn, loading, loadingText) {
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span><span>${loadingText || 'Please wait...'}</span>`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
      delete btn.dataset.originalHtml;
    }
  }
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function showWelcomeBanner() {
  const banner = document.getElementById('welcome-banner');
  const name = currentUser ? currentUser.username : '';
  const glyph = isAdmin() ? '🕴️' : '⚽';
  banner.innerHTML = `<span class="glyph">${glyph}</span> ${getTimeGreeting()}, ${escapeHTML(name)}. Welcome to the Selection Screen.`;
}

/* ================================================================
   JSONBIN STORAGE CLOUD SYNCHRONIZATION
   ================================================================ */
async function fetchRecord(notifyOnError = true) {
  try {
    const response = await fetch(`${API_URL}/latest`, {
      headers: { "X-Master-Key": MASTER_KEY }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const resData = await response.json();
    const record  = (resData && resData.record) ? resData.record : {};
    cachedRecord = {
      links:  Array.isArray(record.links)  ? record.links  : [],
      passes: Array.isArray(record.passes) ? record.passes : []
    };
    return true;
  } catch (error) {
    console.error("Cloud connection drop:", error);
    if (notifyOnError) showToast("Network handshake timeout. Retrying syncing...", "error");
    return false;
  }
}

async function syncToServer() {
  const response = await fetch(API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': MASTER_KEY },
    body: JSON.stringify({ links: cachedRecord.links, passes: cachedRecord.passes })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

/* ================================================================
   LOCK AND SECURITY CONTROLS
   ================================================================ */
function setLoginMode(mode) {
  loginMode = mode;
  document.getElementById('mode-toggle').dataset.mode = mode;
  document.getElementById('btn-mode-visitor').classList.toggle('active', mode === 'visitor');
  document.getElementById('btn-mode-register').classList.toggle('active', mode === 'register');
  document.getElementById('btn-mode-admin').classList.toggle('active', mode === 'admin');
  document.getElementById('visitor-fields').style.display  = mode === 'visitor'  ? 'flex' : 'none';
  document.getElementById('register-fields').style.display = mode === 'register' ? 'flex' : 'none';
  document.getElementById('admin-fields').style.display    = mode === 'admin'    ? 'flex' : 'none';
  
  const label = document.getElementById('lock-submit-label');
  label.textContent = mode === 'register' ? 'Sign Squad Contract' : 'Unlock Access';
  document.querySelectorAll('.lock-fields input').forEach(el => el.value = '');
}

function handleLockSubmit() { loginMode === 'register' ? registerVisitor() : handleLogin(); }

function checkUsernameAvailability() {
  clearTimeout(usernameCheckTimer);
  const hint = document.getElementById('register-username-hint');
  const username = cleanText(document.getElementById('register-username').value);

  if (!username) { hint.textContent = 'Letters, numbers and underscore only. 3–20 characters.'; hint.className = 'field-hint'; return; }
  if (!isValidUsername(username)) { hint.textContent = 'Invalid format.'; hint.className = 'field-hint error'; return; }

  hint.textContent = 'Verifying name unique constraints...'; hint.className = 'field-hint';
  usernameCheckTimer = setTimeout(async () => {
    await fetchRecord(false);
    const taken = cachedRecord.passes.some(p => p.username.toLowerCase() === username.toLowerCase());
    if (taken) { hint.textContent = `"${username}" is already assigned to a player.`; hint.className = 'field-hint error'; } 
    else { hint.textContent = `"${username}" is available.`; hint.className = 'field-hint ok'; }
  }, 450);
}

async function registerVisitor() {
  const userEl = document.getElementById('register-username'), passEl = document.getElementById('register-passkey'), confirmEl = document.getElementById('register-passkey-confirm');
  const username = cleanText(userEl.value), passkey = passEl.value.trim(), confirmPasskey = confirmEl.value.trim();

  if (!isValidUsername(username)) { showToast('Invalid formatting parameters.', 'error'); return; }
  if (!isValidPasskey(passkey)) { showToast('Passkey strength insufficient.', 'error'); return; }
  if (passkey !== confirmPasskey) { showToast('Passwords do not match.', 'error'); return; }

  const submitBtn = document.getElementById('lock-submit-btn');
  setBtnLoading(submitBtn, true, 'Processing...');

  try {
    const ok = await fetchRecord(false);
    if (!ok) { showToast('Database unreachable.', 'error'); return; }
    if (cachedRecord.passes.some(p => p.username.toLowerCase() === username.toLowerCase())) { showToast('Username already registered.', 'error'); return; }

    cachedRecord.passes.push({ username, passkey, addedAt: Date.now() });
    await syncToServer();

    currentUser = { role: 'visitor', username, passkey };
    persistSession(); enterDashboard();
    showToast(`Player account configured. Welcome ${username}!`, 'success');
  } catch (e) { showToast('Data transfer error.', 'error'); } 
  finally { setBtnLoading(submitBtn, false); }
}

function persistSession() { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser)); } catch (e) {} }
function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} }

async function tryAutoLogin() {
  let saved = null;
  try { const raw = sessionStorage.getItem(SESSION_KEY); if (raw) saved = JSON.parse(raw); } catch (e) {}
  if (!saved || !saved.role) return false;
  
  const ok = await fetchRecord(false);
  if (!ok) return false;

  if (saved.role === 'admin') {
    currentUser = { role: 'admin', username: 'Manager' }; enterDashboard(); return true;
  }

  const match = cachedRecord.passes.find(p => p.username === saved.username && p.passkey === saved.passkey);
  if (!match) { clearSession(); return false; }

  currentUser = { role: 'visitor', username: saved.username, passkey: saved.passkey };
  enterDashboard(); return true;
}

async function handleLogin() {
  const submitBtn = document.getElementById('lock-submit-btn');

  if (loginMode === 'admin') {
    const secretEl = document.getElementById('admin-secret'), secret = secretEl.value.trim();
    if (!secret) { showToast('Input token payload.', 'error'); return; }
    setBtnLoading(submitBtn, true, 'Authorizing...');
    try {
      if (secret !== ADMIN_PASSWORD) { showToast('Invalid credentials.', 'error'); return; }
      await fetchRecord();
      currentUser = { role: 'admin', username: 'Manager' };
      persistSession(); enterDashboard(); showToast('Access granted, Manager.', 'success');
    } finally { setBtnLoading(submitBtn, false); }
    return;
  }

  const userEl = document.getElementById('visitor-username'), passEl = document.getElementById('visitor-passkey');
  const username = cleanText(userEl.value), passkey = passEl.value.trim();
  if (!username || !passkey) { showToast('All values required.', 'error'); return; }

  setBtnLoading(submitBtn, true, 'Opening...');
  try {
    const ok = await fetchRecord();
    if (!ok) return;
    const match = cachedRecord.passes.find(p => p.username === username && p.passkey === passkey);
    if (!match) { showToast('Invalid login details.', 'error'); return; }

    currentUser = { role: 'visitor', username, passkey };
    persistSession(); enterDashboard(); showToast(`Welcome back.`, 'success');
  } finally { setBtnLoading(submitBtn, false); }
}

function logout() {
  currentUser = null; clearSession();
  document.getElementById('main-dashboard').style.display = 'none';
  document.getElementById('user-bar').style.display = 'none';
  document.getElementById('header-badge-locked').style.display = 'inline-block';
  document.getElementById('lock-screen-wrapper').style.display = 'flex';
  setLoginMode('visitor'); showToast('Session terminated.', 'success');
}

function isAdmin() { return !!(currentUser && currentUser.role === 'admin'); }

function enterDashboard() {
  document.getElementById('lock-screen-wrapper').style.display = 'none';
  document.getElementById('header-badge-locked').style.display = 'none';
  document.getElementById('main-dashboard').style.display = '';
  document.getElementById('user-bar').style.display = 'flex';
  document.getElementById('user-bar-name').textContent = currentUser.username;
  
  const roleBadge = document.getElementById('user-bar-role');
  roleBadge.textContent = isAdmin() ? 'Manager' : 'Fan';
  roleBadge.className = `role-badge ${isAdmin() ? 'role-admin' : 'role-visitor'}`;
  
  document.getElementById('manage-users-card').style.display = isAdmin() ? 'block' : 'none';
  document.getElementById('add-link-card').style.display = isAdmin() ? 'block' : 'none';

  showWelcomeBanner(); setCategory('movie');
  if (isAdmin()) renderSubscribers();
}

async function refreshDashboard() {
  const btn = document.getElementById('btn-refresh');
  btn.classList.add('spinning'); btn.disabled = true;
  try {
    if (await fetchRecord(false)) { renderLinks(); if (isAdmin()) renderSubscribers(); showToast('Matrix Synced.', 'success'); }
  } finally { setTimeout(() => { btn.classList.remove('spinning'); btn.disabled = false; }, 350); }
}

/* ================================================================
   DYNAMIC SYSTEM SECTORS & CATEGORIES
   ================================================================ */
function setCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.tab-btn[data-cat="${cat}"]`).classList.add('active');
  renderLinks();
}

function confirmOpenLink(url) {
  document.getElementById('confirm-modal-url').textContent = url;
  document.getElementById('confirm-modal-go').onclick = () => { window.open(url, '_blank', 'noopener,noreferrer'); closeConfirmModal(); };
  document.getElementById('confirm-modal').classList.add('show');
}
function closeConfirmModal() { document.getElementById('confirm-modal').classList.remove('show'); }
document.getElementById('confirm-modal').addEventListener('click', (e) => { if (e.target.id === 'confirm-modal') closeConfirmModal(); });

let linkSearchQuery = '';

function renderLinks() {
  const list = document.getElementById('links-list');
  const empty = document.getElementById('empty-state');
  const searchEmpty = document.getElementById('search-empty-state');
  const badge = document.getElementById('count-badge');
  const admin = isAdmin();

  const categoryLinks = cachedRecord.links.filter(l => (l.category || 'movie') === currentCategory);
  badge.textContent = categoryLinks.length;
  list.innerHTML = '';

  if (categoryLinks.length === 0) {
    empty.style.display = 'block'; searchEmpty.style.display = 'none'; return;
  }
  empty.style.display = 'none';

  const query = linkSearchQuery.trim().toLowerCase();
  const sourceIndexed = cachedRecord.links.map((link, idx) => ({ link, idx })).filter(({ link }) => (link.category || 'movie') === currentCategory);
  const filtered = query ? sourceIndexed.filter(({ link }) => link.name.toLowerCase().includes(query) || link.url.toLowerCase().includes(query)) : sourceIndexed;

  if (query && filtered.length === 0) { searchEmpty.style.display = 'block'; return; }
  searchEmpty.style.display = 'none';

  filtered.forEach(({ link, idx }) => {
    let iconEmoji = currentCategory === 'movie' ? '🎬' : currentCategory === 'game' ? '🎮' : '📚';
    const item = document.createElement('div');
    item.className = 'link-item';
    item.setAttribute('tabindex', '0');
    item.setAttribute('onclick', `confirmOpenLink(${JSON.stringify(link.url)})`);
    
    // Core Link structure
    let innerStructure = `
      <div class="link-icon">${iconEmoji}</div>
      <div class="link-info">
        <div class="link-name">${escapeHTML(link.name)}</div>
        <span class="link-url">${escapeHTML(link.url)}</span>
      </div>`;
    
    // Add operational control tools for Managers
    if (admin) {
      innerStructure += `
        <div class="action-cluster">
          <button class="btn-action-cat" title="Cycle Category" onclick="event.stopPropagation(); cycleLinkCategory(${idx})">
            🔄 Move Cat
          </button>
          <button class="btn btn-danger" onclick="event.stopPropagation(); removeLink(${idx})">
            Remove
          </button>
        </div>`;
    }

    item.innerHTML = innerStructure;
    list.appendChild(item);
  });
}

function filterLinks() { linkSearchQuery = document.getElementById('link-search').value; renderLinks(); }

/* ================================================================
   MANAGER POST-ADD CHANGE CATEGORY INTERACTIVE ACTION
   ================================================================ */
async function cycleLinkCategory(absoluteIndex) {
  if (!isAdmin()) return;
  const linkItem = cachedRecord.links[absoluteIndex];
  if (!linkItem) return;

  // Locate the sequential category index position
  let currentCatIndex = categoriesInOrder.indexOf(linkItem.category || 'movie');
  if (currentCatIndex === -1) currentCatIndex = 0;

  // Move forward to the next index, cycling back around if necessary
  let nextCatIndex = (currentCatIndex + 1) % categoriesInOrder.length;
  let targetCategory = categoriesInOrder[nextCatIndex];

  linkItem.category = targetCategory;
  showToast(`Re-routing object to category: ${categoryDisplayNames[targetCategory]}`, 'success');

  try {
    await syncToServer();
    // Re-render to update layout positioning instantly
    renderLinks();
  } catch (err) {
    showToast('Failed to save category update to cloud.', 'error');
  }
}

function renderSubscribers() {
  const list = document.getElementById('subscribers-list'), empty = document.getElementById('subscribers-empty-state'), badge = document.getElementById('subscriber-count-badge');
  badge.textContent = cachedRecord.passes.length; list.innerHTML = '';
  if (cachedRecord.passes.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  cachedRecord.passes.forEach((pass, index) => {
    const item = document.createElement('div'); item.className = 'link-item'; item.style.cursor = 'default';
    item.innerHTML = `
      <div class="link-icon">👤</div>
      <div class="link-info"><div class="link-name">${escapeHTML(pass.username)}</div><div class="link-meta">Passkey token: ${escapeHTML(pass.passkey)}</div></div>
      <button class="btn btn-danger" onclick="deleteUser(${index})"> Delete </button>`;
    list.appendChild(item);
  });
}

/* ── Admin Management Tools ────────────────────── */
async function createUser() {
  if (!isAdmin()) return;
  const username = cleanText(document.getElementById('new-username').value), passkey = document.getElementById('new-passkey').value.trim();
  if (!isValidUsername(username) || !isValidPasskey(passkey)) return showToast('Invalid characters or constraints.', 'error');

  const btn = document.getElementById('btn-create-user'); setBtnLoading(btn, true, 'Creating...');
  try {
    await fetchRecord(false);
    if (cachedRecord.passes.some(p => p.username.toLowerCase() === username.toLowerCase())) { showToast('Username registered already.', 'error'); return; }
    cachedRecord.passes.push({ username, passkey, addedAt: Date.now() });
    await syncToServer();
    document.getElementById('new-username').value = ''; document.getElementById('new-passkey').value = '';
    showToast(`Account registered inside cluster.`, 'success'); renderSubscribers();
  } catch (e) { showToast('Database writing fault.', 'error'); } finally { setBtnLoading(btn, false); }
}

async function deleteUser(index) {
  if (!isAdmin()) return;
  if (!confirm(`Revoke credentials permanently?`)) return;
  try {
    await fetchRecord(false); cachedRecord.passes.splice(index, 1); await syncToServer();
    showToast(`Credentials wiped.`, 'success'); renderSubscribers();
  } catch (e) {}
}

async function addLink() {
  if (!isAdmin()) return;
  const name = cleanText(document.getElementById('link-name').value), url = document.getElementById('link-url').value.trim();
  const category = document.getElementById('link-category').value;
  
  if (!name || !url || (!url.startsWith('http://') && !url.startsWith('https://'))) return showToast('Check schema protocols or empty values.', 'error');

  const btn = document.getElementById('btn-add-link'); setBtnLoading(btn, true, 'Publishing...');
  try {
    await fetchRecord(false);
    cachedRecord.links.push({ name, url, category, addedAt: Date.now() });
    await syncToServer();
    document.getElementById('link-name').value = ''; document.getElementById('link-url').value = '';
    showToast(`Item mapped.`, 'success'); 
    
    if (currentCategory !== category) setCategory(category); 
    else renderLinks();
  } catch (e) { showToast('Error writing package.', 'error'); } finally { setBtnLoading(btn, false); }
}

async function removeLink(index) {
  if (!isAdmin()) return;
  try {
    await fetchRecord(false); cachedRecord.links.splice(index, 1); await syncToServer();
    showToast(`Link array cleared.`, 'success'); renderLinks();
  } catch (e) {}
}

/* ── Keyboard Shortcuts ───────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('confirm-modal').classList.contains('show')) { e.preventDefault(); closeConfirmModal(); return; }
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    if (e.key.toLowerCase() === 'r') { e.preventDefault(); refreshDashboard(); }
    if (e.key.toLowerCase() === 'l') { e.preventDefault(); logout(); }
    if (e.key.toLowerCase() === 's') { e.preventDefault(); document.getElementById('link-search').focus(); }
  }
});

const enterHandlers = { login: handleLockSubmit, register: registerVisitor, createUser: createUser, addLink: addLink };
document.querySelectorAll('[data-enter]').forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const h = enterHandlers[el.dataset.enter]; if (h) h(); } }));

/* ── Boot Loop System Engine initialization ───────── */
(async function startup() {
  if (!(await tryAutoLogin())) fetchRecord(false);
})();