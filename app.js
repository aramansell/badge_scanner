/* ============================================
   BadgeScan — Conference Badge → Contact Form
   ============================================ */

// ── DOM refs ────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = {
    camera: $('#screen-camera'),
    processing: $('#screen-processing'),
    result: $('#screen-result'),
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

    const headers = ['Name', 'Credentials', 'Salutation', 'Title', 'Specialty', 'Company', 'Email', 'Phone', 'City', 'State', 'Notes', 'Captured'];
    const rows = contacts.map((c) =>
        [
            c.name, c.credentials, c.salutation, c.title, c.specialty,
            c.company, c.email, c.phone, c.city, c.state, c.notes, c.captured_at,
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

function captureFrame() {
    const video = els.preview;
    const canvas = els.canvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
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

// ── PA Program Database ────────────────────────────
// Top 63 US PA programs (city, state, email domain, naming convention).
// Used to short-circuit institution resolution without needing web search.
const PA_PROGRAM_DB = [
  { inst: "Duke University", city: "Durham", state: "NC", domain: "duke.edu", fmt: "first.last" },
  { inst: "University of Iowa", city: "Iowa City", state: "IA", domain: "uiowa.edu", fmt: "first-last" },
  { inst: "Baylor College of Medicine", city: "Houston", state: "TX", domain: "bcm.edu", fmt: "firstlast" },
  { inst: "University of Utah", city: "Salt Lake City", state: "UT", domain: "utah.edu", fmt: "first.last" },
  { inst: "Emory University", city: "Atlanta", state: "GA", domain: "emory.edu", fmt: "first.last" },
  { inst: "George Washington University", city: "Washington", state: "DC", domain: "gwu.edu", fmt: "firstlast" },
  { inst: "University of Colorado", city: "Aurora", state: "CO", domain: "cuanschutz.edu", fmt: "first.last" },
  { inst: "Oregon Health & Science University", city: "Portland", state: "OR", domain: "ohsu.edu", fmt: "firstlast" },
  { inst: "Wake Forest University", city: "Winston-Salem", state: "NC", domain: "wakehealth.edu", fmt: "firstlast" },
  { inst: "University of Washington", city: "Seattle", state: "WA", domain: "uw.edu", fmt: "firstlast" },
  { inst: "University of Texas Southwestern", city: "Dallas", state: "TX", domain: "utsouthwestern.edu", fmt: "first.last" },
  { inst: "Quinnipiac University", city: "Hamden", state: "CT", domain: "quinnipiac.edu", fmt: "first.last" },
  { inst: "University of Florida", city: "Gainesville", state: "FL", domain: "ufl.edu", fmt: "firstlast" },
  { inst: "Rosalind Franklin University", city: "North Chicago", state: "IL", domain: "rosalindfranklin.edu", fmt: "first.last" },
  { inst: "Drexel University", city: "Philadelphia", state: "PA", domain: "drexel.edu", fmt: "firstlast" },
  { inst: "Stony Brook University", city: "Stony Brook", state: "NY", domain: "stonybrookmedicine.edu", fmt: "first.last" },
  { inst: "University of Southern California", city: "Los Angeles", state: "CA", domain: "usc.edu", fmt: "firstlast" },
  { inst: "University of North Carolina", city: "Chapel Hill", state: "NC", domain: "med.unc.edu", fmt: "first_last" },
  { inst: "Midwestern University", city: "Downers Grove", state: "IL", domain: "midwestern.edu", fmt: "firstlast" },
  { inst: "Yale University", city: "New Haven", state: "CT", domain: "yale.edu", fmt: "first.last" },
  { inst: "Northeastern University", city: "Boston", state: "MA", domain: "northeastern.edu", fmt: "first.last" },
  { inst: "Rutgers University", city: "Piscataway", state: "NJ", domain: "rutgers.edu", fmt: "first.last" },
  { inst: "University of Texas Health San Antonio", city: "San Antonio", state: "TX", domain: "uthscsa.edu", fmt: "firstlast" },
  { inst: "MCPHS University", city: "Boston", state: "MA", domain: "mcphs.edu", fmt: "firstlast" },
  { inst: "Butler University", city: "Indianapolis", state: "IN", domain: "butler.edu", fmt: "firstlast" },
  { inst: "University of Kentucky", city: "Lexington", state: "KY", domain: "uky.edu", fmt: "first.last" },
  { inst: "University of Alabama at Birmingham", city: "Birmingham", state: "AL", domain: "uab.edu", fmt: "firstlast" },
  { inst: "Stanford University", city: "Stanford", state: "CA", domain: "stanford.edu", fmt: "firstlast" },
  { inst: "University of South Alabama", city: "Mobile", state: "AL", domain: "southalabama.edu", fmt: "firstlast" },
  { inst: "Jefferson University", city: "Philadelphia", state: "PA", domain: "jefferson.edu", fmt: "first.last" },
  { inst: "Ohio State University", city: "Columbus", state: "OH", domain: "osumc.edu", fmt: "first.last" },
  { inst: "University of Oklahoma", city: "Oklahoma City", state: "OK", domain: "ouhsc.edu", fmt: "first-last" },
  { inst: "University of Nebraska", city: "Omaha", state: "NE", domain: "unmc.edu", fmt: "firstlast" },
  { inst: "Northwestern University", city: "Chicago", state: "IL", domain: "northwestern.edu", fmt: "firstlast" },
  { inst: "Pace University", city: "New York", state: "NY", domain: "pace.edu", fmt: "firstlast" },
  { inst: "University of Detroit Mercy", city: "Detroit", state: "MI", domain: "udmercy.edu", fmt: "firstlast" },
  { inst: "University of Pittsburgh", city: "Pittsburgh", state: "PA", domain: "pitt.edu", fmt: "firstlast" },
  { inst: "University of California, Davis", city: "Sacramento", state: "CA", domain: "ucdavis.edu", fmt: "firstlast" },
  { inst: "Barry University", city: "Miami", state: "FL", domain: "barry.edu", fmt: "firstlast" },
  { inst: "Marquette University", city: "Milwaukee", state: "WI", domain: "marquette.edu", fmt: "first.last" },
  { inst: "Rochester Institute of Technology", city: "Rochester", state: "NY", domain: "rit.edu", fmt: "firstlast" },
  { inst: "Shenandoah University", city: "Winchester", state: "VA", domain: "su.edu", fmt: "firstlast" },
  { inst: "Touro University", city: "Vallejo", state: "CA", domain: "touro.edu", fmt: "first.last" },
  { inst: "University of South Florida", city: "Tampa", state: "FL", domain: "usf.edu", fmt: "firstlast" },
  { inst: "Arcadia University", city: "Glenside", state: "PA", domain: "arcadia.edu", fmt: "firstlast" },
  { inst: "Temple University", city: "Philadelphia", state: "PA", domain: "temple.edu", fmt: "first.last" },
  { inst: "University of Michigan", city: "Ann Arbor", state: "MI", domain: "umich.edu", fmt: "firstlast" },
  { inst: "Medical University of South Carolina", city: "Charleston", state: "SC", domain: "musc.edu", fmt: "firstlast" },
  { inst: "Baylor University", city: "Waco", state: "TX", domain: "baylor.edu", fmt: "first_last" },
  { inst: "University of Wisconsin", city: "Madison", state: "WI", domain: "wisc.edu", fmt: "first.last" },
  { inst: "Cornell University", city: "New York", state: "NY", domain: "med.cornell.edu", fmt: "firstlast" },
  { inst: "Case Western Reserve University", city: "Cleveland", state: "OH", domain: "case.edu", fmt: "firstlast" },
  { inst: "University of New Mexico", city: "Albuquerque", state: "NM", domain: "unm.edu", fmt: "firstlast" },
  { inst: "Idaho State University", city: "Pocatello", state: "ID", domain: "isu.edu", fmt: "firstlast" },
  { inst: "University of North Dakota", city: "Grand Forks", state: "ND", domain: "und.edu", fmt: "first.last" },
  { inst: "A.T. Still University", city: "Mesa", state: "AZ", domain: "atsu.edu", fmt: "firstlast" },
  { inst: "Midwestern University", city: "Glendale", state: "AZ", domain: "midwestern.edu", fmt: "firstlast" },
  { inst: "University of Tennessee", city: "Memphis", state: "TN", domain: "uthsc.edu", fmt: "firstlast" },
  { inst: "Louisiana State University", city: "New Orleans", state: "LA", domain: "lsuhsc.edu", fmt: "firstlast" },
  { inst: "University of Missouri", city: "Columbia", state: "MO", domain: "missouri.edu", fmt: "firstlast" },
  { inst: "Indiana University", city: "Indianapolis", state: "IN", domain: "iu.edu", fmt: "firstlast" },
  { inst: "Methodist University", city: "Fayetteville", state: "NC", domain: "methodist.edu", fmt: "first.last" },
  { inst: "Penn State University", city: "Hershey", state: "PA", domain: "psu.edu", fmt: "firstlast" },
];

// ── OpenAI: Institution resolver + email lookup ────
// TWO BRANCHES:
//   Branch 1: Company IS on badge → local lookup (match domain, construct email)
//   Branch 2: No company → search local PA program DB by city+state
// GPT fallback only when local DB can't match (rare).

async function resolveInstitution(parsed) {
    const { name, company, title, credentials, specialty, city, state } = parsed;

    // Branch 1: company is known — match domain locally
    if (company) {
        return resolveLocally(name, company);
    }

    // Branch 2: no company — search local DB by city+state
    if (city && state) {
        const match = PA_PROGRAM_DB.find(p =>
            p.city.toLowerCase() === city.toLowerCase() &&
            p.state.toUpperCase() === state.toUpperCase()
        );
        if (match) {
            return {
                company: match.inst,
                email: constructEmail(name, match.domain, match.fmt),
                confidence: 'medium',
                reasoning: `Matched ${match.inst} from local PA program database (${city}, ${state})`
            };
        }

        // Broader: match just by state
        const stateMatch = PA_PROGRAM_DB.find(p =>
            p.state.toUpperCase() === state.toUpperCase()
        );
        if (stateMatch) {
            return {
                company: stateMatch.inst,
                email: constructEmail(name, stateMatch.domain, stateMatch.fmt),
                confidence: 'low',
                reasoning: `Matched ${stateMatch.inst} by state (${state}) — no exact city match for ${city}`
            };
        }
    }

    // Nothing in local DB — fall back to GPT with web_search
    return resolveWithGPT(name, company, title, credentials, specialty, city, state);
}

// ── Local resolver (no API call) ──────────────────

async function resolveLocally(name, company) {
    // Try to match the company to a known domain in the DB
    const lc = company.toLowerCase();
    const match = PA_PROGRAM_DB.find(p =>
        lc.includes(p.domain.replace('.edu', '').replace('.com', '')) ||
        lc.includes(p.inst.toLowerCase().substring(0, 8))
    );

    if (match) {
        return {
            company: company,
            email: constructEmail(name, match.domain, match.fmt),
            confidence: 'medium',
            reasoning: `Company "${company}" matched to ${match.inst} domain ${match.domain}`
        };
    }

    // Extract domain from company name (best-effort heuristic)
    const domainGuess = guessDomain(company);
    if (domainGuess) {
        return {
            company: company,
            email: constructEmail(name, domainGuess, 'first.last'),
            confidence: 'low',
            reasoning: `Guessed domain ${domainGuess} from company name "${company}"`
        };
    }

    // Nothing local works — fall back to GPT
    return resolveWithGPT(name, company, null, null, null, null, null);
}

function guessDomain(company) {
    const lc = company.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    const words = lc.split(/\s+/);

    // Common mappings
    const known = {
        'mayo clinic': 'mayo.edu',
        'cleveland clinic': 'ccf.org',
        'johns hopkins': 'jhmi.edu',
        'kaiser permanente': 'kp.org',
        'mass general brigham': 'mgb.org',
        'mass general': 'mgh.harvard.edu',
        'brigham and womens': 'bwh.harvard.edu',
        'brigham': 'bwh.harvard.edu',
        'cedars sinai': 'cshs.org',
        'nyu': 'nyulangone.org',
        'nyu langone': 'nyulangone.org',
        'mount sinai': 'mountsinai.org',
        'ucla': 'mednet.ucla.edu',
        'ucsf': 'ucsf.edu',
        'ucsd': 'health.ucsd.edu',
        'md anderson': 'mdanderson.org',
        'md anderson': 'mdanderson.org',
        'upenn': 'pennmedicine.upenn.edu',
        'penn medicine': 'pennmedicine.upenn.edu',
    };

    // Check for exact match in known
    for (const [k, v] of Object.entries(known)) {
        if (lc === k || lc.includes(k)) return v;
    }

    // If it's a single recognizable word + health/hospital/medical
    if (words.length <= 2) return null;

    return null;
}

function constructEmail(name, domain, fmt) {
    if (!name || !domain) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return '';

    const first = parts[0].toLowerCase().replace(/[^a-z]/g, '');
    const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '');

    switch (fmt) {
        case 'first.last': return `${first}.${last}@${domain}`;
        case 'first_last': return `${first}_${last}@${domain}`;
        case 'first-last': return `${first}-${last}@${domain}`;
        case 'firstlast':  return `${first}${last}@${domain}`;
        default:           return `${first}.${last}@${domain}`;
    }
}

// ── GPT fallback (only when local DB misses) ───────

async function resolveWithGPT(name, company, title, credentials, specialty, city, state) {
    const location = city && state ? `${city}, ${state}` : (city || state || 'unknown location');
    const spec = specialty || 'unknown specialty';
    const creds = credentials || 'PA';
    const role = title || '';

    // Precompute the branching instruction parts (avoid nested template literals)
    const companyLine = company ? `Company: ${company}` : '';
    let step1;
    if (company) {
        step1 = `The badge company is "${company}". Use web_search to find this person's email at that company.`;
    } else {
        step1 = `This person works in ${location}. Find teaching hospitals and medical universities in ${location} that have a PA program (Physician Assistant program). This is a PA conference — the person almost certainly works at an institution that trains PAs or employs PAs in a teaching hospital setting.

  Use web_search. Search queries to try:
  - "${location} teaching hospital PA program"
  - "${location} medical university physician assistant program"
  - "${location} academic medical center"
  - "${name} ${location}"

  Narrow to the 1-2 most likely institutions.`;
    }
    const inputText = `Resolve the employer and email for ${name} (${creds}) who practices ${spec} in ${location}.${company ? ' Badge company: ' + company + '.' : ''}`;

    const instructions = `You are a medical conference lead-capture assistant.
Your job: given a person at the AAPA 2026 conference, find their employer and email.

PERSON DETAILS:
  Name: ${name}
  Credentials: ${creds}
  Title/Role: ${role || 'not listed'}
  Specialty: ${spec}
  Location (from badge): ${location}
  ${companyLine}

CRITICAL — WHAT TO DO:

Step 1: Identify the most likely employer.
  ${step1}

Step 2: Match the person to that institution.
  Search for "${name}" at the institution you identified.

Step 3: Find their email.
  Look for public listings, directory pages, or determine the institution's email format and construct the best guess.

IMPORTANT RULES:
- Only consider teaching hospitals and medical schools/universities WITH a PA program.
- Do NOT pick random clinics, private practices, or non-teaching hospitals.
- You MUST search the web. Do not guess without searching.
- NEVER use placeholder text like "institution.edu" — always produce a real domain from your web search results.

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
                        { type: 'input_text', text: inputText },
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

// ── Show result screen ────────────────────────────
function showResult(parsed, imageBlob) {
    // Set thumbnail
    const url = URL.createObjectURL(imageBlob);
    els.resultThumb.src = url;

    // Populate form
    els.fSalutation.value = parsed.salutation || '';
    els.fName.value = parsed.name || '';
    els.fTitle.value = parsed.title || '';
    els.fCompany.value = parsed.company || '';
    els.fEmail.value = parsed.email || '';
    els.fPhone.value = parsed.phone || '';

    // Build notes from badge metadata
    const parts = [];
    if (parsed.credentials) parts.push(parsed.credentials);
    if (parsed.specialty) parts.push(parsed.specialty);
    if (parsed.city && parsed.state) parts.push(`${parsed.city}, ${parsed.state}`);
    else if (parsed.city) parts.push(parsed.city);
    else if (parsed.state) parts.push(parsed.state);
    els.fNotes.value = parts.length
        ? `Met at AAPA 2026. Badge: ${parts.join(' — ')}`
        : 'Met at AAPA 2026.';

    // Email confidence indicator
    if (parsed.email_confidence) {
        els.emailConf.textContent =
            parsed.email_confidence === 'high' ? '✓ High confidence guess' :
                parsed.email_confidence === 'medium' ? '⚠ Medium confidence — verify please' :
                    '⚠ Low confidence — please verify';
        els.emailConf.className = 'email-confidence ' +
            (parsed.email_confidence === 'high' ? 'confident' :
                parsed.email_confidence === 'low' ? 'uncertain' : 'uncertain');
    } else {
        els.emailConf.textContent = '';
    }

    // Stash parsed data for merge on save
    _currentParsed = parsed;

    showScreen('result');
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
    els.steps[1].textContent = '🔍 Finding contact details...';
    els.steps[2].textContent = '📧 Resolving institution & email...';

    try {
        // Step 1: OCR / parse badge with Vision
        setStep(0, 'in_progress');
        const parsedData = await parseBadgeImage(imageBlob);
        setStep(0, 'done');

        // Step 2: Verify we got useful data
        if (!parsedData || !parsedData.name || parsedData.name.trim() === '') {
            setStep(0, 'done');
            throw new Error('Could not read a name from the badge. Try a clearer photo.');
        }
        setStep(1, 'done');

        // Step 3: Institution resolver + email lookup
        setStep(2, 'in_progress');
        const resolved = await resolveInstitution(parsedData);
        if (resolved) {
            // Only override company if we resolved one (don't wipe an existing one)
            if (resolved.company && !parsedData.company) {
                parsedData.company = resolved.company;
            }
            parsedData.email = resolved.email;
            parsedData.email_confidence = resolved.confidence;
            parsedData.email_reasoning = resolved.reasoning;
        }
        setStep(2, 'done');

        // Show result
        showResult(parsedData, imageBlob);

    } catch (err) {
        console.error('Processing error:', err);
        toast(err.message || 'Something went wrong. Please try again.', true);
        showScreen('camera');
    }
}

// ── Event: Capture button ─────────────────────────
els.btnCapture.addEventListener('click', () => {
    const dataUrl = captureFrame();
    currentImage = dataURLtoBlob(dataUrl);
    processImage(currentImage);
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
        title: els.fTitle.value.trim(),
        company: els.fCompany.value.trim(),
        email: els.fEmail.value.trim(),
        phone: els.fPhone.value.trim(),
        notes: els.fNotes.value.trim(),
        // Fields from badge OCR (not in the form)
        credentials: _currentParsed?.credentials || '',
        specialty: _currentParsed?.specialty || '',
        city: _currentParsed?.city || '',
        state: _currentParsed?.state || '',
        captured_at: new Date().toISOString(),
    };

    if (!contact.name) {
        toast('Name is required', true);
        return;
    }

    // Store contact + badge image in OPFS
    await storeContact(contact, currentImage || null);
    toast(`Saved: ${contact.name}`);

    // Reset and go back to camera
    currentImage = null;
    _currentParsed = null;
    els.contactForm.reset();
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

    // Start camera
    startCamera();
}

init();
