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
    btnSaveKey: $('#btn-save-key'),
    // Camera screen extras
    counterNum: $('#counter-num'),
    exportSection: $('#export-section'),
    btnExport: $('#btn-export'),
    btnClear: $('#btn-clear'),
    // Form fields
    fSalutation: $('#field-salutation'),
    fName: $('#field-name'),
    fTitle: $('#field-title'),
    fCompany: $('#field-company'),
    fEmail: $('#field-email'),
    fPhone: $('#field-phone'),
    fNotes: $('#field-notes'),
    emailConf: $('#email-confidence'),
};

let stream = null;
let capturedBlob = null;

// ── Screen management ───────────────────────────
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

// ── Toast ────────────────────────────────────────
function toast(msg, isError = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
}

// ── API Key ──────────────────────────────────────
function getApiKey() {
    return localStorage.getItem('badgescan_apikey') || '';
}

function requireApiKey() {
    const key = getApiKey();
    if (!key) {
        els.apiKeyModal.classList.add('active');
        els.apiKeyInput.focus();
        return false;
    }
    return true;
}

els.btnSaveKey.addEventListener('click', () => {
    const key = els.apiKeyInput.value.trim();
    if (!key.startsWith('sk-')) {
        toast('Key must start with sk-', true);
        return;
    }
    localStorage.setItem('badgescan_apikey', key);
    els.apiKeyModal.classList.remove('active');
    toast('API key saved!');
    startCamera();
});

els.apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.btnSaveKey.click();
});

// If modal is showing and user taps outside, don't hide —
// they MUST set a key or nothing works. Close button? Not needed.

// ── Camera ───────────────────────────────────────
async function startCamera() {
    if (!getApiKey()) {
        els.apiKeyModal.classList.add('active');
        return;
    }

    stopCamera();

    const constraints = {
        video: {
            facingMode: 'environment',  // back camera
            width: { ideal: 1920 },
            height: { ideal: 1920 },
        },
        audio: false,
    };

    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        els.preview.srcObject = stream;
        await els.preview.play();
        els.btnCapture.disabled = false;
        els.statusText.textContent = 'Camera ready — position badge in frame';
    } catch (err) {
        console.error('Camera error:', err);
        if (err.name === 'NotAllowedError') {
            els.statusText.textContent = 'Camera permission denied. Please allow camera access and reload.';
        } else if (err.name === 'NotFoundError') {
            els.statusText.textContent = 'No camera found. Use gallery option below.';
            els.btnFile.style.display = 'flex';
        } else {
            els.statusText.textContent = 'Camera unavailable on this device. Try gallery.';
        }
        els.btnCapture.disabled = true;
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
}

// ── Capture from camera ──────────────────────────
els.btnCapture.addEventListener('click', () => {
    if (!els.preview.srcObject) return;

    const video = els.preview;
    const canvas = els.canvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
        capturedBlob = blob;
        processBadge(blob);
    }, 'image/jpeg', 0.9);
});

// ── File / Gallery pick ──────────────────────────
els.btnFile.addEventListener('click', () => els.inputFile.click());

els.inputFile.addEventListener('change', () => {
    const file = els.inputFile.files[0];
    if (!file) return;
    capturedBlob = file;
    processBadge(file);
    els.inputFile.value = '';  // allow re-pick of same file
});

// ── Rescan ────────────────────────────────────────
els.btnRescan.addEventListener('click', () => {
    capturedBlob = null;
    showScreen('camera');
    startCamera();
});

// ── Processing ────────────────────────────────────
async function processBadge(imageBlob) {
    if (!requireApiKey()) return;

    showScreen('processing');
    resetSteps();

    try {
        // Step 1: OCR / parse badge with Vision
        setStep(0, 'in_progress');
        const parsedData = await parseBadgeImage(imageBlob);
        setStep(0, 'done');

        // Step 2: Verify we got useful data
        if (!parsedData.name || parsedData.name.trim() === '') {
            setStep(0, 'done');
            throw new Error('Could not read a name from the badge. Try a clearer photo.');
        }
        setStep(1, 'done');

        // Step 3: Email lookup (if we have name + company)
        if (parsedData.name && parsedData.company) {
            setStep(2, 'in_progress');
            const emailResult = await lookupEmail(parsedData.name, parsedData.company);
            parsedData.email = emailResult.email;
            parsedData.email_confidence = emailResult.confidence;
            parsedData.email_reasoning = emailResult.reasoning;
            setStep(2, 'done');
        } else {
            setStep(2, 'done');
        }

        // Show result
        showResult(parsedData, imageBlob);

    } catch (err) {
        console.error('Processing error:', err);
        toast(err.message || 'Processing failed. Please try again.', true);
        showScreen('camera');
        startCamera();
    }
}

function resetSteps() {
    els.steps.forEach(s => {
        s.classList.add('pending');
        s.classList.remove('done', 'in_progress');
    });
}

function setStep(index, state) {
    const step = els.steps[index];
    if (!step) return;
    step.classList.remove('pending', 'done', 'in_progress');
    if (state === 'done') {
        step.classList.add('done');
    } else if (state === 'in_progress') {
        step.classList.add('in_progress');
    } else {
        step.classList.add('pending');
    }
}

