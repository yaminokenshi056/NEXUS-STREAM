// ==========================================
// CONFIGURATION
// ==========================================
const BIN_ID = '6a3171abda38895dfeca8f58';
const API_KEY = '$2a$10$FgiYpQN0p3RzvH0beA8kXOHGcgE3rqRVrtH3VD0wLGOgN/hdtJWei';
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// Admin Credentials
const ADMIN_PASSWORD = 'hinata056';
let isAdmin = false;

let linksData = [];
let currentCategory = 'anime';
let currentFolderId = null;
let isProcessing = false;
let pendingDeleteId = null;

const statusDisplay = document.getElementById('statusMsg');

// ==========================================
// ADMIN LOGIN LOGIC
// ==========================================
document.getElementById('adminLoginBtn').addEventListener('click', () => {
    const pass = prompt("Enter Admin Password:");
    if (pass === ADMIN_PASSWORD) {
        isAdmin = true;
        document.body.classList.add('admin-mode');
        alert("Admin Access Granted!");
        renderLinks();
    } else if (pass !== null) {
        alert("Incorrect Password!");
    }
});

function checkAdmin() {
    if (isAdmin) return true;
    alert("Admin privileges required for this action.");
    return false;
}

// ==========================================
// DATA FETCHING & SAVING
// ==========================================
async function fetchLinks() {
    try {
        statusDisplay.textContent = 'Loading database...';
        const response = await fetch(`${BIN_URL}/latest`, {
            headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' }
        });
        if (!response.ok) throw new Error("API Limit reached or invalid keys.");

        const data = await response.json();
        linksData = Array.isArray(data.links) ? data.links.map(item => {
            if (!item.type) item.type = 'link'; 
            return item;
        }) : [];
        
        statusDisplay.textContent = '';
        updateFormFolders();
        renderLinks();
    } catch (error) {
        statusDisplay.textContent = 'Error loading database.';
        statusDisplay.style.color = 'var(--danger)';
    }
}

let lastWriteAt = 0;
const MIN_WRITE_INTERVAL_MS = 1200;

async function saveLinksToServer(onSuccessCallback) {
    if (isProcessing) return;
    const now = Date.now();
    if (now - lastWriteAt < MIN_WRITE_INTERVAL_MS) {
        statusDisplay.textContent = 'Please slow down — saving too fast.';
        return;
    }
    lastWriteAt = now;
    isProcessing = true;
    statusDisplay.textContent = 'Syncing to database...';

    try {
        const response = await fetch(BIN_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
            body: JSON.stringify({ links: linksData })
        });
        if (!response.ok) throw new Error("Failed to save");
        
        statusDisplay.textContent = 'Successfully Synced!';
        if(onSuccessCallback) onSuccessCallback();
        setTimeout(() => statusDisplay.textContent = '', 2000);
    } catch (error) {
        statusDisplay.textContent = 'Failed to sync! Try again later.';
        statusDisplay.style.color = 'var(--danger)';
    } finally {
        isProcessing = false;
    }
}


// ==========================================
// UI AND LOGIC
// ==========================================
document.querySelectorAll('input[name="itemType"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const urlInput = document.getElementById('linkUrl');
        const folderSelect = document.getElementById('linkFolder');
        const passInput = document.getElementById('linkPassword');
        
        if (this.value === 'folder') {
            urlInput.style.display = 'none'; urlInput.removeAttribute('required');
            passInput.style.display = 'none';
            folderSelect.style.display = 'none';
        } else {
            urlInput.style.display = 'inline-block'; urlInput.setAttribute('required', 'true');
            passInput.style.display = 'inline-block';
            folderSelect.style.display = 'inline-block';
        }
    });
});

function updateFormFolders() {
    const cat = document.getElementById('linkCat').value;
    const folderSelect = document.getElementById('linkFolder');
    folderSelect.innerHTML = '<option value="">-- No Folder (Root) --</option>';
    
    linksData.forEach(item => {
        if (item.type === 'folder' && item.category === cat) {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = `Folder: ${item.name}`;
            folderSelect.appendChild(opt);
        }
    });
}

function openFolder(folderId, folderName) {
    currentFolderId = folderId;
    document.getElementById('breadcrumbArea').style.display = 'flex';
    document.getElementById('currentFolderName').textContent = `Folder: ${folderName}`;
    renderLinks();
}

function closeFolder() {
    currentFolderId = null;
    document.getElementById('breadcrumbArea').style.display = 'none';
    renderLinks();
}

