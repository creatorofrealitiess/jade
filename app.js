// ═══════════════════════════════════════════════════════
// JADE APP — Firebase Integration & Core Logic
// ═══════════════════════════════════════════════════════

const firebaseConfig = {
    apiKey: "AIzaSyD7R8It70KpDur4Rb_uGyxA_t1pKOUzC-A",
    authDomain: "jade-app-92996.firebaseapp.com",
    projectId: "jade-app-92996",
    storageBucket: "jade-app-92996.firebasestorage.app",
    messagingSenderId: "178718091311",
    appId: "1:178718091311:web:18a349919bbe4ec6cebeda"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
let currentUserName = '';
let currentUserAvatar = '';

// ═══════ AUTHENTICATION ═══════

let isSignUp = false;

document.getElementById('authToggleLink').addEventListener('click', () => {
    isSignUp = !isSignUp;
    document.getElementById('authDisplayName').style.display = isSignUp ? 'block' : 'none';
    document.getElementById('authSubmit').textContent = isSignUp ? 'Create Account' : 'Enter Jade';
    document.getElementById('authToggleText').textContent = isSignUp ? 'Already have an account?' : 'First time?';
    document.getElementById('authToggleLink').textContent = isSignUp ? 'Sign in' : 'Create account';
    document.getElementById('authError').textContent = '';
});

document.getElementById('authSubmit').addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const btn = document.getElementById('authSubmit');
    const errorEl = document.getElementById('authError');

    if (!email || !password) { errorEl.textContent = 'Please fill in all fields'; return; }

    btn.disabled = true;
    btn.textContent = isSignUp ? 'Creating...' : 'Entering...';
    errorEl.textContent = '';

    try {
        if (isSignUp) {
            const displayName = document.getElementById('authDisplayName').value.trim();
            if (!displayName) { errorEl.textContent = 'Please enter your Jade name'; btn.disabled = false; btn.textContent = 'Create Account'; return; }

            const cred = await auth.createUserWithEmailAndPassword(email, password);
            await cred.user.updateProfile({ displayName });
            await db.collection('users').doc(cred.user.uid).set({
                displayName, email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await auth.signInWithEmailAndPassword(email, password);
        }
    } catch (err) {
        const messages = {
            'auth/email-already-in-use': 'This email already has an account',
            'auth/invalid-email': 'Invalid email address',
            'auth/weak-password': 'Password should be at least 6 characters',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/invalid-credential': 'Invalid email or password',
            'auth/too-many-requests': 'Too many attempts. Try again later'
        };
        errorEl.textContent = messages[err.code] || err.message;
        btn.disabled = false;
        btn.textContent = isSignUp ? 'Create Account' : 'Enter Jade';
    }
});

document.querySelectorAll('#authForm .auth-input').forEach(input => {
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('authSubmit').click(); });
});

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        currentUserName = user.displayName || 'You';
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        document.getElementById('settingsEmail').textContent = user.email;
        document.getElementById('settingsName').textContent = currentUserName;

        // Load avatar from Firestore user doc
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists && userDoc.data().avatarUrl) {
                currentUserAvatar = userDoc.data().avatarUrl;
                showSettingsAvatar(currentUserAvatar, currentUserName);
            } else {
                showSettingsAvatar('', currentUserName);
            }
        } catch (e) {
            showSettingsAvatar('', currentUserName);
        }

        const savedKey = localStorage.getItem('jade_gemini_key');
        if (savedKey) document.getElementById('geminiApiKey').value = savedKey;

        initAffirmations();
        initAlignmentTracker();
        initJournal();
        initMessenger();
        initAnchors();
    } else {
        currentUser = null;
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    }
});

function showSettingsAvatar(url, name) {
    const img = document.getElementById('settingsAvatarImg');
    const initial = document.getElementById('settingsAvatarInitial');
    if (url) {
        img.src = url;
        img.style.display = 'block';
        initial.style.display = 'none';
    } else {
        img.style.display = 'none';
        initial.style.display = 'block';
        initial.textContent = (name || '?')[0].toUpperCase();
    }
}

function signOut() { if (confirm('Sign out of Jade?')) auth.signOut(); }

function saveGeminiKey() {
    const key = document.getElementById('geminiApiKey').value.trim();
    if (key) { localStorage.setItem('jade_gemini_key', key); alert('Gemini API key saved!'); }
}

