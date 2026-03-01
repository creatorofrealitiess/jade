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
        initPersonas();
        initConnections();
        initWorld();
        initSpace();
        initScenes();
        initTimeline();
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
    connections: 'your people', space: 'memories & moments', journal: 'write from within',
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
    if (pageId === 'personas') personasShowList();
    if (pageId === 'connections') connectionsShowList();
    if (pageId === 'world') worldShowList();
    if (pageId === 'space') spaceShowAlbums();
    if (pageId === 'gallery') sceneShowList();
    if (pageId === 'timeline') timelineShowList();
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

let msgLongPressTimer = null;

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
            
            const row = document.createElement('div');
            row.className = 'msg-row ' + (isMine ? 'sent' : 'received');
            
            // Avatar
            const avatarDiv = document.createElement('div');
            avatarDiv.innerHTML = buildAvatarHtml(msg.senderId, msg.senderName);
            row.appendChild(avatarDiv.firstChild);
            
            const safeText = document.createElement('span');
            safeText.textContent = msg.text;
            
            const bubble = document.createElement('div');
            bubble.className = 'msg ' + (isMine ? 'sent' : 'received');
            bubble.innerHTML = safeText.innerHTML;
            
            // Long-press to delete (works for both sisters)
            let timer = null;
            const startPress = (e) => {
                timer = setTimeout(() => {
                    if (confirm('Delete this message?')) {
                        db.collection('messages').doc(doc.id).delete();
                    }
                }, 500);
            };
            const cancelPress = () => { if (timer) clearTimeout(timer); };
            
            bubble.addEventListener('touchstart', startPress, { passive: true });
            bubble.addEventListener('touchend', cancelPress);
            bubble.addEventListener('touchmove', cancelPress);
            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (confirm('Delete this message?')) {
                    db.collection('messages').doc(doc.id).delete();
                }
            });
            
            row.appendChild(bubble);
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

// ═══════ PERSONAS (Firestore synced) ═══════

let personasData = [];
let personasUnsub = null;
let editingPersonaId = null;
let personaEditorExtras = [];
let personaPhotoFile = null;
let personaPhotoPreview = '';

function initPersonas() {
    if (personasUnsub) personasUnsub();
    personasUnsub = db.collection('personas').orderBy('createdAt', 'asc').onSnapshot(snapshot => {
        personasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderPersonasList();
    });
}

function renderPersonasList() {
    const container = document.getElementById('personasList');
    if (personasData.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#129695;</div><p>No personas yet. Tap + to define your Jade self.</p></div>';
        return;
    }
    container.innerHTML = personasData.map(p => {
        const avatarHtml = p.photoUrl
            ? '<img src="' + p.photoUrl + '" alt="">'
            : '<span>' + (p.name || '?')[0].toUpperCase() + '</span>';
        return '<div class="persona-card" onclick="personaOpen(\'' + p.id + '\')">' +
            '<div class="persona-card-avatar">' + avatarHtml + '</div>' +
            '<div class="persona-card-info">' +
                '<div class="persona-card-name">' + escapeHtml(p.name || 'Unnamed') + '</div>' +
                (p.age ? '<div class="persona-card-age">' + escapeHtml(p.age) + '</div>' : '') +
                (p.personality ? '<div class="persona-card-preview">' + escapeHtml(p.personality) + '</div>' : '') +
            '</div>' +
            '<div class="persona-card-arrow">&rsaquo;</div>' +
        '</div>';
    }).join('');
}

// ── Views ──
function personasShowList() {
    document.getElementById('personasList').style.display = 'block';
    document.getElementById('personaDetail').style.display = 'none';
    document.getElementById('personaEditor').style.display = 'none';
    document.getElementById('personasNewBtn').style.display = 'flex';
    document.getElementById('personasTitle').textContent = 'Personas';
    editingPersonaId = null;
}

function personasBack() {
    if (document.getElementById('personaEditor').style.display !== 'none') {
        personaCancelEdit();
    } else if (document.getElementById('personaDetail').style.display !== 'none') {
        personasShowList();
    } else {
        nav('home');
    }
}

function personaOpen(id) {
    const p = personasData.find(x => x.id === id);
    if (!p) return;
    editingPersonaId = id;

    // Avatar
    const img = document.getElementById('personaDetailAvatarImg');
    const initial = document.getElementById('personaDetailAvatarInitial');
    if (p.photoUrl) {
        img.src = p.photoUrl; img.style.display = 'block'; initial.style.display = 'none';
    } else {
        img.style.display = 'none'; initial.style.display = 'block';
        initial.textContent = (p.name || '?')[0].toUpperCase();
    }

    document.getElementById('personaDetailName').textContent = p.name || 'Unnamed';
    document.getElementById('personaDetailAge').textContent = p.age ? 'Age ' + p.age : '';

    // Render fixed fields
    const fixedFields = [
        { label: 'Appearance', value: p.appearance },
        { label: 'Personality', value: p.personality },
        { label: 'Daily Life', value: p.dailyLife },
        { label: 'Style', value: p.style },
        { label: 'Backstory', value: p.backstory }
    ];

    const extras = p.extras || [];
    const allFields = [...fixedFields, ...extras.map(e => ({ label: e.label, value: e.value }))];

    document.getElementById('personaDetailFields').innerHTML = allFields
        .filter(f => f.value)
        .map(f =>
            '<div class="persona-detail-field">' +
                '<div class="persona-detail-field-label">' + escapeHtml(f.label) + '</div>' +
                '<div class="persona-detail-field-value">' + escapeHtml(f.value) + '</div>' +
            '</div>'
        ).join('');

    document.getElementById('personasList').style.display = 'none';
    document.getElementById('personaDetail').style.display = 'block';
    document.getElementById('personaEditor').style.display = 'none';
    document.getElementById('personasNewBtn').style.display = 'none';
    document.getElementById('personasTitle').textContent = p.name || 'Persona';
}

// ── Editor ──
function personaNew() {
    editingPersonaId = null;
    personaPhotoFile = null;
    personaPhotoPreview = '';
    clearPersonaEditor();
    showPersonaEditorAvatar('', '?');
    document.getElementById('personasList').style.display = 'none';
    document.getElementById('personaDetail').style.display = 'none';
    document.getElementById('personaEditor').style.display = 'block';
    document.getElementById('personasNewBtn').style.display = 'none';
    document.getElementById('personasTitle').textContent = 'New Persona';
}

function personaEdit() {
    const p = personasData.find(x => x.id === editingPersonaId);
    if (!p) return;
    personaPhotoFile = null;
    personaPhotoPreview = p.photoUrl || '';

    document.getElementById('personaEdName').value = p.name || '';
    document.getElementById('personaEdAge').value = p.age || '';
    document.getElementById('personaEdAppearance').value = p.appearance || '';
    document.getElementById('personaEdPersonality').value = p.personality || '';
    document.getElementById('personaEdDailyLife').value = p.dailyLife || '';
    document.getElementById('personaEdStyle').value = p.style || '';
    document.getElementById('personaEdBackstory').value = p.backstory || '';
    personaEditorExtras = (p.extras || []).map(e => ({ ...e }));
    renderPersonaExtras();

    showPersonaEditorAvatar(p.photoUrl || '', p.name || '?');

    document.getElementById('personaDetail').style.display = 'none';
    document.getElementById('personaEditor').style.display = 'block';
    document.getElementById('personasTitle').textContent = 'Edit Persona';
}

function clearPersonaEditor() {
    document.getElementById('personaEdName').value = '';
    document.getElementById('personaEdAge').value = '';
    document.getElementById('personaEdAppearance').value = '';
    document.getElementById('personaEdPersonality').value = '';
    document.getElementById('personaEdDailyLife').value = '';
    document.getElementById('personaEdStyle').value = '';
    document.getElementById('personaEdBackstory').value = '';
    personaEditorExtras = [];
    renderPersonaExtras();
}

function showPersonaEditorAvatar(url, name) {
    const img = document.getElementById('personaEditorAvatarImg');
    const initial = document.getElementById('personaEditorAvatarInitial');
    if (url) {
        img.src = url; img.style.display = 'block'; initial.style.display = 'none';
    } else {
        img.style.display = 'none'; initial.style.display = 'block';
        initial.textContent = (name || '?')[0].toUpperCase();
    }
}

function personaCancelEdit() {
    if (editingPersonaId) {
        personaOpen(editingPersonaId);
    } else {
        personasShowList();
    }
}

// ── Extras ──
function personaAddExtra() {
    personaEditorExtras.push({ label: '', value: '' });
    renderPersonaExtras();
    // Focus the new label input
    setTimeout(() => {
        const labels = document.querySelectorAll('.persona-extra-label');
        if (labels.length) labels[labels.length - 1].focus();
    }, 50);
}

function personaRemoveExtra(idx) {
    personaEditorExtras.splice(idx, 1);
    renderPersonaExtras();
}

function renderPersonaExtras() {
    const container = document.getElementById('personaExtras');
    container.innerHTML = personaEditorExtras.map((e, i) =>
        '<div class="persona-extra-item">' +
            '<div class="persona-extra-item-header">' +
                '<input class="auth-input persona-extra-label" data-idx="' + i + '" placeholder="Field name..." value="' + escapeHtml(e.label) + '">' +
                '<button class="affirmation-delete-btn" onclick="personaRemoveExtra(' + i + ')">&times;</button>' +
            '</div>' +
            '<textarea class="auth-input persona-extra-value" data-idx="' + i + '" placeholder="Write freely..." rows="2">' + escapeHtml(e.value) + '</textarea>' +
        '</div>'
    ).join('');

    // Sync values on input
    container.querySelectorAll('.persona-extra-label').forEach(el => {
        el.addEventListener('input', () => { personaEditorExtras[parseInt(el.dataset.idx)].label = el.value; });
    });
    container.querySelectorAll('.persona-extra-value').forEach(el => {
        el.addEventListener('input', () => { personaEditorExtras[parseInt(el.dataset.idx)].value = el.value; });
    });
}