function setCategory(cat, btnElement) {
    currentCategory = cat;
    document.querySelectorAll('#filterContainer button').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    closeFolder(); 
}

// Security wrapper to check password before opening links
function handleLinkClick(item) {
    if (item.linkPass) {
        const entered = prompt("This link is locked. Enter password:");
        if (entered !== item.linkPass) {
            alert("Incorrect password!");
            return;
        }
    }
    
    // Proceed to open
    if (item.category === 'anime') {
        openViewer(item);
    } else {
        // Books & Games logic (No Viewer)
        incrementCount(item.id);
        window.open(item.url, '_blank', 'noopener,noreferrer');
    }
}

function renderLinks() {
    const list = document.getElementById('linkList');
    list.innerHTML = '';
    const query = document.getElementById('searchBar').value.toLowerCase().trim();

    let filtered = linksData.filter(item => {
        if (currentCategory !== 'all' && item.category !== currentCategory) return false;
        if (query && !item.name.toLowerCase().includes(query)) return false;
        if (!query) return currentFolderId ? item.folderId === currentFolderId : !item.folderId;
        return true;
    });

    filtered.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999999;
        const orderB = b.order !== undefined ? b.order : 999999;
        if (orderA !== orderB) return orderA - orderB; 
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    filtered.forEach(item => {
        const li = document.createElement('li');
        const mainRow = document.createElement('div');
        mainRow.className = 'li-main';

        const titleSpan = document.createElement('span');
        
        if (item.type === 'folder') {
            titleSpan.className = 'item-title folder';
            titleSpan.textContent = `Folder: ${item.name}`;
            titleSpan.onclick = () => openFolder(item.id, item.name);
            mainRow.appendChild(titleSpan);
        } else {
            // Anime gets play button, Games/Books get direct clickable text (no viewer for books now)
            if (item.category === 'anime') {
                titleSpan.className = 'item-title';
                titleSpan.textContent = item.name;
                
                const openBtn = document.createElement('button');
                openBtn.className = 'btn-play';
                openBtn.textContent = 'Play';
                openBtn.onclick = () => handleLinkClick(item);

                mainRow.appendChild(titleSpan);
                mainRow.appendChild(openBtn);
            } else {
                const openBtn = document.createElement('a');
                openBtn.className = 'item-link';
                openBtn.textContent = item.name;
                openBtn.onclick = (e) => {
                    e.preventDefault();
                    handleLinkClick(item);
                };
                mainRow.appendChild(openBtn);
            }
        }

        const span = document.createElement('span');
        span.className = 'cat-tag';
        const catNames = { 'anime': 'Anime/Movies', 'games': 'Games/Apps', 'books': 'Books/Edu' };
        span.textContent = catNames[item.category] || item.category;
        mainRow.appendChild(span);

        if (item.type !== 'folder') {
            const countSpan = document.createElement('span');
            countSpan.className = 'link-count';
            countSpan.textContent = `Opened: ${item.count || 0}`;
            mainRow.appendChild(countSpan);
            
            if(item.linkPass) {
                const lockSpan = document.createElement('span');
                lockSpan.className = 'cat-tag';
                lockSpan.textContent = 'Locked';
                lockSpan.style.color = 'var(--danger)';
                mainRow.appendChild(lockSpan);
            }
        }

        // Admin Row (Hidden by CSS for non-admins)
        const adminRow = document.createElement('div');
        adminRow.className = 'li-admin-row';

        const upBtn = document.createElement('button');
        upBtn.className = 'btn-reorder'; upBtn.textContent = 'Up';
        upBtn.onclick = () => moveItem(item.id, 'up');

        const downBtn = document.createElement('button');
        downBtn.className = 'btn-reorder'; downBtn.textContent = 'Down';
        downBtn.onclick = () => moveItem(item.id, 'down');

        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn-rename'; renameBtn.textContent = 'Rename';
        renameBtn.onclick = () => renameLink(item.id);
        
        adminRow.appendChild(upBtn);
        adminRow.appendChild(downBtn);
        adminRow.appendChild(renameBtn);

        if (item.type !== 'folder') {
            const setPassBtn = document.createElement('button');
            setPassBtn.className = 'btn-rename'; setPassBtn.textContent = 'Pass';
            setPassBtn.onclick = () => setLinkPassword(item.id);
            adminRow.appendChild(setPassBtn);
            
            const moveBtn = document.createElement('button');
            moveBtn.className = 'btn-move'; moveBtn.textContent = 'Move';
            moveBtn.onclick = () => openMoveModal(item.id);
            adminRow.appendChild(moveBtn);
        }

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-remove'; delBtn.textContent = 'Remove';
        delBtn.onclick = () => deleteLink(item.id);
        adminRow.appendChild(delBtn);

        li.appendChild(mainRow);
        li.appendChild(adminRow);
        list.appendChild(li);
    });

    if(list.innerHTML === '') {
        list.innerHTML = '<li style="justify-content: center; color: var(--text-muted);">No items found here</li>';
    }
}

