/* ============================================
   BadgeScan — Conference Badge → Contact Form
   ============================================ */

// ── DOM refs ────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = {
    camera: $('#screen-camera'),
    processing: $('#screen-processing'),
};

const els = {
    preview: $('#camera-preview'),
    canvas: $('#camera-canvas'),
    btnCapture: $('#btn-capture'),
    btnFile: $('#btn-file'),
    inputFile: $('#input-file'),
    btnRescan: $('#btn-rescan'),
    statusText: $('#status-text'),
    steps: $$('.processing-step'),
    previewWrap: $('#preview-wrap'),
    cameraWrap: $('.camera-wrap'),
    resultThumb: $('#result-thumb'),
    apiKeyModal: $('#modal-apikey'),
    apiKeyInput: $('#input-apikey'),
    confInput: $('#input-conference'),
    btnSaveKey: $('#btn-save-key'),
    // Camera screen extras
    counterNum: $('#counter-num'),
    exportSection: $('#export-section'),
    btnExport: $('#btn-export'),
    btnExportImages: $('#btn-export-images'),
    btnClear: $('#btn-clear'),
    // Form fields
    fSalutation: $('#f-salutation'),
    fName: $('#f-name'),
    fCity: $('#f-city'),
    fState: $('#f-state'),
    fTitle: $('#f-title'),
    fCompany: $('#f-company'),
    fEmail: $('#f-email'),
    fPhone: $('#f-phone'),
    fNotes: $('#f-notes'),
    emailConf: $('#email-confidence'),
    contactForm: $('#contact-form'),
};

let stream = null;
let currentImage = null;
let _currentParsed = null;  // parsed badge data from OCR, merged on save
let _formEdited = false; // track if human edited before save

// ── Local Database Mock ───────────────────────────
const LOCAL_DB = [
    { inst: "OHSU", city: "Portland", state: "OR", domain: "ohsu.edu", fmt: "firstlast", type: "hospital" },
    { inst: "Pacific University", city: "Portland", state: "OR", domain: "pacificu.edu", fmt: "first.last", type: "program" },
    { inst: "Legacy Health", city: "Portland", state: "OR", domain: "lhs.org", fmt: "first.last", type: "hospital" },
    { inst: "Providence Portland", city: "Portland", state: "OR", domain: "providence.org", fmt: "first.last", type: "hospital" },
    { inst: "Duke University", city: "Durham", state: "NC", domain: "duke.edu", fmt: "first.last", type: "program" },
    { inst: "UNC Health", city: "Chapel Hill", state: "NC", domain: "unchealth.org", fmt: "first.last", type: "hospital" },
    { inst: "UCSF", city: "San Francisco", state: "CA", domain: "ucsf.edu", fmt: "firstlast", type: "program" },
    { inst: "Kaiser Permanente", city: "San Francisco", state: "CA", domain: "kp.org", fmt: "first.last", type: "hospital" },
    { inst: "University of Washington", city: "Seattle", state: "WA", domain: "uw.edu", fmt: "firstlast", type: "program" },
    { inst: "Swedish Medical Center", city: "Seattle", state: "WA", domain: "swedish.org", fmt: "first.last", type: "hospital" }
];

// ── Contact Store (OPFS) ──────────────────────────
// All contacts + badge images live in OPFS:
//   contacts/{uuid}/contact.json  — the contact record
//   contacts/{uuid}/badge.jpg     — the badge photo
// localStorage holds only a lightweight index [{id, name}] for fast UI.
// An in-memory cache avoids making every read async.

const CONTACTS_DIR = 'contacts';
let _contactsCache = [];      // full contact objects, kept in sync with OPFS
let _contactsReady = false;   // true after init() finishes loading

async function _contactsRoot() {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(CONTACTS_DIR, { create: true });
}

async function _contactDir(contactId) {
    const root = await _contactsRoot();
    return root.getDirectoryHandle(contactId, { create: true });
}

async function _writeJSON(handle, name, obj) {
    const file = await handle.getFileHandle(name, { create: true });
    const w = await file.createWritable();
    await w.write(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
    await w.close();
}

async function _readJSON(handle, name) {
    try {
        const file = await handle.getFileHandle(name);
        const f = await file.getFile();
        return JSON.parse(await f.text());
    } catch {
        return null;
    }
}

async function _writeBlob(handle, name, blob) {
    const file = await handle.getFileHandle(name, { create: true });
    const w = await file.createWritable();
    await w.write(blob);
    await w.close();
}

async function _readBlob(handle, name) {
    try {
        const file = await handle.getFileHandle(name);
        return await file.getFile();
    } catch {
        return null;
    }
}

// ── Save / Load contacts ──────────────────────────
async function _saveIndex() {
    // Thin index for fast counter updates (no async needed after init)
    const idx = _contactsCache.map(c => ({ id: c.id, name: c.name }));
    localStorage.setItem('badgescan_index', JSON.stringify(idx));
}

async function storeContact(contact, imageBlob) {
    const id = contact.id || crypto.randomUUID();
    contact.id = id;

    const dir = await _contactDir(id);
    await _writeJSON(dir, 'contact.json', contact);
    if (imageBlob) {
        await _writeBlob(dir, 'badge.jpg', imageBlob);
    }

    // Update in-memory cache
    const existing = _contactsCache.findIndex(c => c.id === id);
    if (existing >= 0) {
        _contactsCache[existing] = contact;
    } else {
        _contactsCache.unshift(contact);
    }

    await _saveIndex();
    updateCounter();
    return id;
}

async function deleteContact(contactId) {
    try {
        const root = await _contactsRoot();
        await root.removeEntry(contactId, { recursive: true });
    } catch { /* already gone */ }

    _contactsCache = _contactsCache.filter(c => c.id !== contactId);
    await _saveIndex();
    updateCounter();
}

async function clearAllContacts() {
    if (!confirm('Delete all scanned contacts? This cannot be undone.')) return;

    try {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(CONTACTS_DIR, { recursive: true });
    } catch { /* already gone */ }

    _contactsCache = [];
    localStorage.removeItem('badgescan_index');
    updateCounter();
    toast('All contacts cleared');
}

async function loadAllContacts() {
    // Read every contact.json from OPFS and populate the cache.
    // Called once during init.
    const contacts = [];
    try {
        const root = await _contactsRoot();
        for await (const [name, handle] of root.entries()) {
            if (handle.kind !== 'directory') continue;
            const data = await _readJSON(handle, 'contact.json');
            if (data) contacts.push(data);
        }
    } catch {
        // No contacts yet — that's fine
    }

    // Sort by captured_at descending (newest first)
    contacts.sort((a, b) => (b.captured_at || '').localeCompare(a.captured_at || ''));
    _contactsCache = contacts;
    _contactsReady = true;
    await _saveIndex();
    updateCounter();
}

// ── Sync getters (fast, from in-memory cache) ─────
function getContacts() {
    return _contactsCache;
}

// ── Image helpers ──────────────────────────────────
async function getContactImage(contactId) {
    try {
        const dir = await _contactDir(contactId);
        return await _readBlob(dir, 'badge.jpg');
    } catch {
        return null;
    }
}

// ── CSV Export (now async, reads from OPFS) ────────
async function exportCSV() {
    const contacts = getContacts();
    if (!contacts.length) return toast('No contacts to export', true);

    const headers = ['Name', 'Credentials', 'Salutation', 'Title', 'Specialty', 'Company', 'Email', 'Phone', 'City', 'State', 'Notes', 'Captured', 'AI_Enriched'];
    const rows = contacts.map((c) =>
        [
            c.name, c.credentials, c.salutation, c.title, c.specialty,
            c.company, c.email, c.phone, c.city, c.state, c.notes, c.captured_at,
            c.version === 2 ? 'Yes (v2)' : (c.enriched ? 'Yes (Has v2)' : 'No')
        ].map((v) => `"${(v || '').replace(/"/g, '""')}"`).join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `badgescan-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${contacts.length} contacts`);
}

// ── Image Export (reads from OPFS contact dirs) ────
async function exportAllImages() {
    const contacts = getContacts();
    let count = 0;

    // Try directory picker first (Chrome/Edge)
    if (typeof showDirectoryPicker === 'function') {
        try {
            const dirHandle = await showDirectoryPicker({ mode: 'readwrite' });
            for (const contact of contacts) {
                const img = await getContactImage(contact.id);
                if (!img) continue;
                const safeName = (contact.name || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
                const fileName = `${safeName}_${contact.id}.jpg`;
                const fh = await dirHandle.getFileHandle(fileName, { create: true });
                const w = await fh.createWritable();
                await w.write(img);
                await w.close();
                count++;
            }
            toast(`Saved ${count} badge images to folder`);
            return count;
        } catch (err) {
            if (err.name === 'AbortError') return 0;
            console.error('Directory picker failed, falling back to downloads:', err);
        }
    }

    // Fallback: download one at a time
    for (const contact of contacts) {
        const img = await getContactImage(contact.id);
        if (!img) continue;
        const safeName = (contact.name || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
        const url = URL.createObjectURL(img);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}_${contact.id}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
        count++;
        await new Promise(r => setTimeout(r, 150));
    }

    if (count > 0) toast(`Downloaded ${count} badge images`);
    return count;
}

// ── Migration: move old localStorage contacts + images into OPFS ──
async function _migrateOldData() {
    // Check if OPFS already has contacts
    let hasExisting = false;
    try {
        const root = await _contactsRoot();
        for await (const [_name, handle] of root.entries()) {
            if (handle.kind === 'directory') { hasExisting = true; break; }
        }
    } catch {}

    if (hasExisting) return; // already migrated or fresh OPFS

    // Try to move old localStorage contacts
    const oldContacts = (() => {
        try { return JSON.parse(localStorage.getItem('badgescan_contacts') || '[]'); }
        catch { return []; }
    })();

    // Try to move old flat image store
    const OLD_IMAGE_DIR = 'badge_images';
    const imageMap = new Map(); // image_id → Blob
    try {
        const root = await navigator.storage.getDirectory();
        const oldImgDir = await root.getDirectoryHandle(OLD_IMAGE_DIR);
        for await (const [name, handle] of oldImgDir.entries()) {
            if (!name.endsWith('.jpg')) continue;
            const id = name.replace('.jpg', '');
            const file = await handle.getFile();
            imageMap.set(id, file);
        }
    } catch { /* no old images */ }

    if (oldContacts.length === 0) return;

    for (const contact of oldContacts) {
        if (!contact.id) contact.id = contact.image_id || crypto.randomUUID();
        const img = contact.image_id ? (imageMap.get(contact.image_id) || null) : null;
        await storeContact(contact, img);
    }

    // Remove old data so we don't double-migrate
    localStorage.removeItem('badgescan_contacts');
    try {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(OLD_IMAGE_DIR, { recursive: true });
    } catch {}
}

// ── Screen navigation ────────────────────────────
function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
}

// ── Toast ─────────────────────────────────────────
function toast(msg, isError = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
}

// ── API Key management ───────────────────────────
function getApiKey() {
    return localStorage.getItem('badgescan_openai_key') || '';
}

function setApiKey(key) {
    localStorage.setItem('badgescan_openai_key', key.trim());
}

// ── Conference name ──────────────────────────────
function getConference() {
    return localStorage.getItem('badgescan_conference') || '';
}

function setConference(name) {
    localStorage.setItem('badgescan_conference', name.trim());
}

// ── Counter (sync, uses in-memory cache) ───────────
function updateCounter() {
    const count = getContacts().length;
    if (els.counterNum) els.counterNum.textContent = count;
    if (els.exportSection) {
        els.exportSection.classList.toggle('hidden', count === 0);
    }
}

// ── Track human edits ────────────────────────────
els.contactForm.addEventListener('input', () => {
    _formEdited = true;
});

// ── Camera ────────────────────────────────────────
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
        });
        els.preview.srcObject = stream;
        els.btnCapture.disabled = false;
        els.statusText.textContent = '';
        
        // Reset UI state
        els.cameraWrap.style.display = 'block';
        els.previewWrap.style.display = 'none';
        
    } catch (err) {
        console.error('Camera error:', err);
        if (err.name === 'NotAllowedError') {
            els.statusText.textContent = 'Camera access denied. Please allow camera in settings.';
        } else if (err.name === 'NotFoundError') {
            els.statusText.textContent = 'No camera found. Use Upload Photo instead.';
        } else {
            els.statusText.textContent = 'Camera error: ' + err.message;
        }
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
    }
    els.preview.srcObject = null;
}

// ── Image Sharpness (Laplacian Variance) ──────────
function computeLaplacianVariance(canvas, ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const grayscale = new Float32Array(width * height);
    
    // Convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
        grayscale[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
    
    const laplacian = new Float32Array(width * height);
    let mean = 0;
    
    // Apply 3x3 Laplacian filter
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const val = grayscale[idx] * 4
                        - grayscale[idx - 1]
                        - grayscale[idx + 1]
                        - grayscale[idx - width]
                        - grayscale[idx + width];
            laplacian[idx] = val;
            mean += val;
        }
    }
    
    const count = (width - 2) * (height - 2);
    mean /= count;
    
    let variance = 0;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const val = laplacian[y * width + x];
            variance += (val - mean) * (val - mean);
        }
    }
    return variance / count;
}

async function captureBurst() {
    const video = els.preview;
    const canvas = els.canvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const frames = [];
    const NUM_FRAMES = 3;
    
    for (let i = 0; i < NUM_FRAMES; i++) {
        ctx.drawImage(video, 0, 0);
        // We only need to check sharpness of a smaller central crop to be fast
        const cropW = Math.floor(canvas.width * 0.5);
        const cropH = Math.floor(canvas.height * 0.5);
        const startX = Math.floor(canvas.width * 0.25);
        const startY = Math.floor(canvas.height * 0.25);
        
        // Use a temporary canvas for the crop
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cropW;
        tempCanvas.height = cropH;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCtx.drawImage(canvas, startX, startY, cropW, cropH, 0, 0, cropW, cropH);
        
        const variance = computeLaplacianVariance(tempCanvas, tempCtx, cropW, cropH);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        frames.push({ variance, dataUrl });
        
        // Wait ~100ms between frames
        if (i < NUM_FRAMES - 1) {
            await new Promise(r => setTimeout(r, 100));
        }
    }
    
    // Sort by descending variance (sharpest first)
    frames.sort((a, b) => b.variance - a.variance);
    return frames[0].dataUrl;
}

// ── Local Database Lookup ─────────────────────────
function localDbLookup(parsed) {
    const city = (parsed.city || els.fCity.value).trim().toLowerCase();
    const state = (parsed.state || els.fState.value).trim().toLowerCase();
    const company = (parsed.company || els.fCompany.value).trim().toLowerCase();

    // If we have an explicitly stated company on the badge, check if it's in our DB
    if (company) {
        const match = LOCAL_DB.find(db => company.includes(db.inst.toLowerCase()));
        if (match) return [match];
    }

    if (!city || !state) return [];

    // Find all institutions in that city+state
    const candidates = LOCAL_DB.filter(db => 
        db.city.toLowerCase() === city && 
        db.state.toLowerCase() === state
    );
    
    return candidates;
}

// ── Helpers ───────────────────────────────────────
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            // Strip the prefix (data:image/jpeg;base64,)
            const comma = dataUrl.indexOf(',');
            resolve(dataUrl.slice(comma + 1));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function dataURLtoBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const bytes = atob(parts[1]);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

function setStep(index, status) {
    const el = els.steps[index];
    if (!el) return;
    el.classList.remove('pending', 'done');
    if (status === 'in_progress') {
        el.classList.add('pending');
        el.textContent = el.textContent.replace('✅', '').replace('📸', '📷').trim();
    } else if (status === 'done') {
        el.classList.add('done');
        // Replace icon with checkmark
        const icons = ['📷', '🔍', '📧'];
        const doneIcons = ['✅', '✅', '✅'];
        const text = el.textContent.replace(icons[index], doneIcons[index]);
        el.textContent = text;
    }
}

// ── Extract JSON string from AI response ──────────
function extractJSON(text) {
    let s = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    // Find JSON object boundaries
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end > start) {
        s = s.slice(start, end + 1);
    }

    // Replace literal newlines in string values with \n
    // Pattern: inside double-quoted strings, turn real newlines into \n
    let fixed = '';
    let inString = false;
    let escapeNext = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (escapeNext) {
            fixed += ch;
            escapeNext = false;
            continue;
        }
        if (ch === '\\') {
            fixed += ch;
            escapeNext = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            fixed += ch;
            continue;
        }
        if (inString && ch === '\n') {
            fixed += '\\n';
            continue;
        }
        if (inString && ch === '\r') {
            fixed += '\\r';
            continue;
        }
        if (inString && ch === '\t') {
            fixed += '\\t';
            continue;
        }
        fixed += ch;
    }

    try {
        return JSON.parse(fixed);
    } catch (e) {
        console.error('JSON parse failed. Original:', s.slice(0, 200));
        console.error('Fixed:', fixed.slice(0, 200));
        return null;
    }
}

// ── Extract text from Responses API output ────────
function debugOut(msg) {
    const el = $('#debug-out');
    if (!el) return;
    el.style.display = 'block';
    el.textContent += msg + '\n';
}

function getResponseText(data) {
    debugOut('=== RAW RESPONSE ===');
    debugOut(JSON.stringify(data, null, 1).slice(0, 2000));

    // Recursively walk the JSON tree. Return the first string
    // longer than 20 characters found in a "text", "value",
    // "content", or "output_text" field.
    const candidates = [];

    function walk(obj, depth) {
        if (depth > 20 || !obj) return;
        if (Array.isArray(obj)) {
            for (const item of obj) walk(item, depth + 1);
            return;
        }
        if (typeof obj !== 'object') return;
        for (const [key, val] of Object.entries(obj)) {
            if (typeof val === 'string' && val.length > 20) {
                // Prioritize known output keys
                const isOutputKey = /^(text|value|content|output_text|body)$/i.test(key);
                candidates.push({ text: val, key: key, priority: isOutputKey ? 1 : 2 });
            }
            if (typeof val === 'object' && val !== null) {
                walk(val, depth + 1);
            }
        }
    }

    walk(data, 0);

    // Sort: priority first, then longest text
    candidates.sort((a, b) => a.priority - b.priority || b.text.length - a.text.length);

    if (candidates.length > 0) {
        const best = candidates[0].text;
        debugOut('=== EXTRACTED (' + candidates[0].key + ') ===');
        debugOut(best.slice(0, 500));
        return best;
    }

    debugOut('!!! NO TEXT FOUND IN RESPONSE !!!');
    throw new Error('No text found in response output');
}

// ── OpenAI: Parse badge image ────────────────────
async function parseBadgeImage(imageBlob) {
    const base64 = await blobToBase64(imageBlob);

    const instructions = `You are a badge scanner for a conference contact capture app.
Analyze this image of an AAPA conference badge.
Return ONLY valid JSON — no markdown, no code fences, just the raw JSON object.

BADGE LAYOUT (top to bottom):
  Line 1: Conference name — "AAPA 2026" (the event, NOT the employer)
  Line 2: FIRST NAME in large bold text
  Line 3: LAST NAME followed by credentials (PA-C, MD, DO, NP, RN, etc.)
  Line 4: Specialty (e.g. "Hematology and Oncology", "Pediatrics", "Family Medicine")
  Line 5: CITY, STATE (the person's work location)
  Below line 5: QR code, sponsor ads, badge access level — ALL MEANINGLESS, IGNORE EVERYTHING BELOW LINE 5

CRITICAL RULES:
- The company/employer name is NOT printed on this badge. Do not guess it here.
  Set "company" to null unless you literally see an employer name printed on the badge.
- CREDENTIALS (PA-C, MD, DO, etc.) are part of the title field, appended after the name.
  Parse them out — do not leave them in the name field.
- "AAPA 2026" is the CONFERENCE, not the company. Never use it as the company.
- QR codes and anything near them are noise. Ignore them completely.

Fields to extract:
{
  "salutation": "Dr./Prof./Mr./Ms. or null",
  "name": "Full name WITHOUT credentials (e.g. 'Jane Smith', not 'Jane Smith PA-C')",
  "credentials": "PA-C, MD, DO, NP, RN, etc. or null",
  "title": "Job title/role if shown (e.g. 'Director', 'Dean', 'Associate Professor') or null",
  "specialty": "Medical specialty if shown (e.g. 'Hematology and Oncology', 'Pediatrics') or null",
  "company": "ONLY set to a company name if one is explicitly printed on the badge. Otherwise null.",
  "city": "City from the badge (e.g. 'Durham') or null",
  "state": "State abbreviation from the badge (e.g. 'NC') or null",
  "phone": "Phone number if visible or null",
  "raw_text": "All meaningful text visible on the badge (exclude QR codes and ads below city/state)"
}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
            model: 'gpt-5.5',
            instructions: instructions,
            input: [
                {
                    type: 'message',
                    role: 'user',
                    content: [
                        {
                            type: 'input_image',
                            image_url: `data:image/jpeg;base64,${base64}`,
                            detail: 'high',
                        },
                        { type: 'input_text', text: 'Extract contact details from this badge.' },
                    ],
                },
            ],
            max_output_tokens: 800,

        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error (${response.status})`);
    }

    const data = await response.json();
    const content = getResponseText(data);
    return extractJSON(content);
}

// ── OpenAI: Institution resolver + email lookup ────
// When company is on the badge, uses it directly. When not, searches for
// teaching hospitals / universities with PA programs in the given city+state
// and matches the person.
async function resolveInstitution(parsed) {
    const { name, company, title, credentials, specialty, city, state } = parsed;

    // Branch 1: company is known — straightforward email lookup
    if (company) {
        return lookupEmailSimple(name, company);
    }

    // Branch 2: no company — must resolve institution from city+state+specialty
    const location = city && state ? `${city}, ${state}` : (city || state || 'unknown location');
    const spec = specialty || 'unknown specialty';
    const creds = credentials || 'PA';
    const role = title || '';

    const instructions = `You are a medical conference lead-capture assistant.
Your job: given a person at the AAPA 2026 conference, find their employer and email.

PERSON DETAILS:
  Name: ${name}
  Credentials: ${creds}
  Title/Role: ${role || 'not listed'}
  Specialty: ${spec}
  Location (from badge): ${location}

CRITICAL — WHAT TO DO:

Step 1: Identify the most likely employer.
  This person works in ${location}. Find teaching hospitals and medical universities
  in ${location} that have a PA program (Physician Assistant program).
  This is a PA conference — the person almost certainly works at an institution
  that trains PAs or employs PAs in a teaching hospital setting.

  Use web_search. Search queries to try:
  - "${location} teaching hospital PA program"
  - "${location} medical university physician assistant program"
  - "${location} academic medical center"
  - "${name} ${location}"

  Narrow to the 1-2 most likely institutions based on the person's specialty
  (${spec}) and the fact they're at AAPA.

Step 2: Match the person to that institution.
  Search for "${name}" at the institution you identified. Try:
  - "${name}" combined with the institution name
  - "${name} PA" or "${name} ${creds}" combined with the institution name
  - "${name} ${location}"

Step 3: Find their email.
  Same approach — look for public listings, directory pages, or determine
  the institution's email format and construct the best guess.
  If you find the institution's standard email format (e.g. first.last@ohsu.edu),
  apply it. If you find the person on a directory page, use that email directly.

IMPORTANT RULES:
- Only consider teaching hospitals and medical schools/universities WITH a PA program.
- If ${location} is Portland, OR — OHSU is a major teaching hospital there. Duke in
  Durham, NC. UCSF in San Francisco. Use your web_search to find the right one.
- Do NOT pick random clinics, private practices, or non-teaching hospitals.
- If you cannot find a match, pick the most likely teaching hospital in
  ${location} and guess the email using its naming convention.
- You MUST search the web. Do not guess without searching.
- NEVER use placeholder text like "institution.edu" — always produce a real domain
  from your web search results.

Return ONLY valid JSON — no markdown, no code fences, just the raw JSON object:
{
  "company": "The actual institution name you found",
  "email": "The actual email you derived (e.g. jane.smith@ohsu.edu)",
  "confidence": "high|medium|low",
  "reasoning": "One sentence explaining which institution you found and how you derived the email"
}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
            model: 'gpt-5.5',
            instructions: instructions,
            input: [
                {
                    type: 'message',
                    role: 'user',
                    content: [
                        { type: 'input_text', text: `Resolve the employer and email for ${name} (${creds}) who practices ${spec} in ${location}.` },
                    ],
                },
            ],
            tools: [{ type: 'web_search' }],
            max_output_tokens: 800,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error (${response.status})`);
    }

    const data = await response.json();
    const content = getResponseText(data);
    return extractJSON(content);
}

// ── Simple email lookup (when company is already known) ──
async function lookupEmailSimple(name, company) {
    const instructions = `You are an email lookup assistant for a conference contact app.
Given a person's name and company, find their work email address.

IMPORTANT: You MUST use the web_search tool to search for this person's email.
Search queries to try (in order):
1. "${name} ${company} email" — find their actual email if publicly listed
2. "${company} email format" — determine the company's email naming convention
3. "${company} ${name} linkedin" — find their LinkedIn for title/email hints

After searching, synthesize what you find into the best email guess.
If you found an actual email, use it. If not, use the company's naming pattern.
NEVER use placeholder values — always provide a real email guess.

Common patterns to consider: first@company.com, first.last@company.com,
firstinitiallast@company.com, first_last@company.com.

Also provide a confidence level and one-sentence reasoning about what you found.

Return ONLY valid JSON — no markdown, no code fences, just the raw JSON object:
{
  "email": "actual_email_guess@company.com",
  "confidence": "high|medium|low",
  "reasoning": "One sentence explaining what you found from web search"
}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
            model: 'gpt-5.5',
            instructions: instructions,
            input: [
                {
                    type: 'message',
                    role: 'user',
                    content: [
                        { type: 'input_text', text: `Name: ${name}\nCompany: ${company}\n\nSearch the web and find the most likely work email for this person.` },
                    ],
                },
            ],
            tools: [{ type: 'web_search' }],
            max_output_tokens: 600,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error (${response.status})`);
    }

    const data = await response.json();
    const content = getResponseText(data);
    return extractJSON(content);
}

// ── Background Enrichment Queue ───────────────────
const ENRICHMENT_QUEUE_KEY = 'badgescan_enrichment_queue';

function getEnrichmentQueue() {
    try {
        return JSON.parse(localStorage.getItem(ENRICHMENT_QUEUE_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveEnrichmentQueue(queue) {
    localStorage.setItem(ENRICHMENT_QUEUE_KEY, JSON.stringify(queue));
}

function enqueueForEnrichment(contact) {
    const queue = getEnrichmentQueue();
    if (!queue.includes(contact.id)) {
        queue.push(contact.id);
        saveEnrichmentQueue(queue);
    }
    
    // Kick off processing if not already running
    processEnrichmentQueue();
}

let _isProcessingQueue = false;

async function processEnrichmentQueue() {
    if (_isProcessingQueue) return;
    _isProcessingQueue = true;

    try {
        let queue = getEnrichmentQueue();
        while (queue.length > 0) {
            const contactId = queue[0];
            
            // Re-fetch the full contact from cache just to be sure we have the latest
            const contacts = getContacts();
            const contact = contacts.find(c => c.id === contactId);
            
            if (contact && !contact.edited && !contact.enriched && contact.version === 1) {
                try {
                    console.log(`Background enriching contact: ${contact.name}...`);
                    
                    const result = await resolveInstitution({
                        name: contact.name,
                        company: contact.company,
                        title: contact.title,
                        credentials: contact.credentials,
                        specialty: contact.specialty,
                        city: contact.city,
                        state: contact.state
                    });
                    
                    if (result && (result.company || result.email)) {
                        // Create v2 contact
                        const v2Contact = { ...contact };
                        // Remove the original ID so it gets a new one
                        delete v2Contact.id;
                        v2Contact.company = result.company || contact.company;
                        v2Contact.email = result.email || contact.email;
                        
                        // Add confidence reasoning to notes
                        if (result.reasoning) {
                            v2Contact.notes = (v2Contact.notes ? v2Contact.notes + '\n\n' : '') + `AI Enriched v2 (${result.confidence} confidence): ${result.reasoning}`;
                        } else {
                            v2Contact.notes = (v2Contact.notes ? v2Contact.notes + '\n\n' : '') + `AI Enriched v2`;
                        }
                        
                        v2Contact.version = 2;
                        v2Contact.original_version = contact.id;
                        v2Contact.edited = false;
                        v2Contact.enriched = false; // v2 itself isn't enriched further
                        v2Contact.captured_at = new Date().toISOString(); // Give it a new timestamp
                        
                        // Copy image from v1
                        const img = await getContactImage(contact.id);
                        
                        // Save v2
                        await storeContact(v2Contact, img);
                        
                        // Mark v1 as enriched
                        contact.enriched = true;
                        // For v1, we don't need to re-save the image, just the json
                        await storeContact(contact, null); 
                        console.log(`Enrichment complete for ${contact.name} -> v2 created.`);
                    }
                } catch (err) {
                    console.error(`Enrichment failed for ${contact.name}:`, err);
                    // On error, drop it to prevent infinite loop for now
                }
            }
            
            // Remove from queue
            queue = getEnrichmentQueue();
            queue.shift(); // remove the first item we just processed
            saveEnrichmentQueue(queue);
            
            // Small delay between processing
            await new Promise(r => setTimeout(r, 2000));
        }
    } finally {
        _isProcessingQueue = false;
    }
}

// ── Show result screen ────────────────────────────
function showResult(parsed, imageBlob) {
    // Hide camera, show thumbnail
    els.cameraWrap.style.display = 'none';
    els.previewWrap.style.display = 'block';

    const url = URL.createObjectURL(imageBlob);
    els.resultThumb.src = url;

    // Merge logic: only overwrite if field is empty
    if (!els.fSalutation.value) els.fSalutation.value = parsed.salutation || '';
    if (!els.fName.value) els.fName.value = parsed.name || '';
    if (!els.fCity.value) els.fCity.value = parsed.city || '';
    if (!els.fState.value) els.fState.value = parsed.state || '';
    if (!els.fTitle.value) els.fTitle.value = parsed.title || '';
    if (!els.fCompany.value) els.fCompany.value = parsed.company || '';
    if (!els.fEmail.value) els.fEmail.value = parsed.email || '';
    if (!els.fPhone.value) els.fPhone.value = parsed.phone || '';

    // Build notes from badge metadata
    if (!els.fNotes.value) {
        const parts = [];
        if (parsed.credentials) parts.push(parsed.credentials);
        if (parsed.specialty) parts.push(parsed.specialty);
        if (parsed.city && parsed.state) parts.push(`${parsed.city}, ${parsed.state}`);
        else if (parsed.city) parts.push(parsed.city);
        else if (parsed.state) parts.push(parsed.state);
        
        els.fNotes.value = parts.length
            ? `Met at ${getConference() || 'conference'}. Badge: ${parts.join(' — ')}`
            : `Met at ${getConference() || 'conference'}.`;
    }

    // Email confidence indicator
    if (parsed.email_confidence) {
        els.emailConf.textContent =
            parsed.email_confidence === 'high' ? '✓ High confidence guess' :
                parsed.email_confidence === 'medium' ? '⚠ Medium confidence — verify please' :
                    '⚠ Low confidence — please verify';
        els.emailConf.className = 'email-confidence ' +
            (parsed.email_confidence === 'high' ? 'confident' :
                parsed.email_confidence === 'low' ? 'uncertain' : 'uncertain');
    } else if (parsed.db_guess) {
        els.emailConf.textContent = parsed.db_guess;
        els.emailConf.className = 'email-confidence uncertain';
    } else {
        els.emailConf.textContent = '';
    }

    // Stash parsed data for merge on save
    _currentParsed = parsed;

    // Show camera screen (form is now part of it)
    showScreen('camera');
}

// ── Process image ─────────────────────────────────
async function processImage(imageBlob) {
    showScreen('processing');

    // Reset step states
    els.steps.forEach((s) => {
        s.classList.add('pending');
        s.classList.remove('done');
    });
    els.steps[0].textContent = '📷 Reading badge...';
    els.steps[1].textContent = '🔍 Local Database Lookup...';

    try {
        // Step 1: OCR / parse badge with Vision
        setStep(0, 'in_progress');
        const parsedData = await parseBadgeImage(imageBlob);
        setStep(0, 'done');

        // Step 2: Verify we got useful data
        if (!parsedData || (!parsedData.name && !els.fName.value)) {
            setStep(0, 'done');
            throw new Error('Could not read a name from the badge. Try a clearer photo or type it manually.');
        }
        
        // Phase 1: Local DB Lookup (Instant)
        setStep(1, 'in_progress');
        const candidates = localDbLookup(parsedData);
        if (candidates.length > 0) {
            const best = candidates[0];
            if (!parsedData.company) parsedData.company = best.inst;
            
            // Generate best guess format
            let emailGuess = '';
            const names = (parsedData.name || els.fName.value).split(' ');
            if (names.length >= 2 && best.domain) {
                const f = names[0].toLowerCase();
                const l = names[names.length - 1].toLowerCase();
                if (best.fmt === 'firstlast') emailGuess = `${f}${l}@${best.domain}`;
                else if (best.fmt === 'first.last') emailGuess = `${f}.${l}@${best.domain}`;
            }
            if (!parsedData.email) parsedData.email = emailGuess;
            
            if (candidates.length > 1) {
                const others = candidates.slice(1, 4).map(c => c.inst).join(', ');
                parsedData.db_guess = `Best guess - ${best.inst}. Also possible: ${others}`;
            } else {
                parsedData.db_guess = `Matched from local DB: ${best.inst}`;
            }
        }
        setStep(1, 'done');

        // Show result on the camera screen
        showResult(parsedData, imageBlob);

    } catch (err) {
        console.error('Processing error:', err);
        toast(err.message || 'Something went wrong. Please try again.', true);
        showScreen('camera');
    }
}

// ── Event: Capture button ─────────────────────────
els.btnCapture.addEventListener('click', async () => {
    els.btnCapture.disabled = true;
    try {
        const dataUrl = await captureBurst();
        currentImage = dataURLtoBlob(dataUrl);
        processImage(currentImage);
    } catch (err) {
        console.error('Capture burst failed', err);
        toast('Camera capture failed', true);
        els.btnCapture.disabled = false;
    }
});

// ── Event: File upload ────────────────────────────
els.btnFile.addEventListener('click', () => els.inputFile.click());

els.inputFile.addEventListener('change', () => {
    const file = els.inputFile.files[0];
    if (!file) return;
    currentImage = file;
    processImage(file);
    els.inputFile.value = '';
});

// ── Event: Rescan ─────────────────────────────────
els.btnRescan.addEventListener('click', () => {
    showScreen('camera');
    startCamera();
});

// ── Event: Save contact ───────────────────────────
els.contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Build contact, merging form fields with OCR-derived data
    const contact = {
        name: els.fName.value.trim(),
        salutation: els.fSalutation.value.trim(),
        city: els.fCity.value.trim(),
        state: els.fState.value.trim(),
        title: els.fTitle.value.trim(),
        company: els.fCompany.value.trim(),
        email: els.fEmail.value.trim(),
        phone: els.fPhone.value.trim(),
        notes: els.fNotes.value.trim(),
        // Fields from badge OCR (not in the form)
        credentials: _currentParsed?.credentials || '',
        specialty: _currentParsed?.specialty || '',
        captured_at: new Date().toISOString(),
        
        // Phase 2 architecture metadata
        version: 1,
        edited: _formEdited,
        enriched: false,
        original_version: null
    };

    if (!contact.name) {
        toast('Name is required', true);
        return;
    }

    // Store contact + badge image in OPFS
    const id = await storeContact(contact, currentImage || null);
    contact.id = id;
    toast(`Saved: ${contact.name}`);

    // If human didn't edit it (aside from maybe pre-filling, but we tracked any input as edit), queue for background enrichment
    if (!contact.edited) {
        enqueueForEnrichment(contact);
    }

    // Reset and go back to camera
    currentImage = null;
    _currentParsed = null;
    _formEdited = false;
    els.contactForm.reset();
    els.emailConf.textContent = '';
    showScreen('camera');
    startCamera();
});

// ── Event: Export CSV ──────────────────────────────
els.btnExport.addEventListener('click', () => {
    exportCSV().catch(err => toast('Export failed: ' + err.message, true));
});

// ── Event: Export Images ──────────────────────────
els.btnExportImages.addEventListener('click', () => {
    exportAllImages().catch(err => toast('Image export failed: ' + err.message, true));
});

// ── Event: Clear All ──────────────────────────────
els.btnClear.addEventListener('click', () => {
    clearAllContacts().catch(err => toast('Clear failed: ' + err.message, true));
});

// ── API Key modal ─────────────────────────────────
$('#btn-apikey').addEventListener('click', () => {
    els.apiKeyInput.value = getApiKey();
    els.confInput.value = getConference();
    els.apiKeyModal.classList.add('active');
});

$('.modal-bg').addEventListener('click', () => {
    els.apiKeyModal.classList.remove('active');
});

els.btnSaveKey.addEventListener('click', () => {
    const key = els.apiKeyInput.value.trim();
    const conf = els.confInput.value.trim();
    if (!key) return toast('Please enter an API key', true);
    setApiKey(key);
    setConference(conf);
    els.apiKeyModal.classList.remove('active');
    toast('Settings saved');
});

// ── Init ──────────────────────────────────────────
async function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Load contacts from OPFS (migrates old localStorage data on first run)
    await _migrateOldData();
    await loadAllContacts();

    // Check for API key
    if (!getApiKey()) {
        els.apiKeyModal.classList.add('active');
    }

    // Start background queue processing
    setTimeout(processEnrichmentQueue, 5000);

    // Start camera
    startCamera();
}

init();