// ── Photo Upload ──
document.getElementById('personaPhotoUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please choose an image'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    personaPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        personaPhotoPreview = ev.target.result;
        showPersonaEditorAvatar(personaPhotoPreview, document.getElementById('personaEdName').value || '?');
    };
    reader.readAsDataURL(file);
});

// Update initial as name is typed
document.getElementById('personaEdName').addEventListener('input', (e) => {
    if (!personaPhotoPreview) {
        const initial = document.getElementById('personaEditorAvatarInitial');
        initial.textContent = (e.target.value || '?')[0].toUpperCase();
    }
});

// ── Save & Delete ──
async function personaSave() {
    const name = document.getElementById('personaEdName').value.trim();
    if (!name) { alert('Give your persona a name'); return; }

    let photoUrl = personaPhotoPreview || '';

    // Upload new photo if selected
    if (personaPhotoFile) {
        try {
            const photoId = editingPersonaId || ('persona_' + Date.now());
            const ref = storage.ref('personas/' + photoId);
            await ref.put(personaPhotoFile);
            photoUrl = await ref.getDownloadURL();
        } catch (err) {
            alert('Photo upload failed: ' + err.message);
            return;
        }
    }

    const data = {
        name,
        age: document.getElementById('personaEdAge').value.trim(),
        appearance: document.getElementById('personaEdAppearance').value.trim(),
        personality: document.getElementById('personaEdPersonality').value.trim(),
        dailyLife: document.getElementById('personaEdDailyLife').value.trim(),
        style: document.getElementById('personaEdStyle').value.trim(),
        backstory: document.getElementById('personaEdBackstory').value.trim(),
        extras: personaEditorExtras.filter(e => e.label.trim() || e.value.trim()),
        photoUrl,
        authorId: currentUser.uid,
        authorName: currentUserName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editingPersonaId) {
        await db.collection('personas').doc(editingPersonaId).update(data);
        personaOpen(editingPersonaId);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const docRef = await db.collection('personas').add(data);
        editingPersonaId = docRef.id;
        personaOpen(docRef.id);
    }
}

async function personaDelete() {
    if (!editingPersonaId) return;
    if (!confirm('Delete this persona?')) return;
    await db.collection('personas').doc(editingPersonaId).delete();
    personasShowList();
}

// ═══════ CONNECTIONS (Firestore synced) ═══════

let connectionsData = [];
let connectionsUnsub = null;
let editingConnectionId = null;
let connectionEditorExtras = [];
let connectionPhotoFile = null;
let connectionPhotoPreview = '';
let connectionSelectedType = '';
let connectionsFilter = 'all';

function initConnections() {
    if (connectionsUnsub) connectionsUnsub();
    connectionsUnsub = db.collection('connections').orderBy('createdAt', 'asc').onSnapshot(snapshot => {
        connectionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderConnectionsList();
    });
}

function renderConnectionsList() {
    const container = document.getElementById('connectionsList');
    const filtered = connectionsFilter === 'all'
        ? connectionsData
        : connectionsData.filter(c => c.type === connectionsFilter);

    if (connectionsData.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#128154;</div><p>No connections yet. Tap + to add the first soul in your Jade world.</p></div>';
        return;
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:var(--space-xl) 0"><p>No ' + connectionsFilter + 's yet.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(c => {
        const avatarHtml = c.photoUrl
            ? '<img src="' + c.photoUrl + '" alt="">'
            : '<span>' + (c.name || '?')[0].toUpperCase() + '</span>';
        return '<div class="persona-card" onclick="connectionOpen(\'' + c.id + '\')">' +
            '<div class="persona-card-avatar">' + avatarHtml + '</div>' +
            '<div class="persona-card-info">' +
                '<div class="persona-card-name">' + escapeHtml(c.name || 'Unnamed') + '</div>' +
                '<div class="persona-card-age">' + escapeHtml(c.type || '') + (c.age ? ' · ' + escapeHtml(c.age) : '') + '</div>' +
                (c.relationship ? '<div class="persona-card-preview">' + escapeHtml(c.relationship) + '</div>' : '') +
            '</div>' +
            '<div class="persona-card-arrow">&rsaquo;</div>' +
        '</div>';
    }).join('');
}

function filterConnections(type) {
    connectionsFilter = type;
    document.querySelectorAll('.connections-filter').forEach(f => f.classList.toggle('active', f.dataset.filter === type));
    renderConnectionsList();
}

// ── Views ──
function connectionsShowList() {
    document.getElementById('connectionsList').style.display = 'block';
    document.getElementById('connectionDetail').style.display = 'none';
    document.getElementById('connectionEditor').style.display = 'none';
    document.getElementById('connectionsNewBtn').style.display = 'flex';
    document.getElementById('connectionsFilters').style.display = 'flex';
    document.getElementById('connectionsTitle').textContent = 'Connections';
    editingConnectionId = null;
}

function connectionsBack() {
    if (document.getElementById('connectionEditor').style.display !== 'none') {
        connectionCancelEdit();
    } else if (document.getElementById('connectionDetail').style.display !== 'none') {
        connectionsShowList();
    } else {
        nav('home');
    }
}

function connectionOpen(id) {
    const c = connectionsData.find(x => x.id === id);
    if (!c) return;
    editingConnectionId = id;

    const img = document.getElementById('connectionDetailAvatarImg');
    const initial = document.getElementById('connectionDetailAvatarInitial');
    if (c.photoUrl) {
        img.src = c.photoUrl; img.style.display = 'block'; initial.style.display = 'none';
    } else {
        img.style.display = 'none'; initial.style.display = 'block';
        initial.textContent = (c.name || '?')[0].toUpperCase();
    }

    document.getElementById('connectionDetailName').textContent = c.name || 'Unnamed';
    document.getElementById('connectionDetailAge').textContent = c.age ? 'Age ' + c.age : '';

    const tagEl = document.getElementById('connectionDetailTag');
    if (c.type) {
        tagEl.textContent = c.type;
        tagEl.className = 'connection-tag connection-tag-' + c.type.replace(/\s+/g, '-');
        tagEl.style.display = 'inline-block';
    } else {
        tagEl.style.display = 'none';
    }

    const fixedFields = [
        { label: 'Relationship', value: c.relationship },
        { label: 'Appearance', value: c.appearance },
        { label: 'Personality', value: c.personality },
        { label: 'Daily Life', value: c.dailyLife },
        { label: 'Style', value: c.style },
        { label: 'Backstory', value: c.backstory }
    ];

    const extras = c.extras || [];
    const allFields = [...fixedFields, ...extras.map(e => ({ label: e.label, value: e.value }))];

    document.getElementById('connectionDetailFields').innerHTML = allFields
        .filter(f => f.value)
        .map(f =>
            '<div class="persona-detail-field">' +
                '<div class="persona-detail-field-label">' + escapeHtml(f.label) + '</div>' +
                '<div class="persona-detail-field-value">' + escapeHtml(f.value) + '</div>' +
            '</div>'
        ).join('');

    document.getElementById('connectionsList').style.display = 'none';
    document.getElementById('connectionDetail').style.display = 'block';
    document.getElementById('connectionEditor').style.display = 'none';
    document.getElementById('connectionsNewBtn').style.display = 'none';
    document.getElementById('connectionsFilters').style.display = 'none';
    document.getElementById('connectionsTitle').textContent = c.name || 'Connection';
}

// ── Editor ──
function connectionNew() {
    editingConnectionId = null;
    connectionPhotoFile = null;
    connectionPhotoPreview = '';
    connectionSelectedType = '';
    clearConnectionEditor();
    showConnectionEditorAvatar('', '?');
    updateConnectionTypeBtns();
    document.getElementById('connectionsList').style.display = 'none';
    document.getElementById('connectionDetail').style.display = 'none';
    document.getElementById('connectionEditor').style.display = 'block';
    document.getElementById('connectionsNewBtn').style.display = 'none';
    document.getElementById('connectionsFilters').style.display = 'none';
    document.getElementById('connectionsTitle').textContent = 'New Connection';
}

function connectionEdit() {
    const c = connectionsData.find(x => x.id === editingConnectionId);
    if (!c) return;
    connectionPhotoFile = null;
    connectionPhotoPreview = c.photoUrl || '';
    connectionSelectedType = c.type || '';

    document.getElementById('connectionEdName').value = c.name || '';
    document.getElementById('connectionEdAge').value = c.age || '';
    document.getElementById('connectionEdRelationship').value = c.relationship || '';
    document.getElementById('connectionEdAppearance').value = c.appearance || '';
    document.getElementById('connectionEdPersonality').value = c.personality || '';
    document.getElementById('connectionEdDailyLife').value = c.dailyLife || '';
    document.getElementById('connectionEdStyle').value = c.style || '';
    document.getElementById('connectionEdBackstory').value = c.backstory || '';
    connectionEditorExtras = (c.extras || []).map(e => ({ ...e }));
    renderConnectionExtras();
    updateConnectionTypeBtns();
    showConnectionEditorAvatar(c.photoUrl || '', c.name || '?');

    document.getElementById('connectionDetail').style.display = 'none';
    document.getElementById('connectionEditor').style.display = 'block';
    document.getElementById('connectionsFilters').style.display = 'none';
    document.getElementById('connectionsTitle').textContent = 'Edit Connection';
}

function clearConnectionEditor() {
    document.getElementById('connectionEdName').value = '';
    document.getElementById('connectionEdAge').value = '';
    document.getElementById('connectionEdRelationship').value = '';
    document.getElementById('connectionEdAppearance').value = '';
    document.getElementById('connectionEdPersonality').value = '';
    document.getElementById('connectionEdDailyLife').value = '';
    document.getElementById('connectionEdStyle').value = '';
    document.getElementById('connectionEdBackstory').value = '';
    connectionEditorExtras = [];
    renderConnectionExtras();
}