// ==========================================
// FORM SUBMISSION (Add Folder / Link)
// ==========================================
document.getElementById('linkForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!checkAdmin()) return;
    
    const type = document.querySelector('input[name="itemType"]:checked').value;
    const nameInput = document.getElementById('linkName').value.trim().slice(0, 150);
    const cat = document.getElementById('linkCat').value;
    
    if (!nameInput) return alert("Name cannot be empty.");
    
    const newItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        type: type,
        name: nameInput,
        category: cat,
        order: Date.now() 
    };

    if (type === 'link') {
        let urlInput = document.getElementById('linkUrl').value.trim();
        let passInput = document.getElementById('linkPassword').value.trim();
        const folderId = document.getElementById('linkFolder').value;
        
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(urlInput)) urlInput = 'https://' + urlInput;
        newItem.url = urlInput;
        newItem.count = 0;
        if (passInput) newItem.linkPass = passInput;
        if (folderId) newItem.folderId = folderId;
    }

    linksData.push(newItem);
    
    if (type === 'folder') updateFormFolders();
    renderLinks();
    
    saveLinksToServer(() => {
        document.getElementById('linkName').value = '';
        document.getElementById('linkUrl').value = '';
        document.getElementById('linkPassword').value = '';
    });
});


// ==========================================
// ADMIN ACTIONS (Rename, Password, Remove, Move, Reorder)
// ==========================================
async function moveItem(id, direction) {
    if (!checkAdmin()) return;

    let displayList = linksData.filter(item => {
        if (currentCategory !== 'all' && item.category !== currentCategory) return false;
        if (currentFolderId) return item.folderId === currentFolderId;
        return !item.folderId;
    });

    displayList.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999999;
        const orderB = b.order !== undefined ? b.order : 999999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    displayList.forEach((item, index) => { item.order = index; });

    const currentIndex = displayList.findIndex(item => item.id === id);
    if (currentIndex < 0) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= displayList.length) return;

    const temp = displayList[currentIndex].order;
    displayList[currentIndex].order = displayList[targetIndex].order;
    displayList[targetIndex].order = temp;

    renderLinks();
    saveLinksToServer();
}

async function renameLink(id) {
    if (!checkAdmin()) return;
    const item = linksData.find(l => l.id === id);
    if (!item) return;
    const newName = prompt("Enter new name:", item.name);
    if (newName === null) return;
    const trimmed = newName.trim().slice(0, 150);
    if (!trimmed) return alert("Name cannot be empty.");
    item.name = trimmed;
    if (item.type === 'folder') updateFormFolders();
    renderLinks();
    saveLinksToServer();
}

function setLinkPassword(id) {
    if (!checkAdmin()) return;
    const item = linksData.find(l => l.id === id);
    if (!item) return;
    const newPass = prompt("Set password for this link (Leave blank to remove password):", item.linkPass || "");
    if (newPass !== null) {
        if (newPass.trim() === "") {
            delete item.linkPass;
        } else {
            item.linkPass = newPass.trim();
        }
        renderLinks();
        saveLinksToServer();
    }
}

async function deleteLink(id) {
    if (isProcessing) return;
    if (!checkAdmin()) return;

    const item = linksData.find(l => l.id === id);
    if (!item) return;

    pendingDeleteId = id;
    document.getElementById('confirmLinkName').textContent = item.name;
    document.getElementById('confirmOverlay').classList.add('open');
}

function closeConfirmDialog() {
    pendingDeleteId = null;
    document.getElementById('confirmOverlay').classList.remove('open');
}

document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
    if (!pendingDeleteId) return;
    const idToRemove = pendingDeleteId;
    
    linksData = linksData.filter(l => l.id !== idToRemove && l.folderId !== idToRemove);
    
    closeConfirmDialog();
    updateFormFolders();
    renderLinks();
    saveLinksToServer();
});