async function updateDisplayName() {
    const newName = document.getElementById('settingsNameInput').value.trim();
    if (!newName) return;
    try {
        await currentUser.updateProfile({ displayName: newName });
        await db.collection('users').doc(currentUser.uid).update({ displayName: newName });
        currentUserName = newName;
        document.getElementById('settingsName').textContent = newName;
        document.getElementById('settingsNameInput').value = '';
        // Update cache for messenger
        if (userDataCache[currentUser.uid]) {
            userDataCache[currentUser.uid].name = newName;
        }
        showSettingsAvatar(currentUserAvatar, newName);
        alert('Name updated to ' + newName + '!');
    } catch (err) {
        alert('Error updating name: ' + err.message);
    }
}

document.getElementById('avatarUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please choose an image'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }

    const btn = document.querySelector('.settings-avatar-btn');
    btn.textContent = 'Uploading...';

    try {
        const ref = storage.ref('avatars/' + currentUser.uid);
        await ref.put(file);
        const url = await ref.getDownloadURL();
        await db.collection('users').doc(currentUser.uid).update({ avatarUrl: url });
        currentUserAvatar = url;
        showSettingsAvatar(url, currentUserName);
        // Refresh the user cache so messenger picks it up
        userDataCache[currentUser.uid] = { name: currentUserName, avatar: url };
        btn.textContent = 'Change Photo';
    } catch (err) {
        alert('Upload failed: ' + err.message);
        btn.textContent = 'Change Photo';
    }
});

// ═══════ NAVIGATION ═══════

const subtitles = {
    home: 'you are here now', world: "the world you've built", personas: 'who we are in jade',
    connections: 'your people', space: 'us, pets, home & the world', journal: 'write from within',
    messenger: 'conversations in jade', gallery: 'memories & moments', timeline: 'the story so far',
    anchors: 'pull yourself in', settings: 'configuration'
};

function nav(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (target) target.classList.add('active');
    document.getElementById('contentArea').scrollTop = 0;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector('.nav-item[data-nav="' + pageId + '"]');
    if (navItem) navItem.classList.add('active');

    document.getElementById('appSubtitle').textContent = subtitles[pageId] || 'you are here now';

    if (pageId === 'journal') journalShowList();
}

document.querySelectorAll('.feature-card[data-page]').forEach(c => c.addEventListener('click', () => nav(c.dataset.page)));
document.querySelectorAll('.nav-item[data-nav]').forEach(n => n.addEventListener('click', () => nav(n.dataset.nav)));

// ═══════ AFFIRMATIONS (Firestore synced) ═══════

const defaultAffirmations = [
    "I don't hope for Jade. I don't wish for it. I live it \u2014 it is simply where I am.",
    "The countryside is quiet this morning. I can hear the birds through the open window.",
    "Assumption is the bridge. I have already crossed it.",
    "I am not shifting. I have shifted. The old story is the dream.",
    "Every detail I add makes Jade more vivid, more solid, more mine.",
    "This is not imagination. This is memory \u2014 I am simply remembering what is.",
];

let affirmations = [...defaultAffirmations];
let currentAffIdx = 0;
let affirmationsUnsub = null;

function initAffirmations() {
    const ref = db.collection('shared').doc('affirmations');
    ref.get().then(doc => { if (!doc.exists) ref.set({ list: defaultAffirmations }); });

    if (affirmationsUnsub) affirmationsUnsub();
    affirmationsUnsub = ref.onSnapshot(doc => {
        if (doc.exists && doc.data().list) {
            affirmations = doc.data().list;
            if (currentAffIdx >= affirmations.length) currentAffIdx = 0;
            document.getElementById('affirmationText').textContent = '\u201C' + affirmations[currentAffIdx] + '\u201D';
        }
    });
}

function saveAffs() { db.collection('shared').doc('affirmations').set({ list: affirmations }); }

document.getElementById('affirmationBanner').addEventListener('click', (e) => {
    if (e.target.closest('#affirmationEditBtn')) return;
    if (affirmations.length === 0) return;
    currentAffIdx = (currentAffIdx + 1) % affirmations.length;
    const el = document.getElementById('affirmationText');
    el.style.transition = 'opacity 0.3s'; el.style.opacity = '0';
    setTimeout(() => { el.textContent = '\u201C' + affirmations[currentAffIdx] + '\u201D'; el.style.opacity = '1'; }, 300);
});

document.getElementById('affirmationEditBtn').addEventListener('click', (e) => {
    e.stopPropagation(); renderAffList();
    document.getElementById('affirmationModal').classList.add('visible');
});