function showConnectionEditorAvatar(url, name) {
    const img = document.getElementById('connectionEditorAvatarImg');
    const initial = document.getElementById('connectionEditorAvatarInitial');
    if (url) {
        img.src = url; img.style.display = 'block'; initial.style.display = 'none';
    } else {
        img.style.display = 'none'; initial.style.display = 'block';
        initial.textContent = (name || '?')[0].toUpperCase();
    }
}

function connectionCancelEdit() {
    if (editingConnectionId) {
        connectionOpen(editingConnectionId);
    } else {
        connectionsShowList();
    }
}

// ── Type Picker ──
function pickConnectionType(type) {
    connectionSelectedType = (connectionSelectedType === type) ? '' : type;
    updateConnectionTypeBtns();
}

function updateConnectionTypeBtns() {
    document.querySelectorAll('.connection-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === connectionSelectedType);
    });
}

// ── Extras ──
function connectionAddExtra() {
    connectionEditorExtras.push({ label: '', value: '' });
    renderConnectionExtras();
    setTimeout(() => {
        const labels = document.querySelectorAll('#connectionExtras .persona-extra-label');
        if (labels.length) labels[labels.length - 1].focus();
    }, 50);
}

function connectionRemoveExtra(idx) {
    connectionEditorExtras.splice(idx, 1);
    renderConnectionExtras();
}

function renderConnectionExtras() {
    const container = document.getElementById('connectionExtras');
    container.innerHTML = connectionEditorExtras.map((e, i) =>
        '<div class="persona-extra-item">' +
            '<div class="persona-extra-item-header">' +
                '<input class="auth-input persona-extra-label" data-idx="' + i + '" placeholder="Field name..." value="' + escapeHtml(e.label) + '">' +
                '<button class="affirmation-delete-btn" onclick="connectionRemoveExtra(' + i + ')">&times;</button>' +
            '</div>' +
            '<textarea class="auth-input persona-extra-value" data-idx="' + i + '" placeholder="Write freely..." rows="2">' + escapeHtml(e.value) + '</textarea>' +
        '</div>'
    ).join('');

    container.querySelectorAll('.persona-extra-label').forEach(el => {
        el.addEventListener('input', () => { connectionEditorExtras[parseInt(el.dataset.idx)].label = el.value; });
    });
    container.querySelectorAll('.persona-extra-value').forEach(el => {
        el.addEventListener('input', () => { connectionEditorExtras[parseInt(el.dataset.idx)].value = el.value; });
    });
}

// ── Photo Upload ──
document.getElementById('connectionPhotoUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please choose an image'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    connectionPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        connectionPhotoPreview = ev.target.result;
        showConnectionEditorAvatar(connectionPhotoPreview, document.getElementById('connectionEdName').value || '?');
    };
    reader.readAsDataURL(file);
});

document.getElementById('connectionEdName').addEventListener('input', (e) => {
    if (!connectionPhotoPreview) {
        document.getElementById('connectionEditorAvatarInitial').textContent = (e.target.value || '?')[0].toUpperCase();
    }
});

// ── Save & Delete ──
async function connectionSave() {
    const name = document.getElementById('connectionEdName').value.trim();
    if (!name) { alert('Give this connection a name'); return; }

    let photoUrl = connectionPhotoPreview || '';

    if (connectionPhotoFile) {
        try {
            const photoId = editingConnectionId || ('conn_' + Date.now());
            const ref = storage.ref('connections/' + photoId);
            await ref.put(connectionPhotoFile);
            photoUrl = await ref.getDownloadURL();
        } catch (err) {
            alert('Photo upload failed: ' + err.message);
            return;
        }
    }

    const data = {
        name,
        age: document.getElementById('connectionEdAge').value.trim(),
        type: connectionSelectedType,
        relationship: document.getElementById('connectionEdRelationship').value.trim(),
        appearance: document.getElementById('connectionEdAppearance').value.trim(),
        personality: document.getElementById('connectionEdPersonality').value.trim(),
        dailyLife: document.getElementById('connectionEdDailyLife').value.trim(),
        style: document.getElementById('connectionEdStyle').value.trim(),
        backstory: document.getElementById('connectionEdBackstory').value.trim(),
        extras: connectionEditorExtras.filter(e => e.label.trim() || e.value.trim()),
        photoUrl,
        authorId: currentUser.uid,
        authorName: currentUserName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editingConnectionId) {
        await db.collection('connections').doc(editingConnectionId).update(data);
        connectionOpen(editingConnectionId);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const docRef = await db.collection('connections').add(data);
        editingConnectionId = docRef.id;
        connectionOpen(docRef.id);
    }
}

async function connectionDelete() {
    if (!editingConnectionId) return;
    if (!confirm('Delete this connection?')) return;
    await db.collection('connections').doc(editingConnectionId).delete();
    connectionsShowList();
}

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
                '<div style="display:flex;gap:4px;align-items:center">' +
                    '<button class="btn-secondary btn-sm" onclick="playInMiniPlayer(\'' + pl.id + '\', \'' + escapeHtml(pl.name).replace(/'/g, "\\'") + '\')" style="padding:4px 12px;font-size:12px">&#9654; Play</button>' +
                    '<button class="affirmation-delete-btn" onclick="removePlaylist(' + i + ')" title="Remove">&times;</button>' +
                '</div>' +
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

// ═══════ WORLD / LOCATIONS (Firestore synced) ═══════

let worldData = [];
let worldUnsub = null;
let editingWorldId = null;
let worldEditorExtras = [];
let worldPhotoFile = null;
let worldPhotoPreview = '';
let worldSelectedType = '';
let worldFilter = 'all';

const worldTypeIcons = {
    home: '\u{1F3E0}', village: '\u{1F3D8}\uFE0F', nature: '\u{1F333}',
    landmark: '\u{1F4CC}', shop: '\u{1F6D2}', secret: '\u2728'
};

const worldTypeColours = {
    home: { bg: 'rgba(201, 164, 90, 0.15)', color: 'var(--honey)' },
    village: { bg: 'rgba(106, 150, 176, 0.15)', color: 'var(--sky)' },
    nature: { bg: 'rgba(90, 158, 122, 0.15)', color: 'var(--jade-primary)' },
    landmark: { bg: 'rgba(155, 138, 184, 0.15)', color: 'var(--lavender)' },
    shop: { bg: 'rgba(201, 164, 90, 0.15)', color: 'var(--honey)' },
    secret: { bg: 'rgba(201, 134, 126, 0.15)', color: 'var(--rose)' }
};

function initWorld() {
    if (worldUnsub) worldUnsub();
    worldUnsub = db.collection('world').orderBy('createdAt', 'asc').onSnapshot(snapshot => {
        worldData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderWorldList();
    });
}

function renderWorldList() {
    const container = document.getElementById('worldList');
    const filtered = worldFilter === 'all' ? worldData : worldData.filter(w => w.type === worldFilter);

    if (worldData.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#127807;</div><p>No places yet. Tap + to build the first corner of your Jade world.</p></div>';
        return;
    }
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:var(--space-xl) 0"><p>No ' + worldFilter + ' places yet.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(w => {
        const icon = worldTypeIcons[w.type] || '\u{1F33F}';
        const avatarHtml = w.photoUrl ? '<img src="' + w.photoUrl + '" alt="">' : '<span>' + icon + '</span>';
        return '<div class="persona-card world-card" onclick="worldOpen(\'' + w.id + '\')">' +
            '<div class="persona-card-avatar world-card-avatar">' + avatarHtml + '</div>' +
            '<div class="persona-card-info">' +
                '<div class="persona-card-name">' + escapeHtml(w.name || 'Unnamed') + '</div>' +
                '<div class="persona-card-age">' + escapeHtml(w.type || '') + '</div>' +
                (w.description ? '<div class="persona-card-preview">' + escapeHtml(w.description) + '</div>' : '') +
            '</div><div class="persona-card-arrow">&rsaquo;</div></div>';
    }).join('');
}

function filterWorld(type) {
    worldFilter = type;
    document.querySelectorAll('#worldFilters .connections-filter').forEach(f => f.classList.toggle('active', f.dataset.filter === type));
    renderWorldList();
}

function worldShowList() {
    document.getElementById('worldList').style.display = 'block';
    document.getElementById('worldDetail').style.display = 'none';
    document.getElementById('worldEditor').style.display = 'none';
    document.getElementById('worldNewBtn').style.display = 'flex';
    document.getElementById('worldFilters').style.display = 'flex';
    document.getElementById('worldTitle').textContent = 'The World';
    editingWorldId = null;
}

function worldBack() {
    if (document.getElementById('worldEditor').style.display !== 'none') worldCancelEdit();
    else if (document.getElementById('worldDetail').style.display !== 'none') worldShowList();
    else nav('home');
}