document.getElementById('confirmOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeConfirmDialog();
});

function incrementCount(id) {
    const item = linksData.find(l => l.id === id);
    if (!item) return;
    item.count = (item.count || 0) + 1;
    renderLinks();
    saveLinksToServer();
}

// Move logic
let pendingMoveId = null;

async function openMoveModal(id) {
    if (!checkAdmin()) return;
    
    const item = linksData.find(l => l.id === id);
    if (!item || item.type === 'folder') return; 

    pendingMoveId = id;
    document.getElementById('moveItemName').textContent = item.name;
    
    const select = document.getElementById('moveFolderSelect');
    select.innerHTML = '<option value="">-- No Folder (Root) --</option>';
    
    linksData.forEach(f => {
        if (f.type === 'folder' && f.category === item.category) {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = `Folder: ${f.name}`;
            if (item.folderId === f.id) opt.selected = true; 
            select.appendChild(opt);
        }
    });
    
    document.getElementById('moveOverlay').classList.add('open');
}

function closeMoveModal() {
    pendingMoveId = null;
    document.getElementById('moveOverlay').classList.remove('open');
}

document.getElementById('confirmMoveBtn').addEventListener('click', function() {
    if (!pendingMoveId) return;
    
    const item = linksData.find(l => l.id === pendingMoveId);
    const newFolderId = document.getElementById('moveFolderSelect').value;
    
    if (item) {
        if (newFolderId) {
            item.folderId = newFolderId;
        } else {
            delete item.folderId; 
        }
    }
    
    closeMoveModal();
    renderLinks();
    saveLinksToServer();
});

document.getElementById('moveOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeMoveModal();
});


// ==========================================
// VIEWER LOGIC (Only for Anime)
// ==========================================
const BLOCKED_EMBED_HOSTS = ['terabox.com', '1024terabox.com', 'teraboxapp.com', 'mediafire.com', 'mega.nz', 'dropbox.com'];

function getEmbedInfo(url) {
    const lower = url.toLowerCase();
    let hostname = '';
    try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}

    let m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return { type: 'iframe', src: `https://drive.google.com/file/d/${m[1]}/preview` };
    
    if (BLOCKED_EMBED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))) return { type: 'blocked', src: url };

    m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,})/);
    if (m) return { type: 'iframe', src: `https://www.youtube.com/embed/${m[1]}` };

    if (/\.(mp4|webm|ogg|mov|m3u8|mkv)(\?.*)?$/i.test(lower)) return { type: 'video', src: url };
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(lower)) return { type: 'image', src: url };
    if (/\.pdf(\?.*)?$/i.test(lower)) return { type: 'pdf', src: url };

    return { type: 'iframe', src: url, unknownHost: true };
}

function showViewerError(body, link, message) {
    body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'viewer-error';
    const p = document.createElement('p'); p.textContent = message;
    const a = document.createElement('a');
    a.href = link.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = 'Open in new tab instead';
    a.onclick = () => incrementCount(link.id);
    wrap.appendChild(p); wrap.appendChild(a); body.appendChild(wrap);
}

function openViewer(link) {
    if (!/^https?:\/\//i.test(link.url)) {
        alert("This link doesn't use a valid http(s) address and can't be opened.");
        return;
    }
    const overlay = document.getElementById('viewerOverlay');
    const body = document.getElementById('viewerBody');
    const title = document.getElementById('viewerTitle');

    title.textContent = link.name;
    body.innerHTML = '';
    const info = getEmbedInfo(link.url);

    if (info.type === 'blocked') {
        showViewerError(body, link, "This site blocks in-page viewing.");
        overlay.classList.add('open');
        return;
    }

    if (info.type === 'video') {
        const video = document.createElement('video');
        video.src = info.src; video.controls = true; video.autoplay = true;
        video.style.maxHeight = '80vh'; video.style.width = '100%';
        video.onerror = () => showViewerError(body, link, "This video couldn't be loaded directly.");
        body.appendChild(video);
    } else {
        const iframe = document.createElement('iframe');
        iframe.src = info.src;
        iframe.allowFullscreen = true;
        body.appendChild(iframe);
    }
    overlay.classList.add('open');
    incrementCount(link.id);
}

function closeViewer() {
    document.getElementById('viewerOverlay').classList.remove('open');
    document.getElementById('viewerBody').innerHTML = ''; 
}

// Initialize application
fetchLinks();