document.getElementById('affirmationModalClose').addEventListener('click', () => document.getElementById('affirmationModal').classList.remove('visible'));
document.getElementById('affirmationModal').addEventListener('click', (e) => { if (e.target.id === 'affirmationModal') e.target.classList.remove('visible'); });

document.getElementById('addAffirmationBtn').addEventListener('click', () => {
    const input = document.getElementById('newAffirmation');
    const text = input.value.trim();
    if (!text) return;
    affirmations.push(text); saveAffs();
    input.value = ''; renderAffList();
});

function renderAffList() {
    const container = document.getElementById('affirmationList');
    container.innerHTML = '';
    affirmations.forEach((text, i) => {
        const item = document.createElement('div');
        item.className = 'affirmation-list-item';
        item.innerHTML = '<textarea class="affirmation-text" rows="2" data-index="' + i + '">' + text + '</textarea><button class="affirmation-delete-btn" data-index="' + i + '">\u00D7</button>';
        container.appendChild(item);
    });

    container.querySelectorAll('.affirmation-text').forEach(ta => {
        ta.addEventListener('blur', () => {
            const idx = parseInt(ta.dataset.index);
            const t = ta.value.trim();
            if (t && t !== affirmations[idx]) { affirmations[idx] = t; saveAffs(); }
        });
        ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
        setTimeout(() => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }, 10);
    });

    container.querySelectorAll('.affirmation-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (affirmations.length <= 1) return;
            affirmations.splice(parseInt(btn.dataset.index), 1);
            saveAffs(); renderAffList();
        });
    });
}

// ═══════ ALIGNMENT TRACKER (Firestore synced) ═══════

let alignmentData = {};

function initAlignmentTracker() {
    const today = new Date().toISOString().split('T')[0];
    db.collection('shared').doc('alignment').onSnapshot(doc => {
        if (doc.exists) {
            alignmentData = doc.data();
            if (alignmentData[today]) fillAlignment(alignmentData[today]);
            renderAlignmentChart();
        }
    });
}

function fillAlignment(level) {
    document.querySelectorAll('#alignmentScale .alignment-dot').forEach(d => {
        d.classList.toggle('filled', parseInt(d.dataset.level) <= level);
    });
}

document.getElementById('alignmentScale').addEventListener('click', (e) => {
    const dot = e.target.closest('.alignment-dot');
    if (!dot) return;
    const level = parseInt(dot.dataset.level);
    fillAlignment(level);
    const today = new Date().toISOString().split('T')[0];
    db.collection('shared').doc('alignment').set({ [today]: level }, { merge: true });
});

document.getElementById('alignmentHistoryToggle').addEventListener('click', () => {
    const chart = document.getElementById('alignmentChart');
    const btn = document.getElementById('alignmentHistoryToggle');
    if (chart.style.display === 'none') {
        chart.style.display = 'flex';
        btn.textContent = 'hide';
        renderAlignmentChart();
    } else {
        chart.style.display = 'none';
        btn.textContent = 'show';
    }
});

function renderAlignmentChart() {
    const chart = document.getElementById('alignmentChart');
    if (chart.style.display === 'none') return;
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        days.push({
            date: dateStr,
            label: dayNames[d.getDay()],
            level: alignmentData[dateStr] || 0,
            isToday: dateStr === todayStr
        });
    }
    
    chart.innerHTML = days.map(day => {
        const heightPct = day.level > 0 ? (day.level / 7) * 100 : 0;
        const barClass = day.level === 0 ? 'alignment-chart-bar empty' : ('alignment-chart-bar' + (day.isToday ? ' today' : ''));
        const labelClass = 'alignment-chart-label' + (day.isToday ? ' today' : '');
        return '<div class="alignment-chart-day">' +
            '<div class="alignment-chart-bar-wrap"><div class="' + barClass + '" style="height:' + (day.level > 0 ? heightPct + '%' : '2px') + '"></div></div>' +
            '<span class="' + labelClass + '">' + day.label + '</span></div>';
    }).join('');
}

// ═══════ JOURNAL (Firestore synced) ═══════

let journalEntries = [];
let editingJournalId = null;
let journalUnsub = null;

function initJournal() {
    if (journalUnsub) journalUnsub();
    journalUnsub = db.collection('journal').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        journalEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderJournalList();
    });
}