// ── OpenAI: Parse badge image ────────────────────
async function parseBadgeImage(imageBlob) {
    const base64 = await blobToBase64(imageBlob);

    const systemPrompt = `You are a badge scanner for a conference contact capture app.
Analyze this image of a conference badge or business card.
Extract every piece of information you can see. Do not make up information.
Return ONLY valid JSON — no markdown, no code fences, just the raw JSON object.

Fields to extract (use null if not visible on the badge):
{
  "salutation": "Mr./Ms./Dr./Prof./etc or null",
  "name": "Full name as written on the badge",
  "title": "Job title or role",
  "company": "Company or organization name",
  "phone": "Phone number if visible",
  "website": "Website URL if visible",
  "location": "City/address if visible",
  "raw_text": "All text visible on the badge in full"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
            model: 'gpt-5.5',
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64}`,
                                detail: 'high',
                            },
                        },
                        { type: 'text', text: 'Extract contact details from this badge.' },
                    ],
                },
            ],
            max_tokens: 800,
            temperature: 0,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error (${response.status})`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON from response (strip any markdown fences)
    const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(jsonStr);
}

// ── OpenAI: Email lookup ──────────────────────────
async function lookupEmail(name, company) {
    const systemPrompt = `You are an email lookup assistant for a conference contact app.
Given a person's name and company, provide your BEST GUESS for their work email address.
Use common email patterns:
- firstname@company.com
- firstname.lastname@company.com
- firstinitiallastname@company.com
- etc.

Also provide a confidence level (high/medium/low) and brief reasoning.

Return ONLY valid JSON — no markdown, no code fences, just the raw JSON object:
{
  "email": "guessed@email.com",
  "confidence": "high|medium|low",
  "reasoning": "One sentence explaining the guess"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
            model: 'gpt-4.5-preview',
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: `Name: ${name}\nCompany: ${company}\n\nWhat is the most likely work email for this person?`,
                },
            ],
            max_tokens: 200,
            temperature: 0,
        }),
    });

    if (!response.ok) {
        // If 4.5-preview not available, fall back to 4o
        if (response.status === 404 || response.status === 400) {
            return lookupEmailFallback(name, company);
        }
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Email lookup failed (${response.status})`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(jsonStr);
}

async function lookupEmailFallback(name, company) {
    // Fallback to gpt-4o for email lookup
    const systemPrompt = `You are an email lookup assistant. Given a person's name and company, provide your best guess for their work email. Use common patterns. Return ONLY valid JSON: {"email": "guess@company.com", "confidence": "high|medium|low", "reasoning": "one sentence"}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Name: ${name}\nCompany: ${company}` }],
            max_tokens: 200,
            temperature: 0,
        }),
    });

    if (!response.ok) {
        return { email: '', confidence: 'low', reasoning: 'Could not look up email.' };
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(jsonStr);
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
    els.fNotes.value = '';

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

    // Focus the email field so user can verify immediately
    setTimeout(() => els.fEmail.focus(), 300);
    if (parsed.email) {
        setTimeout(() => els.fEmail.select(), 350);
    }
}

// ── Save contact ──────────────────────────────────
$('#contact-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const contact = {
        salutation: els.fSalutation.value.trim(),
        name: els.fName.value.trim(),
        title: els.fTitle.value.trim(),
        company: els.fCompany.value.trim(),
        email: els.fEmail.value.trim(),
        phone: els.fPhone.value.trim(),
        notes: els.fNotes.value.trim(),
        captured_at: new Date().toISOString(),
    };

    if (!contact.name) {
        toast('Name is required', true);
        els.fName.focus();
        return;
    }
    if (!contact.email) {
        toast('Email is required', true);
        els.fEmail.focus();
        return;
    }

    // Accumulate to localStorage
    const contacts = getContacts();
    contacts.push(contact);
    saveContacts(contacts);

    toast('Contact saved! Ready for next badge.');

    // Reset and go back to camera
    capturedBlob = null;
    setTimeout(() => {
        showScreen('camera');
        startCamera();
    }, 1200);
});

// ── Contacts storage ──────────────────────────────
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

function updateCounter() {
    const count = getContacts().length;
    els.counterNum.textContent = count;
    els.exportSection.classList.toggle('hidden', count === 0);
}

// ── Export All CSV ─────────────────────────────────
els.btnExport.addEventListener('click', () => {
    const contacts = getContacts();
    if (contacts.length === 0) {
        toast('No contacts to export', true);
        return;
    }

    const headers = ['Salutation', 'Name', 'Title', 'Company', 'Email', 'Phone', 'Notes', 'Captured At'];
    const rows = contacts.map(c => [
        c.salutation, c.name, c.title, c.company,
        c.email, c.phone, c.notes, c.captured_at,
    ]);

    const csvContent =
        headers.join(',') + '\n' +
        rows.map(row => row.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    a.download = `badgescan_export_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast(`Exported ${contacts.length} contacts`);
});

// ── Clear All ──────────────────────────────────────
els.btnClear.addEventListener('click', () => {
    const count = getContacts().length;
    if (count === 0) return;

    if (!confirm(`Delete all ${count} scanned contacts? This cannot be undone. Export first if you want to save them.`)) {
        return;
    }

    localStorage.removeItem('badgescan_contacts');
    updateCounter();
    toast('All contacts cleared');
});

// ── Helpers ───────────────────────────────────────
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // reader.result is "data:image/jpeg;base64,xxxxx"
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ── PWA Install Prompt ────────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Could show an "Install App" button, but for simplicity we rely on
    // the browser's built-in install affordance (address bar or menu).
    // The manifest + service worker handle installability.
});

// ── Init ──────────────────────────────────────────
function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {
            // SW fails silently — app still works without offline caching
        });
    }

    // Initialize counter from stored contacts
    updateCounter();

    // If API key exists, start camera immediately
    if (getApiKey()) {
        startCamera();
    } else {
        els.apiKeyModal.classList.add('active');
    }

    // On iOS, camera needs user gesture. startCamera() from init
    // will fail silently on iOS if no gesture. We show the modal first
    // which requires a tap (Save Key) — that counts as the gesture.
}

init();
