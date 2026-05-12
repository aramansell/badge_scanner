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

// ── Contacts storage ─────────────────────────────
function getContacts() {
    try {
        return JSON.parse(localStorage.getItem('badgescan_contacts') || '[]');
    } catch {
        return [];
    }
}

function saveContacts(contacts) {
    localStorage.setItem('badgescan_contacts', JSON.stringify(contacts));
    updateCounter();
}

function addContact(contact) {
    const contacts = getContacts();
    contacts.unshift(contact);
    saveContacts(contacts);
}

function updateCounter() {
    const count = getContacts().length;
    if (els.counterNum) els.counterNum.textContent = count;
    if (els.exportSection) {
        els.exportSection.classList.toggle('hidden', count === 0);
    }
}

// ── CSV Export ────────────────────────────────────
function exportCSV() {
    const contacts = getContacts();
    if (!contacts.length) return toast('No contacts to export', true);

    const headers = ['Name', 'Salutation', 'Title', 'Company', 'Email', 'Phone', 'Conference', 'Notes', 'Captured'];
    const rows = contacts.map((c) =>
        [
            c.name, c.salutation, c.title, c.company,
            c.email, c.phone, c.conference, c.notes, c.captured_at,
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

function clearAllContacts() {
    if (!confirm('Delete all scanned contacts? This cannot be undone.')) return;
    saveContacts([]);
    toast('All contacts cleared');
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
    const conference = getConference();

    const confHint = conference
        ? `CRITICAL: This badge was scanned at the "${conference}" conference.\n` +
          `"${conference}" is the EVENT NAME, NOT the person's company.\n` +
          `When determining the "company" field, IGNORE any text that matches the conference name.\n` +
          `The company should be the employer/organization the person works for, not the event.\n` +
          `Look for employer branding/logos separate from the conference branding.\n\n`
        : '';

    const instructions = `You are a badge scanner for a conference contact capture app.
Analyze this image of a conference badge or business card.
Extract every piece of information you can see. Do not make up information.
Return ONLY valid JSON — no markdown, no code fences, just the raw JSON object.

${confHint}IMPORTANT ABOUT QR CODES: Many badges have a QR code printed on them.
This QR code typically links to the conference website, event app, or registration system.
The QR code content is NOT the person's company or employer.
When determining the "company" field, COMPLETELY IGNORE any QR codes and any text
embedded in or near the QR code. The person's real company comes from logos,
employer badges, or other non-QR branding on the badge.

Fields to extract (use null if not visible on the badge):
{
  "salutation": "Mr./Ms./Dr./Prof./etc or null",
  "name": "Full name as written on the badge",
  "title": "Job title or role",
  "company": "Company or organization name (NOT the conference/event name)",
  "phone": "Phone number if visible",
  "website": "Website URL if visible",
  "location": "City/address if visible",
  "raw_text": "All text visible on the badge in full"
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

// ── OpenAI: Email lookup ──────────────────────────
async function lookupEmail(name, company) {
    const instructions = `You are an email lookup assistant for a conference contact app.
Given a person's name and company, find their work email address.

IMPORTANT: You MUST use the web_search tool to search for this person's email.
Search queries to try (in order):
1. "[name] [company] email" — find their actual email if publicly listed
2. "[company] email format" — determine the company's email naming convention
3. "[company] [name] linkedin" — find their LinkedIn for title/email hints

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
        throw new Error(err.error?.message || `Email lookup failed (${response.status})`);
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
    els.fNotes.value = parsed.location
        ? `Met at conference. Location from badge: ${parsed.location}`
        : 'Met at conference.';

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
    els.steps[2].textContent = '📧 Looking up email address...';

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

        // Step 3: Email lookup (if we have name + company)
        if (parsedData.name && parsedData.company) {
            setStep(2, 'in_progress');
            const emailResult = await lookupEmail(parsedData.name, parsedData.company);
            if (emailResult) {
                parsedData.email = emailResult.email;
                parsedData.email_confidence = emailResult.confidence;
                parsedData.email_reasoning = emailResult.reasoning;
            }
            setStep(2, 'done');
        } else {
            setStep(2, 'done');
        }

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
els.contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const contact = {
        name: els.fName.value.trim(),
        salutation: els.fSalutation.value.trim(),
        title: els.fTitle.value.trim(),
        company: els.fCompany.value.trim(),
        email: els.fEmail.value.trim(),
        phone: els.fPhone.value.trim(),
        conference: getConference(),
        notes: els.fNotes.value.trim(),
        captured_at: new Date().toISOString(),
    };

    if (!contact.name) {
        toast('Name is required', true);
        return;
    }

    addContact(contact);
    toast(`Saved: ${contact.name}`);

    // Reset and go back to camera
    els.contactForm.reset();
    showScreen('camera');
    startCamera();
});

// ── Event: Export ─────────────────────────────────
els.btnExport.addEventListener('click', exportCSV);

// ── Event: Clear ──────────────────────────────────
els.btnClear.addEventListener('click', clearAllContacts);

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
function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Check for API key
    if (!getApiKey()) {
        els.apiKeyModal.classList.add('active');
    }

    // Update contact counter
    updateCounter();

    // Start camera
    startCamera();
}

init();