function renderJournalList() {
    const container = document.getElementById('journalList');
    if (journalEntries.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">\uD83D\uDCD6</div><p>No entries yet. Tap + to write your first moment from within Jade.</p></div>';
        return;
    }
    container.innerHTML = journalEntries.map(entry => {
        const date = entry.createdAt ? new Date(entry.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Just now';
        return '<div class="journal-entry-card" onclick="journalOpen(\'' + entry.id + '\')">' +
            '<div class="journal-entry-date">' + date + '</div>' +
            '<div class="journal-entry-title">' + (entry.title || 'Untitled') + '</div>' +
            '<div class="journal-entry-preview">' + (entry.body || '') + '</div>' +
            '<div class="journal-entry-author">\u2014 ' + (entry.authorName || 'Unknown') + '</div></div>';
    }).join('');
}

function journalShowList() {
    document.getElementById('journalList').style.display = 'block';
    document.getElementById('journalEditor').classList.remove('active');
    document.getElementById('journalNewBtn').style.display = 'flex';
    document.getElementById('journalTitle').textContent = 'Journal';
    document.getElementById('journalDeleteBtn').style.display = 'none';
    editingJournalId = null;
}

function journalNew() {
    editingJournalId = null;
    document.getElementById('journalEditorTitle').value = '';
    document.getElementById('journalEditorBody').value = '';
    document.getElementById('journalList').style.display = 'none';
    document.getElementById('journalEditor').classList.add('active');
    document.getElementById('journalNewBtn').style.display = 'none';
    document.getElementById('journalTitle').textContent = 'New Entry';
    document.getElementById('journalDeleteBtn').style.display = 'none';
    document.getElementById('journalEditorTitle').focus();
}

function journalOpen(id) {
    const entry = journalEntries.find(e => e.id === id);
    if (!entry) return;
    editingJournalId = id;
    document.getElementById('journalEditorTitle').value = entry.title || '';
    document.getElementById('journalEditorBody').value = entry.body || '';
    document.getElementById('journalList').style.display = 'none';
    document.getElementById('journalEditor').classList.add('active');
    document.getElementById('journalNewBtn').style.display = 'none';
    document.getElementById('journalTitle').textContent = 'Edit Entry';
    document.getElementById('journalDeleteBtn').style.display = 'inline-block';
}

function journalBack() {
    if (document.getElementById('journalEditor').classList.contains('active')) { journalShowList(); }
    else { nav('home'); }
}

function journalCancel() { journalShowList(); }

async function journalSave() {
    const title = document.getElementById('journalEditorTitle').value.trim();
    const body = document.getElementById('journalEditorBody').value.trim();
    if (!title && !body) return;

    const data = {
        title, body,
        authorId: currentUser.uid,
        authorName: currentUserName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editingJournalId) {
        await db.collection('journal').doc(editingJournalId).update(data);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('journal').add(data);
    }
    journalShowList();
}

async function journalDelete() {
    if (!editingJournalId) return;
    if (!confirm('Delete this entry?')) return;
    await db.collection('journal').doc(editingJournalId).delete();
    journalShowList();
}

// ═══════ MESSENGER (Firestore real-time) ═══════

let messengerUnsub = null;
let userDataCache = {};

async function loadUserData() {
    const snapshot = await db.collection('users').get();
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        userDataCache[doc.id] = {
            name: data.displayName || 'Unknown',
            avatar: data.avatarUrl || ''
        };
    });
}

function buildAvatarHtml(uid, name) {
    const userData = userDataCache[uid];
    const avatarUrl = userData ? userData.avatar : '';
    const displayName = userData ? userData.name : (name || '?');
    
    if (avatarUrl) {
        return '<div class="msg-avatar"><img src="' + avatarUrl + '" alt=""></div>';
    } else {
        return '<div class="msg-avatar"><span class="msg-avatar-initial">' + displayName[0].toUpperCase() + '</span></div>';
    }
}