function worldOpen(id) {
    const w = worldData.find(x => x.id === id);
    if (!w) return;
    editingWorldId = id;

    const img = document.getElementById('worldDetailPhotoImg');
    const placeholder = document.getElementById('worldDetailPhotoPlaceholder');
    if (w.photoUrl) { img.src = w.photoUrl; img.style.display = 'block'; placeholder.style.display = 'none'; }
    else { img.style.display = 'none'; placeholder.style.display = 'flex'; document.getElementById('worldDetailPhotoIcon').textContent = worldTypeIcons[w.type] || '\u{1F33F}'; }

    document.getElementById('worldDetailName').textContent = w.name || 'Unnamed';
    const tagEl = document.getElementById('worldDetailTag');
    if (w.type) {
        const colours = worldTypeColours[w.type] || worldTypeColours.nature;
        tagEl.textContent = (worldTypeIcons[w.type] || '') + ' ' + w.type;
        tagEl.style.background = colours.bg; tagEl.style.color = colours.color; tagEl.style.display = 'inline-block';
    } else { tagEl.style.display = 'none'; }

    const fixedFields = [
        { label: 'Description', value: w.description }, { label: 'Atmosphere', value: w.atmosphere },
        { label: 'Sensory Details', value: w.sensory }, { label: 'Memories', value: w.memories },
        { label: 'Seasons', value: w.seasons }, { label: 'Lore', value: w.lore }
    ];
    const extras = w.extras || [];
    const allFields = [...fixedFields, ...extras.map(e => ({ label: e.label, value: e.value }))];
    document.getElementById('worldDetailFields').innerHTML = allFields.filter(f => f.value).map(f =>
        '<div class="persona-detail-field"><div class="persona-detail-field-label">' + escapeHtml(f.label) + '</div><div class="persona-detail-field-value">' + escapeHtml(f.value) + '</div></div>'
    ).join('');

    document.getElementById('worldList').style.display = 'none';
    document.getElementById('worldDetail').style.display = 'block';
    document.getElementById('worldEditor').style.display = 'none';
    document.getElementById('worldNewBtn').style.display = 'none';
    document.getElementById('worldFilters').style.display = 'none';
    document.getElementById('worldTitle').textContent = w.name || 'Place';
}

function worldNew() {
    editingWorldId = null; worldPhotoFile = null; worldPhotoPreview = ''; worldSelectedType = '';
    clearWorldEditor(); showWorldEditorPhoto('', ''); updateWorldTypeBtns();
    document.getElementById('worldList').style.display = 'none';
    document.getElementById('worldDetail').style.display = 'none';
    document.getElementById('worldEditor').style.display = 'block';
    document.getElementById('worldNewBtn').style.display = 'none';
    document.getElementById('worldFilters').style.display = 'none';
    document.getElementById('worldTitle').textContent = 'New Place';
}

function worldEdit() {
    const w = worldData.find(x => x.id === editingWorldId);
    if (!w) return;
    worldPhotoFile = null; worldPhotoPreview = w.photoUrl || ''; worldSelectedType = w.type || '';
    document.getElementById('worldEdName').value = w.name || '';
    document.getElementById('worldEdDescription').value = w.description || '';
    document.getElementById('worldEdAtmosphere').value = w.atmosphere || '';
    document.getElementById('worldEdSensory').value = w.sensory || '';
    document.getElementById('worldEdMemories').value = w.memories || '';
    document.getElementById('worldEdSeasons').value = w.seasons || '';
    document.getElementById('worldEdLore').value = w.lore || '';
    worldEditorExtras = (w.extras || []).map(e => ({ ...e }));
    renderWorldExtras(); updateWorldTypeBtns(); showWorldEditorPhoto(w.photoUrl || '', w.type);
    document.getElementById('worldDetail').style.display = 'none';
    document.getElementById('worldEditor').style.display = 'block';
    document.getElementById('worldFilters').style.display = 'none';
    document.getElementById('worldTitle').textContent = 'Edit Place';
}

function clearWorldEditor() {
    ['worldEdName','worldEdDescription','worldEdAtmosphere','worldEdSensory','worldEdMemories','worldEdSeasons','worldEdLore'].forEach(id => document.getElementById(id).value = '');
    worldEditorExtras = []; renderWorldExtras();
}

function showWorldEditorPhoto(url, type) {
    const img = document.getElementById('worldEditorPhotoImg');
    const icon = document.getElementById('worldEditorPhotoIcon');
    if (url) { img.src = url; img.style.display = 'block'; icon.style.display = 'none'; }
    else { img.style.display = 'none'; icon.style.display = 'block'; icon.textContent = worldTypeIcons[type] || '\u{1F33F}'; }
}

function worldCancelEdit() { if (editingWorldId) worldOpen(editingWorldId); else worldShowList(); }

function pickWorldType(type) {
    worldSelectedType = (worldSelectedType === type) ? '' : type;
    updateWorldTypeBtns();
    if (!worldPhotoPreview) document.getElementById('worldEditorPhotoIcon').textContent = worldTypeIcons[worldSelectedType] || '\u{1F33F}';
}

function updateWorldTypeBtns() {
    document.querySelectorAll('#worldTypeOptions .connection-type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.type === worldSelectedType));
}

function worldAddExtra() {
    worldEditorExtras.push({ label: '', value: '' }); renderWorldExtras();
    setTimeout(() => { const l = document.querySelectorAll('#worldExtras .persona-extra-label'); if (l.length) l[l.length-1].focus(); }, 50);
}
function worldRemoveExtra(idx) { worldEditorExtras.splice(idx, 1); renderWorldExtras(); }

function renderWorldExtras() {
    const container = document.getElementById('worldExtras');
    container.innerHTML = worldEditorExtras.map((e, i) =>
        '<div class="persona-extra-item"><div class="persona-extra-item-header">' +
        '<input class="auth-input persona-extra-label" data-idx="' + i + '" placeholder="Field name..." value="' + escapeHtml(e.label) + '">' +
        '<button class="affirmation-delete-btn" onclick="worldRemoveExtra(' + i + ')">&times;</button></div>' +
        '<textarea class="auth-input persona-extra-value" data-idx="' + i + '" placeholder="Write freely..." rows="2">' + escapeHtml(e.value) + '</textarea></div>'
    ).join('');
    container.querySelectorAll('.persona-extra-label').forEach(el => { el.addEventListener('input', () => { worldEditorExtras[parseInt(el.dataset.idx)].label = el.value; }); });
    container.querySelectorAll('.persona-extra-value').forEach(el => { el.addEventListener('input', () => { worldEditorExtras[parseInt(el.dataset.idx)].value = el.value; }); });
}

document.getElementById('worldPhotoUpload').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please choose an image'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    worldPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => { worldPhotoPreview = ev.target.result; showWorldEditorPhoto(worldPhotoPreview, worldSelectedType); };
    reader.readAsDataURL(file);
});

async function worldSave() {
    const name = document.getElementById('worldEdName').value.trim();
    if (!name) { alert('Give this place a name'); return; }
    let photoUrl = worldPhotoPreview || '';
    if (worldPhotoFile) {
        try {
            const photoId = editingWorldId || ('world_' + Date.now());
            const ref = storage.ref('world/' + photoId); await ref.put(worldPhotoFile); photoUrl = await ref.getDownloadURL();
        } catch (err) { alert('Photo upload failed: ' + err.message); return; }
    }
    const data = {
        name, type: worldSelectedType,
        description: document.getElementById('worldEdDescription').value.trim(),
        atmosphere: document.getElementById('worldEdAtmosphere').value.trim(),
        sensory: document.getElementById('worldEdSensory').value.trim(),
        memories: document.getElementById('worldEdMemories').value.trim(),
        seasons: document.getElementById('worldEdSeasons').value.trim(),
        lore: document.getElementById('worldEdLore').value.trim(),
        extras: worldEditorExtras.filter(e => e.label.trim() || e.value.trim()),
        photoUrl, authorId: currentUser.uid, authorName: currentUserName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (editingWorldId) { await db.collection('world').doc(editingWorldId).update(data); worldOpen(editingWorldId); }
    else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); const docRef = await db.collection('world').add(data); editingWorldId = docRef.id; worldOpen(docRef.id); }
}

async function worldDelete() {
    if (!editingWorldId) return;
    if (!confirm('Delete this place?')) return;
    await db.collection('world').doc(editingWorldId).delete(); worldShowList();
}

// ═══════ OUR SPACE — Album-Based Photo Gallery ═══════

const DEFAULT_ALBUMS = ['Us', 'Pets', 'Home', 'World'];
let spaceAlbums = [];
let spacePhotos = [];
let spaceAlbumsUnsub = null;
let spacePhotosUnsub = null;
let currentAlbumId = null;
let currentPhotoId = null;
let spaceGenController = null;
let spaceGeneratedImageData = null;
let spaceRefImages = []; // Array of { data: base64, mimeType: string }

document.getElementById('genRefUpload').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    files.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        if (spaceRefImages.length >= 5) return;
        
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            spaceRefImages.push({ data: base64, mimeType: file.type, name: file.name });
            renderRefGrid();
        };
        reader.readAsDataURL(file);
    });
    
    e.target.value = '';
});

// Paste from clipboard button
async function pasteRefFromClipboard() {
    try {
        const clipboardItems = await navigator.clipboard.read();
        let found = false;
        for (const item of clipboardItems) {
            const imageType = item.types.find(t => t.startsWith('image/'));
            if (imageType) {
                if (spaceRefImages.length >= 5) {
                    document.getElementById('spaceGenError').textContent = 'Maximum 5 reference images.';
                    return;
                }
                const blob = await item.getType(imageType);
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    spaceRefImages.push({ data: base64, mimeType: imageType, name: 'pasted-image' });
                    renderRefGrid();
                };
                reader.readAsDataURL(blob);
                found = true;
                break;
            }
        }
        if (!found) {
            document.getElementById('spaceGenError').textContent = 'No image found in clipboard.';
            setTimeout(() => { document.getElementById('spaceGenError').textContent = ''; }, 3000);
        }
    } catch (err) {
        document.getElementById('spaceGenError').textContent = 'Could not paste: ' + (err.message || 'clipboard access denied.');
        setTimeout(() => { document.getElementById('spaceGenError').textContent = ''; }, 3000);
    }
}

// Ctrl+V / Cmd+V paste support when modal is open
document.addEventListener('paste', (e) => {
    const modal = document.getElementById('spaceGenerateModal');
    if (!modal.classList.contains('visible')) return;
    
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (!imageItem) return;
    
    e.preventDefault();
    if (spaceRefImages.length >= 5) return;
    
    const blob = imageItem.getAsFile();
    const reader = new FileReader();
    reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        spaceRefImages.push({ data: base64, mimeType: blob.type, name: 'pasted-image' });
        renderRefGrid();
    };
    reader.readAsDataURL(blob);
});

function renderRefGrid() {
    const grid = document.getElementById('genRefGrid');
    grid.innerHTML = spaceRefImages.map((img, i) => 
        '<div class="gen-ref-thumb">' +
            '<img src="data:' + img.mimeType + ';base64,' + img.data + '">' +
            '<button class="gen-ref-remove" onclick="removeRefImage(' + i + ')">&times;</button>' +
        '</div>'
    ).join('');
}

function removeRefImage(index) {
    spaceRefImages.splice(index, 1);
    renderRefGrid();
}

function initSpace() {
    // Model toggle label updates
    const modelToggle = document.getElementById('nanoBananaModelToggle');
    if (modelToggle) {
        const savedModel = localStorage.getItem('jade_nano_banana_model');
        if (savedModel === 'pro') modelToggle.checked = true;
        
        modelToggle.addEventListener('change', () => {
            const left = document.getElementById('nbLabelLeft');
            const right = document.getElementById('nbLabelRight');
            if (modelToggle.checked) {
                left.style.color = ''; left.style.fontWeight = ''; left.style.opacity = '0.5';
                right.style.color = 'var(--jade-light)'; right.style.fontWeight = '500'; right.style.opacity = '1';
                localStorage.setItem('jade_nano_banana_model', 'pro');
            } else {
                left.style.color = 'var(--jade-light)'; left.style.fontWeight = '500'; left.style.opacity = '1';
                right.style.color = ''; right.style.fontWeight = ''; right.style.opacity = '0.5';
                localStorage.setItem('jade_nano_banana_model', 'flash');
            }
        });
        
        if (modelToggle.checked) {
            document.getElementById('nbLabelLeft').style.opacity = '0.5';
            document.getElementById('nbLabelRight').style.color = 'var(--jade-light)';
            document.getElementById('nbLabelRight').style.fontWeight = '500';
            document.getElementById('nbLabelRight').style.opacity = '1';
        }
    }
    // Init default albums if none exist
    const albumsRef = db.collection('spaceAlbums');
    albumsRef.get().then(snapshot => {
        if (snapshot.empty) {
            DEFAULT_ALBUMS.forEach((name, i) => {
                albumsRef.add({
                    name, order: i, isDefault: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    authorId: currentUser.uid, authorName: currentUserName
                });
            });
        }
    });

    if (spaceAlbumsUnsub) spaceAlbumsUnsub();
    spaceAlbumsUnsub = albumsRef.orderBy('order', 'asc').onSnapshot(snapshot => {
        spaceAlbums = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSpaceAlbums();
    });

    if (spacePhotosUnsub) spacePhotosUnsub();
    spacePhotosUnsub = db.collection('spacePhotos').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        spacePhotos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSpaceAlbums();
        if (currentAlbumId) renderSpacePhotoGrid();
    });
}

// ── Album Views ──
function spaceShowAlbums() {
    document.getElementById('spaceAlbums').style.display = 'grid';
    document.getElementById('spaceAlbumView').style.display = 'none';
    document.getElementById('spacePhotoDetail').style.display = 'none';
    document.getElementById('spaceAddAlbumBtn').style.display = 'flex';
    document.getElementById('spaceTitle').textContent = 'Our Space';
    currentAlbumId = null; currentPhotoId = null;
}

function spaceBack() {
    if (document.getElementById('spacePhotoDetail').style.display !== 'none') {
        spaceOpenAlbum(currentAlbumId);
    } else if (document.getElementById('spaceAlbumView').style.display !== 'none') {
        spaceShowAlbums();
    } else {
        nav('home');
    }
}

function renderSpaceAlbums() {
    const container = document.getElementById('spaceAlbums');
    if (spaceAlbums.length === 0) {
        container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">&#127969;</div><p>Setting up your albums...</p></div>';
        return;
    }

    container.innerHTML = spaceAlbums.map(album => {
        const albumPhotos = spacePhotos.filter(p => p.albumId === album.id);
        const coverPhoto = albumPhotos[0];
        const count = albumPhotos.length;

        const coverHtml = coverPhoto
            ? '<img src="' + coverPhoto.url + '" alt="" class="space-album-cover-img">'
            : '<div class="space-album-cover-empty"><span>' + albumIcon(album.name) + '</span></div>';

        return '<div class="space-album-card" onclick="spaceOpenAlbum(\'' + album.id + '\')">' +
            '<div class="space-album-cover">' + coverHtml + '</div>' +
            '<div class="space-album-info">' +
                '<div class="space-album-name">' + escapeHtml(album.name) + '</div>' +
                '<div class="space-album-meta">' + count + ' photo' + (count !== 1 ? 's' : '') + '</div>' +
            '</div>' +
            (!album.isDefault ? '<button class="space-album-delete" onclick="event.stopPropagation();spaceDeleteAlbum(\'' + album.id + '\')" title="Delete album">&times;</button>' : '') +
        '</div>';
    }).join('');
}

function albumIcon(name) {
    const n = name.toLowerCase();
    if (n.includes('us') || n.includes('all')) return '';
    if (n.includes('pet')) return '';
    if (n.includes('home')) return '';
    if (n.includes('world')) return '';
    return '';
}

function spaceOpenAlbum(albumId) {
    currentAlbumId = albumId;
    currentPhotoId = null;
    const album = spaceAlbums.find(a => a.id === albumId);
    document.getElementById('spaceTitle').textContent = album ? album.name : 'Album';
    document.getElementById('spaceAlbums').style.display = 'none';
    document.getElementById('spaceAlbumView').style.display = 'block';
    document.getElementById('spacePhotoDetail').style.display = 'none';
    document.getElementById('spaceAddAlbumBtn').style.display = 'none';
    renderSpacePhotoGrid();
}

function renderSpacePhotoGrid() {
    const container = document.getElementById('spacePhotoGrid');
    const photos = spacePhotos.filter(p => p.albumId === currentAlbumId);
    document.getElementById('spaceAlbumCount').textContent = photos.length + ' photo' + (photos.length !== 1 ? 's' : '');

    if (photos.length === 0) {
        container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">&#128247;</div><p>No photos yet. Upload or generate your first image.</p></div>';
        return;
    }

    container.innerHTML = photos.map(p =>
        '<div class="space-photo-thumb" onclick="spaceOpenPhoto(\'' + p.id + '\')">' +
            '<img src="' + p.url + '" alt="" loading="lazy">' +
            (p.caption ? '<div class="space-photo-thumb-caption">' + escapeHtml(p.caption) + '</div>' : '') +
        '</div>'
    ).join('');
}

// ── Photo Detail ──
function spaceOpenPhoto(photoId) {
    const photo = spacePhotos.find(p => p.id === photoId);
    if (!photo) return;
    currentPhotoId = photoId;

    document.getElementById('spacePhotoDetailImg').src = photo.url;
    document.getElementById('spacePhotoDetailCaption').textContent = photo.caption || '';
    document.getElementById('spacePhotoDetailCaption').style.display = photo.caption ? 'block' : 'none';

    const date = photo.createdAt ? new Date(photo.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const source = photo.source === 'generated' ? ('Generated with ' + (photo.generatedModel || 'Nano Banana Pro')) : 'Uploaded';
    document.getElementById('spacePhotoDetailMeta').textContent = source + (date ? ' · ' + date : '');

    document.getElementById('spaceAlbumView').style.display = 'none';
    document.getElementById('spacePhotoDetail').style.display = 'block';
}

// ── Photo Upload ──
document.getElementById('spacePhotoUpload').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 10 * 1024 * 1024) { alert(file.name + ' is too large (max 10MB)'); continue; }

        try {
            const photoId = 'space_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            const ref = storage.ref('space/' + photoId);
            await ref.put(file);
            const url = await ref.getDownloadURL();

            await db.collection('spacePhotos').add({
                url, albumId: currentAlbumId,
                caption: '', source: 'uploaded',
                authorId: currentUser.uid, authorName: currentUserName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (err) {
            alert('Upload failed: ' + err.message);
        }
    }
    e.target.value = '';
});

// ── Paste Photo to Album ──
async function spacePastePhoto() {
    if (!currentAlbumId) return;

    try {
        const clipboardItems = await navigator.clipboard.read();
        let found = false;

        for (const item of clipboardItems) {
            const imageType = item.types.find(t => t.startsWith('image/'));
            if (!imageType) continue;

            found = true;
            const blob = await item.getType(imageType);

            if (blob.size > 10 * 1024 * 1024) {
                alert('Image is too large (max 10MB)');
                return;
            }

            try {
                const photoId = 'space_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
                const ref = storage.ref('space/' + photoId);
                await ref.put(blob);
                const url = await ref.getDownloadURL();

                await db.collection('spacePhotos').add({
                    url, albumId: currentAlbumId,
                    caption: '', source: 'uploaded',
                    authorId: currentUser.uid, authorName: currentUserName,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (err) {
                alert('Upload failed: ' + err.message);
            }
            break;
        }

        if (!found) {
            alert('No image found in clipboard.');
        }
    } catch (err) {
        alert('Could not paste: ' + (err.message || 'clipboard access denied.'));
    }
}

// Ctrl+V / Cmd+V paste support when viewing an album
document.addEventListener('paste', async (e) => {
    // Only handle if we're in album view (not in a modal or text input)
    if (!currentAlbumId) return;
    if (document.getElementById('spaceAlbumView').style.display === 'none') return;
    if (document.getElementById('spaceGenerateModal').classList.contains('visible')) return;
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (!imageItem) return;

    e.preventDefault();
    const blob = imageItem.getAsFile();

    if (blob.size > 10 * 1024 * 1024) {
        alert('Image is too large (max 10MB)');
        return;
    }

    try {
        const photoId = 'space_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const ref = storage.ref('space/' + photoId);
        await ref.put(blob);
        const url = await ref.getDownloadURL();

        await db.collection('spacePhotos').add({
            url, albumId: currentAlbumId,
            caption: '', source: 'uploaded',
            authorId: currentUser.uid, authorName: currentUserName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        alert('Upload failed: ' + err.message);
    }
});

// ── Caption Edit ──
function spaceEditCaption() {
    const photo = spacePhotos.find(p => p.id === currentPhotoId);
    if (!photo) return;
    document.getElementById('spaceEditCaptionInput').value = photo.caption || '';
    document.getElementById('spaceEditCaptionModal').classList.add('visible');
}

async function spaceSaveCaption() {
    if (!currentPhotoId) return;
    const caption = document.getElementById('spaceEditCaptionInput').value.trim();
    await db.collection('spacePhotos').doc(currentPhotoId).update({ caption });
    document.getElementById('spacePhotoDetailCaption').textContent = caption;
    document.getElementById('spacePhotoDetailCaption').style.display = caption ? 'block' : 'none';
    document.getElementById('spaceEditCaptionModal').classList.remove('visible');
}

// ── Move Photo ──
function spaceMovePhoto() {
    const container = document.getElementById('spaceMoveAlbumList');
    container.innerHTML = spaceAlbums.map(a =>
        '<div class="space-move-item' + (a.id === currentAlbumId ? ' current' : '') + '" onclick="spaceDoMove(\'' + a.id + '\')">' +
            '<span>' + albumIcon(a.name) + '</span> ' + escapeHtml(a.name) +
            (a.id === currentAlbumId ? ' <span style="color:var(--text-faint)">(current)</span>' : '') +
        '</div>'
    ).join('');
    document.getElementById('spaceMoveModal').classList.add('visible');
}

async function spaceDoMove(albumId) {
    if (!currentPhotoId || albumId === currentAlbumId) return;
    await db.collection('spacePhotos').doc(currentPhotoId).update({ albumId });
    document.getElementById('spaceMoveModal').classList.remove('visible');
    currentAlbumId = albumId;
    const album = spaceAlbums.find(a => a.id === albumId);
    document.getElementById('spaceTitle').textContent = album ? album.name : 'Album';
    spaceOpenPhoto(currentPhotoId);
}

// ── Delete Photo ──
async function spaceDeletePhoto() {
    if (!currentPhotoId) return;
    if (!confirm('Delete this photo?')) return;
    await db.collection('spacePhotos').doc(currentPhotoId).delete();
    currentPhotoId = null;
    spaceOpenAlbum(currentAlbumId);
}

// ── Album Management ──
function spaceNewAlbum() {
    document.getElementById('spaceNewAlbumName').value = '';
    document.getElementById('spaceNewAlbumModal').classList.add('visible');
    setTimeout(() => document.getElementById('spaceNewAlbumName').focus(), 100);
}

async function spaceCreateAlbum() {
    const name = document.getElementById('spaceNewAlbumName').value.trim();
    if (!name) return;
    await db.collection('spaceAlbums').add({
        name, order: spaceAlbums.length, isDefault: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        authorId: currentUser.uid, authorName: currentUserName
    });
    document.getElementById('spaceNewAlbumModal').classList.remove('visible');
}

async function spaceDeleteAlbum(albumId) {
    const album = spaceAlbums.find(a => a.id === albumId);
    if (!album || album.isDefault) return;
    const photos = spacePhotos.filter(p => p.albumId === albumId);
    if (!confirm('Delete "' + album.name + '"' + (photos.length ? ' and its ' + photos.length + ' photo(s)' : '') + '?')) return;
    // Delete photos in album
    for (const p of photos) { await db.collection('spacePhotos').doc(p.id).delete(); }
    await db.collection('spaceAlbums').doc(albumId).delete();
    if (currentAlbumId === albumId) spaceShowAlbums();
}

// ═══════ NANO BANANA PRO — Gemini Image Generation ═══════

function spaceOpenGenerate() {
    document.getElementById('spaceGenPrompt').value = '';
    document.getElementById('spaceGenPreview').style.display = 'none';
    document.getElementById('spaceGenLoading').style.display = 'none';
    document.getElementById('spaceGenThinkingPreview').style.display = 'none';
    document.getElementById('spaceGenError').textContent = '';
    document.getElementById('spaceGenBtn').style.display = 'block';
    document.querySelector('#spaceGenLoading p').textContent = 'Creating your image...';
    spaceGeneratedImageData = null;
    spaceRefImages = [];
    renderRefGrid();
    document.getElementById('spaceGenerateModal').classList.add('visible');
    setTimeout(() => document.getElementById('spaceGenPrompt').focus(), 100);
}

function spaceCloseGenerate() {
    document.getElementById('spaceGenerateModal').classList.remove('visible');
    if (spaceGenController) { spaceGenController.abort(); spaceGenController = null; }
}

function getSelectedNanoBananaModel() {
    const toggle = document.getElementById('nanoBananaModelToggle');
    return toggle && toggle.checked ? 'gemini-3-pro-image-preview' : 'gemini-3.1-flash-image-preview';
}

function getSelectedNanoBananaLabel() {
    const toggle = document.getElementById('nanoBananaModelToggle');
    return toggle && toggle.checked ? 'Nano Banana Pro' : 'Nano Banana 2';
}

async function spaceGenerate() {
    const prompt = document.getElementById('spaceGenPrompt').value.trim();
    if (!prompt) return;

    const apiKey = localStorage.getItem('jade_gemini_key');
    if (!apiKey) { document.getElementById('spaceGenError').textContent = 'No Gemini API key set. Add it in Settings first.'; return; }

    const model = getSelectedNanoBananaModel();

    document.getElementById('spaceGenBtn').style.display = 'none';
    document.getElementById('spaceGenLoading').style.display = 'flex';
    document.getElementById('spaceGenError').textContent = '';
    document.getElementById('spaceGenPreview').style.display = 'none';
    document.getElementById('spaceGenThinkingPreview').style.display = 'none';

    spaceGenController = new AbortController();

    try {
        // Use streaming endpoint to capture thought images
        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':streamGenerateContent?alt=sse&key=' + apiKey,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: spaceGenController.signal,
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            ...spaceRefImages.map(img => ({
                                inlineData: { mimeType: img.mimeType, data: img.data }
                            })),
                            { text: prompt + (spaceRefImages.length > 0 ? ' Use the attached reference images to inform the characters, style, and visual details.' : '') }
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ['TEXT', 'IMAGE'],
                        thinkingConfig: {
                            thinkingLevel: 'HIGH',
                            includeThoughts: true
                        },
                        imageConfig: {
                            imageSize: '2K'
                        }
                    }
                })
            }
        );

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'API error: ' + response.status);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let lastImageData = null;
        let thoughtImageCount = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process SSE events
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr || jsonStr === '[DONE]') continue;

                try {
                    const chunk = JSON.parse(jsonStr);
                    if (!chunk.candidates || !chunk.candidates[0] || !chunk.candidates[0].content) continue;

                    const parts = chunk.candidates[0].content.parts || [];
                    for (const part of parts) {
                        if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) {
                            // Check if this is a thought image (marked by thought flag or thought_signature)
                            const isThought = part.thought || part.thoughtSignature || part.thought_signature;
                            if (isThought) {
                                // This is a thinking/interim image — show as preview
                                thoughtImageCount++;
                                document.getElementById('spaceGenThinkingImg').src = 'data:' + part.inlineData.mimeType + ';base64,' + part.inlineData.data;
                                document.getElementById('spaceGenThinkingPreview').style.display = 'block';
                                document.querySelector('.space-gen-thinking-label').textContent = 'Thinking... (' + thoughtImageCount + ')';
                                document.querySelector('#spaceGenLoading p').textContent = 'Refining the image...';
                            }
                            // Always track the latest image (last one = final)
                            lastImageData = part.inlineData;
                        }
                    }
                } catch (e) {
                    // Skip unparseable chunks
                }
            }
        }

        // Hide thinking preview
        document.getElementById('spaceGenThinkingPreview').style.display = 'none';

        if (!lastImageData) throw new Error('No image was generated. Try a different prompt.');

        spaceGeneratedImageData = lastImageData;
        document.getElementById('spaceGenPreviewImg').src = 'data:' + lastImageData.mimeType + ';base64,' + lastImageData.data;
        document.getElementById('spaceGenPreview').style.display = 'block';
        document.getElementById('spaceGenLoading').style.display = 'none';

    } catch (err) {
        document.getElementById('spaceGenLoading').style.display = 'none';
        document.getElementById('spaceGenThinkingPreview').style.display = 'none';
        if (err.name === 'AbortError') {
            document.getElementById('spaceGenBtn').style.display = 'block';
            return;
        }
        document.getElementById('spaceGenError').textContent = err.message;
        document.getElementById('spaceGenBtn').style.display = 'block';
    }
    spaceGenController = null;
}

function spaceCancelGenerate() {
    if (spaceGenController) { spaceGenController.abort(); spaceGenController = null; }
    document.getElementById('spaceGenLoading').style.display = 'none';
    document.getElementById('spaceGenThinkingPreview').style.display = 'none';
    document.getElementById('spaceGenBtn').style.display = 'block';
    document.querySelector('#spaceGenLoading p').textContent = 'Creating your image...';
}

function spaceDiscardGenerated() {
    spaceGeneratedImageData = null;
    document.getElementById('spaceGenPreview').style.display = 'none';
    document.getElementById('spaceGenBtn').style.display = 'block';
}

async function spaceSaveGenerated() {
    if (!spaceGeneratedImageData) return;

    document.getElementById('spaceGenPreview').style.display = 'none';
    document.getElementById('spaceGenLoading').style.display = 'flex';
    document.querySelector('#spaceGenLoading p').textContent = 'Saving to album...';

    try {
        // Convert base64 to blob
        const byteChars = atob(spaceGeneratedImageData.data);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArray], { type: spaceGeneratedImageData.mimeType });

        const photoId = 'gen_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const ref = storage.ref('space/' + photoId);
        await ref.put(blob);
        const url = await ref.getDownloadURL();

        const prompt = document.getElementById('spaceGenPrompt').value.trim();
        await db.collection('spacePhotos').add({
            url, albumId: currentAlbumId,
            caption: prompt, source: 'generated',
            generatedModel: getSelectedNanoBananaLabel(),
            authorId: currentUser.uid, authorName: currentUserName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        spaceGeneratedImageData = null;
        document.getElementById('spaceGenerateModal').classList.remove('visible');
        document.getElementById('spaceGenLoading').style.display = 'none';
        document.querySelector('#spaceGenLoading p').textContent = 'Creating your image...';
    } catch (err) {
        document.getElementById('spaceGenLoading').style.display = 'none';
        document.getElementById('spaceGenError').textContent = 'Save failed: ' + err.message;
        document.getElementById('spaceGenPreview').style.display = 'block';
        document.querySelector('#spaceGenLoading p').textContent = 'Creating your image...';
    }
}

// ═══════ SCENE BUILDER (Firestore synced) ═══════

let scenesData = [];
let scenesUnsub = null;
let editingSceneId = null;
let scenePhotoFile = null;
let scenePhotoPreview = '';
let sceneSelectedMood = '';

function initScenes() {
    if (scenesUnsub) scenesUnsub();
    scenesUnsub = db.collection('scenes').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        scenesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSceneList();
    });
}

function renderSceneList() {
    const container = document.getElementById('sceneList');
    if (scenesData.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#127912;</div><p>No scenes yet. Tap + to capture your first moment from Jade.</p></div>';
        return;
    }
    container.innerHTML = scenesData.map(s => {
        const date = s.createdAt ? new Date(s.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Just now';
        const moodLabel = s.mood ? moodMap[s.mood] || '' : '';
        return '<div class="scene-card" onclick="sceneOpen(\'' + s.id + '\')">' +
            (s.imageUrl ? '<div class="scene-card-image"><img src="' + s.imageUrl + '" alt="" loading="lazy"></div>' : '') +
            '<div class="scene-card-body">' +
                (moodLabel ? '<div class="scene-card-mood" data-mood="' + escapeHtml(s.mood) + '">' + moodLabel + '</div>' : '') +
                '<div class="scene-card-title">' + escapeHtml(s.title || 'Untitled') + '</div>' +
                (s.body ? '<div class="scene-card-preview">' + escapeHtml(s.body) + '</div>' : '') +
                '<div class="scene-card-meta">' + date + ' \u2014 ' + escapeHtml(s.authorName || '') + '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

const moodMap = {
    serene: '\u{1F33F} Serene',
    golden: '\u2600\uFE0F Golden',
    cosy: '\u{1F56F}\uFE0F Cosy',
    romantic: '\u{1F339} Romantic',
    adventure: '\u2728 Adventure',
    misty: '\u{1F32B}\uFE0F Misty'
};

function sceneShowList() {
    document.getElementById('sceneList').style.display = 'flex';
    document.getElementById('sceneDetail').style.display = 'none';
    document.getElementById('sceneEditor').style.display = 'none';
    document.getElementById('sceneNewBtn').style.display = 'flex';
    document.getElementById('sceneTitle').textContent = 'Scene Builder';
    editingSceneId = null;
}

function sceneNew() {
    editingSceneId = null;
    scenePhotoFile = null;
    scenePhotoPreview = '';
    sceneSelectedMood = '';
    document.getElementById('sceneEdTitle').value = '';
    document.getElementById('sceneEdBody').value = '';
    document.getElementById('sceneEditorPreviewImg').style.display = 'none';
    document.getElementById('sceneEditorPlaceholder').style.display = 'flex';
    document.getElementById('sceneRemoveImageBtn').style.display = 'none';
    document.querySelectorAll('#sceneMoodOptions .scene-mood-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('sceneList').style.display = 'none';
    document.getElementById('sceneDetail').style.display = 'none';
    document.getElementById('sceneEditor').style.display = 'block';
    document.getElementById('sceneNewBtn').style.display = 'none';
    document.getElementById('sceneTitle').textContent = 'New Scene';
    document.getElementById('sceneEdTitle').focus();
}

function sceneOpen(id) {
    const scene = scenesData.find(s => s.id === id);
    if (!scene) return;
    editingSceneId = id;

    if (scene.imageUrl) {
        document.getElementById('sceneDetailImg').src = scene.imageUrl;
        document.getElementById('sceneDetailImage').style.display = 'block';
    } else {
        document.getElementById('sceneDetailImage').style.display = 'none';
    }

    const moodLabel = scene.mood ? moodMap[scene.mood] || '' : '';
    document.getElementById('sceneDetailMood').textContent = moodLabel;
    document.getElementById('sceneDetailMood').style.display = moodLabel ? 'block' : 'none';
    document.getElementById('sceneDetailTitle').textContent = scene.title || 'Untitled';
    document.getElementById('sceneDetailText').textContent = scene.body || '';

    const date = scene.createdAt ? new Date(scene.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    document.getElementById('sceneDetailMeta').textContent = (date ? date + ' \u2014 ' : '') + (scene.authorName || '');

    document.getElementById('sceneList').style.display = 'none';
    document.getElementById('sceneDetail').style.display = 'block';
    document.getElementById('sceneEditor').style.display = 'none';
    document.getElementById('sceneNewBtn').style.display = 'none';
    document.getElementById('sceneTitle').textContent = 'Scene';
}

function sceneEdit() {
    const scene = scenesData.find(s => s.id === editingSceneId);
    if (!scene) return;

    document.getElementById('sceneEdTitle').value = scene.title || '';
    document.getElementById('sceneEdBody').value = scene.body || '';
    sceneSelectedMood = scene.mood || '';
    scenePhotoPreview = scene.imageUrl || '';
    scenePhotoFile = null;

    if (scenePhotoPreview) {
        document.getElementById('sceneEditorPreviewImg').src = scenePhotoPreview;
        document.getElementById('sceneEditorPreviewImg').style.display = 'block';
        document.getElementById('sceneEditorPlaceholder').style.display = 'none';
        document.getElementById('sceneRemoveImageBtn').style.display = 'inline-block';
    } else {
        document.getElementById('sceneEditorPreviewImg').style.display = 'none';
        document.getElementById('sceneEditorPlaceholder').style.display = 'flex';
        document.getElementById('sceneRemoveImageBtn').style.display = 'none';
    }

    document.querySelectorAll('#sceneMoodOptions .scene-mood-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mood === sceneSelectedMood);
    });

    document.getElementById('sceneDetail').style.display = 'none';
    document.getElementById('sceneEditor').style.display = 'block';
    document.getElementById('sceneTitle').textContent = 'Edit Scene';
}

function sceneBack() {
    if (document.getElementById('sceneEditor').style.display === 'block') { sceneShowList(); }
    else if (document.getElementById('sceneDetail').style.display === 'block') { sceneShowList(); }
    else { nav('home'); }
}

function sceneCancelEdit() { sceneShowList(); }

function pickSceneMood(mood) {
    sceneSelectedMood = sceneSelectedMood === mood ? '' : mood;
    document.querySelectorAll('#sceneMoodOptions .scene-mood-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mood === sceneSelectedMood);
    });
}

function sceneRemoveImage() {
    scenePhotoFile = null;
    scenePhotoPreview = '';
    document.getElementById('sceneEditorPreviewImg').style.display = 'none';
    document.getElementById('sceneEditorPlaceholder').style.display = 'flex';
    document.getElementById('sceneRemoveImageBtn').style.display = 'none';
}

document.getElementById('sceneImageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please choose an image'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10MB'); return; }
    scenePhotoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        scenePhotoPreview = ev.target.result;
        document.getElementById('sceneEditorPreviewImg').src = scenePhotoPreview;
        document.getElementById('sceneEditorPreviewImg').style.display = 'block';
        document.getElementById('sceneEditorPlaceholder').style.display = 'none';
        document.getElementById('sceneRemoveImageBtn').style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});

async function sceneSave() {
    const title = document.getElementById('sceneEdTitle').value.trim();
    const body = document.getElementById('sceneEdBody').value.trim();
    if (!title && !body) return;

    let imageUrl = '';

    // If editing, keep existing image unless changed or removed
    if (editingSceneId) {
        const existing = scenesData.find(s => s.id === editingSceneId);
        imageUrl = existing ? existing.imageUrl || '' : '';
    }

    // Upload new photo if selected
    if (scenePhotoFile) {
        try {
            const photoId = 'scene_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            const ref = storage.ref('scenes/' + photoId);
            await ref.put(scenePhotoFile);
            imageUrl = await ref.getDownloadURL();
        } catch (err) {
            alert('Image upload failed: ' + err.message);
            return;
        }
    } else if (!scenePhotoPreview) {
        imageUrl = ''; // Image was removed
    }

    const data = {
        title, body, imageUrl,
        mood: sceneSelectedMood,
        authorId: currentUser.uid,
        authorName: currentUserName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editingSceneId) {
        await db.collection('scenes').doc(editingSceneId).update(data);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('scenes').add(data);
    }
    sceneShowList();
}

async function sceneDelete() {
    if (!editingSceneId) return;
    if (!confirm('Delete this scene?')) return;
    await db.collection('scenes').doc(editingSceneId).delete();
    sceneShowList();
}

// ═══════ TIMELINE (Firestore synced) ═══════

let timelineData = [];
let timelineUnsub = null;
let editingTimelineId = null;
let timelineSelectedCat = '';

function initTimeline() {
    if (timelineUnsub) timelineUnsub();
    timelineUnsub = db.collection('timeline').orderBy('eventDate', 'desc').onSnapshot(snapshot => {
        timelineData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTimelineList();
    });
}

const catMap = {
    milestone: '\u2728 Milestone',
    everyday: '\u{1F33F} Everyday',
    love: '\u{1F49A} Love',
    adventure: '\u{1F30E} Adventure',
    home: '\u{1F3E0} Home',
    memory: '\u{1F552} Memory'
};

function renderTimelineList() {
    const container = document.getElementById('timelineList');
    if (timelineData.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#10024;</div><p>No moments yet. Tap + to begin the story of your life in Jade.</p></div>';
        return;
    }

    let html = '';
    let lastYear = '';

    timelineData.forEach(t => {
        const dateStr = t.eventDate || '';
        const year = dateStr ? dateStr.substring(0, 4) : '';
        const displayDate = dateStr ? formatTimelineDate(dateStr) : 'Undated';
        const catLabel = t.category ? catMap[t.category] || '' : '';

        if (year && year !== lastYear) {
            html += '<div class="timeline-year-marker">' + year + '</div>';
            lastYear = year;
        }

        html += '<div class="timeline-card" onclick="timelineOpen(\'' + t.id + '\')">' +
            '<div class="timeline-card-date">' + displayDate + '</div>' +
            (catLabel ? '<div class="timeline-card-cat" data-cat="' + escapeHtml(t.category) + '">' + catLabel + '</div>' : '') +
            '<div class="timeline-card-title">' + escapeHtml(t.title || 'Untitled') + '</div>' +
            (t.body ? '<div class="timeline-card-preview">' + escapeHtml(t.body) + '</div>' : '') +
            '<div class="timeline-card-author">\u2014 ' + escapeHtml(t.authorName || '') + '</div>' +
        '</div>';
    });

    container.innerHTML = html;
}

function formatTimelineDate(dateStr) {
    try {
        const parts = dateStr.split('-');
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

function timelineShowList() {
    document.getElementById('timelineList').style.display = 'block';
    document.getElementById('timelineEditor').style.display = 'none';
    document.getElementById('timelineNewBtn').style.display = 'flex';
    document.getElementById('timelineTitle').textContent = 'Timeline';
    document.getElementById('timelineDeleteBtn').style.display = 'none';
    editingTimelineId = null;
}

function timelineNew() {
    editingTimelineId = null;
    timelineSelectedCat = '';
    document.getElementById('timelineEdDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('timelineEdTitle').value = '';
    document.getElementById('timelineEdBody').value = '';
    document.querySelectorAll('#timelineCatOptions .scene-mood-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('timelineList').style.display = 'none';
    document.getElementById('timelineEditor').style.display = 'block';
    document.getElementById('timelineNewBtn').style.display = 'none';
    document.getElementById('timelineTitle').textContent = 'New Moment';
    document.getElementById('timelineDeleteBtn').style.display = 'none';
    document.getElementById('timelineEdTitle').focus();
}

function timelineOpen(id) {
    const t = timelineData.find(e => e.id === id);
    if (!t) return;
    editingTimelineId = id;

    document.getElementById('timelineEdDate').value = t.eventDate || '';
    document.getElementById('timelineEdTitle').value = t.title || '';
    document.getElementById('timelineEdBody').value = t.body || '';
    timelineSelectedCat = t.category || '';

    document.querySelectorAll('#timelineCatOptions .scene-mood-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mood === timelineSelectedCat);
    });

    document.getElementById('timelineList').style.display = 'none';
    document.getElementById('timelineEditor').style.display = 'block';
    document.getElementById('timelineNewBtn').style.display = 'none';
    document.getElementById('timelineTitle').textContent = 'Edit Moment';
    document.getElementById('timelineDeleteBtn').style.display = 'inline-block';
}

function timelineBack() {
    if (document.getElementById('timelineEditor').style.display === 'block') { timelineShowList(); }
    else { nav('home'); }
}

function timelineCancelEdit() { timelineShowList(); }

function pickTimelineCat(cat) {
    timelineSelectedCat = timelineSelectedCat === cat ? '' : cat;
    document.querySelectorAll('#timelineCatOptions .scene-mood-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mood === timelineSelectedCat);
    });
}

async function timelineSave() {
    const title = document.getElementById('timelineEdTitle').value.trim();
    const body = document.getElementById('timelineEdBody').value.trim();
    const eventDate = document.getElementById('timelineEdDate').value;
    if (!title && !body) return;

    const data = {
        title, body, eventDate,
        category: timelineSelectedCat,
        authorId: currentUser.uid,
        authorName: currentUserName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editingTimelineId) {
        await db.collection('timeline').doc(editingTimelineId).update(data);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('timeline').add(data);
    }
    timelineShowList();
}

async function timelineDelete() {
    if (!editingTimelineId) return;
    if (!confirm('Delete this moment?')) return;
    await db.collection('timeline').doc(editingTimelineId).delete();
    timelineShowList();
}

// ═══════ PERSISTENT MINI PLAYER ═══════

let miniPlayerActive = false;

function playInMiniPlayer(playlistId, name) {
    const player = document.getElementById('miniPlayer');
    const embed = document.getElementById('miniPlayerEmbed');
    const nameEl = document.getElementById('miniPlayerName');

    nameEl.textContent = name || 'Now Playing';
    embed.innerHTML = '<iframe src="https://open.spotify.com/embed/playlist/' + playlistId + '?utm_source=generator&theme=0" ' +
        'width="100%" height="152" frameBorder="0" allowfullscreen="" ' +
        'allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>';

    player.style.display = 'block';
    player.classList.add('expanded');
    document.body.classList.add('mini-player-active');
    miniPlayerActive = true;
}

function closeMiniPlayer() {
    const player = document.getElementById('miniPlayer');
    player.style.display = 'none';
    player.classList.remove('expanded');
    document.getElementById('miniPlayerEmbed').innerHTML = '';
    document.body.classList.remove('mini-player-active');
    miniPlayerActive = false;
}

function toggleMiniPlayerExpand() {
    document.getElementById('miniPlayer').classList.toggle('expanded');
}

document.getElementById('miniPlayerClose').addEventListener('click', closeMiniPlayer);
document.getElementById('miniPlayerExpand').addEventListener('click', toggleMiniPlayerExpand);
document.getElementById('miniPlayerName').parentElement.addEventListener('click', toggleMiniPlayerExpand);

// ── Utility ──
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ═══════ SERVICE WORKER & PUSH NOTIFICATIONS ═══════

const VAPID_KEY = 'BKvcjmwSamrfYoF7RVjsN2OYy6fHq2Uh6014Miwf4hOns3jldzzRuQM-yxqoBR8MCKTdZyztkxH2kNOUcsEdipQ';

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
        console.log('SW registered');
        // Check if already subscribed
        if (currentUser) initPushNotifications(reg);
    }).catch(err => console.log('SW error:', err));
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

async function initPushNotifications(reg) {
    if (!('Notification' in window) || !('PushManager' in window)) {
        console.log('Push not supported');
        updateNotifUI('unsupported');
        return;
    }

    const permission = Notification.permission;
    updateNotifUI(permission);

    if (permission === 'granted') {
        await saveToken(reg);
    }
}

async function requestNotificationPermission() {
    const btn = document.getElementById('notifEnableBtn');
    btn.textContent = 'Enabling...';
    btn.disabled = true;

    try {
        const permission = await Notification.requestPermission();
        updateNotifUI(permission);

        if (permission === 'granted') {
            const reg = await navigator.serviceWorker.ready;
            await saveToken(reg);
        }
    } catch (err) {
        console.error('Notification permission error:', err);
        btn.textContent = 'Error — try again';
        btn.disabled = false;
    }
}

async function saveToken(reg) {
    try {
        const fbMessaging = firebase.messaging();
        const token = await fbMessaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: reg
        });

        if (token) {
            console.log('FCM Token obtained');
            // Save token to Firestore with default preferences
            await db.collection('fcmTokens').doc(token).set({
                token: token,
                userId: currentUser.uid,
                userName: currentUserName,
                affirmations: true,
                journalReminder: true,
                messages: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Load current preferences into UI
            const tokenDoc = await db.collection('fcmTokens').doc(token).get();
            if (tokenDoc.exists) {
                const data = tokenDoc.data();
                document.getElementById('notifAffirmations').checked = data.affirmations !== false;
                document.getElementById('notifJournal').checked = data.journalReminder !== false;
                document.getElementById('notifMessages').checked = data.messages !== false;
            }

            // Store token locally so we can update preferences
            localStorage.setItem('jade_fcm_token', token);
        }
    } catch (err) {
        console.error('Token error:', err);
    }
}

function updateNotifUI(status) {
    const btn = document.getElementById('notifEnableBtn');
    const prefs = document.getElementById('notifPreferences');
    const statusEl = document.getElementById('notifStatus');

    if (status === 'granted') {
        btn.style.display = 'none';
        prefs.style.display = 'block';
        statusEl.textContent = 'Notifications enabled ✓';
        statusEl.style.color = 'var(--jade-primary)';
    } else if (status === 'denied') {
        btn.style.display = 'none';
        prefs.style.display = 'none';
        statusEl.textContent = 'Notifications blocked — enable in your browser/phone settings';
        statusEl.style.color = 'var(--rose)';
    } else if (status === 'unsupported') {
        btn.style.display = 'none';
        prefs.style.display = 'none';
        statusEl.textContent = 'Push notifications are not supported on this device';
        statusEl.style.color = 'var(--text-muted)';
    } else {
        btn.style.display = 'inline-block';
        btn.textContent = 'Enable Notifications';
        btn.disabled = false;
        prefs.style.display = 'none';
        statusEl.textContent = '';
    }
}

async function updateNotifPreference(key, value) {
    const token = localStorage.getItem('jade_fcm_token');
    if (!token) return;
    
    try {
        await db.collection('fcmTokens').doc(token).update({
            [key]: value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.error('Failed to update preference:', err);
    }
}

// Re-init push when user signs in
const originalOnAuth = auth.onAuthStateChanged;
auth.onAuthStateChanged(async (user) => {
    // This runs after the main onAuthStateChanged in the auth section
    if (user && navigator.serviceWorker) {
        const reg = await navigator.serviceWorker.ready;
        initPushNotifications(reg);
    }
});