function initMessenger() {
    if (messengerUnsub) messengerUnsub();
    
    loadUserData().then(() => {
        messengerUnsub = db.collection('messages').orderBy('sentAt', 'asc').limitToLast(100).onSnapshot(snapshot => {
            const container = document.getElementById('messengerMessages');
            container.innerHTML = '';

            if (snapshot.empty) {
                container.innerHTML = '<div class="empty-state" style="padding-top:60px"><div class="empty-state-icon">\uD83D\uDCAC</div><p>Start talking as your Jade selves. This is your space together.</p></div>';
                return;
            }

            snapshot.docs.forEach(doc => {
                const msg = doc.data();
                const isMine = msg.senderId === currentUser.uid;
                const time = msg.sentAt ? new Date(msg.sentAt.seconds * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
                
                const row = document.createElement('div');
                row.className = 'msg-row ' + (isMine ? 'sent' : 'received');
                
                const avatarHtml = buildAvatarHtml(msg.senderId, msg.senderName);
                
                let msgHtml = '';
                if (!isMine) {
                    const senderName = (userDataCache[msg.senderId] ? userDataCache[msg.senderId].name : null) || msg.senderName || 'Unknown';
                    msgHtml += '<span class="msg-sender">' + senderName.replace(/</g, '&lt;') + '</span>';
                }
                const safeText = document.createElement('span');
                safeText.textContent = msg.text;
                msgHtml += safeText.innerHTML;
                msgHtml += '<span class="msg-time">' + time + '</span>';
                
                row.innerHTML = avatarHtml + '<div class="msg ' + (isMine ? 'sent' : 'received') + '">' + msgHtml + '</div>';
                container.appendChild(row);
            });

            container.scrollTop = container.scrollHeight;
        });
    });
}

async function sendMessage() {
    const input = document.getElementById('messengerInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await db.collection('messages').add({
        text, senderId: currentUser.uid, senderName: currentUserName,
        sentAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

document.getElementById('messengerSend').addEventListener('click', sendMessage);
document.getElementById('messengerInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

// ═══════ SENSORY ANCHORS (Firestore synced) ═══════

let anchorsData = { playlists: [], palettes: [], scents: [] };
let anchorsUnsub = null;
let paletteBuilderColours = [];

function initAnchors() {
    const ref = db.collection('shared').doc('anchors');
    ref.get().then(doc => { if (!doc.exists) ref.set({ playlists: [], palettes: [], scents: [] }); });

    if (anchorsUnsub) anchorsUnsub();
    anchorsUnsub = ref.onSnapshot(doc => {
        if (doc.exists) {
            anchorsData = {
                playlists: doc.data().playlists || [],
                palettes: doc.data().palettes || [],
                scents: doc.data().scents || []
            };
            renderPlaylists();
            renderPalettes();
            renderScents();
        }
    });
}

function saveAnchors() { db.collection('shared').doc('anchors').set(anchorsData); }

// ── Tabs ──
function anchorsTab(tab) {
    document.querySelectorAll('.anchors-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.anchors-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('anchorsPanel-' + tab).classList.add('active');
}

// ── Playlists ──
function extractSpotifyId(url) {
    // Handle various Spotify URL formats
    const patterns = [
        /spotify\.com\/playlist\/([a-zA-Z0-9]+)/,
        /spotify\.com\/embed\/playlist\/([a-zA-Z0-9]+)/,
        /spotify:playlist:([a-zA-Z0-9]+)/
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

function addPlaylist() {
    const urlInput = document.getElementById('playlistUrlInput');
    const nameInput = document.getElementById('playlistNameInput');
    const url = urlInput.value.trim();
    const name = nameInput.value.trim();

    if (!url) return;
    const playlistId = extractSpotifyId(url);
    if (!playlistId) { alert('Please paste a valid Spotify playlist URL'); return; }

    anchorsData.playlists.push({
        id: playlistId,
        name: name || 'Untitled Playlist',
        addedBy: currentUserName,
        addedAt: Date.now()
    });
    saveAnchors();
    urlInput.value = '';
    nameInput.value = '';
}

function removePlaylist(idx) {
    anchorsData.playlists.splice(idx, 1);
    saveAnchors();
}

function renderPlaylists() {
    const container = document.getElementById('playlistsList');
    if (anchorsData.playlists.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:var(--space-xl) 0"><div class="empty-state-icon">&#127925;</div><p>No playlists yet. Paste a Spotify URL to add your first anchor.</p></div>';
        return;
    }
    container.innerHTML = anchorsData.playlists.map((pl, i) =>
        '<div class="anchor-card playlist-card">' +
            '<div class="anchor-card-header">' +
                '<div><div class="anchor-card-title">' + escapeHtml(pl.name) + '</div>' +
                '<div class="anchor-card-meta">added by ' + escapeHtml(pl.addedBy || 'unknown') + '</div></div>' +
                '<button class="affirmation-delete-btn" onclick="removePlaylist(' + i + ')" title="Remove">&times;</button>' +
            '</div>' +
            '<div class="playlist-embed">' +
                '<iframe src="https://open.spotify.com/embed/playlist/' + pl.id + '?utm_source=generator&theme=0" ' +
                'width="100%" height="152" frameBorder="0" allowfullscreen="" ' +
                'allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>' +
            '</div>' +
        '</div>'
    ).join('');
}

// ── Colour Palettes ──
function addPaletteColour() {
    if (paletteBuilderColours.length >= 8) return;
    const colour = document.getElementById('paletteColourPicker').value;
    paletteBuilderColours.push(colour);
    renderPaletteBuilder();
}

function removePaletteBuilderColour(idx) {
    paletteBuilderColours.splice(idx, 1);
    renderPaletteBuilder();
}

function renderPaletteBuilder() {
    const container = document.getElementById('paletteBuilderColours');
    container.innerHTML = paletteBuilderColours.map((c, i) =>
        '<div class="palette-builder-swatch" style="background:' + c + '" onclick="removePaletteBuilderColour(' + i + ')" title="Tap to remove">' +
            '<span class="palette-swatch-x">&times;</span>' +
        '</div>'
    ).join('');
}

function savePalette() {
    const nameInput = document.getElementById('paletteNameInput');
    const name = nameInput.value.trim();
    if (paletteBuilderColours.length < 2) { alert('Add at least 2 colours'); return; }

    anchorsData.palettes.push({
        name: name || 'Untitled Palette',
        colours: [...paletteBuilderColours],
        addedBy: currentUserName,
        addedAt: Date.now()
    });
    saveAnchors();
    nameInput.value = '';
    paletteBuilderColours = [];
    renderPaletteBuilder();
}

function removePalette(idx) {
    anchorsData.palettes.splice(idx, 1);
    saveAnchors();
}

function renderPalettes() {
    const container = document.getElementById('palettesList');
    if (anchorsData.palettes.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:var(--space-xl) 0"><div class="empty-state-icon">&#127912;</div><p>No palettes yet. Pick colours that feel like Jade.</p></div>';
        return;
    }
    container.innerHTML = anchorsData.palettes.map((pal, i) =>
        '<div class="anchor-card palette-card">' +
            '<div class="anchor-card-header">' +
                '<div><div class="anchor-card-title">' + escapeHtml(pal.name) + '</div>' +
                '<div class="anchor-card-meta">by ' + escapeHtml(pal.addedBy || 'unknown') + '</div></div>' +
                '<button class="affirmation-delete-btn" onclick="removePalette(' + i + ')" title="Remove">&times;</button>' +
            '</div>' +
            '<div class="palette-swatches">' +
                (pal.colours || []).map(c =>
                    '<div class="palette-swatch" style="background:' + c + '" onclick="copyColour(\'' + c + '\')" title="' + c + '">' +
                        '<span class="palette-swatch-hex">' + c + '</span>' +
                    '</div>'
                ).join('') +
            '</div>' +
        '</div>'
    ).join('');
}

function copyColour(hex) {
    navigator.clipboard.writeText(hex).then(() => {
        // Brief visual feedback — we could do a toast but let's keep it simple
    }).catch(() => {});
}

// ── Scent Notes ──
function addScent() {
    const titleInput = document.getElementById('scentTitleInput');
    const bodyInput = document.getElementById('scentBodyInput');
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    if (!title && !body) return;

    anchorsData.scents.push({
        title: title || 'Untitled',
        body: body || '',
        addedBy: currentUserName,
        addedAt: Date.now()
    });
    saveAnchors();
    titleInput.value = '';
    bodyInput.value = '';
}

function removeScent(idx) {
    anchorsData.scents.splice(idx, 1);
    saveAnchors();
}

function renderScents() {
    const container = document.getElementById('scentsList');
    if (anchorsData.scents.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:var(--space-xl) 0"><div class="empty-state-icon">&#128367;&#65039;</div><p>No scent notes yet. Describe the scents that bring you home.</p></div>';
        return;
    }
    container.innerHTML = anchorsData.scents.map((s, i) =>
        '<div class="anchor-card scent-card">' +
            '<div class="anchor-card-header">' +
                '<div><div class="anchor-card-title">' + escapeHtml(s.title) + '</div>' +
                '<div class="anchor-card-meta">by ' + escapeHtml(s.addedBy || 'unknown') + '</div></div>' +
                '<button class="affirmation-delete-btn" onclick="removeScent(' + i + ')" title="Remove">&times;</button>' +
            '</div>' +
            (s.body ? '<p class="scent-body">' + escapeHtml(s.body) + '</p>' : '') +
        '</div>'
    ).join('');
}

// ── Utility ──
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ═══════ SERVICE WORKER & PWA ═══════

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(() => {}); }
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });
