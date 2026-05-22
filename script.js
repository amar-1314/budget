// Version format: YEAR.WEEK.DEPLOYMENT (e.g., 25.48.1)
const BUILD_TIMESTAMP = '2026-05-22T17:07:46Z'; // Auto-updated on deployment
const APP_VERSION = '26.21.9'; // Auto-updated on deployment

const SESSION_LOGS_KEY = 'session_logs_v1';
const SESSION_LOGS_MAX = 800;

function getSessionLogs() {
    try {
        const raw = sessionStorage.getItem(SESSION_LOGS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
        return [];
    }
}

function updateFixedLLCButtonState(value) {
    const llcBtn = document.getElementById('fixedLlcToggleBtn');
    if (!llcBtn) return;
    if (value === 'Yes') {
        llcBtn.classList.remove('toggle-btn-inactive');
        llcBtn.classList.add('toggle-btn-active-llc');
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Business</span>';
    } else {
        llcBtn.classList.remove('toggle-btn-active-llc');
        llcBtn.classList.add('toggle-btn-inactive');
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Personal</span>';
    }
}

function updateFixedMoreDetailsButtonState(isOpen) {
    const btn = document.getElementById('fixedMoreDetailsBtn');
    if (!btn) return;
    if (isOpen) {
        btn.classList.remove('toggle-btn-inactive');
        btn.classList.add('toggle-btn-active-more');
        btn.innerHTML = '<i class="fas fa-chevron-up"></i><span>Less</span>';
    } else {
        btn.classList.remove('toggle-btn-active-more');
        btn.classList.add('toggle-btn-inactive');
        btn.innerHTML = '<i class="fas fa-ellipsis-h"></i><span>More</span>';
    }
}

function toggleFixedLLC() {
    const llcSelect = document.getElementById('fixedLLC');
    if (!llcSelect) return;
    llcSelect.value = llcSelect.value === 'No' ? 'Yes' : 'No';
    updateFixedLLCButtonState(llcSelect.value);
}

function toggleFixedMoreDetails() {
    const panel = document.getElementById('fixedMoreDetailsPanel');
    if (!panel) return;
    const shouldOpen = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    updateFixedMoreDetailsButtonState(shouldOpen);
}

function setSessionLogs(logs) {
    try {
        sessionStorage.setItem(SESSION_LOGS_KEY, JSON.stringify(logs));
    } catch (_e) {
    }
}

function appendSessionLog(level, args) {
    try {
        const logs = getSessionLogs();
        const msg = args
            .map(a => {
                if (a instanceof Error) return a.stack || a.message || String(a);
                if (typeof a === 'string') return a;
                try {
                    return JSON.stringify(a);
                } catch (_e) {
                    return String(a);
                }
            })
            .join(' ');

        logs.push({
            ts: new Date().toISOString(),
            level,
            msg
        });

        if (logs.length > SESSION_LOGS_MAX) {
            logs.splice(0, logs.length - SESSION_LOGS_MAX);
        }

        setSessionLogs(logs);
    } catch (_e) {
    }
}

function initSessionLogger() {
    try {
        const original = {
            log: console.log.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console)
        };

        console.log = (...args) => {
            appendSessionLog('log', args);
            original.log(...args);
        };
        console.info = (...args) => {
            appendSessionLog('info', args);
            original.info(...args);
        };
        console.warn = (...args) => {
            appendSessionLog('warn', args);
            original.warn(...args);
        };
        console.error = (...args) => {
            appendSessionLog('error', args);
            original.error(...args);
        };

        window.addEventListener('error', (e) => {
            appendSessionLog('error', [e?.message || 'window.error', e?.filename || '', e?.lineno || '', e?.colno || '']);
        });
        window.addEventListener('unhandledrejection', (e) => {
            appendSessionLog('error', ['unhandledrejection', e?.reason || '']);
        });
    } catch (_e) {
    }
}

initSessionLogger();

console.log(`🎬 SCRIPT STARTING TO LOAD... (v${APP_VERSION})`);
console.log('💾 Data Source: 100% Supabase (PostgreSQL)');
console.log(`🕐 Build: ${BUILD_TIMESTAMP}`);

// Household Financial Profile & Benchmarks (Herndon VA, couple mid-30s, 1 infant)
const HOUSEHOLD_PROFILE = {
    monthlySalary: 11000,       // Amar $6k + Priya $5k post-tax
    members: 3,
    location: 'Herndon, VA'
};

// dmvMedian = typical monthly spend for a DMV family of 3, $11k/mo income
const FINANCIAL_BENCHMARKS = {
    'Groceries':      { min: 600,  max: 900,  dmvMedian: 750,  icon: 'fa-shopping-cart', note: 'USDA moderate plan, family of 3, DMV area' },
    'Dining':         { min: 150,  max: 300,  dmvMedian: 220,  icon: 'fa-utensils',     note: '~2-3% of take-home income' },
    'Gas':            { min: 150,  max: 300,  dmvMedian: 200,  icon: 'fa-gas-pump',     note: 'Two-car household, VA commute' },
    'Utilities':      { min: 150,  max: 300,  dmvMedian: 220,  icon: 'fa-bolt',         note: 'Apartment in Herndon' },
    'Insurance':      { min: 300,  max: 500,  dmvMedian: 380,  icon: 'fa-shield-alt',   note: 'Auto + renters, family coverage' },
    'Car':            { min: 300,  max: 600,  dmvMedian: 450,  icon: 'fa-car',          note: 'Two car payments, mid-range vehicles' },
    'Subscriptions':  { min: 50,   max: 150,  dmvMedian: 85,   icon: 'fa-redo',         note: 'Streaming, software, memberships' },
    'Shopping':       { min: 100,  max: 300,  dmvMedian: 180,  icon: 'fa-shopping-bag', note: 'General household purchases' },
    'Entertainment':  { min: 50,   max: 200,  dmvMedian: 120,  icon: 'fa-film',         note: 'Family activities and outings' },
    'Baby':           { min: 100,  max: 300,  dmvMedian: 200,  icon: 'fa-baby',         note: 'Diapers, formula, clothes, gear' },
    'Health':         { min: 100,  max: 300,  dmvMedian: 180,  icon: 'fa-heartbeat',    note: 'Copays, prescriptions, wellness' },
    'Healthcare':     { min: 100,  max: 300,  dmvMedian: 180,  icon: 'fa-heartbeat',    note: 'Copays, prescriptions, wellness' },
    'Personal Care':  { min: 50,   max: 150,  dmvMedian: 80,   icon: 'fa-spa',          note: 'Grooming, hygiene, self-care' },
    'Clothing':       { min: 50,   max: 200,  dmvMedian: 120,  icon: 'fa-tshirt',       note: 'Family clothing needs' },
    'Education':      { min: 0,    max: 200,  dmvMedian: 50,   icon: 'fa-graduation-cap', note: 'Courses, books, development' },
    'Travel':         { min: 0,    max: 300,  dmvMedian: 150,  icon: 'fa-plane',        note: 'Occasional family trips (amortized)' },
    'Phone':          { min: 50,   max: 150,  dmvMedian: 100,  icon: 'fa-mobile-alt',   note: 'Two phone plans' },
    'Internet':       { min: 50,   max: 100,  dmvMedian: 75,   icon: 'fa-wifi',         note: 'Home internet service' },
    'Maintenance':    { min: 50,   max: 200,  dmvMedian: 100,  icon: 'fa-wrench',       note: 'Car and home maintenance' },
    'Pets':           { min: 0,    max: 100,  dmvMedian: 40,   icon: 'fa-paw',          note: 'Pet care if applicable' },
    'Gifts':          { min: 0,    max: 150,  dmvMedian: 60,   icon: 'fa-gift',         note: 'Gifts and donations (amortized)' }
};
// DMV benchmark for total non-housing monthly spending (family of 3, $11k income)
const DMV_TOTAL_NON_HOUSING_MEDIAN = 3500;

// Supabase Table Configuration
const TABLE_NAME = 'Budget';
const PAYMENTS_TABLE = 'Payments';
const PROFILES_TABLE = 'Profiles';
const RECEIPT_ITEMS_TABLE = 'ReceiptItems';
const FIXED_EXPENSES_TABLE = 'FixedExpenses';
const LLC_EXPENSES_TABLE = 'LLCEligibleExpenses';
const BUDGETS_TABLE = 'Budgets';

function updateAppVersionDisplay() {
    const versionEl = document.getElementById('appVersionDisplay');
    if (versionEl) {
        versionEl.textContent = `v${APP_VERSION}`;
    }
}

const OCR_SPACE_API_KEY_STORAGE = 'ocr_space_api_key_v1';
const GEMINI_API_KEY_STORAGE = 'gemini_api_key_v1';
const RECEIPT_OCR_RETRY_DELAY_MS = 500;

let cachedReceiptSecrets = null;

async function fetchReceiptSecretsFromEdge() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase credentials not configured');
    }

    const endpoint = `${SUPABASE_URL}/functions/v1/receipt-secrets`;
    const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });

    const rawText = await resp.text().catch(() => '');
    const data = rawText ? safeJsonParse(rawText) : null;
    if (!resp.ok) {
        const msg = data?.error || `Failed to fetch receipt secrets: ${resp.status}`;
        throw new Error(String(msg));
    }

    const ocrSpaceApiKey = String(data?.ocrSpaceApiKey || '').trim();
    const geminiApiKey = String(data?.geminiApiKey || '').trim();
    if (!ocrSpaceApiKey || !geminiApiKey) {
        throw new Error('Missing OCR_SPACE_API_KEY and/or GEMINI_API_KEY in app_secrets');
    }

    return { ocrSpaceApiKey, geminiApiKey };
}

async function getReceiptSecrets() {
    if (cachedReceiptSecrets) return cachedReceiptSecrets;

    try {
        const cachedOcr = String(localStorage.getItem(OCR_SPACE_API_KEY_STORAGE) || '').trim();
        const cachedGemini = String(localStorage.getItem(GEMINI_API_KEY_STORAGE) || '').trim();
        if (cachedOcr && cachedGemini) {
            cachedReceiptSecrets = { ocrSpaceApiKey: cachedOcr, geminiApiKey: cachedGemini };
            return cachedReceiptSecrets;
        }
    } catch (_e) {
    }

    const secrets = await fetchReceiptSecretsFromEdge();
    cachedReceiptSecrets = secrets;
    try {
        localStorage.setItem(OCR_SPACE_API_KEY_STORAGE, secrets.ocrSpaceApiKey);
        localStorage.setItem(GEMINI_API_KEY_STORAGE, secrets.geminiApiKey);
    } catch (_e) {
    }
    return secrets;
}

async function getOcrSpaceApiKey() {
    const { ocrSpaceApiKey } = await getReceiptSecrets();
    return ocrSpaceApiKey;
}

async function getGeminiApiKey() {
    const { geminiApiKey } = await getReceiptSecrets();
    return geminiApiKey;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getEasternNowParts() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(new Date());

    const map = {};
    parts.forEach(p => {
        if (p.type !== 'literal') map[p.type] = p.value;
    });

    const year = parseInt(map.year);
    const month = parseInt(map.month);
    const day = parseInt(map.day);
    const hour = parseInt(map.hour);
    const minute = parseInt(map.minute);
    const dateKey = `${map.year}-${map.month}-${map.day}`;

    return { year, month, day, hour, minute, dateKey };
}

function handleLLCTileClick() {
    try {
        switchTab('category');

        setTimeout(() => {
            const yearSelector = document.getElementById('yearSelector');
            const monthSelector = document.getElementById('monthSelector');
            const parsedYear = yearSelector ? parseInt(yearSelector.value) : NaN;
            const parsedMonth = monthSelector ? parseInt(monthSelector.value) : NaN;
            const defaultYear = Number.isFinite(parsedYear) ? String(parsedYear) : String(new Date().getFullYear());
            const defaultMonth = Number.isFinite(parsedMonth) ? String(parsedMonth).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');

            const yearEl = document.getElementById('filterYear');
            if (yearEl) {
                yearEl.value = defaultYear;
            }

            document.querySelectorAll('#monthDropdownContent input[type="checkbox"]').forEach(cb => {
                cb.checked = (cb.value === defaultMonth);
            });
            if (typeof updateMonthSelection === 'function') updateMonthSelection();

            const llcEl = document.getElementById('filterLLC');
            if (llcEl) llcEl.value = 'Yes';

            const contributorEl = document.getElementById('filterContributor');
            if (contributorEl) contributorEl.selectedIndex = 0;

            if (typeof updateFilteredView === 'function') updateFilteredView();

            const scrollTarget = document.getElementById('filterResults') || document.getElementById('categoryTab');
            if (scrollTarget && typeof scrollTarget.scrollIntoView === 'function') {
                scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 0);
    } catch (error) {
        console.error('Error handling LLC tile click:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

async function getReceiptViewUrl(expenseId) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase credentials not configured');
    }

    const endpoint = `${SUPABASE_URL}/functions/v1/receipt-link`;
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ expenseId })
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        if (resp.status === 404) return null;
        throw new Error(data?.error || `Receipt link failed: ${resp.status}`);
    }
    return data?.url || null;
}

async function uploadReceiptToStorage(expenseId, receiptDataUrl, expenseFields, filename) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase credentials not configured');
    }

    const year = expenseFields?.Year || new Date().getFullYear();
    const month = String(expenseFields?.Month || 1).padStart(2, '0');

    const endpoint = `${SUPABASE_URL}/functions/v1/receipt-upload`;
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            expenseId,
            dataUrl: receiptDataUrl,
            year,
            month,
            filename
        })
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        throw new Error(data?.error || `Receipt upload failed: ${resp.status}`);
    }

    return data?.receipt;
}

async function detectDuplicateExpensesWithLLM(newExpense, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase credentials not configured');
    }

    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 3500;
    const minConfidence = Number.isFinite(Number(options.minConfidence)) ? Number(options.minConfidence) : 0.7;

    const candidates = allExpenses
        .filter(exp => exp?.fields?.Year === newExpense?.Year && exp?.fields?.Month === newExpense?.Month)
        .slice(0, 60)
        .map(exp => ({
            id: exp.id,
            Item: exp?.fields?.Item || '',
            Category: exp?.fields?.Category || null,
            Year: exp?.fields?.Year || null,
            Month: exp?.fields?.Month || null,
            Day: exp?.fields?.Day || null,
            Actual: exp?.fields?.Actual || null,
            Notes: exp?.fields?.Notes || null
        }));

    if (candidates.length === 0) return [];

    const endpoint = `${SUPABASE_URL}/functions/v1/detect-duplicate-expense`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                newExpense: {
                    Item: newExpense?.Item || '',
                    Category: newExpense?.Category || null,
                    Year: newExpense?.Year || null,
                    Month: newExpense?.Month || null,
                    Day: newExpense?.Day || null,
                    Actual: newExpense?.Actual || null,
                    Notes: newExpense?.Notes || null
                },
                candidates
            }),
            signal: controller.signal
        });

        const data = await resp.json().catch(() => null);
        if (!resp.ok) {
            throw new Error(data?.error || `Duplicate check failed: ${resp.status}`);
        }

        const dupList = Array.isArray(data?.duplicates) ? data.duplicates : [];
        const duplicates = dupList
            .map(d => {
                const id = String(d?.id || '').trim();
                const confidence = Number(d?.confidence || 0);
                const reason = String(d?.reason || '').trim();
                const isExactDuplicate = Boolean(d?.isExactDuplicate);
                return { id, confidence, reason, isExactDuplicate };
            })
            .filter(d => d.id && (d.isExactDuplicate || d.confidence >= minConfidence))
            .slice(0, 3)
            .map(d => {
                const exp = allExpenses.find(e => String(e?.id) === d.id);
                if (!exp) return null;
                const confPct = Math.round((Number(d.confidence) || 0) * 100);
                return {
                    expense: exp,
                    matchScore: Math.max(0, Math.min(10, Math.round((Number(d.confidence) || 0) * 10))),
                    reasons: [
                        d.isExactDuplicate ? '⚠️ EXACT DUPLICATE' : 'LLM duplicate match',
                        d.reason || 'Similar transaction description',
                        `LLM confidence: ${confPct}%`
                    ].filter(Boolean),
                    isExactDuplicate: d.isExactDuplicate
                };
            })
            .filter(Boolean);

        return duplicates;
    } finally {
        clearTimeout(timeoutId);
    }
}

// Call on load
document.addEventListener('DOMContentLoaded', updateAppVersionDisplay);

// ==================== FULL-PAGE LOADER FUNCTIONS ====================
function showLoader(message = 'Processing...') {
    const loader = document.getElementById('fullPageLoader');
    const loaderText = document.getElementById('loaderText');
    if (loader) {
        loaderText.textContent = message;
        loader.classList.add('active');
    }
}

function hideLoader() {
    const loader = document.getElementById('fullPageLoader');
    if (loader) {
        loader.classList.remove('active');
    }
}

// ==================== MODAL SCROLL LOCK FUNCTIONS ====================
// Prevents background page from scrolling when modal is open
let scrollPosition = 0;

function lockBodyScroll() {
    scrollPosition = window.pageYOffset;
    document.body.classList.add('modal-open');
    document.body.style.top = `-${scrollPosition}px`;
}

function unlockBodyScroll() {
    document.body.classList.remove('modal-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollPosition);
}

function updateBodyScrollLock() {
    const activeModals = document.querySelectorAll('.modal.active');
    if (activeModals.length > 0) {
        if (!document.body.classList.contains('modal-open')) {
            lockBodyScroll();
        }
    } else {
        if (document.body.classList.contains('modal-open')) {
            unlockBodyScroll();
        }
    }
}

// Watch for modal open/close using MutationObserver
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList.contains('modal')) {
                    updateBodyScrollLock();
                }
            }
        });
    });
    
    // Observe all modals
    document.querySelectorAll('.modal').forEach(modal => {
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });
    
    // Also observe body for dynamically created modals
    const bodyObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && node.classList && node.classList.contains('modal')) {
                    observer.observe(node, { attributes: true, attributeFilter: ['class'] });
                    updateBodyScrollLock();
                }
            });
            mutation.removedNodes.forEach(node => {
                if (node.nodeType === 1 && node.classList && node.classList.contains('modal')) {
                    updateBodyScrollLock();
                }
            });
        });
    });
    bodyObserver.observe(document.body, { childList: true });
});

// Try to get credentials from URL parameters first (works in private mode!)
const urlParams = new URLSearchParams(window.location.search);

function setAppPage(page) {
    try {
        const url = new URL(window.location.href);
        if (page) {
            url.searchParams.set('page', String(page));
        } else {
            url.searchParams.delete('page');
        }
        if (!page || String(page) !== 'weekly-digest') {
            url.searchParams.delete('week_start_date');
        }
        window.history.replaceState({}, '', url.toString());
    } catch (e) {
        // Ignore
    }
}

function getCurrentAppPage() {
    try {
        return new URLSearchParams(window.location.search).get('page');
    } catch (e) {
        return null;
    }
}

// Supabase Configuration (Supabase-only mode)
let SUPABASE_URL = urlParams.get('supabase_url') || localStorage.getItem('supabase_url');
let SUPABASE_ANON_KEY = urlParams.get('supabase_key') || localStorage.getItem('supabase_anon_key');

// Data source is always Supabase
const DATA_SOURCE = 'supabase';

// Initialize Supabase client variable
let supabaseClient = null;

// First-time setup: Ask user for Supabase credentials if not configured
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('⚠️ Supabase credentials not found, prompting user...');
    SUPABASE_URL = prompt('Enter your Supabase Project URL:\n(e.g., https://xxxxx.supabase.co)');
    SUPABASE_ANON_KEY = prompt('Enter your Supabase Anon/Public API Key:\n(Found in Settings > API in your Supabase dashboard)');

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
            localStorage.setItem('supabase_url', SUPABASE_URL);
            localStorage.setItem('supabase_anon_key', SUPABASE_ANON_KEY);
            localStorage.setItem('data_source', 'supabase');
            console.log('✅ Supabase credentials saved');
        } catch (e) {
            console.log('localStorage not available (private mode?)');
        }
    } else {
        alert('❌ Supabase credentials are required to use the app!');
    }
}

// Also check if Supabase credentials are in URL but not saved yet
if (!SUPABASE_URL && !SUPABASE_ANON_KEY) {
    // Check if they're in URL params (for users who bookmarked/added to home screen)
    const urlSupabaseUrl = urlParams.get('supabase_url');
    const urlSupabaseKey = urlParams.get('supabase_key');

    if (urlSupabaseUrl && urlSupabaseKey) {
        SUPABASE_URL = urlSupabaseUrl;
        SUPABASE_ANON_KEY = urlSupabaseKey;

        // Try to save to localStorage for this session
        try {
            localStorage.setItem('supabase_url', SUPABASE_URL);
            localStorage.setItem('supabase_anon_key', SUPABASE_ANON_KEY);
        } catch (e) {
            console.log('localStorage not available (private mode?)');
        }
    }
}

// Initialize Supabase client
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    console.log('✅ Supabase credentials found');
    
    // Create Supabase client
    if (window.supabase && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client initialized');
    } else {
        console.error('❌ Supabase library not loaded!');
    }

    // Log notification status
    if ('Notification' in window) {
        console.log('📱 Notification API available');
        console.log('🔔 Notification permission:', Notification.permission);
    } else {
        console.warn('⚠️ Notification API not available in this browser');
    }

    if ('serviceWorker' in navigator) {
        console.log('⚙️ Service Worker supported');
    } else {
        console.warn('⚠️ Service Worker not supported in this browser');
    }

    // Initialize Supabase Realtime for cross-device notifications
    initializeRealtimeNotifications();

    if ('Notification' in window && Notification.permission === 'granted') {
        ensureWebPushSubscription().catch(e => console.warn('ensureWebPushSubscription failed:', e?.message || e));
    }
} else {
    console.error('❌ Supabase credentials not configured!');
}

// Realtime notification subscription
let realtimeChannel = null;

function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}

let cachedVapidPublicKey = null;

async function getVapidPublicKey() {
    if (cachedVapidPublicKey) return cachedVapidPublicKey;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase credentials not configured');
    }

    const endpoint = `${SUPABASE_URL}/functions/v1/push-config`;
    const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        throw new Error(data?.error || `push-config failed: ${resp.status}`);
    }

    const publicKey = String(data?.publicKey || '').trim();
    if (!publicKey) {
        throw new Error('Missing VAPID public key');
    }

    cachedVapidPublicKey = publicKey;
    return cachedVapidPublicKey;
}

async function ensureWebPushSubscription(options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey || vapidPublicKey.includes('PASTE_YOUR')) return;

    const lastVapidPublicKey = localStorage.getItem('push_vapid_public_key');
    let subscription = await registration.pushManager.getSubscription();

    const forceRotate = Boolean(options?.forceRotate);
    if (forceRotate && subscription) {
        console.log('🔄 Forcing Web Push subscription re-create');
        try {
            await subscription.unsubscribe();
        } catch (_e) {
        }
        subscription = null;
    }

    let subscriptionVapidPublicKey = '';
    try {
        const subKey = subscription?.options?.applicationServerKey;
        if (subKey) {
            if (subKey instanceof Uint8Array) {
                subscriptionVapidPublicKey = uint8ArrayToBase64Url(subKey);
            } else
            if (subKey instanceof ArrayBuffer) {
                subscriptionVapidPublicKey = uint8ArrayToBase64Url(new Uint8Array(subKey));
            } else if (subKey?.buffer instanceof ArrayBuffer) {
                // subKey might be a TypedArray view; only serialize the view bytes, not the full underlying buffer
                const view = new Uint8Array(subKey);
                subscriptionVapidPublicKey = uint8ArrayToBase64Url(view);
            }
        }
    } catch (_e) {
        subscriptionVapidPublicKey = '';
    }

    const shouldRotateExistingSubscription = Boolean(
        subscription && (
            (subscriptionVapidPublicKey && subscriptionVapidPublicKey !== vapidPublicKey) ||
            (!subscriptionVapidPublicKey && lastVapidPublicKey && lastVapidPublicKey !== vapidPublicKey) ||
            (!subscriptionVapidPublicKey && !lastVapidPublicKey)
        )
    );

    if (shouldRotateExistingSubscription) {
        console.log('🔄 Rotating Web Push subscription due to VAPID key mismatch', {
            subscriptionVapidPublicKey: subscriptionVapidPublicKey || null,
            lastVapidPublicKey: lastVapidPublicKey || null,
            currentVapidPublicKey: vapidPublicKey
        });
        try {
            await subscription.unsubscribe();
        } catch (_e) {
        }
        subscription = null;
    }

    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
    }

    await registerPushSubscription(subscription);
    console.log('✅ Web Push subscription ensured and registered', { endpoint: subscription?.endpoint || null });
    localStorage.setItem('push_vapid_public_key', vapidPublicKey);
}

async function registerPushSubscription(subscription) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase credentials not configured');
    }
    const deviceId = getOrCreateDeviceId();
    const endpoint = `${SUPABASE_URL}/functions/v1/push-subscribe`;
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            deviceId,
            subscription: subscription.toJSON(),
            userAgent: navigator.userAgent
        })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        throw new Error(data?.error || `push-subscribe failed: ${resp.status}`);
    }
}

async function broadcastExpensePush(expenseId, cleanFields) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase credentials not configured');
    }
    const creatorDeviceId = getOrCreateDeviceId();
    const endpoint = `${SUPABASE_URL}/functions/v1/push-expense`;
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            creatorDeviceId,
            expenseId,
            item: String(cleanFields?.Item || 'Expense'),
            amount: Number(cleanFields?.Actual || 0)
        })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        throw new Error(data?.error || `push-expense failed: ${resp.status}`);
    }
    return data;
}

async function triggerBudgetAlert(cleanFields) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return;
    }

    const year = Number(cleanFields?.Year);
    const month = String(cleanFields?.Month || '').padStart(2, '0');
    const category = String(cleanFields?.Category || '').trim();

    if (!Number.isFinite(year) || !month || !category) {
        return;
    }

    const creatorDeviceId = getOrCreateDeviceId();
    const endpoint = `${SUPABASE_URL}/functions/v1/push-budget-alert`;
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            creatorDeviceId,
            year,
            month,
            category
        })
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        throw new Error(data?.error || `push-budget-alert failed: ${resp.status}`);
    }
    return data;
}

async function initializeRealtimeNotifications() {
    if (realtimeChannel) {
        console.log('📱 Realtime notifications already subscribed, skipping duplicate subscription');
        return;
    }

    try {
        // Create Supabase client if not exists
        if (!supabaseClient && SUPABASE_URL && SUPABASE_ANON_KEY) {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }

        if (!supabaseClient) {
            console.warn('⚠️ Supabase client not available for realtime');
            return;
        }

        const deviceId = getOrCreateDeviceId();

        console.log('📱 Setting up realtime notifications for device:', deviceId);

        // Subscribe to Budget table inserts
        realtimeChannel = supabaseClient
            .channel('expense-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: TABLE_NAME
                },
                (payload) => {
                    console.log('📬 New expense detected:', payload);

                    // Get the new expense data
                    const newExpense = payload.new;

                    // Check if this expense was created by this device
                    const lastExpenseDeviceId = sessionStorage.getItem('last_expense_device_id');
                    const lastExpenseId = sessionStorage.getItem('last_expense_id');

                    console.log('🔍 Device check:', {
                        currentDevice: deviceId,
                        lastExpenseDevice: lastExpenseDeviceId,
                        lastExpenseId: lastExpenseId,
                        newExpenseId: newExpense?.id,
                        shouldNotify: lastExpenseDeviceId !== deviceId
                    });

                    // Only notify if it's from a different device/session
                    if (newExpense?.id && lastExpenseId && newExpense.id === lastExpenseId) {
                        console.log('⏭️ Same expense (self-created) - skipping notification');
                        return;
                    }

                    if (lastExpenseDeviceId !== deviceId) {
                        console.log('✅ Different device - refreshing data');
                        loadData();
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime notifications subscribed!');
                    showNotification('✅ Cross-device notifications active!', 'success');
                } else if (status === 'CHANNEL_ERROR') {
                    // console.warn('⚠️ Realtime channel error - Cross-device notifications unavailable');
                    // console.warn('💡 To fix: Enable Realtime in Supabase Dashboard → Database → Replication → Budget table');
                    // showNotification('⚠️ Realtime not enabled in Supabase. Cross-device notifications disabled.', 'error');
                } else if (status === 'TIMED_OUT') {
                    // console.warn('⏱️ Realtime connection timed out - Retrying...');
                } else if (status === 'CLOSED') {
                    // console.log('🔌 Realtime connection closed');
                }
            });

    } catch (error) {
        // console.warn('⚠️ Failed to set up realtime notifications:', error.message);
        // console.warn('💡 Cross-device notifications will not work. Local notifications still available.');
        // console.warn('💡 To fix: Enable Realtime in Supabase Dashboard → Database → Replication');
        // Don't show error notification to user - gracefully degrade
    }
}

let allExpenses = [];
let allPayments = [];
let currentReceiptData = null; // Store current receipt for editing
let charts = { pie: null, llc: null, line: null, categoryMonthly: null, contributionsMonthly: null, contributionCoverage: null, yearComparison: null, categoryTrend: null, contributionTrend: null };
let dataLoaded = false;
let fixedExpensesLoaded = false;
let isMaterializingFixedExpenses = false;

// Latest computed over-budget categories for the current dashboard period
let latestOverBudgetCategories = [];
let latestOverBudgetMonthKey = '';

// Pagination variables
let currentPage = 1;
const itemsPerPage = 10;
let currentExpenseIdForDetail = null;

// Utility function for fetch with timeout and retry
async function fetchWithRetry(url, options = {}, retries = 3, timeout = 30000) {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            // Check for CORS/redirect errors (Supabase paused)
            if (error.message.includes('CORS') ||
                error.message.includes('Failed to fetch') ||
                error.message.includes('NetworkError')) {

                // Don't retry on CORS errors - they won't fix themselves
                console.error('❌ Network/CORS Error:', error.message);
                console.error('🔍 This usually means:');
                console.error('   1. Supabase project is PAUSED (most common)');
                console.error('   2. Wrong API credentials');
                console.error('   3. Network connectivity issue');
                console.error(`📍 Failed URL: ${url}`);

                // Only show alert on first error to avoid spam
                if (i === 0 && url.includes('supabase.co')) {
                    const projectId = url.split('//')[1]?.split('.')[0] || 'unknown';
                    alert(`⚠️ Cannot connect to Supabase

Possible causes:
1. Project is PAUSED (most likely)
   → Go to https://supabase.com/dashboard/projects
   → Find project: ${projectId}
   → Click "Restore" button

2. Wrong API credentials
   → Check Settings → API in Supabase dashboard

3. Network issue
   → Check your internet connection

The app will keep trying to reconnect...`);
                }
            }

            if (i === retries - 1) throw error;
            console.log(`Retry ${i + 1}/${retries} for ${url}`);
            await new Promise(resolve => setTimeout(resolve, 500 * (i + 1))); // Faster backoff: 500ms, 1s, 1.5s
        }
    }
}

// Enhanced retry wrapper for database operations with exponential backoff
async function retryOperation(operation, operationName = 'Database operation', maxRetries = 3) {
    let lastNotificationTime = 0;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            const isLastAttempt = attempt === maxRetries - 1;

            // Check if error is retryable (network errors, timeouts, 5xx errors, rate limits)
            const isRetryable =
                error.name === 'AbortError' ||
                error.message.includes('fetch') ||
                error.message.includes('network') ||
                error.message.includes('timeout') ||
                error.message.includes('429') || // Rate limit
                error.message.includes('503') || // Service unavailable
                error.message.includes('502') || // Bad gateway
                error.message.includes('504');   // Gateway timeout

            if (!isRetryable || isLastAttempt) {
                console.error(`${operationName} failed after ${attempt + 1} attempt(s):`, error);
                throw error;
            }

            // Fast backoff: 100ms, 300ms, 500ms for quick recovery
            const delayMs = 100 * (attempt + 1) * (attempt + 1); // 100ms, 400ms, 900ms
            console.warn(`${operationName} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delayMs}ms...`, error.message);

            // Show user-friendly notification (throttled to avoid spam)
            const now = Date.now();
            if (now - lastNotificationTime > 3000) { // Only show once every 3 seconds
                showNotification(`Connection issue, retrying... (${attempt + 1}/${maxRetries})`, 'info');
                lastNotificationTime = now;
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

// ==================== SUPABASE HELPER FUNCTIONS ====================

// Supabase API helper - GET request with retry logic
async function supabaseGet(tableName, filters = {}, limit = null, selectColumns = null, orderBy = null) {
    return await retryOperation(async () => {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Supabase credentials not configured');
        }

        // Default column selection - exclude large binary fields
        let columns = selectColumns;
        if (!columns) {
            // For Budget table, exclude Receipt by default (large base64 images)
            // but include has_receipt to show/hide receipt icon
            if (tableName === TABLE_NAME) {
                columns = 'id,Item,Category,Year,Month,Day,Actual,Budget,LLC,AmarContribution,PriyaContribution,Tags,Notes,has_receipt';
            } else {
                columns = '*';
            }
        }

        let url = `${SUPABASE_URL}/rest/v1/${tableName}?select=${columns}`;

        // Add limit for large tables to prevent timeout
        // Budget table: limit to last 1000 records by default
        if (limit) {
            url += `&limit=${limit}`;
        } else if (tableName === TABLE_NAME) {
            // For Budget table, add default limit and order by id desc to get latest
            url += `&limit=1000&order=id.desc`;
        }

        // Add custom order if specified (overrides default)
        if (orderBy) {
            url += `&order=${orderBy}`;
        }

        // Add filters if provided - supports operators: eq, gt, gte, lt, lte, like, ilike, in
        if (Object.keys(filters).length > 0) {
            const filterParams = Object.entries(filters).map(([key, value]) => {
                // Support range queries and operators as object
                if (typeof value === 'object' && value.operator) {
                    return `${key}=${value.operator}.${encodeURIComponent(value.value)}`;
                }
                // Support operator already in value string (e.g., "ilike.%query%", "eq.true")
                if (typeof value === 'string' && value.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\./)) {
                    // Extract operator and value, encode the value part
                    const dotIndex = value.indexOf('.');
                    const operator = value.substring(0, dotIndex);
                    const filterValue = value.substring(dotIndex + 1);
                    return `${key}=${operator}.${encodeURIComponent(filterValue)}`;
                }
                // Default to exact match
                return `${key}=eq.${encodeURIComponent(value)}`;
            }).join('&');
            url += `&${filterParams}`;
        }

        const response = await fetchWithRetry(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        // Check for redirect responses (Supabase paused/billing issue)
        if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
            const redirectUrl = response.headers.get('Location') || 'unknown';
            console.error('❌ Supabase is redirecting - Project may be PAUSED or has billing issues');
            console.error('🔗 Redirect to:', redirectUrl);

            // Show user-friendly error
            const errorMsg = `
⏸️ Supabase Project Appears to be PAUSED

Your Supabase project needs to be reactivated:

1. Go to: https://supabase.com/dashboard/projects
2. Find project: ${SUPABASE_URL.split('//')[1].split('.')[0]}
3. Click "Restore" or "Resume" button
4. Wait 1-2 minutes for project to wake up
5. Reload this page

Note: Free tier projects pause after 1 week of inactivity.
`;
            alert(errorMsg);
            throw new Error(`Supabase project is redirecting (likely paused). Visit dashboard to restore project.`);
        }

        if (!response.ok) {
            const errorText = await response.text();

            // Check if response is HTML (common for paused projects)
            if (errorText.includes('<html') || errorText.includes('<!DOCTYPE')) {
                console.error('❌ Received HTML instead of JSON - Supabase project likely PAUSED');
                alert('⏸️ Your Supabase project appears to be paused.\n\nPlease go to https://supabase.com/dashboard/projects and restore your project.');
                throw new Error('Supabase project appears to be paused (received HTML instead of JSON)');
            }

            throw new Error(`Supabase GET error (${response.status}): ${errorText}`);
        }

        return await response.json();
    }, `Supabase GET ${tableName}`);
}

// Supabase API helper - POST request with retry logic
async function supabasePost(tableName, data) {
    return await retryOperation(async () => {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Supabase credentials not configured');
        }

        const response = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${tableName}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Supabase POST error (${response.status}): ${error}`);
        }

        const result = await response.json();
        return Array.isArray(result) ? result[0] : result;
    }, `Supabase POST ${tableName}`);
}

// Supabase API helper - PATCH request with retry logic
async function supabasePatch(tableName, id, data) {
    return await retryOperation(async () => {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Supabase credentials not configured');
        }

        const response = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Supabase PATCH error (${response.status}): ${error}`);
        }

        const result = await response.json();
        return Array.isArray(result) ? result[0] : result;
    }, `Supabase PATCH ${tableName}/${id}`);
}

// Supabase API helper - DELETE request with retry logic
async function supabaseDelete(tableName, id) {
    return await retryOperation(async () => {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Supabase credentials not configured');
        }

        const response = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Supabase DELETE error (${response.status}): ${error}`);
        }

        return true;
    }, `Supabase DELETE ${tableName}/${id}`);
}

async function supabaseDeleteWhere(tableName, whereQuery) {
    return await retryOperation(async () => {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Supabase credentials not configured');
        }

        const url = `${SUPABASE_URL}/rest/v1/${tableName}?${whereQuery}`;
        const response = await fetchWithRetry(url, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Supabase DELETE error (${response.status}): ${error}`);
        }

        return true;
    }, `Supabase DELETE ${tableName} where ${whereQuery}`);
}

// Convert Supabase format to internal record format (for compatibility)
function supabaseToAirtable(supabaseRecord) {
    const fields = { ...supabaseRecord };
    
    // Remove the 'id' from fields since it's at the top level
    delete fields.id;

    // Convert boolean values to "Yes"/"No" for LLC field
    if (typeof fields.LLC === 'boolean') {
        fields.LLC = fields.LLC ? 'Yes' : 'No';
    } else if (fields.LLC === 'true' || fields.LLC === true) {
        fields.LLC = 'Yes';
    } else if (fields.LLC === 'false' || fields.LLC === false || fields.LLC === null || fields.LLC === '') {
        fields.LLC = 'No';
    }

    // Convert boolean values for Recurring field in Budgets table
    if (typeof fields.Recurring === 'boolean') {
        fields.Recurring = fields.Recurring ? 'Yes' : 'No';
    } else if (fields.Recurring === 'true' || fields.Recurring === true) {
        fields.Recurring = 'Yes';
    } else if (fields.Recurring === 'false' || fields.Recurring === false || fields.Recurring === null || fields.Recurring === '') {
        fields.Recurring = 'No';
    }

    // Ensure we always have a usable date for rendering/filtering.
    // If a record was inserted with null date parts (e.g., a UI bug), it can disappear from the filtered list.
    // Prefer the active filter selection so the user can find and edit the record.
    const now = new Date();
    const yearSelector = document.getElementById('yearSelector');
    const monthSelector = document.getElementById('monthSelector');
    const fallbackYear = (yearSelector && yearSelector.value && yearSelector.value !== 'all') ? parseInt(yearSelector.value) : now.getFullYear();
    const fallbackMonth = (monthSelector && monthSelector.value && monthSelector.value !== 'all') ? String(monthSelector.value).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0');
    const fallbackDay = 1;

    if (fields.Year === undefined || fields.Year === null || fields.Year === '') {
        fields.Year = fallbackYear;
    }
    if (fields.Month === undefined || fields.Month === null || fields.Month === '') {
        fields.Month = fallbackMonth;
    }
    if (fields.Day === undefined || fields.Day === null || fields.Day === '') {
        fields.Day = fallbackDay;
    }

    // Ensure Month is a string (zero-padded) - do this FIRST before numeric conversion
    if (fields.Month !== undefined && fields.Month !== null && fields.Month !== '') {
        fields.Month = String(fields.Month).padStart(2, '0');
    }

    // Ensure Year is a number
    if (fields.Year !== undefined && fields.Year !== null && fields.Year !== '') {
        fields.Year = parseInt(fields.Year) || new Date().getFullYear();
    }

    // Ensure Day is a number
    if (fields.Day !== undefined && fields.Day !== null && fields.Day !== '') {
        fields.Day = parseInt(fields.Day) || 1;
    }

    // Ensure numeric currency fields are actually numbers (not strings)
    const numericFields = ['Actual', 'Budget', 'AmarContribution', 'PriyaContribution', 'Amount'];
    numericFields.forEach(field => {
        if (fields[field] !== undefined && fields[field] !== null && fields[field] !== '') {
            const num = parseFloat(fields[field]);
            fields[field] = isNaN(num) ? 0 : num;
        } else if (fields[field] === '' || fields[field] === null) {
            fields[field] = 0;
        }
    });

    // Receipt field handling - keep as base64 string from Supabase
    // Only parse if it's actually a JSON array (old Airtable format)
    if (fields.Receipt && typeof fields.Receipt === 'string') {
        // Check if it's a JSON array (starts with '[')
        if (fields.Receipt.trim().startsWith('[')) {
            try {
                fields.Receipt = JSON.parse(fields.Receipt);
            } catch (e) {
                // If parse fails, leave as-is (it's a base64 string)
                console.warn('Receipt is not JSON, treating as base64 string');
            }
        }
        // If it starts with 'data:image', it's already a base64 string - leave as-is
    }
    
    return {
        id: supabaseRecord.id,
        fields: fields
    };
}

// Table name mapping removed - direct Supabase table names used

// Show loading spinner on button
function setButtonLoading(button, loading) {
    if (loading) {
        button.classList.add('btn-loading');
        button.disabled = true;
    } else {
        button.classList.remove('btn-loading');
        button.disabled = false;
    }
}

// Real-time currency formatting: formats as you type (1100 → 11.00)
function formatCurrencyInputRealtime(input) {
    // Store cursor position
    let cursorPosition = input.selectionStart;
    let oldValue = input.value;
    let oldLength = oldValue.length;

    // Get only digits
    let digitsOnly = input.value.replace(/[^\d]/g, '');

    // Handle empty input
    if (digitsOnly === '' || digitsOnly === '0') {
        if (input.id === 'budget') {
            input.value = '0.00';
        } else {
            input.value = '';
        }
        return;
    }

    // Remove leading zeros
    digitsOnly = digitsOnly.replace(/^0+/, '') || '0';

    // Convert to cents and format
    let numValue = parseInt(digitsOnly, 10);
    let formatted = (numValue / 100).toFixed(2);

    // Update value
    input.value = formatted;

    // Calculate new cursor position
    let newLength = formatted.length;
    let lengthDiff = newLength - oldLength;

    // Adjust cursor position (keep it in same relative position)
    let newPosition = cursorPosition + lengthDiff;

    // Don't place cursor in decimal point
    if (formatted[newPosition] === '.') {
        newPosition++;
    }

    // Keep cursor in valid range
    newPosition = Math.max(0, Math.min(newPosition, formatted.length));

    // Restore cursor position
    input.setSelectionRange(newPosition, newPosition);
}

// Initialize currency input with formatted value
function initializeCurrencyInput(input) {
    if (input.value === '' || input.value === '0') {
        if (input.id === 'budget') {
            input.value = '0.00';
        } else {
            input.value = '';
            input.placeholder = '0.00';
        }
    } else {
        formatCurrencyInputRealtime(input);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 DOMContentLoaded - Page initialized');
    console.log('🔍 Checking if clearAllFilters function exists:', typeof clearAllFilters);
    console.log('🔍 clearAllFilters is:', clearAllFilters);

    // Test button click
    const clearBtn = document.querySelector('button[onclick="clearAllFilters()"]');
    console.log('🔍 Clear All Filters button found:', clearBtn ? 'YES' : 'NO');
    if (clearBtn) {
        console.log('   Button text:', clearBtn.textContent.trim());
        console.log('   Button onclick:', clearBtn.getAttribute('onclick'));

        // Add backup event listener
        console.log('🔧 Adding backup click event listener...');
        clearBtn.addEventListener('click', function (e) {
            console.log('🖱️ BUTTON CLICKED via addEventListener!');
            e.preventDefault();
            e.stopPropagation();

            if (typeof clearAllFilters === 'function') {
                console.log('✅ Calling clearAllFilters() function...');
                clearAllFilters();
            } else {
                console.error('❌ clearAllFilters is not a function!', typeof clearAllFilters);
            }
        });
        console.log('✅ Backup event listener added');
    }

    populateYearDropdown();
    
    // Update notification button state based on current permission
    updateNotificationButtonState();
    
    // Update last refresh time display
    updateLastRefreshTime();

    const initialPage = getCurrentAppPage();
    if (initialPage === 'weekly-digest') {
        openWeeklyDigest({ skipUrlUpdate: true, skipLoad: true });
    }

    loadData().then(() => {
        if (getCurrentAppPage() === 'weekly-digest') {
            renderWeeklyDigest();
        }
    });
    loadProfilePictures();
    loadFixedExpenses();
    loadLLCExpenses();

    // Setup real-time currency formatting for all amount inputs
    const currencyInputIds = [
        'actual',
        'budget',
        'amarContributionInput',
        'priyaContributionInput',
        'contributionAmount',
        'fixedAmount',
        'minAmount',
        'maxAmount'
    ];

    currencyInputIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // Initialize with placeholder
            initializeCurrencyInput(input);

            // Format in real-time as user types
            input.addEventListener('input', function (e) {
                formatCurrencyInputRealtime(this);
            });

            // Clear placeholder on focus for non-budget fields
            if (id !== 'budget') {
                input.addEventListener('focus', function (e) {
                    if (this.value === '' || this.value === '0.00') {
                        this.value = '';
                    }
                });
            }

            // Ensure formatted on blur
            input.addEventListener('blur', function (e) {
                if (this.value.trim() === '') {
                    if (id === 'budget') {
                        this.value = '0.00';
                    }
                }
            });
        }
    });

    // Also setup for dynamically created modals - use event delegation
    document.addEventListener('focus', function (e) {
        if (e.target.type === 'number' || e.target.type === 'tel') {
            if (e.target.id && (e.target.id.toLowerCase().includes('amount') ||
                e.target.id.toLowerCase().includes('contribution') ||
                e.target.id === 'actual' || e.target.id === 'budget')) {

                // Initialize if not already done
                if (!e.target.dataset.currencyFormatted) {
                    initializeCurrencyInput(e.target);
                    e.target.dataset.currencyFormatted = 'true';

                    // Add input listener
                    e.target.addEventListener('input', function () {
                        formatCurrencyInputRealtime(this);
                    });
                }
            }
        }
    }, true);

    // Pull-to-refresh functionality with haptic feedback
    let touchStartY = 0;
    let touchEndY = 0;
    let isPulling = false;
    let pullDistance = 0;
    let hasTriggeredHaptic = false;
    let isRefreshing = false;
    let pullStartTime = 0;
    const PULL_DEAD_ZONE = 60;      // Ignore the first 60px (prevents accidental triggers)
    const PULL_THRESHOLD = 220;      // Must pull 220px raw to trigger (iOS-like)
    const PULL_MAX_TRANSLATE = 90;   // Max visual travel of indicator
    const VELOCITY_GATE = 0.15;      // Minimum px/ms velocity to even start tracking

    const pullToRefreshIndicator = document.createElement('div');
    pullToRefreshIndicator.id = 'pullToRefreshIndicator';
    pullToRefreshIndicator.style.cssText = `
                 position: fixed;
                 top: -${PULL_MAX_TRANSLATE}px;
                 left: 0;
                 right: 0;
                 height: ${PULL_MAX_TRANSLATE}px;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 z-index: 9998;
                 transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                 color: white;
                 font-weight: 600;
                 font-size: 14px;
             `;
    pullToRefreshIndicator.classList.add('pull-refresh-default');
    pullToRefreshIndicator.innerHTML = '<div style="text-align: center;"><i class="fas fa-arrow-down" id="ptrArrow" style="font-size: 20px; margin-bottom: 6px; opacity: 0.7; transition: transform 0.2s ease;"></i><div id="ptrLabel">Pull to refresh</div></div>';
    document.body.appendChild(pullToRefreshIndicator);

    // Haptic feedback — prefers iOS Taptic Engine via non-standard API, falls back to vibrate
    function triggerHaptic(style) {
        try {
            // Safari on iOS doesn't support vibrate, but WebKit exposes
            // a non-standard selection feedback we can piggyback on.
            // The Vibration API is the real workhorse on Android.
            if (style === 'light' && 'vibrate' in navigator) {
                navigator.vibrate(10);
            } else if (style === 'medium' && 'vibrate' in navigator) {
                navigator.vibrate(20);
            } else if (style === 'success' && 'vibrate' in navigator) {
                navigator.vibrate([15, 60, 15]);
            } else if (style === 'error' && 'vibrate' in navigator) {
                navigator.vibrate([40, 30, 40, 30, 60]);
            } else if ('vibrate' in navigator) {
                navigator.vibrate(15);
            }
        } catch (_e) { /* haptic not available */ }
    }

    // iOS-style rubber-band: diminishing returns as you pull farther
    function rubberBand(rawDist, maxOut) {
        const d = Math.max(0, rawDist);
        // f(x) = maxOut * (1 - e^(-k*x)) — asymptotic curve
        const k = 3.5 / PULL_THRESHOLD;
        return maxOut * (1 - Math.exp(-k * d));
    }

    document.addEventListener('touchstart', function (e) {
        if (isRefreshing) return;
        if (window.scrollY <= 0) {
            touchStartY = e.touches[0].clientY;
            pullStartTime = Date.now();
            isPulling = true;
            hasTriggeredHaptic = false;
            pullToRefreshIndicator.style.transition = 'none';
        }
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (!isPulling || isRefreshing) return;

        touchEndY = e.touches[0].clientY;
        pullDistance = touchEndY - touchStartY;

        // Must be scrolled to top and pulling down
        if (pullDistance <= 0 || window.scrollY > 0) {
            pullToRefreshIndicator.style.transform = 'translateY(0)';
            return;
        }

        // Velocity gate: ignore slow/accidental drags in the first moments
        const elapsed = Date.now() - pullStartTime;
        if (elapsed > 0 && elapsed < 300 && (pullDistance / elapsed) < VELOCITY_GATE) {
            return;
        }

        // Dead zone: ignore the initial portion
        const effectivePull = Math.max(0, pullDistance - PULL_DEAD_ZONE);
        if (effectivePull <= 0) return;

        const translateY = rubberBand(effectivePull, PULL_MAX_TRANSLATE);
        pullToRefreshIndicator.style.transform = `translateY(${translateY}px)`;

        const progress = Math.min(effectivePull / (PULL_THRESHOLD - PULL_DEAD_ZONE), 1);
        const arrow = document.getElementById('ptrArrow');
        const label = document.getElementById('ptrLabel');

        if (pullDistance >= PULL_THRESHOLD) {
            if (!hasTriggeredHaptic) {
                triggerHaptic('medium');
                hasTriggeredHaptic = true;
            }
            if (arrow) {
                arrow.className = 'fas fa-check-circle';
                arrow.style.transform = 'rotate(0deg)';
                arrow.style.fontSize = '24px';
                arrow.style.opacity = '1';
            }
            if (label) label.textContent = 'Release to refresh';
            pullToRefreshIndicator.classList.remove('pull-refresh-default');
            pullToRefreshIndicator.classList.add('pull-refresh-ready');
        } else {
            hasTriggeredHaptic = false;
            // Rotate arrow as user pulls (0° → 180°)
            if (arrow) {
                arrow.className = 'fas fa-arrow-down';
                arrow.style.transform = `rotate(${progress * 180}deg)`;
                arrow.style.fontSize = '20px';
                arrow.style.opacity = `${0.4 + progress * 0.6}`;
            }
            if (label) label.textContent = 'Pull to refresh';
            pullToRefreshIndicator.classList.remove('pull-refresh-ready');
            pullToRefreshIndicator.classList.add('pull-refresh-default');
        }

        // Light haptic ticks at 33%, 66% progress (like iOS scroll detents)
        if (!hasTriggeredHaptic) {
            if ((progress >= 0.33 && progress < 0.36) || (progress >= 0.66 && progress < 0.69)) {
                triggerHaptic('light');
            }
        }
    }, { passive: true });

    document.addEventListener('touchend', async function (e) {
        if (!isPulling || isRefreshing) return;

        pullToRefreshIndicator.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

        if (pullDistance >= PULL_THRESHOLD && window.scrollY <= 0) {
            isRefreshing = true;
            triggerHaptic('medium');

            pullToRefreshIndicator.innerHTML = '<div style="text-align: center;"><div class="loading" style="width: 24px; height: 24px; border-width: 3px; margin: 0 auto 8px;"></div><div>Refreshing...</div></div>';
            pullToRefreshIndicator.classList.remove('pull-refresh-ready');
            pullToRefreshIndicator.classList.add('pull-refresh-default');
            pullToRefreshIndicator.style.transform = `translateY(${PULL_MAX_TRANSLATE}px)`;

            try {
                await loadData();
                await loadProfilePictures();
                await loadFixedExpenses();
                await loadLLCExpenses();

                renderExpenses();
                renderPayments();
                updateStats();

                triggerHaptic('success');
                showNotification('Data refreshed successfully!', 'success');
            } catch (error) {
                triggerHaptic('error');
                showNotification('Failed to refresh data', 'error');
            }

            setTimeout(() => {
                pullToRefreshIndicator.style.transform = 'translateY(0)';
                pullToRefreshIndicator.innerHTML = '<div style="text-align: center;"><i class="fas fa-arrow-down" id="ptrArrow" style="font-size: 20px; margin-bottom: 6px; opacity: 0.7; transition: transform 0.2s ease;"></i><div id="ptrLabel">Pull to refresh</div></div>';
                isRefreshing = false;
            }, 600);
        } else {
            pullToRefreshIndicator.style.transform = 'translateY(0)';
            pullToRefreshIndicator.classList.remove('pull-refresh-ready');
            pullToRefreshIndicator.classList.add('pull-refresh-default');
        }

        isPulling = false;
        touchStartY = 0;
        touchEndY = 0;
        pullDistance = 0;
        hasTriggeredHaptic = false;
    }, { passive: true });
});

async function loadProfilePictures() {
    try {
        let data;

        // Load from Supabase
        try {
            const profiles = await supabaseGet(PROFILES_TABLE);
            data = { records: profiles.map(supabaseToAirtable) };
        } catch (error) {
            console.log('Profiles table not found in Supabase - will be created on first upload');
            return;
        }

        // Find Amar's profile
        const amarProfile = data.records.find(r => r.fields.Person === 'Amar');
        if (amarProfile && amarProfile.fields.Picture) {
            // Handle both URL string and attachment array formats
            const pictureUrl = Array.isArray(amarProfile.fields.Picture) && amarProfile.fields.Picture[0]?.url
                ? amarProfile.fields.Picture[0].url
                : amarProfile.fields.Picture;
            if (pictureUrl) {
                document.getElementById('amarPicture').src = pictureUrl;
                document.getElementById('amarPicture').style.display = 'block';
                document.getElementById('amarPictureIcon').style.display = 'none';
            }
        }

        // Find Priya's profile
        const priyaProfile = data.records.find(r => r.fields.Person === 'Priya');
        if (priyaProfile && priyaProfile.fields.Picture) {
            // Handle both URL string and attachment array formats
            const pictureUrl = Array.isArray(priyaProfile.fields.Picture) && priyaProfile.fields.Picture[0]?.url
                ? priyaProfile.fields.Picture[0].url
                : priyaProfile.fields.Picture;
            if (pictureUrl) {
                document.getElementById('priyaPicture').src = pictureUrl;
                document.getElementById('priyaPicture').style.display = 'block';
                document.getElementById('priyaPictureIcon').style.display = 'none';
            }
        }
    } catch (error) {
        console.log('Could not load profile pictures:', error);
    }
}

async function uploadProfilePicture(person, input) {
    const file = input.files[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }

    showNotification('Uploading picture...', 'info');

    try {
        // Convert file to base64
        const reader = new FileReader();

        const base64Promise = new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const base64Data = await base64Promise;

        // Check if profile exists
        const profiles = await supabaseGet(PROFILES_TABLE, { Person: person });

        let profileId = null;
        if (profiles && profiles.length > 0) {
            profileId = profiles[0].id;
        }

        // Create or update profile record with base64 image
        const profileData = {
            Person: person,
            Picture: base64Data
        };

        if (profileId) {
            // Update existing profile
            await supabasePatch(PROFILES_TABLE, profileId, profileData);
        } else {
            // Create new profile
            await supabasePost(PROFILES_TABLE, profileData);
        }

        // Reload pictures to show the new one
        await loadProfilePictures();
        showNotification(`${person}'s picture updated!`, 'success');

    } catch (error) {
        console.error('Profile picture upload error:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

function populateYearDropdown() {
    const yearSelect = document.getElementById('year');
    const currentYear = new Date().getFullYear();
    for (let year = 2025; year <= 2045; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }
}

async function loadData(options = {}) {
    const { silent = false } = options;
    const startTime = performance.now();
    console.log('⏱️ Loading data...');

    try {
        // Show loading in expenses list
        const expensesList = document.getElementById('expensesList');
        if (expensesList) {
            expensesList.innerHTML = '<div class="text-center py-12 text-gray-400"><div class="spinner mx-auto mb-4"></div><p>Loading expenses...</p></div>';
        }

        // Load from Supabase - LOAD IN PARALLEL for faster performance
        const queryStart = performance.now();

        try {
            const [expensesData, paymentsData] = await Promise.allSettled([
                supabaseGet(TABLE_NAME),
                supabaseGet(PAYMENTS_TABLE)
            ]);

            const queryEnd = performance.now();
            console.log(`⚡ Database queries completed in ${(queryEnd - queryStart).toFixed(0)}ms`);

            // Handle expenses
            if (expensesData.status === 'fulfilled') {
                allExpenses = expensesData.value.map(supabaseToAirtable);
                console.log(`📊 Loaded ${allExpenses.length} expenses`);
            } else {
                console.error('Error loading expenses:', expensesData.reason);
                throw expensesData.reason;
            }

            // Handle payments (optional table)
            if (paymentsData.status === 'fulfilled') {
                allPayments = paymentsData.value.map(supabaseToAirtable);
                console.log(`💰 Loaded ${allPayments.length} payments`);
            } else {
                console.log('Payments table not found in Supabase - will be created on first payment');
                allPayments = [];
            }
        } catch (error) {
            console.error('Error loading from Supabase:', error);
            showNotification('Error loading from Supabase: ' + error.message, 'error');
            throw error;
        }

        const processingStart = performance.now();
        await loadCategoryBudgets(); // Load budget definitions
        const budgetTime = performance.now();
        console.log(`📋 Budgets loaded in ${(budgetTime - processingStart).toFixed(0)}ms`);

        populateFilters();
        populateCategorySelector();
        populateCategoryDatalist();
        populateItemDatalist();
        populateTagsDatalist();
        updateTagFilterDropdown();
        populateFilterDropdowns(); // Populate new Filters tab dropdowns
        const filterTime = performance.now();
        console.log(`🔍 Filters populated in ${(filterTime - budgetTime).toFixed(0)}ms`);

        renderExpenses();
        const renderTime = performance.now();
        console.log(`🎨 Expenses rendered in ${(renderTime - filterTime).toFixed(0)}ms`);

        renderPayments();
        updateStats();
        updateCharts();
        updateMismatchNotification();

        const totalTime = performance.now() - startTime;
        console.log(`✅ Total load time: ${totalTime.toFixed(0)}ms (${(totalTime/1000).toFixed(2)}s)`);

        if (totalTime > 1000) {
            console.warn(`⚠️ Load time exceeded 1 second!`);
        }

        // Hide global loading overlay
        const overlay = document.getElementById('globalLoadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }

        // Update last refresh timestamp
        const refreshTime = new Date().toISOString();
        localStorage.setItem('last_app_refresh', refreshTime);
        updateLastRefreshTime();
        console.log('✅ Updated last refresh time:', refreshTime);
        
        dataLoaded = true;
        if (fixedExpensesLoaded && !isMaterializingFixedExpenses) {
            await materializeFixedExpensesForCurrentMonth();
        }

        if (!silent) {
            showNotification('Data loaded successfully!', 'success');
        }
    } catch (error) {
        const errorTime = performance.now() - startTime;
        console.error(`❌ Error after ${errorTime.toFixed(0)}ms:`, error);

        // Hide global loading overlay even on error
        const overlay = document.getElementById('globalLoadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }

        const expensesList = document.getElementById('expensesList');
        if (expensesList) {
            expensesList.innerHTML = '<div class="text-center py-12 text-red-400"><i class="fas fa-exclamation-triangle text-4xl mb-3"></i><p>Failed to load data. Please refresh.</p></div>';
        }
        showNotification('Error: ' + error.message, 'error');
    }
}

function populateFilters() {
    const yearSelector = document.getElementById('yearSelector');
    const monthSelector = document.getElementById('monthSelector');
    yearSelector.innerHTML = '<option value="all">All Years</option>';
    monthSelector.innerHTML = '<option value="all">All Months</option>';
    const years = [...new Set(allExpenses.map(exp => exp.fields.Year).filter(Boolean))].sort().reverse();
    const months = [...new Set(allExpenses.map(exp => exp.fields.Month).filter(Boolean))].sort();
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelector.appendChild(option);
    });
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        const monthNum = parseInt(month);
        option.textContent = monthNames[monthNum - 1] || month;
        monthSelector.appendChild(option);
    });
    
    // ALWAYS default to current month and year
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Set year selector to current year (add option if it doesn't exist in data)
    if (years.includes(currentYear)) {
        yearSelector.value = currentYear;
    } else {
        // If current year not in data, add it and select it
        const option = document.createElement('option');
        option.value = currentYear;
        option.textContent = currentYear;
        yearSelector.insertBefore(option, yearSelector.children[1]); // Insert after "All Years"
        yearSelector.value = currentYear;
    }
    
    // Set month selector to current month (add option if it doesn't exist in data)
    if (months.includes(currentMonth)) {
        monthSelector.value = currentMonth;
    } else {
        // If current month not in data, add it and select it
        const monthNum = parseInt(currentMonth);
        const option = document.createElement('option');
        option.value = currentMonth;
        option.textContent = monthNames[monthNum - 1];
        monthSelector.appendChild(option);
        monthSelector.value = currentMonth;
    }
    
    console.log(`📅 Filter defaulted to: ${monthNames[parseInt(currentMonth) - 1]} ${currentYear}`);
}

function filterByPeriod() {
    currentPage = 1; // Reset to first page when filter changes
    renderExpenses();
    renderPayments();
    updateStats();
    updateCharts();
    updateInsights();
}

function getFilteredExpenses() {
    const selectedYear = document.getElementById('yearSelector').value;
    const selectedMonth = document.getElementById('monthSelector').value;
    let filtered = allExpenses;
    if (selectedYear !== 'all') filtered = filtered.filter(exp => String(exp.fields.Year) === selectedYear);
    if (selectedMonth !== 'all') filtered = filtered.filter(exp => exp.fields.Month === selectedMonth);
    return filtered;
}

function toggleAdvancedFilters() {
    const filters = document.getElementById('advancedFilters');
    filters.style.display = filters.style.display === 'none' ? 'block' : 'none';
}

function filterExpenses() {
    const searchTerm = document.getElementById('expenseSearch').value.toLowerCase();
    const minAmount = parseFloat(document.getElementById('minAmount').value) || 0;
    const maxAmount = parseFloat(document.getElementById('maxAmount').value) || Infinity;
    const startDay = parseInt(document.getElementById('startDay').value) || 1;
    const endDay = parseInt(document.getElementById('endDay').value) || 31;
    const tagFilter = document.getElementById('tagFilter').value;

    const filtered = getFilteredExpenses().filter(expense => {
        // Search filter
        const searchMatch = !searchTerm ||
            (expense.fields.Item || '').toLowerCase().includes(searchTerm) ||
            (expense.fields.Category || '').toLowerCase().includes(searchTerm) ||
            (expense.fields.Notes || '').toLowerCase().includes(searchTerm) ||
            (expense.fields.Tags || '').toLowerCase().includes(searchTerm);

        // Amount filter
        const amount = expense.fields.Actual || 0;
        const amountMatch = amount >= minAmount && amount <= maxAmount;

        // Day filter (within the already filtered month/year)
        const expenseDay = expense.fields.Day || 1;
        const dayMatch = expenseDay >= startDay && expenseDay <= endDay;

        // Tag filter
        const tagMatch = !tagFilter || (expense.fields.Tags || '').includes(tagFilter);

        return searchMatch && amountMatch && dayMatch && tagMatch;
    });

    renderFilteredExpenses(filtered);
}

function clearExpenseFilters() {
    document.getElementById('expenseSearch').value = '';
    document.getElementById('minAmount').value = '';
    document.getElementById('maxAmount').value = '';
    document.getElementById('startDay').value = '';
    document.getElementById('endDay').value = '';
    document.getElementById('tagFilter').value = '';
    currentPage = 1; // Reset to first page
    renderExpenses();
}

function renderFilteredExpenses(expenses) {
    const container = document.getElementById('expensesList');
    if (expenses.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-gray-400"><i class="fas fa-inbox text-4xl mb-3"></i><p>No expenses match your filters</p></div>';
        document.getElementById('paginationControls').style.display = 'none';
        return;
    }

    // Sort by date (newest first), then by creation time (most recent first)
    const sortedExpenses = [...expenses].sort((a, b) => {
        const dateA = `${a.fields.Year}-${String(a.fields.Month).padStart(2, '0')}-${String(a.fields.Day || 1).padStart(2, '0')}`;
        const dateB = `${b.fields.Year}-${String(b.fields.Month).padStart(2, '0')}-${String(b.fields.Day || 1).padStart(2, '0')}`;
        const dateCompare = dateB.localeCompare(dateA);

        // If dates are the same, sort by creation time (most recent first)
        if (dateCompare === 0) {
            const createdA = new Date(a.createdTime || 0);
            const createdB = new Date(b.createdTime || 0);
            return createdB - createdA;
        }

        return dateCompare;
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    container.innerHTML = sortedExpenses.map(expense => {
        const fields = expense.fields;
        const budget = fields.Budget || 0;
        const actual = fields.Actual || 0;
        const monthDisplay = fields.Month ? monthNames[parseInt(fields.Month) - 1] : 'N/A';
        const day = fields.Day || 1;
        const dateDisplay = `${monthDisplay} ${day}, ${fields.Year || 'N/A'}`;
        const hasNotes = fields.Notes && fields.Notes.trim();
        const notesEscaped = hasNotes ? fields.Notes.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
        const tags = fields.Tags || '';

        // Determine actual amount color based on budget comparison
        let actualColorClass = 'text-gray-700'; // Default black/gray for equal
        if (actual > budget) {
            actualColorClass = 'text-red-600'; // Red if over budget
        } else if (actual < budget) {
            actualColorClass = 'text-green-600'; // Green if under budget
        }

        // Tags display (always render div for grid structure)
        let tagsContent = '';
        if (tags.trim()) {
            tagsContent = tags.split(',').map(tag =>
                `<span class="inline-block px-2 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-full text-xs font-medium mr-1 mb-1"><i class="fas fa-tag mr-1"></i>${tag.trim()}</span>`
            ).join('');
        }

        return `
                    <div class="expense-row cursor-pointer hover:bg-gray-50" onclick="viewExpenseDetails('${expense.id}')" style="cursor: pointer;">
                        <div class="expense-item"><span class="expense-label">Item:</span><span class="font-semibold text-gray-800">${fields.Item || 'Unnamed'}${hasNotes ? ` <i class="fas fa-info-circle text-blue-500 cursor-pointer" title="${notesEscaped}"></i>` : ''}</span></div>
                        <div class="expense-item"><span class="expense-label">Category:</span><span class="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">${fields.Category || 'N/A'}</span></div>
                        <div class="expense-item"><span class="expense-label">Date:</span><span class="text-gray-600">${dateDisplay}</span></div>
                        <div class="expense-item"><span class="expense-label">Amount:</span><span class="font-bold text-lg ${actualColorClass}">$${actual.toFixed(2)}</span></div>
                        <div class="expense-item"><span class="expense-label">Tags:</span><div class="flex flex-wrap">${tagsContent || '<span class="text-gray-400 text-xs">—</span>'}</div></div>
                        <div class="expense-item"><span class="expense-label">LLC:</span><span class="badge ${fields.LLC === 'Yes' ? 'badge-llc' : 'badge-personal'}">${fields.LLC || 'No'}</span></div>
                        <div class="expense-item"><span class="expense-label">Receipt:</span>${fields.has_receipt ? `<button onclick="event.stopPropagation(); viewReceiptFromExpense('${expense.id}');" class="text-purple-600 hover:text-purple-800" title="View Receipt" style="background: none; border: none; cursor: pointer; padding: 0;"><i class="fas fa-receipt text-xl"></i></button>` : '<span class="text-gray-300"><i class="fas fa-receipt text-xl"></i></span>'}</div>
                        <div class="expense-item"><span class="expense-label">Actions:</span><div class="flex gap-3">
                            <button onclick="event.stopPropagation(); editExpense('${expense.id}')" class="text-blue-500 hover:text-blue-700 text-lg" title="Edit"><i class="fas fa-edit"></i></button>
                            <button onclick="event.stopPropagation(); deleteExpense('${expense.id}')" class="text-red-500 hover:text-red-700 text-lg" title="Delete"><i class="fas fa-trash"></i></button>
                        </div></div>
                    </div>
                 `;
    }).join('');

    // Update tag filter dropdown
    updateTagFilterDropdown();
}

function updateTagFilterDropdown() {
    const tagFilter = document.getElementById('tagFilter');
    const allTags = new Set();

    allExpenses.forEach(expense => {
        if (expense.fields.Tags) {
            expense.fields.Tags.split(',').forEach(tag => {
                const trimmed = tag.trim();
                if (trimmed) allTags.add(trimmed);
            });
        }
    });

    const currentValue = tagFilter.value;
    tagFilter.innerHTML = '<option value="">All Tags</option>' +
        Array.from(allTags).sort().map(tag => `<option value="${tag}">${tag}</option>`).join('');
    tagFilter.value = currentValue;
}

function renderExpenses() {
    const container = document.getElementById('expensesList');
    const filteredExpenses = getFilteredExpenses();
    if (filteredExpenses.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-gray-400"><i class="fas fa-inbox text-6xl mb-4"></i><p class="text-lg">No expenses found</p><button onclick="openAddExpenseModal()" class="btn-primary mt-4"><i class="fas fa-plus mr-2"></i>Add Your First Expense</button></div>`;
        document.getElementById('paginationControls').style.display = 'none';
        return;
    }

    // Sort by date (newest first), then by creation time (most recent first)
    const sortedExpenses = [...filteredExpenses].sort((a, b) => {
        const dateA = `${a.fields.Year}-${String(a.fields.Month).padStart(2, '0')}-${String(a.fields.Day || 1).padStart(2, '0')}`;
        const dateB = `${b.fields.Year}-${String(b.fields.Month).padStart(2, '0')}-${String(b.fields.Day || 1).padStart(2, '0')}`;
        const dateCompare = dateB.localeCompare(dateA);

        // If dates are the same, sort by creation time (most recent first)
        if (dateCompare === 0) {
            const createdA = new Date(a.createdTime || 0);
            const createdB = new Date(b.createdTime || 0);
            return createdB - createdA;
        }

        return dateCompare;
    });

    // Pagination logic
    const totalExpenses = sortedExpenses.length;
    const totalPages = Math.ceil(totalExpenses / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedExpenses = sortedExpenses.slice(startIndex, endIndex);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    container.innerHTML = paginatedExpenses.map(expense => {
        const fields = expense.fields;
        const budget = fields.Budget || 0;
        const actual = fields.Actual || 0;
        const monthDisplay = fields.Month ? monthNames[parseInt(fields.Month) - 1] : 'N/A';
        const day = fields.Day || 1;
        const dateDisplay = `${monthDisplay} ${day}, ${fields.Year || 'N/A'}`;
        const hasNotes = fields.Notes && fields.Notes.trim();
        const notesEscaped = hasNotes ? fields.Notes.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
        const tags = fields.Tags || '';

        // Determine actual amount color based on budget comparison
        let actualColorClass = 'text-gray-700'; // Default black/gray for equal
        if (actual > budget) {
            actualColorClass = 'text-red-600'; // Red if over budget
        } else if (actual < budget) {
            actualColorClass = 'text-green-600'; // Green if under budget
        }

        // Tags display (always render div for grid structure)
        let tagsContent = '';
        if (tags.trim()) {
            tagsContent = tags.split(',').map(tag =>
                `<span class="inline-block px-2 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-full text-xs font-medium mr-1 mb-1"><i class="fas fa-tag mr-1"></i>${tag.trim()}</span>`
            ).join('');
        }

        return `
                    <div class="expense-row cursor-pointer hover:bg-gray-50" onclick="viewExpenseDetails('${expense.id}')" style="cursor: pointer;">
                        <div class="expense-item"><span class="expense-label">Item:</span><span class="font-semibold text-gray-800">${fields.Item || 'Unnamed'}${hasNotes ? ` <i class="fas fa-info-circle text-blue-500 cursor-pointer" title="${notesEscaped}"></i>` : ''}</span></div>
                        <div class="expense-item"><span class="expense-label">Category:</span><span class="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">${fields.Category || 'N/A'}</span></div>
                        <div class="expense-item"><span class="expense-label">Date:</span><span class="text-gray-600">${dateDisplay}</span></div>
                        <div class="expense-item"><span class="expense-label">Amount:</span><span class="font-bold text-lg ${actualColorClass}">$${actual.toFixed(2)}</span></div>
                        <div class="expense-item"><span class="expense-label">Tags:</span><div class="flex flex-wrap">${tagsContent || '<span class="text-gray-400 text-xs">—</span>'}</div></div>
                        <div class="expense-item"><span class="expense-label">LLC:</span><span class="badge ${fields.LLC === 'Yes' ? 'badge-llc' : 'badge-personal'}">${fields.LLC || 'No'}</span></div>
                        <div class="expense-item"><span class="expense-label">Receipt:</span>${fields.has_receipt ? `<button onclick="event.stopPropagation(); viewReceiptFromExpense('${expense.id}');" class="text-purple-600 hover:text-purple-800" title="View Receipt" style="background: none; border: none; cursor: pointer; padding: 0;"><i class="fas fa-receipt text-xl"></i></button>` : '<span class="text-gray-300"><i class="fas fa-receipt text-xl"></i></span>'}</div>
                        <div class="expense-item"><span class="expense-label">Actions:</span><div class="flex gap-3">
                            <button onclick="event.stopPropagation(); editExpense('${expense.id}')" class="text-blue-500 hover:text-blue-700 text-lg" title="Edit"><i class="fas fa-edit"></i></button>
                            <button onclick="event.stopPropagation(); deleteExpense('${expense.id}')" class="text-red-500 hover:text-red-700 text-lg" title="Delete"><i class="fas fa-trash"></i></button>
                        </div></div>
                    </div>
                 `;
    }).join('');

    // Update pagination controls
    updatePaginationControls(totalExpenses, totalPages);
}

function updatePaginationControls(totalExpenses, totalPages) {
    const paginationControls = document.getElementById('paginationControls');
    const paginationInfo = document.getElementById('paginationInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (totalExpenses <= itemsPerPage) {
        paginationControls.style.display = 'none';
        return;
    }

    paginationControls.style.display = 'flex';

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalExpenses);
    paginationInfo.textContent = `${startItem}-${endItem} of ${totalExpenses} expenses`;

    // Update button states
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

function changePage(direction) {
    const filteredExpenses = getFilteredExpenses();
    const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);

    if (direction === 'prev' && currentPage > 1) {
        currentPage--;
    } else if (direction === 'next' && currentPage < totalPages) {
        currentPage++;
    }

    renderExpenses();
    // Scroll to top of expenses list
    document.getElementById('expensesList').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function viewExpenseDetails(expenseId) {
    console.log('🔍 viewExpenseDetails CALLED with ID:', expenseId);
    
    const expense = allExpenses.find(exp => exp.id === expenseId);
    if (!expense) {
        console.error('❌ Expense not found for ID:', expenseId);
        return;
    }
    
    console.log('✅ Expense found:', expense.fields.Item);

    // Show loading spinner briefly
    document.getElementById('expenseDetailContent').innerHTML = `
                <div class="text-center py-12">
                    <div class="loading mx-auto mb-4"></div>
                    <p class="text-gray-500">Loading details...</p>
                </div>
            `;
    document.getElementById('expenseDetailModal').classList.add('active');
    console.log('✅ Modal opened');

    // Use setTimeout to allow modal animation to start
    setTimeout(() => {
        currentExpenseIdForDetail = expenseId;
        const fields = expense.fields;
        const itemName = fields.Item || 'Unnamed';
        
        // Create tabbed interface - use unique IDs to avoid conflict with main page tabs
        const tabHTML = `
            <div class="expense-detail-tabs" style="border-bottom: 2px solid #e5e7eb; margin-bottom: 24px;">
                <button class="tab-button active" onclick="switchExpenseTab('details', '${expenseId}')">
                    <i class="fas fa-info-circle mr-2"></i>Details
                </button>
                <button class="tab-button" onclick="switchExpenseTab('trend', '${expenseId}')">
                    <i class="fas fa-chart-line mr-2"></i>Trend
                </button>
                <button class="tab-button" onclick="switchExpenseTab('analytics', '${expenseId}')">
                    <i class="fas fa-chart-bar mr-2"></i>Analytics
                </button>
            </div>
            <div id="expenseDetailDetailsTab" class="tab-content"></div>
            <div id="expenseDetailTrendTab" class="tab-content" style="display: none;"></div>
            <div id="expenseDetailAnalyticsTab" class="tab-content" style="display: none;"></div>
        `;
        
        document.getElementById('expenseDetailContent').innerHTML = tabHTML;
        
        // Load details tab content
        loadExpenseDetailsTab(expenseId);
    }, 50); // Small delay for visual feedback
}

function switchExpenseTab(tabName, expenseId) {
    console.log('🔄 switchExpenseTab CALLED - Tab:', tabName, 'ID:', expenseId);
    
    // Update tab buttons
    const buttons = document.querySelectorAll('#expenseDetailModal .tab-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.closest('.tab-button').classList.add('active');
    
    // Get tab elements - use unique IDs to avoid conflict with main page tabs
    const detailsTab = document.getElementById('expenseDetailDetailsTab');
    const trendTab = document.getElementById('expenseDetailTrendTab');
    const analyticsTab = document.getElementById('expenseDetailAnalyticsTab');
    
    // Hide all tabs - use setAttribute to force style change
    detailsTab.style.display = 'none';
    detailsTab.setAttribute('style', 'display: none;');
    trendTab.style.display = 'none';
    trendTab.setAttribute('style', 'display: none;');
    analyticsTab.style.display = 'none';
    analyticsTab.setAttribute('style', 'display: none;');
    
    // Reset modal scroll to top when switching tabs
    const modalContent = document.querySelector('#expenseDetailModal .modal-content');
    if (modalContent) {
        modalContent.scrollTop = 0;
    }
    
    // Show selected tab
    if (tabName === 'details') {
        console.log('📄 Loading Details tab');
        detailsTab.style.display = 'block';
        detailsTab.setAttribute('style', 'display: block;');
        console.log('Details tab display:', detailsTab.style.display);
        if (!detailsTab.innerHTML.trim()) {
            loadExpenseDetailsTab(expenseId);
        } else {
            console.log('ℹ️ Details tab already loaded');
        }
    } else if (tabName === 'trend') {
        console.log('📈 Loading Trend tab');
        trendTab.style.display = 'block';
        trendTab.setAttribute('style', 'display: block;');
        console.log('Trend tab display:', trendTab.style.display);
        if (!trendTab.innerHTML.trim()) {
            loadExpenseTrendTab(expenseId);
        } else {
            console.log('ℹ️ Trend tab already loaded');
        }
    } else if (tabName === 'analytics') {
        console.log('📊 Loading Analytics tab');
        analyticsTab.style.display = 'block';
        analyticsTab.setAttribute('style', 'display: block;');
        console.log('Analytics tab display BEFORE content:', analyticsTab.style.display);
        
        // Always reload analytics to get fresh data
        loadExpenseAnalyticsTab(expenseId);
        
        // Verify after content loads
        setTimeout(() => {
            console.log('Analytics tab display AFTER content:', analyticsTab.style.display);
            console.log('Analytics tab computed style:', window.getComputedStyle(analyticsTab).display);
            console.log('Analytics tab visible?', analyticsTab.offsetHeight > 0);
        }, 100);
    }
}

function loadExpenseDetailsTab(expenseId) {
    const expense = allExpenses.find(exp => exp.id === expenseId);
    if (!expense) return;
    
        const fields = expense.fields;
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        const actual = fields.Actual || 0;
        const monthDisplay = fields.Month ? monthNames[parseInt(fields.Month) - 1] : 'N/A';
        const day = fields.Day || 1;
        const dateDisplay = `${monthDisplay} ${day}, ${fields.Year || 'N/A'}`;

        let detailHTML = `
                 <div class="bg-purple-50 border-l-4 border-purple-500 p-4 mb-4">
                     <h3 class="text-xl font-bold text-gray-800 mb-2">${fields.Item || 'Unnamed'}</h3>
                     <p class="text-sm text-gray-600"><i class="fas fa-calendar mr-2"></i>${dateDisplay}</p>
                 </div>
                 
                 <div class="grid grid-cols-2 gap-4 mb-4">
                     <div class="bg-gray-50 p-4 rounded">
                         <p class="text-xs text-gray-500 mb-1">Category</p>
                         <p class="font-semibold text-gray-800"><span class="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">${fields.Category || 'N/A'}</span></p>
                     </div>
                     <div class="bg-gray-50 p-4 rounded">
                         <p class="text-xs text-gray-500 mb-1">LLC Account</p>
                         <p class="font-semibold"><span class="badge ${fields.LLC === 'Yes' ? 'badge-llc' : 'badge-personal'}">${fields.LLC || 'No'}</span></p>
                     </div>
                 </div>
                 
                 <div class="bg-purple-50 p-4 rounded mb-4">
                     <p class="text-xs text-gray-500 mb-1">Amount</p>
                     <p class="text-3xl font-bold text-purple-600">$${actual.toFixed(2)}</p>
                 </div>
             `;

        // Show contributor details - only show those who contributed
        let amarContrib = fields.AmarContribution || 0;
        let priyaContrib = fields.PriyaContribution || 0;
        let adjustmentNote = '';

        // For mortgage expenses, calculate adjusted contributions based on Priya's mortgage payments
        if (fields.Category === 'Mortgage' && amarContrib > 0) {
            // Get Priya's mortgage contributions for the same month/year
            const expenseYear = String(fields.Year);
            const expenseMonth = fields.Month;

            const priyaMortgagePayments = allPayments
                .filter(p =>
                    p.fields.Person === 'Priya' &&
                    p.fields.PaymentType === 'PriyaMortgageContribution' &&
                    String(p.fields.Year) === expenseYear &&
                    p.fields.Month === expenseMonth
                )
                .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

            if (priyaMortgagePayments > 0) {
                // Distribute Priya's mortgage payment proportionally across all mortgage expenses
                const totalMortgageExpenses = allExpenses
                    .filter(exp =>
                        exp.fields.Category === 'Mortgage' &&
                        String(exp.fields.Year) === expenseYear &&
                        exp.fields.Month === expenseMonth
                    )
                    .reduce((sum, exp) => sum + (exp.fields.AmarContribution || 0), 0);

                // Calculate this expense's share of the adjustment
                const adjustmentRatio = totalMortgageExpenses > 0 ? amarContrib / totalMortgageExpenses : 0;
                const thisExpenseAdjustment = priyaMortgagePayments * adjustmentRatio;

                amarContrib = Math.max(0, amarContrib - thisExpenseAdjustment);
                priyaContrib = priyaContrib + thisExpenseAdjustment;
                adjustmentNote = `<p class="text-xs text-blue-600 mt-1"><i class="fas fa-info-circle mr-1"></i>Adjusted for Priya's mortgage contribution</p>`;
            }
        }

        const hasAmarContrib = amarContrib > 0;
        const hasPriyaContrib = priyaContrib > 0;

        if (hasAmarContrib || hasPriyaContrib) {
            const gridCols = (hasAmarContrib && hasPriyaContrib) ? 'grid-cols-2' : 'grid-cols-1';
            detailHTML += `<div class="grid ${gridCols} gap-4 mb-4">`;

            if (hasAmarContrib) {
                detailHTML += `
                        <div class="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
                            <p class="text-xs text-gray-500 mb-1"><i class="fas fa-user mr-1"></i>Amar's Contribution</p>
                            <p class="text-2xl font-bold text-blue-600">$${amarContrib.toFixed(2)}</p>
                            ${adjustmentNote}
                        </div>
                    `;
            }

            if (hasPriyaContrib) {
                detailHTML += `
                        <div class="bg-pink-50 p-4 rounded border-l-4 border-pink-500">
                            <p class="text-xs text-gray-500 mb-1"><i class="fas fa-user mr-1"></i>Priya's Contribution</p>
                            <p class="text-2xl font-bold text-pink-600">$${priyaContrib.toFixed(2)}</p>
                            ${adjustmentNote}
                        </div>
                    `;
            }

            detailHTML += `</div>`;
        }

        if (fields.Tags && fields.Tags.trim()) {
            const tagsArray = fields.Tags.split(',').map(t => t.trim()).filter(t => t);
            if (tagsArray.length > 0) {
                detailHTML += `
                        <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                            <p class="text-xs text-gray-500 mb-2"><i class="fas fa-tags mr-1"></i>Tags</p>
                            <div class="flex flex-wrap gap-2">
                                ${tagsArray.map(tag => `
                                    <span class="inline-block px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-full text-xs font-medium">
                                        <i class="fas fa-tag mr-1"></i>${tag}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    `;
            }
        }

        if (fields.Notes && fields.Notes.trim()) {
            detailHTML += `
                     <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                         <p class="text-xs text-gray-500 mb-1"><i class="fas fa-sticky-note mr-1"></i>Notes</p>
                         <p class="text-gray-700">${fields.Notes}</p>
                     </div>
                 `;
        }

        if (fields.has_receipt) {
            detailHTML += `
                     <div class="bg-gray-50 p-4 rounded mb-4">
                         <p class="text-xs text-gray-500 mb-2"><i class="fas fa-receipt mr-1"></i>Receipt</p>
                         <button onclick="viewReceiptFromExpense('${currentExpenseIdForDetail}');" class="btn-primary">
                             <i class="fas fa-image mr-2"></i>View Receipt
                         </button>
                     </div>
                 `;
        }

    document.getElementById('expenseDetailDetailsTab').innerHTML = detailHTML;
}

function loadExpenseTrendTab(expenseId) {
    const expense = allExpenses.find(exp => exp.id === expenseId);
    if (!expense) return;
    
    const itemName = expense.fields.Item || 'Unnamed';
    
    // Get all expenses with the same item name
    const sameItemExpenses = allExpenses.filter(exp => 
        (exp.fields.Item || 'Unnamed').toLowerCase() === itemName.toLowerCase()
    );
    
    if (sameItemExpenses.length === 0) {
        document.getElementById('expenseDetailTrendTab').innerHTML = `
            <div class="text-center py-12 text-gray-400">
                <i class="fas fa-chart-line text-4xl mb-3"></i>
                <p>No trend data available for this expense</p>
            </div>
        `;
        return;
    }
    
    // Group by month/year and sum amounts
    const monthlyData = {};
    sameItemExpenses.forEach(exp => {
        const monthKey = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                total: 0,
                count: 0,
                year: exp.fields.Year,
                month: exp.fields.Month
            };
        }
        monthlyData[monthKey].total += (exp.fields.Actual || 0);
        monthlyData[monthKey].count += 1;
    });
    
    // Sort by date
    const sortedMonths = Object.keys(monthlyData).sort();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Calculate stats
    const amounts = sortedMonths.map(key => monthlyData[key].total);
    const avgAmount = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts);
    const totalSpent = amounts.reduce((sum, val) => sum + val, 0);
    
    let trendHTML = `
        <div class="mb-6">
            <h3 class="text-xl font-bold text-gray-800 mb-2">
                <i class="fas fa-chart-line mr-2 text-purple-600"></i>Trend for "${itemName}"
            </h3>
            <p class="text-sm text-gray-600">Showing combined expenses over ${sortedMonths.length} month(s)</p>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <p class="text-xs text-blue-600 font-semibold mb-1">AVERAGE</p>
                <p class="text-2xl font-bold text-blue-700">$${avgAmount.toFixed(2)}</p>
            </div>
            <div class="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <p class="text-xs text-green-600 font-semibold mb-1">TOTAL</p>
                <p class="text-2xl font-bold text-green-700">$${totalSpent.toFixed(2)}</p>
            </div>
            <div class="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
                <p class="text-xs text-red-600 font-semibold mb-1">HIGHEST</p>
                <p class="text-2xl font-bold text-red-700">$${maxAmount.toFixed(2)}</p>
            </div>
            <div class="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <p class="text-xs text-purple-600 font-semibold mb-1">LOWEST</p>
                <p class="text-2xl font-bold text-purple-700">$${minAmount.toFixed(2)}</p>
            </div>
        </div>
        
        <div class="bg-white rounded-lg border border-gray-200 p-4">
            <canvas id="expenseTrendChart" style="max-height: 300px;"></canvas>
        </div>
        
        <div class="mt-6">
            <h4 class="text-md font-bold text-gray-800 mb-3">Monthly Breakdown</h4>
            <p class="text-xs text-gray-500 mb-3"><i class="fas fa-mouse-pointer mr-1"></i>Click on any month to view expenses</p>
            <div class="space-y-2">
                ${sortedMonths.map(key => {
                    const data = monthlyData[key];
                    const monthLabel = `${monthNames[parseInt(data.month) - 1]} ${data.year}`;
                    const percentage = ((data.total / maxAmount) * 100).toFixed(0);
                    // Escape itemName for use in onclick
                    const escapedItemName = itemName.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    return `
                        <div class="bg-gray-50 p-3 rounded cursor-pointer hover:bg-purple-50 hover:border-purple-200 border border-transparent transition-all"
                             onclick="showMonthlyExpensesModal('${escapedItemName}', '${data.year}', '${data.month}')"
                             title="Click to view ${data.count} expense(s)">
                            <div class="flex justify-between items-center mb-2">
                                <span class="font-semibold text-gray-700">${monthLabel}</span>
                                <span class="text-purple-600 font-bold">$${data.total.toFixed(2)}</span>
                            </div>
                            <div class="flex items-center gap-2 text-xs text-gray-500">
                                <span class="inline-flex items-center gap-1 text-purple-600 font-medium">
                                    <i class="fas fa-eye text-xs"></i>
                                    ${data.count} expense${data.count > 1 ? 's' : ''}
                                </span>
                                <span>•</span>
                                <span>Avg: $${(data.total / data.count).toFixed(2)}</span>
                            </div>
                            <div class="progress-bar mt-2">
                                <div class="progress-fill" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('expenseDetailTrendTab').innerHTML = trendHTML;
    
    // Create chart
    setTimeout(() => {
        const ctx = document.getElementById('expenseTrendChart');
        if (ctx && typeof Chart !== 'undefined') {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sortedMonths.map(key => {
                        const data = monthlyData[key];
                        return `${monthNames[parseInt(data.month) - 1]} ${data.year}`;
                    }),
                    datasets: [{
                        label: 'Amount Spent',
                        data: amounts,
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointBackgroundColor: '#667eea',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14 },
                            bodyFont: { size: 13 },
                            callbacks: {
                                label: function(context) {
                                    return `Amount: $${context.parsed.y.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toFixed(0);
                                }
                            }
                        }
                    }
                }
            });
        }
    }, 100);
}

// AI-powered shopping tips cache to avoid repeated searches
const aiTipsCache = new Map();
const AI_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Fetch AI shopping tips via web search
async function fetchAIShoppingTips(category, itemName) {
    const cacheKey = `${category.toLowerCase()}-${itemName.toLowerCase()}`;
    
    // Check cache first
    const cached = aiTipsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < AI_CACHE_DURATION) {
        console.log('🎯 Using cached AI tips for:', category);
        return cached.data;
    }
    
    console.log('🔍 Fetching AI tips for category:', category, 'item:', itemName);
    
    // Build search queries based on category
    const searchQueries = {
        'Gas': `best day to buy gas cheapest prices ${new Date().getFullYear()}`,
        'Groceries': `best day to buy groceries cheapest prices sales ${new Date().getFullYear()}`,
        'Food': `best day to buy groceries restaurant deals ${new Date().getFullYear()}`,
        'Shopping': `best day for shopping sales discounts ${new Date().getFullYear()}`,
        'Amazon': `best day to buy on amazon prime deals ${new Date().getFullYear()}`,
        'Utilities': `how to save money on utility bills tips ${new Date().getFullYear()}`,
        'Insurance': `best time to renew insurance save money ${new Date().getFullYear()}`,
        'Entertainment': `best day for movie tickets entertainment deals ${new Date().getFullYear()}`,
        'Travel': `best day to book flights hotels cheapest ${new Date().getFullYear()}`,
        'Dining': `best day for restaurant deals dining discounts ${new Date().getFullYear()}`,
        'Healthcare': `save money on prescriptions medical bills tips ${new Date().getFullYear()}`,
        'Subscriptions': `audit subscriptions save money tips ${new Date().getFullYear()}`
    };
    
    const searchQuery = searchQueries[category] || `best time to save money on ${category.toLowerCase()} ${new Date().getFullYear()}`;
    
    try {
        // Use DuckDuckGo Instant Answer API (free, no API key required)
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1&skip_disambig=1`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📡 DuckDuckGo response:', data);
            
            // Parse the response and extract useful information
            let tips = parseSearchResults(data, category, itemName);
            
            // If DuckDuckGo didn't return useful results, use curated research data
            if (!tips) {
                tips = getCuratedTips(category, itemName);
            }
            
            // Cache the results
            aiTipsCache.set(cacheKey, { data: tips, timestamp: Date.now() });
            return tips;
        }
    } catch (error) {
        console.log('⚠️ Web search failed, using curated data:', error.message);
    }
    
    // Fallback to curated tips based on research
    const tips = getCuratedTips(category, itemName);
    aiTipsCache.set(cacheKey, { data: tips, timestamp: Date.now() });
    return tips;
}

// Parse search results from DuckDuckGo
function parseSearchResults(data, category, itemName) {
    // DuckDuckGo returns AbstractText for instant answers
    if (data.AbstractText || data.Answer) {
        const text = data.AbstractText || data.Answer;
        return {
            icon: getCategoryIcon(category),
            title: `Smart Tips for ${category}`,
            mainTip: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            bestDay: extractBestDay(text, category),
            avoidDay: extractAvoidDay(text, category),
            proTip: data.AbstractURL ? `Source: ${data.AbstractSource || 'Web Research'}` : null,
            source: data.AbstractSource || 'AI Research',
            isLive: true
        };
    }
    
    // Check related topics for useful info
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        const topic = data.RelatedTopics[0];
        if (topic.Text) {
            return {
                icon: getCategoryIcon(category),
                title: `Smart Tips for ${category}`,
                mainTip: topic.Text.substring(0, 200),
                bestDay: extractBestDay(topic.Text, category),
                avoidDay: extractAvoidDay(topic.Text, category),
                proTip: null,
                source: 'Web Research',
                isLive: true
            };
        }
    }
    
    return null;
}

// Extract best day from text or use defaults
function extractBestDay(text, category) {
    const dayPatterns = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
    const matches = text.match(dayPatterns);
    
    if (matches && matches.length > 0) {
        return matches[0].charAt(0).toUpperCase() + matches[0].slice(1).toLowerCase();
    }
    
    // Default best days based on research
    const defaults = {
        'Gas': 'Monday or Tuesday',
        'Groceries': 'Wednesday',
        'Food': 'Tuesday or Wednesday',
        'Shopping': 'Tuesday',
        'Amazon': 'Tuesday or Friday',
        'Travel': 'Tuesday or Wednesday',
        'Dining': 'Tuesday',
        'Entertainment': 'Tuesday'
    };
    
    return defaults[category] || 'Midweek';
}

// Extract avoid day from text or use defaults
function extractAvoidDay(text, category) {
    // Default avoid days based on research
    const defaults = {
        'Gas': 'Thursday - Saturday',
        'Groceries': 'Saturday & Sunday',
        'Food': 'Friday & Weekend',
        'Shopping': 'Weekend',
        'Amazon': 'Monday',
        'Travel': 'Friday & Sunday',
        'Dining': 'Friday & Saturday',
        'Entertainment': 'Weekend'
    };
    
    return defaults[category] || 'Weekend';
}

// Get category icon
function getCategoryIcon(category) {
    const icons = {
        'Gas': 'fa-gas-pump',
        'Groceries': 'fa-shopping-cart',
        'Food': 'fa-utensils',
        'Shopping': 'fa-shopping-bag',
        'Amazon': 'fa-box',
        'Utilities': 'fa-bolt',
        'Insurance': 'fa-shield-alt',
        'Entertainment': 'fa-film',
        'Travel': 'fa-plane',
        'Dining': 'fa-utensils',
        'Healthcare': 'fa-heartbeat',
        'Subscriptions': 'fa-credit-card',
        'Mortgage': 'fa-home',
        'Rent': 'fa-home',
        'Car': 'fa-car'
    };
    
    return icons[category] || 'fa-lightbulb';
}

// Curated tips based on extensive research
function getCuratedTips(category, itemName) {
    const curatedData = {
        'Gas': {
            icon: 'fa-gas-pump',
            title: '⛽ Best Time to Buy Gas',
            mainTip: 'Gas prices typically follow a weekly pattern. Prices are generally lowest early in the week and rise toward the weekend as demand increases for travel.',
            bestDay: 'Monday or Tuesday',
            avoidDay: 'Thursday - Saturday',
            proTip: 'Use apps like GasBuddy to find the cheapest gas near you. Prices can vary by $0.20-0.50 between stations!',
            source: 'Consumer Research 2024',
            isLive: false
        },
        'Groceries': {
            icon: 'fa-shopping-cart',
            title: '🛒 Best Day for Grocery Shopping',
            mainTip: 'Most grocery stores release new weekly sales on Wednesday. Shopping midweek means fresher stock, better deals, and fewer crowds.',
            bestDay: 'Wednesday',
            avoidDay: 'Saturday & Sunday',
            proTip: 'Shop in the morning for best produce selection. Many stores mark down meat and bakery items in the evening.',
            source: 'Retail Industry Analysis 2024',
            isLive: false
        },
        'Food': {
            icon: 'fa-utensils',
            title: '🍽️ Save on Food & Dining',
            mainTip: 'Tuesday is often the cheapest day for dining out, with many restaurants offering specials. For groceries, Wednesday brings new weekly sales.',
            bestDay: 'Tuesday or Wednesday',
            avoidDay: 'Friday & Weekend',
            proTip: 'Check restaurant apps for exclusive deals. Many chains offer 20-30% off through their apps!',
            source: 'Restaurant Industry Data 2024',
            isLive: false
        },
        'Shopping': {
            icon: 'fa-shopping-bag',
            title: '🛍️ Best Day for Shopping',
            mainTip: 'Retailers often release new sales on Tuesday. Midweek shopping avoids weekend crowds and many stores offer exclusive weekday deals.',
            bestDay: 'Tuesday',
            avoidDay: 'Weekend',
            proTip: 'Use browser extensions like Honey or Rakuten to automatically find coupon codes and cash back.',
            source: 'Retail Analysis 2024',
            isLive: false
        },
        'Amazon': {
            icon: 'fa-box',
            title: '📦 Best Time to Buy on Amazon',
            mainTip: 'Amazon changes prices frequently throughout the day. Prices are often lowest on Tuesday and Friday, avoiding the Monday post-weekend price hikes.',
            bestDay: 'Tuesday or Friday',
            avoidDay: 'Monday',
            proTip: 'Use CamelCamelCamel to track price history and set alerts for price drops on items you want.',
            source: 'E-commerce Research 2024',
            isLive: false
        },
        'Travel': {
            icon: 'fa-plane',
            title: '✈️ Best Time to Book Travel',
            mainTip: 'Airlines typically release sales on Tuesday afternoon. Book domestic flights 1-3 months ahead, international 2-8 months ahead for best prices.',
            bestDay: 'Tuesday or Wednesday',
            avoidDay: 'Friday & Sunday',
            proTip: 'Use incognito mode when searching flights. Clear cookies or prices may increase based on your search history.',
            source: 'Travel Industry Data 2024',
            isLive: false
        },
        'Utilities': {
            icon: 'fa-bolt',
            title: '💡 Save on Utilities',
            mainTip: 'Utility bills can be reduced by using high-energy appliances during off-peak hours (usually nights and weekends) if your provider offers time-of-use rates.',
            bestDay: 'Off-peak hours',
            avoidDay: 'Peak hours (2-7 PM)',
            proTip: 'Smart thermostats can save 10-15% on heating/cooling. Unplug devices when not in use to eliminate phantom power drain.',
            source: 'Energy Efficiency Research 2024',
            isLive: false
        },
        'Entertainment': {
            icon: 'fa-film',
            title: '🎬 Save on Entertainment',
            mainTip: 'Tuesday is traditionally the cheapest day for movies (many theaters offer discounts). Streaming services often have trials and student discounts.',
            bestDay: 'Tuesday',
            avoidDay: 'Friday & Saturday',
            proTip: 'Check if your library offers free access to streaming services, audiobooks, and digital magazines.',
            source: 'Entertainment Industry 2024',
            isLive: false
        },
        'Insurance': {
            icon: 'fa-shield-alt',
            title: '🛡️ Save on Insurance',
            mainTip: 'Shop around 2-3 weeks before renewal. Bundling home and auto can save 15-25%. Review coverage annually to avoid overpaying.',
            bestDay: '2-3 weeks before renewal',
            avoidDay: 'Day of expiration',
            proTip: 'Ask about discounts: safe driver, good student, home security, multi-policy. Many people miss out on available discounts.',
            source: 'Insurance Industry Analysis 2024',
            isLive: false
        },
        'Healthcare': {
            icon: 'fa-heartbeat',
            title: '🏥 Save on Healthcare',
            mainTip: 'Use GoodRx or similar apps for prescription discounts. Many pharmacies offer $4 generic programs. Consider urgent care over ER for non-emergencies.',
            bestDay: 'Compare prices before filling',
            avoidDay: 'Dont wait for emergencies',
            proTip: 'Ask your doctor for generic alternatives. Generics are just as effective and can save 80-90% on medication costs.',
            source: 'Healthcare Consumer Guide 2024',
            isLive: false
        },
        'Dining': {
            icon: 'fa-utensils',
            title: '🍴 Best Day for Dining Out',
            mainTip: 'Tuesday and Wednesday typically have the best restaurant deals. Many restaurants offer happy hour specials and early bird discounts.',
            bestDay: 'Tuesday',
            avoidDay: 'Friday & Saturday',
            proTip: 'Sign up for restaurant loyalty programs and birthday clubs for free meals and exclusive discounts.',
            source: 'Restaurant Industry 2024',
            isLive: false
        },
        'Subscriptions': {
            icon: 'fa-credit-card',
            title: '📱 Manage Subscriptions',
            mainTip: 'Audit subscriptions quarterly. The average person wastes $200+/year on forgotten subscriptions. Cancel what you dont use regularly.',
            bestDay: 'Before renewal date',
            avoidDay: 'After auto-renewal',
            proTip: 'Try canceling subscriptions - many services will offer discounts to keep you. Also check for family/group plans.',
            source: 'Consumer Finance Research 2024',
            isLive: false
        }
    };
    
    // Check if we have specific tips for this category
    if (curatedData[category]) {
        return curatedData[category];
    }
    
    // Check item name for keywords
    const itemLower = itemName.toLowerCase();
    if (itemLower.includes('gas') || itemLower.includes('fuel')) return curatedData['Gas'];
    if (itemLower.includes('grocer') || itemLower.includes('walmart') || itemLower.includes('costco') || itemLower.includes('heb') || itemLower.includes('target')) return curatedData['Groceries'];
    if (itemLower.includes('amazon')) return curatedData['Amazon'];
    if (itemLower.includes('flight') || itemLower.includes('hotel') || itemLower.includes('airbnb')) return curatedData['Travel'];
    if (itemLower.includes('netflix') || itemLower.includes('spotify') || itemLower.includes('disney')) return curatedData['Subscriptions'];
    if (itemLower.includes('electric') || itemLower.includes('water') || itemLower.includes('internet')) return curatedData['Utilities'];
    
    // Generic tips for unknown categories
    return {
        icon: 'fa-lightbulb',
        title: `💡 Smart Spending Tips for ${category}`,
        mainTip: 'Track your spending patterns over time to identify opportunities for savings. Compare prices across vendors and look for seasonal deals.',
        bestDay: 'Midweek (Tue-Wed)',
        avoidDay: 'Weekend',
        proTip: 'Set price alerts and wait for sales on non-urgent purchases. Many items go on sale cyclically.',
        source: 'General Consumer Research',
        isLive: false
    };
}

function loadExpenseAnalyticsTab(expenseId) {
    console.log('🔍 Loading analytics for expense:', expenseId);
    
    const expense = allExpenses.find(exp => exp.id === expenseId);
    if (!expense) {
        console.error('❌ Expense not found:', expenseId);
        return;
    }
    
    const itemName = expense.fields.Item || 'Unnamed';
    const category = expense.fields.Category || 'Uncategorized';
    
    console.log('📊 Analytics for:', itemName, 'Category:', category);
    
    // Get all expenses with the same item name
    const sameItemExpenses = allExpenses.filter(exp => 
        (exp.fields.Item || 'Unnamed').toLowerCase() === itemName.toLowerCase()
    );
    
    console.log('📈 Found', sameItemExpenses.length, 'matching expenses');
    
    if (sameItemExpenses.length === 0) {
        document.getElementById('expenseDetailAnalyticsTab').innerHTML = `
            <div class="text-center py-12 text-gray-400">
                <i class="fas fa-chart-bar text-4xl mb-3"></i>
                <p>No analytics data available for this expense</p>
            </div>
        `;
        return;
    }
    
    // Calculate analytics
    const amounts = sameItemExpenses.map(exp => exp.fields.Actual || 0);
    const totalSpent = amounts.reduce((sum, val) => sum + val, 0);
    const avgAmount = totalSpent / amounts.length;
    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts);
    
    console.log('💰 Total:', totalSpent, 'Avg:', avgAmount, 'Max:', maxAmount, 'Min:', minAmount);
    
    // Calculate trend (comparing last 3 months vs previous 3 months if applicable)
    const sortedExpenses = [...sameItemExpenses].sort((a, b) => {
        const dateA = new Date(a.fields.Year, a.fields.Month - 1);
        const dateB = new Date(b.fields.Year, b.fields.Month - 1);
        return dateB - dateA;
    });
    
    // Frequency analysis
    const monthlyFrequency = {};
    sameItemExpenses.forEach(exp => {
        const monthKey = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        monthlyFrequency[monthKey] = (monthlyFrequency[monthKey] || 0) + 1;
    });
    const avgFrequency = Object.values(monthlyFrequency).reduce((sum, val) => sum + val, 0) / Object.keys(monthlyFrequency).length;
    
    // Category spending analysis
    const categoryExpenses = allExpenses.filter(exp => exp.fields.Category === category);
    const categoryTotal = categoryExpenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const percentageOfCategory = categoryTotal > 0 ? (totalSpent / categoryTotal) * 100 : 0;
    
    // LLC analysis
    const llcExpenses = sameItemExpenses.filter(exp => exp.fields.LLC === 'Yes');
    const llcTotal = llcExpenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const llcPercentage = totalSpent > 0 ? (llcTotal / totalSpent) * 100 : 0;
    
    // Volatility (standard deviation)
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - avgAmount, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    const volatility = avgAmount > 0 ? (stdDev / avgAmount) * 100 : 0;
    
    // Generate insights
    const insights = [];
    
    if (volatility > 30) {
        insights.push({
            type: 'warning',
            icon: 'exclamation-triangle',
            text: `High spending variability (${volatility.toFixed(0)}% volatility). Amounts vary significantly month-to-month.`
        });
    } else if (volatility < 15) {
        insights.push({
            type: 'success',
            icon: 'check-circle',
            text: `Consistent spending pattern (${volatility.toFixed(0)}% volatility). Amounts are relatively stable.`
        });
    }
    
    if (avgFrequency > 3) {
        insights.push({
            type: 'info',
            icon: 'info-circle',
            text: `Frequent expense: Averages ${avgFrequency.toFixed(1)} occurrences per month. Consider budgeting this as a recurring expense.`
        });
    }
    
    if (llcPercentage > 50) {
        insights.push({
            type: 'success',
            icon: 'building',
            text: `${llcPercentage.toFixed(0)}% of this expense is LLC-related. Good for tax deductions.`
        });
    }
    
    if (percentageOfCategory > 30) {
        insights.push({
            type: 'warning',
            icon: 'chart-pie',
            text: `This expense represents ${percentageOfCategory.toFixed(1)}% of your total "${category}" spending.`
        });
    }
    
    // Recent trend analysis
    if (sortedExpenses.length >= 3) {
        const recentThree = sortedExpenses.slice(0, 3);
        const recentAvg = recentThree.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0) / 3;
        const trendDiff = ((recentAvg - avgAmount) / avgAmount) * 100;
        
        if (Math.abs(trendDiff) > 15) {
            const trendWord = trendDiff > 0 ? 'increasing' : 'decreasing';
            const trendIcon = trendDiff > 0 ? 'arrow-up' : 'arrow-down';
            const trendColor = trendDiff > 0 ? 'warning' : 'success';
            insights.push({
                type: trendColor,
                icon: trendIcon,
                text: `Recent trend ${trendWord}: Last 3 months average $${recentAvg.toFixed(2)} vs overall average $${avgAmount.toFixed(2)} (${Math.abs(trendDiff).toFixed(0)}% ${trendWord})`
            });
        }
    }
    
    if (insights.length === 0) {
        insights.push({
            type: 'info',
            icon: 'info-circle',
            text: 'No significant patterns detected. Your spending on this item appears normal.'
        });
    }
    
    // AI tips will be loaded asynchronously
    const aiTipsPlaceholderId = `aiTips_${Date.now()}`;
    
    const analyticsHTML = `
        <div class="mb-6">
            <h3 class="text-xl font-bold text-gray-800 mb-2">
                <i class="fas fa-chart-bar mr-2 text-purple-600"></i>Analytics for "${itemName}"
            </h3>
            <p class="text-sm text-gray-600">Insights based on ${sameItemExpenses.length} expense(s)</p>
        </div>
        
        <div class="space-y-4 mb-6">
            <div class="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-6 rounded-lg shadow-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm opacity-90 mb-1">Total Spent on "${itemName}"</p>
                        <p class="text-4xl font-bold">$${totalSpent.toFixed(2)}</p>
                    </div>
                    <div class="text-5xl opacity-30">
                        <i class="fas fa-dollar-sign"></i>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-white border-2 border-blue-200 p-4 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                    <i class="fas fa-chart-line text-blue-600"></i>
                    <p class="text-xs text-blue-600 font-semibold">AVERAGE</p>
                </div>
                <p class="text-xl font-bold text-gray-800">$${avgAmount.toFixed(2)}</p>
                <p class="text-xs text-gray-500 mt-1">per occurrence</p>
            </div>
            
            <div class="bg-white border-2 border-green-200 p-4 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                    <i class="fas fa-calendar-check text-green-600"></i>
                    <p class="text-xs text-green-600 font-semibold">FREQUENCY</p>
                </div>
                <p class="text-xl font-bold text-gray-800">${avgFrequency.toFixed(1)}x</p>
                <p class="text-xs text-gray-500 mt-1">per month (avg)</p>
            </div>
            
            <div class="bg-white border-2 border-orange-200 p-4 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                    <i class="fas fa-chart-area text-orange-600"></i>
                    <p class="text-xs text-orange-600 font-semibold">VOLATILITY</p>
                </div>
                <p class="text-xl font-bold text-gray-800">${volatility.toFixed(0)}%</p>
                <p class="text-xs text-gray-500 mt-1">±$${stdDev.toFixed(2)}</p>
            </div>
            
            <div class="bg-white border-2 border-purple-200 p-4 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                    <i class="fas fa-percentage text-purple-600"></i>
                    <p class="text-xs text-purple-600 font-semibold">CATEGORY %</p>
                </div>
                <p class="text-xl font-bold text-gray-800">${percentageOfCategory.toFixed(1)}%</p>
                <p class="text-xs text-gray-500 mt-1">of ${category}</p>
            </div>
        </div>
        
        ${llcPercentage > 0 ? `
        <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded mb-6">
            <div class="flex items-start gap-3">
                <i class="fas fa-building text-green-600 text-xl mt-1"></i>
                <div>
                    <p class="font-semibold text-green-800 mb-1">LLC Expense Analysis</p>
                    <p class="text-sm text-green-700">${llcPercentage.toFixed(0)}% ($${llcTotal.toFixed(2)}) of this expense is LLC-related</p>
                </div>
            </div>
        </div>
        ` : ''}
        
        <div class="mb-6" id="${aiTipsPlaceholderId}">
            <h4 class="text-md font-bold text-gray-800 mb-3 flex items-center gap-2">
                <i class="fas fa-robot text-purple-500"></i>
                <span>AI Smart Tips</span>
                <span class="text-xs font-normal text-gray-400 ml-auto" id="${aiTipsPlaceholderId}_status">
                    <i class="fas fa-spinner fa-spin mr-1"></i>Searching...
                </span>
            </h4>
            <div class="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5 shadow-sm">
                <div class="flex items-center justify-center py-6">
                    <div class="text-center">
                        <i class="fas fa-search text-purple-400 text-3xl mb-3 animate-pulse"></i>
                        <p class="text-sm text-purple-600">Fetching AI-powered tips for <strong>${category}</strong>...</p>
                        <p class="text-xs text-gray-400 mt-2">Analyzing best days to save money</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="mb-4">
            <h4 class="text-md font-bold text-gray-800 mb-3 flex items-center gap-2">
                <i class="fas fa-lightbulb text-yellow-500"></i>
                Key Insights
            </h4>
            <div class="space-y-3">
                ${insights.map(insight => {
                    const colorClasses = {
                        'success': 'bg-green-50 border-green-200 text-green-700',
                        'warning': 'bg-yellow-50 border-yellow-200 text-yellow-700',
                        'info': 'bg-blue-50 border-blue-200 text-blue-700',
                        'error': 'bg-red-50 border-red-200 text-red-700'
                    };
                    const iconColors = {
                        'success': 'text-green-600',
                        'warning': 'text-yellow-600',
                        'info': 'text-blue-600',
                        'error': 'text-red-600'
                    };
                    return `
                        <div class="border-l-4 p-4 rounded ${colorClasses[insight.type]}">
                            <div class="flex items-start gap-3">
                                <i class="fas fa-${insight.icon} ${iconColors[insight.type]} text-lg mt-0.5"></i>
                                <p class="text-sm flex-1">${insight.text}</p>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 class="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <i class="fas fa-info-circle"></i>
                Spending Summary
            </h4>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div class="flex justify-between">
                    <span class="text-gray-600">Total Occurrences:</span>
                    <span class="font-semibold text-gray-800">${sameItemExpenses.length}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Time Period:</span>
                    <span class="font-semibold text-gray-800">${Object.keys(monthlyFrequency).length} month(s)</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Highest:</span>
                    <span class="font-semibold text-red-600">$${maxAmount.toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Lowest:</span>
                    <span class="font-semibold text-green-600">$${minAmount.toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;
    
    console.log('✅ Setting analytics HTML, length:', analyticsHTML.length);
    const analyticsTabElement = document.getElementById('expenseDetailAnalyticsTab');
    if (analyticsTabElement) {
        analyticsTabElement.innerHTML = analyticsHTML;
        console.log('✅ Analytics tab updated successfully');
        
        // Fetch AI tips asynchronously
        fetchAIShoppingTips(category, itemName).then(aiTips => {
            const aiTipsContainer = document.getElementById(aiTipsPlaceholderId);
            const statusElement = document.getElementById(`${aiTipsPlaceholderId}_status`);
            
            if (aiTipsContainer && aiTips) {
                console.log('🤖 AI tips loaded:', aiTips.title);
                
                // Update status
                if (statusElement) {
                    statusElement.innerHTML = aiTips.isLive 
                        ? `<i class="fas fa-check-circle text-green-500 mr-1"></i>Live Data`
                        : `<i class="fas fa-database text-blue-500 mr-1"></i>${aiTips.source}`;
                }
                
                // Render the AI tips
                aiTipsContainer.innerHTML = `
                    <h4 class="text-md font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <i class="fas fa-robot text-purple-500"></i>
                        <span>AI Smart Tips</span>
                        <span class="text-xs font-normal text-gray-400 ml-auto">
                            ${aiTips.isLive 
                                ? '<i class="fas fa-check-circle text-green-500 mr-1"></i>Live Data'
                                : `<i class="fas fa-database text-blue-500 mr-1"></i>${aiTips.source}`}
                        </span>
                    </h4>
                    <div class="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5 shadow-sm">
                        <div class="flex items-start gap-4">
                            <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                                <i class="fas ${aiTips.icon} text-white text-xl"></i>
                            </div>
                            <div class="flex-1">
                                <p class="font-bold text-purple-900 text-lg mb-2">${aiTips.title}</p>
                                <p class="text-sm text-purple-800 mb-3">${aiTips.mainTip}</p>
                                <div class="grid grid-cols-2 gap-3 mb-3">
                                    <div class="bg-white/70 rounded-lg p-3 border border-purple-100">
                                        <p class="text-xs text-purple-600 font-semibold mb-1"><i class="fas fa-calendar-check mr-1"></i>Best Day</p>
                                        <p class="text-sm font-bold text-gray-800">${aiTips.bestDay}</p>
                                    </div>
                                    <div class="bg-white/70 rounded-lg p-3 border border-purple-100">
                                        <p class="text-xs text-red-500 font-semibold mb-1"><i class="fas fa-calendar-times mr-1"></i>Avoid</p>
                                        <p class="text-sm font-bold text-gray-800">${aiTips.avoidDay}</p>
                                    </div>
                                </div>
                                ${aiTips.proTip ? `
                                <div class="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-lg">
                                    <p class="text-xs text-yellow-800"><i class="fas fa-star text-yellow-500 mr-1"></i><strong>Pro Tip:</strong> ${aiTips.proTip}</p>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
        }).catch(error => {
            console.error('❌ Failed to fetch AI tips:', error);
            const aiTipsContainer = document.getElementById(aiTipsPlaceholderId);
            if (aiTipsContainer) {
                aiTipsContainer.innerHTML = `
                    <h4 class="text-md font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <i class="fas fa-robot text-purple-500"></i>
                        <span>AI Smart Tips</span>
                        <span class="text-xs font-normal text-red-400 ml-auto">
                            <i class="fas fa-exclamation-circle mr-1"></i>Search unavailable
                        </span>
                    </h4>
                    <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
                        <i class="fas fa-cloud-slash text-gray-400 text-2xl mb-2"></i>
                        <p class="text-sm text-gray-500">Unable to fetch AI tips. Please try again later.</p>
                    </div>
                `;
            }
        });
    } else {
        console.error('❌ analyticsTab element not found!');
    }
}

function closeExpenseDetailModal() {
    document.getElementById('expenseDetailModal').classList.remove('active');
    currentExpenseIdForDetail = null;
}

// Show expenses for a specific item in a specific month
function showMonthlyExpensesModal(itemName, year, month) {
    console.log('📅 Showing expenses for:', itemName, 'in', month, year);
    
    // Find all matching expenses for this item in this month/year
    const matchingExpenses = allExpenses.filter(exp => {
        const expItem = (exp.fields.Item || 'Unnamed').toLowerCase();
        const expYear = String(exp.fields.Year);
        const expMonth = String(exp.fields.Month).padStart(2, '0');
        return expItem === itemName.toLowerCase() && 
               expYear === String(year) && 
               expMonth === String(month).padStart(2, '0');
    });
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;
    
    // Calculate totals
    const total = matchingExpenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    
    // Build the modal content
    let modalHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold text-gray-800">
                <i class="fas fa-calendar-alt mr-2 text-purple-600"></i>
                ${itemName} - ${monthLabel}
            </h3>
            <button onclick="closeMonthlyExpensesModal()" class="text-gray-400 hover:text-gray-600">
                <i class="fas fa-times text-xl"></i>
            </button>
        </div>
        
        <div class="bg-purple-50 border-l-4 border-purple-500 p-3 rounded mb-4">
            <div class="flex justify-between items-center">
                <span class="text-sm text-purple-700">
                    <strong>${matchingExpenses.length}</strong> expense${matchingExpenses.length !== 1 ? 's' : ''} found
                </span>
                <span class="text-lg font-bold text-purple-700">$${total.toFixed(2)}</span>
            </div>
        </div>
    `;
    
    if (matchingExpenses.length === 0) {
        modalHTML += `
            <div class="text-center py-8 text-gray-400">
                <i class="fas fa-inbox text-4xl mb-3"></i>
                <p>No expenses found</p>
            </div>
        `;
    } else {
        modalHTML += `<div class="space-y-3 max-h-96 overflow-y-auto">`;
        
        matchingExpenses.forEach((exp, index) => {
            const fields = exp.fields;
            const amount = fields.Actual || 0;
            const day = fields.Day || '?';
            const category = fields.Category || 'Uncategorized';
            const isLLC = fields.LLC === 'Yes';
            const amarContrib = fields.AmarContribution || 0;
            const priyaContrib = fields.PriyaContribution || 0;
            
            modalHTML += `
                <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                     onclick="closeMonthlyExpensesModal(); viewExpenseDetails('${exp.id}')">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <div class="font-semibold text-gray-800">${fields.Item || 'Unnamed'}</div>
                            <div class="text-xs text-gray-500">
                                <i class="fas fa-calendar mr-1"></i>${monthLabel.split(' ')[0]} ${day}, ${year}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-lg font-bold text-purple-600">$${amount.toFixed(2)}</div>
                            ${isLLC ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">LLC</span>' : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-2 text-xs">
                        <span class="bg-purple-100 text-purple-700 px-2 py-1 rounded">${category}</span>
                        ${amarContrib > 0 ? `<span class="text-blue-600"><i class="fas fa-user mr-1"></i>Amar: $${amarContrib.toFixed(2)}</span>` : ''}
                        ${priyaContrib > 0 ? `<span class="text-pink-600"><i class="fas fa-user mr-1"></i>Priya: $${priyaContrib.toFixed(2)}</span>` : ''}
                    </div>
                </div>
            `;
        });
        
        modalHTML += `</div>`;
    }
    
    modalHTML += `
        <div class="mt-4 pt-4 border-t">
            <button onclick="closeMonthlyExpensesModal()" class="btn-secondary w-full">
                <i class="fas fa-arrow-left mr-2"></i>Back to Trend
            </button>
        </div>
    `;
    
    // Create and show the modal
    let modal = document.getElementById('monthlyExpensesModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'monthlyExpensesModal';
        modal.className = 'modal';
        modal.innerHTML = `<div class="modal-content" style="max-width: 500px;"><div id="monthlyExpensesContent"></div></div>`;
        document.body.appendChild(modal);
    }
    
    document.getElementById('monthlyExpensesContent').innerHTML = modalHTML;
    modal.classList.add('active');
}

function closeMonthlyExpensesModal() {
    const modal = document.getElementById('monthlyExpensesModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// View receipt in a modal (prevents navigation issues with base64 data URLs on mobile)
function viewReceipt(receiptData) {
    try {
        // Parse receipt data if it's a string
        let receipt;
        if (typeof receiptData === 'string') {
            try {
                receipt = JSON.parse(receiptData);
            } catch (e) {
                // If it's already a URL string
                receipt = [{ url: receiptData }];
            }
        } else {
            receipt = receiptData;
        }

        // Get the receipt URL
        const receiptUrl = Array.isArray(receipt) && receipt[0]?.url ? receipt[0].url : receipt.url || receipt;

        if (!receiptUrl) {
            showNotification('No receipt available', 'error');
            return;
        }

        // Determine file extension from data URL
        let fileExt = 'png';
        if (receiptUrl.startsWith('data:')) {
            const mimeMatch = receiptUrl.match(/data:image\/([a-z]+);/);
            if (mimeMatch) fileExt = mimeMatch[1];
        }

        // Create modal dynamically with zoom functionality
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10002'; // Higher than other modals
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 100%; width: 95vw; max-height: 95vh; padding: 0; display: flex; flex-direction: column;">
                <div class="modal-header" style="position: sticky; top: 0; background: white; z-index: 1; border-bottom: 1px solid #e5e7eb; padding: 12px 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;">
                    <h2 class="modal-title" style="margin: 0; font-size: 18px;"><i class="fas fa-receipt mr-2"></i>Receipt</h2>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button id="zoomOutBtn" style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid #e5e7eb; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Zoom Out">
                            <i class="fas fa-search-minus text-gray-600"></i>
                        </button>
                        <span id="zoomLevel" style="font-size: 12px; color: #6b7280; min-width: 45px; text-align: center;">100%</span>
                        <button id="zoomInBtn" style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid #e5e7eb; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Zoom In">
                            <i class="fas fa-search-plus text-gray-600"></i>
                        </button>
                        <button id="zoomResetBtn" style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid #e5e7eb; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-left: 4px;" title="Reset Zoom">
                            <i class="fas fa-undo text-gray-600"></i>
                        </button>
                        <button class="close-modal" onclick="this.closest('.modal').remove()" style="width: 36px; height: 36px; border-radius: 8px; border: none; background: #fee2e2; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-left: 8px;">
                            <i class="fas fa-times text-red-600"></i>
                        </button>
                    </div>
                </div>
                <div id="receiptImageContainer" style="flex: 1; overflow: auto; padding: 16px; text-align: center; background: #f9fafb; touch-action: pan-x pan-y;">
                    <img id="receiptImage" src="${receiptUrl}" 
                         alt="Receipt" 
                         style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); background: white; transition: transform 0.2s ease; transform-origin: center center;"
                         onerror="this.parentElement.innerHTML='<p style=\\'color: #ef4444; padding: 20px;\\'>Error loading receipt image</p>'">
                </div>
                <div class="modal-footer" style="position: sticky; bottom: 0; background: white; border-top: 1px solid #e5e7eb; padding: 12px 16px; display: flex; gap: 12px; flex-shrink: 0;">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()" style="flex: 1;">
                        <i class="fas fa-times mr-2"></i>Close
                    </button>
                    <button class="btn-primary" onclick="downloadReceiptFromModal(this)" data-url="${receiptUrl.replace(/"/g, '&quot;')}" data-filename="receipt.${fileExt}" style="flex: 1;">
                        <i class="fas fa-download mr-2"></i>Download
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Zoom and pan functionality
        let currentZoom = 1;
        let panX = 0;
        let panY = 0;
        const minZoom = 0.5;
        const maxZoom = 5;
        const zoomStep = 0.25;
        
        const img = modal.querySelector('#receiptImage');
        const container = modal.querySelector('#receiptImageContainer');
        const zoomLevelEl = modal.querySelector('#zoomLevel');
        const zoomInBtn = modal.querySelector('#zoomInBtn');
        const zoomOutBtn = modal.querySelector('#zoomOutBtn');
        const zoomResetBtn = modal.querySelector('#zoomResetBtn');
        
        function updateTransform() {
            img.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
            zoomLevelEl.textContent = `${Math.round(currentZoom * 100)}%`;
            
            // Update button states
            zoomInBtn.style.opacity = currentZoom >= maxZoom ? '0.5' : '1';
            zoomOutBtn.style.opacity = currentZoom <= minZoom ? '0.5' : '1';
            
            // Update cursor based on zoom level
            img.style.cursor = currentZoom > 1 ? 'grab' : 'default';
        }
        
        function updateZoom(newZoom, resetPan = false) {
            currentZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
            if (resetPan || currentZoom <= 1) {
                panX = 0;
                panY = 0;
            }
            updateTransform();
        }
        
        zoomInBtn.addEventListener('click', () => updateZoom(currentZoom + zoomStep));
        zoomOutBtn.addEventListener('click', () => updateZoom(currentZoom - zoomStep));
        zoomResetBtn.addEventListener('click', () => updateZoom(1, true));
        
        // Mouse drag to pan (when zoomed in)
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let panStartX = 0;
        let panStartY = 0;
        
        img.addEventListener('mousedown', (e) => {
            if (currentZoom > 1) {
                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                panStartX = panX;
                panStartY = panY;
                img.style.cursor = 'grabbing';
                img.style.transition = 'none';
                e.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = (e.clientX - dragStartX) / currentZoom;
                const dy = (e.clientY - dragStartY) / currentZoom;
                panX = panStartX + dx;
                panY = panStartY + dy;
                updateTransform();
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                img.style.cursor = currentZoom > 1 ? 'grab' : 'default';
                img.style.transition = 'transform 0.2s ease';
            }
        });
        
        // Mouse wheel zoom
        container.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
                updateZoom(currentZoom + delta);
            }
        }, { passive: false });
        
        // Touch: pinch-to-zoom and single-finger pan
        let initialDistance = 0;
        let initialZoom = 1;
        let touchStartX = 0;
        let touchStartY = 0;
        let touchPanStartX = 0;
        let touchPanStartY = 0;
        let isTouchPanning = false;
        
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Pinch zoom
                initialDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                initialZoom = currentZoom;
                isTouchPanning = false;
            } else if (e.touches.length === 1 && currentZoom > 1) {
                // Single finger pan when zoomed
                isTouchPanning = true;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchPanStartX = panX;
                touchPanStartY = panY;
                img.style.transition = 'none';
            }
        }, { passive: true });
        
        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const currentDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                const scale = currentDistance / initialDistance;
                currentZoom = Math.max(minZoom, Math.min(maxZoom, initialZoom * scale));
                updateTransform();
            } else if (e.touches.length === 1 && isTouchPanning && currentZoom > 1) {
                e.preventDefault();
                const dx = (e.touches[0].clientX - touchStartX) / currentZoom;
                const dy = (e.touches[0].clientY - touchStartY) / currentZoom;
                panX = touchPanStartX + dx;
                panY = touchPanStartY + dy;
                updateTransform();
            }
        }, { passive: false });
        
        container.addEventListener('touchend', (e) => {
            if (isTouchPanning) {
                isTouchPanning = false;
                img.style.transition = 'transform 0.2s ease';
            }
        });
        
        // Double-tap to zoom on mobile
        let lastTap = 0;
        img.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTap < 300 && e.changedTouches.length === 1) {
                e.preventDefault();
                // Double tap detected
                if (currentZoom === 1) {
                    updateZoom(2.5); // Zoom in to 250%
                } else {
                    updateZoom(1, true); // Reset to 100%
                }
            }
            lastTap = now;
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    } catch (error) {
        console.error('Error viewing receipt:', error);
        showNotification('Error viewing receipt: ' + error.message, 'error');
    }
}

// Helper function to view receipt from expense ID (avoids JSON in HTML onclick)
async function viewReceiptFromExpense(expenseId) {
    try {
        showLoader('Loading receipt...');

        if (DATA_SOURCE === 'supabase') {
            const url = await getReceiptViewUrl(expenseId);
            hideLoader();
            if (url) {
                viewReceipt(url);
            } else {
                showNotification('No receipt found for this expense', 'warning');
            }
            return;
        }

        hideLoader();
        const expense = allExpenses.find(exp => exp.id === expenseId);
        if (expense && expense.fields.Receipt) {
            viewReceipt(expense.fields.Receipt);
        } else {
            showNotification('No receipt found for this expense', 'warning');
        }
    } catch (error) {
        hideLoader();
        console.error('Error loading receipt:', error);
        showNotification('Error loading receipt: ' + error.message, 'error');
    }
}

// Download receipt from modal button (gets data from data attributes)
function downloadReceiptFromModal(button) {
    const dataUrl = button.getAttribute('data-url');
    const filename = button.getAttribute('data-filename');
    downloadBase64Receipt(dataUrl, filename);
}

// Download base64 receipt as a file
function downloadBase64Receipt(dataUrl, filename) {
    try {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename || 'receipt.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('Download started', 'success');
    } catch (error) {
        console.error('Error downloading receipt:', error);
        showNotification('Error downloading receipt', 'error');
    }
}

function editExpenseFromDetail() {
    try {
        console.log('editExpenseFromDetail called, ID:', currentExpenseIdForDetail);

        if (!currentExpenseIdForDetail) {
            console.error('No expense ID set!');
            alert('Error: No expense selected');
            return;
        }

        // IMPORTANT: Save the ID to a local variable BEFORE closing modals
        const expenseId = currentExpenseIdForDetail;
        console.log('Saved expense ID:', expenseId);

        // Close ALL modals including detail modal and any dynamically created ones
        closeAllModalsExcept(null);
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.style.zIndex === '10001') {
                modal.remove();
            }
        });
        currentExpenseIdForDetail = null;

        console.log('About to call editExpense with ID:', expenseId);
        editExpense(expenseId);
    } catch (error) {
        console.error('Error in editExpenseFromDetail:', error);
        alert('Error opening edit form: ' + error.message);
    }
}

function renderPayments() {
    const container = document.getElementById('paymentsList');

    // Apply year/month filter
    const selectedYear = document.getElementById('yearSelector').value;
    const selectedMonth = document.getElementById('monthSelector').value;
    let filteredPayments = allPayments;
    
    // Filter out payments that were auto-created from expenses (FromExpense = true)
    filteredPayments = filteredPayments.filter(p => p.fields.FromExpense !== true);
    
    if (selectedYear !== 'all') {
        filteredPayments = filteredPayments.filter(p => String(p.fields.Year) === selectedYear);
    }
    if (selectedMonth !== 'all') {
        filteredPayments = filteredPayments.filter(p => p.fields.Month === selectedMonth);
    }

    if (filteredPayments.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-gray-400"><i class="fas fa-inbox text-6xl mb-4"></i><p class="text-lg">No payments found</p><button onclick="openContributionModal('Amar')" class="btn-primary mt-4"><i class="fas fa-plus mr-2"></i>Add First Payment</button></div>`;
        return;
    }
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const sortedPayments = [...filteredPayments].sort((a, b) => {
        const dateA = `${a.fields.Year}-${a.fields.Month}`;
        const dateB = `${b.fields.Year}-${b.fields.Month}`;
        const dateCompare = dateB.localeCompare(dateA);

        // If dates are the same, sort by creation time (most recent first)
        if (dateCompare === 0) {
            const createdA = new Date(a.createdTime || 0);
            const createdB = new Date(b.createdTime || 0);
            return createdB - createdA;
        }

        return dateCompare;
    });

    container.innerHTML = sortedPayments.map(payment => {
        const fields = payment.fields;
        const monthDisplay = fields.Month ? monthNames[parseInt(fields.Month) - 1] : 'N/A';
        const personColor = fields.Person === 'Amar' ? 'text-blue-600' : 'text-pink-600';
        const personBg = fields.Person === 'Amar' ? 'bg-blue-100' : 'bg-pink-100';

        // Payment type badge
        let typeBadge = '';
        if (fields.PaymentType === 'RentalIncome') {
            typeBadge = '<span class="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold ml-2"><i class="fas fa-home mr-1"></i>Rental Income</span>';
        } else if (fields.PaymentType === 'PriyaMortgageContribution') {
            typeBadge = '<span class="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold ml-2"><i class="fas fa-home mr-1"></i>Mortgage Contribution</span>';
        }

        return `
                    <div class="payment-row">
                        <div class="expense-item"><span class="expense-label">Date:</span><span class="text-gray-600">${monthDisplay} ${fields.Year || 'N/A'}</span></div>
                        <div class="expense-item"><span class="expense-label">Person:</span><span class="inline-block px-3 py-1 ${personBg} ${personColor} rounded-full text-sm font-semibold">${fields.Person || 'N/A'}</span></div>
                        <div class="expense-item"><span class="expense-label">Amount:</span><span class="font-bold text-green-600 text-lg">$${(fields.Amount || 0).toFixed(2)}</span></div>
                        <div class="expense-item"><span class="expense-label">Description:</span><span class="text-gray-700">${fields.Description || 'Payment'}${typeBadge}</span></div>
                        <div class="expense-item"><span class="expense-label">Actions:</span><div class="flex gap-3">
                            <button onclick="editPayment('${payment.id}')" class="text-blue-500 hover:text-blue-700 text-lg" title="Edit"><i class="fas fa-edit"></i></button>
                            <button onclick="deletePayment('${payment.id}')" class="text-red-500 hover:text-red-700 text-lg" title="Delete"><i class="fas fa-trash"></i></button>
                        </div></div>
                    </div>
                `;
    }).join('');
}

function updateStats() {
    const expenses = getFilteredExpenses();

    console.log('📊 updateStats called');
    console.log('   Total expenses loaded:', allExpenses.length);
    console.log('   Filtered expenses:', expenses.length);
    console.log('   Year filter:', document.getElementById('yearSelector').value);
    console.log('   Month filter:', document.getElementById('monthSelector').value);

    // Calculate total budget from category budgets
    let totalBudget = 0;
    const categorySpending = {};

    // Group expenses by category
    expenses.forEach(exp => {
        if (exp.fields.Category) {
            const cat = exp.fields.Category.trim();
            categorySpending[cat] = (categorySpending[cat] || 0) + (exp.fields.Actual || 0);
        }
    });

    console.log('   Category spending:', categorySpending);

    // Get filtered month/year for budgets (use selected filter, not current date)
    const yearFilterEl = document.getElementById('yearSelector');
    const monthFilterEl = document.getElementById('monthSelector');
    const selectedYear = yearFilterEl ? yearFilterEl.value : 'all';
    const selectedMonth = monthFilterEl ? monthFilterEl.value : 'all';

    let monthKey = '';
    if (selectedYear !== 'all' && selectedMonth !== 'all') {
        monthKey = `${selectedYear}-${selectedMonth}`;
    } else {
        // Fallback to current month if showing all
        const currentYear = new Date().getFullYear();
        const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
        monthKey = `${currentYear}-${currentMonth}`;
    }

    console.log('   Budget monthKey:', monthKey);
    console.log('   Available budget months:', Object.keys(categoryBudgets));
    console.log('   Budgets for month:', categoryBudgets[monthKey]);

    // Sum up budgets for categories in filtered month (including rollover)
    if (categoryBudgets[monthKey]) {
        console.log('   📊 Found budgets for', monthKey);
        Object.keys(categoryBudgets[monthKey]).forEach(cat => {
            const budgetInfo = categoryBudgets[monthKey][cat];
            console.log(`   📊 Category: ${cat}, Budget Info:`, budgetInfo);
            if (budgetInfo && budgetInfo.amount > 0) {
                const baseBudget = budgetInfo.amount;
                // Add rollover from previous month
                const rollover = calculateRollover(cat, parseInt(selectedYear), selectedMonth);
                const categoryTotal = baseBudget + rollover;
                console.log(`   📊 ${cat}: base=${baseBudget}, rollover=${rollover}, total=${categoryTotal}`);
                totalBudget += categoryTotal;
            }
        });
    } else {
        console.warn('   ⚠️ No budgets found for month:', monthKey);
        console.warn('   ⚠️ Available months:', Object.keys(categoryBudgets));
    }

    console.log('   ✅ Total budget calculated:', totalBudget);

    const totalActual = expenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const llcTotal = expenses.filter(exp => exp.fields.LLC === 'Yes' || exp.fields.LLC === true).reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const remaining = totalBudget - totalActual;

    console.log('   Total actual:', totalActual);
    console.log('   LLC total:', llcTotal);
    console.log('   Remaining:', remaining);

    // Check for over-budget categories in current month (including rollover)
    const overBudgetCategories = [];
    const tolerance = 0.01; // 1 cent tolerance for floating point comparison
    Object.keys(categorySpending).forEach(cat => {
        const budgetInfo = categoryBudgets[monthKey] && categoryBudgets[monthKey][cat];
        const baseBudget = budgetInfo ? budgetInfo.amount : 0;
        const rollover = calculateRollover(cat, parseInt(selectedYear), selectedMonth);
        const totalCategoryBudget = baseBudget + rollover;
        const spent = categorySpending[cat];
        const difference = spent - totalCategoryBudget;
        if (totalCategoryBudget > 0 && difference > tolerance) {
            overBudgetCategories.push({
                category: cat,
                budget: totalCategoryBudget,
                spent: spent,
                over: difference
            });
        }
    });

    latestOverBudgetCategories = overBudgetCategories
        .slice()
        .sort((a, b) => (b.over || 0) - (a.over || 0));
    latestOverBudgetMonthKey = monthKey;

    // Calculate contributions (from expenses + standalone payments)
    // Filter payments by same year/month as expenses
    let filteredPayments = allPayments;
    if (selectedYear !== 'all') {
        filteredPayments = filteredPayments.filter(p => String(p.fields.Year) === selectedYear);
    }
    if (selectedMonth !== 'all') {
        filteredPayments = filteredPayments.filter(p => p.fields.Month === selectedMonth);
    }

    console.log('   Total payments loaded:', allPayments.length);
    console.log('   Filtered payments:', filteredPayments.length);

    // Calculate total rental income for the filtered period
    const totalRentalIncome = filteredPayments
        .filter(p => p.fields.PaymentType === 'RentalIncome')
        .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

    // Target shares remain the same (not reduced by rental income)
    // Rental income will only reduce the remaining balance
    const amarShare = totalActual / 2;
    const priyaShare = totalActual / 2;

    // Calculate contributions separately for mortgage and non-mortgage expenses
    const amarMortgageContrib = expenses
        .filter(exp => exp.fields.Category === 'Mortgage')
        .reduce((sum, exp) => sum + (exp.fields.AmarContribution || 0), 0);
    const amarNonMortgageContrib = expenses
        .filter(exp => exp.fields.Category !== 'Mortgage')
        .reduce((sum, exp) => sum + (exp.fields.AmarContribution || 0), 0);

    const priyaContribFromExpenses = expenses.reduce((sum, exp) => sum + (exp.fields.PriyaContribution || 0), 0);

    // Separate Priya's mortgage contributions from regular payments
    const priyaMortgageContributions = filteredPayments
        .filter(p => p.fields.Person === 'Priya' && !p.fields.FromExpense && p.fields.PaymentType === 'PriyaMortgageContribution')
        .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

    // Only count standalone payments (not from expenses, excluding rental income to avoid double counting)
    const amarContribFromPayments = filteredPayments
        .filter(p => p.fields.Person === 'Amar' && !p.fields.FromExpense && p.fields.PaymentType !== 'RentalIncome')
        .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);
    const priyaContribFromPayments = filteredPayments
        .filter(p => p.fields.Person === 'Priya' && !p.fields.FromExpense &&
            p.fields.PaymentType !== 'PriyaMortgageContribution' &&
            p.fields.PaymentType !== 'RentalIncome')
        .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

    // Track Regular settlement payments separately (person paying toward their share)
    // These are transfers between people, not new contributions to spending
    const amarRegularPayments = filteredPayments
        .filter(p => p.fields.Person === 'Amar' && !p.fields.FromExpense && p.fields.PaymentType === 'Regular')
        .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);
    const priyaRegularPayments = filteredPayments
        .filter(p => p.fields.Person === 'Priya' && !p.fields.FromExpense && p.fields.PaymentType === 'Regular')
        .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

    // Reduce only Amar's mortgage contribution by Priya's mortgage payments, keep non-mortgage contributions unchanged
    const amarAdjustedMortgageContrib = Math.max(0, amarMortgageContrib - priyaMortgageContributions);
    const amarContribTotal = amarNonMortgageContrib + amarAdjustedMortgageContrib + amarContribFromPayments;
    const priyaContribTotal = priyaContribFromExpenses + priyaContribFromPayments + priyaMortgageContributions;

    // Apply rental income to remaining balance (split 50/50)
    // Rental income reduces what's owed: subtract for positive (owe less), add for negative (overpaid by less)
    const amarRentalIncome = totalRentalIncome / 2;
    const priyaRentalIncome = totalRentalIncome / 2;
    const amarBaseRemaining = amarShare - amarContribTotal;
    const priyaBaseRemaining = priyaShare - priyaContribTotal;
    let amarRemaining = amarBaseRemaining >= 0
        ? amarBaseRemaining - amarRentalIncome
        : amarBaseRemaining + amarRentalIncome;
    let priyaRemaining = priyaBaseRemaining >= 0
        ? priyaBaseRemaining - priyaRentalIncome
        : priyaBaseRemaining + priyaRentalIncome;

    // Regular payments are settlements between people:
    // When Priya pays Amar, Amar's credit (overpayment) decreases
    // When Amar pays Priya, Priya's credit (overpayment) decreases
    amarRemaining += priyaRegularPayments;
    priyaRemaining += amarRegularPayments;
    
    // Apply rollover from previous month (starting Nov 2025)
    if (selectedYear !== 'all' && selectedMonth !== 'all') {
        const year = parseInt(selectedYear);
        const month = parseInt(selectedMonth);
        
        // Only apply rollovers from Dec 2025 onwards (rolling over from Nov 2025)
        if (year > 2025 || (year === 2025 && month >= 12)) {
            // Get previous month's rollover
            let prevYear = year;
            let prevMonth = month - 1;
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear--;
            }
            
            const prevRolloverKey = `rollover_${prevYear}_${String(prevMonth).padStart(2, '0')}`;
            const prevRolloverData = localStorage.getItem(prevRolloverKey);
            
            if (prevRolloverData) {
                const prevData = JSON.parse(prevRolloverData);
                console.log('📥 Applying previous month rollover:', prevRolloverKey, prevData);
                
                // Add previous month's dues to current month
                // If they owed last month, add to what they owe this month
                // If they overpaid last month, subtract from what they owe this month (credit)
                amarRemaining += (prevData.amarOwes - prevData.amarOverpaid);
                priyaRemaining += (prevData.priyaOwes - prevData.priyaOverpaid);
                
                console.log('   After rollover - Amar remaining:', amarRemaining);
                console.log('   After rollover - Priya remaining:', priyaRemaining);
            }
        }
    }
    
    const amarContribPercent = amarShare > 0 ? (amarContribTotal / amarShare) * 100 : 0;
    const priyaContribPercent = priyaShare > 0 ? (priyaContribTotal / priyaShare) * 100 : 0;

    console.log('   Amar share:', amarShare);
    console.log('   Amar contrib total:', amarContribTotal);
    console.log('   Amar remaining:', amarRemaining);
    console.log('   Priya share:', priyaShare);
    console.log('   Priya contrib total:', priyaContribTotal);
    console.log('   Priya remaining:', priyaRemaining);

    // Store rollover dues for next month (starting Nov 2025)
    if (selectedYear !== 'all' && selectedMonth !== 'all') {
        const year = parseInt(selectedYear);
        const month = parseInt(selectedMonth);
        
        // Only track rollovers from Nov 2025 onwards
        if (year > 2025 || (year === 2025 && month >= 11)) {
            const rolloverData = {
                year: year,
                month: month,
                amarOwes: amarRemaining > 0 ? amarRemaining : 0,
                priyaOwes: priyaRemaining > 0 ? priyaRemaining : 0,
                amarOverpaid: amarRemaining < 0 ? Math.abs(amarRemaining) : 0,
                priyaOverpaid: priyaRemaining < 0 ? Math.abs(priyaRemaining) : 0,
                timestamp: new Date().toISOString()
            };
            
            // Store in localStorage with year-month key
            const rolloverKey = `rollover_${year}_${String(month).padStart(2, '0')}`;
            localStorage.setItem(rolloverKey, JSON.stringify(rolloverData));
            console.log('💰 Stored rollover data:', rolloverKey, rolloverData);
        }
    }

    // Update budget display with intelligent info
    const budgetEl = document.getElementById('totalBudget');
    if (budgetEl) {
        if (totalBudget === 0) {
            budgetEl.innerHTML = `<span class="text-gray-400">$0.00</span><br><span class="text-xs text-gray-400">Set budgets</span>`;
        } else {
            budgetEl.textContent = `$${totalBudget.toFixed(2)}`;
        }
    }

    const totalActualEl = document.getElementById('totalActual');
    if (totalActualEl) {
        totalActualEl.textContent = `$${totalActual.toFixed(2)}`;
    }

    const llcTotalEl = document.getElementById('llcTotal');
    if (llcTotalEl) {
        llcTotalEl.textContent = `$${llcTotal.toFixed(2)}`;
    }

    const netSpendEl = document.getElementById('netSpendTotal');
    if (netSpendEl) {
        const netSpend = totalActual - totalRentalIncome;
        netSpendEl.textContent = `$${netSpend.toFixed(2)}`;
    }
    const rentalSublineEl = document.getElementById('rentalIncomeSubline');
    if (rentalSublineEl) {
        rentalSublineEl.innerHTML = `<i class="fas fa-home mr-1"></i>Rental: $${totalRentalIncome.toFixed(2)}`;
    }

    // Update remaining: always show Budget - Spent
    const remainingEl = document.getElementById('remaining');
    if (remainingEl) {
        if (totalBudget === 0) {
            remainingEl.innerHTML = `<span class="text-gray-400">--</span>`;
        } else {
            const displayAmount = Math.abs(remaining).toFixed(2);
            const colorClass = remaining >= 0 ? 'text-green-600' : 'text-red-600';
            const signPrefix = remaining < 0 ? '-' : '';

            if (overBudgetCategories.length > 0) {
                // Show negative amount with over-budget note
                remainingEl.innerHTML = `<span class="${colorClass} font-bold">${signPrefix}$${displayAmount}</span><br><span class="text-xs ${colorClass}">${overBudgetCategories.length} over budget</span>`;
            } else {
                remainingEl.innerHTML = `<span class="${colorClass}">${signPrefix}$${displayAmount}</span>`;
            }
        }
    }

    // Update predicted total
    updatePredictedTotal();

    // Update Amar's stats
    const amarShareEl = document.getElementById('amarShare');
    if (amarShareEl) amarShareEl.textContent = `$${amarShare.toFixed(2)}`;

    const amarContributionEl = document.getElementById('amarContribution');
    if (amarContributionEl) amarContributionEl.textContent = `$${amarContribTotal.toFixed(2)}`;

    const amarContributionPercentEl = document.getElementById('amarContributionPercent');
    if (amarContributionPercentEl) amarContributionPercentEl.textContent = amarContribPercent.toFixed(0);

    const amarRemainingEl = document.getElementById('amarRemaining');
    if (amarRemainingEl) amarRemainingEl.textContent = `$${amarRemaining.toFixed(2)}`;

    const amarContributionProgressEl = document.getElementById('amarContributionProgress');
    if (amarContributionProgressEl) amarContributionProgressEl.style.width = `${Math.min(amarContribPercent, 100)}%`;

    const amarRemainingProgressEl = document.getElementById('amarRemainingProgress');
    if (amarRemainingProgressEl) amarRemainingProgressEl.style.width = `${Math.min(100 - amarContribPercent, 100)}%`;

    // Update Priya's stats
    const priyaShareEl = document.getElementById('priyaShare');
    if (priyaShareEl) priyaShareEl.textContent = `$${priyaShare.toFixed(2)}`;

    const priyaContributionEl = document.getElementById('priyaContribution');
    if (priyaContributionEl) priyaContributionEl.textContent = `$${priyaContribTotal.toFixed(2)}`;

    const priyaContributionPercentEl = document.getElementById('priyaContributionPercent');
    if (priyaContributionPercentEl) priyaContributionPercentEl.textContent = priyaContribPercent.toFixed(0);

    const priyaRemainingEl = document.getElementById('priyaRemaining');
    if (priyaRemainingEl) priyaRemainingEl.textContent = `$${priyaRemaining.toFixed(2)}`;

    const priyaContributionProgressEl = document.getElementById('priyaContributionProgress');
    if (priyaContributionProgressEl) priyaContributionProgressEl.style.width = `${Math.min(priyaContribPercent, 100)}%`;

    const priyaRemainingProgressEl = document.getElementById('priyaRemainingProgress');
    if (priyaRemainingProgressEl) priyaRemainingProgressEl.style.width = `${Math.min(100 - priyaContribPercent, 100)}%`;

    console.log('✅ updateStats complete');
}

function handleLeftTileClick() {
    try {
        if (latestOverBudgetCategories && latestOverBudgetCategories.length > 0) {
            openOverBudgetModal();
        } else {
            openBudgetManager();
        }
    } catch (error) {
        console.error('Error handling LEFT tile click:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

function openOverBudgetModal() {
    closeAllModalsExcept('overBudgetModal');

    const subtitleEl = document.getElementById('overBudgetSubtitle');
    if (subtitleEl) {
        if (latestOverBudgetMonthKey) {
            const [y, m] = latestOverBudgetMonthKey.split('-');
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const monthName = monthNames[(parseInt(m, 10) || 1) - 1] || m;
            subtitleEl.textContent = `${monthName} ${y} • ${latestOverBudgetCategories.length} category${latestOverBudgetCategories.length !== 1 ? 'ies' : 'y'} over budget`;
        } else {
            subtitleEl.textContent = `${latestOverBudgetCategories.length} category${latestOverBudgetCategories.length !== 1 ? 'ies' : 'y'} over budget`;
        }
    }

    const listEl = document.getElementById('overBudgetList');
    if (!listEl) return;

    if (!latestOverBudgetCategories || latestOverBudgetCategories.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-10 text-gray-400">
                <i class="fas fa-check-circle text-5xl text-green-500 mb-4"></i>
                <p class="text-lg">No over-budget categories</p>
            </div>
        `;
        return;
    }

    const rows = latestOverBudgetCategories.map(entry => {
        const categoryRaw = String(entry.category || 'Unknown');
        const category = escapeHtml(categoryRaw);
        const categoryEncoded = encodeURIComponent(categoryRaw);
        const budget = Number(entry.budget || 0);
        const spent = Number(entry.spent || 0);
        const over = Number(entry.over || 0);
        const pct = budget > 0 ? (spent / budget) * 100 : 0;

        return `
            <div class="border border-red-200 bg-red-50 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all" onclick="applyOverBudgetDrilldown('${categoryEncoded}')">
                <div class="flex justify-between items-start gap-3">
                    <div class="min-w-0">
                        <div class="font-bold text-gray-800 truncate">
                            <i class="fas fa-tag mr-2 text-red-500"></i>${category}
                        </div>
                        <div class="text-xs text-gray-600 mt-1">
                            Spent <span class="font-semibold text-red-700">$${spent.toFixed(2)}</span>
                            of <span class="font-semibold">$${budget.toFixed(2)}</span>
                            <span class="text-gray-500">(${pct.toFixed(0)}%)</span>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <div class="text-xs text-gray-500">Over by</div>
                        <div class="text-2xl font-extrabold text-red-600">$${over.toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    listEl.innerHTML = rows;

    const modal = document.getElementById('overBudgetModal');
    if (modal) modal.classList.add('active');
}

function closeOverBudgetModal() {
    const modal = document.getElementById('overBudgetModal');
    if (modal) modal.classList.remove('active');
}

function applyOverBudgetDrilldown(categoryEncoded) {
    try {
        const category = decodeURIComponent(String(categoryEncoded || ''));
        const [year, month] = String(latestOverBudgetMonthKey || '').split('-');

        closeOverBudgetModal();
        switchTab('category');

        setTimeout(() => {
            const yearEl = document.getElementById('filterYear');
            if (yearEl && year) {
                yearEl.value = year;
            }

            // Clear contributor
            const contributorEl = document.getElementById('filterContributor');
            if (contributorEl) contributorEl.selectedIndex = 0;

            // Clear tags
            document.querySelectorAll('#tagDropdownContent input[type="checkbox"]').forEach(cb => cb.checked = false);
            const tagText = document.getElementById('tagDropdownText');
            if (tagText) tagText.innerHTML = '<span class="custom-dropdown-placeholder">Select tags...</span>';

            // Set month
            document.querySelectorAll('#monthDropdownContent input[type="checkbox"]').forEach(cb => {
                cb.checked = (month && cb.value === month);
            });
            if (typeof updateMonthSelection === 'function') updateMonthSelection();

            // Set category
            document.querySelectorAll('#categoryDropdownContent input[type="checkbox"]').forEach(cb => {
                cb.checked = (cb.value === category);
            });
            if (typeof updateCategorySelection === 'function') updateCategorySelection();

            // Ensure results are up to date
            if (typeof updateFilteredView === 'function') updateFilteredView();

            const scrollTarget = document.getElementById('filterResults') || document.getElementById('categoryTab');
            if (scrollTarget && typeof scrollTarget.scrollIntoView === 'function') {
                scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 0);
    } catch (error) {
        console.error('Error applying over-budget drilldown:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

function openNetSpendModal() {
    try {
        closeAllModalsExcept('netSpendModal');
        const expenses = getFilteredExpenses();
        const selectedYear = document.getElementById('yearSelector').value;
        const selectedMonth = document.getElementById('monthSelector').value;

        let filteredPayments = allPayments;
        if (selectedYear !== 'all') filteredPayments = filteredPayments.filter(p => String(p.fields.Year) === selectedYear);
        if (selectedMonth !== 'all') filteredPayments = filteredPayments.filter(p => p.fields.Month === selectedMonth);

        const totalRentalIncome = filteredPayments
            .filter(p => p.fields.PaymentType === 'RentalIncome')
            .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);
        const totalSpent = expenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
        const netSpend = totalSpent - totalRentalIncome;

        const subtitleEl = document.getElementById('netSpendSubtitle');
        if (subtitleEl) {
            const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            let periodLabel = 'All Time';
            if (selectedYear !== 'all' && selectedMonth !== 'all') {
                periodLabel = `${monthNames[(parseInt(selectedMonth) || 1) - 1]} ${selectedYear}`;
            } else if (selectedYear !== 'all') {
                periodLabel = selectedYear;
            }
            subtitleEl.textContent = periodLabel;
        }

        const summaryEl = document.getElementById('netSpendSummary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="grid grid-cols-3 gap-3 text-center">
                    <div class="bg-gray-50 rounded-lg p-3">
                        <div class="text-xs text-gray-500 font-semibold">Total Spent</div>
                        <div class="text-lg font-bold text-gray-800">$${totalSpent.toFixed(2)}</div>
                    </div>
                    <div class="bg-green-50 rounded-lg p-3">
                        <div class="text-xs text-green-600 font-semibold"><i class="fas fa-home mr-1"></i>Rental Income</div>
                        <div class="text-lg font-bold text-green-700">$${totalRentalIncome.toFixed(2)}</div>
                    </div>
                    <div class="rounded-lg p-3" style="background: linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,226,0.1));">
                        <div class="text-xs font-semibold" style="color: var(--color-primary);">Net Spend</div>
                        <div class="text-lg font-bold" style="color: var(--color-primary);">$${netSpend.toFixed(2)}</div>
                    </div>
                </div>
            `;
        }

        const categoryMap = {};
        expenses.forEach(exp => {
            const cat = (exp.fields.Category || 'Uncategorized').trim();
            if (!categoryMap[cat]) {
                categoryMap[cat] = { total: 0, amarContrib: 0, priyaContrib: 0, expenses: [] };
            }
            categoryMap[cat].total += (exp.fields.Actual || 0);
            categoryMap[cat].amarContrib += (exp.fields.AmarContribution || 0);
            categoryMap[cat].priyaContrib += (exp.fields.PriyaContribution || 0);
            categoryMap[cat].expenses.push(exp);
        });

        const sorted = Object.entries(categoryMap).sort((a, b) => b[1].total - a[1].total);

        const listEl = document.getElementById('netSpendList');
        if (!listEl) return;

        if (sorted.length === 0) {
            listEl.innerHTML = `<div class="text-center py-10 text-gray-400"><i class="fas fa-inbox text-5xl mb-4"></i><p class="text-lg">No expenses found</p></div>`;
        } else {
            const categoryIcons = {
                'Mortgage': 'fa-home', 'Groceries': 'fa-shopping-cart', 'Utilities': 'fa-bolt',
                'Insurance': 'fa-shield-alt', 'Dining': 'fa-utensils', 'Shopping': 'fa-shopping-bag',
                'Transportation': 'fa-car', 'Entertainment': 'fa-film', 'Health': 'fa-heartbeat',
                'Education': 'fa-graduation-cap', 'Travel': 'fa-plane', 'Subscriptions': 'fa-redo',
                'Phone': 'fa-mobile-alt', 'Internet': 'fa-wifi', 'Gas': 'fa-gas-pump',
                'Maintenance': 'fa-wrench', 'Baby': 'fa-baby', 'Pets': 'fa-paw',
                'Gifts': 'fa-gift', 'Clothing': 'fa-tshirt', 'Personal Care': 'fa-spa'
            };
            const rows = sorted.map(([cat, data], idx) => {
                const icon = categoryIcons[cat] || 'fa-tag';
                const pctOfTotal = totalSpent > 0 ? ((data.total / totalSpent) * 100).toFixed(1) : '0.0';
                const catEncoded = encodeURIComponent(cat);
                const amarPct = data.total > 0 ? ((data.amarContrib / data.total) * 100).toFixed(0) : '0';
                const priyaPct = data.total > 0 ? ((data.priyaContrib / data.total) * 100).toFixed(0) : '0';
                return `
                    <div class="border border-gray-200 rounded-lg overflow-hidden">
                        <div class="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onclick="toggleNetSpendCategory('${catEncoded}')">
                            <div class="flex justify-between items-center">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style="background: var(--gradient-primary);">
                                        <i class="fas ${icon} text-white text-sm"></i>
                                    </div>
                                    <div class="min-w-0">
                                        <div class="font-bold text-gray-800 truncate">${escapeHtml(cat)}</div>
                                        <div class="text-xs text-gray-500">${data.expenses.length} expense${data.expenses.length !== 1 ? 's' : ''} • ${pctOfTotal}% of total</div>
                                    </div>
                                </div>
                                <div class="text-right flex-shrink-0 flex items-center gap-3">
                                    <div>
                                        <div class="text-lg font-bold text-gray-800">$${data.total.toFixed(2)}</div>
                                        <div class="text-xs text-gray-400">
                                            <span class="text-blue-500">A:${amarPct}%</span>
                                            <span class="mx-1">•</span>
                                            <span class="text-pink-500">P:${priyaPct}%</span>
                                        </div>
                                    </div>
                                    <i class="fas fa-chevron-down text-gray-400 text-xs transition-transform" id="netSpendChevron_${idx}"></i>
                                </div>
                            </div>
                            <div class="mt-2 flex gap-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
                                <div class="rounded-full" style="width: ${amarPct}%; background: #4facfe;"></div>
                                <div class="rounded-full" style="width: ${priyaPct}%; background: #f093fb;"></div>
                            </div>
                        </div>
                        <div id="netSpendDetail_${idx}" class="hidden border-t border-gray-100 bg-gray-50 max-h-80 overflow-y-auto" data-category="${catEncoded}">
                            ${buildNetSpendExpenseRows(data.expenses, cat)}
                        </div>
                    </div>
                `;
            }).join('');
            listEl.innerHTML = rows;
        }

        const modal = document.getElementById('netSpendModal');
        if (modal) modal.classList.add('active');
    } catch (error) {
        console.error('Error opening net spend modal:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

function buildNetSpendExpenseRows(expenses, category) {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sorted = [...expenses].sort((a, b) => {
        const dateA = `${a.fields.Year}-${String(a.fields.Month).padStart(2, '0')}-${String(a.fields.Day || 1).padStart(2, '0')}`;
        const dateB = `${b.fields.Year}-${String(b.fields.Month).padStart(2, '0')}-${String(b.fields.Day || 1).padStart(2, '0')}`;
        return dateB.localeCompare(dateA);
    });

    return sorted.map(exp => {
        const f = exp.fields;
        const item = escapeHtml(f.Item || 'Unnamed');
        const amount = (f.Actual || 0).toFixed(2);
        const day = f.Day || 1;
        const monthIdx = (parseInt(f.Month) || 1) - 1;
        const dateStr = `${monthNames[monthIdx]} ${day}, ${f.Year}`;
        const amarC = (f.AmarContribution || 0).toFixed(2);
        const priyaC = (f.PriyaContribution || 0).toFixed(2);
        const isLLC = f.LLC === 'Yes' || f.LLC === true;
        const tags = f.Tags || '';
        const notes = f.Notes || '';

        let badges = '';
        if (isLLC) badges += '<span class="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">LLC</span>';
        if (tags) {
            tags.split(',').slice(0, 3).forEach(tag => {
                const t = tag.trim();
                if (t) badges += ` <span class="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">${escapeHtml(t)}</span>`;
            });
        }

        return `
            <div class="px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-white transition-colors">
                <div class="flex justify-between items-start gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="font-semibold text-gray-800 text-sm truncate">${item}</div>
                        <div class="text-xs text-gray-400 mt-0.5"><i class="far fa-calendar-alt mr-1"></i>${dateStr}</div>
                        ${notes ? `<div class="text-xs text-gray-400 mt-0.5 truncate"><i class="far fa-sticky-note mr-1"></i>${escapeHtml(notes)}</div>` : ''}
                        ${badges ? `<div class="mt-1 flex flex-wrap gap-1">${badges}</div>` : ''}
                    </div>
                    <div class="text-right flex-shrink-0">
                        <div class="font-bold text-gray-800 text-sm">$${amount}</div>
                        <div class="text-xs mt-0.5">
                            <span class="text-blue-500">A: $${amarC}</span><br>
                            <span class="text-pink-500">P: $${priyaC}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleNetSpendCategory(catEncoded) {
    const allDetails = document.querySelectorAll('[id^="netSpendDetail_"]');
    let targetDetail = null;
    let targetIdx = null;

    allDetails.forEach((detail, idx) => {
        if (detail.dataset.category === catEncoded) {
            targetDetail = detail;
            targetIdx = idx;
        }
    });

    if (!targetDetail) return;

    const isHidden = targetDetail.classList.contains('hidden');

    allDetails.forEach((detail, idx) => {
        detail.classList.add('hidden');
        const chevron = document.getElementById(`netSpendChevron_${idx}`);
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    });

    if (isHidden) {
        targetDetail.classList.remove('hidden');
        const chevron = document.getElementById(`netSpendChevron_${targetIdx}`);
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        targetDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function closeNetSpendModal() {
    const modal = document.getElementById('netSpendModal');
    if (modal) modal.classList.remove('active');
}

function updateCharts() {
    updatePieChart();
    updateLLCChart();
    updateLineChart();
    updateCategoryMonthlyChart();
    updateContributionsMonthlyChart();
    updateContributionCoverageChart();
    updateYearComparisonChart();
}

function updatePieChart() {
    const ctx = document.getElementById('pieChart');
    if (!ctx) return;
    const expenses = getFilteredExpenses();
    const expensesByItem = {};
    expenses.forEach(exp => {
        const item = exp.fields.Item || 'Other';
        const actual = exp.fields.Actual || 0;
        expensesByItem[item] = (expensesByItem[item] || 0) + actual;
    });
    if (charts.pie) charts.pie.destroy();
    charts.pie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(expensesByItem),
            datasets: [{ data: Object.values(expensesByItem), backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } } } }
    });
}

function updateLLCChart() {
    const ctx = document.getElementById('llcChart');
    if (!ctx) return;
    const expenses = getFilteredExpenses();
    const llcExpenses = expenses.filter(exp => exp.fields.LLC === 'Yes').reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const personalExpenses = expenses.filter(exp => exp.fields.LLC !== 'Yes').reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    if (charts.llc) charts.llc.destroy();
    charts.llc = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['LLC Account', 'Personal'], datasets: [{ data: [llcExpenses, personalExpenses], backgroundColor: ['#4facfe', '#f5576c'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

function updateCategoryMonthlyChart() {
    const ctx = document.getElementById('categoryMonthlyChart');
    if (!ctx) return;
    const expenses = allExpenses;

    // Group by month and category
    const monthlyData = {};
    expenses.forEach(exp => {
        const monthKey = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        const category = exp.fields.Category || 'Other';
        if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
        if (!monthlyData[monthKey][category]) monthlyData[monthKey][category] = 0;
        monthlyData[monthKey][category] += exp.fields.Actual || 0;
    });

    // Get last 6 months
    const sortedMonths = Object.keys(monthlyData).sort().slice(-6);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    });

    // Get all categories and sort by total spending (highest first)
    const categoryTotals = {};
    expenses.forEach(e => {
        const category = e.fields.Category || 'Other';
        categoryTotals[category] = (categoryTotals[category] || 0) + (e.fields.Actual || 0);
    });
    const categories = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a]);
    const colors = ['#667eea', '#f5576c', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    const datasets = categories.map((category, index) => ({
        label: category,
        data: sortedMonths.map(m => monthlyData[m][category] || 0),
        backgroundColor: colors[index % colors.length]
    }));

    if (charts.categoryMonthly) charts.categoryMonthly.destroy();
    charts.categoryMonthly = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: false },
                y: { beginAtZero: true, stacked: false }
            }
        }
    });
}

function updateContributionsMonthlyChart() {
    const ctx = document.getElementById('contributionsMonthlyChart');
    if (!ctx) return;

    // Group contributions by month - separate mortgage from non-mortgage for adjustments
    const monthlyData = {};
    allExpenses.forEach(exp => {
        const monthKey = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                amarMortgage: 0,
                amarNonMortgage: 0,
                priyaFromExpenses: 0,
                priyaPayments: 0
            };
        }

        // Separate Amar's mortgage vs non-mortgage contributions
        if (exp.fields.Category === 'Mortgage') {
            monthlyData[monthKey].amarMortgage += (exp.fields.AmarContribution || 0);
        } else {
            monthlyData[monthKey].amarNonMortgage += (exp.fields.AmarContribution || 0);
        }
        monthlyData[monthKey].priyaFromExpenses += (exp.fields.PriyaContribution || 0);
    });

    // Add standalone payments (exclude FromExpense to avoid double counting, exclude rental income)
    allPayments.forEach(payment => {
        // Skip rental income - it doesn't count as contribution
        if (payment.fields.PaymentType === 'RentalIncome') return;

        // Skip payments from expenses (already counted above)
        if (payment.fields.FromExpense) return;

        const monthKey = `${payment.fields.Year}-${String(payment.fields.Month).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                amarMortgage: 0,
                amarNonMortgage: 0,
                priyaFromExpenses: 0,
                priyaPayments: 0
            };
        }

        if (payment.fields.Person === 'Amar') {
            monthlyData[monthKey].amarNonMortgage += (payment.fields.Amount || 0);
        } else if (payment.fields.Person === 'Priya' && payment.fields.PaymentType !== 'PriyaMortgageContribution') {
            // Exclude Priya's mortgage contributions here - they'll be added separately below
            monthlyData[monthKey].priyaPayments += (payment.fields.Amount || 0);
        }
    });

    // Apply mortgage adjustments for each month
    Object.keys(monthlyData).forEach(monthKey => {
        const [year, month] = monthKey.split('-');

        // Find Priya's mortgage contributions for this month
        const priyaMortgageContribs = allPayments
            .filter(p =>
                String(p.fields.Year) === year &&
                String(p.fields.Month).padStart(2, '0') === month &&
                p.fields.Person === 'Priya' &&
                p.fields.PaymentType === 'PriyaMortgageContribution'
            )
            .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

        // Adjust Amar's mortgage contribution and add to Priya's total
        const amarAdjustedMortgage = Math.max(0, monthlyData[monthKey].amarMortgage - priyaMortgageContribs);
        monthlyData[monthKey].amar = monthlyData[monthKey].amarNonMortgage + amarAdjustedMortgage;
        monthlyData[monthKey].priya = monthlyData[monthKey].priyaFromExpenses + monthlyData[monthKey].priyaPayments + priyaMortgageContribs;
    });

    // Get last 6 months
    const sortedMonths = Object.keys(monthlyData).sort().slice(-6);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    });

    const amarData = sortedMonths.map(m => monthlyData[m].amar);
    const priyaData = sortedMonths.map(m => monthlyData[m].priya);

    if (charts.contributionsMonthly) charts.contributionsMonthly.destroy();
    charts.contributionsMonthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Amar',
                    data: amarData,
                    backgroundColor: '#4facfe'
                },
                {
                    label: 'Priya',
                    data: priyaData,
                    backgroundColor: '#f093fb'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function updateContributionCoverageChart() {
    const ctx = document.getElementById('contributionCoverageChart');
    if (!ctx) return;

    // Group by year
    const yearlyData = {};

    // Calculate total spending and individual contributions per year
    allExpenses.forEach(exp => {
        const year = exp.fields.Year;
        if (!yearlyData[year]) {
            yearlyData[year] = { spending: 0, amar: 0, priya: 0 };
        }
        yearlyData[year].spending += (exp.fields.Actual || 0);
        yearlyData[year].amar += (exp.fields.AmarContribution || 0);
        yearlyData[year].priya += (exp.fields.PriyaContribution || 0);
    });

    // Add standalone payments (exclude FromExpense to avoid double counting)
    allPayments.forEach(payment => {
        if (!payment.fields.FromExpense) {
            const year = payment.fields.Year;
            if (!yearlyData[year]) {
                yearlyData[year] = { spending: 0, amar: 0, priya: 0 };
            }
            if (payment.fields.Person === 'Amar') {
                yearlyData[year].amar += (payment.fields.Amount || 0);
            } else if (payment.fields.Person === 'Priya') {
                yearlyData[year].priya += (payment.fields.Amount || 0);
            }
        }
    });

    // Calculate percentages for each person
    const years = Object.keys(yearlyData).sort();
    const amarPercentages = years.map(year => {
        const spending = yearlyData[year].spending;
        return spending > 0 ? (yearlyData[year].amar / spending) * 100 : 0;
    });
    const priyaPercentages = years.map(year => {
        const spending = yearlyData[year].spending;
        return spending > 0 ? (yearlyData[year].priya / spending) * 100 : 0;
    });

    if (charts.contributionCoverage) charts.contributionCoverage.destroy();
    charts.contributionCoverage = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Amar',
                    data: amarPercentages,
                    backgroundColor: '#4facfe',
                    borderColor: '#2196f3',
                    borderWidth: 2
                },
                {
                    label: 'Priya',
                    data: priyaPercentages,
                    backgroundColor: '#f093fb',
                    borderColor: '#e91e63',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: function (value, context) {
                        const year = context.chart.data.labels[context.dataIndex];
                        const person = context.dataset.label;
                        const amount = person === 'Amar' ? yearlyData[year].amar : yearlyData[year].priya;
                        return value.toFixed(1) + '%\n$' + amount.toFixed(0);
                    },
                    font: {
                        weight: 'bold',
                        size: 11
                    },
                    color: '#374151'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const year = context.label;
                            const person = context.dataset.label;
                            const percentage = context.parsed.y.toFixed(1);
                            const amount = person === 'Amar' ? yearlyData[year].amar : yearlyData[year].priya;
                            const spending = yearlyData[year].spending;
                            return [
                                `${person}: ${percentage}%`,
                                `Amount: $${amount.toFixed(2)}`,
                                `Total Spending: $${spending.toFixed(2)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function (value) {
                            return value + '%';
                        }
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function updateLineChart() {
    const ctx = document.getElementById('lineChart');
    if (!ctx) return;
    const monthlyData = {};
    allExpenses.forEach(exp => {
        const key = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        monthlyData[key] = (monthlyData[key] || 0) + (exp.fields.Actual || 0);
    });
    const sortedMonths = Object.keys(monthlyData).sort();
    const monthlyTotals = sortedMonths.map(m => monthlyData[m]);
    if (charts.line) charts.line.destroy();
    charts.line = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedMonths,
            datasets: [{ label: 'Monthly Spending', data: monthlyTotals, borderColor: '#667eea', backgroundColor: 'rgba(102, 126, 234, 0.1)', tension: 0.4, fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
    if (monthlyTotals.length > 0) {
        const avg = monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length;
        document.getElementById('avgMonthly').textContent = `$${avg.toFixed(2)}`;
        document.getElementById('highestMonth').textContent = `$${Math.max(...monthlyTotals).toFixed(2)}`;
        document.getElementById('lowestMonth').textContent = `$${Math.min(...monthlyTotals).toFixed(2)}`;
        document.getElementById('yearlyTotal').textContent = `$${monthlyTotals.reduce((a, b) => a + b, 0).toFixed(2)}`;
    }
}

function updateYearComparisonChart() {
    const ctx = document.getElementById('yearComparisonChart');
    if (!ctx) return;
    const yearlyData = {};
    allExpenses.forEach(exp => {
        const year = exp.fields.Year;
        const month = exp.fields.Month;
        if (!year || !month) return;
        if (!yearlyData[year]) yearlyData[year] = {};
        if (!yearlyData[year][month]) yearlyData[year][month] = 0;
        yearlyData[year][month] += exp.fields.Actual || 0;
    });
    const years = Object.keys(yearlyData).sort();
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const colors = ['#667eea', '#f5576c', '#4facfe', '#43e97b', '#fa709a'];
    const datasets = years.map((year, i) => ({
        label: year,
        data: months.map(m => yearlyData[year][m] || 0),
        borderColor: colors[i % colors.length],
        tension: 0.4
    }));
    if (charts.yearComparison) charts.yearComparison.destroy();
    charts.yearComparison = new Chart(ctx, {
        type: 'line',
        data: { labels: monthNames, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

function updateInsights() {
    updateTrendIndicator();
    updateBudgetAlerts();
    updateTopCategories();
    updateRecommendations();
    updateContributionTrendChart();
}

function updateTrendIndicator() {
    const container = document.getElementById('trendIndicator');
    if (!container) return;
    const monthlyData = {};
    allExpenses.forEach(exp => {
        const key = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        monthlyData[key] = (monthlyData[key] || 0) + (exp.fields.Actual || 0);
    });
    const sortedMonths = Object.keys(monthlyData).sort();
    if (sortedMonths.length < 6) {
        container.innerHTML = '<p class="text-gray-500">Not enough data</p>';
        return;
    }
    const recent = sortedMonths.slice(-3).map(m => monthlyData[m]);
    const older = sortedMonths.slice(-6, -3).map(m => monthlyData[m]);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
    const change = ((avgRecent - avgOlder) / avgOlder) * 100;
    let icon, color, text, message;
    if (change > 5) {
        icon = 'fa-arrow-trend-up';
        color = 'text-red-500';
        text = 'Spending is Increasing';
        message = `Your spending increased by ${change.toFixed(1)}%`;
    } else if (change < -5) {
        icon = 'fa-arrow-trend-down';
        color = 'text-green-500';
        text = 'Spending is Decreasing';
        message = `Great! Spending decreased by ${Math.abs(change).toFixed(1)}%`;
    } else {
        icon = 'fa-minus';
        color = 'text-blue-500';
        text = 'Spending is Stable';
        message = 'Your spending is stable';
    }
    container.innerHTML = `<i class="fas ${icon} ${color} text-6xl mb-4"></i><h4 class="text-2xl font-bold ${color} mb-2">${text}</h4><p class="text-gray-600">${message}</p>`;
}

function updateBudgetAlerts() {
    const container = document.getElementById('budgetAlerts');
    if (!container) return;
    const expenses = getFilteredExpenses();
    const categoryData = {};
    expenses.forEach(exp => {
        const item = exp.fields.Item || 'Other';
        if (!categoryData[item]) categoryData[item] = { budget: 0, actual: 0 };
        categoryData[item].budget += exp.fields.Budget || 0;
        categoryData[item].actual += exp.fields.Actual || 0;
    });
    const alerts = [];
    Object.keys(categoryData).forEach(item => {
        const { budget, actual } = categoryData[item];
        const util = budget > 0 ? (actual / budget) * 100 : 0;
        if (util > 100) alerts.push(`<div class="p-3 bg-red-50 border-l-4 border-red-500 rounded"><i class="fas fa-exclamation-circle text-red-500 mr-2"></i><strong>${item}</strong> is over budget by $${(actual - budget).toFixed(2)}</div>`);
        else if (util > 90) alerts.push(`<div class="p-3 bg-orange-50 border-l-4 border-orange-500 rounded"><i class="fas fa-exclamation-triangle text-orange-500 mr-2"></i><strong>${item}</strong> is at ${util.toFixed(0)}% of budget</div>`);
    });
    container.innerHTML = alerts.length ? alerts.join('') : '<p class="text-green-600"><i class="fas fa-check-circle mr-2"></i>All within budget!</p>';
}

function updateTopCategories() {
    const container = document.getElementById('topCategories');
    if (!container) return;
    const expenses = getFilteredExpenses();
    const categoryData = {};
    expenses.forEach(exp => {
        const item = exp.fields.Item || 'Other';
        categoryData[item] = (categoryData[item] || 0) + (exp.fields.Actual || 0);
    });
    const sorted = Object.entries(categoryData).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = Object.values(categoryData).reduce((a, b) => a + b, 0);
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    container.innerHTML = sorted.map(([item, amount], i) => {
        const pct = total > 0 ? (amount / total) * 100 : 0;
        return `<div class="flex items-center justify-between p-3 border-b"><div class="flex items-center gap-3"><span class="text-2xl">${medals[i]}</span><div><div class="font-semibold">${item}</div><div class="text-sm text-gray-500">${pct.toFixed(1)}%</div></div></div><div class="text-lg font-bold text-purple-600">$${amount.toFixed(2)}</div></div>`;
    }).join('');
}

function updateRecommendations() {
    const container = document.getElementById('recommendations');
    if (!container) return;
    const expenses = getFilteredExpenses();
    const totalBudget = expenses.reduce((sum, exp) => sum + (exp.fields.Budget || 0), 0);
    const totalActual = expenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const llcTotal = expenses.filter(exp => exp.fields.LLC === 'Yes').reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const recs = [];
    if (totalActual > totalBudget) {
        recs.push(`<div class="p-4 bg-red-50 border-l-4 border-red-500 rounded"><i class="fas fa-chart-line text-red-500 mr-2"></i><strong>Reduce Spending</strong><p class="text-sm mt-1">Over budget by $${(totalActual - totalBudget).toFixed(2)}</p></div>`);
    } else {
        recs.push(`<div class="p-4 bg-green-50 border-l-4 border-green-500 rounded"><i class="fas fa-thumbs-up text-green-500 mr-2"></i><strong>Great Job!</strong><p class="text-sm mt-1">Under budget with $${(totalBudget - totalActual).toFixed(2)} remaining</p></div>`);
    }
    const llcPct = totalActual > 0 ? (llcTotal / totalActual) * 100 : 0;
    if (llcPct < 30) {
        recs.push(`<div class="p-4 bg-blue-50 border-l-4 border-blue-500 rounded"><i class="fas fa-building text-blue-500 mr-2"></i><strong>Maximize LLC</strong><p class="text-sm mt-1">Only ${llcPct.toFixed(0)}% through LLC. Review business expenses.</p></div>`);
    }
    container.innerHTML = recs.join('');
}

function updateContributionTrendChart() {
    const ctx = document.getElementById('contributionTrendChart');
    if (!ctx) return;

    // Group contributions by month (from expenses) with mortgage separation
    const monthlyData = {};
    allExpenses.forEach(exp => {
        const key = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        if (!monthlyData[key]) {
            monthlyData[key] = {
                amarMortgage: 0,
                amarNonMortgage: 0,
                priya: 0,
                amarShare: 0,
                priyaShare: 0,
                rentalIncome: 0
            };
        }

        // Separate Amar's mortgage from non-mortgage contributions
        if (exp.fields.Category === 'Mortgage') {
            monthlyData[key].amarMortgage += (exp.fields.AmarContribution || 0);
        } else {
            monthlyData[key].amarNonMortgage += (exp.fields.AmarContribution || 0);
        }

        monthlyData[key].priya += (exp.fields.PriyaContribution || 0);
        monthlyData[key].amarShare += (exp.fields.Actual || 0) / 2;
        monthlyData[key].priyaShare += (exp.fields.Actual || 0) / 2;
    });

    // Add standalone payments only (exclude payments from expenses to avoid double-counting)
    allPayments.forEach(payment => {
        const key = `${payment.fields.Year}-${String(payment.fields.Month).padStart(2, '0')}`;

        // Skip rental income payments - they don't count as contributions
        if (payment.fields.PaymentType === 'RentalIncome') {
            if (!monthlyData[key]) {
                monthlyData[key] = {
                    amarMortgage: 0,
                    amarNonMortgage: 0,
                    priya: 0,
                    amarShare: 0,
                    priyaShare: 0,
                    rentalIncome: 0
                };
            }
            monthlyData[key].rentalIncome += (payment.fields.Amount || 0);
            return;
        }

        // Skip payments that are from expenses (already counted above)
        if (payment.fields.FromExpense) return;

        if (!monthlyData[key]) {
            monthlyData[key] = {
                amarMortgage: 0,
                amarNonMortgage: 0,
                priya: 0,
                amarShare: 0,
                priyaShare: 0,
                rentalIncome: 0
            };
        }

        // Add regular standalone payments
        if (payment.fields.Person === 'Amar') {
            monthlyData[key].amarNonMortgage += (payment.fields.Amount || 0);
        } else if (payment.fields.Person === 'Priya' && payment.fields.PaymentType !== 'PriyaMortgageContribution') {
            monthlyData[key].priya += (payment.fields.Amount || 0);
        }
        // Priya's mortgage contributions will be handled in adjustment below
    });

    // Apply mortgage adjustments for each month
    Object.keys(monthlyData).forEach(key => {
        const [year, month] = key.split('-');
        const priyaMortgageContribs = allPayments
            .filter(p =>
                String(p.fields.Year) === year &&
                String(p.fields.Month).padStart(2, '0') === month &&
                p.fields.Person === 'Priya' &&
                p.fields.PaymentType === 'PriyaMortgageContribution'
            )
            .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

        // Adjust Amar's mortgage contribution and add to Priya's total
        const amarAdjustedMortgage = Math.max(0, monthlyData[key].amarMortgage - priyaMortgageContribs);
        monthlyData[key].amar = monthlyData[key].amarNonMortgage + amarAdjustedMortgage;
        monthlyData[key].priya += priyaMortgageContribs;
    });

    const sortedMonths = Object.keys(monthlyData).sort().slice(-12); // Last 12 months
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    });

    const amarContribData = sortedMonths.map(m => monthlyData[m].amar);
    const priyaContribData = sortedMonths.map(m => monthlyData[m].priya);

    // Calculate target shares (full spending, not reduced by rental income)
    // Rental income reduces remaining balance but not the target
    const amarShareData = sortedMonths.map(m => {
        const data = monthlyData[m];
        const totalSpending = data.amarShare + data.priyaShare;
        return totalSpending / 2;
    });
    const priyaShareData = sortedMonths.map(m => {
        const data = monthlyData[m];
        const totalSpending = data.amarShare + data.priyaShare;
        return totalSpending / 2;
    });

    if (charts.contributionTrend) charts.contributionTrend.destroy();
    charts.contributionTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Amar\'s Contribution',
                    data: amarContribData,
                    borderColor: '#4facfe',
                    backgroundColor: 'rgba(79, 172, 254, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Priya\'s Contribution',
                    data: priyaContribData,
                    borderColor: '#f093fb',
                    backgroundColor: 'rgba(240, 147, 251, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Amar\'s Share (Target)',
                    data: amarShareData,
                    borderColor: '#4facfe',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.4,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Priya\'s Share (Target)',
                    data: priyaShareData,
                    borderColor: '#f093fb',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.4,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                }
            }
        }
    });
}

function populateCategorySelector() {
    const selector = document.getElementById('categorySelector');
    if (!selector) return;
    selector.innerHTML = '<option value="">Choose a category...</option>';

    // Use Map to handle case-insensitive uniqueness while preserving original case
    const categoryMap = new Map();
    allExpenses.forEach(exp => {
        if (exp.fields.Category) {
            const cat = exp.fields.Category.trim();
            const catLower = cat.toLowerCase();
            // Keep the first occurrence's case
            if (!categoryMap.has(catLower)) {
                categoryMap.set(catLower, cat);
            }
        }
    });

    // Sort categories alphabetically
    const categories = [...categoryMap.values()].sort();
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        selector.appendChild(option);
    });
}

function suggestCategoryFromItem() {
    const itemInput = document.getElementById('itemName');
    const categoryInput = document.getElementById('category');
    const tagsInput = document.getElementById('tags');
    const llcSelect = document.getElementById('llc');
    const itemName = itemInput.value.trim().toLowerCase();

    // Clear auto-filled fields and hints if item name is cleared or too short
    if (itemName.length < 3) {
        if (categoryInput.dataset.autoFilled === 'true') {
            categoryInput.value = '';
            categoryInput.dataset.autoFilled = 'false';
            categoryInput.classList.remove('input-autofill-exact', 'input-autofill-fuzzy');
            const existingHint = document.getElementById('categoryHint');
            if (existingHint) existingHint.remove();
        }
        if (tagsInput && tagsInput.dataset.autoFilled === 'true') {
            tagsInput.value = '';
            tagsInput.dataset.autoFilled = 'false';
            tagsInput.classList.remove('input-autofill-exact', 'input-autofill-fuzzy');
            const existingHint = document.getElementById('tagsHint');
            if (existingHint) existingHint.remove();
        }
        if (llcSelect && llcSelect.dataset.autoFilled === 'true') {
            llcSelect.value = 'No';
            llcSelect.dataset.autoFilled = 'false';
            updateLLCButtonStyle('No');
            const existingHint = document.getElementById('llcHint');
            if (existingHint) existingHint.remove();
        }
        return;
    }

    // If category was auto-filled but item changed, clear all auto-filled fields
    if (categoryInput.dataset.autoFilled === 'true' && categoryInput.dataset.lastItem !== itemName) {
        categoryInput.value = '';
        categoryInput.dataset.autoFilled = 'false';
        categoryInput.classList.remove('input-autofill-exact', 'input-autofill-fuzzy');
        const existingHint = document.getElementById('categoryHint');
        if (existingHint) existingHint.remove();
        
        // Also clear tags and LLC if they were auto-filled
        if (tagsInput && tagsInput.dataset.autoFilled === 'true') {
            tagsInput.value = '';
            tagsInput.dataset.autoFilled = 'false';
            tagsInput.classList.remove('input-autofill-exact', 'input-autofill-fuzzy');
            const tagsHint = document.getElementById('tagsHint');
            if (tagsHint) tagsHint.remove();
        }
        if (llcSelect && llcSelect.dataset.autoFilled === 'true') {
            llcSelect.value = 'No';
            llcSelect.dataset.autoFilled = 'false';
            updateLLCButtonStyle('No');
            const llcHint = document.getElementById('llcHint');
            if (llcHint) llcHint.remove();
        }
    }

    // Build item-based frequency maps from historical data
    const itemCategoryMap = {};
    const itemTagsMap = {};
    const itemLLCMap = {};

    allExpenses.forEach(exp => {
        if (exp.fields.Item) {
            const item = exp.fields.Item.trim().toLowerCase();
            
            // Category mapping
            if (exp.fields.Category) {
                const category = exp.fields.Category.trim();
                if (!itemCategoryMap[item]) itemCategoryMap[item] = {};
                if (!itemCategoryMap[item][category]) itemCategoryMap[item][category] = 0;
                itemCategoryMap[item][category]++;
            }
            
            // Tags mapping
            if (exp.fields.Tags) {
                if (!itemTagsMap[item]) itemTagsMap[item] = {};
                exp.fields.Tags.split(',').forEach(tag => {
                    const trimmedTag = tag.trim();
                    if (trimmedTag) {
                        if (!itemTagsMap[item][trimmedTag]) itemTagsMap[item][trimmedTag] = 0;
                        itemTagsMap[item][trimmedTag]++;
                    }
                });
            }
            
            // LLC mapping
            const llcValue = exp.fields.LLC === 'Yes' || exp.fields.LLC === true ? 'Yes' : 'No';
            if (!itemLLCMap[item]) itemLLCMap[item] = { Yes: 0, No: 0 };
            itemLLCMap[item][llcValue]++;
        }
    });

    // Check for exact match first
    if (itemCategoryMap[itemName]) {
        const categories = itemCategoryMap[itemName];
        const totalCount = Object.values(categories).reduce((sum, count) => sum + count, 0);

        // Find the most common category
        let maxCount = 0;
        let suggestedCategory = null;

        for (const [category, count] of Object.entries(categories)) {
            if (count > maxCount) {
                maxCount = count;
                suggestedCategory = category;
            }
        }

        // Calculate confidence percentage
        const confidence = (maxCount / totalCount) * 100;

        // Only suggest if confidence >= 90%
        if (confidence >= 90 && suggestedCategory) {
            // Check if category field is empty or user hasn't manually changed it
            const currentCategory = categoryInput.value.trim();
            if (!currentCategory || categoryInput.dataset.autoFilled === 'true') {
                categoryInput.value = suggestedCategory;
                categoryInput.dataset.autoFilled = 'true';
                categoryInput.dataset.lastItem = itemName; // Store the item that triggered this

                // Show visual feedback
                categoryInput.classList.add('input-autofill-exact');

                // Add tooltip/hint
                const existingHint = document.getElementById('categoryHint');
                if (existingHint) existingHint.remove();

                const hint = document.createElement('div');
                hint.id = 'categoryHint';
                hint.className = 'text-xs text-green-600 mt-1 flex items-center gap-1';
                hint.innerHTML = `<i class="fas fa-magic"></i> Auto-suggested based on ${maxCount} previous entries (${Math.round(confidence)}% confidence)`;
                (categoryInput.parentElement?.parentElement || categoryInput.parentElement).appendChild(hint);

                // Remove visual feedback after 3 seconds
                setTimeout(() => {
                    categoryInput.classList.remove('input-autofill-exact');
                }, 3000);
            }
        }
    } else {
        // Try partial match (for similar items)
        for (const [historicalItem, categories] of Object.entries(itemCategoryMap)) {
            if (historicalItem.includes(itemName) || itemName.includes(historicalItem)) {
                const totalCount = Object.values(categories).reduce((sum, count) => sum + count, 0);

                let maxCount = 0;
                let suggestedCategory = null;

                for (const [category, count] of Object.entries(categories)) {
                    if (count > maxCount) {
                        maxCount = count;
                        suggestedCategory = category;
                    }
                }

                const confidence = (maxCount / totalCount) * 100;

                if (confidence >= 90 && suggestedCategory) {
                    const currentCategory = categoryInput.value.trim();
                    if (!currentCategory || categoryInput.dataset.autoFilled === 'true') {
                        categoryInput.value = suggestedCategory;
                        categoryInput.dataset.autoFilled = 'true';
                        categoryInput.dataset.lastItem = itemName; // Store the item that triggered this

                        categoryInput.classList.add('input-autofill-fuzzy');

                        const existingHint = document.getElementById('categoryHint');
                        if (existingHint) existingHint.remove();

                        const hint = document.createElement('div');
                        hint.id = 'categoryHint';
                        hint.className = 'text-xs text-yellow-700 mt-1 flex items-center gap-1';
                        hint.innerHTML = `<i class="fas fa-lightbulb"></i> Suggested based on similar item "${historicalItem}" (${Math.round(confidence)}% confidence)`;
                        (categoryInput.parentElement?.parentElement || categoryInput.parentElement).appendChild(hint);

                        setTimeout(() => {
                            categoryInput.classList.remove('input-autofill-fuzzy');
                        }, 3000);

                        break; // Only suggest once
                    }
                }
            }
        }
    }
    
    // Now suggest Tags based on item history
    suggestTagsFromItem(itemName, itemTagsMap);
    
    // Suggest LLC based on item history
    suggestLLCFromItem(itemName, itemLLCMap);
}

// Helper function to suggest tags based on item
function suggestTagsFromItem(itemName, itemTagsMap) {
    const tagsInput = document.getElementById('tags');
    if (!tagsInput) return;
    
    // Skip if user has manually entered tags
    if (tagsInput.value.trim() && tagsInput.dataset.autoFilled !== 'true') return;
    
    // Try exact match first, then partial match
    let tagsData = itemTagsMap[itemName];
    let matchType = 'exact';
    let matchedItem = itemName;
    
    if (!tagsData) {
        // Try partial match
        for (const [historicalItem, tags] of Object.entries(itemTagsMap)) {
            if (historicalItem.includes(itemName) || itemName.includes(historicalItem)) {
                tagsData = tags;
                matchType = 'partial';
                matchedItem = historicalItem;
                break;
            }
        }
    }
    
    if (!tagsData || Object.keys(tagsData).length === 0) return;
    
    // Sort by frequency and get top 3 tags
    const sortedTags = Object.entries(tagsData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);
    
    if (sortedTags.length === 0) return;
    
    const totalCount = Object.values(tagsData).reduce((sum, count) => sum + count, 0);
    const topTagCount = tagsData[sortedTags[0]];
    const confidence = (topTagCount / totalCount) * 100;
    
    // Only suggest if confidence >= 70% for tags (lower threshold since tags can vary)
    if (confidence >= 70) {
        tagsInput.value = sortedTags.join(', ');
        tagsInput.dataset.autoFilled = 'true';
        tagsInput.classList.remove('input-autofill-exact', 'input-autofill-fuzzy');
        tagsInput.classList.add(matchType === 'exact' ? 'input-autofill-exact' : 'input-autofill-fuzzy');
        
        const existingHint = document.getElementById('tagsHint');
        if (existingHint) existingHint.remove();
        
        const hint = document.createElement('div');
        hint.id = 'tagsHint';
        hint.className = matchType === 'exact' ? 'text-xs text-green-600 mt-1 flex items-center gap-1' : 'text-xs text-yellow-700 mt-1 flex items-center gap-1';
        hint.innerHTML = `<i class="fas fa-magic"></i> Auto-suggested tags (${Math.round(confidence)}% confidence)`;
        tagsInput.parentElement.appendChild(hint);
        
        setTimeout(() => {
            tagsInput.classList.remove('input-autofill-exact', 'input-autofill-fuzzy');
        }, 3000);
    }
}

// Helper function to suggest LLC based on item
function suggestLLCFromItem(itemName, itemLLCMap) {
    const llcSelect = document.getElementById('llc');
    const llcBtn = document.getElementById('llcToggleBtn');
    if (!llcSelect || !llcBtn) return;
    
    // Skip if user has manually changed LLC
    if (llcSelect.dataset.autoFilled === 'false' && llcSelect.dataset.userChanged === 'true') return;

    const categoryInput = document.getElementById('category');
    const categoryAutoForThisItem = !!(
        categoryInput &&
        categoryInput.dataset.autoFilled === 'true' &&
        categoryInput.dataset.lastItem === itemName
    );
    
    // Try exact match first, then partial match
    let llcData = itemLLCMap[itemName];
    let matchType = 'exact';
    let matchedItem = itemName;
    
    if (!llcData) {
        // Try partial match
        for (const [historicalItem, data] of Object.entries(itemLLCMap)) {
            if (historicalItem.includes(itemName) || itemName.includes(historicalItem)) {
                llcData = data;
                matchType = 'partial';
                matchedItem = historicalItem;
                break;
            }
        }
    }
    
    if (!llcData) return;
    
    const totalCount = llcData.Yes + llcData.No;
    if (totalCount === 0) return;
    
    const yesConfidence = (llcData.Yes / totalCount) * 100;
    const noConfidence = (llcData.No / totalCount) * 100;

    let mostRecentLLC = null;
    let mostRecentTime = -1;
    for (const exp of allExpenses) {
        const expItem = String(exp.fields?.Item || '').trim().toLowerCase();
        if (!expItem) continue;
        if (expItem !== matchedItem) continue;
        const y = Number(exp.fields?.Year || 0);
        const m = Number(exp.fields?.Month || 1);
        const d = Number(exp.fields?.Day || 1);
        const t = new Date(y, m - 1, d).getTime();
        if (t > mostRecentTime) {
            mostRecentTime = t;
            mostRecentLLC = exp.fields?.LLC === 'Yes' || exp.fields?.LLC === true ? 'Yes' : 'No';
        }
    }

    let suggestedLLC = null;
    if (yesConfidence >= 60) {
        suggestedLLC = 'Yes';
    } else if (noConfidence >= 60) {
        suggestedLLC = 'No';
    } else if (categoryAutoForThisItem && mostRecentLLC) {
        suggestedLLC = mostRecentLLC;
    }

    if (!suggestedLLC) return;

    if (suggestedLLC === 'Yes') {
        llcSelect.value = 'Yes';
        llcSelect.dataset.autoFilled = 'true';
        updateLLCButtonStyle('Yes');
        
        const existingHint = document.getElementById('llcHint');
        if (existingHint) existingHint.remove();
        
        const hint = document.createElement('div');
        hint.id = 'llcHint';
        hint.className = 'text-xs text-green-600 mt-1 flex items-center gap-1';
        hint.innerHTML = `<i class="fas fa-magic"></i> Auto-set to LLC (${Math.round(yesConfidence)}% confidence)`;
        llcBtn.parentElement.appendChild(hint);
        
        setTimeout(() => {
            const h = document.getElementById('llcHint');
            if (h) h.remove();
        }, 5000);
    } else {
        llcSelect.value = 'No';
        llcSelect.dataset.autoFilled = 'true';
        updateLLCButtonStyle('No');
    }
}

// Helper to update LLC button style
function updateLLCButtonStyle(value) {
    const llcBtn = document.getElementById('llcToggleBtn');
    if (!llcBtn) return;
    
    if (value === 'Yes') {
        llcBtn.classList.remove('toggle-btn-inactive');
        llcBtn.classList.add('toggle-btn-active-llc');
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Business</span>';
    } else {
        llcBtn.classList.remove('toggle-btn-active-llc');
        llcBtn.classList.add('toggle-btn-inactive');
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Personal</span>';
    }
}

// Clear auto-fill flag when user manually edits category and auto-suggest tags
document.addEventListener('DOMContentLoaded', function () {
    const categoryInput = document.getElementById('category');
    if (categoryInput) {
        categoryInput.addEventListener('input', function () {
            if (this.dataset.autoFilled === 'true') {
                this.dataset.autoFilled = 'false';
            }
        });

        // Auto-suggest tags when category changes (on blur or when selecting from datalist)
        categoryInput.addEventListener('change', function () {
            autoSuggestTagsForCategory(this.value);
        });

        // Also trigger on blur in case user types manually
        categoryInput.addEventListener('blur', function () {
            if (this.value.trim()) {
                autoSuggestTagsForCategory(this.value);
            }
        });
    }
});

function populateCategoryDatalist() {
    const datalist = document.getElementById('categoryList');
    if (!datalist) return;

    // Clear existing options completely
    while (datalist.firstChild) {
        datalist.removeChild(datalist.firstChild);
    }

    // Get unique categories (case-insensitive)
    const categoryMap = new Map();
    allExpenses.forEach(exp => {
        if (exp.fields.Category) {
            const cat = exp.fields.Category.trim();
            const catLower = cat.toLowerCase();
            // Keep the first occurrence's case
            if (cat && !categoryMap.has(catLower)) {
                categoryMap.set(catLower, cat);
            }
        }
    });

    // Sort and add to datalist
    [...categoryMap.values()].sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        datalist.appendChild(option);
    });
}

function populateItemDatalist() {
    const datalist = document.getElementById('itemList');
    if (!datalist) return;

    // Clear existing options completely
    while (datalist.firstChild) {
        datalist.removeChild(datalist.firstChild);
    }

    // Get unique items (case-sensitive)
    const itemMap = new Map();
    allExpenses.forEach(exp => {
        if (exp.fields.Item) {
            const item = exp.fields.Item.trim();
            if (item && !itemMap.has(item)) {
                itemMap.set(item, true);
            }
        }
    });

    // Sort and add to datalist
    [...itemMap.keys()].sort().forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        datalist.appendChild(option);
    });
}

function populateTagsDatalist() {
    const datalist = document.getElementById('tagsList');
    if (!datalist) return;

    // Clear existing options completely
    while (datalist.firstChild) {
        datalist.removeChild(datalist.firstChild);
    }

    // Collect all unique tags from all expenses
    const tagMap = new Map();
    allExpenses.forEach(exp => {
        if (exp.fields.Tags) {
            exp.fields.Tags.split(',').forEach(tag => {
                const trimmed = tag.trim();
                if (trimmed && !tagMap.has(trimmed)) {
                    tagMap.set(trimmed, true);
                }
            });
        }
    });

    // Sort and add to datalist
    [...tagMap.keys()].sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        datalist.appendChild(option);
    });
}

function autoSuggestTagsForCategory(category) {
    if (!category || !category.trim()) return;

    const categoryLower = category.toLowerCase().trim();

    // Find all expenses with this category
    const categoryExpenses = allExpenses.filter(exp =>
        exp.fields.Category && exp.fields.Category.toLowerCase().trim() === categoryLower
    );

    if (categoryExpenses.length === 0) return;

    // Count tag frequency for this category
    const tagFrequency = new Map();
    categoryExpenses.forEach(exp => {
        if (exp.fields.Tags) {
            exp.fields.Tags.split(',').forEach(tag => {
                const trimmed = tag.trim();
                if (trimmed) {
                    tagFrequency.set(trimmed, (tagFrequency.get(trimmed) || 0) + 1);
                }
            });
        }
    });

    if (tagFrequency.size === 0) return;

    // Sort tags by frequency (most common first)
    const sortedTags = [...tagFrequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

    // Auto-fill with the most common tags (up to 3)
    const tagsInput = document.getElementById('tags');
    if (tagsInput && !tagsInput.value.trim()) {
        const suggestedTags = sortedTags.slice(0, 3).join(', ');
        tagsInput.value = suggestedTags;
        console.log('Auto-suggested tags for category "' + category + '":', suggestedTags);
    }
}

function updateCategoryAnalysis() {
    const selectedCategory = document.getElementById('categorySelector').value;
    if (!selectedCategory) {
        document.getElementById('categoryStats').style.display = 'none';
        document.getElementById('categoryChartContainer').style.display = 'none';
        return;
    }
    const categoryExpenses = allExpenses.filter(exp => exp.fields.Category === selectedCategory);
    const total = categoryExpenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const count = categoryExpenses.length;
    const monthlyData = {};
    categoryExpenses.forEach(exp => {
        const key = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        if (!monthlyData[key]) monthlyData[key] = 0;
        monthlyData[key] += exp.fields.Actual || 0;
    });
    const avg = Object.keys(monthlyData).length > 0 ? total / Object.keys(monthlyData).length : 0;
    document.getElementById('categoryTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('categoryAvg').textContent = `$${avg.toFixed(2)}`;
    document.getElementById('categoryCount').textContent = count;
    document.getElementById('categoryStats').style.display = 'grid';
    document.getElementById('categoryChartContainer').style.display = 'block';
    updateCategoryTrendChart(selectedCategory, monthlyData);
    updateCategoryDetails(categoryExpenses);
}

function updateCategoryTrendChart(category, monthlyData) {
    const ctx = document.getElementById('categoryTrendChart');
    if (!ctx) return;
    const sortedMonths = Object.keys(monthlyData).sort();
    const monthlyTotals = sortedMonths.map(m => monthlyData[m]);
    if (charts.categoryTrend) charts.categoryTrend.destroy();
    charts.categoryTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedMonths,
            datasets: [{
                label: `${category} - Monthly Spending`,
                data: monthlyTotals,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Spending: $${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: value => '$' + value.toFixed(0) } }
            }
        }
    });
}

function updateCategoryDetails(expenses) {
    const container = document.getElementById('categoryDetails');
    if (!container) return;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const sortedExpenses = expenses.sort((a, b) => {
        const aKey = `${a.fields.Year}-${String(a.fields.Month).padStart(2, '0')}`;
        const bKey = `${b.fields.Year}-${String(b.fields.Month).padStart(2, '0')}`;
        return bKey.localeCompare(aKey);
    });
    container.innerHTML = `
                 <div class="overflow-x-auto">
                     <table class="w-full">
                         <thead class="bg-gradient-to-r from-purple-100 to-blue-100">
                             <tr>
                                 <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Item</th>
                                 <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Year</th>
                                 <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Month</th>
                                 <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                                 <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tags</th>
                                 <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">LLC</th>
                             </tr>
                         </thead>
                         <tbody>
                             ${sortedExpenses.map(exp => {
        const budget = exp.fields.Budget || 0;
        const actual = exp.fields.Actual || 0;
        const monthDisplay = exp.fields.Month ? monthNames[parseInt(exp.fields.Month) - 1] : 'N/A';
        const itemName = exp.fields.Item || 'Unnamed';
        const tags = exp.fields.Tags || '';

        // Determine actual amount color based on budget comparison
        let actualColorClass = 'text-gray-700';
        if (actual > budget) {
            actualColorClass = 'text-red-600';
        } else if (actual < budget) {
            actualColorClass = 'text-green-600';
        }

        // Tags display for table
        let tagsCell = '';
        if (tags.trim()) {
            const tagList = tags.split(',').slice(0, 2).map(tag =>
                `<span class="inline-block px-2 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-full text-xs font-medium mr-1"><i class="fas fa-tag mr-1"></i>${tag.trim()}</span>`
            ).join('');
            tagsCell = tagList;
        } else {
            tagsCell = `<span class="text-gray-400 text-xs">No tags</span>`;
        }

        return `
                                    <tr class="border-b hover:bg-purple-50 cursor-pointer transition-colors" 
                                        onclick="viewExpenseDetails('${exp.id}')" 
                                        style="cursor: pointer;">
                                        <td class="px-4 py-3 text-sm font-semibold text-gray-800">${itemName}</td>
                                        <td class="px-4 py-3 text-sm">${exp.fields.Year || 'N/A'}</td>
                                        <td class="px-4 py-3 text-sm">${monthDisplay}</td>
                                        <td class="px-4 py-3 text-sm font-bold text-lg ${actualColorClass}">$${actual.toFixed(2)}</td>
                                        <td class="px-4 py-3 text-sm">${tagsCell}</td>
                                        <td class="px-4 py-3 text-sm"><span class="badge ${exp.fields.LLC === 'Yes' ? 'badge-llc' : 'badge-personal'}">${exp.fields.LLC || 'No'}</span></td>
                                    </tr>
                                `;
    }).join('')}
                         </tbody>
                     </table>
                 </div>
             `;
}

// ===== FILTERS TAB FUNCTIONS =====

// Custom Dropdown Functions
function toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const content = dropdown.querySelector('.custom-dropdown-content');
    const button = dropdown.querySelector('.custom-dropdown-button');

    // Close all other dropdowns
    document.querySelectorAll('.custom-dropdown-content').forEach(d => {
        if (d !== content) {
            d.classList.remove('show');
            d.parentElement.querySelector('.custom-dropdown-button').classList.remove('active');
        }
    });

    // Toggle current dropdown
    content.classList.toggle('show');
    button.classList.toggle('active');
}

// Close dropdowns when clicking outside
document.addEventListener('click', function (event) {
    if (!event.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.custom-dropdown-content').forEach(content => {
            content.classList.remove('show');
            content.parentElement.querySelector('.custom-dropdown-button').classList.remove('active');
        });
    }
});

function updateMonthSelection() {
    const checkboxes = document.querySelectorAll('#monthDropdownContent input[type="checkbox"]');
    const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    const textElement = document.getElementById('monthDropdownText');

    if (selected.length === 0) {
        textElement.innerHTML = '<span class="custom-dropdown-placeholder">Select months...</span>';
    } else {
        const monthNames = {
            '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
            '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
            '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
        };
        const displayText = selected.map(m => monthNames[m]).join(', ');
        textElement.innerHTML = `<span class="custom-dropdown-selected">${displayText}</span> <span class="custom-dropdown-count">${selected.length}</span>`;
    }

    updateFilteredView();
}

function updateCategorySelection() {
    const checkboxes = document.querySelectorAll('#categoryDropdownContent input[type="checkbox"]');
    const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    const textElement = document.getElementById('categoryDropdownText');

    if (selected.length === 0) {
        textElement.innerHTML = '<span class="custom-dropdown-placeholder">Select categories...</span>';
    } else if (selected.length <= 2) {
        textElement.innerHTML = `<span class="custom-dropdown-selected">${selected.join(', ')}</span> <span class="custom-dropdown-count">${selected.length}</span>`;
    } else {
        textElement.innerHTML = `<span class="custom-dropdown-selected">${selected[0]}, ${selected[1]}</span> <span class="custom-dropdown-count">+${selected.length - 2}</span>`;
    }

    // Update tags based on selected categories
    updateTagsForSelectedCheckboxCategories(selected);

    updateFilteredView();
}

function updateTagSelection() {
    const checkboxes = document.querySelectorAll('#tagDropdownContent input[type="checkbox"]');
    const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    const textElement = document.getElementById('tagDropdownText');

    if (selected.length === 0) {
        textElement.innerHTML = '<span class="custom-dropdown-placeholder">Select tags...</span>';
    } else if (selected.length <= 2) {
        textElement.innerHTML = `<span class="custom-dropdown-selected">${selected.join(', ')}</span> <span class="custom-dropdown-count">${selected.length}</span>`;
    } else {
        textElement.innerHTML = `<span class="custom-dropdown-selected">${selected[0]}, ${selected[1]}</span> <span class="custom-dropdown-count">+${selected.length - 2}</span>`;
    }

    updateFilteredView();
}

function getSelectedMonths() {
    const checkboxes = document.querySelectorAll('#monthDropdownContent input[type="checkbox"]');
    return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
}

function getSelectedCategories() {
    const checkboxes = document.querySelectorAll('#categoryDropdownContent input[type="checkbox"]');
    return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
}

function getSelectedTags() {
    const checkboxes = document.querySelectorAll('#tagDropdownContent input[type="checkbox"]');
    return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
}

function populateFilterDropdowns() {
    // Populate years
    const yearSelect = document.getElementById('filterYear');
    const allYears = [...new Set(allExpenses.map(exp => exp.fields.Year).filter(y => y))].sort().reverse();

    if (yearSelect) {
        yearSelect.innerHTML = '<option value="">All Years</option>';
        allYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    }

    // Populate categories (custom checkbox dropdown)
    const categoryContent = document.getElementById('categoryDropdownContent');
    const allCategories = [...new Set(allExpenses.map(exp => exp.fields.Category).filter(c => c))].sort();

    if (categoryContent) {
        categoryContent.innerHTML = '';
        allCategories.forEach(cat => {
            const id = `category_${cat.replace(/\s+/g, '_')}`;
            const item = document.createElement('div');
            item.className = 'custom-dropdown-item';
            item.onclick = (e) => e.stopPropagation();
            item.innerHTML = `
                         <input type="checkbox" id="${id}" value="${cat}" onchange="updateCategorySelection()">
                         <label for="${id}">${cat}</label>
                     `;
            categoryContent.appendChild(item);
        });
        console.log('Categories populated:', allCategories.length, 'categories');
    }

    // Populate all tags initially
    populateAllCheckboxTags();
}

function populateAllTags() {
    try {
        const tagSelect = document.getElementById('filterTag');
        if (!tagSelect) {
            console.error('filterTag element not found');
            return;
        }

        const allTagsSet = new Set();

        if (allExpenses && Array.isArray(allExpenses)) {
            allExpenses.forEach(exp => {
                if (exp.fields && exp.fields.Tags) {
                    const tags = exp.fields.Tags.split(',').map(t => t.trim()).filter(t => t);
                    tags.forEach(tag => allTagsSet.add(tag));
                }
            });
        }

        const allTags = [...allTagsSet].sort();
        tagSelect.innerHTML = ''; // No "All" option for multi-select
        allTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagSelect.appendChild(option);
        });
        console.log('Tags populated:', allTags.length, 'tags');
    } catch (error) {
        console.error('Error populating tags:', error);
    }
}

function updateTagsForCategory(category) {
    const tagSelect = document.getElementById('filterTag');
    const currentTag = tagSelect.value; // Preserve current selection if possible

    if (!category) {
        // No category selected, show all tags
        populateAllTags();
        if (currentTag) {
            tagSelect.value = currentTag;
        }
        return;
    }

    // Get tags only for selected category
    const categoryTagsSet = new Set();
    allExpenses.forEach(exp => {
        if (exp.fields.Category === category && exp.fields.Tags) {
            const tags = exp.fields.Tags.split(',').map(t => t.trim()).filter(t => t);
            tags.forEach(tag => categoryTagsSet.add(tag));
        }
    });

    const categoryTags = [...categoryTagsSet].sort();
    tagSelect.innerHTML = '<option value="">All Tags</option>';

    if (categoryTags.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No tags for this category";
        option.disabled = true;
        tagSelect.appendChild(option);
    } else {
        categoryTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagSelect.appendChild(option);
        });

        // Try to preserve selection if tag exists in filtered list
        if (currentTag && categoryTags.includes(currentTag)) {
            tagSelect.value = currentTag;
        }
    }
}

function populateAllCheckboxTags() {
    try {
        const tagContent = document.getElementById('tagDropdownContent');
        if (!tagContent) {
            console.error('tagDropdownContent element not found');
            return;
        }

        const allTagsSet = new Set();

        if (allExpenses && Array.isArray(allExpenses)) {
            allExpenses.forEach(exp => {
                if (exp.fields && exp.fields.Tags) {
                    const tags = exp.fields.Tags.split(',').map(t => t.trim()).filter(t => t);
                    tags.forEach(tag => allTagsSet.add(tag));
                }
            });
        }

        const allTags = [...allTagsSet].sort();
        tagContent.innerHTML = '';
        allTags.forEach(tag => {
            const id = `tag_${tag.replace(/\s+/g, '_')}`;
            const item = document.createElement('div');
            item.className = 'custom-dropdown-item';
            item.onclick = (e) => e.stopPropagation();
            item.innerHTML = `
                         <input type="checkbox" id="${id}" value="${tag}" onchange="updateTagSelection()">
                         <label for="${id}">${tag}</label>
                     `;
            tagContent.appendChild(item);
        });
        console.log('Tags populated:', allTags.length, 'tags');
    } catch (error) {
        console.error('Error populating tags:', error);
    }
}

function updateTagsForSelectedCheckboxCategories(categories) {
    const tagContent = document.getElementById('tagDropdownContent');
    if (!tagContent) return;

    // Save currently selected tags
    const currentSelections = getSelectedTags();

    if (!categories || categories.length === 0) {
        // No categories selected, show all tags
        populateAllCheckboxTags();
        // Restore selections
        setTimeout(() => {
            currentSelections.forEach(tag => {
                const checkbox = document.querySelector(`#tagDropdownContent input[value="${tag}"]`);
                if (checkbox) checkbox.checked = true;
            });
            updateTagSelection();
        }, 0);
        return;
    }

    // Get tags for ALL selected categories
    const categoryTagsSet = new Set();
    allExpenses.forEach(exp => {
        if (categories.includes(exp.fields.Category) && exp.fields.Tags) {
            const tags = exp.fields.Tags.split(',').map(t => t.trim()).filter(t => t);
            tags.forEach(tag => categoryTagsSet.add(tag));
        }
    });

    const categoryTags = [...categoryTagsSet].sort();
    tagContent.innerHTML = '';

    if (categoryTags.length === 0) {
        const item = document.createElement('div');
        item.className = 'custom-dropdown-item';
        item.innerHTML = '<span class="text-gray-400 text-sm">No tags for selected categories</span>';
        tagContent.appendChild(item);
    } else {
        categoryTags.forEach(tag => {
            const id = `tag_${tag.replace(/\s+/g, '_')}`;
            const item = document.createElement('div');
            item.className = 'custom-dropdown-item';
            item.onclick = (e) => e.stopPropagation();
            const isSelected = currentSelections.includes(tag);
            item.innerHTML = `
                         <input type="checkbox" id="${id}" value="${tag}" ${isSelected ? 'checked' : ''} onchange="updateTagSelection()">
                         <label for="${id}">${tag}</label>
                     `;
            tagContent.appendChild(item);
        });
        updateTagSelection();
    }

    console.log('🏷️ Tags updated for categories:', categories, '→', categoryTags.length, 'tags');
}

function updateTagsForSelectedCategories(categories) {
    const tagSelect = document.getElementById('filterTag');
    if (!tagSelect) return;

    // Save currently selected tags
    const currentSelections = Array.from(tagSelect.selectedOptions).map(o => o.value);

    if (!categories || categories.length === 0) {
        // No categories selected, show all tags
        populateAllTags();
        // Restore selections
        currentSelections.forEach(tag => {
            const option = Array.from(tagSelect.options).find(o => o.value === tag);
            if (option) option.selected = true;
        });
        return;
    }

    // Get tags for ALL selected categories
    const categoryTagsSet = new Set();
    allExpenses.forEach(exp => {
        if (categories.includes(exp.fields.Category) && exp.fields.Tags) {
            const tags = exp.fields.Tags.split(',').map(t => t.trim()).filter(t => t);
            tags.forEach(tag => categoryTagsSet.add(tag));
        }
    });

    const categoryTags = [...categoryTagsSet].sort();
    tagSelect.innerHTML = ''; // No "All" option for multi-select

    if (categoryTags.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No tags for selected categories";
        option.disabled = true;
        tagSelect.appendChild(option);
    } else {
        categoryTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            // Restore selection if tag was previously selected
            if (currentSelections.includes(tag)) {
                option.selected = true;
            }
            tagSelect.appendChild(option);
        });
    }

    console.log('🏷️ Tags updated for categories:', categories, '→', categoryTags.length, 'tags');
}

function updateFilteredView() {
    const year = document.getElementById('filterYear')?.value || '';
    const llcFilter = document.getElementById('filterLLC')?.value || '';
    const contributor = document.getElementById('filterContributor')?.value || '';

    // Get multi-select values from checkboxes
    const selectedMonths = getSelectedMonths();
    const selectedCategories = getSelectedCategories();
    const selectedTags = getSelectedTags();

    console.log('🔍 Filter values:', {
        year,
        months: selectedMonths,
        categories: selectedCategories,
        tags: selectedTags,
        llc: llcFilter,
        contributor
    });

    // Filter expenses
    let filtered = allExpenses.filter(exp => {
        // Year filter
        if (year && exp.fields.Year !== parseInt(year)) return false;

        // LLC filter
        if (llcFilter) {
            const isLLC = exp.fields.LLC === 'Yes' || exp.fields.LLC === true;
            if (llcFilter === 'Yes' && !isLLC) return false;
            if (llcFilter === 'No' && isLLC) return false;
        }

        // Month filter - match ANY selected month (OR logic)
        if (selectedMonths.length > 0) {
            if (!selectedMonths.includes(exp.fields.Month)) return false;
        }

        // Category filter - match ANY selected category (OR logic)
        if (selectedCategories.length > 0) {
            if (!selectedCategories.includes(exp.fields.Category)) return false;
        }

        // Tag filter - match ANY selected tag (OR logic)
        if (selectedTags.length > 0) {
            const expTags = exp.fields.Tags ? exp.fields.Tags.split(',').map(t => t.trim()) : [];
            const hasMatchingTag = selectedTags.some(tag => expTags.includes(tag));
            if (!hasMatchingTag) return false;
        }

        // Contributor filter
        if (contributor) {
            const amarContrib = exp.fields.AmarContribution || 0;
            const priyaContrib = exp.fields.PriyaContribution || 0;

            if (contributor === 'Amar' && amarContrib === 0) return false;
            if (contributor === 'Priya' && priyaContrib === 0) return false;
            if (contributor === 'Both' && (amarContrib === 0 || priyaContrib === 0)) return false;
        }

        return true;
    });

    console.log('📊 Filtered results:', filtered.length, 'expenses');

    // Display results
    displayFilteredResults(filtered, {
        year,
        months: selectedMonths,
        categories: selectedCategories,
        tags: selectedTags,
        llc: llcFilter,
        contributor
    });
}

function displayFilteredResults(expenses, filters) {
    const container = document.getElementById('filterResults');

    if (expenses.length === 0) {
        container.innerHTML = `
                     <div class="text-center py-12 text-gray-400">
                         <i class="fas fa-inbox text-6xl mb-4"></i>
                         <p class="text-lg font-semibold">No expenses found</p>
                         <p class="text-sm mt-2">Try adjusting your filters</p>
                     </div>
                 `;
        return;
    }

    // Sort by date (most recent first)
    const sorted = expenses.sort((a, b) => {
        const dateA = new Date(a.fields.Year, a.fields.Month - 1, a.fields.Day || 1);
        const dateB = new Date(b.fields.Year, b.fields.Month - 1, b.fields.Day || 1);
        return dateB - dateA;
    });

    const total = expenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);

    let amarTotal = 0;
    let priyaTotal = 0;
    expenses.forEach(exp => {
        let amarContrib = exp.fields.AmarContribution || 0;
        let priyaContrib = exp.fields.PriyaContribution || 0;
        const category = exp.fields.Category || '';
        const year = exp.fields.Year;
        const month = exp.fields.Month;

        if (category === 'Mortgage' && amarContrib > 0) {
            const expenseYear = String(year);
            const expenseMonth = String(month).padStart(2, '0');

            const priyaMortgagePayments = allPayments
                .filter(p =>
                    p.fields.Person === 'Priya' &&
                    p.fields.PaymentType === 'PriyaMortgageContribution' &&
                    String(p.fields.Year) === expenseYear &&
                    String(p.fields.Month).padStart(2, '0') === expenseMonth
                )
                .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

            if (priyaMortgagePayments > 0) {
                const totalMortgageExpenses = allExpenses
                    .filter(e =>
                        e.fields.Category === 'Mortgage' &&
                        String(e.fields.Year) === expenseYear &&
                        String(e.fields.Month).padStart(2, '0') === expenseMonth
                    )
                    .reduce((sum, e) => sum + (e.fields.AmarContribution || 0), 0);

                const adjustmentRatio = totalMortgageExpenses > 0 ? amarContrib / totalMortgageExpenses : 0;
                const thisExpenseAdjustment = priyaMortgagePayments * adjustmentRatio;

                amarContrib = Math.max(0, amarContrib - thisExpenseAdjustment);
                priyaContrib = priyaContrib + thisExpenseAdjustment;
            }
        }

        amarTotal += amarContrib;
        priyaTotal += priyaContrib;
    });

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Build filter summary
    let filterSummary = [];
    if (filters.year) filterSummary.push(`Year: ${filters.year}`);
    if (filters.months && filters.months.length > 0) {
        const selectedMonthNames = filters.months.map(m => monthNames[parseInt(m) - 1]).join(', ');
        filterSummary.push(`Months: ${selectedMonthNames}`);
    }
    if (filters.categories && filters.categories.length > 0) {
        filterSummary.push(`Categories: ${filters.categories.join(', ')}`);
    }
    if (filters.tags && filters.tags.length > 0) {
        filterSummary.push(`Tags: ${filters.tags.join(', ')}`);
    }
    if (filters.llc === 'Yes') filterSummary.push('LLC: Yes');
    if (filters.llc === 'No') filterSummary.push('LLC: No');
    if (filters.contributor) filterSummary.push(`Contributor: ${filters.contributor}`);

    container.innerHTML = `
                 <div class="mb-6">
                     <div class="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg mb-4">
                         <div class="flex justify-between items-center mb-2">
                             <div>
                                 <div class="text-sm opacity-90">Filtered Results</div>
                                 <div class="text-3xl font-bold">${expenses.length} expense${expenses.length !== 1 ? 's' : ''}</div>
                             </div>
                             <div class="text-right">
                                 <div class="text-sm opacity-90">Total</div>
                                 <div class="text-3xl font-bold">$${total.toFixed(2)}</div>
                             </div>
                         </div>
                         ${filterSummary.length > 0 ? `
                             <div class="text-xs opacity-75 mt-2">
                                 <i class="fas fa-filter mr-1"></i>${filterSummary.join(' • ')}
                             </div>
                         ` : ''}
                     </div>
                     
                     <div class="grid grid-cols-2 gap-4 mb-4">
                         <div class="bg-blue-50 p-3 rounded-lg">
                             <div class="text-xs text-gray-600 mb-1">👤 Amar's Contribution</div>
                             <div class="text-xl font-bold text-blue-600">$${amarTotal.toFixed(2)}</div>
                         </div>
                         <div class="bg-pink-50 p-3 rounded-lg">
                             <div class="text-xs text-gray-600 mb-1">👤 Priya's Contribution</div>
                             <div class="text-xl font-bold text-pink-600">$${priyaTotal.toFixed(2)}</div>
                         </div>
                     </div>
                 </div>
                 
                 <div class="space-y-3">
                     ${sorted.map(exp => {
        const item = exp.fields.Item || 'Unnamed';
        const actual = exp.fields.Actual || 0;
        const day = exp.fields.Day;
        const month = exp.fields.Month;
        const year = exp.fields.Year;
        const llc = exp.fields.LLC === 'Yes';
        const category = exp.fields.Category || 'Other';
        let amarContrib = exp.fields.AmarContribution || 0;
        let priyaContrib = exp.fields.PriyaContribution || 0;

        // For mortgage expenses, calculate adjusted contributions
        if (category === 'Mortgage' && amarContrib > 0) {
            const expenseYear = String(year);
            const expenseMonth = String(month).padStart(2, '0');

            const priyaMortgagePayments = allPayments
                .filter(p =>
                    p.fields.Person === 'Priya' &&
                    p.fields.PaymentType === 'PriyaMortgageContribution' &&
                    String(p.fields.Year) === expenseYear &&
                    String(p.fields.Month).padStart(2, '0') === expenseMonth
                )
                .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

            if (priyaMortgagePayments > 0) {
                // Get total mortgage expenses for this month
                const totalMortgageExpenses = allExpenses
                    .filter(e =>
                        e.fields.Category === 'Mortgage' &&
                        String(e.fields.Year) === expenseYear &&
                        String(e.fields.Month).padStart(2, '0') === expenseMonth
                    )
                    .reduce((sum, e) => sum + (e.fields.AmarContribution || 0), 0);

                // Calculate this expense's share of the adjustment
                const adjustmentRatio = totalMortgageExpenses > 0 ? amarContrib / totalMortgageExpenses : 0;
                const thisExpenseAdjustment = priyaMortgagePayments * adjustmentRatio;

                amarContrib = Math.max(0, amarContrib - thisExpenseAdjustment);
                priyaContrib = priyaContrib + thisExpenseAdjustment;
            }
        }
        const notes = exp.fields.Notes || '';
        const tags = exp.fields.Tags || '';

        let dateDisplay = '';
        if (day !== undefined && day !== null && day !== '') {
            dateDisplay = `${monthNames[month - 1]} ${day}, ${year}`;
        } else {
            dateDisplay = `${monthNames[month - 1]} ${year}`;
        }

        // Tags display
        let tagsDisplay = '';
        if (tags.trim()) {
            const tagList = tags.split(',').map(tag =>
                `<span class="inline-block px-2 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-full text-xs font-medium mr-1 mb-1"><i class="fas fa-tag mr-1"></i>${tag.trim()}</span>`
            ).join('');
            tagsDisplay = `<div class="mt-2 flex flex-wrap">${tagList}</div>`;
        }

        return `
                            <div class="border border-gray-200 rounded-lg p-4 hover:bg-purple-50 hover:shadow-md transition-all cursor-pointer" 
                                 onclick="viewExpenseDetails('${exp.id}')" 
                                 style="cursor: pointer;">
                                <div class="flex justify-between items-start mb-2">
                                    <div class="flex-1">
                                        <div class="font-semibold text-gray-800 flex items-center gap-2 flex-wrap">
                                            ${item}
                                            ${llc ? '<span class="badge badge-llc text-xs">LLC</span>' : ''}
                                            <span class="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">${category}</span>
                                        </div>
                                        <div class="text-sm text-gray-600 mt-1">
                                            <i class="fas fa-calendar mr-1"></i>${dateDisplay}
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-2xl font-bold text-purple-600">$${actual.toFixed(2)}</div>
                                    </div>
                                </div>
                                
                                ${tagsDisplay}
                                
                                <div class="flex gap-4 text-xs text-gray-600 mt-3 pt-3 border-t border-gray-100">
                                    <div class="flex items-center gap-1">
                                        <i class="fas fa-user text-blue-500"></i>
                                        <span>Amar: $${amarContrib.toFixed(2)}</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <i class="fas fa-user text-pink-500"></i>
                                        <span>Priya: $${priyaContrib.toFixed(2)}</span>
                                    </div>
                                </div>
                                
                                ${notes && notes.trim() !== '' ? `
                                    <div class="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                        <i class="fas fa-sticky-note mr-1"></i>${notes}
                                    </div>
                                ` : ''}
                            </div>
                        `;
    }).join('')}
                 </div>
             `;
}

function clearAllFilters() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔄 clearAllFilters() CALLED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    try {
        // Get all filter elements
        console.log('📍 Step 1: Getting filter elements...');
        const filterYear = document.getElementById('filterYear');
        const filterContributor = document.getElementById('filterContributor');
        const filterTag = document.getElementById('filterTag');
        const filterLLC = document.getElementById('filterLLC');
        const resultsDiv = document.getElementById('filterResults');

        console.log('  Element availability:', {
            filterYear: filterYear ? '✅ EXISTS' : '❌ NULL',
            filterContributor: filterContributor ? '✅ EXISTS' : '❌ NULL',
            filterTag: filterTag ? '✅ EXISTS' : '❌ NULL',
            filterLLC: filterLLC ? '✅ EXISTS' : '❌ NULL',
            resultsDiv: resultsDiv ? '✅ EXISTS' : '❌ NULL'
        });
        console.log('');

        // Clear LLC filter
        if (filterLLC) {
            filterLLC.value = '';
        }

        // Log current values BEFORE clearing
        console.log('📍 Step 2: Current values BEFORE clear:');
        if (filterYear) console.log('  Year:', filterYear.value, '(options:', filterYear.options.length, ')');
        console.log('  Months:', getSelectedMonths());
        console.log('  Categories:', getSelectedCategories());
        console.log('  Tags:', getSelectedTags());
        if (filterContributor) console.log('  Contributor:', filterContributor.value, '(options:', filterContributor.options.length, ')');
        console.log('');

        // Clear Year
        console.log('📍 Step 3: Clearing filters...');
        if (filterYear) {
            console.log('  🔹 Clearing Year...');
            console.log('    Before: selectedIndex =', filterYear.selectedIndex, ', value =', filterYear.value);
            filterYear.selectedIndex = 0;
            console.log('    After:  selectedIndex =', filterYear.selectedIndex, ', value =', filterYear.value);
            console.log('    First option text:', filterYear.options[0]?.text);
        } else {
            console.warn('  ⚠️ filterYear element not found!');
        }

        // Clear Month checkboxes
        console.log('  🔹 Clearing Month checkboxes...');
        const monthCheckboxes = document.querySelectorAll('#monthDropdownContent input[type="checkbox"]');
        console.log('    Found', monthCheckboxes.length, 'month checkboxes');
        monthCheckboxes.forEach(cb => cb.checked = false);
        document.getElementById('monthDropdownText').innerHTML = '<span class="custom-dropdown-placeholder">Select months...</span>';
        console.log('    ✓ All month checkboxes cleared');

        // Clear Category checkboxes
        console.log('  🔹 Clearing Category checkboxes...');
        const categoryCheckboxes = document.querySelectorAll('#categoryDropdownContent input[type="checkbox"]');
        console.log('    Found', categoryCheckboxes.length, 'category checkboxes');
        categoryCheckboxes.forEach(cb => cb.checked = false);
        document.getElementById('categoryDropdownText').innerHTML = '<span class="custom-dropdown-placeholder">Select categories...</span>';
        console.log('    ✓ All category checkboxes cleared');

        // Clear Tag checkboxes and repopulate all tags
        console.log('  🔹 Clearing Tag checkboxes...');
        const tagCheckboxes = document.querySelectorAll('#tagDropdownContent input[type="checkbox"]');
        console.log('    Found', tagCheckboxes.length, 'tag checkboxes');
        tagCheckboxes.forEach(cb => cb.checked = false);
        document.getElementById('tagDropdownText').innerHTML = '<span class="custom-dropdown-placeholder">Select tags...</span>';
        console.log('    ✓ All tag checkboxes cleared');

        // Repopulate all tags (since categories are cleared)
        console.log('  🔹 Repopulating all tags...');
        populateAllCheckboxTags();
        const tagsAfterRepopulate = document.querySelectorAll('#tagDropdownContent input[type="checkbox"]');
        console.log('    ✓ Tags repopulated:', tagsAfterRepopulate.length, 'tags available');

        // Clear Contributor
        if (filterContributor) {
            console.log('  🔹 Clearing Contributor...');
            console.log('    Before: selectedIndex =', filterContributor.selectedIndex, ', value =', filterContributor.value);
            filterContributor.selectedIndex = 0;
            console.log('    After:  selectedIndex =', filterContributor.selectedIndex, ', value =', filterContributor.value);
            console.log('    First option text:', filterContributor.options[0]?.text);
        } else {
            console.warn('  ⚠️ filterContributor element not found!');
        }
        console.log('');

        // Repopulate tags dropdown with ALL tags (not category-specific)
        console.log('📍 Step 4: Repopulating tags dropdown with all tags...');
        if (filterTag) {
            const tagCountBefore = filterTag.options.length;
            console.log('  Tags count before repopulate:', tagCountBefore);
        }
        if (typeof populateAllTags === 'function') {
            populateAllTags();
            if (filterTag) {
                const tagCountAfter = filterTag.options.length;
                console.log('  Tags count after repopulate:', tagCountAfter);
                console.log('  ✓ Tags dropdown repopulated with all tags');
            }
        } else {
            console.warn('  ⚠️ populateAllTags function not found!');
        }
        console.log('');

        // Clear results display
        console.log('📍 Step 5: Clearing results display...');
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                         <div class="text-center py-12 text-gray-400">
                             <i class="fas fa-filter text-6xl mb-4"></i>
                             <p class="text-lg font-semibold">Select filters above to view results</p>
                             <p class="text-sm mt-2">Choose year, month, category, tag, or contributor to get started</p>
                         </div>
                     `;
            console.log('  ✓ Results display cleared');
        } else {
            console.warn('  ⚠️ resultsDiv not found!');
        }
        console.log('');

        // Final verification
        console.log('📍 Step 6: Final values AFTER clear:');
        if (filterYear) console.log('  Year:', filterYear.value, '(should be empty)');
        console.log('  Months:', getSelectedMonths(), '(should be empty array)');
        console.log('  Categories:', getSelectedCategories(), '(should be empty array)');
        console.log('  Tags:', getSelectedTags(), '(should be empty array)');
        if (filterLLC) console.log('  LLC:', filterLLC.value, '(should be empty)');
        if (filterContributor) console.log('  Contributor:', filterContributor.value, '(should be empty)');
        console.log('');

        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ FILTERS CLEARED SUCCESSFULLY');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');

        showNotification('Filters cleared', 'success');

    } catch (error) {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.error('❌ ERROR in clearAllFilters():', error);
        console.error('Stack trace:', error.stack);
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        showNotification('Error: ' + error.message, 'error');
    }
}
console.log('✅ clearAllFilters() function defined successfully');

function applyFiltersToExpensesTab() {
    try {
        const year = document.getElementById('filterYear')?.value || '';
        const contributor = document.getElementById('filterContributor')?.value || '';

        // Get multi-select values from checkboxes
        const selectedMonths = getSelectedMonths();
        const selectedCategories = getSelectedCategories();
        const selectedTags = getSelectedTags();

        if (!year && selectedMonths.length === 0 && selectedCategories.length === 0 && selectedTags.length === 0 && !contributor) {
            showNotification('Please select at least one filter', 'error');
            return;
        }

        // Switch to expenses tab
        switchTab('expenses');

        // Apply filters to expenses tab if corresponding elements exist
        if (year) {
            const yearFilter = document.getElementById('yearFilter');
            if (yearFilter) yearFilter.value = year;
        }

        // For month, apply only the first selected month
        if (selectedMonths.length > 0) {
            const monthFilter = document.getElementById('monthFilter');
            if (monthFilter) monthFilter.value = selectedMonths[0];
        }

        // For multi-select, apply only the first selected item to Expenses tab
        if (selectedCategories.length > 0) {
            const categoryFilter = document.getElementById('categoryFilter');
            if (categoryFilter) categoryFilter.value = selectedCategories[0];
        }

        if (selectedTags.length > 0) {
            const tagFilter = document.getElementById('tagFilter');
            if (tagFilter) tagFilter.value = selectedTags[0];
        }

        // Trigger filter
        if (typeof filterExpenses === 'function') {
            filterExpenses();
        }

        let message = 'Filters applied to Expenses tab';
        if (selectedMonths.length > 1 || selectedCategories.length > 1 || selectedTags.length > 1) {
            message += ' (only first month/category/tag applied)';
        }
        showNotification(message, 'success');
    } catch (error) {
        console.error('Error applying filters:', error);
        showNotification('Error applying filters: ' + error.message, 'error');
    }
}

function switchTab(tab, event) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('[id$="Tab"]').forEach(content => content.style.display = 'none');

    // Find the button for this tab and activate it
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(btn => {
        const btnText = btn.textContent.toLowerCase();
        if ((tab === 'expenses' && btnText.includes('expenses')) ||
            (tab === 'payments' && btnText.includes('payments')) ||
            (tab === 'category' && btnText.includes('filters')) ||
            (tab === 'analytics' && btnText.includes('analytics')) ||
            (tab === 'trends' && btnText.includes('trends')) ||
            (tab === 'insights' && btnText.includes('insights'))) {
            btn.classList.add('active');
        }
    });

    document.getElementById(tab + 'Tab').style.display = 'block';
    if (tab === 'analytics' || tab === 'trends') updateCharts();
    if (tab === 'insights') updateInsights();
    if (tab === 'category') populateFilterDropdowns(); // Populate Filters tab dropdowns
}

// Helper function to close all modals except the one specified
function closeAllModalsExcept(modalId) {
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(modal => {
        if (modal.id !== modalId) {
            modal.classList.remove('active');
        }
    });
}

// Smart Date Picker Functions
function toggleDatePicker() {
    const fields = document.getElementById('datePickerFields');
    const chevron = document.getElementById('datePickerChevron');
    
    if (fields.classList.contains('hidden')) {
        fields.classList.remove('hidden');
        chevron.classList.add('fa-chevron-up');
        chevron.classList.remove('fa-chevron-down');
    } else {
        fields.classList.add('hidden');
        chevron.classList.remove('fa-chevron-up');
        chevron.classList.add('fa-chevron-down');
    }
}

// LLC Toggle Function
function toggleLLC() {
    const llcSelect = document.getElementById('llc');
    const llcBtn = document.getElementById('llcToggleBtn');
    if (llcSelect) {
        llcSelect.dataset.userChanged = 'true';
        llcSelect.dataset.autoFilled = 'false';
        const existingHint = document.getElementById('llcHint');
        if (existingHint) existingHint.remove();
    }
    
    if (llcSelect.value === 'No') {
        llcSelect.value = 'Yes';
        llcBtn.classList.remove('toggle-btn-inactive');
        llcBtn.classList.add('toggle-btn-active-llc');
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Business</span>';
    } else {
        llcSelect.value = 'No';
        llcBtn.classList.remove('toggle-btn-active-llc');
        llcBtn.classList.add('toggle-btn-inactive');
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Personal</span>';
    }
}

// More Details Toggle Function
function toggleMoreDetails() {
    const panel = document.getElementById('moreDetailsPanel');
    const btn = document.getElementById('moreDetailsBtn');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        btn.classList.remove('toggle-btn-inactive');
        btn.classList.add('toggle-btn-active-more');
        btn.innerHTML = '<i class="fas fa-chevron-up"></i><span>Less</span>';
    } else {
        panel.classList.add('hidden');
        btn.classList.remove('toggle-btn-active-more');
        btn.classList.add('toggle-btn-inactive');
        btn.innerHTML = '<i class="fas fa-ellipsis-h"></i><span>More</span>';
    }
}

function updateDisplayDate() {
    const year = document.getElementById('year').value;
    const month = document.getElementById('month').value;
    const day = document.getElementById('day').value;
    const displayDate = document.getElementById('displayDate');
    
    if (!year || !month || !day) return;
    
    const now = new Date();
    const selectedDate = new Date(year, parseInt(month) - 1, parseInt(day));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (selectedDate.getTime() === today.getTime()) {
        displayDate.textContent = 'Today';
        displayDate.className = 'text-sm font-bold text-purple-700';
    } else if (selectedDate.getTime() === yesterday.getTime()) {
        displayDate.textContent = 'Yesterday';
        displayDate.className = 'text-sm font-bold text-orange-600';
    } else {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        displayDate.textContent = `${monthNames[parseInt(month) - 1]} ${day}, ${year}`;
        displayDate.className = 'text-sm font-bold text-blue-600';
    }
}

function setDateToToday() {
    const now = new Date();
    document.getElementById('year').value = now.getFullYear();
    document.getElementById('month').value = String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('day').value = now.getDate();
    updateDisplayDate();
}

function setDateToYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    document.getElementById('year').value = yesterday.getFullYear();
    document.getElementById('month').value = String(yesterday.getMonth() + 1).padStart(2, '0');
    document.getElementById('day').value = yesterday.getDate();
    updateDisplayDate();
}

function openAddExpenseModal() {
    closeAllModalsExcept('expenseModal');
    document.getElementById('modalTitle').textContent = 'Add Expense';
    document.getElementById('expenseForm').reset();
    document.getElementById('recordId').value = '';
    const now = new Date();

    const yearSelector = document.getElementById('yearSelector');
    const monthSelector = document.getElementById('monthSelector');
    const selectedYear = yearSelector && yearSelector.value && yearSelector.value !== 'all' ? yearSelector.value : '';
    const selectedMonth = monthSelector && monthSelector.value && monthSelector.value !== 'all' ? monthSelector.value : '';

    document.getElementById('year').value = selectedYear || now.getFullYear();
    document.getElementById('month').value = (selectedMonth ? String(selectedMonth).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0'));
    document.getElementById('day').value = now.getDate();
    
    // Initialize date picker to today
    updateDisplayDate();
    document.getElementById('datePickerFields').classList.add('hidden');
    document.getElementById('datePickerChevron').classList.remove('fa-chevron-up');
    document.getElementById('datePickerChevron').classList.add('fa-chevron-down');
    
    // Reset LLC toggle to Personal
    document.getElementById('llc').value = 'No';
    document.getElementById('llc').dataset.userChanged = 'false';
    document.getElementById('llc').dataset.autoFilled = 'false';
    const llcBtn = document.getElementById('llcToggleBtn');
    llcBtn.classList.remove('toggle-btn-active-llc');
    llcBtn.classList.add('toggle-btn-inactive');
    llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Personal</span>';
    
    // Hide more details panel
    document.getElementById('moreDetailsPanel').classList.add('hidden');
    const moreBtn = document.getElementById('moreDetailsBtn');
    moreBtn.classList.remove('toggle-btn-active-more');
    moreBtn.classList.add('toggle-btn-inactive');
    moreBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i><span>More</span>';
    
    currentReceiptData = null;
    document.getElementById('receiptFile').value = '';
    document.getElementById('currentReceipt').classList.add('hidden');
    document.getElementById('receiptUploadBtn').classList.remove('hidden');
    document.getElementById('expenseModal').classList.add('active');
}

function closeModal() {
    document.getElementById('expenseModal').classList.remove('active');
}

function handlePaymentTypeChange() {
    const paymentType = document.getElementById('contributionPaymentType').value;
    const personSelectDiv = document.getElementById('personSelectDiv');
    const amountLabel = document.getElementById('amountLabel');
    const amountHint = document.getElementById('amountHint');
    const paymentTypeHint = document.getElementById('paymentTypeHint');
    const descriptionInput = document.getElementById('contributionDescription');

    if (paymentType === 'RentalIncome') {
        // Hide person selector for rental income
        personSelectDiv.style.display = 'none';
        amountLabel.textContent = 'Total Rental Amount';
        amountHint.innerHTML = '<i class="fas fa-info-circle mr-1"></i>Will be split equally: 50% Amar, 50% Priya';
        paymentTypeHint.innerHTML = '<i class="fas fa-home mr-1 text-green-600"></i>Rental income will be automatically split 50/50 between Amar and Priya';
        descriptionInput.value = 'Rental Income';
    } else if (paymentType === 'PriyaMortgageContribution') {
        // Lock to Priya for mortgage contribution
        personSelectDiv.style.display = 'block';
        document.getElementById('contributionPersonSelect').value = 'Priya';
        document.getElementById('contributionPersonSelect').disabled = true;
        document.getElementById('contributionPerson').value = 'Priya';
        amountLabel.textContent = 'Contribution Amount';
        amountHint.innerHTML = '<i class="fas fa-info-circle mr-1"></i>This will reduce Amar\'s net mortgage contribution';
        paymentTypeHint.innerHTML = '<i class="fas fa-home mr-1 text-blue-600"></i>This contribution offsets Amar\'s mortgage payments';
        descriptionInput.value = 'Mortgage Contribution';
    } else {
        // Regular payment
        personSelectDiv.style.display = 'block';
        document.getElementById('contributionPersonSelect').disabled = false;
        amountLabel.textContent = 'Amount';
        amountHint.innerHTML = '<i class="fas fa-info-circle mr-1"></i>Enter the payment amount';
        paymentTypeHint.innerHTML = '<i class="fas fa-info-circle mr-1"></i>Select the type of payment';
        descriptionInput.value = '';
    }
}

function openRentalIncomeModal() {
    closeAllModalsExcept('contributionModal');
    document.getElementById('contributionModalTitle').textContent = 'Add Rental Income';
    document.getElementById('contributionForm').reset();
    document.getElementById('contributionPerson').value = '';
    document.getElementById('paymentRecordId').value = '';

    // Set payment type to Rental Income
    document.getElementById('contributionPaymentType').value = 'RentalIncome';
    handlePaymentTypeChange();

    // Populate year dropdown
    const yearSelect = document.getElementById('contributionYear');
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let year = 2025; year <= 2045; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }

    // Set current month
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    document.getElementById('contributionMonth').value = currentMonth;

    document.getElementById('contributionModal').classList.add('active');
}

// Track if user has seen the payment info modal recently
let paymentInfoShown = false;

function showPaymentInfoModal(person) {
    // Show info modal explaining what payments are for
    const infoHTML = `
        <div class="text-center mb-6">
            <div class="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <i class="fas fa-exclamation-triangle text-white text-2xl"></i>
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-2">Important: About Payments</h3>
        </div>
        
        <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-4">
            <p class="text-sm text-blue-800">
                <i class="fas fa-info-circle mr-2"></i>
                <strong>Payments are NOT for tracking expenses.</strong>
            </p>
        </div>
        
        <div class="space-y-3 mb-6">
            <div class="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <i class="fas fa-check-circle text-green-600 mt-1"></i>
                <div>
                    <p class="font-semibold text-green-800">Use Payments For:</p>
                    <ul class="text-sm text-green-700 mt-1 space-y-1">
                        <li>• <strong>Bulk transfers</strong> between accounts</li>
                        <li>• <strong>Rental income</strong> reporting</li>
                        <li>• <strong>Mortgage contributions</strong> (Priya → Amar)</li>
                        <li>• <strong>Lump sum reimbursements</strong></li>
                    </ul>
                </div>
            </div>
            
            <div class="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <i class="fas fa-times-circle text-red-600 mt-1"></i>
                <div>
                    <p class="font-semibold text-red-800">Do NOT Use Payments For:</p>
                    <ul class="text-sm text-red-700 mt-1 space-y-1">
                        <li>• Individual expenses (use Add Expense instead)</li>
                        <li>• Credit card charges</li>
                        <li>• Daily purchases</li>
                    </ul>
                </div>
            </div>
        </div>
        
        <div class="flex gap-3">
            <button onclick="closePaymentInfoModal()" class="btn-secondary flex-1">
                <i class="fas fa-times mr-2"></i>Cancel
            </button>
            <button onclick="proceedToAddPayment('${person}')" class="btn-primary flex-1">
                <i class="fas fa-check mr-2"></i>I Understand, Continue
            </button>
        </div>
    `;
    
    // Create and show the info modal
    let infoModal = document.getElementById('paymentInfoModal');
    if (!infoModal) {
        infoModal = document.createElement('div');
        infoModal.id = 'paymentInfoModal';
        infoModal.className = 'modal';
        infoModal.innerHTML = `<div class="modal-content" style="max-width: 480px;"><div id="paymentInfoContent"></div></div>`;
        document.body.appendChild(infoModal);
    }
    
    document.getElementById('paymentInfoContent').innerHTML = infoHTML;
    infoModal.classList.add('active');
}

function closePaymentInfoModal() {
    const modal = document.getElementById('paymentInfoModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function proceedToAddPayment(person) {
    closePaymentInfoModal();
    paymentInfoShown = true;
    openContributionModalDirect(person);
}

function openContributionModal(person) {
    // Show info modal first if not recently shown
    if (!paymentInfoShown) {
        showPaymentInfoModal(person);
        return;
    }
    openContributionModalDirect(person);
}

function openContributionModalDirect(person) {
    closeAllModalsExcept('contributionModal');
    document.getElementById('contributionModalTitle').textContent = `Add ${person}'s Payment`;
    document.getElementById('contributionForm').reset();
    document.getElementById('contributionPerson').value = person;
    document.getElementById('contributionPersonSelect').value = person;
    document.getElementById('paymentRecordId').value = '';

    // Reset payment type to Regular
    document.getElementById('contributionPaymentType').value = 'Regular';
    handlePaymentTypeChange();

    // Populate year dropdown
    const yearSelect = document.getElementById('contributionYear');
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let year = 2025; year <= 2045; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }

    // Set current month
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    document.getElementById('contributionMonth').value = currentMonth;

    document.getElementById('contributionModal').classList.add('active');
}

function closeContributionModal() {
    document.getElementById('contributionModal').classList.remove('active');
}

function closeMismatchModal() {
    document.getElementById('mismatchModal').classList.remove('active');
}

function checkContributionMismatches() {
    const mismatches = [];
    const monthlyData = {};

    // Group expenses and contributions by year-month
    allExpenses.forEach(exp => {
        const key = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        if (!monthlyData[key]) {
            monthlyData[key] = {
                spending: 0,
                amarMortgage: 0,
                amarNonMortgage: 0,
                priya: 0,
                year: exp.fields.Year,
                month: exp.fields.Month,
                rentalIncome: 0
            };
        }
        monthlyData[key].spending += (exp.fields.Actual || 0);

        // Separate Amar's mortgage from non-mortgage contributions
        if (exp.fields.Category === 'Mortgage') {
            monthlyData[key].amarMortgage += (exp.fields.AmarContribution || 0);
        } else {
            monthlyData[key].amarNonMortgage += (exp.fields.AmarContribution || 0);
        }
        monthlyData[key].priya += (exp.fields.PriyaContribution || 0);
    });

    // Add standalone payments (exclude FromExpense to avoid double counting)
    allPayments.forEach(payment => {
        if (!payment.fields.FromExpense) {
            const key = `${payment.fields.Year}-${String(payment.fields.Month).padStart(2, '0')}`;
            if (!monthlyData[key]) {
                monthlyData[key] = {
                    spending: 0,
                    amarMortgage: 0,
                    amarNonMortgage: 0,
                    priya: 0,
                    year: payment.fields.Year,
                    month: payment.fields.Month,
                    rentalIncome: 0
                };
            }

            // Track rental income separately (reduces target contributions, not counted as contribution)
            if (payment.fields.PaymentType === 'RentalIncome') {
                monthlyData[key].rentalIncome += (payment.fields.Amount || 0);
            }
            // Handle Priya's mortgage contributions separately
            else if (payment.fields.Person === 'Priya' && payment.fields.PaymentType === 'PriyaMortgageContribution') {
                // Don't add yet - will be used to adjust Amar's mortgage contribution
            }
            // Skip Regular payments for mismatch detection - they are settlements
            // between people (transfers), not contributions toward spending
            else if (payment.fields.PaymentType === 'Regular') {
                // Regular payments are net-zero: one person pays the other
                // They don't represent new spending or new contributions to expenses
            }
            // Add non-regular, non-rental payments to respective person
            else {
                if (payment.fields.Person === 'Amar') {
                    monthlyData[key].amarNonMortgage += (payment.fields.Amount || 0);
                } else {
                    monthlyData[key].priya += (payment.fields.Amount || 0);
                }
            }
        }
    });

    // Calculate final contributions with mortgage adjustments
    Object.keys(monthlyData).forEach(key => {
        const data = monthlyData[key];

        // Get Priya's mortgage contributions for this month
        const priyaMortgageContribs = allPayments
            .filter(p =>
                !p.fields.FromExpense &&
                String(p.fields.Year) === String(data.year) &&
                String(p.fields.Month).padStart(2, '0') === key.split('-')[1] &&
                p.fields.Person === 'Priya' &&
                p.fields.PaymentType === 'PriyaMortgageContribution'
            )
            .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

        // Adjust Amar's mortgage contribution and add to Priya's
        const amarAdjustedMortgage = Math.max(0, data.amarMortgage - priyaMortgageContribs);
        data.contributions = data.amarNonMortgage + amarAdjustedMortgage + data.priya + priyaMortgageContribs;
    });

    // Check for mismatches (only from Nov 2025 onward, when contribution tracking was introduced)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    Object.keys(monthlyData).forEach(key => {
        const data = monthlyData[key];
        const yr = parseInt(data.year);
        const mo = parseInt(data.month);

        // Skip months before Nov 2025 — contribution fields weren't tracked yet
        if (yr < 2025 || (yr === 2025 && mo < 11)) return;

        // Check if contributions match spending
        // Rental income is tracked separately and only affects remaining balance, not mismatch detection
        const diff = Math.abs(data.spending - data.contributions);

        // Allow small rounding differences (< $0.01)
        if (diff > 0.01) {
            const monthName = monthNames[mo - 1];
            const type = data.contributions > data.spending ? 'over' : 'under';
            mismatches.push({
                period: `${monthName} ${data.year}`,
                spending: data.spending,
                contributions: data.contributions,
                difference: diff,
                type: type
            });
        }
    });

    return mismatches;
}

function updateMismatchNotification() {
    const mismatches = checkContributionMismatches();
    const badge = document.getElementById('notificationBadge');
    const btn = document.getElementById('notificationBtn');

    if (mismatches.length > 0) {
        badge.textContent = mismatches.length;
        badge.style.display = 'flex';
        btn.classList.add('animate-pulse');
    } else {
        badge.style.display = 'none';
        btn.classList.remove('animate-pulse');
    }
}

function showMismatchNotifications() {
    const mismatches = checkContributionMismatches();
    const container = document.getElementById('mismatchList');

    if (mismatches.length === 0) {
        container.innerHTML = `
                     <div class="text-center py-8 text-gray-400">
                         <i class="fas fa-check-circle text-6xl text-green-500 mb-4"></i>
                         <p class="text-lg">No mismatches found!</p>
                         <p class="text-sm mt-2">All contributions match spending for each month.</p>
                     </div>
                 `;
    } else {
        container.innerHTML = mismatches.map(m => {
            const icon = m.type === 'over' ? 'fa-arrow-up' : 'fa-arrow-down';
            const color = 'red';
            const message = m.type === 'over'
                ? `Contributions exceed spending by $${m.difference.toFixed(2)}`
                : `Contributions fall short by $${m.difference.toFixed(2)}`;

            return `
                        <div class="p-4 bg-${color}-50 border-l-4 border-${color}-500 rounded">
                            <div class="flex items-start gap-3">
                                <i class="fas ${icon} text-${color}-500 text-xl mt-1"></i>
                                <div class="flex-1">
                                    <h3 class="font-bold text-${color}-800 mb-1">${m.period}</h3>
                                    <p class="text-sm text-${color}-700 mb-2">${message}</p>
                                    <div class="grid grid-cols-2 gap-2 text-xs">
                                        <div class="bg-white/50 p-2 rounded">
                                            <span class="text-gray-600">Spending:</span>
                                            <span class="font-bold ml-1">$${m.spending.toFixed(2)}</span>
                                        </div>
                                        <div class="bg-white/50 p-2 rounded">
                                            <span class="text-gray-600">Contributions:</span>
                                            <span class="font-bold ml-1">$${m.contributions.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        }).join('');
    }

    document.getElementById('mismatchModal').classList.add('active');
}

function updateContributionPerson() {
    const person = document.getElementById('contributionPersonSelect').value;
    document.getElementById('contributionPerson').value = person;
    const recordId = document.getElementById('paymentRecordId').value;
    const action = recordId ? 'Edit' : 'Add';
    document.getElementById('contributionModalTitle').textContent = `${action} ${person}'s Payment`;
}

async function saveStandaloneContribution(event) {
    event.preventDefault();

    // Show loading spinner on submit button
    const submitBtn = event.target.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true);
    showLoader('Saving payment...');

    const recordId = document.getElementById('paymentRecordId').value;
    const paymentType = document.getElementById('contributionPaymentType').value;
    const person = document.getElementById('contributionPerson').value;
    const amount = parseFloat(document.getElementById('contributionAmount').value) || 0;
    const description = document.getElementById('contributionDescription').value || 'Payment';
    const year = parseInt(document.getElementById('contributionYear').value);
    const month = document.getElementById('contributionMonth').value;

    try {
        // Check for duplicate payments (only for new payments, not edits)
        if (!recordId) {
            const duplicatePayment = allPayments.find(p =>
                p.fields.Person === person &&
                p.fields.Amount === amount &&
                p.fields.Year === year &&
                p.fields.Month === month &&
                p.fields.PaymentType === paymentType
            );

            if (duplicatePayment) {
                const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const confirmed = confirm(
                    `⚠️ DUPLICATE PAYMENT DETECTED!\n\n` +
                    `A payment already exists with:\n` +
                    `• Person: ${person}\n` +
                    `• Amount: $${amount.toFixed(2)}\n` +
                    `• Date: ${monthNames[parseInt(month)]} ${year}\n` +
                    `• Type: ${paymentType}\n\n` +
                    `Adding this would create a duplicate record.\n\n` +
                    `Click OK to add anyway, or Cancel to go back.`
                );

                if (!confirmed) {
                    setButtonLoading(submitBtn, false);
                    hideLoader();
                    return;
                }
            }
        }

        if (paymentType === 'RentalIncome' && !recordId) {
            // Create two separate payment records (50/50 split) in Supabase
            const splitAmount = amount / 2;

            // Create Amar's rental income payment
            const amarPayment = {
                id: 'pay' + Date.now() + Math.random().toString(36).substr(2, 9),
                Person: 'Amar',
                Amount: splitAmount,
                Description: description || 'Rental Income',
                Year: year,
                Month: month,
                PaymentType: 'RentalIncome'
            };
            await supabasePost(PAYMENTS_TABLE, amarPayment);

            // Create Priya's rental income payment
            const priyaPayment = {
                id: 'pay' + Date.now() + Math.random().toString(36).substr(2, 9) + 'p',
                Person: 'Priya',
                Amount: splitAmount,
                Description: description || 'Rental Income',
                Year: year,
                Month: month,
                PaymentType: 'RentalIncome'
            };
            await supabasePost(PAYMENTS_TABLE, priyaPayment);

            setButtonLoading(submitBtn, false);
            closeContributionModal();
            await loadData();
            hideLoader();
            showNotification(`Rental income of $${amount.toFixed(2)} split equally: $${splitAmount.toFixed(2)} each to Amar and Priya`, 'success');

        } else {
            // Regular payment or Priya's mortgage contribution
            const fields = {
                Person: person,
                Amount: amount,
                Description: description,
                Year: year,
                Month: month,
                PaymentType: paymentType
            };

            if (recordId) {
                // Update existing payment in Supabase
                await supabasePatch(PAYMENTS_TABLE, recordId, fields);
            } else {
                // Create new payment in Supabase
                const newPayment = {
                    id: 'pay' + Date.now() + Math.random().toString(36).substr(2, 9),
                    ...fields
                };
                await supabasePost(PAYMENTS_TABLE, newPayment);
            }

            setButtonLoading(submitBtn, false);
            closeContributionModal();
            await loadData();
            hideLoader();

            let message = recordId ? 'Payment updated!' : `${person}'s payment of $${amount.toFixed(2)} recorded!`;
            if (paymentType === 'PriyaMortgageContribution') {
                message = `Priya's mortgage contribution of $${amount.toFixed(2)} recorded (reduces Amar's net contribution)`;
            }
            showNotification(message, 'success');
        }
    } catch (error) {
        hideLoader();
        setButtonLoading(submitBtn, false);
        showNotification('Error: ' + error.message, 'error');
    }
}

function editPayment(id) {
    const payment = allPayments.find(p => p.id === id);
    if (!payment) return;

    document.getElementById('contributionModalTitle').textContent = 'Edit Payment';
    document.getElementById('paymentRecordId').value = id;
    document.getElementById('contributionPerson').value = payment.fields.Person || 'Amar';
    document.getElementById('contributionPersonSelect').value = payment.fields.Person || 'Amar';
    document.getElementById('contributionAmount').value = payment.fields.Amount || '';
    document.getElementById('contributionDescription').value = payment.fields.Description || '';

    // Set payment type (default to Regular if not set)
    document.getElementById('contributionPaymentType').value = payment.fields.PaymentType || 'Regular';
    handlePaymentTypeChange();

    // Populate year dropdown
    const yearSelect = document.getElementById('contributionYear');
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let year = 2025; year <= 2045; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === payment.fields.Year) option.selected = true;
        yearSelect.appendChild(option);
    }

    document.getElementById('contributionMonth').value = payment.fields.Month || '';
    document.getElementById('contributionModal').classList.add('active');
}

async function deletePayment(id) {
    if (!confirm('Delete this payment?')) return;
    
    showLoader('Deleting payment...');
    try {
        // Delete from Supabase
        await supabaseDelete(PAYMENTS_TABLE, id);
        await loadData();
        hideLoader();
        showNotification('Payment deleted!', 'success');
    } catch (error) {
        hideLoader();
        showNotification('Error: ' + error.message, 'error');
    }
}

async function editExpense(id) {
    console.log('editExpense called with ID:', id);
    const expense = allExpenses.find(exp => exp.id === id);
    if (!expense) {
        console.error('Expense not found for ID:', id);
        return;
    }
    console.log('Found expense:', expense);

    if (DATA_SOURCE === 'supabase' && expense.fields.has_receipt && (!expense.fields.Receipt || expense.fields.Receipt.length === 0)) {
        try {
            const withReceipt = await supabaseGet(TABLE_NAME, { id: { operator: 'eq', value: id } }, 1, 'id,Receipt');
            if (withReceipt?.[0]?.Receipt) {
                const raw = withReceipt[0].Receipt;
                if (typeof raw === 'string') {
                    const s = raw.trim();
                    if (s.startsWith('data:')) {
                        expense.fields.Receipt = [{ url: s, filename: 'receipt' }];
                    } else if (s.startsWith('[') || s.startsWith('{')) {
                        expense.fields.Receipt = JSON.parse(s);
                    } else {
                        expense.fields.Receipt = [{ url: s, filename: 'receipt' }];
                    }
                } else {
                    expense.fields.Receipt = raw;
                }
            }
        } catch (e) {
        }
    }

    closeAllModalsExcept('expenseModal');
    document.getElementById('modalTitle').textContent = 'Edit Expense';
    document.getElementById('recordId').value = id;
    document.getElementById('itemName').value = expense.fields.Item || '';
    document.getElementById('category').value = expense.fields.Category || '';
    document.getElementById('year').value = expense.fields.Year || '';
    document.getElementById('month').value = expense.fields.Month || '';
    document.getElementById('day').value = expense.fields.Day || 1;
    // Budget field removed - now managed per category
    document.getElementById('actual').value = expense.fields.Actual || '';
    document.getElementById('llc').value = expense.fields.LLC || 'No';
    document.getElementById('amarContributionInput').value = expense.fields.AmarContribution || '';
    document.getElementById('priyaContributionInput').value = expense.fields.PriyaContribution || '';
    document.getElementById('tags').value = expense.fields.Tags || '';
    document.getElementById('notes').value = expense.fields.Notes || '';

    // Update date picker display
    updateDisplayDate();
    document.getElementById('datePickerFields').classList.add('hidden');
    document.getElementById('datePickerChevron').classList.remove('fa-chevron-up');
    document.getElementById('datePickerChevron').classList.add('fa-chevron-down');

    // Update LLC toggle button
    const llcBtn = document.getElementById('llcToggleBtn');
    if (expense.fields.LLC === 'Yes') {
        llcBtn.classList.remove('toggle-btn-inactive');
        llcBtn.classList.add('toggle-btn-active-llc');
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Business</span>';
    } else {
        llcBtn.classList.remove('toggle-btn-active-llc');
        llcBtn.classList.add('toggle-btn-inactive');
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Personal</span>';
    }

    // Auto-expand more details if there's additional data
    const hasMoreDetails = expense.fields.Tags || expense.fields.Notes || 
                          expense.fields.AmarContribution || expense.fields.PriyaContribution;
    
    const moreDetailsPanel = document.getElementById('moreDetailsPanel');
    const moreBtn = document.getElementById('moreDetailsBtn');
    
    if (hasMoreDetails) {
        moreDetailsPanel.classList.remove('hidden');
        moreBtn.classList.remove('toggle-btn-inactive');
        moreBtn.classList.add('toggle-btn-active-more');
        moreBtn.innerHTML = '<i class="fas fa-chevron-up"></i><span>Less</span>';
    } else {
        moreDetailsPanel.classList.add('hidden');
        moreBtn.classList.remove('toggle-btn-active-more');
        moreBtn.classList.add('toggle-btn-inactive');
        moreBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i><span>More</span>';
    }

    // Handle receipt
    document.getElementById('receiptFile').value = '';
    if (expense.fields.Receipt && expense.fields.Receipt.length > 0) {
        currentReceiptData = expense.fields.Receipt[0];
        document.getElementById('receiptFileName').textContent = currentReceiptData.filename;
        const receiptLink = document.getElementById('receiptViewLink');
        receiptLink.href = '#';
        receiptLink.onclick = (e) => {
            e.preventDefault();
            viewReceiptFromExpense(id);
        };
        document.getElementById('currentReceipt').classList.remove('hidden');
        document.getElementById('receiptUploadBtn').classList.add('hidden');
    } else {
        currentReceiptData = null;
        document.getElementById('currentReceipt').classList.add('hidden');
        document.getElementById('receiptUploadBtn').classList.remove('hidden');
    }

    console.log('Opening expense modal...');
    const modal = document.getElementById('expenseModal');
    console.log('Modal element:', modal);
    modal.classList.add('active');
    console.log('Modal opened, classes:', modal.className);
}

// ===== FUZZY CATEGORY MATCHING =====

// Calculate Levenshtein distance between two strings
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase()) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,    // deletion
                    dp[i][j - 1] + 1,    // insertion
                    dp[i - 1][j - 1] + 1 // substitution
                );
            }
        }
    }

    return dp[m][n];
}

// Calculate similarity score (0 to 1, higher is more similar)
function getSimilarityScore(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0;
    const distance = levenshteinDistance(str1, str2);
    return 1.0 - (distance / maxLen);
}

// Find similar categories
function findSimilarCategories(newCategory, threshold = 0.7) {
    const existingCategories = [...new Set(allExpenses.map(e => e.fields.Category).filter(c => c))];
    const similar = [];

    const newCatLower = newCategory.trim().toLowerCase();

    // First check if exact match exists (case insensitive)
    const exactMatchExists = existingCategories.some(cat => cat.toLowerCase() === newCatLower);

    // If exact match exists, don't show any suggestions
    if (exactMatchExists) {
        return [];
    }

    for (const existing of existingCategories) {
        const existingLower = existing.toLowerCase();


        const similarity = getSimilarityScore(newCatLower, existingLower);

        // Check for substring match or high similarity
        const isSubstring = newCatLower.includes(existingLower) || existingLower.includes(newCatLower);
        const isSimilar = similarity >= threshold;

        if (isSubstring || isSimilar) {
            similar.push({
                category: existing,
                similarity: similarity,
                reason: isSubstring ? 'Contains similar text' : `${(similarity * 100).toFixed(0)}% similar`
            });
        }
    }

    // Sort by similarity descending
    return similar.sort((a, b) => b.similarity - a.similarity);
}

// Show category similarity confirmation dialog
function showCategorySimilarityDialog(newCategory, similarCategories) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10001'; // Above other modals

        modal.innerHTML = `
                     <div class="modal-content" style="max-width: 600px;">
                         <div class="mb-6">
                             <h3 class="text-xl font-bold text-amber-700 mb-2">
                                 <i class="fas fa-exclamation-triangle mr-2"></i>
                                 Similar Categories Found
                             </h3>
                             <p class="text-gray-600">
                                 The category "<strong>${newCategory}</strong>" is similar to existing categories. 
                                 Did you mean one of these?
                             </p>
                         </div>
                         
                         <div class="bg-amber-50 rounded-lg p-4 mb-4 border border-amber-200">
                             <div class="text-sm font-semibold text-gray-700 mb-3">
                                 <i class="fas fa-list mr-2 text-amber-600"></i>
                                 Existing similar categories:
                             </div>
                             <div class="space-y-2 max-h-60 overflow-y-auto">
                                 ${similarCategories.slice(0, 5).map(cat => `
                                     <button class="w-full text-left p-3 bg-white rounded-lg border border-amber-300 hover:bg-amber-100 transition-colors"
                                             onclick="this.closest('.modal').dispatchEvent(new CustomEvent('categorySelected', { detail: '${cat.category.replace(/'/g, "\\'")}'  }))">
                                         <div class="flex justify-between items-center">
                                             <div>
                                                 <div class="font-semibold text-gray-800">${cat.category}</div>
                                                 <div class="text-xs text-gray-500">${cat.reason}</div>
                                             </div>
                                             <i class="fas fa-arrow-right text-amber-600"></i>
                                         </div>
                                     </button>
                                 `).join('')}
                             </div>
                         </div>
                         
                         <div class="flex gap-3">
                             <button id="useSimilarCategoryBtn" class="btn-secondary flex-1">
                                 <i class="fas fa-arrow-left mr-2"></i>
                                 Select Existing Category
                             </button>
                             <button id="useNewCategoryBtn" class="btn-primary flex-1">
                                 <i class="fas fa-plus mr-2"></i>
                                 Use "${newCategory}" (New)
                             </button>
                         </div>
                     </div>
                 `;

        document.body.appendChild(modal);

        // Handle selecting an existing category
        modal.addEventListener('categorySelected', (e) => {
            document.body.removeChild(modal);
            resolve({ action: 'use-existing', category: e.detail });
        });

        // Handle "select existing" button (just closes, user picks manually)
        document.getElementById('useSimilarCategoryBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve({ action: 'cancel' });
        };

        // Handle "use new" button
        document.getElementById('useNewCategoryBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve({ action: 'use-new', category: newCategory });
        };
    });
}

// Flag to prevent duplicate submissions
let isSavingExpense = false;

// Helper function to format tags: lowercase and replace spaces with hyphens
function formatTags(tags) {
    if (!tags) return '';
    const normalized = String(tags)
        .toLowerCase()
        .split(',')
        .map(tag => String(tag || '').trim())
        .map(tag => tag.replace(/\s+/g, '-'))
        .map(tag => tag.replace(/-+/g, '-'))
        .map(tag => tag.replace(/^-+/, '').replace(/-+$/, ''))
        .filter(Boolean);
    return normalized.join(', ');
}

// Helper function to format category: Title Case
function formatCategory(category) {
    if (!category) return '';
    return category.trim()
        .toLowerCase()
        .split(/[-\s]+/) // Split by hyphens or spaces
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function showMissingReceiptWarning() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10003';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 520px;">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-bold text-orange-600 flex items-center gap-2">
                        <i class="fas fa-exclamation-triangle"></i>
                        Receipt Missing
                    </h2>
                </div>

                <div class="bg-orange-50 border-l-4 border-orange-500 p-4 mb-5">
                    <p class="text-sm text-orange-800">
                        <i class="fas fa-info-circle mr-2"></i>
                        No receipt is attached for this expense. Did you miss it, or do you want to save without a receipt?
                    </p>
                </div>

                <div class="flex gap-3">
                    <button id="missingReceiptAttachBtn" class="btn-secondary flex-1">
                        <i class="fas fa-paperclip mr-2"></i>Attach Receipt
                    </button>
                    <button id="missingReceiptSaveBtn" class="btn-primary flex-1" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);">
                        <i class="fas fa-check mr-2"></i>Save Without Receipt
                    </button>
                </div>

                <button id="missingReceiptCancelBtn" class="w-full mt-4 btn-secondary">
                    <i class="fas fa-times mr-2"></i>Cancel
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        const cleanup = (result) => {
            try { document.body.removeChild(modal); } catch (_e) {}
            resolve(result);
        };

        modal.addEventListener('click', (e) => {
            if (e.target === modal) cleanup('cancel');
        });

        document.getElementById('missingReceiptAttachBtn').onclick = () => cleanup('attach');
        document.getElementById('missingReceiptSaveBtn').onclick = () => cleanup('proceed');
        document.getElementById('missingReceiptCancelBtn').onclick = () => cleanup('cancel');
    });
}

async function saveExpense(event) {
    event.preventDefault();

    // Prevent duplicate submissions
    if (isSavingExpense) {
        console.log('Already saving expense, ignoring duplicate submission');
        return;
    }

    // Set flag to prevent concurrent submissions
    isSavingExpense = true;

    // Show full-page loader
    showLoader('Saving expense...');

    // Get submit button and show loading immediately
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) setButtonLoading(submitBtn, true);

    // Check for similar categories
    const categoryInput = document.getElementById('category').value.trim();
    const recordId = document.getElementById('recordId').value;

    // Only check for new expenses (not edits) and if category is not empty
    if (!recordId && categoryInput) {
        const similarCategories = findSimilarCategories(categoryInput, 0.65);

        if (similarCategories.length > 0) {
            const result = await showCategorySimilarityDialog(categoryInput, similarCategories);

            if (result.action === 'cancel') {
                // User wants to manually select
                hideLoader(); // Hide the full-page loader
                if (submitBtn) setButtonLoading(submitBtn, false);
                isSavingExpense = false;
                document.getElementById('category').focus();
                return;
            } else if (result.action === 'use-existing') {
                // User selected an existing category
                document.getElementById('category').value = result.category;
            }
            // If 'use-new', continue with the new category
        }
    }

    // Validate actual amount
    const actualAmount = parseFloat(document.getElementById('actual').value);
    if (!actualAmount || actualAmount <= 0) {
        hideLoader(); // Hide the full-page loader
        showNotification('Please enter a valid actual amount', 'error');
        document.getElementById('actual').focus();
        if (submitBtn) setButtonLoading(submitBtn, false);
        isSavingExpense = false; // Reset flag
        return;
    }

    // Get contribution amounts
    let amarContribution = parseFloat(document.getElementById('amarContributionInput').value) || 0;
    let priyaContribution = parseFloat(document.getElementById('priyaContributionInput').value) || 0;

    // Check if contributions are missing or don't match actual amount
    const totalContribution = amarContribution + priyaContribution;
    const contributionMismatch = Math.abs(totalContribution - actualAmount) > 0.01;

    // If no contributions or mismatch, show smart popup
    if ((amarContribution <= 0 && priyaContribution <= 0) || contributionMismatch) {
        const contributionChoice = await showContributionHelper(actualAmount, amarContribution, priyaContribution);

        if (contributionChoice === 'cancel') {
            hideLoader(); // Hide the full-page loader
            if (submitBtn) setButtonLoading(submitBtn, false);
            isSavingExpense = false; // Reset flag
            return; // User cancelled
        } else if (contributionChoice === 'amar') {
            // Amar pays full amount
            document.getElementById('amarContributionInput').value = actualAmount;
            document.getElementById('priyaContributionInput').value = 0;
            amarContribution = actualAmount;
            priyaContribution = 0;
        } else if (contributionChoice === 'priya') {
            // Priya pays full amount
            document.getElementById('amarContributionInput').value = 0;
            document.getElementById('priyaContributionInput').value = actualAmount;
            amarContribution = 0;
            priyaContribution = actualAmount;
        } else if (contributionChoice === 'split') {
            // Split 50/50
            const half = actualAmount / 2;
            document.getElementById('amarContributionInput').value = half;
            document.getElementById('priyaContributionInput').value = half;
            amarContribution = half;
            priyaContribution = half;
        }
        // If 'edit', user goes back to form
    }

    try {
        const recordId = document.getElementById('recordId').value;

        const yearEl = document.getElementById('year');
        const monthEl = document.getElementById('month');
        const dayEl = document.getElementById('day');

        let yearVal = parseInt(yearEl?.value);
        let monthVal = String(monthEl?.value || '').trim();
        let dayVal = parseInt(dayEl?.value);

        const now = new Date();
        if (!Number.isFinite(yearVal)) yearVal = now.getFullYear();
        if (!monthVal) monthVal = String(now.getMonth() + 1).padStart(2, '0');
        monthVal = String(monthVal).padStart(2, '0');
        if (!Number.isFinite(dayVal)) dayVal = now.getDate();

        // Clamp day to a sensible range so it never becomes null/NaN in JSON
        dayVal = Math.min(31, Math.max(1, dayVal));

        const fields = {
            Item: document.getElementById('itemName').value.trim(),
            Category: formatCategory(document.getElementById('category').value),
            Year: yearVal,
            Month: monthVal,
            Day: dayVal,
            Actual: actualAmount,
            LLC: document.getElementById('llc').value,
            AmarContribution: amarContribution,
            PriyaContribution: priyaContribution,
            Tags: formatTags(document.getElementById('tags').value),
            Notes: document.getElementById('notes').value.trim() || ''
        };

        // Check for similar item names (only for new expenses, not edits)
        if (!recordId && fields.Item) {
            const similarItems = findSimilarItems(fields.Item);
            if (similarItems.length > 0) {
                const confirmed = await showSimilarItemWarning(fields.Item, similarItems);
                if (!confirmed) {
                    hideLoader(); // Hide the full-page loader
                    if (submitBtn) setButtonLoading(submitBtn, false);
                    isSavingExpense = false; // Reset flag
                    return; // User cancelled
                }
            }
        }

        // Check for duplicates (only for new expenses, not edits)
        if (!recordId) {
            // Always flag exact duplicates locally (low risk, avoids missing a true duplicate if LLM is down)
            const ruleDuplicates = findDuplicateExpenses(fields);
            const exactDuplicates = (ruleDuplicates || []).filter(d => d && d.isExactDuplicate);

            let duplicates = exactDuplicates;
            if (duplicates.length === 0) {
                try {
                    duplicates = await detectDuplicateExpensesWithLLM(fields, { timeoutMs: 3500, minConfidence: 0.7 });
                } catch (e) {
                    console.warn('LLM duplicate detection failed, falling back to rule-based logic:', e);
                    duplicates = ruleDuplicates;
                }
            }
            if (duplicates.length > 0) {
                const confirmed = await showDuplicateConfirmation(duplicates, fields);
                if (!confirmed) {
                    hideLoader(); // Hide the full-page loader
                    if (submitBtn) setButtonLoading(submitBtn, false);
                    isSavingExpense = false; // Reset flag
                    return; // User cancelled
                }
            }
        }

        // Handle receipt file upload
        const receiptFile = document.getElementById('receiptFile').files[0];
        if (receiptFile) {
            await uploadReceiptAndSave(recordId, fields, receiptFile);
        } else if (currentReceiptData) {
            // Keep existing receipt
            fields.has_receipt = true;
            fields.Receipt = JSON.stringify([currentReceiptData]);
            await saveExpenseToSupabase(recordId, fields);
        } else {
            // No receipt
            const choice = await showMissingReceiptWarning();
            if (choice === 'attach') {
                const el = document.getElementById('receiptFile');
                if (el) el.click();
                return;
            }
            if (choice === 'cancel') {
                return;
            }
            await saveExpenseToSupabase(recordId, fields);
        }
    } catch (error) {
        showNotification('Error saving expense: ' + error.message, 'error');
    } finally {
        hideLoader();
        if (submitBtn) setButtonLoading(submitBtn, false);
        isSavingExpense = false; // Always reset flag when done
    }
}

function showContributionHelper(actualAmount, currentAmar, currentPriya) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10003'; // Above other modals

        const totalContribution = currentAmar + currentPriya;
        const isMissing = currentAmar <= 0 && currentPriya <= 0;
        const isMismatch = Math.abs(totalContribution - actualAmount) > 0.01;
        const isOver = totalContribution > actualAmount;
        const isUnder = totalContribution < actualAmount && totalContribution > 0;

        let title = 'Contributions Missing';
        let message = 'Who paid for this expense?';
        let alertClass = 'blue';

        if (isMismatch && !isMissing) {
            title = 'Contribution Mismatch';
            if (isOver) {
                message = `Contributions ($${totalContribution.toFixed(2)}) exceed actual amount ($${actualAmount.toFixed(2)})`;
                alertClass = 'red';
            } else {
                message = `Contributions ($${totalContribution.toFixed(2)}) don't cover full amount ($${actualAmount.toFixed(2)})`;
                alertClass = 'orange';
            }
        }

        modal.innerHTML = `
                     <div class="modal-content" style="max-width: 550px;">
                         <div class="flex justify-between items-center mb-6">
                             <h2 class="text-2xl font-bold text-${alertClass}-600 flex items-center gap-2">
                                 <i class="fas fa-${isMismatch ? 'exclamation-triangle' : 'question-circle'}"></i>
                                 ${title}
                             </h2>
                         </div>
                         
                         <div class="bg-${alertClass}-50 border-l-4 border-${alertClass}-500 p-4 mb-6">
                             <p class="text-sm text-${alertClass}-800">
                                 <i class="fas fa-info-circle mr-2"></i>
                                 ${message}
                             </p>
                         </div>
                         
                         <div class="mb-6">
                             <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                 <div class="grid grid-cols-2 gap-4 mb-3">
                                     <div>
                                         <div class="text-xs text-gray-600 mb-1">Actual Amount</div>
                                         <div class="text-2xl font-bold text-purple-600">$${actualAmount.toFixed(2)}</div>
                                     </div>
                                     <div>
                                         <div class="text-xs text-gray-600 mb-1">Total Contributions</div>
                                         <div class="text-2xl font-bold ${totalContribution === actualAmount ? 'text-green-600' : 'text-red-600'}">
                                             $${totalContribution.toFixed(2)}
                                         </div>
                                     </div>
                                 </div>
                                 ${!isMissing ? `
                                     <div class="pt-3 border-t border-gray-300">
                                         <div class="flex justify-between text-sm mb-1">
                                             <span class="text-gray-600">Amar:</span>
                                             <span class="font-semibold">$${currentAmar.toFixed(2)}</span>
                                         </div>
                                         <div class="flex justify-between text-sm">
                                             <span class="text-gray-600">Priya:</span>
                                             <span class="font-semibold">$${currentPriya.toFixed(2)}</span>
                                         </div>
                                     </div>
                                 ` : ''}
                             </div>
                         </div>
                         
                         <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                             <p class="text-sm text-blue-800 font-semibold mb-2">
                                 <i class="fas fa-magic mr-2"></i>Quick Options:
                             </p>
                             <p class="text-xs text-blue-700">
                                 Choose who paid, or split 50/50. We'll set the contributions automatically!
                             </p>
                         </div>
                         
                         <div class="space-y-3">
                             <button id="amarPaidBtn" class="w-full btn-primary flex items-center justify-center gap-2">
                                 <i class="fas fa-user"></i>
                                 Amar Paid Full Amount ($${actualAmount.toFixed(2)})
                             </button>
                             <button id="priyaPaidBtn" class="w-full btn-primary flex items-center justify-center gap-2">
                                 <i class="fas fa-user"></i>
                                 Priya Paid Full Amount ($${actualAmount.toFixed(2)})
                             </button>
                             <button id="splitBtn" class="w-full btn-secondary flex items-center justify-center gap-2">
                                 <i class="fas fa-balance-scale"></i>
                                 Split 50/50 ($${(actualAmount / 2).toFixed(2)} each)
                             </button>
                             <button id="editBtn" class="w-full px-4 py-2 text-gray-600 hover:text-gray-800 font-semibold rounded-lg hover:bg-gray-100 transition-colors">
                                 <i class="fas fa-edit mr-2"></i>
                                 Go Back & Edit Manually
                             </button>
                         </div>
                     </div>
                 `;

        document.body.appendChild(modal);

        document.getElementById('amarPaidBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve('amar');
        };

        document.getElementById('priyaPaidBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve('priya');
        };

        document.getElementById('splitBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve('split');
        };

        document.getElementById('editBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve('cancel');
        };
    });
}

function showBudgetConfirmation(actualAmount) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10002'; // Above other modals

        modal.innerHTML = `
                     <div class="modal-content" style="max-width: 500px;">
                         <div class="flex justify-between items-center mb-6">
                             <h2 class="text-2xl font-bold text-blue-600 flex items-center gap-2">
                                 <i class="fas fa-question-circle"></i>
                                 Budget Amount Missing
                             </h2>
                         </div>
                         
                         <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                             <p class="text-sm text-blue-800">
                                 <i class="fas fa-info-circle mr-2"></i>
                                 You haven't entered a budget amount for this expense.
                             </p>
                         </div>
                         
                         <div class="mb-6">
                             <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                 <div class="text-sm text-gray-600 mb-2">Actual Amount:</div>
                                 <div class="text-3xl font-bold text-purple-600">$${actualAmount.toFixed(2)}</div>
                             </div>
                         </div>
                         
                         <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                             <p class="text-sm text-yellow-800">
                                 <i class="fas fa-lightbulb mr-2"></i>
                                 <strong>Tip:</strong> Setting a budget helps you track spending vs. planned amounts.
                             </p>
                         </div>
                         
                         <div class="space-y-3">
                             <button id="useSameBtn" class="w-full btn-primary flex items-center justify-center gap-2">
                                 <i class="fas fa-copy"></i>
                                 Use $${actualAmount.toFixed(2)} as Budget
                                 <span class="text-xs opacity-75">(Recommended)</span>
                             </button>
                             <button id="continueWithoutBtn" class="w-full btn-secondary flex items-center justify-center gap-2">
                                 <i class="fas fa-forward"></i>
                                 Continue with $0 Budget
                             </button>
                             <button id="cancelBtn" class="w-full px-4 py-2 text-gray-600 hover:text-gray-800 font-semibold rounded-lg hover:bg-gray-100 transition-colors">
                                 <i class="fas fa-arrow-left mr-2"></i>
                                 Go Back & Edit
                             </button>
                         </div>
                     </div>
                 `;

        document.body.appendChild(modal);

        document.getElementById('useSameBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve('useSame');
        };

        document.getElementById('continueWithoutBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve('continue');
        };

        document.getElementById('cancelBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve('cancel');
        };
    });
}

function findSimilarItems(newItem) {
    const similarItems = [];
    const newItemLower = newItem.toLowerCase().trim();

    // Get all unique existing items
    const existingItems = [...new Set(allExpenses.map(exp => exp.fields.Item).filter(Boolean))];

    existingItems.forEach(existingItem => {
        const existingLower = existingItem.toLowerCase().trim();

        // Skip if exact match (case-insensitive)
        if (newItemLower === existingLower) return;

        let isSimilar = false;
        let reason = '';

        // Check if one contains the other
        if (newItemLower.includes(existingLower)) {
            isSimilar = true;
            reason = `"${newItem}" contains "${existingItem}"`;
        } else if (existingLower.includes(newItemLower)) {
            isSimilar = true;
            reason = `"${existingItem}" contains "${newItem}"`;
        }

        // Check for word overlap (e.g., "car gas" vs "gas")
        const newWords = newItemLower.split(/\s+/);
        const existingWords = existingLower.split(/\s+/);
        const commonWords = newWords.filter(word =>
            word.length > 2 && existingWords.includes(word)
        );

        if (commonWords.length > 0 && !isSimilar) {
            isSimilar = true;
            reason = `Both contain: "${commonWords.join(', ')}"`;
        }

        if (isSimilar) {
            similarItems.push({
                item: existingItem,
                reason: reason
            });
        }
    });

    return similarItems;
}

function showSimilarItemWarning(newItem, similarItems) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10002'; // Above other modals

        modal.innerHTML = `
                     <div class="modal-content" style="max-width: 500px;">
                         <div class="flex justify-between items-center mb-6">
                             <h2 class="text-2xl font-bold text-orange-600 flex items-center gap-2">
                                 <i class="fas fa-exclamation-circle"></i>
                                 Similar Item Found
                             </h2>
                         </div>
                         
                         <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
                             <p class="text-sm text-yellow-800">
                                 <i class="fas fa-info-circle mr-2"></i>
                                 We found similar item${similarItems.length > 1 ? 's' : ''} that already exist. 
                                 Consider using the existing item${similarItems.length > 1 ? 's' : ''} to keep your data consistent.
                             </p>
                         </div>
                         
                         <div class="mb-6">
                             <h3 class="font-bold text-gray-800 mb-3">You're adding:</h3>
                             <div class="bg-green-50 border border-green-200 rounded-lg p-3">
                                 <div class="font-semibold text-gray-800">"${newItem}"</div>
                             </div>
                         </div>
                         
                         <div class="mb-6">
                             <h3 class="font-bold text-gray-800 mb-3">Similar existing item${similarItems.length > 1 ? 's' : ''}:</h3>
                             <div class="space-y-2">
                                 ${similarItems.map(similar => `
                                     <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                         <div class="font-semibold text-gray-800 mb-1">"${similar.item}"</div>
                                         <div class="text-xs text-blue-700">
                                             <i class="fas fa-link mr-1"></i>${similar.reason}
                                         </div>
                                     </div>
                                 `).join('')}
                             </div>
                         </div>
                         
                         <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                             <p class="text-sm text-gray-700">
                                 <i class="fas fa-lightbulb text-yellow-500 mr-2"></i>
                                 <strong>Tip:</strong> Using consistent item names helps with better analytics and suggestions.
                             </p>
                         </div>
                         
                         <div class="flex gap-3">
                             <button id="goBackBtn" class="btn-secondary flex-1">
                                 <i class="fas fa-arrow-left mr-2"></i>
                                 Go Back & Edit
                             </button>
                             <button id="continueAnywayBtn" class="btn-primary flex-1">
                                 <i class="fas fa-check mr-2"></i>
                                 Add Anyway
                             </button>
                         </div>
                     </div>
                 `;

        document.body.appendChild(modal);

        document.getElementById('continueAnywayBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };

        document.getElementById('goBackBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
    });
}

function findDuplicateExpenses(newExpense) {
    const duplicates = [];

    // Only check expenses from the same month and year to avoid false positives
    // (e.g., recurring expenses like mortgage)
    const currentMonthExpenses = allExpenses.filter(exp => 
        exp.fields.Year === newExpense.Year && 
        exp.fields.Month === newExpense.Month
    );

    currentMonthExpenses.forEach(exp => {
        let matchScore = 0;
        let reasons = [];
        let isExactDuplicate = false;

        // Check item name (case-insensitive, fuzzy match)
        const itemMatch = exp.fields.Item && newExpense.Item &&
            exp.fields.Item.toLowerCase() === newExpense.Item.toLowerCase();
        if (itemMatch) {
            matchScore += 3;
            reasons.push('Same item name');
        }

        // Check exact amount
        const amountMatch = exp.fields.Actual === newExpense.Actual && newExpense.Actual > 0;
        if (amountMatch) {
            matchScore += 2;
            reasons.push('Same amount');
        }

        // Check same date
        const dateMatch = exp.fields.Year === newExpense.Year &&
            exp.fields.Month === newExpense.Month &&
            exp.fields.Day === newExpense.Day;
        if (dateMatch) {
            matchScore += 2;
            reasons.push('Same date');
        }

        // Check same category
        const categoryMatch = exp.fields.Category === newExpense.Category;
        if (categoryMatch) {
            matchScore += 1;
            reasons.push('Same category');
        }

        // EXACT DUPLICATE: Same item, same amount, same date (regardless of category)
        // This is almost certainly a duplicate that should be prevented
        if (itemMatch && amountMatch && dateMatch) {
            isExactDuplicate = true;
            matchScore += 10; // Boost score to ensure it's caught
            reasons.unshift('⚠️ EXACT DUPLICATE');
        }

        // If match score is high enough, consider it a potential duplicate
        // Score >= 5 means at least: same item + same amount, or same item + same date
        // Score >= 10 means exact duplicate (same item + amount + date)
        if (matchScore >= 5) {
            duplicates.push({
                expense: exp,
                matchScore: matchScore,
                reasons: reasons,
                isExactDuplicate: isExactDuplicate
            });
        }
    });

    // Sort by match score (highest first)
    return duplicates.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3); // Top 3
}

function showDuplicateConfirmation(duplicates, newExpense) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10001'; // Above other modals

        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Check if any are exact duplicates
        const hasExactDuplicate = duplicates.some(d => d.isExactDuplicate);
        const warningColor = hasExactDuplicate ? 'red' : 'orange';
        const warningTitle = hasExactDuplicate ? '🚫 EXACT DUPLICATE DETECTED!' : 'Possible Duplicate Expense';

        modal.innerHTML = `
                     <div class="modal-content" style="max-width: 600px;">
                         <div class="flex justify-between items-center mb-6">
                             <h2 class="text-2xl font-bold text-${warningColor}-600 flex items-center gap-2">
                                 <i class="fas fa-${hasExactDuplicate ? 'ban' : 'exclamation-triangle'}"></i>
                                 ${warningTitle}
                             </h2>
                         </div>
                         
                         <div class="bg-${warningColor}-50 border-l-4 border-${warningColor}-500 p-4 mb-6">
                             <p class="text-sm text-${warningColor}-800 font-semibold">
                                 <i class="fas fa-${hasExactDuplicate ? 'times-circle' : 'info-circle'} mr-2"></i>
                                 ${hasExactDuplicate 
                                     ? 'This appears to be an EXACT duplicate of an existing expense. Adding it would create duplicate data!' 
                                     : `We found ${duplicates.length} similar expense${duplicates.length > 1 ? 's' : ''} that might be duplicate${duplicates.length > 1 ? 's' : ''}. Please review before adding.`}
                             </p>
                         </div>
                         
                         <div class="mb-6">
                             <h3 class="font-bold text-gray-800 mb-3">New Expense:</h3>
                             <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                                 <div class="grid grid-cols-2 gap-2 text-sm">
                                     <div><span class="font-semibold">Item:</span> ${newExpense.Item}</div>
                                     <div><span class="font-semibold">Amount:</span> $${newExpense.Actual.toFixed(2)}</div>
                                     <div><span class="font-semibold">Date:</span> ${monthNames[parseInt(newExpense.Month)] || newExpense.Month} ${newExpense.Day}, ${newExpense.Year}</div>
                                     <div><span class="font-semibold">Category:</span> ${newExpense.Category || 'None'}</div>
                                 </div>
                             </div>
                         </div>
                         
                         <div class="mb-6">
                             <h3 class="font-bold text-gray-800 mb-3">Existing Expense${duplicates.length > 1 ? 's' : ''}:</h3>
                             <div class="space-y-3">
                                 ${duplicates.map(dup => `
                                     <div class="bg-${dup.isExactDuplicate ? 'red' : 'orange'}-50 border-2 border-${dup.isExactDuplicate ? 'red' : 'orange'}-300 rounded-lg p-4">
                                         ${dup.isExactDuplicate ? '<div class="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded mb-2 inline-block"><i class="fas fa-exclamation-triangle mr-1"></i>EXACT DUPLICATE</div>' : ''}
                                         <div class="grid grid-cols-2 gap-2 text-sm mb-2">
                                             <div><span class="font-semibold">Item:</span> ${dup.expense.fields.Item}</div>
                                             <div><span class="font-semibold">Amount:</span> $${(dup.expense.fields.Actual || 0).toFixed(2)}</div>
                                             <div><span class="font-semibold">Date:</span> ${monthNames[parseInt(dup.expense.fields.Month)] || dup.expense.fields.Month} ${dup.expense.fields.Day || 1}, ${dup.expense.fields.Year}</div>
                                             <div><span class="font-semibold">Category:</span> ${dup.expense.fields.Category || 'None'}</div>
                                         </div>
                                         <div class="text-xs text-${dup.isExactDuplicate ? 'red' : 'orange'}-700 font-semibold">
                                             <i class="fas fa-check-circle mr-1"></i>
                                             ${dup.reasons.join(', ')}
                                         </div>
                                     </div>
                                 `).join('')}
                             </div>
                         </div>
                         
                         <div class="flex gap-3">
                             ${hasExactDuplicate ? `
                                 <button id="cancelAddBtn" class="btn-primary flex-1" style="background: #dc2626;">
                                     <i class="fas fa-times mr-2"></i>
                                     Don't Add (Recommended)
                                 </button>
                                 <button id="confirmAddBtn" class="btn-secondary flex-1" style="background: #6b7280;">
                                     <i class="fas fa-exclamation-triangle mr-2"></i>
                                     Add Anyway (Not Recommended)
                                 </button>
                             ` : `
                                 <button id="confirmAddBtn" class="btn-primary flex-1">
                                     <i class="fas fa-check mr-2"></i>
                                     Add Anyway (Not a Duplicate)
                                 </button>
                                 <button id="cancelAddBtn" class="btn-secondary flex-1">
                                     <i class="fas fa-times mr-2"></i>
                                     Cancel
                                 </button>
                             `}
                         </div>
                     </div>
                 `;

        document.body.appendChild(modal);

        document.getElementById('confirmAddBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };

        document.getElementById('cancelAddBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
    });
}

// ==================== RECEIPT COMPRESSION ====================

/**
 * Compress an image file to reduce storage size
 * Converts to WebP format (best compression) and scales down if needed
 * @param {File} file - The image file to compress
 * @param {number} maxWidth - Maximum width (default 1200px)
 * @param {number} quality - Compression quality 0-1 (default 0.8)
 * @returns {Promise<{base64: string, filename: string, type: string, size: number, originalSize: number}>}
 */
async function compressImage(file, maxWidth = 1200, quality = 0.8) {
    const fileType = (file.type || '').toLowerCase();
    const fileName = file.name || 'unknown';
    
    console.log(`📷 Processing image: ${fileName}, type: ${fileType || 'unknown'}, size: ${(file.size / 1024).toFixed(0)}KB`);
    
    // Basic validation - must be an image or have image extension
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif'];
    const hasImageExtension = imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    
    if (fileType && !fileType.startsWith('image/') && !hasImageExtension) {
        throw new Error(`Not an image file: ${fileType}. Please select an image.`);
    }
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        // Use createObjectURL instead of FileReader - better HEIC support on Safari/iOS
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => {
            // Revoke the object URL to free memory
            URL.revokeObjectURL(objectUrl);
            
            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to WebP (best compression) or fallback to JPEG
            const originalSize = file.size;
            const maxBytes = 950 * 1024;

            let mimeType = 'image/webp';
            let base64Data = canvas.toDataURL(mimeType, quality);

            // Fallback to JPEG if WebP not supported
            if (!base64Data || base64Data === 'data:,' || base64Data.startsWith('data:image/png')) {
                mimeType = 'image/jpeg';
                base64Data = canvas.toDataURL(mimeType, Math.min(0.75, quality));
            }

            let compressedSize = Math.round((base64Data.length * 3) / 4);
            let tries = 0;
            while (compressedSize > maxBytes && tries < 8) {
                tries += 1;
                quality = Math.max(0.35, quality - 0.08);

                const scale = 0.85;
                width = Math.max(650, Math.round(width * scale));
                height = Math.max(650, Math.round(height * scale));

                canvas.width = width;
                canvas.height = height;
                const ctx2 = canvas.getContext('2d');
                ctx2.drawImage(img, 0, 0, width, height);

                base64Data = canvas.toDataURL(mimeType, quality);
                if (!base64Data || base64Data === 'data:,' || base64Data.startsWith('data:image/png')) {
                    base64Data = canvas.toDataURL('image/jpeg', quality);
                    mimeType = 'image/jpeg';
                }
                compressedSize = Math.round((base64Data.length * 3) / 4);
            }

            const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
            console.log(`📦 Image compressed: ${(originalSize / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB (${compressionRatio}% reduction)`);

            resolve({
                base64: base64Data,
                filename: file.name.replace(/\.[^.]+$/, mimeType.includes('jpeg') ? '.jpg' : '.webp'),
                type: mimeType,
                size: compressedSize,
                originalSize: originalSize
            });
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            console.error('Image load error:', err, 'File:', fileName, 'Type:', fileType);
            
            // Provide specific guidance for HEIC files
            if (fileName.toLowerCase().endsWith('.heic') || fileName.toLowerCase().endsWith('.heif')) {
                reject(new Error(`Cannot load HEIC image. Your browser may not support HEIC format. Try taking a screenshot of the receipt or converting to JPEG.`));
            } else {
                reject(new Error(`Failed to load image "${fileName}". The file may be corrupted.`));
            }
        };
        
        img.src = objectUrl;
    });
}

// ==================== RECEIPT UPLOAD ====================

async function uploadReceiptAndSave(recordId, fields, file) {
    try {
        showNotification('Compressing and uploading receipt...', 'info');

        // Compress the image before saving
        const compressed = await compressImage(file, 1200, 0.8);

        const receiptDataUrl = compressed.base64;

        // Set has_receipt flag
        fields.has_receipt = true;
        
        // Only auto-scan receipts for grocery category
        // Check if category contains "grocery" (case-insensitive)
        const category = (fields.Category || '').toLowerCase();
        const isGrocery = category.includes('grocery') || category.includes('groceries');
        const clientScanEnabled = true;
        
        if (isGrocery) {
            // Client-side scan
            fields.receipt_scanned = false;
            fields.receipt_processing_status = !recordId ? 'processing' : 'failed';
            fields.receipt_error = !recordId ? null : 'Manual processing required';
            console.log('Grocery receipt - client-only processing');
        } else {
            // Non-grocery receipts: mark as already scanned (won't be processed)
            fields.receipt_scanned = true;
            fields.receipt_processing_status = 'skipped';
            console.log('Non-grocery receipt - skipping auto-scan');
        }

        // Save expense with receipt data (async - don't wait for scan to complete form)
        const savedExpense = await saveExpenseToSupabase(recordId, fields);
        const expenseId = savedExpense?.id || recordId;

        const uploaded = await uploadReceiptToStorage(expenseId, receiptDataUrl, fields, compressed.filename);
        await supabasePatch(TABLE_NAME, expenseId, {
            Receipt: JSON.stringify([{
                ...uploaded,
                originalSize: compressed.originalSize,
                compressed: true
            }])
        });
        
        if (!isGrocery) {
            showNotification(`Receipt saved! (${(compressed.size / 1024).toFixed(0)}KB)`, 'success');
            console.log('Receipt saved - not a grocery category, skipping item extraction');
            return;
        }

        if (!recordId) {
            showNotification(`Receipt saved! (${(compressed.size / 1024).toFixed(0)}KB) - Scanning items...`, 'success');
            showScanningSpinner('Scanning receipt...');

            const scanResult = await scanReceiptWithRetries(expenseId, receiptDataUrl, fields, 3);
            hideScanningSpinner();

            if (scanResult.success) {
                if (scanResult.itemCount > 0) {
                    showNotification(`✓ Extracted ${scanResult.itemCount} items from receipt!`, 'success');
                } else {
                    showNotification('Receipt scanned but no items found', 'info');
                }
            } else {
                console.error('Receipt scan failed after 3 retries:', scanResult.error);
                await markScanAsFailed(expenseId, scanResult.error);
                showNotification('Receipt saved but scan failed. Check Receipt Tracker to retry.', 'warning');
            }
        } else {
            showNotification(`Receipt saved! (${(compressed.size / 1024).toFixed(0)}KB) - Ready for manual processing in Receipt Tracker`, 'success');
        }
        
    } catch (error) {
        console.error('Error uploading receipt:', error);
        hideScanningSpinner();
        showNotification('Error: ' + error.message, 'error');
    }
}

async function kickoffBackendReceiptProcessing(expenseId) {
    return;
}

// Auto-extract items from a newly uploaded receipt (runs in background)
async function autoExtractReceiptItems(expenseId, base64Data, mimeType, expenseFields) {
    return;
}

function removeReceipt() {
    currentReceiptData = null;
    document.getElementById('receiptFile').value = '';
    document.getElementById('currentReceipt').classList.add('hidden');
    document.getElementById('receiptUploadBtn').classList.remove('hidden');
}

// Handle receipt file change in expense modal
function handleReceiptFileChange() {
    const fileInput = document.getElementById('receiptFile');
    
    if (!fileInput.files || !fileInput.files[0]) {
        currentReceiptData = null;
        document.getElementById('currentReceipt').classList.add('hidden');
        document.getElementById('receiptUploadBtn').classList.remove('hidden');
        return;
    }
    
    const file = fileInput.files[0];
    
    // Show the receipt preview
    document.getElementById('receiptFileName').textContent = file.name;
    document.getElementById('currentReceipt').classList.remove('hidden');
    document.getElementById('receiptUploadBtn').classList.add('hidden');
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    document.getElementById('receiptViewLink').href = previewUrl;
    
    // Store the file for upload later
    currentReceiptData = file;
    
    // Note: Receipt will be scanned when "Process Unscanned Receipts" is run
    // This avoids issues with app closing mid-scan
}

// ============================================
// FAILED SCANS MANAGEMENT (Database-based)
// ============================================

// Get failed scans from database (expenses with receipt_processing_status = 'failed')
async function getFailedScans() {
    try {
        const failed = await supabaseGet(TABLE_NAME, {
            'has_receipt': 'eq.true',
            'receipt_scanned': 'eq.false'
        }, 100);
        // Filter to only grocery category expenses
        const groceryFailed = (failed || []).filter(expense => {
            const category = (expense.Category || '').toLowerCase();
            if (!(category.includes('grocery') || category.includes('groceries'))) return false;

            const status = String(expense.receipt_processing_status || '').toLowerCase();
            if (status === 'completed' || status === 'dismissed' || status === 'skipped') return false;
            return true;
        });
        return groceryFailed;
    } catch (e) {
        console.error('Error loading failed scans from DB:', e);
        return [];
    }
}

// Mark a scan as failed in database
async function markScanAsFailed(expenseId, errorMessage) {
    try {
        await supabasePatch(TABLE_NAME, expenseId, { 
            receipt_processing_status: 'failed',
            receipt_error: errorMessage?.substring(0, 255) || 'Unknown error'
        });
        console.log(`Marked expense ${expenseId} as failed scan`);
    } catch (e) {
        console.error('Error marking scan as failed:', e);
    }
}

// Clear all failed scans (mark them as dismissed)
async function clearAllFailedScans() {
    if (!confirm('Are you sure you want to dismiss all failed scans? This cannot be undone.')) {
        return;
    }
    
    try {
        const failed = await getFailedScans();
        for (const expense of failed) {
            await supabasePatch(TABLE_NAME, expense.id, { 
                receipt_scanned: true,
                receipt_processing_status: 'dismissed' 
            });
        }
        showNotification(`Dismissed ${failed.length} failed scans`, 'success');
        await renderFailedScansList();
    } catch (e) {
        console.error('Error clearing failed scans:', e);
        showNotification('Error clearing failed scans', 'error');
    }
}

// Render failed scans list in Receipt Tracker (from database)
async function renderFailedScansList() {
    const section = document.getElementById('failedScansSection');
    const list = document.getElementById('failedScansList');
    const countEl = document.getElementById('failedScansCount');
    
    if (!section || !list) return;
    
    const scans = await getFailedScans();
    
    if (scans.length === 0) {
        section.classList.add('hidden');
        return;
    }
    
    section.classList.remove('hidden');
    countEl.textContent = `(${scans.length})`;
    
    list.innerHTML = scans.map(expense => {
        const date = `${expense.Year}-${String(expense.Month || 1).padStart(2, '0')}-${String(expense.Day || 1).padStart(2, '0')}`;
        return `
        <div class="bg-white rounded-lg p-3 border border-red-100 flex items-center justify-between">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <i class="fas fa-receipt text-gray-400"></i>
                    <span class="font-medium text-gray-800 truncate">${escapeHtml(expense.Item || 'Unknown')}</span>
                </div>
                <div class="text-xs text-gray-500 mt-1">
                    <span>${escapeHtml(expense.Category)}</span> • 
                    <span>${date}</span>
                </div>
                ${expense.receipt_error ? `<div class="text-xs text-red-400 mt-1 truncate" title="${escapeHtml(expense.receipt_error)}">${escapeHtml(expense.receipt_error.substring(0, 50))}...</div>` : ''}
            </div>
            <div class="flex gap-2 ml-3">
                <button onclick="retryFailedScan('${expense.id}')" 
                    class="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium">
                    <i class="fas fa-redo mr-1"></i>Retry
                </button>
                <button onclick="dismissFailedScan('${expense.id}')" 
                    class="px-2 py-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors" title="Dismiss">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    }).join('');
}

// Retry a single failed scan (fetches receipt from database)
async function retryFailedScan(expenseId) {
    showScanningSpinner('Loading receipt...');
    
    try {
        const expenses = await supabaseGet(TABLE_NAME, { 'id': `eq.${expenseId}` }, 1, 'id,Item,Category,Year,Month,Day,Actual');
        const expense = expenses?.[0];
        
        if (!expense) {
            hideScanningSpinner();
            showNotification('Expense not found', 'error');
            return;
        }

        const receiptUrl = await getReceiptViewUrl(expenseId);
        if (!receiptUrl) {
            hideScanningSpinner();
            showNotification('Could not extract receipt image', 'error');
            return;
        }

        updateScanningSpinner('Manual retry...', 'Starting');
        const extractedData = await processReceiptWithClientRules(receiptUrl);

        if (!extractedData?.items || extractedData.items.length === 0) {
            throw new Error('No items found in receipt');
        }

        updateScanningSpinner('Saving items...', `Found ${extractedData.items.length} items`);

        // Save items to ReceiptItems table
        const year = expense.Year || new Date().getFullYear();
        const month = String(expense.Month || 1).padStart(2, '0');
        const day = String(expense.Day || 1).padStart(2, '0');
        const purchaseDate = extractedData.date || `${year}-${month}-${day}`;

        await supabaseDeleteWhere(RECEIPT_ITEMS_TABLE, `expense_id=eq.${encodeURIComponent(expenseId)}`);

        for (const item of extractedData.items) {
            const unit = String(item.quantity_unit || '').trim();
            const baseName = String(item.description || item.raw_description || 'Unknown Item').trim() || 'Unknown Item';
            const itemName = unit && unit !== 'ea' ? `${baseName} (${unit})` : baseName;

            await supabasePost(RECEIPT_ITEMS_TABLE, {
                expense_id: expenseId,
                item_name: itemName,
                quantity: isFinite(parseNumberLoose(item.quantity)) ? parseNumberLoose(item.quantity) : 1,
                unit_price: isFinite(parseNumberLoose(item.unit_price)) ? parseNumberLoose(item.unit_price) : 0,
                total_price: isFinite(parseNumberLoose(item.total_price)) ? parseNumberLoose(item.total_price) : 0,
                store: extractedData.store || expense.Item || 'Unknown',
                purchase_date: purchaseDate
            });
        }

        await supabasePatch(TABLE_NAME, expenseId, {
            receipt_scanned: true,
            receipt_processing_status: 'completed',
            receipt_error: null
        });

        hideScanningSpinner();
        showNotification(`✓ Extracted ${extractedData.items.length} items!`, 'success');
        await renderFailedScansList();
        const searchInput = document.getElementById('itemSearchInput');
        await searchReceiptItems(searchInput?.value || '');

    } catch (error) {
        hideScanningSpinner();
        showNotification('Error retrying scan: ' + error.message, 'error');
    }
}

// Dismiss a failed scan without retrying
async function dismissFailedScan(expenseId) {
    if (!confirm('Dismiss this failed scan? The receipt will remain but items won\'t be extracted.')) {
        return;
    }
    
    try {
        await supabasePatch(TABLE_NAME, expenseId, { 
            receipt_scanned: true, 
            receipt_processing_status: 'dismissed' 
        });
        showNotification('Scan dismissed', 'info');
        await renderFailedScansList();
    } catch (e) {
        console.error('Error dismissing scan:', e);
        showNotification('Error dismissing scan', 'error');
    }
}

// Helper to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// RECEIPT SCANNING SPINNER
// ============================================

let activeScanningSpinner = null;

async function processReceiptWithClientRules(receiptUrlOrDataUrl) {
    let source = String(receiptUrlOrDataUrl || '');
    if (!source.startsWith('data:')) {
        updateScanningSpinner('Preparing receipt...', 'Downloading image');
        source = await compressReceiptImageToDataUrl(source);
    }

    let lastErr = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            updateScanningSpinner('Extracting items...', `OCR+Gemini (attempt ${attempt}/2)`);
            const extracted = await extractReceiptDataWithOcrSpaceAndGemini(source);
            return normalizeReceiptExtractedData(extracted);
        } catch (e) {
            lastErr = e;
            if (attempt < 2) {
                const waitLabel = RECEIPT_OCR_RETRY_DELAY_MS < 1000
                    ? `${RECEIPT_OCR_RETRY_DELAY_MS}ms`
                    : `${Math.round(RECEIPT_OCR_RETRY_DELAY_MS / 1000)}s`;
                updateScanningSpinner('Retrying...', `Waiting ${waitLabel} before retry`);
                await delay(RECEIPT_OCR_RETRY_DELAY_MS);
            }
        }
    }

    updateScanningSpinner('Extracting items...', 'Gemini image (final attempt)');
    const imgDataUrl = await compressReceiptImageToDataUrl(source, {
        maxWidth: 2400,
        maxHeight: 3200,
        quality: 0.75
    });
    try {
        const extracted = await extractReceiptDataWithGeminiFromImage(imgDataUrl);
        return normalizeReceiptExtractedData(extracted);
    } catch (e) {
        const msg = String((e && e.message) || e || 'Unknown error');
        const prev = String((lastErr && lastErr.message) || lastErr || '').trim();
        throw new Error(prev ? `${prev} | ${msg}` : msg);
    }
}

function showScanningSpinner(message = 'Scanning receipt...') {
    // Remove existing if any
    hideScanningSpinner();
    
    const spinner = document.createElement('div');
    spinner.id = 'receipt-scanning-spinner';
    spinner.className = 'fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border border-purple-200 p-4 flex items-center gap-3 animate-slide-up';
    spinner.style.zIndex = '9999'; // Above modals (z-index: 1000)
    spinner.innerHTML = `
        <div class="relative">
            <div class="w-10 h-10 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600"></div>
            <i class="fas fa-receipt absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-purple-600 text-xs"></i>
        </div>
        <div>
            <div class="font-semibold text-gray-800" id="scanning-spinner-title">${message}</div>
            <div class="text-xs text-gray-500" id="scanning-spinner-status">Extracting items...</div>
        </div>
    `;
    
    document.body.appendChild(spinner);
    activeScanningSpinner = spinner;
}

function updateScanningSpinner(title, status) {
    if (activeScanningSpinner) {
        const titleEl = document.getElementById('scanning-spinner-title');
        const statusEl = document.getElementById('scanning-spinner-status');
        if (titleEl) titleEl.textContent = title;
        if (statusEl) statusEl.textContent = status;
    }
}

function hideScanningSpinner() {
    if (activeScanningSpinner) {
        activeScanningSpinner.remove();
        activeScanningSpinner = null;
    }
    // Also remove by ID in case reference was lost
    const existing = document.getElementById('receipt-scanning-spinner');
    if (existing) existing.remove();
}

// ============================================
// CLIENT-SIDE RECEIPT SCANNING WITH RETRIES
// ============================================

async function scanReceiptWithRetries(expenseId, base64DataUrl, expenseFields, maxRetries = 3) {
    try {
        updateScanningSpinner('Scanning receipt...', 'Starting');
        console.log(`Receipt scan for expense ${expenseId}`);

        const extractedData = await processReceiptWithClientRules(base64DataUrl);

        if (extractedData && extractedData.items && extractedData.items.length > 0) {
                // Success! Save items to database
                updateScanningSpinner('Saving items...', `Found ${extractedData.items.length} items`);
                
                // Determine purchase date
                let purchaseDate = extractedData.date;
                if (!purchaseDate && expenseFields) {
                    const year = expenseFields.Year || new Date().getFullYear();
                    const month = String(expenseFields.Month || 1).padStart(2, '0');
                    const day = String(expenseFields.Day || 1).padStart(2, '0');
                    purchaseDate = `${year}-${month}-${day}`;
                }
                
                await supabaseDeleteWhere(RECEIPT_ITEMS_TABLE, `expense_id=eq.${encodeURIComponent(expenseId)}`);

                // Save items to ReceiptItems table
                for (const item of extractedData.items) {
                    const unit = String(item.quantity_unit || '').trim();
                    const baseName = String(item.description || item.raw_description || 'Unknown Item').trim() || 'Unknown Item';
                    const itemName = unit && unit !== 'ea' ? `${baseName} (${unit})` : baseName;

                    await supabasePost(RECEIPT_ITEMS_TABLE, {
                        expense_id: expenseId,
                        item_name: itemName,
                        quantity: isFinite(parseNumberLoose(item.quantity)) ? parseNumberLoose(item.quantity) : 1,
                        unit_price: isFinite(parseNumberLoose(item.unit_price)) ? parseNumberLoose(item.unit_price) : 0,
                        total_price: isFinite(parseNumberLoose(item.total_price)) ? parseNumberLoose(item.total_price) : 0,
                        store: extractedData.store || expenseFields?.Item || 'Unknown',
                        purchase_date: purchaseDate
                    });
                }
                
                // Mark receipt as scanned (this also clears 'failed' status if retrying)
                await supabasePatch(TABLE_NAME, expenseId, { 
                    receipt_scanned: true, 
                    receipt_processing_status: 'completed',
                    receipt_error: null
                });
                
                return { 
                    success: true, 
                    itemCount: extractedData.items.length,
                    store: extractedData.store
                };
        }

        // No items found - not an error, just no items
        await supabasePatch(TABLE_NAME, expenseId, { 
            receipt_scanned: true, 
            receipt_processing_status: 'completed',
            receipt_error: null
        });
        return { success: true, itemCount: 0 };
    } catch (error) {
        console.error('Receipt scan failed:', error.message);
        return { success: false, error: error?.message || 'Unknown error' };
    }
}

// State for receipt scanner
let currentScannedReceipt = null;

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function openReceiptTracker() {
    closeAllModalsExcept('receiptTrackerModal');
    document.getElementById('receiptTrackerModal').classList.add('active');
    switchReceiptTab('search');
}

function parseReceiptDataUrlFromExpense(expense) {
    if (!expense) return null;
    const receiptData = expense.Receipt;
    if (!receiptData) return null;

    if (typeof receiptData === 'string') {
        if (receiptData.startsWith('data:')) return receiptData;
        if (receiptData.startsWith('[') || receiptData.startsWith('{')) {
            try {
                const parsed = JSON.parse(receiptData);
                if (Array.isArray(parsed) && parsed[0]?.url) return parsed[0].url;
                if (parsed?.url) return parsed.url;
            } catch (e) {
                return null;
            }
        }
        return receiptData;
    }

    if (Array.isArray(receiptData) && receiptData[0]?.url) return receiptData[0].url;
    if (receiptData?.url) return receiptData.url;
    return null;
}

async function compressReceiptImageToDataUrl(receiptUrl, maxBytes = 950 * 1024) {
    let sourceDataUrl = receiptUrl;

    if (!sourceDataUrl.startsWith('data:')) {
        const response = await fetch(sourceDataUrl);
        if (!response.ok) throw new Error(`Failed to fetch receipt image (${response.status})`);
        const blob = await response.blob();
        sourceDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Failed to read receipt image'));
            reader.readAsDataURL(blob);
        });
    }

    const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Failed to load receipt image'));
        i.src = sourceDataUrl;
    });

    let scale = 1;
    const maxDimension = 1600;
    if (img.width > maxDimension || img.height > maxDimension) {
        scale = Math.min(maxDimension / img.width, maxDimension / img.height);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    let quality = 0.85;
    let attempt = 0;
    let out = '';

    while (attempt < 8) {
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        out = canvas.toDataURL('image/jpeg', quality);
        const bytes = estimateDataUrlBytes(out);

        if (bytes <= maxBytes) {
            return out;
        }

        quality = Math.max(0.35, quality - 0.12);
        if (quality <= 0.45) {
            scale = scale * 0.85;
        }

        attempt += 1;
    }

    return out;
}

function estimateDataUrlBytes(dataUrl) {
    const base64Index = String(dataUrl).indexOf('base64,');
    if (base64Index === -1) return String(dataUrl).length;
    const base64 = String(dataUrl).slice(base64Index + 7);
    return Math.floor(base64.length * 0.75);
}

function parseNumberLoose(value) {
    if (value === null || value === undefined) return NaN;
    if (typeof value === 'number') return value;
    const s = String(value);
    const m = s.match(/-?\d+(?:\.\d+)?/);
    if (!m) return NaN;
    return parseFloat(m[0]);
}

function parseWeightDetailLine(rawDesc) {
    const s = String(rawDesc || '').trim();
    if (!s) return null;

    // Must look like a weight pricing detail line (Walmart-style): contains '@' or a per-unit slash segment
    if (!s.includes('@') && !s.includes('/')) return null;

    const qtyUnitMatch = s.match(/(\d+(?:\.\d+)?)\s*(lb|kg|oz|g)\b/i);
    if (!qtyUnitMatch) return null;
    const quantity = parseFloat(qtyUnitMatch[1]);
    const unit = String(qtyUnitMatch[2]).toLowerCase();

    let unitPrice = NaN;
    const slashMatches = [...s.matchAll(/\/\s*(?:\$\s*)?(\d+(?:\.\d+)?)/g)];
    if (slashMatches.length > 0) {
        unitPrice = parseFloat(slashMatches[slashMatches.length - 1][1]);
    } else {
        const atMatch = s.match(/@\s*(?:\$\s*)?(\d+(?:\.\d+)?)/i);
        if (atMatch) unitPrice = parseFloat(atMatch[1]);
    }

    if (!isFinite(unitPrice)) return null;

    // Try to capture an explicit line total (often last number on the line)
    let lineTotal = NaN;
    const nums = [...s.matchAll(/\d+(?:\.\d+)?/g)].map(m => parseFloat(m[0]));
    if (nums.length >= 2) {
        const last = nums[nums.length - 1];
        if (isFinite(last) && last >= 0 && isFinite(unitPrice) && Math.abs(last - unitPrice) > 0.001) {
            lineTotal = last;
        }
    }

    if (!isFinite(quantity) || quantity <= 0) return null;
    return { quantity, unit, unitPrice, lineTotal };
}

function normalizeReceiptExtractedData(extracted) {
    if (!extracted || !Array.isArray(extracted.items)) return extracted;

    const normalizedItems = [];
    const weightLineRegex = /(\d+(?:\.\d+)?)\s*(lb|kg|oz|g)\b/i;

    const parseSignedMoneyFromLine = (raw) => {
        const s = String(raw || '');
        const matches = [...s.matchAll(/\d+\.\d{2}/g)].map(m => m[0]);
        if (matches.length === 0) return NaN;
        const last = matches[matches.length - 1];
        const idx = s.lastIndexOf(last);
        const after = idx >= 0 ? s.slice(idx + last.length) : '';
        const before = idx >= 0 ? s.slice(Math.max(0, idx - 2), idx) : '';
        const hasMinus = /-/.test(after) || /-/.test(before);
        const val = parseFloat(last);
        if (!isFinite(val)) return NaN;
        return hasMinus ? -val : val;
    };

    const isDiscountLine = (descLower, rawDesc, item) => {
        if (descLower.includes('discount') || descLower.includes('coupon') || descLower.includes('rebate') || descLower.includes('savings')) return true;
        if (descLower === 'disc' || descLower.startsWith('disc ') || descLower.startsWith('coupon ')) return true;
        if (descLower.includes('instant') && descLower.includes('savings')) return true;
        const total = parseNumberLoose(item.total_price);
        const signedFromRaw = parseSignedMoneyFromLine(rawDesc);
        if ((isFinite(total) && total < 0) || (isFinite(signedFromRaw) && signedFromRaw < 0)) return true;
        return false;
    };

    for (const rawItem of extracted.items) {
        const item = rawItem && typeof rawItem === 'object' ? { ...rawItem } : {};
        const rawDesc = String(item.raw_description || item.description || '').trim();
        const descLower = rawDesc.toLowerCase();

        if (rawDesc && isDiscountLine(descLower, rawDesc, item) && normalizedItems.length > 0) {
            const prev = normalizedItems[normalizedItems.length - 1];
            const candidate1 = parseNumberLoose(item.total_price);
            const candidate2 = parseNumberLoose(item.unit_price);
            const candidate3 = parseSignedMoneyFromLine(rawDesc);
            let discount = isFinite(candidate1) ? candidate1 : (isFinite(candidate2) ? candidate2 : candidate3);
            if (isFinite(discount) && discount > 0) discount = -discount;

            if (prev && typeof prev === 'object') {
                if (!isFinite(prev.__orig_total)) prev.__orig_total = isFinite(prev.total_price) ? prev.total_price : 0;
                prev.__discount_total = (isFinite(prev.__discount_total) ? prev.__discount_total : 0) + (isFinite(discount) ? discount : 0);

                const netTotal = Math.round((prev.__orig_total + prev.__discount_total) * 100) / 100;
                prev.total_price = isFinite(netTotal) ? Math.max(0, netTotal) : (isFinite(prev.total_price) ? prev.total_price : 0);
                const qty = isFinite(prev.quantity) && prev.quantity > 0 ? prev.quantity : 1;
                prev.unit_price = Math.round((prev.total_price / qty) * 100) / 100;

                if (isFinite(prev.__discount_total) && prev.__discount_total !== 0) {
                    const origLabel = `$${Number(prev.__orig_total || 0).toFixed(2)}`;
                    const discLabel = `${prev.__discount_total < 0 ? '-' : ''}$${Math.abs(prev.__discount_total).toFixed(2)}`;
                    const base = String(prev.description || prev.raw_description || 'Unknown Item').trim() || 'Unknown Item';
                    prev.description = `${base} (Orig ${origLabel}, Disc ${discLabel})`;
                }
            }
            continue;
        }

        const qty = parseNumberLoose(item.quantity);
        const unitPrice = parseNumberLoose(item.unit_price);
        const totalPrice = parseNumberLoose(item.total_price);

        const isLikelyWeightLine =
            Boolean(rawDesc) &&
            Boolean(rawDesc.match(weightLineRegex)) &&
            (descLower.includes('lb') || descLower.includes('kg') || descLower.includes('oz') || descLower.includes(' g'));

        if (isLikelyWeightLine && normalizedItems.length > 0) {
            const parsed = parseWeightDetailLine(rawDesc);
            if (parsed) {
                const wQty = parsed.quantity;
                const wUnit = parsed.unit;
                const wUnitPrice = parsed.unitPrice;
                const wTotal = parsed.lineTotal;
                const prev = normalizedItems[normalizedItems.length - 1];

                prev.quantity = isFinite(wQty) && wQty > 0 ? wQty : (isFinite(prev.quantity) ? prev.quantity : 1);
                prev.quantity_unit = wUnit || prev.quantity_unit || 'ea';
                prev.unit_price = isFinite(wUnitPrice) && wUnitPrice >= 0 ? wUnitPrice : (isFinite(prev.unit_price) ? prev.unit_price : 0);

                if (isFinite(wTotal) && wTotal >= 0) {
                    prev.total_price = Math.round(wTotal * 100) / 100;
                } else if (!isFinite(prev.total_price) || prev.total_price === 0) {
                    const computed = prev.quantity * prev.unit_price;
                    prev.total_price = isFinite(computed) ? Math.round(computed * 100) / 100 : 0;
                }
                continue;
            }
        }

        item.quantity = isFinite(qty) && qty > 0 ? qty : 1;
        item.unit_price = isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
        item.total_price = isFinite(totalPrice) && totalPrice >= 0 ? totalPrice : 0;
        item.quantity_unit = String(item.quantity_unit || '').trim() || 'ea';

        if ((!item.total_price || item.total_price === 0) && item.unit_price && item.quantity) {
            const computed = item.quantity * item.unit_price;
            item.total_price = isFinite(computed) ? Math.round(computed * 100) / 100 : 0;
        }
        if ((!item.unit_price || item.unit_price === 0) && item.total_price && item.quantity) {
            const computed = item.total_price / (item.quantity || 1);
            item.unit_price = isFinite(computed) ? Math.round(computed * 100) / 100 : item.unit_price;
        }

        normalizedItems.push(item);
    }

    return { ...extracted, items: normalizedItems };
}

async function runOcrSpace(receiptDataUrlOrUrl) {
    let dataUrl = String(receiptDataUrlOrUrl || '');
    if (!dataUrl.startsWith('data:')) {
        updateScanningSpinner('Preparing receipt...', 'Downloading image');
        dataUrl = await compressReceiptImageToDataUrl(dataUrl);
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase credentials not configured');
    }

    const endpoint = `${SUPABASE_URL}/functions/v1/ocr-space`;
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ base64Image: dataUrl })
    });

    const rawText = await resp.text().catch(() => '');
    const data = rawText ? safeJsonParse(rawText) : null;
    if (!resp.ok) {
        const msg = data?.error || `OCR proxy failed: ${resp.status}`;
        throw new Error(String(msg));
    }

    const text = data?.text;
    return String(text || '');
}

async function extractReceiptDataWithOcrSpaceAndGemini(receiptUrlOrDataUrl) {
    let ocrInput = receiptUrlOrDataUrl;

    if (String(receiptUrlOrDataUrl).startsWith('data:')) {
        const mimeMatch = String(receiptUrlOrDataUrl).match(/^data:([^;]+);base64,/i);
        const mimeType = (mimeMatch?.[1] || '').toLowerCase();
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'];
        if (mimeType && !allowed.includes(mimeType)) {
            updateScanningSpinner('Preparing receipt...', 'Converting image');
            ocrInput = await compressReceiptImageToDataUrl(receiptUrlOrDataUrl);
        }
    }

    if (String(receiptUrlOrDataUrl).startsWith('data:')) {
        const estimated = estimateDataUrlBytes(receiptUrlOrDataUrl);
        if (estimated > 950 * 1024) {
            updateScanningSpinner('Compressing receipt...', 'Reducing image size');
            ocrInput = await compressReceiptImageToDataUrl(receiptUrlOrDataUrl);
        }
    } else {
        try {
            const head = await fetch(receiptUrlOrDataUrl, { method: 'HEAD' });
            const len = head.headers.get('content-length');
            const bytes = len ? Number(len) : NaN;
            const contentType = (head.headers.get('content-type') || '').toLowerCase();
            if (head.ok && contentType.includes('image/webp')) {
                updateScanningSpinner('Preparing receipt...', 'Converting image');
                ocrInput = await compressReceiptImageToDataUrl(receiptUrlOrDataUrl);
            }
            if (head.ok && isFinite(bytes) && bytes > 950 * 1024) {
                updateScanningSpinner('Compressing receipt...', 'Reducing image size');
                ocrInput = await compressReceiptImageToDataUrl(receiptUrlOrDataUrl);
            }
        } catch (e) {
        }
    }

    updateScanningSpinner('Running OCR...', 'Sending to OCR.Space');
    let ocrText = '';
    try {
        ocrText = await runOcrSpace(ocrInput);
    } catch (e) {
        const msg = String(e?.message || e);
        const sizeLimitHit = msg.includes('Maximum size limit 1024 KB') || msg.includes('File size exceeds');
        if (!sizeLimitHit) throw e;

        updateScanningSpinner('Compressing receipt...', 'Reducing image size');
        const compressed = await compressReceiptImageToDataUrl(receiptUrlOrDataUrl);

        updateScanningSpinner('Running OCR...', 'Retrying with compressed image');
        ocrText = await runOcrSpace(compressed);
    }

    if (!ocrText || ocrText.trim().length < 10) {
        throw new Error('OCR returned no text');
    }

    updateScanningSpinner('Extracting items...', 'Sending OCR text to Gemini');
    const extracted = await extractReceiptDataWithGeminiFromOcrText(ocrText);
    return extracted;
}

function extractGeminiJsonBlock(rawText) {
    let jsonStr = String(rawText || '').trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const start = jsonStr.indexOf('{');
    if (start === -1) return jsonStr;

    let inString = false;
    let escaped = false;
    const stack = [];

    for (let i = start; i < jsonStr.length; i++) {
        const ch = jsonStr[i];
        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{' || ch === '[') {
            stack.push(ch);
            continue;
        }
        if (ch === '}' || ch === ']') {
            if (stack.length) {
                const last = stack[stack.length - 1];
                if ((ch === '}' && last === '{') || (ch === ']' && last === '[')) {
                    stack.pop();
                }
            }
            if (stack.length === 0) {
                return jsonStr.slice(start, i + 1);
            }
        }
    }

    return jsonStr.slice(start);
}

function appendMissingJsonClosers(jsonStr) {
    let inString = false;
    let escaped = false;
    const stack = [];

    for (let i = 0; i < jsonStr.length; i++) {
        const ch = jsonStr[i];
        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{' || ch === '[') {
            stack.push(ch);
            continue;
        }
        if (ch === '}' || ch === ']') {
            if (stack.length) {
                const last = stack[stack.length - 1];
                if ((ch === '}' && last === '{') || (ch === ']' && last === '[')) {
                    stack.pop();
                }
            }
        }
    }

    if (!stack.length) return jsonStr;

    let suffix = '';
    for (let i = stack.length - 1; i >= 0; i--) {
        suffix += stack[i] === '{' ? '}' : ']';
    }
    return jsonStr + suffix;
}

function parseGeminiReceiptJson(textResponse) {
    if (!textResponse) throw new Error('No text response from Gemini');

    const raw = extractGeminiJsonBlock(textResponse);
    const cleaned = raw.replace(/,\s*([}\]])/g, '$1').trim();

    const attempt = safeJsonParse(cleaned);
    if (attempt) return attempt;

    const repaired = appendMissingJsonClosers(cleaned);
    if (repaired !== cleaned) {
        const repairedAttempt = safeJsonParse(repaired);
        if (repairedAttempt) {
            console.warn('Repaired malformed Gemini JSON response.');
            return repairedAttempt;
        }
    }

    const lastObj = cleaned.lastIndexOf('}');
    const lastArr = cleaned.lastIndexOf(']');
    const last = Math.max(lastObj, lastArr);
    if (last > 0) {
        const trimmedAttempt = safeJsonParse(cleaned.slice(0, last + 1));
        if (trimmedAttempt) return trimmedAttempt;
    }

    throw new Error('Gemini JSON parse error: Response was truncated or malformed');
}

function getGeminiTextFromResponse(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts
        .map(part => String(part?.text || ''))
        .join('')
        .trim();
}

function isGeminiGenerationConfigCompatibilityError(message) {
    const msg = String(message || '').toLowerCase();
    if (!msg) return false;
    return (
        msg.includes('unknown name "responsemimetype"') ||
        msg.includes('unknown name "thinkingconfig"') ||
        msg.includes('cannot find field') ||
        (msg.includes('invalid json payload') && msg.includes('generationconfig'))
    );
}

async function callGeminiGenerateContent(apiKey, requestBody, options = {}) {
    const { allowLegacyConfigFallback = true } = options;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const send = async (body) => {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await resp.json().catch(() => null);
        return { resp, data };
    };

    let { resp, data } = await send(requestBody);
    if (resp.ok) return data;

    const errMsg = data?.error?.message || `Gemini request failed: ${resp.status}`;
    if (!allowLegacyConfigFallback || !isGeminiGenerationConfigCompatibilityError(errMsg)) {
        throw new Error(String(errMsg));
    }

    const legacyRequestBody = {
        ...requestBody,
        generationConfig: {
            temperature: requestBody?.generationConfig?.temperature ?? 0.1,
            maxOutputTokens: requestBody?.generationConfig?.maxOutputTokens ?? 4096
        }
    };

    ({ resp, data } = await send(legacyRequestBody));
    if (!resp.ok) {
        const legacyErrMsg = data?.error?.message || `Gemini request failed: ${resp.status}`;
        throw new Error(String(legacyErrMsg));
    }

    return data;
}

async function parseGeminiReceiptResponseWithRetry(apiKey, requestBody) {
    let data = await callGeminiGenerateContent(apiKey, requestBody);
    let finishReason = String(data?.candidates?.[0]?.finishReason || '').trim();
    let textResponse = getGeminiTextFromResponse(data);

    try {
        return parseGeminiReceiptJson(textResponse);
    } catch (e) {
        if (finishReason !== 'MAX_TOKENS') throw e;

        const retryRequestBody = {
            ...requestBody,
            generationConfig: {
                ...requestBody.generationConfig,
                maxOutputTokens: Math.max(8192, requestBody.generationConfig?.maxOutputTokens || 0)
            }
        };

        data = await callGeminiGenerateContent(apiKey, retryRequestBody);
        finishReason = String(data?.candidates?.[0]?.finishReason || '').trim();
        textResponse = getGeminiTextFromResponse(data);

        try {
            return parseGeminiReceiptJson(textResponse);
        } catch (retryErr) {
            if (finishReason === 'MAX_TOKENS') {
                throw new Error(`Gemini output truncated (MAX_TOKENS): ${retryErr.message}`);
            }
            throw retryErr;
        }
    }
}

async function extractReceiptDataWithGeminiFromOcrText(ocrText) {
    const apiKey = await getGeminiApiKey();

    const prompt = `You are given OCR text extracted from a grocery receipt. Extract receipt data and return ONLY valid JSON.

Return JSON in this exact schema:
{
  "store": "store/merchant name",
  "date": "YYYY-MM-DD format",
  "total": number,
  "items": [
    {
      "raw_description": "exact line item text from receipt",
      "description": "cleaned, normalized grocery item name",
      "quantity": number,
      "quantity_unit": "lb|kg|oz|g|ct|ea|gal|qt|pt|l|ml",
      "unit_price": number,
      "total_price": number
    }
  ]
}

Rules:
- Return ONLY JSON (no markdown)
- Normalize items: remove store codes, abbreviations, and extra whitespace
- Keep brand if it's important for identifying the item
- quantity_unit must be one of the allowed values (default "ea")
- Prices should be numbers without currency symbols
- Keep output compact JSON (no pretty printing)
- IMPORTANT: Do not emit discounts/coupons as standalone items. If a discount line appears for an item, fold it into that item's total_price (net) and keep the product as a single item.

OCR TEXT:
${ocrText}`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            thinkingConfig: {
                thinkingBudget: 0
            }
        }
    };

    const parsed = await parseGeminiReceiptResponseWithRetry(apiKey, requestBody);

    return normalizeReceiptExtractedData(parsed);
}

async function extractReceiptDataWithGeminiFromImage(imageDataUrl) {
    const apiKey = await getGeminiApiKey();
    const m = String(imageDataUrl || '').match(/^data:([^;]+);base64,(.+)$/i);
    if (!m) throw new Error('Invalid imageDataUrl');

    const prompt = `You are given an image of a grocery receipt. Extract receipt data and return ONLY valid JSON.

Return JSON in this exact schema:
{
  "store": "store/merchant name",
  "date": "YYYY-MM-DD format",
  "total": number,
  "items": [
    {
      "raw_description": "exact line item text from receipt",
      "description": "cleaned, normalized grocery item name",
      "quantity": number,
      "quantity_unit": "lb|kg|oz|g|ct|ea|gal|qt|pt|l|ml",
      "unit_price": number,
      "total_price": number
    }
  ]
}

Rules:
- Return ONLY JSON (no markdown)
- Normalize items: remove store codes, abbreviations, and extra whitespace
- Keep brand if it's important for identifying the item
- quantity_unit must be one of the allowed values (default "ea")
- Prices should be numbers without currency symbols
- Keep output compact JSON (no pretty printing)
- IMPORTANT: Do not emit discounts/coupons as standalone items. If a discount line appears for an item, fold it into that item's total_price (net) and keep the product as a single item.`;

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                {
                    inline_data: {
                        mime_type: m[1],
                        data: m[2]
                    }
                }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            thinkingConfig: {
                thinkingBudget: 0
            }
        }
    };

    const parsed = await parseGeminiReceiptResponseWithRetry(apiKey, requestBody);

    return normalizeReceiptExtractedData(parsed);
}

function closeReceiptTracker() {
    document.getElementById('receiptTrackerModal').classList.remove('active');
}

function switchReceiptTab(tabName) {
    // Update tabs
    document.getElementById('tab-scan').className = tabName === 'scan' ? 
        'flex-1 py-3 px-4 text-center border-b-2 border-purple-600 font-semibold text-purple-600' : 
        'flex-1 py-3 px-4 text-center border-b-2 border-transparent hover:text-gray-600 text-gray-500';
    
    document.getElementById('tab-search').className = tabName === 'search' ? 
        'flex-1 py-3 px-4 text-center border-b-2 border-purple-600 font-semibold text-purple-600' : 
        'flex-1 py-3 px-4 text-center border-b-2 border-transparent hover:text-gray-600 text-gray-500';

    // Show content
    document.getElementById('content-scan').classList.toggle('hidden', tabName !== 'scan');
    document.getElementById('content-search').classList.toggle('hidden', tabName !== 'search');

    if (tabName === 'search') {
        searchReceiptItems(''); // Load initial history
        renderFailedScansList(); // Show failed scans if any
    }
}

function handleNewReceiptFile(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('newReceiptPreview').src = e.target.result;
            document.getElementById('uploadPlaceholder').classList.add('hidden');
            document.getElementById('uploadPreview').classList.remove('hidden');
            document.getElementById('newReceiptName').textContent = file.name;
            document.getElementById('processReceiptBtn').disabled = false;
        };
        reader.readAsDataURL(file);
    }
}

async function processReceiptWithGemini() {
    const fileInput = document.getElementById('newReceiptFile');
    const processBtn = document.getElementById('processReceiptBtn');
    
    if (!fileInput.files[0]) return;

    processBtn.disabled = true;
    processBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';

    try {
        const previewImg = document.getElementById('newReceiptPreview');
        let dataUrl = previewImg?.src || '';
        if (!dataUrl || !String(dataUrl).startsWith('data:')) {
            const file = fileInput.files[0];
            dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error('Failed to read receipt image'));
                reader.readAsDataURL(file);
            });
        }

        showScanningSpinner('Processing receipt...');
        const receiptData = await processReceiptWithClientRules(dataUrl);
        hideScanningSpinner();

        const store = receiptData?.store || 'Unknown Store';
        const date = receiptData?.date || new Date().toISOString().split('T')[0];
        const total = parseFloat(receiptData?.total) || 0;
        const items = (receiptData?.items || []).map(item => ({
            description: item.description || item.raw_description || 'Unknown Item',
            quantity: isFinite(parseNumberLoose(item.quantity)) ? parseNumberLoose(item.quantity) : 1,
            unit_price: isFinite(parseNumberLoose(item.unit_price)) ? parseNumberLoose(item.unit_price) : 0,
            total_amount: isFinite(parseNumberLoose(item.total_price)) ? parseNumberLoose(item.total_price) : 0
        }));

        currentScannedReceipt = {
            store,
            date,
            total,
            items
        };

        displayScanResults(currentScannedReceipt);
        showNotification('Receipt processed successfully!', 'success');

    } catch (error) {
        console.error('Receipt processing error:', error);
        hideScanningSpinner();
        showNotification('Failed to process receipt: ' + error.message, 'error');
    } finally {
        processBtn.disabled = false;
        processBtn.innerHTML = '<i class="fas fa-magic mr-2"></i>Extract Items & Prices';
    }
}

// Helper function to convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function displayScanResults(data) {
    document.getElementById('scanStore').textContent = data.store;
    document.getElementById('scanDate').textContent = data.date;
    document.getElementById('scanTotal').textContent = formatCurrency(data.total);
    
    const tbody = document.getElementById('scanItemsList');
    tbody.innerHTML = '';
    
    data.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'bg-white border-b hover:bg-gray-50';
        tr.innerHTML = `
            <td class="px-4 py-3 font-medium text-gray-900">${item.description}</td>
            <td class="px-4 py-3 text-right text-gray-500">${item.quantity}</td>
            <td class="px-4 py-3 text-right font-medium">${formatCurrency(item.total_amount || (item.quantity * item.unit_price))}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('scanResults').classList.remove('hidden');
}

function resetScan() {
    document.getElementById('newReceiptFile').value = '';
    document.getElementById('uploadPlaceholder').classList.remove('hidden');
    document.getElementById('uploadPreview').classList.add('hidden');
    document.getElementById('processReceiptBtn').disabled = true;
    document.getElementById('scanResults').classList.add('hidden');
    currentScannedReceipt = null;
}

async function saveScannedReceipt() {
    if (!currentScannedReceipt) return;
    
    try {
        showNotification('Saving items to database...', 'info');
        
        // Save each item to Supabase
        for (const item of currentScannedReceipt.items) {
            const itemData = {
                expense_id: null, // No expense link when manually scanning
                item_name: item.description,
                quantity: item.quantity || 1,
                unit_price: item.unit_price || 0,
                total_price: item.total_amount || (item.quantity * item.unit_price) || 0,
                store: currentScannedReceipt.store,
                purchase_date: currentScannedReceipt.date
            };
            
            await supabasePost(RECEIPT_ITEMS_TABLE, itemData);
        }
        
        showNotification(`Saved ${currentScannedReceipt.items.length} items to database`, 'success');
        resetScan();
        switchReceiptTab('search');
        
    } catch (error) {
        console.error('Error saving receipt items:', error);
        showNotification('Failed to save items: ' + error.message, 'error');
    }
}

async function searchReceiptItems(query) {
    const container = document.getElementById('itemSearchResults');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = `
        <div class="text-center text-gray-500 py-10">
            <i class="fas fa-spinner fa-spin text-4xl mb-3 text-purple-500"></i>
            <p>Searching...</p>
        </div>`;
    
    try {
        // Build filter for Supabase query
        let results;
        const receiptItemsColumns = 'id,expense_id,item_name,quantity,total_price,store,purchase_date';
        if (query && query.trim()) {
            // Search by item name using ilike (case-insensitive)
            results = await supabaseGet(RECEIPT_ITEMS_TABLE, {
                'item_name': `ilike.%${query}%`
            }, 100, receiptItemsColumns, 'purchase_date.desc');
        } else {
            // Get all items, sorted by date
            results = await supabaseGet(RECEIPT_ITEMS_TABLE, {}, 100, receiptItemsColumns, 'purchase_date.desc');
        }
        
        if (!results || results.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-10">
                    <i class="fas fa-search text-4xl mb-3 opacity-30"></i>
                    <p>${query ? `No items found matching "${query}"` : 'No items in history yet. Scan a receipt to get started!'}</p>
                </div>`;
            return;
        }

        const splitDiscountFromItemName = (name) => {
            const s = String(name || '').trim();
            const m = s.match(/^(.*)\s\(Orig\s(\$\d+\.\d{2}),\sDisc\s(-?\$\d+\.\d{2})\)$/);
            if (!m) return { title: s, orig: '', disc: '' };
            return { title: String(m[1] || '').trim(), orig: String(m[2] || '').trim(), disc: String(m[3] || '').trim() };
        };

        container.innerHTML = results.map(r => `
            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center">
                <div class="flex-1">
                    ${(() => {
                        const parts = splitDiscountFromItemName(r.item_name);
                        const title = parts.title || r.item_name;
                        const hasDisc = Boolean(parts.orig) && Boolean(parts.disc);
                        const discClass = String(parts.disc || '').trim().startsWith('-') ? 'text-green-700' : 'text-gray-600';
                        return `
                            <div class="font-bold text-gray-800">${escapeHtml(title)}</div>
                            ${hasDisc ? `
                                <div class="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                    <span class="inline-flex items-center px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">Deal</span>
                                    <span>Orig ${escapeHtml(parts.orig)}</span>
                                    <span class="${discClass}">Disc ${escapeHtml(parts.disc)}</span>
                                </div>
                            ` : ''}
                        `;
                    })()}
                    <div class="text-xs text-gray-500">
                        <i class="fas fa-store mr-1"></i>${r.store || 'Unknown'} • 
                        <i class="fas fa-calendar mr-1"></i>${r.purchase_date || 'Unknown'}
                    </div>
                </div>
                <div class="text-right flex items-center gap-3">
                    <div>
                        <div class="font-bold text-purple-600">${formatCurrency(r.total_price)}</div>
                        ${(() => {
                            const q = parseNumberLoose(r.quantity);
                            if (!isFinite(q) || q <= 0) return '';
                            if (Math.abs(q - 1) <= 0.001) return '';
                            const display = q < 1 ? q.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : q;
                            return `<div class="text-xs text-gray-400">Qty: ${display}</div>`;
                        })()}
                    </div>
                    ${r.expense_id ? `
                        <button onclick="viewReceiptFromExpense('${r.expense_id}')" 
                                class="text-purple-500 hover:text-purple-700 p-2 rounded-full hover:bg-purple-50 transition-colors"
                                title="View Receipt">
                            <i class="fas fa-receipt text-lg"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error searching receipt items:', error);
        container.innerHTML = `
            <div class="text-center text-gray-500 py-10">
                <i class="fas fa-exclamation-triangle text-4xl mb-3 text-red-400"></i>
                <p>Error loading items. Make sure you've run the SQL script to create the ReceiptItems table.</p>
            </div>`;
    }
}

// Helper function to extract receipt data using Gemini
async function extractReceiptDataWithGemini(base64Data, mimeType) {
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    return await extractReceiptDataWithGeminiFromImage(dataUrl);
}







// Function removed - use saveExpenseToSupabase() instead (Supabase-only implementation)

async function saveExpenseToSupabase(recordId, fields) {
    try {
        // Filter out empty optional fields
        const cleanFields = { ...fields };
        if (!cleanFields.Tags || String(cleanFields.Tags).trim() === '') {
            if (recordId) cleanFields.Tags = null;
            else delete cleanFields.Tags;
        }
        if (!cleanFields.Notes || String(cleanFields.Notes).trim() === '') {
            if (recordId) cleanFields.Notes = null;
            else delete cleanFields.Notes;
        }

        // Save to Supabase
        let savedRecordId;
        if (recordId) {
            // For updates, keep the id
            cleanFields.id = recordId;
            await supabasePatch(TABLE_NAME, recordId, cleanFields);
            savedRecordId = recordId;
        } else {
            // For new records, generate a UUID for the id
            const newId = 'rec' + Date.now() + Math.random().toString(36).substr(2, 9);
            cleanFields.id = newId;

            // Mark this device/expense as the creator BEFORE insert to avoid realtime race/double-notify
            const creatorDeviceId = getOrCreateDeviceId();
            sessionStorage.setItem('last_expense_device_id', creatorDeviceId);
            sessionStorage.setItem('last_expense_id', newId);

            const result = await supabasePost(TABLE_NAME, cleanFields);
            savedRecordId = result.id || newId;

            // Broadcast background push to all other devices
            try {
                await broadcastExpensePush(savedRecordId, cleanFields);
            } catch (e) {
                console.warn('push-expense failed:', e?.message || e);
            }

            // Trigger budget threshold alert (non-blocking)
            try {
                await triggerBudgetAlert(cleanFields);
            } catch (e) {
                console.warn('push-budget-alert failed:', e?.message || e);
            }
        }

        // Create payment entries for contributions
        await createPaymentEntriesFromContributions(cleanFields, savedRecordId);

        // Auto-create budget if needed (don't fail if this errors)
        if (cleanFields.Category) {
            try {
                const year = cleanFields.Year;
                const month = cleanFields.Month;
                
                await loadCategoryBudgets();
                const budgetKey = `${year}-${month}`;
                const monthBudgets = categoryBudgets[budgetKey] || {};
                const budgetInfo = monthBudgets[cleanFields.Category];
                
                if (!budgetInfo) {
                    const newBudget = {
                        id: 'bud' + Date.now() + Math.random().toString(36).substr(2, 9),
                        Year: year,
                        Month: month,
                        Category: cleanFields.Category,
                        Budget: 0,
                        Recurring: false
                    };
                    
                    await supabasePost(BUDGETS_TABLE, newBudget);
                    console.log('Auto-created budget for new category:', cleanFields.Category);
                }
            } catch (budgetError) {
                console.warn('Failed to auto-create budget:', budgetError);
                // Don't fail the whole operation if budget creation fails
            }
        }

        closeModal();
        await loadData();
        showNotification(recordId ? 'Updated!' : 'Added!', 'success');
        
        // Return the saved record info for further processing
        return { id: savedRecordId, ...cleanFields };
    } catch (error) {
        console.error('Error saving to Supabase:', error);
        showNotification('Error: ' + error.message, 'error');
        throw error;
    }
}

async function createPaymentEntriesFromContributions(fields, expenseRecordId) {
    try {
        const payments = [];

        // Create Amar's payment if contribution > 0
        if (fields.AmarContribution && fields.AmarContribution > 0) {
            payments.push({
                Person: 'Amar',
                Amount: fields.AmarContribution,
                Year: fields.Year,
                Month: fields.Month,
                Description: `${fields.Item} - ${fields.Category}`,
                FromExpense: true  // Mark to avoid double counting
            });
        }

        // Create Priya's payment if contribution > 0
        if (fields.PriyaContribution && fields.PriyaContribution > 0) {
            payments.push({
                Person: 'Priya',
                Amount: fields.PriyaContribution,
                Year: fields.Year,
                Month: fields.Month,
                Description: `${fields.Item} - ${fields.Category}`,
                FromExpense: true  // Mark to avoid double counting
            });
        }

        // Save payments to Supabase
        if (payments.length > 0) {
            for (const payment of payments) {
                try {
                    // Add ID for payment
                    payment.id = 'pay' + Date.now() + Math.random().toString(36).substr(2, 9);
                    // Ensure payment is a flat object, not wrapped in 'fields'
                    await supabasePost(PAYMENTS_TABLE, payment);
                    console.log('✅ Payment saved to Supabase');
                } catch (error) {
                    console.error('Error saving payment to Supabase:', error);
                }
            }
        }
    } catch (error) {
        console.error('Error creating payment entries:', error);
        // Don't throw - expense was saved successfully
    }
}

async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;

    showLoader('Deleting expense...');

    try {
        // First, find and delete associated payment records (FromExpense = true)
        try {
            // Get the expense details to find matching payments
            const expense = allExpenses.find(e => e.id === id);
            if (expense) {
                const { Year, Month, Item, Category } = expense.fields;
                
                // Find payments created from this expense
                const relatedPayments = allPayments.filter(p => 
                    p.fields.FromExpense === true &&
                    p.fields.Year === Year &&
                    p.fields.Month === Month &&
                    p.fields.Description?.includes(Item) &&
                    p.fields.Description?.includes(Category)
                );

                // Delete each related payment
                for (const payment of relatedPayments) {
                    await supabaseDelete(PAYMENTS_TABLE, payment.id);
                    console.log('✅ Deleted related payment:', payment.id);
                }
            }
        } catch (paymentError) {
            console.warn('Could not delete related payments:', paymentError);
            // Continue with expense deletion even if payment deletion fails
        }

        // Delete the expense from Supabase
        await supabaseDelete(TABLE_NAME, id);
        console.log('✅ Deleted expense from Supabase');

        await loadData();
        showNotification('Deleted!', 'success');
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Error: ' + error.message, 'error');
    } finally {
        hideLoader();
    }
}

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    notificationText.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    setTimeout(() => notification.style.display = 'none', 3000);
}

function toggleMenu() {
    const menu = document.getElementById('slideMenu');
    const overlay = document.getElementById('menuOverlay');
    const isOpen = menu.style.transform === 'translateX(0px)';

    if (isOpen) {
        menu.style.transform = 'translateX(100%)';
        overlay.style.display = 'none';
    } else {
        menu.style.transform = 'translateX(0px)';
        overlay.style.display = 'block';
    }
}

// Calculate cumulative rollover dues up to a given month
function calculateCumulativeRollover(upToYear, upToMonth) {
    let amarTotalOwed = 0;
    let priyaTotalOwed = 0;
    
    // Start from Nov 2025
    const startYear = 2025;
    const startMonth = 11;
    
    // Loop through all months from Nov 2025 to the specified month
    for (let year = startYear; year <= upToYear; year++) {
        const monthStart = (year === startYear) ? startMonth : 1;
        const monthEnd = (year === upToYear) ? upToMonth : 12;
        
        for (let month = monthStart; month <= monthEnd; month++) {
            const rolloverKey = `rollover_${year}_${String(month).padStart(2, '0')}`;
            const rolloverData = localStorage.getItem(rolloverKey);
            
            if (rolloverData) {
                const data = JSON.parse(rolloverData);
                // Net owed = what they owe minus what they overpaid
                amarTotalOwed += (data.amarOwes - data.amarOverpaid);
                priyaTotalOwed += (data.priyaOwes - data.priyaOverpaid);
            }
        }
    }
    
    return {
        amarOwes: amarTotalOwed > 0 ? amarTotalOwed : 0,
        priyaOwes: priyaTotalOwed > 0 ? priyaTotalOwed : 0,
        amarOverpaid: amarTotalOwed < 0 ? Math.abs(amarTotalOwed) : 0,
        priyaOverpaid: priyaTotalOwed < 0 ? Math.abs(priyaTotalOwed) : 0
    };
}

// Open rollover dues modal
function openRolloverDues() {
    closeAllModalsExcept('rolloverDuesModal');
    const modal = document.getElementById('rolloverDuesModal');
    if (!modal) return;
    
    // Populate year and month dropdowns
    populateRolloverFilters();
    
    // Get current filter from main page
    const yearFilterEl = document.getElementById('yearSelector');
    const monthFilterEl = document.getElementById('monthSelector');
    const parsedYear = yearFilterEl ? parseInt(yearFilterEl.value) : NaN;
    const parsedMonth = monthFilterEl ? parseInt(monthFilterEl.value) : NaN;
    const defaultYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
    const defaultMonth = Number.isFinite(parsedMonth) ? parsedMonth : (new Date().getMonth() + 1);
    
    // Set to current month being viewed (to show what rolled INTO this month)
    document.getElementById('rolloverYearFilter').value = defaultYear;
    document.getElementById('rolloverMonthFilter').value = String(defaultMonth).padStart(2, '0');
    
    // Load the data for that month
    updateRolloverDisplay();
    
    modal.classList.add('active');
}

// Update rollover display based on selected filters
// Shows what rolled INTO the selected month FROM the previous month
function updateRolloverDisplay() {
    const year = parseInt(document.getElementById('rolloverYearFilter').value);
    const month = parseInt(document.getElementById('rolloverMonthFilter').value);

    // Show rollover FROM the selected month INTO the next month
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth === 13) {
        nextMonth = 1;
        nextYear++;
    }

    const rolloverKey = `rollover_${year}_${String(month).padStart(2, '0')}`;
    const rolloverData = localStorage.getItem(rolloverKey);

    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (rolloverData) {
        const data = JSON.parse(rolloverData);

        // Calculate net amounts that roll into the next month
        const amarNet = data.amarOverpaid - data.amarOwes;  // Negative if owed, positive if credit
        const priyaNet = data.priyaOverpaid - data.priyaOwes;

        document.getElementById('rolloverAmarOwes').textContent = amarNet < 0 ? `$${Math.abs(amarNet).toFixed(2)}` : '$0.00';
        document.getElementById('rolloverAmarOverpaid').textContent = amarNet > 0 ? `$${amarNet.toFixed(2)}` : '$0.00';
        document.getElementById('rolloverAmarNet').textContent = `$${amarNet.toFixed(2)}`;
        document.getElementById('rolloverAmarNetLabel').textContent = 'Rolls into next month:';
        document.getElementById('rolloverAmarNet').className = amarNet > 0 ? 'text-green-600 font-bold text-xl' : amarNet < 0 ? 'text-red-600 font-bold text-xl' : 'text-gray-600 font-bold text-xl';

        document.getElementById('rolloverPriyaOwes').textContent = priyaNet < 0 ? `$${Math.abs(priyaNet).toFixed(2)}` : '$0.00';
        document.getElementById('rolloverPriyaOverpaid').textContent = priyaNet > 0 ? `$${priyaNet.toFixed(2)}` : '$0.00';
        document.getElementById('rolloverPriyaNet').textContent = `$${priyaNet.toFixed(2)}`;
        document.getElementById('rolloverPriyaNetLabel').textContent = 'Rolls into next month:';
        document.getElementById('rolloverPriyaNet').className = priyaNet > 0 ? 'text-green-600 font-bold text-xl' : priyaNet < 0 ? 'text-red-600 font-bold text-xl' : 'text-gray-600 font-bold text-xl';

        document.getElementById('rolloverPeriod').textContent = `${monthNames[month]} ${year} → ${monthNames[nextMonth]} ${nextYear}`;
        document.getElementById('rolloverNoData').style.display = 'none';
        document.getElementById('rolloverDataContent').style.display = 'block';
    } else {
        document.getElementById('rolloverPeriod').textContent = `No rollover from ${monthNames[month]} ${year}`;
        document.getElementById('rolloverNoData').style.display = 'block';
        document.getElementById('rolloverDataContent').style.display = 'none';
    }
}

// Populate rollover filter dropdowns
function populateRolloverFilters() {
    const yearSelect = document.getElementById('rolloverYearFilter');
    const monthSelect = document.getElementById('rolloverMonthFilter');
    
    // Populate years from 2025 to current year + 1
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let year = 2025; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
    
    // Populate months
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    monthSelect.innerHTML = '';
    for (let month = 1; month <= 12; month++) {
        const option = document.createElement('option');
        option.value = String(month).padStart(2, '0');
        option.textContent = monthNames[month - 1];
        monthSelect.appendChild(option);
    }
}

function closeRolloverDuesModal() {
    const modal = document.getElementById('rolloverDuesModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

let allFixedExpenses = [];

async function loadFixedExpenses() {
    try {
        let data;

        // Load from Supabase
        try {
            const fixedExpenses = await supabaseGet(FIXED_EXPENSES_TABLE);
            data = { records: fixedExpenses.map(supabaseToAirtable) };
        } catch (error) {
            console.log('Fixed expenses table not found in Supabase');
            allFixedExpenses = [];
            return;
        }

        allFixedExpenses = data.records;
        fixedExpensesLoaded = true;
        if (dataLoaded && !isMaterializingFixedExpenses) {
            await materializeFixedExpensesForCurrentMonth();
        }
    } catch (error) {
        console.log('Could not load fixed expenses:', error);
        allFixedExpenses = [];
    }
}

function isFixedExpenseActiveForMonth(fields, year, month) {
    const startYear = parseInt(fields.StartYear, 10);
    const startMonth = parseInt(fields.StartMonth, 10);
    const targetMonth = parseInt(month, 10);
    if (!Number.isFinite(startYear) || !Number.isFinite(startMonth) || !Number.isFinite(targetMonth)) {
        return false;
    }
    return year > startYear || (year === startYear && targetMonth >= startMonth);
}

function findExistingFixedExpenseEntry(fixedExpense, year, month) {
    const fixedFields = fixedExpense.fields || {};
    const fixedItem = String(fixedFields.Item || '').trim().toLowerCase();
    const fixedCategory = String(fixedFields.Category || '').trim().toLowerCase();
    const fixedAmount = Number(fixedFields.Amount || 0);
    return allExpenses.find(expense => {
        const fields = expense.fields || {};
        const expenseMonth = String(fields.Month || '').padStart(2, '0');
        if (fields.Year !== year || expenseMonth !== String(month).padStart(2, '0')) {
            return false;
        }
        if (fields.FixedExpenseId && fields.FixedExpenseId === fixedExpense.id) {
            return true;
        }
        const itemMatch = String(fields.Item || '').trim().toLowerCase() === fixedItem;
        const categoryMatch = String(fields.Category || '').trim().toLowerCase() === fixedCategory;
        const amountMatch = Math.abs((Number(fields.Actual) || 0) - fixedAmount) < 0.01;
        return itemMatch && categoryMatch && amountMatch;
    });
}

async function materializeFixedExpensesForCurrentMonth() {
    if (!dataLoaded || !fixedExpensesLoaded || isMaterializingFixedExpenses) return;
    if (!Array.isArray(allFixedExpenses) || allFixedExpenses.length === 0) return;

    isMaterializingFixedExpenses = true;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const created = [];

    try {
        for (const fixedExpense of allFixedExpenses) {
            const fields = fixedExpense.fields || {};
            if (!isFixedExpenseActiveForMonth(fields, year, month)) continue;
            if (findExistingFixedExpenseEntry(fixedExpense, year, month)) continue;

            const amount = Number(fields.Amount || 0);
            if (!Number.isFinite(amount) || amount <= 0) continue;

            const newExpense = {
                id: 'rec' + Date.now() + Math.random().toString(36).substr(2, 9),
                Item: String(fields.Item || '').trim(),
                Category: formatCategory(fields.Category || ''),
                Year: year,
                Month: month,
                Day: 1,
                Actual: amount,
                LLC: fields.LLC || 'No',
                AmarContribution: Number(fields.AmarContribution || 0),
                PriyaContribution: Number(fields.PriyaContribution || 0),
                Tags: formatTags(fields.Tags || ''),
                Notes: String(fields.Notes || '').trim(),
                FixedExpenseId: fixedExpense.id,
                IsFixedExpense: true
            };

            const saved = await supabasePost(TABLE_NAME, newExpense);
            const expenseId = saved?.id || newExpense.id;
            await createPaymentEntriesFromContributions(newExpense, expenseId);
            created.push(newExpense);
        }

        if (created.length > 0) {
            await loadData({ silent: true });
            showNotification(`Added ${created.length} fixed expense${created.length > 1 ? 's' : ''} for ${month}/${year}`, 'success');
        }
    } catch (error) {
        console.error('Error materializing fixed expenses:', error);
    } finally {
        isMaterializingFixedExpenses = false;
    }
}

// ===== BUDGET MANAGER =====
// Structure: { "2025-11": { "Gas": { id: "recXXX", amount: 200, recurring: true }, ... }, ... }
let categoryBudgets = {};
let allBudgetRecords = []; // Raw Airtable records

// Calculate rollover (leftover) from previous month for a category
function calculateRollover(category, year, month) {
    // Get previous month
    let prevMonth = parseInt(month) - 1;
    let prevYear = year;
    if (prevMonth < 1) {
        prevMonth = 12;
        prevYear--;
    }
    const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    // Check if category had budget in previous month
    const prevBudgetInfo = categoryBudgets[prevMonthKey] && categoryBudgets[prevMonthKey][category];
    if (!prevBudgetInfo || prevBudgetInfo.amount === 0) {
        return 0; // No previous budget, no rollover
    }

    // Calculate previous month spending
    let prevSpending = 0;
    allExpenses.forEach(exp => {
        if (exp.fields.Year == prevYear &&
            exp.fields.Month == String(prevMonth).padStart(2, '0') &&
            exp.fields.Category &&
            exp.fields.Category.trim() === category) {
            prevSpending += (exp.fields.Actual || 0);
        }
    });

    // Rollover = Budget - Spent (only if positive)
    const rollover = prevBudgetInfo.amount - prevSpending;
    return rollover > 0 ? rollover : 0;
}

async function loadCategoryBudgets() {
    try {
        let data;

        console.log('📋 loadCategoryBudgets: Starting from Supabase');

        // Load from Supabase
        try {
            console.log('📋 Fetching budgets from Supabase table:', BUDGETS_TABLE);
            const budgets = await supabaseGet(BUDGETS_TABLE);
            console.log('📋 Raw budgets from Supabase:', budgets);
            console.log('📋 Number of budget records:', budgets ? budgets.length : 0);

            data = { records: budgets.map(supabaseToAirtable) };
            console.log('📋 Converted budget records:', data.records);
        } catch (error) {
            console.log('⚠️ Budgets table not found in Supabase - will be created on first budget');
            console.error('Error details:', error);
            allBudgetRecords = [];
            categoryBudgets = {};
            return;
        }

        allBudgetRecords = data.records;
        console.log('📋 Total budget records loaded:', allBudgetRecords.length);

        // Convert to nested structure for easy lookup
        categoryBudgets = {};
        allBudgetRecords.forEach(record => {
            const { Category, Year, Month, Amount, Recurring } = record.fields;
            const monthKey = `${Year}-${String(Month).padStart(2, '0')}`;

            console.log(`📋 Processing budget: ${Category} for ${monthKey}, Amount: ${Amount}, Recurring: ${Recurring}`);

            if (!categoryBudgets[monthKey]) {
                categoryBudgets[monthKey] = {};
            }

            categoryBudgets[monthKey][Category] = {
                id: record.id,
                amount: parseFloat(Amount) || 0,
                recurring: Recurring === 'Yes' || Recurring === true
            };
        });

        console.log('📋 categoryBudgets structure:', categoryBudgets);
        console.log('📋 Available months:', Object.keys(categoryBudgets));

        // Check if we need to auto-create budgets for current month from recurring
        await autoCreateRecurringBudgets();

        console.log(`✅ Loaded budgets from Supabase:`, Object.keys(categoryBudgets).length, 'months');
    } catch (error) {
        console.error('❌ Could not load category budgets:', error);
        console.error('Error stack:', error.stack);
        categoryBudgets = {};
        allBudgetRecords = [];
    }
}

async function autoCreateRecurringBudgets() {
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const currentKey = `${currentYear}-${currentMonth}`;

    // If current month doesn't exist, check previous month for recurring budgets
    if (!categoryBudgets[currentKey] || Object.keys(categoryBudgets[currentKey]).length === 0) {
        // Look for previous month
        let prevMonth = parseInt(currentMonth) - 1;
        let prevYear = currentYear;
        if (prevMonth < 1) {
            prevMonth = 12;
            prevYear--;
        }
        const prevKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

        if (categoryBudgets[prevKey]) {
            const budgetsToCreate = [];

            // Collect recurring budgets to copy
            Object.keys(categoryBudgets[prevKey]).forEach(category => {
                const budgetInfo = categoryBudgets[prevKey][category];
                if (budgetInfo.recurring) {
                    budgetsToCreate.push({
                        id: 'bud' + Date.now() + Math.random().toString(36).substr(2, 9),
                        Category: category,
                        Year: currentYear,
                        Month: currentMonth,
                        Amount: budgetInfo.amount,
                        Recurring: 'Yes'
                    });
                }
            });

            if (budgetsToCreate.length > 0) {
                try {
                    // Create all budgets in Supabase
                    for (const budget of budgetsToCreate) {
                        await supabasePost(BUDGETS_TABLE, budget);
                    }
                    console.log(`Auto-created ${budgetsToCreate.length} recurring budgets for ${currentKey}`);
                    // Reload budgets to get the new records
                    await loadCategoryBudgets();
                } catch (error) {
                    console.error('Error auto-creating recurring budgets:', error);
                }
            }
        }
    }
}

function openBudgetManager() {
    closeAllModalsExcept('budgetManagerModal');
    
    // Populate year filter
    const yearFilter = document.getElementById('budgetYearFilter');
    const currentYear = new Date().getFullYear();
    yearFilter.innerHTML = '';
    for (let year = currentYear - 2; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearFilter.appendChild(option);
    }

    // Set current month
    const monthFilter = document.getElementById('budgetMonthFilter');
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    monthFilter.value = currentMonth;

    renderBudgetTable();
    const modal = document.getElementById('budgetManagerModal');
    modal.classList.add('active');
}

function closeBudgetManager() {
    document.getElementById('budgetManagerModal').classList.remove('active');
}

function renderBudgetTable() {
    const tbody = document.getElementById('budgetTableBody');

    // Get selected year and month
    const selectedYear = parseInt(document.getElementById('budgetYearFilter').value);
    const selectedMonth = document.getElementById('budgetMonthFilter').value;
    const monthKey = `${selectedYear}-${selectedMonth}`;

    // Get all unique categories from expenses
    const allCategories = new Set();
    allExpenses.forEach(exp => {
        if (exp.fields.Category) {
            allCategories.add(exp.fields.Category.trim());
        }
    });

    // Add categories from this month's budget
    if (categoryBudgets[monthKey]) {
        Object.keys(categoryBudgets[monthKey]).forEach(cat => allCategories.add(cat));
    }

    if (allCategories.size === 0) {
        tbody.innerHTML = `
                     <tr class="no-categories-row"><td colspan="6" class="text-center py-8 text-gray-400"><i class="fas fa-inbox text-3xl mb-2"></i><p>No categories found. Add some expenses first!</p></td></tr>
                     <div class="budget-card text-center py-8 text-gray-400 border-none shadow-none">
                         <i class="fas fa-inbox text-3xl mb-2"></i>
                         <p class="text-sm">No categories found. Add some expenses first!</p>
                     </div>
                 `;
        return;
    }

    // Get spending for selected month per category
    const monthSpending = {};
    allExpenses.forEach(exp => {
        if (exp.fields.Year == selectedYear && exp.fields.Month == selectedMonth && exp.fields.Category) {
            const cat = exp.fields.Category.trim();
            monthSpending[cat] = (monthSpending[cat] || 0) + (exp.fields.Actual || 0);
        }
    });

    // Ensure monthKey exists in budgets
    if (!categoryBudgets[monthKey]) {
        categoryBudgets[monthKey] = {};
    }

    // Sort categories alphabetically
    const sortedCategories = [...allCategories].sort();

    tbody.innerHTML = sortedCategories.map(category => {
        const budgetInfo = categoryBudgets[monthKey][category] || { amount: 0, recurring: false };
        const baseBudget = budgetInfo.amount || 0;
        const isRecurring = budgetInfo.recurring || false;
        const spent = monthSpending[category] || 0;

        // Calculate rollover from previous month
        const rollover = calculateRollover(category, selectedYear, selectedMonth);
        const totalBudget = baseBudget + rollover;
        const percentage = totalBudget > 0 ? (spent / totalBudget * 100) : 0;

        let statusHTML = '';
        let statusClass = '';

        // Use tolerance for floating point comparison (0.01 = 1 cent)
        const tolerance = 0.01;
        const difference = spent - totalBudget;

        if (totalBudget === 0) {
            statusHTML = '<span class="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium"><i class="fas fa-minus-circle mr-1"></i>No Budget Set</span>';
        } else if (difference > tolerance) {
            // Spent more than budget (accounting for floating point)
            const over = difference;
            statusHTML = `<span class="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium"><i class="fas fa-exclamation-circle mr-1"></i>Over by $${over.toFixed(2)}</span>`;
            statusClass = 'bg-red-50';
        } else if (percentage >= 90) {
            statusHTML = `<span class="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium"><i class="fas fa-exclamation-triangle mr-1"></i>${percentage.toFixed(0)}% Used</span>`;
            statusClass = 'bg-yellow-50';
        } else {
            statusHTML = `<span class="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium"><i class="fas fa-check-circle mr-1"></i>${percentage.toFixed(0)}% Used</span>`;
            statusClass = 'bg-green-50';
        }

        // Build budget display with rollover info
        let budgetDisplayHTML = `
                     <input type="number" 
                            id="budget-${category}" 
                            value="${baseBudget}" 
                            min="0" 
                            step="0.01"
                            class="w-32 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            onchange="updateCategoryBudget('${category.replace(/'/g, "\\'")}', this.value)">
                 `;

        if (rollover > 0) {
            budgetDisplayHTML += `
                         <div class="text-xs text-green-600 mt-1 flex items-center gap-1">
                             <i class="fas fa-plus-circle"></i>
                             <span>$${rollover.toFixed(2)} rollover</span>
                             <span class="text-gray-400">→</span>
                             <span class="font-semibold">$${totalBudget.toFixed(2)} total</span>
                         </div>
                     `;
        }

        // Mobile card HTML
        const mobileCard = `
                     <div class="budget-card ${statusClass}">
                         <div class="budget-card-header">
                             <div class="budget-card-category">${category}</div>
                             <div class="budget-card-recurring">
                                 <input type="checkbox" 
                                        id="recurring-mobile-${category}" 
                                        ${isRecurring ? 'checked' : ''}
                                        class="w-4 h-4 text-purple-600 border-gray-300 rounded cursor-pointer"
                                        onchange="toggleRecurring('${category.replace(/'/g, "\\'")}', this.checked)">
                                 <span>Recurring</span>
                             </div>
                         </div>
                         <div class="budget-card-body">
                             <div class="budget-card-row">
                                 <span class="budget-card-label">Monthly Budget</span>
                                 <input type="number" 
                                        id="budget-mobile-${category}" 
                                        value="${baseBudget}" 
                                        min="0" 
                                        step="0.01"
                                        class="budget-card-input px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        onchange="updateCategoryBudget('${category.replace(/'/g, "\\'")}', this.value)">
                             </div>
                             ${rollover > 0 ? `
                                 <div class="budget-rollover">
                                     <i class="fas fa-plus-circle"></i>
                                     <span>$${rollover.toFixed(2)} rollover → $${totalBudget.toFixed(2)} total</span>
                                 </div>
                             ` : ''}
                             <div class="budget-card-row">
                                 <span class="budget-card-label">Current Spending</span>
                                 <span class="budget-card-value ${spent > totalBudget && totalBudget > 0 ? 'text-red-600' : spent === totalBudget && totalBudget > 0 ? 'text-gray-700' : 'text-green-600'}">
                                     $${spent.toFixed(2)}
                                 </span>
                             </div>
                             <div class="budget-card-row">
                                 <span class="budget-card-label">Status</span>
                                 <div>${statusHTML}</div>
                             </div>
                         </div>
                         <div class="budget-card-actions">
                             <button onclick="deleteCategoryBudget('${category.replace(/'/g, "\\'")}')" 
                                     class="budget-card-delete">
                                 <i class="fas fa-trash mr-1"></i>Delete
                             </button>
                         </div>
                     </div>
                 `;

        // Desktop table row HTML
        const desktopRow = `
                     <tr class="border-b hover:bg-purple-50 transition-colors ${statusClass}">
                         <td class="px-4 py-3 text-sm font-semibold text-gray-800">${category}</td>
                         <td class="px-4 py-3 text-sm">
                             ${budgetDisplayHTML}
                         </td>
                         <td class="px-4 py-3 text-center">
                             <input type="checkbox" 
                                    id="recurring-${category}" 
                                    ${isRecurring ? 'checked' : ''}
                                    class="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500 cursor-pointer"
                                    onchange="toggleRecurring('${category.replace(/'/g, "\\'")}', this.checked)">
                         </td>
                         <td class="px-4 py-3 text-sm font-bold ${spent > totalBudget && totalBudget > 0 ? 'text-red-600' : spent === totalBudget && totalBudget > 0 ? 'text-gray-700' : 'text-green-600'}">
                             $${spent.toFixed(2)}
                         </td>
                         <td class="px-4 py-3 text-sm">${statusHTML}</td>
                         <td class="px-4 py-3 text-center">
                             <button onclick="deleteCategoryBudget('${category.replace(/'/g, "\\'")}')" 
                                     class="text-red-500 hover:text-red-700 text-sm" 
                                     title="Delete Budget">
                                 <i class="fas fa-trash"></i>
                             </button>
                         </td>
                     </tr>
                 `;

        return mobileCard + desktopRow;
    }).join('');

    // Calculate totals for footer
    let grandTotalBudget = 0;
    let grandTotalSpending = 0;

    sortedCategories.forEach(category => {
        const budgetInfo = categoryBudgets[monthKey][category] || { amount: 0, recurring: false };
        const baseBudget = budgetInfo.amount || 0;
        const spent = monthSpending[category] || 0;

        // Calculate rollover from previous month
        const rollover = calculateRollover(category, selectedYear, selectedMonth);
        const totalBudget = baseBudget + rollover;

        grandTotalBudget += totalBudget;
        grandTotalSpending += spent;
    });

    // Update footer totals (desktop)
    document.getElementById('budgetTotalAmount').textContent = `$${grandTotalBudget.toFixed(2)}`;
    document.getElementById('budgetTotalSpending').textContent = `$${grandTotalSpending.toFixed(2)}`;

    // Update footer status
    const totalRemaining = grandTotalBudget - grandTotalSpending;
    const statusEl = document.getElementById('budgetTotalStatus');
    if (grandTotalBudget === 0) {
        statusEl.innerHTML = '<span class="text-gray-400">--</span>';
    } else if (totalRemaining < 0) {
        statusEl.innerHTML = `<span class="text-red-700 font-bold"><i class="fas fa-exclamation-circle mr-1"></i>Over by $${Math.abs(totalRemaining).toFixed(2)}</span>`;
    } else {
        const percentage = (grandTotalSpending / grandTotalBudget * 100).toFixed(0);
        statusEl.innerHTML = `<span class="text-green-700 font-semibold"><i class="fas fa-check-circle mr-1"></i>${percentage}% Used</span>`;
    }

    // Add mobile total summary card
    let statusText = '--';
    if (grandTotalBudget > 0) {
        if (totalRemaining < 0) {
            statusText = `<i class="fas fa-exclamation-circle mr-1"></i>Over by $${Math.abs(totalRemaining).toFixed(2)}`;
        } else {
            const percentage = (grandTotalSpending / grandTotalBudget * 100).toFixed(0);
            statusText = `<i class="fas fa-check-circle mr-1"></i>${percentage}% Used`;
        }
    }

    const mobileTotalCard = `
                 <div class="budget-total-mobile">
                     <div class="text-center mb-3">
                         <div class="text-sm font-semibold opacity-90">TOTAL SUMMARY</div>
                     </div>
                     <div class="budget-total-row">
                         <span class="budget-total-label">Total Budget</span>
                         <span class="budget-total-value">$${grandTotalBudget.toFixed(2)}</span>
                     </div>
                     <div class="budget-total-row">
                         <span class="budget-total-label">Total Spending</span>
                         <span class="budget-total-value">$${grandTotalSpending.toFixed(2)}</span>
                     </div>
                     <div class="budget-total-row">
                         <span class="budget-total-label">Status</span>
                         <span class="budget-total-value text-sm">${statusText}</span>
                     </div>
                 </div>
             `;

    // Append mobile total card to tbody
    tbody.innerHTML += mobileTotalCard;
}

async function updateCategoryBudget(category, value) {
    const budget = parseFloat(value) || 0;
    const selectedYear = parseInt(document.getElementById('budgetYearFilter').value);
    const selectedMonth = document.getElementById('budgetMonthFilter').value;
    const monthKey = `${selectedYear}-${selectedMonth}`;

    // Sync mobile and desktop inputs
    const desktopInput = document.getElementById(`budget-${category}`);
    const mobileInput = document.getElementById(`budget-mobile-${category}`);
    if (desktopInput) desktopInput.value = budget;
    if (mobileInput) mobileInput.value = budget;

    try {
        const budgetInfo = categoryBudgets[monthKey] && categoryBudgets[monthKey][category];

        if (budgetInfo && budgetInfo.id) {
            // Update existing budget in Supabase
            await supabasePatch(BUDGETS_TABLE, budgetInfo.id, { Amount: budget });
        } else {
            // Create new budget in Supabase
            const newBudget = {
                id: 'bud' + Date.now() + Math.random().toString(36).substr(2, 9),
                Category: category,
                Year: selectedYear,
                Month: selectedMonth,
                Amount: budget,
                Recurring: 'No'
            };
            await supabasePost(BUDGETS_TABLE, newBudget);
        }

        await loadCategoryBudgets();
        renderBudgetTable();
        updateStats();
        showNotification(`Budget for ${category} updated to $${budget.toFixed(2)}`, 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function toggleRecurring(category, isRecurring) {
    const selectedYear = parseInt(document.getElementById('budgetYearFilter').value);
    const selectedMonth = document.getElementById('budgetMonthFilter').value;
    const monthKey = `${selectedYear}-${selectedMonth}`;

    // Sync mobile and desktop checkboxes
    const desktopCheckbox = document.getElementById(`recurring-${category}`);
    const mobileCheckbox = document.getElementById(`recurring-mobile-${category}`);
    if (desktopCheckbox) desktopCheckbox.checked = isRecurring;
    if (mobileCheckbox) mobileCheckbox.checked = isRecurring;

    try {
        const budgetInfo = categoryBudgets[monthKey] && categoryBudgets[monthKey][category];

        if (budgetInfo && budgetInfo.id) {
            // Update existing budget in Supabase
            await supabasePatch(BUDGETS_TABLE, budgetInfo.id, { 
                Recurring: isRecurring ? 'Yes' : 'No' 
            });

            await loadCategoryBudgets();
            renderBudgetTable();
            showNotification(`${category} ${isRecurring ? 'marked as recurring' : 'unmarked as recurring'}`, 'success');
        } else {
            showNotification('Budget not found. Please set amount first.', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function deleteCategoryBudget(category) {
    const selectedYear = parseInt(document.getElementById('budgetYearFilter').value);
    const selectedMonth = document.getElementById('budgetMonthFilter').value;
    const monthKey = `${selectedYear}-${selectedMonth}`;

    if (confirm(`Remove budget for ${category} from ${selectedMonth}/${selectedYear}?`)) {
        showLoader('Removing budget...');
        try {
            const budgetInfo = categoryBudgets[monthKey] && categoryBudgets[monthKey][category];

            if (budgetInfo && budgetInfo.id) {
                // Delete from Supabase
                await supabaseDelete(BUDGETS_TABLE, budgetInfo.id);

                await loadCategoryBudgets();
                renderBudgetTable();
                updateStats();
                hideLoader();
                showNotification(`Budget for ${category} removed`, 'success');
            } else {
                hideLoader();
            }
        } catch (error) {
            hideLoader();
            showNotification('Error: ' + error.message, 'error');
        }
    }
}

async function addNewCategoryBudget() {
    const category = prompt('Enter category name:');
    if (category && category.trim()) {
        const trimmed = category.trim();
        const selectedYear = parseInt(document.getElementById('budgetYearFilter').value);
        const selectedMonth = document.getElementById('budgetMonthFilter').value;
        const monthKey = `${selectedYear}-${selectedMonth}`;

        // Check if already exists
        if (categoryBudgets[monthKey] && categoryBudgets[monthKey][trimmed]) {
            showNotification(`Category ${trimmed} already exists for this month`, 'error');
            return;
        }

        try {
            // Create new budget in Supabase
            const newBudget = {
                id: 'bud' + Date.now() + Math.random().toString(36).substr(2, 9),
                Category: trimmed,
                Year: selectedYear,
                Month: selectedMonth,
                Amount: 0,
                Recurring: 'No'
            };
            await supabasePost(BUDGETS_TABLE, newBudget);

            await loadCategoryBudgets();
            renderBudgetTable();
            showNotification(`Category ${trimmed} added`, 'success');
        } catch (error) {
            showNotification('Error: ' + error.message, 'error');
        }
    }
}

function openFixedExpensesModal() {
    closeAllModalsExcept('fixedExpensesModal');
    renderFixedExpenses();
    document.getElementById('fixedExpensesModal').classList.add('active');
}

function closeFixedExpensesModal() {
    document.getElementById('fixedExpensesModal').classList.remove('active');
}

function openAddFixedExpenseForm() {
    closeAllModalsExcept('addFixedExpenseModal');
    document.getElementById('fixedExpenseModalTitle').textContent = 'Add Fixed Expense';
    document.getElementById('fixedExpenseForm').reset();
    document.getElementById('fixedExpenseId').value = '';

    const fixedLLC = document.getElementById('fixedLLC');
    if (fixedLLC) {
        fixedLLC.value = 'No';
        updateFixedLLCButtonState('No');
    }
    const fixedPanel = document.getElementById('fixedMoreDetailsPanel');
    if (fixedPanel) {
        fixedPanel.classList.add('hidden');
        updateFixedMoreDetailsButtonState(false);
    }
    const fixedAmar = document.getElementById('fixedAmarContributionInput');
    const fixedPriya = document.getElementById('fixedPriyaContributionInput');
    const fixedTags = document.getElementById('fixedTags');
    const fixedNotes = document.getElementById('fixedNotes');
    if (fixedAmar) fixedAmar.value = '';
    if (fixedPriya) fixedPriya.value = '';
    if (fixedTags) fixedTags.value = '';
    if (fixedNotes) fixedNotes.value = '';

    // Populate year dropdown
    const yearSelect = document.getElementById('fixedStartYear');
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year <= currentYear + 5; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }

    // Set current month
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    document.getElementById('fixedStartMonth').value = currentMonth;

    document.getElementById('addFixedExpenseModal').classList.add('active');
}

function closeAddFixedExpenseForm() {
    document.getElementById('addFixedExpenseModal').classList.remove('active');
}

function renderFixedExpenses() {
    const container = document.getElementById('fixedExpensesList');

    if (allFixedExpenses.length === 0) {
        container.innerHTML = `
                     <div class="text-center py-8 text-gray-400">
                         <i class="fas fa-inbox text-4xl mb-3"></i>
                         <p>No fixed expenses yet</p>
                     </div>
                 `;
        return;
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    container.innerHTML = allFixedExpenses.map(expense => {
        const fields = expense.fields;
        const startMonth = monthNames[parseInt(fields.StartMonth) - 1] || 'N/A';
        const amount = fields.Amount || 0;
        const amar = Number(fields.AmarContribution || 0);
        const priya = Number(fields.PriyaContribution || 0);
        const contributionLine = amar || priya
            ? `<p class="text-xs text-gray-500 mt-1">Contrib: Amar $${amar.toFixed(2)}, Priya $${priya.toFixed(2)}</p>`
            : '';
        return `
                    <div class="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h4 class="font-bold text-gray-800">${fields.Item || 'Unnamed'}</h4>
                                <p class="text-sm text-gray-600">${fields.Category || 'N/A'}</p>
                                <p class="text-xs text-gray-500 mt-1">Starts: ${startMonth} ${fields.StartYear || 'N/A'}</p>
                                ${contributionLine}
                            </div>
                            <div class="text-right">
                                <p class="text-lg font-bold text-purple-600">$${amount.toFixed(2)}</p>
                                <span class="text-xs badge ${fields.LLC === 'Yes' ? 'badge-llc' : 'badge-personal'}">${fields.LLC || 'No'}</span>
                            </div>
                        </div>
                        <div class="flex gap-2 mt-3">
                            <button onclick="editFixedExpense('${expense.id}')" class="text-blue-500 hover:text-blue-700 text-sm">
                                <i class="fas fa-edit mr-1"></i>Edit
                            </button>
                            <button onclick="deleteFixedExpense('${expense.id}')" class="text-red-500 hover:text-red-700 text-sm">
                                <i class="fas fa-trash mr-1"></i>Delete
                            </button>
                        </div>
                    </div>
                `;
    }).join('');
}

async function saveFixedExpense(event) {
    event.preventDefault();

    const id = document.getElementById('fixedExpenseId').value;
    const amount = parseFloat(document.getElementById('fixedAmount').value);
    if (!amount || amount <= 0) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }

    let amarContribution = parseFloat(document.getElementById('fixedAmarContributionInput')?.value) || 0;
    let priyaContribution = parseFloat(document.getElementById('fixedPriyaContributionInput')?.value) || 0;
    const totalContribution = amarContribution + priyaContribution;
    const contributionMismatch = Math.abs(totalContribution - amount) > 0.01;

    if ((amarContribution <= 0 && priyaContribution <= 0) || contributionMismatch) {
        const contributionChoice = await showContributionHelper(amount, amarContribution, priyaContribution);
        if (contributionChoice === 'cancel') {
            return;
        } else if (contributionChoice === 'amar') {
            amarContribution = amount;
            priyaContribution = 0;
            if (document.getElementById('fixedAmarContributionInput')) {
                document.getElementById('fixedAmarContributionInput').value = amount;
            }
            if (document.getElementById('fixedPriyaContributionInput')) {
                document.getElementById('fixedPriyaContributionInput').value = 0;
            }
        } else if (contributionChoice === 'priya') {
            amarContribution = 0;
            priyaContribution = amount;
            if (document.getElementById('fixedAmarContributionInput')) {
                document.getElementById('fixedAmarContributionInput').value = 0;
            }
            if (document.getElementById('fixedPriyaContributionInput')) {
                document.getElementById('fixedPriyaContributionInput').value = amount;
            }
        } else if (contributionChoice === 'split') {
            const half = amount / 2;
            amarContribution = half;
            priyaContribution = half;
            if (document.getElementById('fixedAmarContributionInput')) {
                document.getElementById('fixedAmarContributionInput').value = half;
            }
            if (document.getElementById('fixedPriyaContributionInput')) {
                document.getElementById('fixedPriyaContributionInput').value = half;
            }
        }
    }

    const fields = {
        Item: document.getElementById('fixedItemName').value.trim(),
        Category: formatCategory(document.getElementById('fixedCategory').value),
        Amount: amount,
        LLC: document.getElementById('fixedLLC').value,
        StartYear: parseInt(document.getElementById('fixedStartYear').value),
        StartMonth: document.getElementById('fixedStartMonth').value,
        AmarContribution: amarContribution,
        PriyaContribution: priyaContribution,
        Tags: formatTags(document.getElementById('fixedTags')?.value || ''),
        Notes: document.getElementById('fixedNotes')?.value.trim() || ''
    };

    showLoader('Saving fixed expense...');
    try {
        if (id) {
            // Update existing in Supabase
            await supabasePatch(FIXED_EXPENSES_TABLE, id, fields);
        } else {
            // Create new in Supabase
            const newFixedExpense = {
                id: 'fix' + Date.now() + Math.random().toString(36).substr(2, 9),
                ...fields
            };
            await supabasePost(FIXED_EXPENSES_TABLE, newFixedExpense);
        }

        closeAddFixedExpenseForm();
        await loadFixedExpenses();
        renderFixedExpenses();
        hideLoader();
        showNotification(id ? 'Fixed expense updated!' : 'Fixed expense added!', 'success');
    } catch (error) {
        hideLoader();
        showNotification('Error: ' + error.message, 'error');
    }
}

async function editFixedExpense(id) {
    const expense = allFixedExpenses.find(e => e.id === id);
    if (!expense) return;

    document.getElementById('fixedExpenseModalTitle').textContent = 'Edit Fixed Expense';
    document.getElementById('fixedExpenseId').value = id;
    document.getElementById('fixedItemName').value = expense.fields.Item;
    document.getElementById('fixedCategory').value = expense.fields.Category;
    document.getElementById('fixedAmount').value = expense.fields.Amount;
    document.getElementById('fixedLLC').value = expense.fields.LLC || 'No';
    updateFixedLLCButtonState(document.getElementById('fixedLLC').value);
    if (document.getElementById('fixedAmarContributionInput')) {
        document.getElementById('fixedAmarContributionInput').value = expense.fields.AmarContribution || '';
    }
    if (document.getElementById('fixedPriyaContributionInput')) {
        document.getElementById('fixedPriyaContributionInput').value = expense.fields.PriyaContribution || '';
    }
    if (document.getElementById('fixedTags')) {
        document.getElementById('fixedTags').value = expense.fields.Tags || '';
    }
    if (document.getElementById('fixedNotes')) {
        document.getElementById('fixedNotes').value = expense.fields.Notes || '';
    }

    // Populate year dropdown
    const yearSelect = document.getElementById('fixedStartYear');
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year <= currentYear + 5; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === expense.fields.StartYear) option.selected = true;
        yearSelect.appendChild(option);
    }

    document.getElementById('fixedStartMonth').value = expense.fields.StartMonth;

    const hasDetails =
        Number(expense.fields.AmarContribution || 0) > 0 ||
        Number(expense.fields.PriyaContribution || 0) > 0 ||
        (expense.fields.Tags && String(expense.fields.Tags).trim()) ||
        (expense.fields.Notes && String(expense.fields.Notes).trim());
    const panel = document.getElementById('fixedMoreDetailsPanel');
    if (panel) {
        if (hasDetails) {
            panel.classList.remove('hidden');
            updateFixedMoreDetailsButtonState(true);
        } else {
            panel.classList.add('hidden');
            updateFixedMoreDetailsButtonState(false);
        }
    }

    document.getElementById('addFixedExpenseModal').classList.add('active');
}

async function deleteFixedExpense(id) {
    if (!confirm('Delete this fixed expense? This will not affect existing expenses.')) return;

    showLoader('Deleting fixed expense...');
    try {
        // Delete from Supabase
        await supabaseDelete(FIXED_EXPENSES_TABLE, id);

        await loadFixedExpenses();
        renderFixedExpenses();
        hideLoader();
        showNotification('Fixed expense deleted!', 'success');
    } catch (error) {
        hideLoader();
        showNotification('Error: ' + error.message, 'error');
    }
}

let allLLCExpenses = [];

async function loadLLCExpenses() {
    try {
        let data;

        // Load from Supabase
        try {
            const llcExpenses = await supabaseGet(LLC_EXPENSES_TABLE);
            data = { records: llcExpenses.map(supabaseToAirtable) };
        } catch (error) {
            console.log('LLC expenses table not found in Supabase');
            allLLCExpenses = [];
            return;
        }

        allLLCExpenses = data.records;
    } catch (error) {
        console.log('Could not load LLC expenses:', error);
        allLLCExpenses = [];
    }
}

function openLLCExpensesModal() {
    closeAllModalsExcept('llcExpensesModal');
    renderLLCExpenses();
    document.getElementById('llcExpensesModal').classList.add('active');
}

function closeLLCExpensesModal() {
    document.getElementById('llcExpensesModal').classList.remove('active');
}

function openAddLLCExpenseForm() {
    closeAllModalsExcept('addLLCExpenseModal');
    document.getElementById('llcExpenseModalTitle').textContent = 'Add LLC Eligible Expense';
    document.getElementById('llcExpenseForm').reset();
    document.getElementById('llcExpenseId').value = '';

    // Populate existing categories from all expenses
    populateExistingCategories();

    document.getElementById('addLLCExpenseModal').classList.add('active');
}

function closeAddLLCExpenseForm() {
    document.getElementById('addLLCExpenseModal').classList.remove('active');
}

function populateExistingCategories() {
    const datalist = document.getElementById('existingCategories');
    datalist.innerHTML = '';

    // Get unique categories from all expenses
    const categories = new Set();
    allExpenses.forEach(exp => {
        if (exp.fields.Category) {
            categories.add(exp.fields.Category);
        }
    });

    // Add to datalist
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        datalist.appendChild(option);
    });
}

function renderLLCExpenses() {
    const container = document.getElementById('llcExpensesList');

    if (allLLCExpenses.length === 0) {
        container.innerHTML = `
                     <div class="text-center py-8 text-gray-400">
                         <i class="fas fa-inbox text-4xl mb-3"></i>
                         <p>No LLC eligible expenses defined yet</p>
                     </div>
                 `;
        return;
    }

    container.innerHTML = allLLCExpenses.map(expense => {
        const fields = expense.fields;
        return `
                     <div class="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                         <div class="flex justify-between items-start">
                             <div class="flex-1">
                                 <h4 class="font-bold text-gray-800">${fields.Item || 'Unnamed'}</h4>
                                 <p class="text-sm text-gray-600"><i class="fas fa-tag mr-1"></i>${fields.Category || 'N/A'}</p>
                             </div>
                             <div class="flex gap-2">
                                 <button onclick="editLLCExpense('${expense.id}')" class="text-blue-500 hover:text-blue-700 text-sm">
                                     <i class="fas fa-edit"></i>
                                 </button>
                                 <button onclick="deleteLLCExpense('${expense.id}')" class="text-red-500 hover:text-red-700 text-sm">
                                     <i class="fas fa-trash"></i>
                                 </button>
                             </div>
                         </div>
                     </div>
                 `;
    }).join('');
}

async function saveLLCExpense(event) {
    event.preventDefault();

    const id = document.getElementById('llcExpenseId').value;
    const fields = {
        Item: document.getElementById('llcItemName').value,
        Category: document.getElementById('llcCategoryName').value
    };

    showLoader('Saving LLC expense...');
    try {
        if (id) {
            // Update existing in Supabase
            await supabasePatch(LLC_EXPENSES_TABLE, id, fields);
        } else {
            // Create new in Supabase
            const newLLCExpense = {
                id: 'llc' + Date.now() + Math.random().toString(36).substr(2, 9),
                ...fields
            };
            await supabasePost(LLC_EXPENSES_TABLE, newLLCExpense);
        }

        closeAddLLCExpenseForm();
        await loadLLCExpenses();
        renderLLCExpenses();
        hideLoader();
        showNotification(id ? 'LLC expense updated!' : 'LLC expense added!', 'success');
    } catch (error) {
        hideLoader();
        showNotification('Error: ' + error.message, 'error');
    }
}

async function editLLCExpense(id) {
    const expense = allLLCExpenses.find(e => e.id === id);
    if (!expense) return;

    document.getElementById('llcExpenseModalTitle').textContent = 'Edit LLC Eligible Expense';
    document.getElementById('llcExpenseId').value = id;
    document.getElementById('llcItemName').value = expense.fields.Item;
    document.getElementById('llcCategoryName').value = expense.fields.Category;

    populateExistingCategories();
    document.getElementById('addLLCExpenseModal').classList.add('active');
}

async function deleteLLCExpense(id) {
    if (!confirm('Delete this LLC eligible expense?')) return;

    showLoader('Deleting LLC expense...');
    try {
        // Delete from Supabase
        await supabaseDelete(LLC_EXPENSES_TABLE, id);

        await loadLLCExpenses();
        renderLLCExpenses();
        hideLoader();
        showNotification('LLC expense deleted!', 'success');
    } catch (error) {
        hideLoader();
        showNotification('Error: ' + error.message, 'error');
    }
}

async function openMonthlySummary() {
    closeAllModalsExcept('monthlySummaryModal');
    
    // Populate year dropdown
    const yearSelect = document.getElementById('summaryYear');
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

    for (let year = 2025; year <= 2045; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }

    // Set current month
    document.getElementById('summaryMonth').value = currentMonth;

    const modal = document.getElementById('monthlySummaryModal');
    modal.classList.add('active');

    // Ensure data is loaded
    if (allExpenses.length === 0) {
        await loadData();
    }

    loadMonthlySummary();
}

function datePartsInTimeZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);

    const map = {};
    parts.forEach(p => {
        if (p.type !== 'literal') map[p.type] = p.value;
    });
    return { isoDate: `${map.year}-${map.month}-${map.day}` };
}

function addDaysUtc(date, days) {
    const d = new Date(date.getTime());
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

function getPreviousWeekEasternWindow(now = new Date()) {
    const timeZone = 'America/New_York';
    const noonUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));

    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(noonUtc);
    const weekdayIndex = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    const dow = weekdayIndex[String(weekday)];

    const startNoonUtc = addDaysUtc(noonUtc, -(dow + 7));
    const isoDates = [];
    for (let i = 0; i < 7; i++) {
        isoDates.push(datePartsInTimeZone(addDaysUtc(startNoonUtc, i), timeZone).isoDate);
    }

    return { weekStartDate: isoDates[0], startDate: isoDates[0], endDate: isoDates[6], isoDates };
}

function getWeekWindowEasternFromStart(weekStartDateIso) {
    const timeZone = 'America/New_York';
    const startNoonUtc = new Date(`${String(weekStartDateIso)}T12:00:00Z`);
    if (!isFinite(startNoonUtc.getTime())) {
        throw new Error('Invalid week_start_date');
    }

    const isoDates = [];
    for (let i = 0; i < 7; i++) {
        isoDates.push(datePartsInTimeZone(addDaysUtc(startNoonUtc, i), timeZone).isoDate);
    }

    return { weekStartDate: isoDates[0], startDate: isoDates[0], endDate: isoDates[6], isoDates };
}

async function openWeeklyDigest(options = {}) {
    const { skipUrlUpdate = false, skipLoad = false } = options || {};
    closeAllModalsExcept('weeklyDigestModal');
    document.getElementById('weeklyDigestModal').classList.add('active');
    if (!skipUrlUpdate) setAppPage('weekly-digest');

    if (skipLoad) {
        return;
    }

    if (allExpenses.length === 0) {
        await loadData();
    }
    renderWeeklyDigest();
}

function closeWeeklyDigest() {
    document.getElementById('weeklyDigestModal').classList.remove('active');
    if (getCurrentAppPage() === 'weekly-digest') {
        setAppPage(null);
    }
}

function renderWeeklyDigest() {
    const container = document.getElementById('weeklyDigestContent');
    if (!container) return;

    if (!Array.isArray(allExpenses) || allExpenses.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-info-circle text-4xl mb-3 opacity-50"></i>
                <p>No data loaded yet. Please refresh.</p>
            </div>
        `;
        return;
    }

    let w;
    try {
        const qs = new URLSearchParams(window.location.search);
        const requested = qs.get('week_start_date');
        if (requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)) {
            w = getWeekWindowEasternFromStart(requested);
        } else {
            w = getPreviousWeekEasternWindow(new Date());
        }
    } catch (e) {
        w = getPreviousWeekEasternWindow(new Date());
    }
    const allowed = new Set(w.isoDates);

    let total = 0;
    const totalsByCategory = new Map();

    for (const exp of allExpenses) {
        const f = exp?.fields || {};
        const y = String(f.Year || '').padStart(4, '0');
        const m = String(f.Month || '').padStart(2, '0');
        const d = String(f.Day || '').padStart(2, '0');
        if (!y || !m || !d || y.includes('NaN')) continue;
        const iso = `${y}-${m}-${d}`;
        if (!allowed.has(iso)) continue;

        const amt = Number(f.Actual || 0);
        if (!Number.isFinite(amt)) continue;
        total += amt;

        const cat = String(f.Category || 'Other');
        totalsByCategory.set(cat, (totalsByCategory.get(cat) || 0) + amt);
    }

    const topCats = Array.from(totalsByCategory.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    container.innerHTML = `
        <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p class="text-sm text-blue-800"><i class="fas fa-info-circle mr-2"></i>Summary for last week (Mon-Sun, ET): <span class="font-semibold">${w.startDate}</span> to <span class="font-semibold">${w.endDate}</span></p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div class="text-xs text-gray-500 font-semibold mb-1">TOTAL SPENT</div>
                <div class="text-3xl font-extrabold text-purple-700">$${total.toFixed(2)}</div>
            </div>
            <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div class="text-xs text-gray-500 font-semibold mb-3">TOP CATEGORIES</div>
                ${topCats.length ? `
                    <div class="space-y-2">
                        ${topCats.map(([c, v]) => `
                            <div class="flex items-center justify-between text-sm">
                                <div class="font-semibold text-gray-800">${escapeHtml(String(c))}</div>
                                <div class="font-bold text-gray-700">$${Number(v).toFixed(2)}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : `<div class="text-sm text-gray-500">No expenses recorded last week.</div>`}
            </div>
        </div>
        <div class="flex justify-end">
            <button onclick="renderWeeklyDigest()" class="btn-secondary">
                <i class="fas fa-sync-alt mr-2"></i>Refresh
            </button>
        </div>
    `;
}

function closeMonthlySummary() {
    document.getElementById('monthlySummaryModal').classList.remove('active');
}

function showCategoryExpenses(category, year, month) {
    // Filter expenses for this category and month
    const categoryExpenses = allExpenses.filter(exp => {
        const expYear = parseInt(exp.fields.Year);
        const expMonth = parseInt(exp.fields.Month);
        const expCategory = exp.fields.Category || 'Other';
        return expYear === year && expMonth === month && expCategory === category;
    });

    // Sort by date (most recent first), then by creation time (most recent first)
    categoryExpenses.sort((a, b) => {
        const dateA = new Date(a.fields.Year, a.fields.Month - 1, a.fields.Day || 1);
        const dateB = new Date(b.fields.Year, b.fields.Month - 1, b.fields.Day || 1);
        const dateCompare = dateB - dateA;

        // If dates are the same, sort by creation time (most recent first)
        if (dateCompare === 0) {
            const createdA = new Date(a.createdTime || 0);
            const createdB = new Date(b.createdTime || 0);
            return createdB - createdA;
        }

        return dateCompare;
    });

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const totalAmount = categoryExpenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.zIndex = '10001'; // Above monthly summary modal

    modal.innerHTML = `
                 <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                     <div class="flex justify-between items-center mb-6">
                         <div>
                             <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                 <i class="fas fa-list text-purple-600"></i>
                                 ${category}
                             </h2>
                             <p class="text-sm text-gray-600 mt-1">${monthNames[month - 1]} ${year} • ${categoryExpenses.length} ${categoryExpenses.length === 1 ? 'expense' : 'expenses'}</p>
                         </div>
                         <button onclick="this.closest('.modal').remove()" class="text-gray-400 hover:text-gray-600">
                             <i class="fas fa-times text-2xl"></i>
                         </button>
                     </div>
                     
                     <div class="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg mb-6">
                         <div class="text-sm opacity-90">Total Spending</div>
                         <div class="text-3xl font-bold">$${totalAmount.toFixed(2)}</div>
                         <div class="text-sm opacity-90 mt-1">Average: $${(totalAmount / categoryExpenses.length).toFixed(2)} per expense</div>
                     </div>
                     
                     <div class="space-y-3">
                         ${categoryExpenses.map(exp => {
        const item = exp.fields.Item || 'Unnamed';
        const actual = exp.fields.Actual || 0;
        const budget = exp.fields.Budget || 0;
        const day = exp.fields.Day;
        const llc = exp.fields.LLC === 'Yes';
        const amarContrib = exp.fields.AmarContribution || 0;
        const priyaContrib = exp.fields.PriyaContribution || 0;
        const notes = exp.fields.Notes || '';
        const tags = exp.fields.Tags || '';

        // Format date properly
        let dateDisplay = '';
        if (day !== undefined && day !== null && day !== '') {
            dateDisplay = `${monthNames[month - 1]} ${day}, ${year}`;
        } else {
            dateDisplay = `${monthNames[month - 1]} ${year}`;
        }

        // Determine actual amount color based on budget comparison
        let actualColorClass = 'text-purple-600';
        if (actual > budget) {
            actualColorClass = 'text-red-600';
        } else if (actual < budget) {
            actualColorClass = 'text-green-600';
        }

        // Tags display for card
        let tagsCardDisplay = '';
        if (tags.trim()) {
            const tagList = tags.split(',').map(tag =>
                `<span class="inline-block px-2 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-full text-xs font-medium mr-1 mb-1"><i class="fas fa-tag mr-1"></i>${tag.trim()}</span>`
            ).join('');
            tagsCardDisplay = `
                                     <div class="mt-3 flex flex-wrap">
                                         ${tagList}
                                     </div>
                                 `;
        }

        // Debug log
        console.log('Expense:', item, 'Day field:', day, 'Type:', typeof day, 'Display:', dateDisplay);

        return `
                                <div class="border border-gray-200 rounded-lg p-4 hover:bg-purple-50 hover:shadow-md transition-all cursor-pointer" 
                                     onclick="viewExpenseDetails('${exp.id}')" 
                                     style="cursor: pointer;">
                                    <div class="flex justify-between items-start mb-2">
                                        <div class="flex-1">
                                            <div class="font-semibold text-gray-800 flex items-center gap-2">
                                                ${item}
                                                ${llc ? '<span class="badge badge-llc text-xs">LLC</span>' : ''}
                                            </div>
                                            <div class="text-sm text-gray-600 mt-1">
                                                <i class="fas fa-calendar mr-1"></i>${dateDisplay}
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-2xl font-bold ${actualColorClass}">$${actual.toFixed(2)}</div>
                                        </div>
                                    </div>
                                    
                                    ${tagsCardDisplay}
                                    
                                    <div class="flex gap-4 text-xs text-gray-600 mt-3 pt-3 border-t border-gray-100">
                                        <div class="flex items-center gap-1">
                                            <i class="fas fa-user text-blue-500"></i>
                                            <span>Amar: $${amarContrib.toFixed(2)}</span>
                                        </div>
                                        <div class="flex items-center gap-1">
                                            <i class="fas fa-user text-pink-500"></i>
                                            <span>Priya: $${priyaContrib.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    
                                    ${notes && notes.trim() !== '' ? `
                                        <div class="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                            <i class="fas fa-sticky-note mr-1"></i>${notes}
                                        </div>
                                    ` : ''}
                                </div>
                            `;
    }).join('')}
                     </div>
                     
                     <div class="mt-6 pt-4 border-t border-gray-200">
                         <button onclick="this.closest('.modal').remove()" class="w-full btn-secondary">
                             <i class="fas fa-arrow-left mr-2"></i>Back to Summary
                         </button>
                     </div>
                 </div>
             `;

    document.body.appendChild(modal);
}

function showPersonContributions(person, year, month) {
    // Filter expenses where this person contributed
    const personExpenses = allExpenses.filter(exp => {
        const expYear = parseInt(exp.fields.Year);
        const expMonth = parseInt(exp.fields.Month);
        const contribution = person === 'Amar' ? (exp.fields.AmarContribution || 0) : (exp.fields.PriyaContribution || 0);
        return expYear === year && expMonth === month && contribution > 0;
    });

    // Get standalone payments from this person
    const personPayments = allPayments.filter(p => {
        const payYear = parseInt(p.fields.Year);
        const payMonth = parseInt(p.fields.Month);
        return payYear === year && payMonth === month && p.fields.Person === person;
    });

    // Sort expenses by date (most recent first)
    personExpenses.sort((a, b) => {
        const dateA = new Date(a.fields.Year, a.fields.Month - 1, a.fields.Day || 1);
        const dateB = new Date(b.fields.Year, b.fields.Month - 1, b.fields.Day || 1);
        const dateCompare = dateB - dateA;

        if (dateCompare === 0) {
            const createdA = new Date(a.createdTime || 0);
            const createdB = new Date(b.createdTime || 0);
            return createdB - createdA;
        }

        return dateCompare;
    });

    // Sort payments by date (most recent first)
    personPayments.sort((a, b) => {
        const dateA = new Date(a.fields.Year, a.fields.Month - 1, a.fields.Day || 1);
        const dateB = new Date(b.fields.Year, b.fields.Month - 1, b.fields.Day || 1);
        return dateB - dateA;
    });

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const totalFromExpenses = personExpenses.reduce((sum, exp) => {
        const contribution = person === 'Amar' ? (exp.fields.AmarContribution || 0) : (exp.fields.PriyaContribution || 0);
        return sum + contribution;
    }, 0);
    const totalFromPayments = personPayments.reduce((sum, p) => sum + (p.fields.Amount || 0), 0);
    const totalContribution = totalFromExpenses + totalFromPayments;

    const personColor = person === 'Amar' ? 'blue' : 'pink';
    const personIcon = person === 'Amar' ? '👤' : '👤';

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.zIndex = '10001'; // Above monthly summary modal

    modal.innerHTML = `
                 <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                     <div class="flex justify-between items-center mb-6">
                         <div>
                             <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                 <i class="fas fa-user text-${personColor}-600"></i>
                                 ${personIcon} ${person}'s Contributions
                             </h2>
                             <p class="text-sm text-gray-600 mt-1">${monthNames[month - 1]} ${year} • ${personExpenses.length} expenses + ${personPayments.length} payments</p>
                         </div>
                         <button onclick="this.closest('.modal').remove()" class="text-gray-400 hover:text-gray-600">
                             <i class="fas fa-times text-2xl"></i>
                         </button>
                     </div>
                     
                     <div class="bg-gradient-to-r from-${personColor}-500 to-${personColor}-600 text-white p-4 rounded-lg mb-6">
                         <div class="text-sm opacity-90">Total Contribution</div>
                         <div class="text-3xl font-bold">$${totalContribution.toFixed(2)}</div>
                         <div class="text-sm opacity-90 mt-1">
                             $${totalFromExpenses.toFixed(2)} from expenses • $${totalFromPayments.toFixed(2)} from standalone payments
                         </div>
                     </div>
                     
                     ${personExpenses.length > 0 ? `
                         <div class="mb-6">
                             <h3 class="text-lg font-bold mb-3 flex items-center gap-2">
                                 <i class="fas fa-receipt text-purple-600"></i>
                                 Expense Contributions
                             </h3>
                             <div class="space-y-3">
                                 ${personExpenses.map(exp => {
        const item = exp.fields.Item || 'Unnamed';
        const actual = exp.fields.Actual || 0;
        const contribution = person === 'Amar' ? (exp.fields.AmarContribution || 0) : (exp.fields.PriyaContribution || 0);
        const day = exp.fields.Day;
        const llc = exp.fields.LLC === 'Yes';
        const category = exp.fields.Category || 'Other';
        const amarContrib = exp.fields.AmarContribution || 0;
        const priyaContrib = exp.fields.PriyaContribution || 0;
        const notes = exp.fields.Notes || '';

        let dateDisplay = '';
        if (day !== undefined && day !== null && day !== '') {
            dateDisplay = `${monthNames[month - 1]} ${day}, ${year}`;
        } else {
            dateDisplay = `${monthNames[month - 1]} ${year}`;
        }

        return `
                                        <div class="border border-gray-200 rounded-lg p-4 hover:bg-${personColor}-50 hover:shadow-md transition-all cursor-pointer" 
                                             onclick="viewExpenseDetails('${exp.id}')" 
                                             style="cursor: pointer;">
                                            <div class="flex justify-between items-start mb-2">
                                                <div class="flex-1">
                                                    <div class="font-semibold text-gray-800 flex items-center gap-2">
                                                        ${item}
                                                        ${llc ? '<span class="badge badge-llc text-xs">LLC</span>' : ''}
                                                        <span class="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">${category}</span>
                                                    </div>
                                                    <div class="text-sm text-gray-600 mt-1">
                                                        <i class="fas fa-calendar mr-1"></i>${dateDisplay}
                                                    </div>
                                                </div>
                                                <div class="text-right">
                                                    <div class="text-sm text-gray-600">Total: $${actual.toFixed(2)}</div>
                                                    <div class="text-xl font-bold text-${personColor}-600">$${contribution.toFixed(2)}</div>
                                                </div>
                                            </div>
                                            
                                            <div class="flex gap-4 text-xs text-gray-600 mt-3 pt-3 border-t border-gray-100">
                                                <div class="flex items-center gap-1">
                                                    <i class="fas fa-user text-blue-500"></i>
                                                    <span>Amar: $${amarContrib.toFixed(2)}</span>
                                                </div>
                                                <div class="flex items-center gap-1">
                                                    <i class="fas fa-user text-pink-500"></i>
                                                    <span>Priya: $${priyaContrib.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            
                                            ${notes && notes.trim() !== '' ? `
                                                <div class="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                                    <i class="fas fa-sticky-note mr-1"></i>${notes}
                                                </div>
                                            ` : ''}
                                        </div>
                                    `;
    }).join('')}
                             </div>
                         </div>
                     ` : ''}
                     
                     ${personPayments.length > 0 ? `
                         <div class="mb-6">
                             <h3 class="text-lg font-bold mb-3 flex items-center gap-2">
                                 <i class="fas fa-hand-holding-usd text-green-600"></i>
                                 Standalone Payments
                             </h3>
                             <div class="space-y-3">
                                 ${personPayments.map(payment => {
        const amount = payment.fields.Amount || 0;
        const day = payment.fields.Day;
        const notes = payment.fields.Notes || '';

        let dateDisplay = '';
        if (day !== undefined && day !== null && day !== '') {
            dateDisplay = `${monthNames[month - 1]} ${day}, ${year}`;
        } else {
            dateDisplay = `${monthNames[month - 1]} ${year}`;
        }

        return `
                                        <div class="border border-gray-200 rounded-lg p-4 bg-green-50">
                                            <div class="flex justify-between items-start mb-2">
                                                <div class="flex-1">
                                                    <div class="font-semibold text-gray-800 flex items-center gap-2">
                                                        <i class="fas fa-money-bill-wave text-green-600"></i>
                                                        Standalone Payment
                                                    </div>
                                                    <div class="text-sm text-gray-600 mt-1">
                                                        <i class="fas fa-calendar mr-1"></i>${dateDisplay}
                                                    </div>
                                                </div>
                                                <div class="text-right">
                                                    <div class="text-2xl font-bold text-green-600">$${amount.toFixed(2)}</div>
                                                </div>
                                            </div>
                                            
                                            ${notes && notes.trim() !== '' ? `
                                                <div class="mt-2 text-sm text-gray-600 bg-white p-2 rounded">
                                                    <i class="fas fa-sticky-note mr-1"></i>${notes}
                                                </div>
                                            ` : ''}
                                        </div>
                                    `;
    }).join('')}
                             </div>
                         </div>
                     ` : ''}
                     
                     ${personExpenses.length === 0 && personPayments.length === 0 ? `
                         <div class="text-center py-8 text-gray-400">
                             <i class="fas fa-inbox text-4xl mb-3"></i>
                             <p>No contributions found for ${person} in ${monthNames[month - 1]} ${year}</p>
                         </div>
                     ` : ''}
                     
                     <div class="mt-6 pt-4 border-t border-gray-200">
                         <button onclick="this.closest('.modal').remove()" class="w-full btn-secondary">
                             <i class="fas fa-arrow-left mr-2"></i>Back to Summary
                         </button>
                     </div>
                 </div>
             `;

    document.body.appendChild(modal);
}

async function loadMonthlySummary() {
    const year = parseInt(document.getElementById('summaryYear').value);
    const month = parseInt(document.getElementById('summaryMonth').value);
    const container = document.getElementById('monthlySummaryContent');

    container.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-4xl text-purple-600"></i><p class="mt-3 text-gray-600">Loading summary...</p></div>';

    console.log('Loading summary for:', year, month);
    console.log('Total expenses:', allExpenses.length);
    console.log('Total payments:', allPayments.length);

    // Debug: Check format of first expense
    if (allExpenses.length > 0) {
        console.log('Sample expense Year:', allExpenses[0].fields.Year, 'Type:', typeof allExpenses[0].fields.Year);
        console.log('Sample expense Month:', allExpenses[0].fields.Month, 'Type:', typeof allExpenses[0].fields.Month);
    }

    // Filter expenses for selected month (handle both string and number formats)
    const monthExpenses = allExpenses.filter(exp => {
        const expYear = parseInt(exp.fields.Year);
        const expMonth = parseInt(exp.fields.Month);
        return expYear === year && expMonth === month;
    });

    const monthPayments = allPayments.filter(pay => {
        const payYear = parseInt(pay.fields.Year);
        const payMonth = parseInt(pay.fields.Month);
        return payYear === year && payMonth === month && !pay.fields.FromExpense;
    });

    console.log('Month expenses:', monthExpenses.length);
    console.log('Month payments:', monthPayments.length);

    if (monthExpenses.length === 0) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        container.innerHTML = `
                     <div class="text-center py-8 text-gray-400">
                         <i class="fas fa-inbox text-4xl mb-3"></i>
                         <p class="text-lg font-semibold mb-2">No data for ${monthNames[month - 1]} ${year}</p>
                         <p class="text-sm">Try selecting a different month or add some expenses first.</p>
                     </div>
                 `;
        return;
    }

    // Calculate metrics
    const totalSpending = monthExpenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const expenseCount = monthExpenses.length;
    const avgExpense = totalSpending / expenseCount;

    // Category breakdown
    const categoryTotals = {};
    monthExpenses.forEach(exp => {
        const cat = exp.fields.Category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.fields.Actual || 0);
    });

    // Contributions - separate mortgage from non-mortgage
    const amarMortgageContrib = monthExpenses
        .filter(exp => exp.fields.Category === 'Mortgage')
        .reduce((sum, exp) => sum + (exp.fields.AmarContribution || 0), 0);
    const amarNonMortgageContrib = monthExpenses
        .filter(exp => exp.fields.Category !== 'Mortgage')
        .reduce((sum, exp) => sum + (exp.fields.AmarContribution || 0), 0);

    const priyaContribFromExpenses = monthExpenses.reduce((sum, exp) => sum + (exp.fields.PriyaContribution || 0), 0);

    // Separate Priya's mortgage contributions from regular payments
    const priyaMortgageContributions = monthPayments
        .filter(p => p.fields.Person === 'Priya' && p.fields.PaymentType === 'PriyaMortgageContribution')
        .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

    const amarContribFromPayments = monthPayments
        .filter(p => p.fields.Person === 'Amar' && p.fields.PaymentType !== 'RentalIncome')
        .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);
    const priyaContribFromPayments = monthPayments
        .filter(p => p.fields.Person === 'Priya' &&
            p.fields.PaymentType !== 'PriyaMortgageContribution' &&
            p.fields.PaymentType !== 'RentalIncome')
        .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

    // Reduce only Amar's mortgage contribution by Priya's mortgage payments, keep non-mortgage contributions unchanged
    const amarAdjustedMortgageContrib = Math.max(0, amarMortgageContrib - priyaMortgageContributions);
    const amarTotal = amarNonMortgageContrib + amarAdjustedMortgageContrib + amarContribFromPayments;
    const priyaTotal = priyaContribFromExpenses + priyaContribFromPayments + priyaMortgageContributions;
    const totalContributions = amarTotal + priyaTotal;

    const amarPercentage = totalContributions > 0 ? (amarTotal / totalContributions * 100) : 0;
    const priyaPercentage = totalContributions > 0 ? (priyaTotal / totalContributions * 100) : 0;

    // LLC expenses
    const llcExpenses = monthExpenses.filter(exp => exp.fields.LLC === 'Yes');
    const llcTotal = llcExpenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const llcPercentage = totalSpending > 0 ? (llcTotal / totalSpending * 100) : 0;

    // Top 5 expenses
    const sortedExpenses = [...monthExpenses].sort((a, b) => (b.fields.Actual || 0) - (a.fields.Actual || 0));
    const top5 = sortedExpenses.slice(0, 5);

    // Contribution balance
    const expectedEach = totalSpending / 2;
    const amarDiff = amarTotal - expectedEach;
    const priyaDiff = priyaTotal - expectedEach;

    // Month names
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Generate progress bars
    const amarBar = '█'.repeat(Math.round(amarPercentage / 5)) + '░'.repeat(20 - Math.round(amarPercentage / 5));
    const priyaBar = '█'.repeat(Math.round(priyaPercentage / 5)) + '░'.repeat(20 - Math.round(priyaPercentage / 5));

    // Render summary
    container.innerHTML = `
                 <div class="space-y-6">
                     <div class="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-lg">
                         <h3 class="text-2xl font-bold mb-2">${monthNames[month - 1]} ${year}</h3>
                         <div class="text-4xl font-bold">$${totalSpending.toFixed(2)}</div>
                         <div class="text-sm opacity-90 mt-2">${expenseCount} transactions • $${avgExpense.toFixed(2)} average</div>
                     </div>
                     
                     <div class="card p-6">
                         <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                             <i class="fas fa-chart-pie text-purple-600"></i>
                             Spending by Category
                         </h3>
                         <div class="space-y-3">
                            ${Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => {
        const percentage = (amount / totalSpending * 100).toFixed(1);
        const categoryExpenses = monthExpenses.filter(exp => (exp.fields.Category || 'Other') === cat);
        const expenseCount = categoryExpenses.length;
        return `
                                    <div class="cursor-pointer hover:bg-purple-50 p-3 rounded-lg transition-colors" 
                                         onclick="showCategoryExpenses('${cat.replace(/'/g, "\\'")}', ${year}, ${month})"
                                         style="cursor: pointer;">
                                        <div class="flex justify-between items-start mb-1">
                                            <div class="flex-1">
                                                <span class="font-semibold">${cat}</span>
                                                <span class="text-xs text-gray-500 ml-2">(${expenseCount} ${expenseCount === 1 ? 'item' : 'items'})</span>
                                            </div>
                                            <span class="text-gray-600 whitespace-nowrap ml-2">$${amount.toFixed(2)} (${percentage}%)</span>
                                        </div>
                                        <div class="w-full bg-gray-200 rounded-full h-2">
                                            <div class="bg-purple-600 h-2 rounded-full" style="width: ${percentage}%"></div>
                                        </div>
                                        <div class="text-xs text-purple-600 mt-1 opacity-0 hover:opacity-100 transition-opacity">
                                            <i class="fas fa-arrow-right mr-1"></i>Click to view expenses
                                        </div>
                                    </div>
                                `;
    }).join('')}
                        </div>
                     </div>
                     
                     <div class="card p-6">
                         <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                             <i class="fas fa-users text-purple-600"></i>
                             Contribution Breakdown
                         </h3>
                         <div class="space-y-6">
                             <div class="p-4 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 hover:shadow-md transition-all" 
                                  onclick="showPersonContributions('Amar', ${year}, ${month})"
                                  style="cursor: pointer;">
                                 <div class="flex justify-between items-center mb-2">
                                     <span class="text-lg font-bold">👤 Amar</span>
                                     <span class="text-2xl font-bold text-blue-600">$${amarTotal.toFixed(2)}</span>
                                 </div>
                                 <div class="text-sm text-gray-600 mb-2">${amarPercentage.toFixed(1)}% of total contributions</div>
                                 <div class="font-mono text-xs bg-white p-2 rounded">${amarBar} ${amarPercentage.toFixed(0)}%</div>
                                 <div class="mt-2 text-sm ${amarDiff >= 0 ? 'text-green-600' : 'text-red-600'}">
                                     ${amarDiff >= 0 ? '+' : ''}$${amarDiff.toFixed(2)} vs 50/50 split
                                 </div>
                                 <div class="text-xs text-blue-600 mt-2 opacity-75 hover:opacity-100 transition-opacity">
                                     <i class="fas fa-arrow-right mr-1"></i>Click to view all contributions
                                 </div>
                             </div>
                             
                             <div class="p-4 bg-pink-50 rounded-lg cursor-pointer hover:bg-pink-100 hover:shadow-md transition-all" 
                                  onclick="showPersonContributions('Priya', ${year}, ${month})"
                                  style="cursor: pointer;">
                                 <div class="flex justify-between items-center mb-2">
                                     <span class="text-lg font-bold">👤 Priya</span>
                                     <span class="text-2xl font-bold text-pink-600">$${priyaTotal.toFixed(2)}</span>
                                 </div>
                                 <div class="text-sm text-gray-600 mb-2">${priyaPercentage.toFixed(1)}% of total contributions</div>
                                 <div class="font-mono text-xs bg-white p-2 rounded">${priyaBar} ${priyaPercentage.toFixed(0)}%</div>
                                 <div class="mt-2 text-sm ${priyaDiff >= 0 ? 'text-green-600' : 'text-red-600'}">
                                     ${priyaDiff >= 0 ? '+' : ''}$${priyaDiff.toFixed(2)} vs 50/50 split
                                 </div>
                                 <div class="text-xs text-pink-600 mt-2 opacity-75 hover:opacity-100 transition-opacity">
                                     <i class="fas fa-arrow-right mr-1"></i>Click to view all contributions
                                 </div>
                             </div>
                             
                             <div class="p-4 bg-gray-100 rounded-lg">
                                 <div class="text-center">
                                     <div class="text-sm text-gray-600 mb-1">Expected (50/50)</div>
                                     <div class="text-lg font-bold">$${expectedEach.toFixed(2)} each</div>
                                     <div class="mt-2 text-sm font-semibold ${Math.abs(amarDiff) > 100 ? 'text-orange-600' : 'text-green-600'}">
                                         ${Math.abs(amarDiff) > 100 ? '⚠️ Significant imbalance' : '✓ Balanced contributions'}
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>
                     
                     <div class="card p-4 md:p-6">
                         <h3 class="text-lg md:text-xl font-bold mb-3 md:mb-4 flex items-center gap-2">
                             <i class="fas fa-building text-purple-600"></i>
                             <span class="text-sm md:text-base">LLC Eligible Expenses</span>
                         </h3>
                         <div class="grid grid-cols-3 gap-2 md:gap-4">
                             <div class="text-center p-2 md:p-4 bg-green-50 rounded-lg">
                                 <div class="text-lg md:text-2xl font-bold text-green-600 break-words">$${llcTotal.toFixed(2)}</div>
                                 <div class="text-xs md:text-sm text-gray-600">Total LLC</div>
                             </div>
                             <div class="text-center p-2 md:p-4 bg-blue-50 rounded-lg">
                                 <div class="text-lg md:text-2xl font-bold text-blue-600">${llcPercentage.toFixed(1)}%</div>
                                 <div class="text-xs md:text-sm text-gray-600">Of Total</div>
                             </div>
                             <div class="text-center p-2 md:p-4 bg-purple-50 rounded-lg">
                                 <div class="text-lg md:text-2xl font-bold text-purple-600 break-words">$${(llcTotal * 0.25).toFixed(2)}</div>
                                 <div class="text-xs md:text-sm text-gray-600">Est. Savings (25%)</div>
                             </div>
                         </div>
                     </div>
                     
                     <div class="card p-6">
                         <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                             <i class="fas fa-trophy text-purple-600"></i>
                             Top 5 Expenses
                         </h3>
                         <div class="space-y-3">
                             ${top5.map((exp, idx) => `
                                 <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                     <div class="text-2xl font-bold text-gray-400">${idx + 1}</div>
                                     <div class="flex-1">
                                         <div class="font-semibold">${exp.fields.Item || 'N/A'}</div>
                                         <div class="text-sm text-gray-600">${exp.fields.Category || 'N/A'}</div>
                                     </div>
                                     <div class="text-lg font-bold text-purple-600">$${(exp.fields.Actual || 0).toFixed(2)}</div>
                                 </div>
                             `).join('')}
                         </div>
                     </div>
                 </div>
             `;
}

function updatePredictedTotal() {
    // Quick calculation for dashboard tile
    const yearFilterEl = document.getElementById('yearSelector');
    const monthFilterEl = document.getElementById('monthSelector');
    const selectedYear = yearFilterEl ? yearFilterEl.value : 'all';
    const selectedMonth = monthFilterEl ? monthFilterEl.value : 'all';

    // Get expenses to analyze (last 3 months from current or filtered period)
    let expensesToAnalyze = allExpenses;

    // If specific month/year selected, use last 3 months from that point
    if (selectedYear !== 'all' && selectedMonth !== 'all') {
        const year = parseInt(selectedYear);
        const month = parseInt(selectedMonth);

        // Calculate 3 months before selected month
        // For month 10 (Oct): want months 7, 8, 9
        // For month 11 (Nov): want months 8, 9, 10
        expensesToAnalyze = allExpenses.filter(exp => {
            const expYear = exp.fields.Year;
            const expMonth = parseInt(exp.fields.Month);

            // Create comparable values: YYYYMM format
            const expValue = expYear * 100 + expMonth;
            const selectedValue = year * 100 + month;

            // Calculate 3 months ago
            let threeMonthsAgoYear = year;
            let threeMonthsAgoMonth = month - 3;
            if (threeMonthsAgoMonth <= 0) {
                threeMonthsAgoMonth += 12;
                threeMonthsAgoYear -= 1;
            }
            const threeMonthsAgoValue = threeMonthsAgoYear * 100 + threeMonthsAgoMonth;

            // Include expenses from 3 months ago up to (but not including) selected month
            return expValue >= threeMonthsAgoValue && expValue < selectedValue;
        });
    } else {
        // Use last 3 months from now
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        expensesToAnalyze = allExpenses.filter(exp => {
            const expDate = new Date(exp.fields.Year, exp.fields.Month - 1, 1);
            return expDate >= threeMonthsAgo;
        });
    }

    if (expensesToAnalyze.length === 0) {
        document.getElementById('predictedTotal').innerHTML = '$0';
        return;
    }

    // Calculate simple average
    const total = expensesToAnalyze.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const monthsCount = Math.max(1, new Set(expensesToAnalyze.map(e => `${e.fields.Year}-${e.fields.Month}`)).size);
    const avgMonthly = total / monthsCount;

    // Simple trend calculation
    const monthlyTotals = {};
    expensesToAnalyze.forEach(exp => {
        const key = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        monthlyTotals[key] = (monthlyTotals[key] || 0) + (exp.fields.Actual || 0);
    });

    const months = Object.keys(monthlyTotals).sort();
    const trend = months.length > 1 ? (monthlyTotals[months[months.length - 1]] - monthlyTotals[months[0]]) / months.length : 0;

    const predicted = Math.max(0, avgMonthly + trend);

    // Get comparison month (last month in analysis)
    const lastMonthKey = months[months.length - 1];
    const lastMonthTotal = monthlyTotals[lastMonthKey] || 0;

    // Calculate percentage change
    const change = lastMonthTotal > 0 ? ((predicted - lastMonthTotal) / lastMonthTotal * 100) : 0;
    const absChange = Math.abs(change);

    // Determine arrow and color based on change
    let arrow = '';
    let arrowColor = '';

    if (absChange < 5) {
        // Less than 5% change - neutral/stable
        arrow = '→';
        arrowColor = '#FFA500'; // Orange
    } else if (change > 0) {
        // Increasing
        arrow = '↑';
        if (absChange < 10) {
            arrowColor = '#FF6B6B'; // Light red
        } else if (absChange < 20) {
            arrowColor = '#FF4444'; // Medium red
        } else {
            arrowColor = '#CC0000'; // Dark red
        }
    } else {
        // Decreasing
        arrow = '↓';
        if (absChange < 10) {
            arrowColor = '#90EE90'; // Light green
        } else if (absChange < 20) {
            arrowColor = '#4CAF50'; // Medium green
        } else {
            arrowColor = '#2E7D32'; // Dark green
        }
    }

    document.getElementById('predictedTotal').innerHTML = `
                 <span style="color: ${arrowColor}; font-size: 0.8em; margin-right: 4px;">${arrow}</span>$${predicted.toFixed(0)}
             `;
}

function openPredictiveBudgeting() {
    closeAllModalsExcept('predictiveBudgetingModal');
    document.getElementById('predictiveBudgetingModal').classList.add('active');
    generatePredictions();
}

function closePredictiveBudgeting() {
    document.getElementById('predictiveBudgetingModal').classList.remove('active');
}

function generatePredictions() {
    const container = document.getElementById('predictiveBudgetingContent');

    // Get selected filter or current date
    const yearFilterEl = document.getElementById('yearSelector');
    const monthFilterEl = document.getElementById('monthSelector');
    const selectedYear = yearFilterEl ? yearFilterEl.value : 'all';
    const selectedMonth = monthFilterEl ? monthFilterEl.value : 'all';

    let baseYear, baseMonth, predictYear, predictMonth;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Determine what month we're predicting for
    if (selectedYear !== 'all' && selectedMonth !== 'all') {
        // Predicting for the selected month
        baseYear = parseInt(selectedYear);
        baseMonth = parseInt(selectedMonth);
        predictYear = baseYear;
        predictMonth = baseMonth;
    } else {
        // Predicting for next month from today
        const now = new Date();
        baseYear = now.getFullYear();
        baseMonth = now.getMonth() + 1;
        predictMonth = baseMonth + 1;
        predictYear = baseYear;
        if (predictMonth > 12) {
            predictMonth = 1;
            predictYear += 1;
        }
    }

    // Get expenses from 3 months before the prediction target
    let recentExpenses;
    if (selectedYear !== 'all' && selectedMonth !== 'all') {
        // Use same logic as updatePredictedTotal
        const year = parseInt(selectedYear);
        const month = parseInt(selectedMonth);

        recentExpenses = allExpenses.filter(exp => {
            const expYear = exp.fields.Year;
            const expMonth = parseInt(exp.fields.Month);
            const expValue = expYear * 100 + expMonth;
            const selectedValue = year * 100 + month;

            let threeMonthsAgoYear = year;
            let threeMonthsAgoMonth = month - 3;
            if (threeMonthsAgoMonth <= 0) {
                threeMonthsAgoMonth += 12;
                threeMonthsAgoYear -= 1;
            }
            const threeMonthsAgoValue = threeMonthsAgoYear * 100 + threeMonthsAgoMonth;

            return expValue >= threeMonthsAgoValue && expValue < selectedValue;
        });
    } else {
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        recentExpenses = allExpenses.filter(exp => {
            const expDate = new Date(exp.fields.Year, exp.fields.Month - 1, 1);
            return expDate >= threeMonthsAgo;
        });
    }

    if (recentExpenses.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-inbox text-4xl mb-3"></i><p>Not enough data to generate predictions. Add more expenses first.</p></div>';
        return;
    }

    // Calculate predictions by category
    const categoryData = {};
    recentExpenses.forEach(exp => {
        const cat = exp.fields.Category || 'Other';
        if (!categoryData[cat]) {
            categoryData[cat] = { total: 0, count: 0, amounts: [] };
        }
        categoryData[cat].total += exp.fields.Actual || 0;
        categoryData[cat].count++;
        categoryData[cat].amounts.push(exp.fields.Actual || 0);
    });

    // Calculate overall prediction (same logic as dashboard)
    const total = recentExpenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const monthsCount = Math.max(1, new Set(recentExpenses.map(e => `${e.fields.Year}-${e.fields.Month}`)).size);
    const avgMonthly = total / monthsCount;

    // Overall trend calculation
    const monthlyTotals = {};
    recentExpenses.forEach(exp => {
        const key = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        monthlyTotals[key] = (monthlyTotals[key] || 0) + (exp.fields.Actual || 0);
    });

    const months = Object.keys(monthlyTotals).sort();
    const overallTrend = months.length > 1 ? (monthlyTotals[months[months.length - 1]] - monthlyTotals[months[0]]) / months.length : 0;
    const totalPredicted = Math.max(0, avgMonthly + overallTrend);

    // Calculate predictions per category (for breakdown display)
    const predictions = [];

    Object.keys(categoryData).forEach(category => {
        const data = categoryData[category];
        const average = data.total / data.count;

        // Calculate trend (simple linear regression)
        const amounts = data.amounts;
        const trend = amounts.length > 1 ? (amounts[amounts.length - 1] - amounts[0]) / amounts.length : 0;

        // Predicted amount = average + trend
        const predicted = Math.max(0, average + trend);

        // Calculate confidence based on consistency
        const variance = amounts.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / amounts.length;
        const stdDev = Math.sqrt(variance);
        const confidence = Math.max(0, Math.min(100, 100 - (stdDev / average * 100)));

        predictions.push({
            category,
            predicted,
            average,
            trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
            trendAmount: Math.abs(trend),
            confidence,
            count: data.count
        });
    });

    // Sort by predicted amount
    predictions.sort((a, b) => b.predicted - a.predicted);

    // Calculate overall metrics
    const currentMonthTotal = allExpenses
        .filter(exp => exp.fields.Year === baseYear && exp.fields.Month === baseMonth)
        .reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);

    // Calculate last month from base month
    let lastMonth = baseMonth - 1;
    let lastMonthYear = baseYear;
    if (lastMonth === 0) {
        lastMonth = 12;
        lastMonthYear -= 1;
    }

    const lastMonthTotal = allExpenses
        .filter(exp => exp.fields.Year === lastMonthYear && exp.fields.Month === lastMonth)
        .reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);

    // Render predictions
    container.innerHTML = `
                 <div class="space-y-6">
                     <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div class="card p-6 text-center bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                             <div class="text-sm opacity-90 mb-2">Predicted Total</div>
                             <div class="text-3xl font-bold">$${totalPredicted.toFixed(2)}</div>
                             <div class="text-xs opacity-75 mt-2">${monthNames[predictMonth - 1]} ${predictYear}</div>
                         </div>
                         <div class="card p-6 text-center">
                             <div class="text-sm text-gray-600 mb-2">3-Month Average</div>
                             <div class="text-2xl font-bold text-gray-800">$${avgMonthly.toFixed(2)}</div>
                             <div class="text-xs text-gray-500 mt-2">Based on recent history</div>
                         </div>
                         <div class="card p-6 text-center">
                             <div class="text-sm text-gray-600 mb-2">vs Last Month</div>
                             <div class="text-2xl font-bold ${totalPredicted > lastMonthTotal ? 'text-red-600' : 'text-green-600'}">
                                 ${totalPredicted > lastMonthTotal ? '+' : ''}$${(totalPredicted - lastMonthTotal).toFixed(2)}
                             </div>
                             <div class="text-xs text-gray-500 mt-2">${lastMonthTotal > 0 ? ((totalPredicted - lastMonthTotal) / lastMonthTotal * 100).toFixed(1) + '% change' : 'N/A (no previous data)'}</div>
                         </div>
                     </div>
                     
                     <div class="card p-6">
                         <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                             <i class="fas fa-chart-line text-purple-600"></i>
                             Category Predictions
                         </h3>
                         <div class="space-y-4">
                             ${predictions.map(pred => `
                                 <div class="p-4 bg-gray-50 rounded-lg">
                                     <div class="flex justify-between items-start mb-3">
                                         <div class="flex-1">
                                             <div class="font-semibold text-lg text-gray-800">${pred.category}</div>
                                             <div class="text-sm text-gray-600">Based on ${pred.count} recent transactions</div>
                                         </div>
                                         <div class="text-right">
                                             <div class="text-2xl font-bold text-purple-600">$${pred.predicted.toFixed(2)}</div>
                                             <div class="text-xs text-gray-500">predicted</div>
                                         </div>
                                     </div>
                                     <div class="grid grid-cols-3 gap-3 text-sm">
                                         <div>
                                             <span class="text-gray-600">Average:</span>
                                             <span class="font-semibold ml-1">$${pred.average.toFixed(2)}</span>
                                         </div>
                                         <div>
                                             <span class="text-gray-600">Trend:</span>
                                             <span class="font-semibold ml-1 ${pred.trend === 'increasing' ? 'text-red-600' : pred.trend === 'decreasing' ? 'text-green-600' : 'text-gray-600'}">
                                                 ${pred.trend === 'increasing' ? '↑' : pred.trend === 'decreasing' ? '↓' : '→'} ${pred.trend}
                                             </span>
                                         </div>
                                         <div>
                                             <span class="text-gray-600">Confidence:</span>
                                             <span class="font-semibold ml-1">${pred.confidence.toFixed(0)}%</span>
                                         </div>
                                     </div>
                                     <div class="mt-3">
                                         <div class="w-full bg-gray-200 rounded-full h-2">
                                             <div class="bg-purple-600 h-2 rounded-full" style="width: ${(pred.predicted / totalPredicted * 100).toFixed(1)}%"></div>
                                         </div>
                                         <div class="text-xs text-gray-500 mt-1">${(pred.predicted / totalPredicted * 100).toFixed(1)}% of total predicted spending</div>
                                     </div>
                                 </div>
                             `).join('')}
                         </div>
                     </div>
                     
                     <div class="card p-6">
                         <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                             <i class="fas fa-chart-area text-purple-600"></i>
                             Predicted vs Actual Trend
                         </h3>
                         <div class="chart-container" style="height: 300px;">
                             <canvas id="predictionTrendChart"></canvas>
                         </div>
                     </div>
                     
                     <div class="card p-6 bg-yellow-50 border border-yellow-200">
                         <h3 class="text-lg font-bold mb-3 text-yellow-800">
                             <i class="fas fa-lightbulb mr-2"></i>Insights & Recommendations
                         </h3>
                         <ul class="space-y-2 text-sm text-yellow-800">
                             ${totalPredicted > avgMonthly * 1.1 ? '<li><i class="fas fa-exclamation-triangle mr-2"></i>Predicted spending is 10%+ higher than your 3-month average. Consider reviewing your budget.</li>' : ''}
                             ${predictions.filter(p => p.trend === 'increasing').length > 0 ? `<li><i class="fas fa-arrow-trend-up mr-2"></i>Increasing trends detected in: ${predictions.filter(p => p.trend === 'increasing').map(p => p.category).join(', ')}</li>` : ''}
                             ${predictions.filter(p => p.confidence < 50).length > 0 ? `<li><i class="fas fa-question-circle mr-2"></i>Low confidence predictions for: ${predictions.filter(p => p.confidence < 50).map(p => p.category).join(', ')}. More data needed.</li>` : ''}
                             <li><i class="fas fa-check-circle mr-2"></i>Predictions improve with more data. Keep tracking your expenses!</li>
                         </ul>
                     </div>
                 </div>
             `;

    // Create prediction trend chart
    createPredictionTrendChart(totalPredicted, avgMonthly, lastMonthTotal, currentMonthTotal);
}

function createPredictionTrendChart(predicted, avgMonthly, lastMonth, currentMonth) {
    const ctx = document.getElementById('predictionTrendChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (window.predictionChart) {
        window.predictionChart.destroy();
    }

    // Get last 6 months of actual data
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = [];
    const actualData = [];
    const predictedData = [];

    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        labels.push(`${monthNames[date.getMonth()]} ${year}`);

        const monthTotal = allExpenses
            .filter(exp => exp.fields.Year === year && exp.fields.Month === month)
            .reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);

        actualData.push(monthTotal);

        // Add last actual value to predicted line to connect it
        if (i === 0) {
            predictedData.push(monthTotal); // Connect from last actual month
        } else {
            predictedData.push(null);
        }
    }

    // Add next month prediction
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    labels.push(`${monthNames[nextDate.getMonth()]} ${nextDate.getFullYear()}`);
    actualData.push(null); // No actual data yet
    predictedData.push(predicted);

    window.predictionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Actual Spending',
                    data: actualData,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: 'Predicted Spending',
                    data: predictedData,
                    borderColor: '#FA8BFF',
                    backgroundColor: 'rgba(250, 139, 255, 0.1)',
                    borderWidth: 3,
                    borderDash: [10, 5],
                    fill: true,
                    tension: 0.4,
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    pointBackgroundColor: '#FA8BFF',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointStyle: 'star'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: { size: 12, weight: 'bold' }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += '$' + context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toFixed(0);
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function openAIInsights() {
    openAnalyzeFinances();
}

function closeAIInsights() {
    closeAnalyzeFinances();
}

function generateAIInsights() {
    const container = document.getElementById('aiInsightsContent');

    if (allExpenses.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-inbox text-4xl mb-3"></i><p>No expenses to analyze. Add some expenses first!</p></div>';
        return;
    }

    const insights = [];

    // 1. Weekend vs Weekday Spending Pattern
    const weekendInsight = analyzeWeekendSpending();
    if (weekendInsight) insights.push(weekendInsight);

    // 2. Category Overspending Detection
    const overspendingInsights = detectOverspending();
    insights.push(...overspendingInsights);

    // 3. Spending Trends
    const trendInsights = analyzeSpendingTrends();
    insights.push(...trendInsights);

    // 4. Anomaly Detection
    const anomalies = detectAnomalies();
    insights.push(...anomalies);

    // 5. Money Saving Opportunities
    const savingTips = generateSavingTips();
    insights.push(...savingTips);

    // 6. Budget Efficiency Score
    const efficiencyScore = calculateBudgetEfficiency();

    // Render insights
    container.innerHTML = `
                 <div class="space-y-6">
                     <!-- Efficiency Score Card -->
                     <div class="card p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                         <div class="flex items-center justify-between">
                             <div>
                                 <h3 class="text-xl font-bold mb-2">Budget Efficiency Score</h3>
                                 <p class="text-sm opacity-90">How well you're managing your budget</p>
                             </div>
                             <div class="text-center">
                                 <div class="text-5xl font-bold">${efficiencyScore.score}</div>
                                 <div class="text-sm opacity-75">/100</div>
                             </div>
                         </div>
                         <div class="mt-4 bg-white bg-opacity-20 rounded-full h-3">
                             <div class="bg-white rounded-full h-3 transition-all" style="width: ${efficiencyScore.score}%"></div>
                         </div>
                         <p class="mt-3 text-sm">${efficiencyScore.message}</p>
                     </div>
                     
                     <!-- Insights Grid -->
                     <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                         ${insights.map(insight => `
                             <div class="card p-5 border-l-4 ${insight.type === 'warning' ? 'border-red-500 bg-red-50' : insight.type === 'success' ? 'border-green-500 bg-green-50' : insight.type === 'info' ? 'border-blue-500 bg-blue-50' : 'border-yellow-500 bg-yellow-50'}">
                                 <div class="flex items-start gap-3">
                                     <i class="fas ${insight.icon} text-2xl ${insight.type === 'warning' ? 'text-red-600' : insight.type === 'success' ? 'text-green-600' : insight.type === 'info' ? 'text-blue-600' : 'text-yellow-600'}"></i>
                                     <div class="flex-1">
                                         <h4 class="font-bold text-gray-800 mb-2">${insight.title}</h4>
                                         <p class="text-sm text-gray-700 mb-3">${insight.message}</p>
                                         ${insight.action ? `<div class="text-xs font-semibold ${insight.type === 'warning' ? 'text-red-700' : insight.type === 'success' ? 'text-green-700' : insight.type === 'info' ? 'text-blue-700' : 'text-yellow-700'}"><i class="fas fa-lightbulb mr-1"></i>${insight.action}</div>` : ''}
                                     </div>
                                 </div>
                             </div>
                         `).join('')}
                     </div>
                 </div>
             `;
}

function analyzeWeekendSpending() {
    const weekendSpending = [];
    const weekdaySpending = [];

    allExpenses.forEach(exp => {
        const date = new Date(exp.fields.Year, exp.fields.Month - 1, exp.fields.Day || 1);
        const dayOfWeek = date.getDay();
        const amount = exp.fields.Actual || 0;

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            weekendSpending.push(amount);
        } else {
            weekdaySpending.push(amount);
        }
    });

    if (weekendSpending.length === 0 || weekdaySpending.length === 0) return null;

    const weekendAvg = weekendSpending.reduce((a, b) => a + b, 0) / weekendSpending.length;
    const weekdayAvg = weekdaySpending.reduce((a, b) => a + b, 0) / weekdaySpending.length;

    const diff = ((weekendAvg - weekdayAvg) / weekdayAvg * 100);

    if (Math.abs(diff) < 10) return null;

    if (diff > 0) {
        return {
            type: 'tip',
            icon: 'fa-calendar-week',
            title: 'Weekend Spending Pattern',
            message: `You spend ${diff.toFixed(0)}% more on weekends ($${weekendAvg.toFixed(2)} vs $${weekdayAvg.toFixed(2)} on weekdays).`,
            action: 'Plan weekend activities in advance to reduce impulse spending.'
        };
    } else {
        return {
            type: 'success',
            icon: 'fa-calendar-check',
            title: 'Great Weekend Control',
            message: `You spend ${Math.abs(diff).toFixed(0)}% less on weekends. Keep it up!`,
            action: null
        };
    }
}

function detectOverspending() {
    const insights = [];
    const categoryTotals = {};
    const categoryBudgets = {};

    allExpenses.forEach(exp => {
        const cat = exp.fields.Category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.fields.Actual || 0);
        categoryBudgets[cat] = (categoryBudgets[cat] || 0) + (exp.fields.Budget || 0);
    });

    Object.keys(categoryTotals).forEach(cat => {
        const actual = categoryTotals[cat];
        const budget = categoryBudgets[cat];

        if (budget > 0) {
            const overspend = ((actual - budget) / budget * 100);

            if (overspend > 20) {
                insights.push({
                    type: 'warning',
                    icon: 'fa-exclamation-triangle',
                    title: `${cat} Overspending`,
                    message: `You've exceeded your ${cat} budget by ${overspend.toFixed(0)}% ($${(actual - budget).toFixed(2)} over).`,
                    action: `Review ${cat} expenses and set a stricter budget next month.`
                });
            } else if (overspend < -20) {
                insights.push({
                    type: 'success',
                    icon: 'fa-check-circle',
                    title: `${cat} Under Budget`,
                    message: `Great job! You're ${Math.abs(overspend).toFixed(0)}% under budget in ${cat}.`,
                    action: null
                });
            }
        }
    });

    return insights.slice(0, 3); // Top 3
}

function analyzeSpendingTrends() {
    const insights = [];
    const now = new Date();

    // Get last 3 months
    const monthlyTotals = {};
    for (let i = 2; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        monthlyTotals[key] = 0;
    }

    allExpenses.forEach(exp => {
        const key = `${exp.fields.Year}-${exp.fields.Month}`;
        if (monthlyTotals.hasOwnProperty(key)) {
            monthlyTotals[key] += exp.fields.Actual || 0;
        }
    });

    const months = Object.keys(monthlyTotals).sort();
    if (months.length >= 2) {
        const trend = monthlyTotals[months[months.length - 1]] - monthlyTotals[months[0]];
        const trendPercent = (trend / monthlyTotals[months[0]] * 100);

        if (trendPercent > 15) {
            insights.push({
                type: 'warning',
                icon: 'fa-arrow-trend-up',
                title: 'Spending Increasing',
                message: `Your spending has increased by ${trendPercent.toFixed(0)}% over the last 3 months.`,
                action: 'Review your expenses and identify areas to cut back.'
            });
        } else if (trendPercent < -15) {
            insights.push({
                type: 'success',
                icon: 'fa-arrow-trend-down',
                title: 'Spending Decreasing',
                message: `Excellent! Your spending has decreased by ${Math.abs(trendPercent).toFixed(0)}% over the last 3 months.`,
                action: null
            });
        }
    }

    return insights;
}

function detectAnomalies() {
    const insights = [];
    const categoryExpenses = {};

    // Group by category
    allExpenses.forEach(exp => {
        const cat = exp.fields.Category || 'Other';
        if (!categoryExpenses[cat]) categoryExpenses[cat] = [];
        categoryExpenses[cat].push(exp.fields.Actual || 0);
    });

    // Detect anomalies (expenses > 2 standard deviations from mean)
    Object.keys(categoryExpenses).forEach(cat => {
        const amounts = categoryExpenses[cat];
        if (amounts.length < 3) return;

        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
        const stdDev = Math.sqrt(variance);

        const anomalies = amounts.filter(amt => Math.abs(amt - mean) > 2 * stdDev);

        if (anomalies.length > 0) {
            insights.push({
                type: 'info',
                icon: 'fa-chart-line',
                title: `Unusual ${cat} Expense`,
                message: `Detected ${anomalies.length} unusually high expense(s) in ${cat}. Average: $${mean.toFixed(2)}, Unusual: $${Math.max(...anomalies).toFixed(2)}.`,
                action: 'Review these expenses to ensure they were necessary.'
            });
        }
    });

    return insights.slice(0, 2);
}

function generateSavingTips() {
    const insights = [];
    const categoryTotals = {};

    allExpenses.forEach(exp => {
        const cat = exp.fields.Category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.fields.Actual || 0);
    });

    // Find top spending categories
    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

    if (sorted.length > 0) {
        const topCategory = sorted[0];
        const savingAmount = topCategory[1] * 0.2; // 20% reduction

        insights.push({
            type: 'tip',
            icon: 'fa-piggy-bank',
            title: 'Savings Opportunity',
            message: `${topCategory[0]} is your highest expense ($${topCategory[1].toFixed(2)}). Reducing it by 20% could save you $${savingAmount.toFixed(2)}/month.`,
            action: `Look for alternatives or negotiate better rates for ${topCategory[0]}.`
        });
    }

    return insights;
}

function calculateBudgetEfficiency() {
    let score = 100;
    let message = '';

    const totalBudget = allExpenses.reduce((sum, exp) => sum + (exp.fields.Budget || 0), 0);
    const totalActual = allExpenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);

    if (totalBudget === 0) {
        return { score: 50, message: 'Set budgets for your expenses to improve your score!' };
    }

    const variance = ((totalActual - totalBudget) / totalBudget * 100);

    // Deduct points for overspending
    if (variance > 0) {
        score -= Math.min(variance, 50);
        message = 'You\'re overspending. Try to stick to your budget!';
    } else if (variance < -30) {
        score -= 20;
        message = 'You\'re way under budget. Consider adjusting your budget or saving more!';
    } else {
        message = 'Great job staying within budget!';
    }

    return { score: Math.max(0, Math.round(score)), message };
}

// ── Analyze Finances ─────────────────────────────────────────────────

function openAnalyzeFinances() {
    closeAllModalsExcept('analyzeFinancesModal');
    document.getElementById('analyzeFinancesModal').classList.add('active');
    generateFinancialAnalysis();
}

function closeAnalyzeFinances() {
    document.getElementById('analyzeFinancesModal').classList.remove('active');
}

function generateFinancialAnalysis() {
    const container = document.getElementById('analyzeFinancesContent');
    if (!container) return;

    if (allExpenses.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-inbox text-4xl mb-3"></i><p>No expenses to analyze. Add some expenses first!</p></div>';
        return;
    }

    // Cumulative analysis starting from Jan 2026.
    // Periodic expenses (semi-annual insurance, annual fees) are properly
    // amortized across the full window instead of spiking a single month.
    const ANALYSIS_START = '2026-01';

    const analysisExpenses = allExpenses.filter(exp => {
        const k = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        return k >= ANALYSIS_START;
    });
    const analysisPayments = allPayments.filter(p => {
        const k = `${p.fields.Year}-${String(p.fields.Month).padStart(2, '0')}`;
        return k >= ANALYSIS_START;
    });

    if (analysisExpenses.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-inbox text-4xl mb-3"></i><p>No expenses found from Jan 2026 onwards.</p></div>';
        return;
    }

    const allMonthKeys = new Set();
    analysisExpenses.forEach(exp => {
        allMonthKeys.add(`${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`);
    });
    analysisPayments.forEach(p => {
        allMonthKeys.add(`${p.fields.Year}-${String(p.fields.Month).padStart(2, '0')}`);
    });
    const sortedMonthKeys = [...allMonthKeys].sort();
    const monthCount = sortedMonthKeys.length || 1;

    const subtitleEl = document.getElementById('analyzeFinancesSubtitle');
    if (subtitleEl) {
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        if (sortedMonthKeys.length > 0) {
            const first = sortedMonthKeys[0].split('-');
            const last = sortedMonthKeys[sortedMonthKeys.length - 1].split('-');
            subtitleEl.textContent = `Cumulative analysis: ${monthNames[parseInt(first[1]) - 1]} ${first[0]} – ${monthNames[parseInt(last[1]) - 1]} ${last[0]} (${monthCount} months)`;
        }
    }

    const totalRentalIncome = analysisPayments
        .filter(p => p.fields.PaymentType === 'RentalIncome')
        .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);
    const avgRentalIncome = totalRentalIncome / monthCount;

    const salary = HOUSEHOLD_PROFILE.monthlySalary;
    const totalMonthlyIncome = salary + avgRentalIncome;

    // Build per-category, per-month breakdown for frequency analysis
    const categoryMonthly = {};  // { cat: { 'YYYY-MM': total } }
    let totalSpent = 0;
    let mortgageTotal = 0;
    analysisExpenses.forEach(exp => {
        const cat = (exp.fields.Category || 'Other').trim();
        const amt = exp.fields.Actual || 0;
        const mk = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        if (!categoryMonthly[cat]) categoryMonthly[cat] = {};
        categoryMonthly[cat][mk] = (categoryMonthly[cat][mk] || 0) + amt;
        totalSpent += amt;
        if (cat === 'Mortgage') mortgageTotal += amt;
    });

    const avgTotalSpent = totalSpent / monthCount;
    const avgMortgage = mortgageTotal / monthCount;
    const netHousingCost = avgMortgage - avgRentalIncome;
    const nonHousingSpend = avgTotalSpent - avgMortgage;
    const monthlySurplus = totalMonthlyIncome - avgTotalSpent;
    const savingsRate = totalMonthlyIncome > 0 ? (monthlySurplus / totalMonthlyIncome) * 100 : 0;
    const housingRatio = salary > 0 ? (Math.max(0, netHousingCost) / salary) * 100 : 0;
    const discretionaryRatio = salary > 0 ? (nonHousingSpend / salary) * 100 : 0;

    const categoryResults = [];
    Object.entries(categoryMonthly).forEach(([cat, monthlyMap]) => {
        if (cat === 'Mortgage') return;

        const catTotal = Object.values(monthlyMap).reduce((s, v) => s + v, 0);
        const monthsWithSpend = Object.keys(monthlyMap).length;
        const amortizedAvg = catTotal / monthCount;

        // Detect spending frequency pattern
        const frequency = detectSpendingFrequency(monthlyMap, sortedMonthKeys, cat);

        const benchmark = FINANCIAL_BENCHMARKS[cat];
        let status, statusLabel, statusColor, benchmarkNote;
        if (benchmark) {
            if (amortizedAvg <= benchmark.max) {
                status = 'healthy';
                statusLabel = 'Healthy';
                statusColor = 'green';
            } else if (amortizedAvg <= benchmark.max * 1.25) {
                status = 'watch';
                statusLabel = 'Watch';
                statusColor = 'yellow';
            } else {
                status = 'concerning';
                statusLabel = 'Over Benchmark';
                statusColor = 'red';
            }
            benchmarkNote = benchmark.note;
        } else {
            status = 'info';
            statusLabel = 'No Benchmark';
            statusColor = 'gray';
            benchmarkNote = 'No benchmark defined for this category';
        }
        categoryResults.push({
            cat, avg: amortizedAvg, total: catTotal, benchmark,
            status, statusLabel, statusColor, benchmarkNote,
            frequency, monthsWithSpend
        });
    });

    categoryResults.sort((a, b) => b.avg - a.avg);

    // Build monthly totals for trend chart
    const monthlyTotals = {};  // { 'YYYY-MM': { spent, rental, net } }
    sortedMonthKeys.forEach(mk => { monthlyTotals[mk] = { spent: 0, rental: 0 }; });
    analysisExpenses.forEach(exp => {
        const mk = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        if (monthlyTotals[mk]) monthlyTotals[mk].spent += (exp.fields.Actual || 0);
    });
    analysisPayments.filter(p => p.fields.PaymentType === 'RentalIncome').forEach(p => {
        const mk = `${p.fields.Year}-${String(p.fields.Month).padStart(2, '0')}`;
        if (monthlyTotals[mk]) monthlyTotals[mk].rental += (p.fields.Amount || 0);
    });
    sortedMonthKeys.forEach(mk => {
        monthlyTotals[mk].net = monthlyTotals[mk].spent - monthlyTotals[mk].rental;
    });

    const healthScore = computeHealthScore(categoryResults, housingRatio, savingsRate, discretionaryRatio);
    const insights = generateFinancialInsights(categoryResults, housingRatio, savingsRate, netHousingCost, avgRentalIncome, avgMortgage, avgTotalSpent, salary, totalMonthlyIncome, monthlySurplus);

    renderFinancialAnalysis(container, {
        healthScore, salary, avgRentalIncome, totalMonthlyIncome,
        avgTotalSpent, avgMortgage, netHousingCost, monthlySurplus,
        savingsRate, housingRatio, discretionaryRatio, nonHousingSpend,
        categoryResults, insights, monthCount,
        sortedMonthKeys, monthlyTotals, categoryMonthly
    });
}

function detectSpendingFrequency(monthlyMap, allMonthKeys, category) {
    const monthsWithSpend = Object.keys(monthlyMap).length;
    const totalMonths = allMonthKeys.length;
    if (totalMonths === 0) return { type: 'unknown', label: 'Unknown', detail: '' };

    const ratio = monthsWithSpend / totalMonths;
    const amounts = Object.values(monthlyMap);
    const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const variance = amounts.length > 1
        ? amounts.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / amounts.length
        : 0;
    const cv = avg > 0 ? Math.sqrt(variance) / avg : 0; // coefficient of variation

    if (ratio >= 0.8 && cv < 0.5) {
        return { type: 'monthly', label: 'Monthly', detail: 'Consistent monthly expense' };
    }
    if (ratio >= 0.8 && cv >= 0.5) {
        return { type: 'monthly-variable', label: 'Monthly (varies)', detail: 'Occurs monthly but amount fluctuates' };
    }

    // Detect periodic patterns by looking at intervals between spending months
    const spendMonthIndices = allMonthKeys
        .map((k, i) => monthlyMap[k] ? i : -1)
        .filter(i => i >= 0);

    if (spendMonthIndices.length >= 2) {
        const gaps = [];
        for (let i = 1; i < spendMonthIndices.length; i++) {
            gaps.push(spendMonthIndices[i] - spendMonthIndices[i - 1]);
        }
        const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        const gapVariance = gaps.length > 1
            ? gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length
            : 0;
        const gapConsistent = Math.sqrt(gapVariance) <= 1.5;

        if (gapConsistent && avgGap >= 2.5 && avgGap <= 3.5) {
            return { type: 'quarterly', label: 'Quarterly', detail: `Paid ~every 3 months, amortized monthly` };
        }
        if (gapConsistent && avgGap >= 5 && avgGap <= 7) {
            return { type: 'semi-annual', label: 'Semi-Annual', detail: `Paid ~every 6 months, amortized monthly` };
        }
        if (gapConsistent && avgGap >= 10 && avgGap <= 14) {
            return { type: 'annual', label: 'Annual', detail: `Paid ~once a year, amortized monthly` };
        }
    }

    if (monthsWithSpend === 1) {
        return { type: 'one-time', label: 'One-Time', detail: 'Single occurrence, amortized over analysis period' };
    }
    if (ratio < 0.3) {
        return { type: 'occasional', label: 'Occasional', detail: `Occurred in ${monthsWithSpend} of ${totalMonths} months` };
    }
    return { type: 'irregular', label: 'Irregular', detail: `Occurred in ${monthsWithSpend} of ${totalMonths} months` };
}

function getAnalysisMonths(now, count) {
    const months = [];
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
    }
    return months;
}

function filterExpensesToMonths(months) {
    const keys = new Set(months.map(m => `${m.y}-${String(m.m).padStart(2, '0')}`));
    return allExpenses.filter(exp => {
        const k = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`;
        return keys.has(k);
    });
}

function filterPaymentsToMonths(months) {
    const keys = new Set(months.map(m => `${m.y}-${String(m.m).padStart(2, '0')}`));
    return allPayments.filter(p => {
        const k = `${p.fields.Year}-${String(p.fields.Month).padStart(2, '0')}`;
        return keys.has(k);
    });
}

function computeHealthScore(categoryResults, housingRatio, savingsRate, discretionaryRatio) {
    let score = 100;
    let deductions = [];

    categoryResults.forEach(r => {
        if (r.status === 'watch') {
            score -= 3;
            deductions.push(`${r.cat}: slightly over benchmark (-3)`);
        } else if (r.status === 'concerning') {
            const overPct = r.benchmark ? ((r.avg - r.benchmark.max) / r.benchmark.max) * 100 : 50;
            const penalty = Math.min(10, Math.round(overPct / 10) + 5);
            score -= penalty;
            deductions.push(`${r.cat}: over benchmark (-${penalty})`);
        }
    });

    if (housingRatio > 28) {
        const penalty = Math.min(15, Math.round((housingRatio - 28) / 2));
        score -= penalty;
        deductions.push(`Housing ratio ${housingRatio.toFixed(0)}% > 28% target (-${penalty})`);
    }

    if (savingsRate < 10) {
        const penalty = Math.min(15, Math.round((10 - savingsRate) * 1.5));
        score -= penalty;
        deductions.push(`Savings rate ${savingsRate.toFixed(0)}% < 10% target (-${penalty})`);
    } else if (savingsRate >= 20) {
        score = Math.min(100, score + 5);
    }

    if (discretionaryRatio > 70) {
        const penalty = Math.min(10, Math.round((discretionaryRatio - 70) / 3));
        score -= penalty;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    let grade, message;
    if (score >= 85) { grade = 'A'; message = 'Excellent financial health! You\'re managing spending well across categories.'; }
    else if (score >= 70) { grade = 'B'; message = 'Good overall. A few areas could use attention, but you\'re on track.'; }
    else if (score >= 55) { grade = 'C'; message = 'Fair. Several spending categories exceed benchmarks. Review the areas flagged below.'; }
    else if (score >= 40) { grade = 'D'; message = 'Needs improvement. Spending exceeds benchmarks in multiple areas.'; }
    else { grade = 'F'; message = 'Critical. Spending is significantly above healthy levels in many categories.'; }

    return { score, grade, message, deductions };
}

function generateFinancialInsights(categoryResults, housingRatio, savingsRate, netHousingCost, avgRentalIncome, avgMortgage, avgTotalSpent, salary, totalMonthlyIncome, monthlySurplus) {
    const insights = [];

    if (avgRentalIncome > 0) {
        const coveragePct = avgMortgage > 0 ? ((avgRentalIncome / avgMortgage) * 100).toFixed(0) : 0;
        if (avgRentalIncome >= avgMortgage) {
            insights.push({ type: 'success', icon: 'fa-home', title: 'Rental Income Covers Mortgage', message: `Your rental income ($${avgRentalIncome.toFixed(0)}/mo) covers ${coveragePct}% of your mortgage ($${avgMortgage.toFixed(0)}/mo). Net housing cost: $${netHousingCost.toFixed(0)}/mo.`, action: null });
        } else {
            insights.push({ type: 'info', icon: 'fa-home', title: 'Partial Mortgage Offset', message: `Rental income ($${avgRentalIncome.toFixed(0)}/mo) covers ${coveragePct}% of your mortgage ($${avgMortgage.toFixed(0)}/mo). You pay $${netHousingCost.toFixed(0)}/mo out of pocket for housing.`, action: 'Consider if rental rates can be adjusted to improve coverage.' });
        }
    }

    if (monthlySurplus > 0) {
        insights.push({ type: 'success', icon: 'fa-piggy-bank', title: 'Positive Cash Flow', message: `You have $${monthlySurplus.toFixed(0)}/mo surplus after all expenses. That\'s a ${savingsRate.toFixed(0)}% savings rate.`, action: savingsRate < 20 ? 'Aim for 20%+ savings rate for long-term wealth building.' : null });
    } else {
        insights.push({ type: 'warning', icon: 'fa-exclamation-triangle', title: 'Spending Exceeds Income', message: `You\'re spending $${Math.abs(monthlySurplus).toFixed(0)}/mo more than your income. This is unsustainable.`, action: 'Urgently review discretionary spending and find areas to cut.' });
    }

    if (housingRatio > 28) {
        insights.push({ type: 'warning', icon: 'fa-building', title: 'High Net Housing Cost', message: `Net housing cost is ${housingRatio.toFixed(0)}% of salary (benchmark: under 28%). Even with rental income, housing is a heavy load.`, action: 'The rental income helps, but monitor mortgage rates for refinancing opportunities.' });
    }

    const overCategories = categoryResults.filter(r => r.status === 'concerning');
    if (overCategories.length > 0) {
        const names = overCategories.slice(0, 3).map(r => r.cat).join(', ');
        const totalOver = overCategories.reduce((sum, r) => sum + (r.avg - (r.benchmark ? r.benchmark.max : 0)), 0);
        insights.push({ type: 'warning', icon: 'fa-chart-bar', title: `${overCategories.length} Categories Over Benchmark`, message: `${names} exceed healthy spending levels by a combined $${totalOver.toFixed(0)}/mo.`, action: 'Focus on the largest over-benchmark category first for maximum impact.' });
    }

    const healthyCount = categoryResults.filter(r => r.status === 'healthy').length;
    const totalBenchmarked = categoryResults.filter(r => r.benchmark).length;
    if (healthyCount > 0 && totalBenchmarked > 0) {
        insights.push({ type: 'success', icon: 'fa-check-circle', title: 'Categories Within Benchmark', message: `${healthyCount} of ${totalBenchmarked} tracked categories are within healthy spending ranges.`, action: null });
    }

    const topCategory = categoryResults[0];
    if (topCategory && topCategory.cat !== 'Mortgage') {
        const pctOfIncome = ((topCategory.avg / salary) * 100).toFixed(0);
        insights.push({ type: 'info', icon: 'fa-arrow-up', title: `Biggest Non-Housing Expense: ${topCategory.cat}`, message: `${topCategory.cat} averages $${topCategory.avg.toFixed(0)}/mo (${pctOfIncome}% of salary).`, action: topCategory.status !== 'healthy' ? `Review ${topCategory.cat} spending for potential savings.` : null });
    }

    // Highlight periodic expenses that have been amortized
    const periodicCats = categoryResults.filter(r =>
        r.frequency && ['semi-annual', 'quarterly', 'annual', 'one-time', 'occasional'].includes(r.frequency.type)
    );
    if (periodicCats.length > 0) {
        const names = periodicCats.map(r => `${r.cat} (${r.frequency.label})`).join(', ');
        insights.push({
            type: 'info',
            icon: 'fa-calendar-alt',
            title: 'Periodic Expenses Detected',
            message: `${periodicCats.length} categories are not monthly: ${names}. Their costs are amortized (spread across all months) so the benchmark comparison is fair.`,
            action: 'These are normal periodic bills — they won\'t trigger false alarms.'
        });
    }

    return insights;
}

function renderFinancialAnalysis(container, data) {
    const {
        healthScore, salary, avgRentalIncome, totalMonthlyIncome,
        avgTotalSpent, avgMortgage, netHousingCost, monthlySurplus,
        savingsRate, housingRatio, discretionaryRatio, nonHousingSpend,
        categoryResults, insights, monthCount,
        sortedMonthKeys, monthlyTotals, categoryMonthly
    } = data;

    const scoreColor = healthScore.score >= 70 ? '#10b981' : healthScore.score >= 50 ? '#f59e0b' : '#ef4444';
    const scoreGradient = healthScore.score >= 70
        ? 'linear-gradient(135deg, #10b981, #059669)'
        : healthScore.score >= 50
            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
            : 'linear-gradient(135deg, #ef4444, #dc2626)';
    const scoreEmoji = healthScore.score >= 85 ? '🟢' : healthScore.score >= 70 ? '🟡' : healthScore.score >= 50 ? '🟠' : '🔴';
    const spendBarWidth = totalMonthlyIncome > 0 ? Math.min(100, (avgTotalSpent / totalMonthlyIncome) * 100) : 100;
    const surplusColor = monthlySurplus >= 0 ? '#059669' : '#dc2626';

    // DMV peer comparison for overall non-housing spend
    const nonHousingDiff = nonHousingSpend - DMV_TOTAL_NON_HOUSING_MEDIAN;
    const nonHousingDiffPct = DMV_TOTAL_NON_HOUSING_MEDIAN > 0 ? ((nonHousingDiff / DMV_TOTAL_NON_HOUSING_MEDIAN) * 100) : 0;

    let html = `<div style="display: flex; flex-direction: column; gap: 20px;">`;

    // 1. Health Score — large visual indicator
    html += `
        <div style="background: ${scoreGradient}; border-radius: var(--radius-lg); padding: 24px; color: white; box-shadow: var(--shadow-md); position: relative; overflow: hidden;">
            <div style="position: absolute; top: -20px; right: -20px; font-size: 100px; opacity: 0.1;">${scoreEmoji}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1;">
                <div style="flex: 1;">
                    <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; font-weight: 600;">Financial Health</div>
                    <div style="font-size: 22px; font-weight: 800; margin: 4px 0;">${healthScore.score >= 85 ? 'Excellent' : healthScore.score >= 70 ? 'Good' : healthScore.score >= 50 ? 'Needs Attention' : 'Critical'}</div>
                    <div style="font-size: 12px; opacity: 0.9; line-height: 1.5; max-width: 280px;">${healthScore.message}</div>
                </div>
                <div style="text-align: center; margin-left: 16px;">
                    <div style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.15);">
                        <div>
                            <div style="font-size: 32px; font-weight: 800; line-height: 1;">${healthScore.score}</div>
                            <div style="font-size: 10px; opacity: 0.7;">/ 100</div>
                        </div>
                    </div>
                    <div style="font-size: 13px; font-weight: 700; margin-top: 6px; opacity: 0.9;">Grade ${healthScore.grade}</div>
                </div>
            </div>
        </div>`;

    // 2. DMV Peer Comparison — overall standing
    const peerVerdict = nonHousingDiffPct <= -10 ? { label: 'Below Average', color: '#059669', icon: 'fa-arrow-down', bg: 'rgba(16,185,129,0.06)' }
        : nonHousingDiffPct <= 10 ? { label: 'On Par', color: '#3b82f6', icon: 'fa-equals', bg: 'rgba(59,130,246,0.06)' }
        : nonHousingDiffPct <= 25 ? { label: 'Above Average', color: '#f59e0b', icon: 'fa-arrow-up', bg: 'rgba(245,158,11,0.06)' }
        : { label: 'Well Above', color: '#ef4444', icon: 'fa-exclamation-triangle', bg: 'rgba(239,68,68,0.06)' };

    html += `
        <div class="card" style="padding: 20px; border-left: 4px solid ${peerVerdict.color}; background: ${peerVerdict.bg};">
            <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; color: #1f2937;">
                <i class="fas fa-users" style="color: ${peerVerdict.color};"></i>How You Compare <span style="font-weight: 400; font-size: 12px; color: #9ca3af;">vs DMV families, $11k income</span>
            </div>
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 14px;">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: ${peerVerdict.bg}; border: 2px solid ${peerVerdict.color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="fas ${peerVerdict.icon}" style="font-size: 20px; color: ${peerVerdict.color};"></i>
                </div>
                <div>
                    <div style="font-size: 18px; font-weight: 800; color: ${peerVerdict.color};">${peerVerdict.label} Spender</div>
                    <div style="font-size: 13px; color: #4b5563;">Your non-housing spend is <strong style="color: ${peerVerdict.color};">${nonHousingDiffPct > 0 ? '+' : ''}${nonHousingDiffPct.toFixed(0)}%</strong> ${nonHousingDiffPct >= 0 ? 'above' : 'below'} the DMV median ($${DMV_TOTAL_NON_HOUSING_MEDIAN}/mo)</div>
                </div>
            </div>`;

    // Per-category peer comparisons (top deviations)
    const peerComparisons = categoryResults
        .filter(r => r.benchmark && r.benchmark.dmvMedian)
        .map(r => {
            const diff = r.avg - r.benchmark.dmvMedian;
            const diffPct = r.benchmark.dmvMedian > 0 ? (diff / r.benchmark.dmvMedian) * 100 : 0;
            return { ...r, diff, diffPct };
        })
        .filter(r => Math.abs(r.diffPct) >= 10)
        .sort((a, b) => Math.abs(b.diffPct) - Math.abs(a.diffPct))
        .slice(0, 5);

    if (peerComparisons.length > 0) {
        html += `<div style="display: flex; flex-direction: column; gap: 6px;">`;
        peerComparisons.forEach(r => {
            const isOver = r.diffPct > 0;
            const color = isOver ? (r.diffPct > 25 ? '#ef4444' : '#f59e0b') : '#10b981';
            const arrow = isOver ? '↑' : '↓';
            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: white; border-radius: var(--radius-md); border: 1px solid #f3f4f6;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas ${(r.benchmark && r.benchmark.icon) || 'fa-tag'}" style="color: #6b7280; font-size: 12px;"></i>
                        <span style="font-size: 13px; font-weight: 600; color: #1f2937;">${escapeHtml(r.cat)}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 13px; font-weight: 700; color: ${color};">${arrow} ${Math.abs(r.diffPct).toFixed(0)}% ${isOver ? 'more' : 'less'}</span>
                        <span style="font-size: 11px; color: #9ca3af; margin-left: 6px;">($${r.avg.toFixed(0)} vs $${r.benchmark.dmvMedian})</span>
                    </div>
                </div>`;
        });
        html += `</div>`;
    }
    html += `</div>`;

    // 3. Net Spending Trend Chart
    html += `
        <div class="card" style="padding: 20px;">
            <div style="font-weight: 700; font-size: 15px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; color: #1f2937;">
                <i class="fas fa-chart-line" style="color: var(--color-primary);"></i>Monthly Spending Trend
            </div>
            <div style="height: 220px; position: relative;"><canvas id="finAnalysisTrendChart"></canvas></div>
        </div>`;

    // 4. Income vs Expenses Summary
    html += `
        <div class="card" style="padding: 20px;">
            <div style="font-weight: 700; font-size: 15px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; color: #1f2937;">
                <i class="fas fa-balance-scale" style="color: var(--color-primary);"></i>Income vs Expenses <span style="font-weight: 400; font-size: 12px; color: #9ca3af;">(monthly avg)</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px;">
                <div style="background: rgba(102,126,234,0.08); border-radius: var(--radius-md); padding: 12px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 600; color: #667eea; text-transform: uppercase; letter-spacing: 0.5px;">Salary</div>
                    <div style="font-size: 20px; font-weight: 800; color: #1f2937;">$${salary.toLocaleString()}</div>
                </div>
                <div style="background: rgba(16,185,129,0.08); border-radius: var(--radius-md); padding: 12px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 600; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px;"><i class="fas fa-home" style="margin-right: 4px;"></i>Rental</div>
                    <div style="font-size: 20px; font-weight: 800; color: #1f2937;">$${avgRentalIncome.toFixed(0)}</div>
                </div>
                <div style="background: rgba(139,92,246,0.08); border-radius: var(--radius-md); padding: 12px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 600; color: #8b5cf6; text-transform: uppercase; letter-spacing: 0.5px;">Total Income</div>
                    <div style="font-size: 20px; font-weight: 800; color: #1f2937;">$${totalMonthlyIncome.toFixed(0)}</div>
                </div>
                <div style="background: ${monthlySurplus >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; border-radius: var(--radius-md); padding: 12px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 600; color: ${surplusColor}; text-transform: uppercase; letter-spacing: 0.5px;">${monthlySurplus >= 0 ? 'Surplus' : 'Deficit'}</div>
                    <div style="font-size: 20px; font-weight: 800; color: ${surplusColor};">${monthlySurplus >= 0 ? '+' : '-'}$${Math.abs(monthlySurplus).toFixed(0)}</div>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 11px; color: #6b7280; width: 60px;">Income</span>
                    <div style="flex: 1; background: #f3f4f6; border-radius: 99px; height: 12px;">
                        <div style="width: 100%; background: var(--color-primary); border-radius: 99px; height: 12px;"></div>
                    </div>
                    <span style="font-size: 12px; font-weight: 700; color: #374151; width: 70px; text-align: right;">$${totalMonthlyIncome.toFixed(0)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 11px; color: #6b7280; width: 60px;">Spending</span>
                    <div style="flex: 1; background: #f3f4f6; border-radius: 99px; height: 12px;">
                        <div style="width: ${spendBarWidth}%; background: ${spendBarWidth > 90 ? '#ef4444' : spendBarWidth > 75 ? '#f59e0b' : '#10b981'}; border-radius: 99px; height: 12px;"></div>
                    </div>
                    <span style="font-size: 12px; font-weight: 700; color: #374151; width: 70px; text-align: right;">$${avgTotalSpent.toFixed(0)}</span>
                </div>
            </div>
            <div style="margin-top: 12px; display: flex; gap: 16px; font-size: 12px; color: #6b7280;">
                <span>Savings: <strong style="color: ${savingsRate >= 20 ? '#059669' : savingsRate >= 10 ? '#d97706' : '#dc2626'};">${savingsRate.toFixed(0)}%</strong></span>
                <span>Non-Housing: <strong>${discretionaryRatio.toFixed(0)}%</strong> of salary</span>
            </div>
        </div>`;

    // 5. Housing Analysis
    const housingBorderColor = housingRatio <= 28 ? '#10b981' : housingRatio <= 35 ? '#f59e0b' : '#ef4444';
    html += `
        <div class="card" style="padding: 20px; border-left: 4px solid ${housingBorderColor};">
            <div style="font-weight: 700; font-size: 15px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; color: #1f2937;">
                <i class="fas fa-home" style="color: ${housingBorderColor};"></i>Housing Analysis
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px;">
                <div style="text-align: center; padding: 10px; background: #f9fafb; border-radius: var(--radius-md);">
                    <div style="font-size: 11px; color: #6b7280; font-weight: 600;">Mortgage</div>
                    <div style="font-size: 18px; font-weight: 800; color: #1f2937;">$${avgMortgage.toFixed(0)}</div>
                    <div style="font-size: 10px; color: #9ca3af;">/month</div>
                </div>
                <div style="text-align: center; padding: 10px; background: rgba(16,185,129,0.06); border-radius: var(--radius-md);">
                    <div style="font-size: 11px; color: #10b981; font-weight: 600;">Rental Income</div>
                    <div style="font-size: 18px; font-weight: 800; color: #059669;">-$${avgRentalIncome.toFixed(0)}</div>
                    <div style="font-size: 10px; color: #9ca3af;">/month</div>
                </div>
                <div style="text-align: center; padding: 10px; background: ${netHousingCost <= 0 ? 'rgba(16,185,129,0.06)' : '#f9fafb'}; border-radius: var(--radius-md);">
                    <div style="font-size: 11px; color: #6b7280; font-weight: 600;">Net Cost</div>
                    <div style="font-size: 18px; font-weight: 800; color: ${netHousingCost <= 0 ? '#059669' : '#1f2937'};">${netHousingCost <= 0 ? '-' : ''}$${Math.abs(netHousingCost).toFixed(0)}</div>
                    <div style="font-size: 10px; color: #9ca3af;">/month</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 11px; color: #6b7280; white-space: nowrap;">Housing Ratio:</span>
                <div style="flex: 1; background: #f3f4f6; border-radius: 99px; height: 8px;">
                    <div style="width: ${Math.min(100, housingRatio * 2)}%; background: ${housingBorderColor}; border-radius: 99px; height: 8px;"></div>
                </div>
                <span style="font-size: 12px; font-weight: 700; color: ${housingBorderColor};">${housingRatio.toFixed(0)}%</span>
                <span style="font-size: 10px; color: #9ca3af;">(target: &lt;28%)</span>
            </div>
        </div>`;

    // 6. Category Benchmarks with Peer Comparison
    html += `
        <div>
            <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; color: #1f2937;">
                <i class="fas fa-th-list" style="color: var(--color-primary);"></i>Category Benchmarks <span style="font-weight: 400; font-size: 12px; color: #9ca3af;">(amortized over ${monthCount} months)</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">`;

    categoryResults.forEach(r => {
        const icon = (r.benchmark && r.benchmark.icon) || FINANCIAL_BENCHMARKS[r.cat]?.icon || 'fa-tag';
        const dotColor = r.statusColor === 'green' ? '#10b981'
            : r.statusColor === 'yellow' ? '#f59e0b'
            : r.statusColor === 'red' ? '#ef4444' : '#9ca3af';
        const labelBg = r.statusColor === 'green' ? 'rgba(16,185,129,0.1)'
            : r.statusColor === 'yellow' ? 'rgba(245,158,11,0.1)'
            : r.statusColor === 'red' ? 'rgba(239,68,68,0.1)' : 'rgba(156,163,175,0.1)';
        const labelColor = r.statusColor === 'green' ? '#059669'
            : r.statusColor === 'yellow' ? '#d97706'
            : r.statusColor === 'red' ? '#dc2626' : '#6b7280';

        let barPct = 0;
        let barColor = '#d1d5db';
        let benchmarkRange = 'No benchmark';
        if (r.benchmark) {
            barPct = Math.min(100, (r.avg / (r.benchmark.max * 1.5)) * 100);
            barColor = dotColor;
            benchmarkRange = `$${r.benchmark.min} – $${r.benchmark.max}`;
        }

        const freq = r.frequency || {};
        const freqBadge = freq.type && freq.type !== 'monthly'
            ? `<span style="display: inline-block; padding: 1px 6px; background: rgba(59,130,246,0.1); color: #2563eb; border-radius: 4px; font-size: 10px; font-weight: 600; margin-left: 6px;">${freq.label}</span>`
            : '';

        // Peer comparison line
        let peerLine = '';
        if (r.benchmark && r.benchmark.dmvMedian) {
            const pDiff = r.avg - r.benchmark.dmvMedian;
            const pPct = (pDiff / r.benchmark.dmvMedian) * 100;
            if (Math.abs(pPct) >= 5) {
                const pColor = pPct > 25 ? '#ef4444' : pPct > 0 ? '#f59e0b' : '#10b981';
                peerLine = `<div style="font-size: 11px; color: ${pColor}; margin-top: 2px;"><i class="fas fa-users" style="margin-right: 3px;"></i>${pPct > 0 ? '+' : ''}${pPct.toFixed(0)}% vs DMV peers ($${r.benchmark.dmvMedian}/mo typical)</div>`;
            }
        }

        html += `
            <div class="card" style="padding: 12px 14px; display: flex; align-items: flex-start; gap: 12px; border-left: 3px solid ${dotColor};">
                <div style="width: 32px; height: 32px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--gradient-primary); margin-top: 2px;">
                    <i class="fas ${icon}" style="color: white; font-size: 12px;"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="font-weight: 600; font-size: 13px; color: #1f2937; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(r.cat)}${freqBadge}</div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            <span style="font-size: 14px; font-weight: 700; color: #1f2937;">$${r.avg.toFixed(0)}<span style="font-size: 10px; font-weight: 500; color: #9ca3af;">/mo</span></span>
                            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; background: ${labelBg}; color: ${labelColor};">
                                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${dotColor};"></span>${r.statusLabel}
                            </span>
                        </div>
                    </div>
                    ${peerLine}
                    ${freq.type && freq.type !== 'monthly' ? `<div style="font-size: 11px; color: #3b82f6; margin-top: 2px;"><i class="fas fa-calendar-alt" style="margin-right: 4px;"></i>${freq.detail} (total: $${r.total.toFixed(0)} over ${monthCount} mo)</div>` : ''}
                    <div style="margin-top: 6px; display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; background: #e5e7eb; border-radius: 99px; height: 5px;">
                            <div style="width: ${barPct}%; background: ${barColor}; border-radius: 99px; height: 5px;"></div>
                        </div>
                        <span style="font-size: 10px; color: #9ca3af; flex-shrink: 0;">${benchmarkRange}</span>
                    </div>
                </div>
            </div>`;
    });

    html += `</div></div>`;

    // 7. Key Takeaways / Insights
    if (insights.length > 0) {
        html += `
            <div>
                <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; color: #1f2937;">
                    <i class="fas fa-lightbulb" style="color: #f59e0b;"></i>Key Takeaways
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">`;

        insights.forEach(insight => {
            const accentColor = insight.type === 'warning' ? '#ef4444'
                : insight.type === 'success' ? '#10b981'
                : insight.type === 'info' ? '#3b82f6' : '#f59e0b';
            const bgTint = insight.type === 'warning' ? 'rgba(239,68,68,0.04)'
                : insight.type === 'success' ? 'rgba(16,185,129,0.04)'
                : insight.type === 'info' ? 'rgba(59,130,246,0.04)' : 'rgba(245,158,11,0.04)';

            html += `
                <div class="card" style="padding: 14px 16px; border-left: 4px solid ${accentColor}; background: ${bgTint};">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <i class="fas ${insight.icon}" style="font-size: 18px; color: ${accentColor}; margin-top: 2px; flex-shrink: 0;"></i>
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 13px; color: #1f2937; margin-bottom: 4px;">${insight.title}</div>
                            <div style="font-size: 12px; color: #4b5563; line-height: 1.5;">${insight.message}</div>
                            ${insight.action ? `<div style="margin-top: 6px; font-size: 11px; font-weight: 600; color: ${accentColor};"><i class="fas fa-lightbulb" style="margin-right: 4px;"></i>${insight.action}</div>` : ''}
                        </div>
                    </div>
                </div>`;
        });

        html += `</div></div>`;
    }

    // 8. AI-Powered Insights (loaded asynchronously via Gemini)
    html += `
        <div id="aiFinancialInsightsSection">
            <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; color: #1f2937;">
                <i class="fas fa-robot" style="color: #8b5cf6;"></i>AI-Powered Insights <span style="font-weight: 400; font-size: 12px; color: #9ca3af;">by Gemini</span>
            </div>
            <div id="aiFinancialInsightsContent" style="min-height: 120px;">
                <div class="card" style="padding: 24px; text-align: center; border: 1px dashed #d1d5db;">
                    <div class="loader-spinner" style="margin: 0 auto 12px;"></div>
                    <div style="font-size: 13px; color: #6b7280;">Analyzing your finances with AI...</div>
                    <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">Considering current DMV cost-of-living, inflation trends, and your spending patterns</div>
                </div>
            </div>
        </div>`;

    html += `</div>`;
    container.innerHTML = html;

    // Render the trend chart after DOM is ready
    setTimeout(() => renderFinancialTrendChart(sortedMonthKeys, monthlyTotals, salary), 50);

    // Fire off AI analysis asynchronously
    fetchAIFinancialInsights(data);
}

function renderFinancialTrendChart(sortedMonthKeys, monthlyTotals, salary) {
    const canvas = document.getElementById('finAnalysisTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels = sortedMonthKeys.map(mk => {
        const [y, m] = mk.split('-');
        return `${monthNames[parseInt(m) - 1]} ${y.slice(2)}`;
    });

    const spentData = sortedMonthKeys.map(mk => monthlyTotals[mk]?.spent || 0);
    const netData = sortedMonthKeys.map(mk => monthlyTotals[mk]?.net || 0);
    const incomeData = sortedMonthKeys.map(() => salary);

    if (canvas._finChart) canvas._finChart.destroy();

    canvas._finChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Total Spent',
                    data: spentData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.08)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#ef4444'
                },
                {
                    label: 'Net Spend (after rental)',
                    data: netData,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102,126,234,0.08)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#667eea'
                },
                {
                    label: 'Salary Income',
                    data: incomeData,
                    borderColor: '#10b981',
                    borderDash: [6, 4],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: function(ctx) { return `${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString()}`; }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => `$${(v / 1000).toFixed(0)}k`, font: { size: 11 } },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: { ticks: { font: { size: 11 } }, grid: { display: false } }
            }
        }
    });
}

function buildAIFinancialPrompt(data) {
    const {
        healthScore, salary, avgRentalIncome, totalMonthlyIncome,
        avgTotalSpent, avgMortgage, netHousingCost, monthlySurplus,
        savingsRate, housingRatio, nonHousingSpend,
        categoryResults, monthCount, sortedMonthKeys, monthlyTotals
    } = data;

    const catSummary = categoryResults.slice(0, 15).map(r => {
        const peer = r.benchmark?.dmvMedian ? `, DMV median: $${r.benchmark.dmvMedian}` : '';
        const freq = r.frequency?.type !== 'monthly' ? ` (${r.frequency?.label || r.frequency?.type})` : '';
        return `  - ${r.cat}: $${r.avg.toFixed(0)}/mo avg${freq}, status: ${r.statusLabel}${peer}`;
    }).join('\n');

    const trendSummary = sortedMonthKeys.map(mk => {
        const t = monthlyTotals[mk];
        return `  ${mk}: spent $${t.spent.toFixed(0)}, rental $${t.rental.toFixed(0)}, net $${t.net.toFixed(0)}`;
    }).join('\n');

    return `You are a personal finance advisor for a family in the DMV area (Herndon, VA). Analyze their finances and provide dynamic, actionable insights based on CURRENT economic conditions (2026 inflation, DMV cost of living, interest rates, market trends).

FAMILY PROFILE:
- Couple in mid-30s, 10-month-old daughter
- Combined salary: $${salary.toLocaleString()}/mo post-tax (Amar $6k, Priya $5k)
- Own 2 rental houses in Charles Town, WV (avg rental income: $${avgRentalIncome.toFixed(0)}/mo)
- Live in rental apartment in Herndon, VA

FINANCIAL SNAPSHOT (${monthCount} months analyzed):
- Total income: $${totalMonthlyIncome.toFixed(0)}/mo (salary + rental)
- Avg spending: $${avgTotalSpent.toFixed(0)}/mo
- Monthly surplus: $${monthlySurplus.toFixed(0)}/mo
- Savings rate: ${savingsRate.toFixed(1)}%
- Housing ratio: ${housingRatio.toFixed(1)}% of salary
- Mortgage: $${avgMortgage.toFixed(0)}/mo, Net housing cost: $${netHousingCost.toFixed(0)}/mo
- Non-housing spending: $${nonHousingSpend.toFixed(0)}/mo
- Health score: ${healthScore.score}/100 (${healthScore.grade})

CATEGORY BREAKDOWN (amortized monthly avg):
${catSummary}

MONTHLY TREND:
${trendSummary}

Provide your analysis as a JSON object with this EXACT structure (no markdown fences):
{
  "insights": [
    {
      "type": "success|warning|info|tip",
      "icon": "fa-icon-name",
      "title": "Short title",
      "message": "Detailed insight with specific numbers, DMV context, and current economic context",
      "action": "Specific actionable advice or null"
    }
  ]
}

REQUIREMENTS:
1. Include 5-7 insights covering: overall financial health, DMV cost-of-living context, spending velocity/trend direction, specific category comparisons vs DMV peers, investment property performance, savings optimization, and one forward-looking tip based on current economic conditions
2. Use SPECIFIC percentages and dollar amounts from the data — e.g. "You spend 32% more on dining than a typical DMV family at your income level"
3. Consider current 2026 economic conditions: inflation rates, grocery price trends, gas prices in Northern Virginia, housing market
4. Be conversational but data-driven. Avoid generic advice
5. If spending is trending up or down month-over-month, call that out specifically
6. Compare non-housing spending to what a similar DMV family ($11k/mo income, family of 3) would typically spend
7. Return ONLY the JSON object, nothing else`;
}

async function fetchAIFinancialInsights(data) {
    const container = document.getElementById('aiFinancialInsightsContent');
    if (!container) return;

    let insights = null;

    // Primary: HuggingFace via deepseek-smart-search edge function
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
            const prompt = buildAIFinancialPrompt(data);
            const endpoint = `${SUPABASE_URL}/functions/v1/deepseek-smart-search`;
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ query: prompt, history: [] })
            });
            const respData = await resp.json().catch(() => null);
            if (resp.ok && respData?.result) {
                const result = respData.result;
                if (Array.isArray(result.insights)) {
                    insights = result.insights;
                } else if (result.answer_markdown) {
                    try {
                        const parsed = JSON.parse(result.answer_markdown);
                        if (Array.isArray(parsed.insights)) insights = parsed.insights;
                    } catch (_e) { /* not JSON, skip */ }
                }
            }
            if (!insights) {
                console.warn('HuggingFace did not return valid insights, falling back to Gemini');
            }
        } catch (e) {
            console.warn('HuggingFace financial analysis failed, falling back to Gemini:', e);
        }
    }

    // Fallback: Gemini client-side
    if (!insights) {
        try {
            const apiKey = await getGeminiApiKey();
            const prompt = buildAIFinancialPrompt(data);
            const requestBody = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json',
                    thinkingConfig: { thinkingBudget: 0 }
                }
            };
            const geminiData = await callGeminiGenerateContent(apiKey, requestBody);
            const textResponse = geminiData?.candidates?.[0]?.content?.parts
                ?.map(p => p.text || '').join('').trim();
            if (textResponse) {
                let jsonStr = textResponse;
                if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed.insights)) insights = parsed.insights;
            }
        } catch (e) {
            console.error('Gemini financial analysis also failed:', e);
        }
    }

    // Render results
    if (!insights || insights.length === 0) {
        container.innerHTML = `
            <div class="card" style="padding: 20px; text-align: center; border-left: 4px solid #f59e0b;">
                <i class="fas fa-exclamation-triangle" style="color: #f59e0b; font-size: 24px; margin-bottom: 8px;"></i>
                <div style="font-size: 13px; color: #6b7280;">AI analysis is temporarily unavailable. The static insights above still reflect your current financial picture.</div>
            </div>`;
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
    insights.forEach(insight => {
        const type = String(insight.type || 'info');
        const accentColor = type === 'warning' ? '#ef4444'
            : type === 'success' ? '#10b981'
            : type === 'tip' ? '#8b5cf6'
            : '#3b82f6';
        const bgTint = type === 'warning' ? 'rgba(239,68,68,0.04)'
            : type === 'success' ? 'rgba(16,185,129,0.04)'
            : type === 'tip' ? 'rgba(139,92,246,0.04)'
            : 'rgba(59,130,246,0.04)';
        const icon = insight.icon || 'fa-lightbulb';

        html += `
            <div class="card" style="padding: 14px 16px; border-left: 4px solid ${accentColor}; background: ${bgTint};">
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <i class="fas ${escapeHtml(icon)}" style="font-size: 18px; color: ${accentColor}; margin-top: 2px; flex-shrink: 0;"></i>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 13px; color: #1f2937; margin-bottom: 4px;">${escapeHtml(String(insight.title || ''))}</div>
                        <div style="font-size: 12px; color: #4b5563; line-height: 1.5;">${escapeHtml(String(insight.message || ''))}</div>
                        ${insight.action ? `<div style="margin-top: 6px; font-size: 11px; font-weight: 600; color: ${accentColor};"><i class="fas fa-lightbulb" style="margin-right: 4px;"></i>${escapeHtml(String(insight.action))}</div>` : ''}
                    </div>
                </div>
            </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function openAdvancedAnalytics() {
    closeAllModalsExcept('advancedAnalyticsModal');
    document.getElementById('advancedAnalyticsModal').classList.add('active');
    generateAdvancedAnalytics();
}

function closeAdvancedAnalytics() {
    document.getElementById('advancedAnalyticsModal').classList.remove('active');
}

function generateAdvancedAnalytics() {
    const container = document.getElementById('advancedAnalyticsContent');

    if (allExpenses.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-inbox text-4xl mb-3"></i><p>No expenses to analyze. Add some expenses first!</p></div>';
        return;
    }

    // Render analytics dashboard
    container.innerHTML = `
                 <div class="space-y-6">
                     <!-- Top Spending Days -->
                     <div class="card p-6">
                         <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                             <i class="fas fa-fire text-red-600"></i>
                             Top 10 Spending Days
                         </h3>
                         <div id="topSpendingDays"></div>
                     </div>
                     
                     <!-- Monthly Spending Trend -->
                     <div class="card p-6">
                         <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                             <i class="fas fa-chart-line text-purple-600"></i>
                             Monthly Spending Trend (Last 6 Months)
                         </h3>
                         <div class="chart-container" style="height: 300px;">
                             <canvas id="monthlyTrendChart"></canvas>
                         </div>
                     </div>
                     
                     <!-- Category Distribution -->
                     <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div class="card p-6">
                             <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                                 <i class="fas fa-chart-pie text-purple-600"></i>
                                 Spending by Category
                             </h3>
                             <div class="chart-container" style="height: 300px;">
                                 <canvas id="categoryPieChart"></canvas>
                             </div>
                         </div>
                         
                         <!-- Budget vs Actual -->
                         <div class="card p-6">
                             <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                                 <i class="fas fa-balance-scale text-purple-600"></i>
                                 Budget vs Actual
                             </h3>
                             <div class="chart-container" style="height: 300px;">
                                 <canvas id="budgetVsActualChart"></canvas>
                             </div>
                         </div>
                     </div>
                     
                     <!-- Category Comparison Chart -->
                     <div class="card p-6">
                         <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                             <i class="fas fa-chart-bar text-purple-600"></i>
                             Category Comparison - Last 3 Months
                         </h3>
                         <div class="chart-container" style="height: 400px;">
                             <canvas id="categoryComparisonChart"></canvas>
                         </div>
                     </div>
                 </div>
             `;

    // Generate each visualization
    createTopSpendingDays();
    createMonthlyTrendChart();
    createCategoryPieChart();
    createBudgetVsActualChart();
    createCategoryComparisonChart();
}

function createTopSpendingDays() {
    const container = document.getElementById('topSpendingDays');

    // Group expenses by date and sum
    const dailySpending = {};
    allExpenses.forEach(exp => {
        const dateKey = `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}-${String(exp.fields.Day || 1).padStart(2, '0')}`;
        const displayDate = `${exp.fields.Month}/${exp.fields.Day || 1}/${exp.fields.Year}`;

        if (!dailySpending[dateKey]) {
            dailySpending[dateKey] = {
                date: displayDate,
                total: 0,
                expenses: []
            };
        }

        dailySpending[dateKey].total += exp.fields.Actual || 0;
        dailySpending[dateKey].expenses.push({
            item: exp.fields.Item,
            amount: exp.fields.Actual || 0,
            category: exp.fields.Category || 'Other'
        });
    });

    // Sort by total and get top 10
    const topDays = Object.values(dailySpending)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    if (topDays.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No spending data available</p>';
        return;
    }

    // Render top days
    let html = '<div class="space-y-3">';
    topDays.forEach((day, index) => {
        const maxAmount = topDays[0].total;
        const percentage = (day.total / maxAmount * 100);

        html += `
                     <div class="relative">
                         <div class="flex items-center justify-between mb-2">
                             <div class="flex items-center gap-3">
                                 <span class="text-2xl font-bold text-gray-400">#${index + 1}</span>
                                 <div>
                                     <div class="font-semibold text-gray-800">${day.date}</div>
                                     <div class="text-xs text-gray-500">${day.expenses.length} expense${day.expenses.length > 1 ? 's' : ''}</div>
                                 </div>
                             </div>
                             <div class="text-right">
                                 <div class="text-xl font-bold text-purple-600">$${day.total.toFixed(2)}</div>
                             </div>
                         </div>
                         <div class="w-full bg-gray-200 rounded-full h-2">
                             <div class="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all" style="width: ${percentage}%"></div>
                         </div>
                         <div class="mt-2 text-xs text-gray-600">
                             ${day.expenses.slice(0, 3).map(e => `${e.item} ($${e.amount.toFixed(2)})`).join(', ')}
                             ${day.expenses.length > 3 ? ` +${day.expenses.length - 3} more` : ''}
                         </div>
                     </div>
                 `;
    });
    html += '</div>';

    container.innerHTML = html;
}

function createMonthlyTrendChart() {
    const ctx = document.getElementById('monthlyTrendChart');
    if (!ctx) return;

    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Get last 6 months
    const labels = [];
    const spendingData = [];
    const budgetData = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        labels.push(`${monthNames[date.getMonth()]} ${year}`);

        const monthExpenses = allExpenses.filter(exp =>
            exp.fields.Year === year && exp.fields.Month === month
        );

        const spending = monthExpenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
        const budget = monthExpenses.reduce((sum, exp) => sum + (exp.fields.Budget || 0), 0);

        spendingData.push(spending);
        budgetData.push(budget);
    }

    // Destroy existing chart
    if (window.monthlyTrendChart && typeof window.monthlyTrendChart.destroy === 'function') {
        window.monthlyTrendChart.destroy();
    }

    window.monthlyTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Actual Spending',
                    data: spendingData,
                    borderColor: '#f093fb',
                    backgroundColor: 'rgba(240, 147, 251, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#f093fb',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: 'Budget',
                    data: budgetData,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toFixed(0);
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function createCategoryPieChart() {
    const ctx = document.getElementById('categoryPieChart');
    if (!ctx) return;

    // Aggregate by category
    const categoryTotals = {};
    allExpenses.forEach(exp => {
        const cat = exp.fields.Category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.fields.Actual || 0);
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const colors = [
        '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
        '#fee140', '#30cfd0', '#a8edea', '#fed6e3', '#c471ed'
    ];

    // Destroy existing chart
    if (window.categoryPieChart && typeof window.categoryPieChart.destroy === 'function') {
        window.categoryPieChart.destroy();
    }

    window.categoryPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return context.label + ': $' + context.parsed.toFixed(2) + ' (' + percentage + '%)';
                        }
                    }
                }
            }
        }
    });
}

function createBudgetVsActualChart() {
    const ctx = document.getElementById('budgetVsActualChart');
    if (!ctx) return;

    // Aggregate by category
    const categoryData = {};
    allExpenses.forEach(exp => {
        const cat = exp.fields.Category || 'Other';
        if (!categoryData[cat]) {
            categoryData[cat] = { budget: 0, actual: 0 };
        }
        categoryData[cat].budget += exp.fields.Budget || 0;
        categoryData[cat].actual += exp.fields.Actual || 0;
    });

    const labels = Object.keys(categoryData);
    const budgetData = labels.map(cat => categoryData[cat].budget);
    const actualData = labels.map(cat => categoryData[cat].actual);

    // Destroy existing chart
    if (window.budgetVsActualChart && typeof window.budgetVsActualChart.destroy === 'function') {
        window.budgetVsActualChart.destroy();
    }

    window.budgetVsActualChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Budget',
                    data: budgetData,
                    backgroundColor: '#667eea',
                    borderRadius: 8
                },
                {
                    label: 'Actual',
                    data: actualData,
                    backgroundColor: '#f093fb',
                    borderRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                }
            }
        }
    });
}

function createSpendingHeatmap() {
    const container = document.getElementById('spendingHeatmap');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Get days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    // Calculate daily spending
    const dailySpending = {};
    allExpenses.forEach(exp => {
        if (exp.fields.Year === year && exp.fields.Month === month + 1) {
            const day = exp.fields.Day || 1;
            dailySpending[day] = (dailySpending[day] || 0) + (exp.fields.Actual || 0);
        }
    });

    // Find max spending for color scale
    const maxSpending = Math.max(...Object.values(dailySpending), 1);

    // Generate calendar HTML
    let html = '<div class="grid grid-cols-7 gap-2">';

    // Day headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        html += `<div class="text-center text-xs font-semibold text-gray-600 py-2">${day}</div>`;
    });

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        html += '<div></div>';
    }

    // Calendar days
    for (let day = 1; day <= daysInMonth; day++) {
        const spending = dailySpending[day] || 0;
        const intensity = spending / maxSpending;

        // Color scale: white -> light purple -> dark purple
        let bgColor;
        if (spending === 0) {
            bgColor = '#f3f4f6'; // gray-100
        } else if (intensity < 0.25) {
            bgColor = '#e9d5ff'; // purple-200
        } else if (intensity < 0.5) {
            bgColor = '#d8b4fe'; // purple-300
        } else if (intensity < 0.75) {
            bgColor = '#c084fc'; // purple-400
        } else {
            bgColor = '#a855f7'; // purple-500
        }

        const textColor = intensity > 0.5 ? '#ffffff' : '#1f2937';
        const isToday = day === now.getDate();

        html += `
                     <div class="aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-semibold ${isToday ? 'ring-2 ring-purple-600' : ''}" 
                          style="background-color: ${bgColor}; color: ${textColor};"
                          title="Day ${day}: $${spending.toFixed(2)}">
                         <div>${day}</div>
                         ${spending > 0 ? `<div class="text-[10px] mt-1">$${spending.toFixed(0)}</div>` : ''}
                     </div>
                 `;
    }

    html += '</div>';
    html += '<div class="mt-4 flex items-center justify-center gap-4 text-xs text-gray-600">';
    html += '<span>Less</span>';
    html += '<div class="flex gap-1">';
    html += '<div class="w-4 h-4 rounded" style="background-color: #f3f4f6"></div>';
    html += '<div class="w-4 h-4 rounded" style="background-color: #e9d5ff"></div>';
    html += '<div class="w-4 h-4 rounded" style="background-color: #d8b4fe"></div>';
    html += '<div class="w-4 h-4 rounded" style="background-color: #c084fc"></div>';
    html += '<div class="w-4 h-4 rounded" style="background-color: #a855f7"></div>';
    html += '</div>';
    html += '<span>More</span>';
    html += '</div>';

    container.innerHTML = html;
}

function createSpendingVelocityGauge() {
    const ctx = document.getElementById('velocityChart');
    if (!ctx) return;

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = now.getDate();
    const daysRemaining = daysInMonth - daysPassed;

    // Calculate current month spending
    const currentMonthSpending = allExpenses
        .filter(exp => exp.fields.Year === now.getFullYear() && exp.fields.Month === now.getMonth() + 1)
        .reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);

    const currentMonthBudget = allExpenses
        .filter(exp => exp.fields.Year === now.getFullYear() && exp.fields.Month === now.getMonth() + 1)
        .reduce((sum, exp) => sum + (exp.fields.Budget || 0), 0);

    // Calculate velocity
    const actualPace = (currentMonthSpending / daysPassed) * daysInMonth;
    const budgetPace = currentMonthBudget;
    const velocity = budgetPace > 0 ? (actualPace / budgetPace * 100) : 0;

    // Destroy existing chart
    if (window.velocityChart && typeof window.velocityChart.destroy === 'function') {
        window.velocityChart.destroy();
    }

    window.velocityChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Current Pace', 'Remaining Budget'],
            datasets: [{
                data: [Math.min(velocity, 100), Math.max(100 - velocity, 0)],
                backgroundColor: [
                    velocity > 100 ? '#ef4444' : velocity > 80 ? '#f59e0b' : '#10b981',
                    '#e5e7eb'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.label + ': ' + context.parsed.toFixed(0) + '%';
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerText',
            afterDraw: (chart) => {
                const ctx = chart.ctx;
                const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

                ctx.save();
                ctx.font = 'bold 32px Inter';
                ctx.fillStyle = velocity > 100 ? '#ef4444' : velocity > 80 ? '#f59e0b' : '#10b981';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(velocity.toFixed(0) + '%', centerX, centerY - 10);

                ctx.font = '14px Inter';
                ctx.fillStyle = '#6b7280';
                ctx.fillText('Spending Pace', centerX, centerY + 20);
                ctx.restore();
            }
        }]
    });
}

function createCategoryComparisonChart() {
    const ctx = document.getElementById('categoryComparisonChart');
    if (!ctx) return;

    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Get last 3 months
    const months = [];
    const monthData = {};

    for (let i = 2; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        months.push(monthLabel);
        monthData[monthKey] = {};
    }

    // Aggregate by category and month
    allExpenses.forEach(exp => {
        const monthKey = `${exp.fields.Year}-${exp.fields.Month}`;
        if (monthData[monthKey]) {
            const cat = exp.fields.Category || 'Other';
            monthData[monthKey][cat] = (monthData[monthKey][cat] || 0) + (exp.fields.Actual || 0);
        }
    });

    // Get all categories
    const categories = new Set();
    Object.values(monthData).forEach(month => {
        Object.keys(month).forEach(cat => categories.add(cat));
    });

    // Create datasets
    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0'];
    const datasets = Array.from(categories).map((cat, index) => ({
        label: cat,
        data: Object.keys(monthData).map(monthKey => monthData[monthKey][cat] || 0),
        backgroundColor: colors[index % colors.length],
        borderRadius: 8
    }));

    // Destroy existing chart
    if (window.categoryComparisonChart && typeof window.categoryComparisonChart.destroy === 'function') {
        window.categoryComparisonChart.destroy();
    }

    window.categoryComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: false,
                    grid: { display: false }
                },
                y: {
                    stacked: false,
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                }
            }
        }
    });
}

function createSavingsRateChart() {
    const ctx = document.getElementById('savingsChart');
    if (!ctx) return;

    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Get last 6 months
    const labels = [];
    const savingsData = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        labels.push(`${monthNames[date.getMonth()]} ${year}`);

        const monthExpenses = allExpenses.filter(exp =>
            exp.fields.Year === year && exp.fields.Month === month
        );

        const budget = monthExpenses.reduce((sum, exp) => sum + (exp.fields.Budget || 0), 0);
        const actual = monthExpenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
        const savings = budget - actual;

        savingsData.push(savings);
    }

    // Destroy existing chart
    if (window.savingsChart && typeof window.savingsChart.destroy === 'function') {
        window.savingsChart.destroy();
    }

    window.savingsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Savings',
                data: savingsData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed.y;
                            return value >= 0
                                ? 'Saved: $' + value.toFixed(2)
                                : 'Overspent: $' + Math.abs(value).toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toFixed(0);
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function openSmartSearch() {
    closeAllModalsExcept('smartSearchModal');
    document.getElementById('smartSearchModal').classList.add('active');

    // LLM-only chat UI
    initSmartSearchChat();
}

function closeSmartSearch() {
    document.getElementById('smartSearchModal').classList.remove('active');
}

const SMART_SEARCH_HISTORY_KEY = 'smart_search_chat_history_v1';

function getSmartSearchHistory() {
    try {
        const raw = sessionStorage.getItem(SMART_SEARCH_HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
        return [];
    }
}

function setSmartSearchHistory(history) {
    try {
        sessionStorage.setItem(SMART_SEARCH_HISTORY_KEY, JSON.stringify(history || []));
    } catch (_e) {
        // ignore
    }
}

function setSmartSearchTyping(isTyping) {
    const mount = document.getElementById('smartSearchTypingMount');
    if (!mount) return;
    if (!isTyping) {
        mount.innerHTML = '';
        return;
    }

    mount.innerHTML = `
        <div class="smart-search-row">
            <div class="smart-search-bubble assistant smart-search-typing">
                <span class="smart-search-typing-label">Thinking</span>
                <span class="smart-search-dots" aria-hidden="true">
                    <span></span><span></span><span></span>
                </span>
            </div>
        </div>
    `;

    const container = document.getElementById('smartSearchChat');
    if (container) container.scrollTop = container.scrollHeight;
}

function renderSmartSearchMessage(role, content) {
    const container = document.getElementById('smartSearchChat');
    if (!container) return;

    const isUser = role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `smart-search-row ${isUser ? 'user' : 'assistant'}`;

    const bubble = document.createElement('div');
    bubble.className = `smart-search-bubble ${isUser ? 'user' : 'assistant'}`;
    bubble.style.whiteSpace = 'pre-wrap';
    bubble.innerHTML = escapeHtml(String(content || '')).replace(/\n/g, '<br>');

    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

function renderSmartSearchAssistantResult(result) {
    const container = document.getElementById('smartSearchChat');
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'smart-search-row assistant';

    const bubble = document.createElement('div');
    bubble.className = 'smart-search-bubble assistant smart-search-bubble-rich';

    const parts = [];
    const answer = String(result?.answer_markdown || '').trim();
    if (answer) {
        parts.push(`<div style="white-space: pre-wrap;">${escapeHtml(answer)}</div>`);
    }

    const tables = Array.isArray(result?.tables) ? result.tables : [];
    for (const t of tables) {
        const title = String(t?.title || '').trim();
        const columns = Array.isArray(t?.columns) ? t.columns : [];
        const rows = Array.isArray(t?.rows) ? t.rows : [];

        const head = columns.map(c => `<th class="text-left text-xs font-semibold text-gray-600 px-2 py-1 border-b border-gray-200">${escapeHtml(String(c))}</th>`).join('');
        const body = rows.slice(0, 200).map(r => {
            const cells = (Array.isArray(r) ? r : []).map(cell => `<td class="text-sm px-2 py-1 border-b border-gray-100">${escapeHtml(String(cell))}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        parts.push(`
            <div class="mt-3">
                ${title ? `<div class="text-sm font-semibold text-gray-700 mb-1">${escapeHtml(title)}</div>` : ''}
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead><tr>${head}</tr></thead>
                        <tbody>${body}</tbody>
                    </table>
                </div>
            </div>
        `);
    }

    const followups = Array.isArray(result?.followups) ? result.followups : [];
    if (followups.length > 0) {
        const chips = followups.slice(0, 6).map(f => {
            const label = String(f || '').trim();
            if (!label) return '';
            const encoded = encodeURIComponent(label);
            return `<button class="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-700 hover:bg-gray-50" onclick="applySmartSearchFollowup('${encoded}')">${escapeHtml(label)}</button>`;
        }).join('');
        parts.push(`<div class="mt-3 flex flex-wrap gap-2">${chips}</div>`);
    }

    bubble.innerHTML = parts.join('');
    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

function applySmartSearchFollowup(encoded) {
    const input = document.getElementById('smartSearchQueryInput');
    if (!input) return;
    input.value = decodeURIComponent(String(encoded || ''));
    input.focus();
}

function initSmartSearchChat() {
    const chat = document.getElementById('smartSearchChat');
    const input = document.getElementById('smartSearchQueryInput');
    const btn = document.getElementById('smartSearchSendBtn');
    if (!chat || !input || !btn) return;

    chat.innerHTML = '';
    setSmartSearchTyping(false);

    const history = getSmartSearchHistory();
    if (history.length === 0) {
        renderSmartSearchMessage('assistant', 'Ask me anything about your budgets and spending.\n\nExamples:\n- What months exceeded grocery budget?\n- What is my average monthly spend on health over the last 6 months?\n- Suggest an optimal budget for health based on the last 6 months');
    } else {
        for (const msg of history) {
            const role = String(msg?.role || '').trim();
            const content = String(msg?.content || '');
            if (role === 'user' || role === 'assistant') {
                renderSmartSearchMessage(role, content);
            }
        }
    }

    input.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendSmartSearchQuery();
        }
    };

    setTimeout(() => input.focus(), 0);
}

async function sendSmartSearchQuery() {
    const input = document.getElementById('smartSearchQueryInput');
    const btn = document.getElementById('smartSearchSendBtn');
    if (!input || !btn) return;

    const query = String(input.value || '').trim();
    if (!query) {
        showNotification('Please enter a question', 'error');
        return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        showNotification('Supabase is not configured in Settings', 'error');
        return;
    }

    const history = getSmartSearchHistory();
    renderSmartSearchMessage('user', query);
    history.push({ role: 'user', content: query });
    setSmartSearchHistory(history.slice(-20));

    input.value = '';
    btn.disabled = true;
    btn.classList.add('opacity-60');
    btn.classList.add('btn-loading');
    setSmartSearchTyping(true);

    try {
        const endpoint = `${SUPABASE_URL}/functions/v1/deepseek-smart-search`;
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                query,
                history: history.slice(-8)
            })
        });

        const data = await resp.json().catch(() => null);
        if (!resp.ok) {
            throw new Error(data?.error || `AI search failed: ${resp.status}`);
        }

        const result = data?.result;
        setSmartSearchTyping(false);
        renderSmartSearchAssistantResult(result);

        const assistantContent = String(result?.answer_markdown || '').trim() || 'Done.';
        history.push({ role: 'assistant', content: assistantContent });
        setSmartSearchHistory(history.slice(-20));

    } catch (e) {
        console.error('Smart search failed:', e);
        setSmartSearchTyping(false);
        renderSmartSearchMessage('assistant', `Error: ${String(e?.message || e)}`);
        showNotification('AI Smart Search error: ' + String(e?.message || e), 'error');
    } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-60');
        btn.classList.remove('btn-loading');
        setSmartSearchTyping(false);
    }
}

function clearSmartSearchChat() {
    const chat = document.getElementById('smartSearchChat');
    if (chat) chat.innerHTML = '';
    setSmartSearchTyping(false);
    setSmartSearchHistory([]);
    renderSmartSearchMessage('assistant', 'Chat cleared. Ask a new question anytime.');
}

// Function removed - 100% Supabase implementation only

function updateDataSourceLabel() {
    const label = document.getElementById('currentDataSource');
    if (label) {
        label.textContent = 'Supabase';
    }
}

// Migration function removed - data already migrated to Supabase

// Update last refresh time display
function updateLastRefreshTime() {
    const lastRefreshEl = document.getElementById('lastRefreshTime');
    if (!lastRefreshEl) return;
    
    const lastRefresh = localStorage.getItem('last_app_refresh');
    if (!lastRefresh) {
        lastRefreshEl.textContent = 'Never';
        return;
    }
    
    try {
        const refreshDate = new Date(lastRefresh);
        const now = new Date();
        const diffMs = now - refreshDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        let timeAgo;
        if (diffMins < 1) {
            timeAgo = 'Just now';
        } else if (diffMins < 60) {
            timeAgo = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            timeAgo = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else {
            timeAgo = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        }
        
        const dateStr = refreshDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        lastRefreshEl.textContent = `${timeAgo} (${dateStr})`;
    } catch (e) {
        lastRefreshEl.textContent = 'Invalid date';
        console.error('Error parsing last refresh time:', e);
    }
}

function openSettings() {
    closeAllModalsExcept('settingsModal');
    document.getElementById('supabaseUrl').value = SUPABASE_URL || '';
    document.getElementById('supabaseAnonKey').value = SUPABASE_ANON_KEY || '';
    
    // Update status text
    const statusEl = document.getElementById('supabaseStatus');
    if (statusEl) {
        statusEl.textContent = SUPABASE_URL ? 'Connected to Supabase' : 'Not configured';
    }
    
    // Load auto-refresh toggle state
    loadAutoRefreshState();
    
    // Update last refresh time display
    updateLastRefreshTime();
    
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

function openLogsModal() {
    closeAllModalsExcept('logsModal');
    const modal = document.getElementById('logsModal');
    if (modal) modal.classList.add('active');
    renderSessionLogs();
}

function closeLogsModal() {
    const modal = document.getElementById('logsModal');
    if (modal) modal.classList.remove('active');
}

function clearSessionLogs() {
    try {
        sessionStorage.removeItem(SESSION_LOGS_KEY);
    } catch (_e) {
    }
    renderSessionLogs();
}

function renderSessionLogs() {
    const el = document.getElementById('sessionLogsContent');
    if (!el) return;
    const logs = getSessionLogs();
    const text = logs
        .map(l => `[${l.ts}] ${String(l.level || '').toUpperCase()} ${l.msg || ''}`)
        .join('\n');
    el.value = text;
    const countEl = document.getElementById('sessionLogsCount');
    if (countEl) countEl.textContent = String(logs.length);
}

function safeJsonParse(rawText) {
    try {
        return JSON.parse(rawText);
    } catch (_e) {
        return null;
    }
}

function toggleSupabaseConfig() {
    const panel = document.getElementById('supabaseConfigPanel');
    const icon = document.getElementById('supabaseToggleIcon');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        panel.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
}

// Receipt migration function removed - receipts are now stored as base64 in Supabase

// Service Worker Registration
let swRegistration = null;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Determine the correct path for service worker
            // For GitHub Pages: https://amar-1314.github.io/budget/
            // For local: http://localhost/ or file://
            const isGitHubPages = window.location.hostname.includes('github.io');
            const swPath = isGitHubPages && window.location.pathname.includes('/budget/')
                ? '/budget/service-worker.js'  // GitHub Pages project site
                : window.location.pathname.replace(/\/[^/]*$/, '/') + 'service-worker.js'; // Local or root

            console.log('Registering Service Worker at:', swPath);
            swRegistration = await navigator.serviceWorker.register(swPath);
            console.log('Service Worker registered:', swRegistration);
            
            // Check for updates
            swRegistration.addEventListener('updatefound', () => {
                console.log('Service Worker update found');
            });
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    });
}

// Push Notification Support
let notificationPermission = 'default';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function uint8ArrayToBase64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = window.btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// Update notification button state based on permission
function updateNotificationButtonState() {
    const btn = document.getElementById('notificationEnableBtn');
    if (!btn) return;
    
    if (!('Notification' in window)) {
        btn.disabled = true;
        btn.textContent = 'Not Supported';
        btn.className = 'px-4 py-2 bg-gray-400 text-white rounded-lg text-sm font-semibold cursor-not-allowed';
        return;
    }
    
    const permission = Notification.permission;
    
    if (permission === 'granted') {
        btn.textContent = 'Enabled ✓';
        btn.className = 'px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors';
        btn.disabled = false;
    } else if (permission === 'denied') {
        btn.textContent = 'Blocked';
        btn.className = 'px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold cursor-not-allowed';
        btn.disabled = true;
    } else {
        btn.textContent = 'Enable';
        btn.className = 'px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors';
        btn.disabled = false;
    }
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        alert('Push notifications are not supported in this browser');
        return;
    }

    if (!('serviceWorker' in navigator)) {
        alert('Service Workers are not supported. Background notifications require Service Worker support.');
        return;
    }

    try {
        // Request notification permission
        notificationPermission = await Notification.requestPermission();
        
        // Update button state after permission request
        updateNotificationButtonState();
        
        if (notificationPermission === 'granted') {
            // Wait for service worker to be ready
            const registration = await navigator.serviceWorker.ready;
            
            // Subscribe to Web Push (if VAPID key is configured)
            const vapidPublicKey = await getVapidPublicKey();
            if (vapidPublicKey && !vapidPublicKey.includes('PASTE_YOUR')) {
                try {
                    console.log('📱 Ensuring Web Push subscription...');
                    await ensureWebPushSubscription({ forceRotate: true });
                } catch (subError) {
                    console.warn('⚠️ Web Push subscription failed:', subError);
                }
            } else {
                console.warn('⚠️ VAPID Key not configured - skipping background push setup');
            }
            
            showNotification('✅ Push notifications enabled!', 'success');
            
            // Set up realtime notifications for cross-device alerts (while app is open)
            await initializeRealtimeNotifications();
        } else {
            showNotification('Push notifications denied', 'error');
        }
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        alert('Failed to enable notifications: ' + error.message);
        updateNotificationButtonState();
    }
}

async function sendPushNotification(title, body, icon = '💰') {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            // If service worker is available, use it for background notifications
            if ('serviceWorker' in navigator && swRegistration) {
                await swRegistration.showNotification(title, {
                    body: body,
                    icon: icon,
                    badge: icon,
                    tag: 'expense-tracker',
                    requireInteraction: false,
                    vibrate: [200, 100, 200],
                    data: {
                        url: '/',
                        timestamp: Date.now()
                    }
                });
            } else {
                // Fallback to basic notification (only works when app is open)
                new Notification(title, {
                    body: body,
                    icon: icon,
                    badge: icon,
                    tag: 'expense-tracker',
                    requireInteraction: false
                });
            }
        } catch (e) {
            console.warn('Failed to send notification:', e);
        }
    }
}

// Check notification permission on load
if ('Notification' in window) {
    notificationPermission = Notification.permission;
}

// Automatic hard refresh (no confirmation, silent)
async function autoHardRefreshApp() {
    console.log('🔄 Auto hard refresh initiated...');
    
    try {
        // Show full-page loader so user knows the app is updating
        const loaderText = document.getElementById('loaderText');
        if (loaderText) loaderText.textContent = 'Refreshing to latest version...';
        showLoader('Refreshing to latest version...');

        // Let the UI render the loader before heavy work/reload
        await new Promise(resolve => setTimeout(resolve, 100));

        // Store refresh timestamps FIRST before clearing anything
        const refreshTime = new Date().toISOString();
        localStorage.setItem('last_app_refresh', refreshTime);
        const eastern = getEasternNowParts();
        localStorage.setItem('last_auto_refresh', eastern.dateKey);
        console.log('✅ Stored auto-refresh timestamp:', refreshTime);
        
        // 1. Unregister all service workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log('✅ Unregistered service worker');
            }
        }

        // 2. Clear all caches
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log('✅ Deleted cache:', cacheName);
            }
        }

        // 3. Clear session storage (but keep credentials)
        sessionStorage.clear();
        
        // 4. Reload the page (hard refresh)
        console.log('✅ Auto refresh complete. Reloading...');
        const url = new URL(window.location.href);
        url.searchParams.set('v', String(Date.now()));
        window.location.replace(url.toString());

    } catch (error) {
        console.error('Auto hard refresh error:', error);
    }
}

// Manual hard refresh (with confirmation)
async function hardRefreshApp() {
    if (!confirm('This will clear all cached data and reload the app with the latest version. Continue?')) {
        return;
    }

    // Store refresh timestamp
    const refreshTime = new Date().toISOString();
    localStorage.setItem('last_app_refresh', refreshTime);
    console.log('✅ Stored manual refresh timestamp:', refreshTime);

    // Close settings modal first
    closeSettingsModal();
    
    // Show full-page loader with custom message
    const loaderText = document.getElementById('loaderText');
    if (loaderText) loaderText.textContent = 'Clearing cache and updating...';
    showLoader('Clearing cache and updating...');

    // Let the UI render the loader before heavy work/reload
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        // 1. Unregister all service workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log('✅ Unregistered service worker');
            }
        }

        // Update loader message
        if (loaderText) loaderText.textContent = 'Clearing cached files...';

        // 2. Clear all caches
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log('✅ Deleted cache:', cacheName);
            }
        }

        // Update loader message
        if (loaderText) loaderText.textContent = 'Preparing to reload...';

        // 3. Clear session storage (but keep credentials)
        const supabaseUrl = localStorage.getItem('supabase_url');
        const supabaseKey = localStorage.getItem('supabase_anon_key');
        const notifEnabled = localStorage.getItem('notifications_enabled');
        const deviceId = localStorage.getItem('device_id');

        sessionStorage.clear();

        // 4. Show success message
        if (loaderText) loaderText.textContent = '✅ Cache cleared! Reloading...';
        
        // 5. Reload the page (hard refresh)
        setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.set('v', String(Date.now()));
            window.location.replace(url.toString());
        }, 1500);

    } catch (error) {
        console.error('Hard refresh error:', error);
        showNotification('Error refreshing. Try manually: Cmd+Shift+R', 'error');
        hideLoader();
    }
}

// Toggle auto-refresh setting
function toggleAutoRefresh(enabled) {
    localStorage.setItem('auto_refresh_enabled', enabled ? 'true' : 'false');
    console.log(`⏰ Auto-refresh ${enabled ? 'enabled' : 'disabled'}`);
    showNotification(
        enabled ? '✅ Auto-refresh enabled (6am EST)' : '⏸️ Auto-refresh disabled',
        'success'
    );
}

// Load auto-refresh toggle state
function loadAutoRefreshState() {
    const toggle = document.getElementById('autoRefreshToggle');
    if (toggle) {
        // Default to enabled
        const isEnabled = localStorage.getItem('auto_refresh_enabled') !== 'false';
        toggle.checked = isEnabled;
    }
}

// Schedule automatic daily refresh at 6am EST
function scheduleDailyRefresh() {
    const checkAndRefresh = () => {
        // Check if auto-refresh is enabled
        const isEnabled = localStorage.getItem('auto_refresh_enabled') !== 'false';
        if (!isEnabled) {
            return; // Skip if disabled
        }

        const eastern = getEasternNowParts();

        const isAfter6amET = eastern.hour > 6 || (eastern.hour === 6 && eastern.minute >= 0);

        const lastRefresh = localStorage.getItem('last_auto_refresh');
        const alreadyRefreshedToday = lastRefresh === eastern.dateKey;

        if (isAfter6amET && !alreadyRefreshedToday) {
            console.log('🌅 After 6am ET and not refreshed today - triggering automatic refresh...');
            autoHardRefreshApp();
        }
    };
    
    // Check every minute
    setInterval(checkAndRefresh, 60000);
    
    // Also check immediately on load
    checkAndRefresh();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkAndRefresh();
        }
    });
    
    console.log('⏰ Daily auto-refresh scheduler started');
    console.log(`   Status: ${localStorage.getItem('auto_refresh_enabled') !== 'false' ? 'Enabled' : 'Disabled'}`);
    console.log('   Time: 6:00 AM EST');
}

// Start the scheduler when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadAutoRefreshState();
    scheduleDailyRefresh();
    // Pull profile, targets, and scan history from Supabase so all
    // devices show the same data. Local cache continues to act as the
    // synchronous read source for the analyzer UI.
    if (typeof loadIngredientCloudState === 'function') {
        loadIngredientCloudState().catch(err =>
            console.warn('[ingredient-cloud] initial load failed:', err?.message || err)
        );
    }
});

function saveSettings() {
    const newSupabaseUrl = document.getElementById('supabaseUrl').value;
    const newSupabaseKey = document.getElementById('supabaseAnonKey').value;
    
    if (newSupabaseUrl && newSupabaseKey) {
        // Update global variables
        SUPABASE_URL = newSupabaseUrl;
        SUPABASE_ANON_KEY = newSupabaseKey;
        
        // Save to localStorage
        localStorage.setItem('supabase_url', SUPABASE_URL);
        localStorage.setItem('supabase_anon_key', SUPABASE_ANON_KEY);
        
        // Reinitialize Supabase client
        if (window.supabase && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        
        showNotification('Settings saved!', 'success');
        closeSettingsModal();
        
        // Reload data with new credentials
        loadData();
        // Re-pull ingredient state under the new project.
        _ingredientCloudBootPromise = null;
        _ingredientCloudBooted = false;
        if (typeof loadIngredientCloudState === 'function') {
            loadIngredientCloudState().catch(err =>
                console.warn('[ingredient-cloud] reload after settings failed:', err?.message || err)
            );
        }
    } else {
        alert('Please provide both Supabase URL and Key.');
    }
}

// ============================================================
// INGREDIENT HEALTH ANALYZER
// Goal: high protein, high fiber, overall health
// Pipeline: image → OCR.Space (existing) → Gemini analysis
// Vision-only fallback if OCR text is unusable.
// ============================================================

const INGREDIENT_GAUGE_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52 in SVG

let currentIngredientImageDataUrl = null;
let isIngredientAnalysisRunning = false;

function openIngredientAnalyzer() {
    if (typeof closeAllModalsExcept === 'function') {
        closeAllModalsExcept('ingredientAnalyzerModal');
    }
    const modal = document.getElementById('ingredientAnalyzerModal');
    if (!modal) return;
    modal.classList.add('active');
    syncIngredientGoalBanner();
    syncIngredientAisleToggleButton();
    renderIngredientTodayStrip();
    resetIngredientAnalyzer();
}

function closeIngredientAnalyzer() {
    const modal = document.getElementById('ingredientAnalyzerModal');
    if (modal) modal.classList.remove('active');
}

function triggerIngredientCamera() {
    const input = document.getElementById('ingredientImageInput');
    if (!input) return;
    input.setAttribute('capture', 'environment');
    input.click();
}

function triggerIngredientUpload() {
    const input = document.getElementById('ingredientImageInput');
    if (!input) return;
    input.removeAttribute('capture');
    input.click();
}

function handleIngredientImageFile(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];

    if (!String(file.type || '').startsWith('image/')) {
        showNotification('Please choose an image file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = String(e.target.result || '');
        currentIngredientImageDataUrl = dataUrl;

        const placeholder = document.getElementById('ingredientUploadPlaceholder');
        const preview = document.getElementById('ingredientUploadPreview');
        const img = document.getElementById('ingredientImagePreview');
        const results = document.getElementById('ingredientResults');
        const status = document.getElementById('ingredientStatusCard');
        const aisle = document.getElementById('ingredientAisleResults');
        const coach = document.getElementById('ingredientPhotoCoach');

        if (img) img.src = dataUrl;
        if (placeholder) placeholder.classList.add('hidden');
        if (preview) preview.classList.remove('hidden');
        if (results) results.classList.add('hidden');
        if (aisle) aisle.classList.add('hidden');
        if (status) status.classList.add('hidden');
        if (coach) coach.classList.add('hidden');

        evaluateAndShowIngredientPhotoCoach(dataUrl).catch(err => console.warn('Coach failed', err));
    };
    reader.onerror = () => showNotification('Could not read the selected image', 'error');
    reader.readAsDataURL(file);
}

function resetIngredientAnalyzer() {
    currentIngredientImageDataUrl = null;
    const input = document.getElementById('ingredientImageInput');
    if (input) input.value = '';

    const placeholder = document.getElementById('ingredientUploadPlaceholder');
    const preview = document.getElementById('ingredientUploadPreview');
    const results = document.getElementById('ingredientResults');
    const aisle = document.getElementById('ingredientAisleResults');
    const status = document.getElementById('ingredientStatusCard');
    const coach = document.getElementById('ingredientPhotoCoach');
    const logCard = document.getElementById('ingredientLogServingCard');
    const btn = document.getElementById('ingredientAnalyzeBtn');

    if (placeholder) placeholder.classList.remove('hidden');
    if (preview) preview.classList.add('hidden');
    if (results) results.classList.add('hidden');
    if (aisle) aisle.classList.add('hidden');
    if (status) status.classList.add('hidden');
    if (coach) coach.classList.add('hidden');
    if (logCard) logCard.classList.add('hidden');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-wand-magic-sparkles mr-2"></i>Analyze Health';
    }

    _currentIngredientScanId = null;
    _currentIngredientLogServings = 1;
    _ingredientPhotoCoachLast = null;

    const fg = document.getElementById('ingredientScoreGaugeFg');
    if (fg) fg.style.strokeDashoffset = INGREDIENT_GAUGE_CIRCUMFERENCE;
    const scoreNum = document.getElementById('ingredientScoreNumber');
    if (scoreNum) scoreNum.textContent = '0';
}

function setIngredientStatus(title, sub) {
    const status = document.getElementById('ingredientStatusCard');
    const tEl = document.getElementById('ingredientStatusTitle');
    const sEl = document.getElementById('ingredientStatusSub');
    if (!status) return;
    status.classList.remove('hidden');
    if (tEl) tEl.textContent = title;
    if (sEl) sEl.textContent = sub;
}

function hideIngredientStatus() {
    const status = document.getElementById('ingredientStatusCard');
    if (status) status.classList.add('hidden');
}

async function analyzeIngredientsWithAI() {
    if (isIngredientAnalysisRunning) return;
    if (!currentIngredientImageDataUrl) {
        showNotification('Take or select a photo first', 'error');
        return;
    }

    const btn = document.getElementById('ingredientAnalyzeBtn');
    const results = document.getElementById('ingredientResults');
    const aisleResults = document.getElementById('ingredientAisleResults');
    if (results) results.classList.add('hidden');
    if (aisleResults) aisleResults.classList.add('hidden');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Analyzing...';
    }
    isIngredientAnalysisRunning = true;

    let imageDataUrl = currentIngredientImageDataUrl;

    try {
        setIngredientStatus('Preparing image...', 'Compressing image');
        try {
            const compressed = await compressReceiptImageToDataUrl(imageDataUrl);
            if (compressed) imageDataUrl = compressed;
        } catch (e) {
            console.warn('Ingredient image compression failed, using original', e);
        }

        // 1. Try barcode + Open Food Facts (free, deterministic, fast)
        let analysis = null;
        let sourceLabel = '';
        let textForRawDisplay = '';

        try {
            setIngredientStatus('Looking for barcode...', 'Native BarcodeDetector');
            const barcode = await detectBarcodeFromImage(imageDataUrl);
            if (barcode) {
                setIngredientStatus('Found barcode', `Looking up ${barcode} on Open Food Facts`);
                const offProduct = await fetchOpenFoodFactsProduct(barcode);
                if (offProduct) {
                    setIngredientStatus('Analyzing with AI...', 'Gemini reviewing canonical data');
                    const offPrompt = formatOpenFoodFactsForPrompt(offProduct, barcode);
                    analysis = await analyzeIngredientHealthFromText(offPrompt);
                    sourceLabel = `Open Food Facts · barcode ${barcode}`;
                    textForRawDisplay = offPrompt;
                }
            }
        } catch (barcodeErr) {
            console.warn('Barcode/OFF lookup failed, continuing with OCR', barcodeErr);
        }

        // 2. Fall back to OCR.Space + Gemini text analysis
        if (!analysis) {
            let ocrText = '';
            try {
                setIngredientStatus('Reading label...', 'Running OCR.Space');
                ocrText = await runOcrSpace(imageDataUrl);
            } catch (ocrErr) {
                console.warn('OCR failed, will fall back to Gemini vision', ocrErr);
            }

            const cleanedOcr = String(ocrText || '').trim();
            if (cleanedOcr.length >= 20) {
                setIngredientStatus('Analyzing with AI...', 'Gemini reviewing OCR text');
                try {
                    analysis = await analyzeIngredientHealthFromText(cleanedOcr);
                    sourceLabel = 'OCR.Space + Gemini';
                    textForRawDisplay = cleanedOcr;
                } catch (textErr) {
                    console.warn('Gemini text analysis failed, falling back to vision', textErr);
                }
            }

            // 3. Final fallback: Gemini vision on the raw image
            if (!analysis) {
                setIngredientStatus('Analyzing with AI...', 'Gemini vision (fallback)');
                analysis = await analyzeIngredientHealthFromImage(imageDataUrl);
                sourceLabel = 'Gemini vision';
                textForRawDisplay = cleanedOcr || '(No OCR text — vision-only analysis was used.)';
            }
        }

        hideIngredientStatus();

        // Persist to scan history (best-effort; never blocks the UI).
        try {
            const profileSnapshot = getActiveIngredientProfile();
            const qualityScore = _ingredientPhotoCoachLast?.score;
            const record = await recordIngredientScan({
                analysis,
                sourceLabel,
                ocrText: textForRawDisplay,
                imageDataUrl: currentIngredientImageDataUrl,
                profileSnapshot,
                qualityScore
            });
            if (record) {
                _currentIngredientScanId = record.id;
                _currentIngredientLogServings = 1;
            }
        } catch (histErr) {
            console.warn('Could not save scan to history', histErr);
        }

        renderIngredientAnalysis(analysis, textForRawDisplay, sourceLabel);
        showNotification('Analysis complete', 'success');
    } catch (err) {
        console.error('Ingredient analysis failed:', err);
        hideIngredientStatus();
        showNotification('Analysis failed: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
        isIngredientAnalysisRunning = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-wand-magic-sparkles mr-2"></i>Analyze Health';
        }
    }
}

function buildIngredientAnalysisPrompt(extraContext) {
    const profile = getActiveIngredientProfile();
    const profileBlock = formatProfileForPrompt(profile);

    return `You are a board-certified clinical nutritionist with deep knowledge of food science, ingredient additives, and macronutrient density. You judge food the way a thoughtful dietitian would: in CONTEXT of what kind of food it is, not against a one-size-fits-all rubric.

${profileBlock}

You will be given ${extraContext} from a packaged food's ingredient label and/or nutrition panel.

Return ONLY valid JSON in this EXACT schema (no markdown, no prose):
{
  "product_guess": "best guess of product type (e.g. 'Protein bar', 'Greek yogurt', 'Whole-wheat bread')",
  "category": "dessert_sweets" | "snack_salty" | "snack_sweet" | "meal_main" | "sandwich_wrap" | "soup" | "beverage_sweet" | "beverage_unsweet" | "protein_bar" | "protein_powder" | "breakfast_cereal" | "yogurt_dairy" | "milk_alt_milk" | "cheese" | "bread_grain" | "pasta_rice" | "frozen_meal" | "condiment_sauce" | "spread_nutbutter" | "oil_fat" | "baby_food" | "supplement" | "fresh_produce" | "fresh_meat_seafood" | "candy" | "alcohol" | "other",
  "category_context": "<=160 chars; explain how this category should be judged (what criteria matter for THIS type of food)",
  "score": <integer 0-100>,
  "verdict": "Excellent" | "Good" | "Mediocre" | "Avoid" | "Unclear",
  "goal_alignment": [
    { "axis": "<axis_id from the AXIS REGISTRY below>", "score": <integer 0-10>, "note": "<=120 chars, neutral, category-aware>" },
    { "axis": "<axis_id>", "score": <integer 0-10>, "note": "<=120 chars>" },
    { "axis": "overall_health", "score": <integer 0-10>, "note": "<=120 chars>" }
  ],
  "macro_estimate": {
    "protein_density":  "low" | "medium" | "high",
    "fiber_density":    "low" | "medium" | "high",
    "added_sugar":      "none" | "low" | "medium" | "high",
    "sodium":           "low" | "medium" | "high",
    "processing_level": "minimally processed" | "processed" | "ultra-processed"
  },
  "healthy_ingredients": [
    { "name": "<ingredient>", "reason": "<why it's good, <=100 chars>" }
  ],
  "concerning_ingredients": [
    { "name": "<ingredient>", "severity": "low" | "medium" | "high", "reason": "<why concerning, <=100 chars>" }
  ],
  "red_flags": ["<short tag e.g. 'Added sugar', 'Seed oils', 'Artificial colors'>"],
  "nutrition_facts": {
    "serving_size": "<text e.g. '30 g' or '1 cup (240 ml)'>" | null,
    "servings_per_container": <number> | null,
    "calories": <number per serving> | null,
    "protein_g": <number> | null,
    "fiber_g": <number> | null,
    "total_sugar_g": <number> | null,
    "added_sugar_g": <number> | null,
    "carbs_g": <number> | null,
    "fat_g": <number> | null,
    "saturated_fat_g": <number> | null,
    "trans_fat_g": <number> | null,
    "sodium_mg": <number> | null
  },
  "alternatives": [
    { "name": "<specific better product or generic better option>", "why": "<=120 chars, why it's better for the user's goals & restrictions" }
  ],
  "consumption_frequency": {
    "tier": "daily" | "few_times_week" | "weekly" | "monthly" | "rarely" | "never",
    "label": "<human-readable label matching the tier>",
    "portion_hint": "<optional, <=80 chars; e.g. '1 serving (25g)' or empty string>",
    "reason": "<=140 chars explaining why this cadence is appropriate FOR THIS CATEGORY"
  },
  "verdict_summary": "<1-2 sentences. MUST begin with the category framing — 'As a [category], this is…'. If it's a clean, best-in-class option, the FIRST sentence MUST acknowledge that positively (e.g. 'As a dessert, this is one of the cleaner options on the shelf — short ingredient list, real cocoa, low added sugar.'). Do NOT lead with a generic negative like 'this is a processed treat with added sugar' if the item is actually clean for its category.>",
  "recommendation": "<1-3 sentence actionable recommendation, calibrated to the food's category and the user's profile. For clean category-appropriate items, recommend a realistic positive habit (e.g. '1 serving (25g) daily after dinner is a perfectly reasonable habit') instead of arbitrarily restricting it.>"
}

═══════════════════════════════════════════════════════════════════
GOAL ALIGNMENT — PICK 3 AXES THAT ACTUALLY MATTER
═══════════════════════════════════════════════════════════════════
The "goal_alignment" array MUST contain EXACTLY 3 entries. One MUST be
"overall_health". The other 2 are picked from the AXIS REGISTRY based
on (a) what kind of food this is and (b) the user's stated goals.
Do NOT force protein/fiber onto every scan. Judge a salad by protein
and fiber; judge rice by carb quality; judge chocolate by sugar load
and fat quality; judge chips by sodium and fat quality.

Allowed axis IDs (use exactly these strings):
  overall_health      — universal: holistic verdict of healthfulness
  protein_quality     — for meals, meats, dairy, beans, protein products
  fiber_content       — for grains, fruits, vegetables, legumes, cereals
  carb_quality        — for rice, pasta, bread, cereals, tortillas
  fat_quality         — for oils, nut butters, dressings, cheese, chocolate, fried snacks
  sugar_load          — for desserts, sweet drinks, yogurts, cereals, sauces
  sodium_load         — for chips, soups, frozen meals, deli meat, condiments
  satiety             — for meals, snack bars, anything portion-controlled
  nutrient_density    — for produce, whole foods, fortified items
  glycemic_impact     — for carb-heavy items, sweet drinks, refined grains
  whole_food_basis    — for items where ingredients should be recognizable foods
  processing_level    — for ultra-processed packaged products
  ingredient_quality  — for items judged primarily by their ingredient list

DEFAULT AXIS PICKS BY CATEGORY (pick these unless the user's profile
calls for something different):
  dessert_sweets / candy / snack_sweet → sugar_load, fat_quality, overall_health
  snack_salty                          → sodium_load, fat_quality, overall_health
  meal_main / sandwich_wrap / soup     → protein_quality, fiber_content, overall_health
  frozen_meal                          → protein_quality, sodium_load, overall_health
  beverage_sweet                       → sugar_load, ingredient_quality, overall_health
  beverage_unsweet                     → ingredient_quality, processing_level, overall_health
  protein_bar / protein_powder         → protein_quality, sugar_load, overall_health
  breakfast_cereal                     → fiber_content, sugar_load, overall_health
  yogurt_dairy                         → protein_quality, sugar_load, overall_health
  milk_alt_milk                        → protein_quality, ingredient_quality, overall_health
  cheese                               → protein_quality, fat_quality, overall_health
  bread_grain                          → carb_quality, fiber_content, overall_health
  pasta_rice                           → carb_quality, fiber_content, overall_health
  condiment_sauce                      → sodium_load, ingredient_quality, overall_health
  spread_nutbutter                     → fat_quality, ingredient_quality, overall_health
  oil_fat                              → fat_quality, processing_level, overall_health
  fresh_produce                        → nutrient_density, fiber_content, overall_health
  fresh_meat_seafood                   → protein_quality, fat_quality, overall_health
  supplement                           → ingredient_quality, processing_level, overall_health
  baby_food                            → ingredient_quality, sugar_load, overall_health
  alcohol                              → sugar_load, ingredient_quality, overall_health

OVERRIDE RULE: if the user's profile lists a goal that is RELEVANT to
the food category, swap one of the non-overall_health axes for that
goal's axis. Goal → axis mapping:
  high protein   → protein_quality
  high fiber     → fiber_content
  low sugar      → sugar_load
  low sodium     → sodium_load
  whole foods    → whole_food_basis or ingredient_quality
  muscle gain    → protein_quality
  weight loss    → satiety (for meals/snacks) or sugar_load (for sweets)
Only swap if the axis is genuinely relevant. Do NOT add "protein_quality"
to a chocolate bar just because the user wants high protein — that's
exactly the rigidity we're trying to avoid.

SCORING WITHIN EACH AXIS (0-10):
  Read the score AS A QUALITY READING for that axis relative to the
  user's goal direction. Examples:
    · protein_quality 9/10 = excellent protein source for this category
    · sugar_load 9/10 = LOW sugar load (good); 2/10 = HIGH sugar (bad)
    · sodium_load 9/10 = LOW sodium; 2/10 = high sodium
    · fat_quality 9/10 = clean fats (olive, avocado, cocoa butter)
    · carb_quality 9/10 = whole grain, intact, high fiber
    · processing_level 9/10 = minimally processed
  Higher is ALWAYS better in the UI, regardless of axis. Notes should
  be neutral facts, not warnings. E.g. "Cocoa butter — clean saturated
  fat, normal for dark chocolate" instead of "High in saturated fat".

═══════════════════════════════════════════════════════════════════
SCORING PHILOSOPHY — READ THIS BEFORE ASSIGNING A SCORE
═══════════════════════════════════════════════════════════════════

STEP 1 — Classify the food FIRST.
   The category determines what "good" means. Do NOT judge a dessert by
   the same rubric as a chicken sandwich. Do NOT penalize an 85% dark
   chocolate bar for being low in protein or fiber — that is normal and
   appropriate for its category. Do NOT reward a protein powder for
   being low in fiber — fiber is not its job.

STEP 2 — Score against BEST-IN-CLASS within the category.
   Ask: "Is this one of the cleaner, more sensible options of its kind?"
   - A clean 85% dark chocolate bar (real chocolate, cocoa butter, small
     amount of sugar, soy lecithin, vanilla, nothing else) is a GREAT
     dessert. It should score 80-90 with verdict "Good" or "Excellent".
   - A typical milk-chocolate candy bar (sugar first, palm oil, artificial
     flavors, emulsifiers) is a POOR dessert. 25-40, "Mediocre" or "Avoid".
   - A clean protein bar with 20g protein, real nut/whey sources, low sugar
     scores 85+. A "protein bar" that is 10g protein and 18g sugar scores 40.
   - A grilled chicken wrap with whole-wheat tortilla, lean protein, and
     vegetables scores 80+. A microwave burrito of refined flour, processed
     meat, and saturated fat scores 30-45.

STEP 3 — Apply UNIVERSAL quality signals to EVERY category:
   - Short ingredient list of recognizable items: +
   - Whole-food primary ingredients: +
   - Trans fats / partially hydrogenated oils present: HARD CAP score <= 25, verdict = "Avoid"
   - Artificial colors (Red 40, Yellow 5/6, Blue 1, etc.): −
   - Artificial sweeteners (sucralose, aspartame, ace-K, saccharin) unless category is explicitly a "diet" product: −
   - BHA / BHT / TBHQ / sodium nitrite / nitrate: −
   - Seed oils (soybean, corn, canola, cottonseed) as a PRIMARY ingredient (top 3): − (allowed but penalized)
   - Refined-flour first ingredient where whole-grain is expected: −
   - "Ultra-processed" designation: −
   - Recognizable real-food primary ingredient (e.g. "Cocoa", "Oats", "Chicken breast", "Tomatoes"): +

STEP 4 — Apply CATEGORY-SPECIFIC signals (only the ones that fit):

   dessert_sweets / snack_sweet / candy:
     · Low added sugar relative to typical for that sub-category: ++
       (a 25g dessert with <=6g added sugar is LOW; <=4g is excellent)
     · Real fats (butter, cocoa butter, cream) > seed oils: +
     · Dark chocolate (>=70% cocoa) is GENERALLY a good dessert option
     · 85%+ dark chocolate with a short clean list (cocoa, cocoa butter,
       sugar, lecithin, vanilla) should land at 80-90, verdict "Good"
       or "Excellent". Do NOT mark it "Mediocre" or "Avoid" and do NOT
       set added_sugar to "medium/high" if it's 3-6g per serving.
     · Do NOT penalize for low protein/fiber — that is expected.
     · "Added sugar" belongs in red_flags ONLY when added sugar is high
       for the sub-category (e.g. >12g/serving for chocolate, >15g for
       a typical dessert). Do NOT list small expected sugar as a red flag.

   snack_salty / chip / cracker:
     · Whole-grain or legume base: +
     · Oil quality (avocado/olive > seed oils): +
     · Sodium per serving (lower is better)

   meal_main / sandwich_wrap / soup / frozen_meal:
     · Protein quality and adequacy: ++
     · Fiber from whole grains, legumes, vegetables: ++
     · Macro balance, not extreme in any direction
     · Sodium (frozen meals are often very high): −
     · Hidden sugar in savory items: −

   beverage_sweet / beverage_unsweet:
     · Added sugar (any in a beverage is a meaningful negative): −−
     · Artificial sweeteners (penalize even in "diet" sodas, though less than sugar)
     · Real fruit or whole-food base: +
     · Water, plain tea, plain coffee = "daily"
     · Soda = "rarely" or "never"

   protein_bar / protein_powder:
     · Protein density (>15g per ~200kcal): ++
     · Source quality (whey isolate, casein, egg, pea+rice combo): +
     · Sugar / sugar alcohols: −
     · Filler proteins / proprietary blends: −

   breakfast_cereal:
     · Fiber per serving (>=5g): ++
     · Added sugar (cereals are notorious): −−
     · Whole-grain first: +

   yogurt_dairy / milk_alt_milk / cheese:
     · Protein per serving: +
     · Added sugar (flavored yogurts are often desserts in disguise): −
     · Live cultures / fermentation: +
     · Carrageenan / gums in alt milks: minor −

   bread_grain / pasta_rice:
     · Whole grain first ingredient: ++
     · Fiber: +
     · Added sugar / dough conditioners: −

   condiment_sauce / spread_nutbutter / oil_fat:
     · Judge sparingly — small portion sizes
     · Oil quality, sodium per serving, sugar per serving
     · A nut butter with ONLY nuts (and maybe salt) scores 90+

   fresh_produce / fresh_meat_seafood:
     · Default 90-100 unless processed/cured
     · "daily" frequency for most produce

   supplement / baby_food / alcohol: judge with appropriate context.

STEP 5 — User goals are PREFERENCES for FREQUENCY, not a stick to beat every food with.
   - If the user's profile says "high protein, high fiber" and they scan
     a chocolate bar, that does NOT make the chocolate bar bad. The
     overall score still reflects category-relative quality. Do NOT
     force protein_quality or fiber_content into the goal_alignment for
     a dessert — pick the axes that ACTUALLY matter for the category.
   - The goal_alignment NOTE must NOT be moralizing. Phrase as a neutral
     fact, not a warning. Good: "Low added sugar for the category."
     Bad: "This product is not a good protein source."
   - If the user's PROFILE category prioritizes "weight loss" and the
     scanned item is a calorie-dense dessert, lower the FREQUENCY but
     keep the score honest to category.

STEP 6 — Hard dietary violations OVERRIDE everything.
   Allergen present that the user opted out of, animal product when
   vegan, etc.:
   · Set verdict = "Avoid", frequency = "never", score ≤ 25.
   · Explain in red_flags AND verdict_summary.

═══════════════════════════════════════════════════════════════════
SCORE RANGE GUIDANCE (after category-relative judgment)
═══════════════════════════════════════════════════════════════════
  90-100  Best-in-class for its category; clean ingredients; aligns with user goals
  75-89   Solid choice in its category; minor caveats
  60-74   Mediocre; some concerns but acceptable in moderation
  40-59   Frequent concerns; consume sparingly
  20-39   Mostly junk; avoid most of the time
   0-19   Trans fats / banned additives / extreme processing; do not consume

Verdict-to-score mapping:
  Excellent ↔ 85-100   Good ↔ 70-84   Mediocre ↔ 45-69   Avoid ↔ 0-44

═══════════════════════════════════════════════════════════════════
CONSUMPTION FREQUENCY (category-aware, not score-only)
═══════════════════════════════════════════════════════════════════
Anchor the frequency to what a thoughtful dietitian would tell a healthy
adult — NOT to a worst-case "never eat sugar" stance. Single small
serving cadence:
  · fresh_produce / plain water / plain whole-grain → "daily"
  · clean yogurt / clean protein source / whole-grain bread → "daily"
  · clean dark chocolate (>=70% cocoa, short clean ingredient list,
    <=6g added sugar per serving) → "daily" (1 small serving/day is fine)
  · clean nut bar / clean dessert with whole-food base → "daily" to "few_times_week"
  · typical packaged sweet snack with some concerns → "few_times_week" to "weekly"
  · sugary cereal / flavored sugary yogurt / standard milk-chocolate candy → "weekly" to "monthly"
  · ultra-processed dessert / cookies / pastries from a package → "monthly" to "rarely"
  · soda / energy drinks / trans-fat-containing items / candy with artificial colors → "rarely" to "never"
DO NOT collapse a clean dessert to "monthly" just because it contains
ANY added sugar — small added sugar is normal and expected for the
category. Only push to "monthly" or "rarely" when the item is clearly
junk for its category.
Frequency reflects WHAT MAKES SENSE for the category, not just the score.
Tier MUST be one of the six allowed values. Label MUST match the tier
("Daily", "A few times a week", "Once a week", "Once a month",
"Rarely / special occasions", "Avoid").

═══════════════════════════════════════════════════════════════════
ALTERNATIVES
═══════════════════════════════════════════════════════════════════
- If score < 70 OR a dietary violation, suggest 2-3 alternatives IN THE
  SAME CATEGORY that are better. Don't recommend a chicken sandwich as
  an alternative to a chocolate bar — recommend a better chocolate bar.
- If score >= 70 and no violations, return an empty alternatives array.
- Never recommend an alternative that violates a hard dietary flag.

═══════════════════════════════════════════════════════════════════
NUTRITION FACTS
═══════════════════════════════════════════════════════════════════
- Populate per-serving numeric values from the panel. Use null for fields
  not clearly stated. Do NOT invent numbers.
- If no panel visible, set "nutrition_facts" to an object with all-null fields.

═══════════════════════════════════════════════════════════════════
UNCLEAR INPUT — STRICT RULES
═══════════════════════════════════════════════════════════════════
"Unclear" is reserved EXCLUSIVELY for inputs that are NOT a food product
(random receipts, recipes, blank images, gibberish, non-food packaging).

If you can identify the product type at all (e.g. you can write
"product_guess": "Dark chocolate bar"), you MUST:
  · pick a real category from the enum (never "other" for an identified food)
  · assign a real integer score (never null)
  · assign a real verdict from {Excellent, Good, Mediocre, Avoid}
  · NEVER use "Unclear"

Use "Unclear" ONLY when product_guess is itself unknowable. Partial
nutrition data, missing serving size, or a hard-to-read label are NOT
reasons to fall back to "Unclear" — make your best category-aware
assessment from what you can see.

When (and only when) the input truly is not a food product:
  · "category": "other", "category_context": "Could not identify the product"
  · "score": null
  · "verdict": "Unclear"
  · "verdict_summary": explain what was found instead
  · "recommendation": ask the user to retake the photo of the back-of-pack ingredient panel
  · empty arrays for healthy_ingredients, concerning_ingredients, red_flags
  · "consumption_frequency": { "tier": "never", "label": "Unknown", "portion_hint": "", "reason": "Could not determine — retake the photo." }

═══════════════════════════════════════════════════════════════════
WORKED EXAMPLE — calibrate to this for a clean dark chocolate bar
═══════════════════════════════════════════════════════════════════
Input: an 85% dark chocolate bar with ingredients
"Chocolate, cocoa butter, sugar, cocoa processed with alkali, soy
lecithin, vanilla powder", 25g serving, 3g added sugar, 3g protein,
3g fiber, 7g saturated fat.

Expected analysis (do NOT copy verbatim — calibrate):
  · product_guess: "85% dark chocolate bar"
  · category: "dessert_sweets"
  · category_context: "Judge as a dessert — low added sugar, clean fats, and short ingredient list matter more than protein/fiber."
  · score: 85
  · verdict: "Good" (could justify "Excellent" if 88+)
  · goal_alignment: [
      { axis: "sugar_load",     score: 8, note: "Only 3g added sugar per 25g serving — low for chocolate." },
      { axis: "fat_quality",    score: 7, note: "Cocoa butter — clean saturated fat, natural for dark chocolate." },
      { axis: "overall_health", score: 8, note: "Clean dessert; flavonoids in cocoa are a small plus in moderation." }
    ]
    (Notice we did NOT use protein_quality or fiber_content — they are
     irrelevant for a dessert. Even though the user's profile has "high
     protein", we did NOT shoehorn it in.)
  · macro_estimate.added_sugar: "low"
  · macro_estimate.processing_level: "processed" (not ultra-processed — short clean list)
  · healthy_ingredients: cocoa, cocoa butter (real fats)
  · concerning_ingredients: [] or just "sugar" at severity "low"
  · red_flags: [] (NOT "Added sugar" — 3g is low for the category)
  · consumption_frequency.tier: "daily"
  · consumption_frequency.label: "Daily"
  · consumption_frequency.portion_hint: "1 serving (25g)"
  · consumption_frequency.reason: "1 small serving/day is a reasonable habit for a clean dark chocolate."
  · verdict_summary: "As a dessert, this is one of the cleaner options on the shelf — short ingredient list, real cocoa, only 3g added sugar per serving."
  · recommendation: "1 serving (25g) after dinner or with coffee is a perfectly reasonable daily habit. Just keep it to one serving — dark chocolate is calorie-dense."

Counter-example — a typical milk-chocolate candy bar (sugar listed
first, palm oil, artificial flavors, 22g added sugar per serving):
score 30, verdict "Avoid", frequency "monthly" to "rarely".

Be concise. Return ONLY the JSON object.`;
}

async function analyzeIngredientHealthFromText(ocrText) {
    const apiKey = await getGeminiApiKey();
    const prompt = buildIngredientAnalysisPrompt('OCR-extracted text') +
        `\n\nOCR TEXT:\n${ocrText}`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 }
        }
    };

    const parsed = await parseGeminiReceiptResponseWithRetry(apiKey, requestBody);
    return normalizeIngredientAnalysis(parsed);
}

async function analyzeIngredientHealthFromImage(imageDataUrl) {
    const apiKey = await getGeminiApiKey();
    const m = String(imageDataUrl || '').match(/^data:([^;]+);base64,(.+)$/i);
    if (!m) throw new Error('Invalid image data');

    const prompt = buildIngredientAnalysisPrompt('an image of the product ingredient label');

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: m[1], data: m[2] } }
            ]
        }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 }
        }
    };

    const parsed = await parseGeminiReceiptResponseWithRetry(apiKey, requestBody);
    return normalizeIngredientAnalysis(parsed);
}

const INGREDIENT_CATEGORY_ALLOWED = new Set([
    'dessert_sweets', 'snack_salty', 'snack_sweet', 'meal_main',
    'sandwich_wrap', 'soup', 'beverage_sweet', 'beverage_unsweet',
    'protein_bar', 'protein_powder', 'breakfast_cereal', 'yogurt_dairy',
    'milk_alt_milk', 'cheese', 'bread_grain', 'pasta_rice', 'frozen_meal',
    'condiment_sauce', 'spread_nutbutter', 'oil_fat', 'baby_food',
    'supplement', 'fresh_produce', 'fresh_meat_seafood', 'candy',
    'alcohol', 'other'
]);

const INGREDIENT_CATEGORY_LABELS = {
    dessert_sweets:      'Dessert',
    snack_salty:         'Salty snack',
    snack_sweet:         'Sweet snack',
    meal_main:           'Meal',
    sandwich_wrap:       'Sandwich / wrap',
    soup:                'Soup',
    beverage_sweet:      'Sweet beverage',
    beverage_unsweet:    'Beverage',
    protein_bar:         'Protein bar',
    protein_powder:      'Protein powder',
    breakfast_cereal:    'Cereal',
    yogurt_dairy:        'Yogurt / dairy',
    milk_alt_milk:       'Milk / alt-milk',
    cheese:              'Cheese',
    bread_grain:         'Bread / grain',
    pasta_rice:          'Pasta / rice',
    frozen_meal:         'Frozen meal',
    condiment_sauce:     'Condiment / sauce',
    spread_nutbutter:    'Spread / nut butter',
    oil_fat:             'Oil / fat',
    baby_food:           'Baby food',
    supplement:          'Supplement',
    fresh_produce:       'Fresh produce',
    fresh_meat_seafood:  'Fresh meat / seafood',
    candy:               'Candy',
    alcohol:             'Alcohol',
    other:               'Other'
};

function normalizeIngredientCategory(raw) {
    const v = String(raw || '').toLowerCase().trim().replace(/[\s\-/]+/g, '_');
    return INGREDIENT_CATEGORY_ALLOWED.has(v) ? v : 'other';
}

function getIngredientCategoryLabel(category) {
    return INGREDIENT_CATEGORY_LABELS[category] || 'Other';
}

function normalizeIngredientAnalysis(raw) {
    const allowedDensity = new Set(['low', 'medium', 'high']);
    const allowedSugar = new Set(['none', 'low', 'medium', 'high']);
    const allowedProc = new Set(['minimally processed', 'processed', 'ultra-processed']);
    const allowedSeverity = new Set(['low', 'medium', 'high']);
    const allowedVerdict = new Set(['Excellent', 'Good', 'Mediocre', 'Avoid', 'Unclear']);

    const clampInt = (val, lo, hi, fallback) => {
        const n = Number(val);
        if (!isFinite(n)) return fallback;
        return Math.max(lo, Math.min(hi, Math.round(n)));
    };

    const sanitizeArr = (arr, fn) => Array.isArray(arr) ? arr.map(fn).filter(Boolean) : [];

    const goalAxes = normalizeGoalAxes(raw?.goal_alignment);
    const macro = raw?.macro_estimate || {};

    let verdict = String(raw?.verdict || '').trim();
    if (!allowedVerdict.has(verdict)) verdict = 'Unclear';

    let score = raw?.score;
    if (score !== null && score !== undefined) {
        score = clampInt(score, 0, 100, null);
    } else {
        score = null;
    }

    const category = normalizeIngredientCategory(raw?.category);

    return {
        product_guess: String(raw?.product_guess || '').trim() || 'Unknown product',
        category,
        category_context: String(raw?.category_context || '').trim().slice(0, 200),
        score,
        verdict,
        goal_alignment: goalAxes,
        macro_estimate: {
            protein_density: allowedDensity.has(macro.protein_density) ? macro.protein_density : 'low',
            fiber_density:   allowedDensity.has(macro.fiber_density)   ? macro.fiber_density   : 'low',
            added_sugar:     allowedSugar.has(macro.added_sugar)       ? macro.added_sugar     : 'low',
            sodium:          allowedDensity.has(macro.sodium)          ? macro.sodium          : 'low',
            processing_level: allowedProc.has(macro.processing_level)  ? macro.processing_level: 'processed'
        },
        healthy_ingredients: sanitizeArr(raw?.healthy_ingredients, (it) => {
            if (!it) return null;
            const name = String(it.name || '').trim();
            if (!name) return null;
            return { name, reason: String(it.reason || '').trim() };
        }),
        concerning_ingredients: sanitizeArr(raw?.concerning_ingredients, (it) => {
            if (!it) return null;
            const name = String(it.name || '').trim();
            if (!name) return null;
            const sev = String(it.severity || '').toLowerCase().trim();
            return {
                name,
                severity: allowedSeverity.has(sev) ? sev : 'low',
                reason: String(it.reason || '').trim()
            };
        }),
        red_flags: sanitizeArr(raw?.red_flags, (it) => {
            const v = String(it || '').trim();
            return v || null;
        }),
        nutrition_facts: normalizeNutritionFacts(raw?.nutrition_facts),
        alternatives: sanitizeArr(raw?.alternatives, (it) => {
            if (!it) return null;
            const name = String(it.name || '').trim();
            if (!name) return null;
            return { name, why: String(it.why || '').trim() };
        }).slice(0, 4),
        consumption_frequency: normalizeConsumptionFrequency(raw?.consumption_frequency, raw?.score),
        verdict_summary: String(raw?.verdict_summary || '').trim(),
        recommendation: String(raw?.recommendation || '').trim()
    };
}

function normalizeNutritionFacts(raw) {
    const cleanNum = (v) => {
        if (v == null || v === '') return null;
        const n = Number(v);
        if (!isFinite(n) || n < 0) return null;
        return n;
    };
    const facts = raw || {};
    return {
        serving_size: String(facts.serving_size || '').trim() || null,
        servings_per_container: cleanNum(facts.servings_per_container),
        calories: cleanNum(facts.calories),
        protein_g: cleanNum(facts.protein_g),
        fiber_g: cleanNum(facts.fiber_g),
        total_sugar_g: cleanNum(facts.total_sugar_g),
        added_sugar_g: cleanNum(facts.added_sugar_g),
        carbs_g: cleanNum(facts.carbs_g),
        fat_g: cleanNum(facts.fat_g),
        saturated_fat_g: cleanNum(facts.saturated_fat_g),
        trans_fat_g: cleanNum(facts.trans_fat_g),
        sodium_mg: cleanNum(facts.sodium_mg)
    };
}

// Registry of axes the AI may pick for the per-scan "Goal Alignment" panel.
// The model picks EXACTLY 3 axes per scan, chosen for what actually matters
// for THIS food category and the user's stated goals (e.g. carb_quality for
// rice/pasta, sugar_load for chocolate, protein_quality for a chicken bowl).
const INGREDIENT_GOAL_AXIS_REGISTRY = {
    overall_health:     { label: 'Overall health',     icon: 'fa-heart-pulse' },
    protein_quality:    { label: 'Protein quality',    icon: 'fa-drumstick-bite' },
    fiber_content:      { label: 'Fiber content',      icon: 'fa-seedling' },
    carb_quality:       { label: 'Carb quality',       icon: 'fa-wheat-awn' },
    fat_quality:        { label: 'Fat quality',        icon: 'fa-bacon' },
    sugar_load:         { label: 'Sugar load',         icon: 'fa-cube' },
    sodium_load:        { label: 'Sodium load',        icon: 'fa-droplet' },
    satiety:            { label: 'Satiety',            icon: 'fa-utensils' },
    nutrient_density:   { label: 'Nutrient density',   icon: 'fa-carrot' },
    glycemic_impact:    { label: 'Glycemic impact',    icon: 'fa-chart-line' },
    whole_food_basis:   { label: 'Whole-food basis',   icon: 'fa-apple-whole' },
    processing_level:   { label: 'Processing level',   icon: 'fa-industry' },
    ingredient_quality: { label: 'Ingredient quality', icon: 'fa-list-check' }
};

// For backward compatibility with previously-saved scans that used the old
// fixed-keys schema { high_protein, high_fiber, overall_health }.
const INGREDIENT_LEGACY_GOAL_AXIS_MAP = {
    high_protein:   'protein_quality',
    high_fiber:     'fiber_content',
    overall_health: 'overall_health'
};

const INGREDIENT_FREQUENCY_TIERS = {
    daily:           { label: 'Daily',                      icon: 'fa-sun',           tone: 'great' },
    few_times_week:  { label: 'A few times a week',         icon: 'fa-calendar-week', tone: 'good'  },
    weekly:          { label: 'Once a week',                icon: 'fa-calendar-day',  tone: 'ok'    },
    monthly:         { label: 'Once a month',               icon: 'fa-calendar',      tone: 'warn'  },
    rarely:          { label: 'Rarely / special occasions', icon: 'fa-hourglass-half',tone: 'low'   },
    never:           { label: 'Avoid',                      icon: 'fa-ban',           tone: 'bad'   }
};

function deriveFrequencyTierFromScore(score) {
    if (score == null || !isFinite(score)) return 'rarely';
    if (score >= 85) return 'daily';
    if (score >= 70) return 'few_times_week';
    if (score >= 55) return 'weekly';
    if (score >= 40) return 'monthly';
    if (score >= 20) return 'rarely';
    return 'never';
}

function normalizeConsumptionFrequency(entry, scoreForFallback) {
    const rawTier = String(entry?.tier || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    const tier = INGREDIENT_FREQUENCY_TIERS[rawTier]
        ? rawTier
        : deriveFrequencyTierFromScore(Number(scoreForFallback));
    const meta = INGREDIENT_FREQUENCY_TIERS[tier];
    const label = String(entry?.label || '').trim() || meta.label;
    return {
        tier,
        label,
        portion_hint: String(entry?.portion_hint || '').trim(),
        reason: String(entry?.reason || '').trim()
    };
}

function normalizeGoalAxisEntry(rawAxisId, score, note) {
    const axisKey = String(rawAxisId || '').trim();
    const resolved = INGREDIENT_GOAL_AXIS_REGISTRY[axisKey]
        ? axisKey
        : (INGREDIENT_LEGACY_GOAL_AXIS_MAP[axisKey] || null);
    if (!resolved) return null;

    const numericScore = Number(score);
    const safeScore = isFinite(numericScore)
        ? Math.max(0, Math.min(10, Math.round(numericScore)))
        : 0;

    return {
        axis: resolved,
        label: INGREDIENT_GOAL_AXIS_REGISTRY[resolved].label,
        icon:  INGREDIENT_GOAL_AXIS_REGISTRY[resolved].icon,
        score: safeScore,
        note:  String(note || '').trim().slice(0, 160)
    };
}

// Accepts the new array shape OR the legacy object shape
// { high_protein, high_fiber, overall_health }. Always returns an array.
function normalizeGoalAxes(raw) {
    const result = [];
    const seen = new Set();
    const pushIfNew = (entry) => {
        if (!entry) return;
        if (seen.has(entry.axis)) return;
        seen.add(entry.axis);
        result.push(entry);
    };

    if (Array.isArray(raw)) {
        for (const item of raw) {
            if (!item || typeof item !== 'object') continue;
            pushIfNew(normalizeGoalAxisEntry(item.axis, item.score, item.note));
        }
    } else if (raw && typeof raw === 'object') {
        // Legacy { high_protein: {score, note}, ... } shape from older saved scans.
        for (const [key, value] of Object.entries(raw)) {
            if (!value || typeof value !== 'object') continue;
            pushIfNew(normalizeGoalAxisEntry(key, value.score, value.note));
        }
    }

    // Always guarantee overall_health is present so the UI has a stable anchor.
    if (!seen.has('overall_health')) {
        pushIfNew(normalizeGoalAxisEntry('overall_health', 0, ''));
    }
    return result.slice(0, 4);
}

function getIngredientVerdictTier(verdict, score) {
    const v = String(verdict || '').toLowerCase();
    if (v === 'excellent') return 'excellent';
    if (v === 'good') return 'good';
    if (v === 'mediocre') return 'mediocre';
    if (v === 'avoid') return 'avoid';
    if (v === 'unclear') return 'unclear';
    if (score == null) return 'unclear';
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'mediocre';
    return 'avoid';
}

function getMacroTone(field, value) {
    // Define which direction is "good" per field.
    const good = (v) => v === 'high';
    const lowGood = (v) => v === 'low' || v === 'none';
    switch (field) {
        case 'protein_density':
        case 'fiber_density':
            if (good(value)) return 'good';
            if (value === 'medium') return 'warn';
            return 'bad';
        case 'added_sugar':
            if (value === 'none' || value === 'low') return 'good';
            if (value === 'medium') return 'warn';
            return 'bad';
        case 'sodium':
            if (lowGood(value)) return 'good';
            if (value === 'medium') return 'warn';
            return 'bad';
        case 'processing_level':
            if (value === 'minimally processed') return 'good';
            if (value === 'processed') return 'warn';
            return 'bad';
        default:
            return 'neutral';
    }
}

function formatMacroLabel(field) {
    return ({
        protein_density: 'Protein density',
        fiber_density: 'Fiber density',
        added_sugar: 'Added sugar',
        sodium: 'Sodium',
        processing_level: 'Processing'
    })[field] || field;
}

function formatMacroValue(value) {
    if (!value) return '—';
    return String(value).replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function escapeIngredientHtml(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderIngredientAnalysis(analysis, ocrText, sourceLabel) {
    if (!analysis) return;
    lastIngredientAnalysis = analysis;
    lastIngredientOcrText = ocrText || '';
    lastIngredientSourceLabel = sourceLabel || '';

    setIngredientSourceBadge(sourceLabel);
    renderIngredientTodayStrip();

    if (isIngredientAisleModeOn()) {
        renderIngredientAisleVerdict(analysis);
        return;
    }

    const aisleResults = document.getElementById('ingredientAisleResults');
    if (aisleResults) aisleResults.classList.add('hidden');

    const container = document.getElementById('ingredientResults');
    if (!container) return;
    container.classList.remove('hidden');

    const displayScore = (analysis.score == null) ? 0 : analysis.score;
    animateIngredientScore(displayScore);

    const numEl = document.getElementById('ingredientScoreNumber');
    if (numEl) numEl.textContent = analysis.score == null ? '—' : String(displayScore);

    const tier = getIngredientVerdictTier(analysis.verdict, analysis.score);
    const badge = document.getElementById('ingredientVerdictBadge');
    if (badge) {
        badge.textContent = analysis.verdict || '—';
        badge.setAttribute('data-tier', tier);
    }

    const guess = document.getElementById('ingredientProductGuess');
    if (guess) guess.textContent = analysis.product_guess || '—';

    const catBadge = document.getElementById('ingredientCategoryBadge');
    const catLabel = document.getElementById('ingredientCategoryLabel');
    const catContext = document.getElementById('ingredientCategoryContext');
    if (catBadge && catLabel) {
        const cat = analysis.category;
        if (cat && cat !== 'other') {
            catLabel.textContent = `Judged as: ${getIngredientCategoryLabel(cat)}`;
            if (catContext) catContext.textContent = analysis.category_context || '';
            catBadge.classList.remove('hidden');
        } else {
            catBadge.classList.add('hidden');
        }
    }

    const summary = document.getElementById('ingredientVerdictSummary');
    if (summary) summary.textContent = analysis.verdict_summary || 'No summary available.';

    renderIngredientFrequency(analysis.consumption_frequency);
    renderIngredientGoals(analysis.goal_alignment);
    renderIngredientNutritionFacts(analysis.nutrition_facts);
    renderIngredientMacros(analysis.macro_estimate);
    renderIngredientList('ingredientHealthyList', analysis.healthy_ingredients, 'good');
    renderIngredientList('ingredientConcerningList', analysis.concerning_ingredients, null);
    renderIngredientRedFlags(analysis.red_flags);
    renderIngredientAlternatives(analysis.alternatives);

    const rec = document.getElementById('ingredientRecommendation');
    if (rec) rec.textContent = analysis.recommendation || '—';

    const rawEl = document.getElementById('ingredientRawText');
    if (rawEl) rawEl.textContent = ocrText ? ocrText : '(No OCR text — vision-only analysis was used.)';

    renderIngredientLogCard();
}

function animateIngredientScore(score) {
    const fg = document.getElementById('ingredientScoreGaugeFg');
    if (!fg) return;
    const pct = Math.max(0, Math.min(100, score)) / 100;
    const offset = INGREDIENT_GAUGE_CIRCUMFERENCE * (1 - pct);
    fg.style.strokeDashoffset = INGREDIENT_GAUGE_CIRCUMFERENCE;
    requestAnimationFrame(() => {
        fg.style.strokeDashoffset = offset;
    });

    const numEl = document.getElementById('ingredientScoreNumber');
    if (!numEl) return;
    const start = performance.now();
    const dur = 1200;
    const animate = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        numEl.textContent = String(Math.round(score * eased));
        if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
}

function renderIngredientFrequency(freq) {
    const card = document.getElementById('ingredientFrequencyCard');
    const iconEl = document.getElementById('ingredientFrequencyIcon');
    const labelEl = document.getElementById('ingredientFrequencyLabel');
    const portionEl = document.getElementById('ingredientFrequencyPortion');
    const reasonEl = document.getElementById('ingredientFrequencyReason');
    if (!card || !iconEl || !labelEl || !portionEl || !reasonEl) return;

    const tier = freq?.tier && INGREDIENT_FREQUENCY_TIERS[freq.tier] ? freq.tier : 'rarely';
    const meta = INGREDIENT_FREQUENCY_TIERS[tier];

    card.setAttribute('data-tone', meta.tone);
    iconEl.className = `fas ${meta.icon}`;
    labelEl.textContent = freq?.label || meta.label;
    portionEl.textContent = freq?.portion_hint || '';
    reasonEl.textContent = freq?.reason || '';
}

function renderIngredientGoals(goals) {
    const grid = document.getElementById('ingredientGoalGrid');
    if (!grid) return;

    const axes = Array.isArray(goals) ? goals : normalizeGoalAxes(goals);
    if (!axes.length) {
        grid.innerHTML = '';
        return;
    }

    grid.innerHTML = axes.map((g) => {
        const meta = INGREDIENT_GOAL_AXIS_REGISTRY[g.axis] || { label: g.label, icon: g.icon };
        const label = g.label || meta.label || g.axis;
        const icon = g.icon || meta.icon || 'fa-bullseye';
        const score = Math.max(0, Math.min(10, Number(g.score) || 0));
        const pct = score * 10;
        return `
            <div class="ingredient-goal-card">
                <div class="ingredient-goal-card-header">
                    <div class="ingredient-goal-card-name"><i class="fas ${icon} mr-1 text-emerald-600"></i>${escapeIngredientHtml(label)}</div>
                    <div class="ingredient-goal-card-score">${score}<span style="font-size:11px;color:#94a3b8;font-weight:600">/10</span></div>
                </div>
                <div class="ingredient-goal-bar"><div class="ingredient-goal-bar-fill" style="width:${pct}%"></div></div>
                <div class="ingredient-goal-card-note">${escapeIngredientHtml(g.note || '')}</div>
            </div>
        `;
    }).join('');
}

function renderIngredientMacros(macro) {
    const grid = document.getElementById('ingredientMacroGrid');
    if (!grid) return;
    const fields = ['protein_density', 'fiber_density', 'added_sugar', 'sodium', 'processing_level'];
    grid.innerHTML = fields.map((field) => {
        const value = macro?.[field];
        const tone = getMacroTone(field, value);
        return `
            <div class="ingredient-macro-tile" data-tone="${tone}">
                <div class="ingredient-macro-label">${escapeIngredientHtml(formatMacroLabel(field))}</div>
                <div class="ingredient-macro-value">${escapeIngredientHtml(formatMacroValue(value))}</div>
            </div>
        `;
    }).join('');
}

function renderIngredientList(elementId, items, forcedSeverity) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (!items || items.length === 0) {
        el.innerHTML = `<div class="text-sm text-gray-500">None detected.</div>`;
        return;
    }
    el.innerHTML = items.map((item) => {
        const severity = forcedSeverity || item.severity || 'low';
        const dotClass = severity === 'good' ? 'ingredient-row-dot--good' :
                         severity === 'high' ? 'ingredient-row-dot--high' :
                         severity === 'medium' ? 'ingredient-row-dot--medium' :
                         'ingredient-row-dot--low';
        const reason = item.reason ? `<div class="ingredient-row-reason">${escapeIngredientHtml(item.reason)}</div>` : '';
        return `
            <div class="ingredient-row">
                <span class="ingredient-row-dot ${dotClass}"></span>
                <div>
                    <div class="ingredient-row-name">${escapeIngredientHtml(item.name)}</div>
                    ${reason}
                </div>
            </div>
        `;
    }).join('');
}

function renderIngredientRedFlags(flags) {
    const section = document.getElementById('ingredientRedFlagSection');
    const list = document.getElementById('ingredientRedFlagList');
    if (!section || !list) return;
    if (!flags || flags.length === 0) {
        section.classList.add('hidden');
        list.innerHTML = '';
        return;
    }
    section.classList.remove('hidden');
    list.innerHTML = flags.map(f => `<span class="ingredient-red-flag-chip"><i class="fas fa-flag mr-1"></i>${escapeIngredientHtml(f)}</span>`).join('');
}

// ============================================================
// INGREDIENT ANALYZER — Source badge, alternatives, nutrition facts
// ============================================================

let lastIngredientAnalysis = null;
let lastIngredientOcrText = '';
let lastIngredientSourceLabel = '';

function setIngredientSourceBadge(sourceLabel) {
    const badge = document.getElementById('ingredientSourceBadge');
    const text = document.getElementById('ingredientSourceBadgeText');
    if (!badge || !text) return;
    if (!sourceLabel) {
        badge.classList.add('hidden');
        return;
    }
    text.textContent = `Source: ${sourceLabel}`;
    badge.classList.remove('hidden');
}

function renderIngredientAlternatives(alternatives) {
    const section = document.getElementById('ingredientAlternativesSection');
    const list = document.getElementById('ingredientAlternativesList');
    if (!section || !list) return;
    if (!alternatives || alternatives.length === 0) {
        section.classList.add('hidden');
        list.innerHTML = '';
        return;
    }
    section.classList.remove('hidden');
    list.innerHTML = alternatives.map((alt) => `
        <div class="ingredient-alt-card">
            <div class="ingredient-alt-name"><i class="fas fa-leaf"></i>${escapeIngredientHtml(alt.name)}</div>
            ${alt.why ? `<div class="ingredient-alt-why">${escapeIngredientHtml(alt.why)}</div>` : ''}
        </div>
    `).join('');
}

function renderIngredientNutritionFacts(facts) {
    const section = document.getElementById('ingredientNutritionSection');
    const grid = document.getElementById('ingredientNutritionGrid');
    const servingEl = document.getElementById('ingredientServingSize');
    const densityRow = document.getElementById('ingredientDensityRow');
    if (!section || !grid) return;

    const hasAny = facts && Object.entries(facts).some(([k, v]) => k !== 'serving_size' && k !== 'servings_per_container' && v != null);
    if (!hasAny) {
        section.classList.add('hidden');
        grid.innerHTML = '';
        if (densityRow) {
            densityRow.classList.add('hidden');
            densityRow.innerHTML = '';
        }
        if (servingEl) servingEl.textContent = '';
        return;
    }

    if (servingEl) {
        const parts = [];
        if (facts.serving_size) parts.push(`per ${facts.serving_size}`);
        if (facts.servings_per_container) parts.push(`${facts.servings_per_container} servings/pkg`);
        servingEl.textContent = parts.join(' · ');
    }

    const tiles = [
        { key: 'calories',         label: 'Calories',  unit: 'kcal', toneFn: () => 'neutral' },
        { key: 'protein_g',        label: 'Protein',   unit: 'g',    toneFn: (v) => v >= 10 ? 'good' : (v >= 5 ? 'warn' : 'bad') },
        { key: 'fiber_g',          label: 'Fiber',     unit: 'g',    toneFn: (v) => v >= 5 ? 'good' : (v >= 3 ? 'warn' : 'bad') },
        { key: 'added_sugar_g',    label: 'Added sugar', unit: 'g',  toneFn: (v) => v <= 2 ? 'good' : (v <= 8 ? 'warn' : 'bad') },
        { key: 'total_sugar_g',    label: 'Total sugar', unit: 'g',  toneFn: (v) => v <= 5 ? 'good' : (v <= 15 ? 'warn' : 'bad') },
        { key: 'carbs_g',          label: 'Carbs',     unit: 'g',    toneFn: () => 'neutral' },
        { key: 'fat_g',            label: 'Fat',       unit: 'g',    toneFn: () => 'neutral' },
        { key: 'saturated_fat_g',  label: 'Sat fat',   unit: 'g',    toneFn: (v) => v <= 1 ? 'good' : (v <= 3 ? 'warn' : 'bad') },
        { key: 'trans_fat_g',      label: 'Trans fat', unit: 'g',    toneFn: (v) => v === 0 ? 'good' : 'bad' },
        { key: 'sodium_mg',        label: 'Sodium',    unit: 'mg',   toneFn: (v) => v <= 140 ? 'good' : (v <= 400 ? 'warn' : 'bad') }
    ];

    grid.innerHTML = tiles
        .filter(t => facts[t.key] != null)
        .map(t => {
            const v = facts[t.key];
            const tone = t.toneFn(v);
            return `
                <div class="ingredient-nutrition-tile" data-tone="${tone}">
                    <div class="ingredient-nutrition-label">${escapeIngredientHtml(t.label)}</div>
                    <div class="ingredient-nutrition-value">${escapeIngredientHtml(v)} ${escapeIngredientHtml(t.unit)}</div>
                </div>
            `;
        }).join('');

    if (densityRow) {
        const cal = Number(facts.calories);
        if (cal > 0 && (facts.protein_g != null || facts.fiber_g != null)) {
            const density = (g) => g == null ? null : Math.round((g / cal) * 100 * 10) / 10;
            const proteinDensity = density(facts.protein_g);
            const fiberDensity = density(facts.fiber_g);
            const densityTiles = [];
            if (proteinDensity != null) {
                const tone = proteinDensity >= 10 ? 'good' : (proteinDensity >= 5 ? 'warn' : 'bad');
                densityTiles.push(`
                    <div class="ingredient-density-tile" data-tone="${tone}">
                        <div class="ingredient-density-icon"><i class="fas fa-drumstick-bite"></i></div>
                        <div>
                            <div class="ingredient-density-label">Protein / 100 kcal</div>
                            <div class="ingredient-density-value">${proteinDensity} g</div>
                        </div>
                    </div>
                `);
            }
            if (fiberDensity != null) {
                const tone = fiberDensity >= 4 ? 'good' : (fiberDensity >= 2 ? 'warn' : 'bad');
                densityTiles.push(`
                    <div class="ingredient-density-tile" data-tone="${tone}">
                        <div class="ingredient-density-icon"><i class="fas fa-seedling"></i></div>
                        <div>
                            <div class="ingredient-density-label">Fiber / 100 kcal</div>
                            <div class="ingredient-density-value">${fiberDensity} g</div>
                        </div>
                    </div>
                `);
            }
            if (densityTiles.length) {
                densityRow.innerHTML = densityTiles.join('');
                densityRow.classList.remove('hidden');
            } else {
                densityRow.classList.add('hidden');
                densityRow.innerHTML = '';
            }
        } else {
            densityRow.classList.add('hidden');
            densityRow.innerHTML = '';
        }
    }

    section.classList.remove('hidden');
}

// ============================================================
// INGREDIENT ANALYZER — Aisle Mode (compact verdict)
// ============================================================

const INGREDIENT_AISLE_MODE_KEY = 'ingredient_aisle_mode_v1';

function isIngredientAisleModeOn() {
    try { return localStorage.getItem(INGREDIENT_AISLE_MODE_KEY) === '1'; }
    catch (_e) { return false; }
}

function setIngredientAisleModeStorage(on) {
    try { localStorage.setItem(INGREDIENT_AISLE_MODE_KEY, on ? '1' : '0'); }
    catch (_e) { /* ignore */ }
}

function syncIngredientAisleToggleButton() {
    const btn = document.getElementById('ingredientAisleToggleBtn');
    if (!btn) return;
    btn.classList.toggle('is-active', isIngredientAisleModeOn());
}

function setIngredientAisleMode(on) {
    setIngredientAisleModeStorage(!!on);
    syncIngredientAisleToggleButton();

    if (!lastIngredientAnalysis) return;
    if (on) {
        const detail = document.getElementById('ingredientResults');
        if (detail) detail.classList.add('hidden');
        renderIngredientAisleVerdict(lastIngredientAnalysis);
    } else {
        const aisle = document.getElementById('ingredientAisleResults');
        if (aisle) aisle.classList.add('hidden');
        renderIngredientAnalysis(lastIngredientAnalysis, lastIngredientOcrText, lastIngredientSourceLabel);
    }
}

function toggleIngredientAisleMode() {
    setIngredientAisleMode(!isIngredientAisleModeOn());
}

function renderIngredientAisleVerdict(analysis) {
    const aisleContainer = document.getElementById('ingredientAisleResults');
    const card = document.getElementById('ingredientAisleVerdictCard');
    const iconEl = document.getElementById('ingredientAisleDecisionIcon');
    const decisionEl = document.getElementById('ingredientAisleDecision');
    const scoreEl = document.getElementById('ingredientAisleScore');
    const freqEl = document.getElementById('ingredientAisleFrequency');
    const reasonEl = document.getElementById('ingredientAisleReason');
    if (!aisleContainer || !card || !decisionEl || !scoreEl || !freqEl || !reasonEl || !iconEl) return;

    const tier = getIngredientVerdictTier(analysis.verdict, analysis.score);
    card.setAttribute('data-tier', tier);

    const decisionMap = {
        excellent: { word: 'EAT IT',  icon: 'fa-circle-check' },
        good:      { word: 'EAT IT',  icon: 'fa-thumbs-up'    },
        mediocre:  { word: 'CAUTION', icon: 'fa-circle-exclamation' },
        avoid:     { word: 'SKIP IT', icon: 'fa-circle-xmark' },
        unclear:   { word: 'UNCLEAR', icon: 'fa-circle-question' }
    };
    const d = decisionMap[tier] || decisionMap.unclear;
    iconEl.className = `fas ${d.icon}`;
    decisionEl.textContent = d.word;

    if (analysis.score == null) {
        scoreEl.innerHTML = '—<span>/100</span>';
    } else {
        scoreEl.innerHTML = `${analysis.score}<span>/100</span>`;
    }

    const freqTier = analysis?.consumption_frequency?.tier;
    const freqMeta = freqTier && INGREDIENT_FREQUENCY_TIERS[freqTier] ? INGREDIENT_FREQUENCY_TIERS[freqTier] : null;
    freqEl.innerHTML = freqMeta
        ? `<i class="fas ${freqMeta.icon} mr-2"></i>${escapeIngredientHtml(analysis.consumption_frequency.label || freqMeta.label)}`
        : '—';

    reasonEl.textContent = analysis.verdict_summary || analysis.recommendation || '—';

    aisleContainer.classList.remove('hidden');
}

// ============================================================
// INGREDIENT ANALYZER — Personalization Profile
// ============================================================

const INGREDIENT_PROFILE_KEY = 'ingredient_profile_v1';

const INGREDIENT_PROFILE_DIET_OPTIONS = [
    { id: 'vegetarian',  label: 'Vegetarian',   icon: 'fa-carrot' },
    { id: 'vegan',       label: 'Vegan',        icon: 'fa-seedling' },
    { id: 'pescatarian', label: 'Pescatarian',  icon: 'fa-fish' },
    { id: 'dairy_free',  label: 'Dairy-free',   icon: 'fa-cheese' },
    { id: 'gluten_free', label: 'Gluten-free',  icon: 'fa-wheat-awn' },
    { id: 'nut_free',    label: 'Nut-free',     icon: 'fa-circle-exclamation' },
    { id: 'soy_free',    label: 'Soy-free',     icon: 'fa-circle-exclamation' },
    { id: 'egg_free',    label: 'Egg-free',     icon: 'fa-egg' },
    { id: 'halal',       label: 'Halal',        icon: 'fa-mosque' },
    { id: 'kosher',      label: 'Kosher',       icon: 'fa-star-of-david' },
    { id: 'low_sodium',  label: 'Low sodium',   icon: 'fa-droplet' },
    { id: 'keto',        label: 'Keto',         icon: 'fa-bacon' },
    { id: 'low_fodmap',  label: 'Low FODMAP',   icon: 'fa-bowl-food' }
];

const INGREDIENT_PROFILE_GOAL_OPTIONS = [
    { id: 'high_protein',   label: 'High protein',    icon: 'fa-drumstick-bite' },
    { id: 'high_fiber',     label: 'High fiber',      icon: 'fa-seedling' },
    { id: 'overall_health', label: 'Overall health',  icon: 'fa-heart-pulse' },
    { id: 'low_sugar',      label: 'Low sugar',       icon: 'fa-cube' },
    { id: 'low_sodium',     label: 'Low sodium',      icon: 'fa-droplet' },
    { id: 'whole_foods',    label: 'Whole foods',     icon: 'fa-apple-whole' },
    { id: 'weight_loss',    label: 'Weight loss',     icon: 'fa-weight-scale' },
    { id: 'muscle_gain',    label: 'Muscle gain',     icon: 'fa-dumbbell' }
];

const INGREDIENT_PROFILE_PEOPLE = [
    { id: 'amar',  label: 'Amar',  icon: 'fa-user' },
    { id: 'priya', label: 'Priya', icon: 'fa-user' },
    { id: 'both',  label: 'Both',  icon: 'fa-user-group' }
];

const INGREDIENT_PROFILE_DEFAULT = {
    activeUser: 'both',
    goals: ['high_protein', 'high_fiber', 'overall_health'],
    diet: [],
    customAvoid: '',
    notes: ''
};

function getActiveIngredientProfile() {
    try {
        const raw = localStorage.getItem(INGREDIENT_PROFILE_KEY);
        if (!raw) return { ...INGREDIENT_PROFILE_DEFAULT };
        const parsed = JSON.parse(raw);
        return {
            activeUser:  String(parsed.activeUser || INGREDIENT_PROFILE_DEFAULT.activeUser),
            goals:       Array.isArray(parsed.goals) ? parsed.goals.filter(g => typeof g === 'string') : INGREDIENT_PROFILE_DEFAULT.goals,
            diet:        Array.isArray(parsed.diet)  ? parsed.diet.filter(g => typeof g === 'string')  : [],
            customAvoid: String(parsed.customAvoid || ''),
            notes:       String(parsed.notes || '')
        };
    } catch (_e) {
        return { ...INGREDIENT_PROFILE_DEFAULT };
    }
}

function saveIngredientProfileObject(profile) {
    try {
        localStorage.setItem(INGREDIENT_PROFILE_KEY, JSON.stringify(profile));
    } catch (_e) { /* quota issues only */ }
    ingredientCloudFireAndForget(
        upsertIngredientProfileCloud(profile),
        'save profile'
    );
}

function formatProfileForPrompt(profile) {
    const peopleMap = { amar: 'Amar', priya: 'Priya', both: 'Amar & Priya' };
    const goalLabels = INGREDIENT_PROFILE_GOAL_OPTIONS.reduce((acc, o) => (acc[o.id] = o.label, acc), {});
    const dietLabels = INGREDIENT_PROFILE_DIET_OPTIONS.reduce((acc, o) => (acc[o.id] = o.label, acc), {});

    const who = peopleMap[profile.activeUser] || 'the user';
    const goals = (profile.goals && profile.goals.length ? profile.goals : INGREDIENT_PROFILE_DEFAULT.goals)
        .map(g => goalLabels[g] || g).join(', ');
    const diet = (profile.diet || []).map(d => dietLabels[d] || d);
    const dietBlock = diet.length
        ? `HARD DIETARY RULES (must never be violated): ${diet.join(', ')}.`
        : 'No hard dietary restrictions specified.';
    const avoidBlock = profile.customAvoid && profile.customAvoid.trim()
        ? `CUSTOM AVOID LIST (treat each as an automatic flag if present): ${profile.customAvoid.trim()}.`
        : '';
    const notesBlock = profile.notes && profile.notes.trim()
        ? `ADDITIONAL USER CONTEXT: ${profile.notes.trim()}.`
        : '';

    return `USER PROFILE
- Person: ${who}
- Goal priorities (ordered): ${goals}
- ${dietBlock}
${avoidBlock}
${notesBlock}`.trim();
}

function openIngredientProfile() {
    const modal = document.getElementById('ingredientProfileModal');
    if (!modal) return;
    modal.classList.add('active');
    renderIngredientProfileForm(getActiveIngredientProfile());
}

function closeIngredientProfile() {
    const modal = document.getElementById('ingredientProfileModal');
    if (modal) modal.classList.remove('active');
}

function resetIngredientProfileToDefaults() {
    saveIngredientProfileObject({ ...INGREDIENT_PROFILE_DEFAULT });
    renderIngredientProfileForm({ ...INGREDIENT_PROFILE_DEFAULT });
    syncIngredientGoalBanner();
    showNotification('Profile reset to defaults', 'success');
}

function renderIngredientProfileForm(profile) {
    const whoRow = document.getElementById('ingredientProfileWhoRow');
    if (whoRow) {
        whoRow.innerHTML = INGREDIENT_PROFILE_PEOPLE.map(p => `
            <button type="button" class="ingredient-profile-who-btn ${profile.activeUser === p.id ? 'is-active' : ''}"
                    data-who="${p.id}" onclick="setIngredientProfilePerson('${p.id}')">
                <i class="fas ${p.icon}"></i>${escapeIngredientHtml(p.label)}
            </button>
        `).join('');
    }

    const goalsRow = document.getElementById('ingredientProfileGoalsRow');
    if (goalsRow) {
        goalsRow.innerHTML = INGREDIENT_PROFILE_GOAL_OPTIONS.map(g => `
            <button type="button" class="ingredient-pill ${profile.goals.includes(g.id) ? 'is-active' : ''}"
                    onclick="toggleIngredientProfileGoal('${g.id}')">
                <i class="fas ${g.icon}"></i>${escapeIngredientHtml(g.label)}
            </button>
        `).join('');
    }

    const dietRow = document.getElementById('ingredientProfileDietRow');
    if (dietRow) {
        dietRow.innerHTML = INGREDIENT_PROFILE_DIET_OPTIONS.map(d => `
            <button type="button" class="ingredient-pill ${profile.diet.includes(d.id) ? 'is-active-warn' : ''}"
                    onclick="toggleIngredientProfileDiet('${d.id}')">
                <i class="fas ${d.icon}"></i>${escapeIngredientHtml(d.label)}
            </button>
        `).join('');
    }

    const avoidInput = document.getElementById('ingredientProfileAvoidInput');
    if (avoidInput) avoidInput.value = profile.customAvoid || '';
    const notesInput = document.getElementById('ingredientProfileNotesInput');
    if (notesInput) notesInput.value = profile.notes || '';
}

function captureUnsavedProfileFormText(profile) {
    const avoidEl = document.getElementById('ingredientProfileAvoidInput');
    const notesEl = document.getElementById('ingredientProfileNotesInput');
    if (avoidEl) profile.customAvoid = avoidEl.value;
    if (notesEl) profile.notes = notesEl.value;
    return profile;
}

function setIngredientProfilePerson(personId) {
    const profile = captureUnsavedProfileFormText(getActiveIngredientProfile());
    profile.activeUser = personId;
    saveIngredientProfileObject(profile);
    renderIngredientProfileForm(profile);
}

function toggleIngredientProfileGoal(goalId) {
    const profile = captureUnsavedProfileFormText(getActiveIngredientProfile());
    profile.goals = profile.goals.includes(goalId)
        ? profile.goals.filter(g => g !== goalId)
        : [...profile.goals, goalId];
    saveIngredientProfileObject(profile);
    renderIngredientProfileForm(profile);
}

function toggleIngredientProfileDiet(dietId) {
    const profile = captureUnsavedProfileFormText(getActiveIngredientProfile());
    profile.diet = profile.diet.includes(dietId)
        ? profile.diet.filter(g => g !== dietId)
        : [...profile.diet, dietId];
    saveIngredientProfileObject(profile);
    renderIngredientProfileForm(profile);
}

function saveIngredientProfile() {
    const profile = getActiveIngredientProfile();
    const avoidEl = document.getElementById('ingredientProfileAvoidInput');
    const notesEl = document.getElementById('ingredientProfileNotesInput');
    if (avoidEl) profile.customAvoid = avoidEl.value.trim();
    if (notesEl) profile.notes = notesEl.value.trim();
    saveIngredientProfileObject(profile);
    syncIngredientGoalBanner();
    closeIngredientProfile();
    showNotification('Profile saved', 'success');
}

function syncIngredientGoalBanner() {
    const profile = getActiveIngredientProfile();
    const chipsEl = document.getElementById('ingredientGoalChips');
    const labelEl = document.getElementById('ingredientActiveProfileLabel');
    if (!chipsEl) return;

    const peopleMap = { amar: 'Amar', priya: 'Priya', both: 'You' };
    if (labelEl) labelEl.textContent = `${peopleMap[profile.activeUser] || 'You'}:`;

    const goalLabels = INGREDIENT_PROFILE_GOAL_OPTIONS.reduce((acc, o) => (acc[o.id] = o, acc), {});
    const dietLabels = INGREDIENT_PROFILE_DIET_OPTIONS.reduce((acc, o) => (acc[o.id] = o, acc), {});

    const goalChips = profile.goals.map(g => {
        const meta = goalLabels[g];
        if (!meta) return '';
        return `<span class="ingredient-goal-chip"><i class="fas ${meta.icon} mr-1"></i>${escapeIngredientHtml(meta.label)}</span>`;
    });
    const dietChips = profile.diet.map(d => {
        const meta = dietLabels[d];
        if (!meta) return '';
        return `<span class="ingredient-goal-chip" style="background:#fff7ed;border-color:rgba(234,88,12,0.3);color:#9a3412"><i class="fas ${meta.icon} mr-1"></i>${escapeIngredientHtml(meta.label)}</span>`;
    });

    chipsEl.innerHTML = [...goalChips, ...dietChips].join('') ||
        `<span class="ingredient-goal-chip">High Protein</span>`;
}

// ============================================================
// INGREDIENT ANALYZER — Barcode + Open Food Facts integration
// ============================================================

let _ingredientBarcodeDetector = null;
let _ingredientBarcodeDetectorInitTried = false;

async function getBarcodeDetector() {
    if (_ingredientBarcodeDetectorInitTried) return _ingredientBarcodeDetector;
    _ingredientBarcodeDetectorInitTried = true;
    if (typeof window === 'undefined' || typeof window.BarcodeDetector === 'undefined') {
        return null;
    }
    try {
        const formats = await window.BarcodeDetector.getSupportedFormats?.();
        const desired = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
        const usable = Array.isArray(formats) && formats.length
            ? desired.filter(f => formats.includes(f))
            : desired;
        if (!usable.length) return null;
        _ingredientBarcodeDetector = new window.BarcodeDetector({ formats: usable });
    } catch (e) {
        console.warn('BarcodeDetector init failed', e);
        _ingredientBarcodeDetector = null;
    }
    return _ingredientBarcodeDetector;
}

async function detectBarcodeFromImage(dataUrl) {
    const detector = await getBarcodeDetector();
    if (!detector) return null;
    if (!dataUrl) return null;
    try {
        const img = await loadImageFromDataUrl(dataUrl);
        const detections = await detector.detect(img);
        if (!detections || !detections.length) return null;
        const raw = String(detections[0].rawValue || '').trim();
        if (!raw) return null;
        if (!/^\d{6,14}$/.test(raw)) return null;
        return raw;
    } catch (e) {
        console.warn('Barcode detection error', e);
        return null;
    }
}

function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image for barcode detection'));
        img.src = dataUrl;
    });
}

async function fetchOpenFoodFactsProduct(barcode) {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,categories_tags,ingredients_text,ingredients_text_en,allergens_tags,additives_tags,nova_group,nutriscore_grade,nutriments,quantity,serving_size`;
    try {
        const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!resp.ok) return null;
        const json = await resp.json();
        if (!json || json.status !== 1 || !json.product) return null;
        return json.product;
    } catch (e) {
        console.warn('Open Food Facts fetch failed', e);
        return null;
    }
}

function formatOpenFoodFactsForPrompt(product, barcode) {
    const name = product.product_name || 'Unknown product';
    const brand = product.brands ? ` (${product.brands})` : '';
    const ingredients = product.ingredients_text_en || product.ingredients_text || '(ingredients not listed in Open Food Facts)';
    const allergens = (product.allergens_tags || []).map(t => t.replace(/^en:/, '')).join(', ') || 'none listed';
    const additives = (product.additives_tags || []).map(t => t.replace(/^en:/, '')).join(', ') || 'none listed';
    const novaGroup = product.nova_group ? `NOVA group ${product.nova_group} (1=unprocessed, 4=ultra-processed)` : 'not provided';
    const nutriScore = product.nutriscore_grade ? product.nutriscore_grade.toUpperCase() : 'not provided';
    const servingSize = product.serving_size || 'not provided';

    const n = product.nutriments || {};
    const num = (v) => (v == null || v === '') ? null : Number(v);
    const per100 = {
        calories: num(n['energy-kcal_100g']),
        protein_g: num(n['proteins_100g']),
        fiber_g: num(n['fiber_100g']),
        total_sugar_g: num(n['sugars_100g']),
        added_sugar_g: num(n['added-sugars_100g']),
        carbs_g: num(n['carbohydrates_100g']),
        fat_g: num(n['fat_100g']),
        saturated_fat_g: num(n['saturated-fat_100g']),
        trans_fat_g: num(n['trans-fat_100g']),
        sodium_mg: n.sodium_100g != null ? Math.round(Number(n.sodium_100g) * 1000) : (n.salt_100g != null ? Math.round(Number(n.salt_100g) * 400) : null)
    };
    const perServing = {
        calories: num(n['energy-kcal_serving']),
        protein_g: num(n['proteins_serving']),
        fiber_g: num(n['fiber_serving']),
        total_sugar_g: num(n['sugars_serving']),
        added_sugar_g: num(n['added-sugars_serving']),
        carbs_g: num(n['carbohydrates_serving']),
        fat_g: num(n['fat_serving']),
        saturated_fat_g: num(n['saturated-fat_serving']),
        trans_fat_g: num(n['trans-fat_serving']),
        sodium_mg: n.sodium_serving != null ? Math.round(Number(n.sodium_serving) * 1000) : (n.salt_serving != null ? Math.round(Number(n.salt_serving) * 400) : null)
    };

    const fmtBlock = (obj) => Object.entries(obj)
        .filter(([, v]) => v != null && isFinite(v))
        .map(([k, v]) => `  ${k}: ${v}`).join('\n') || '  (no values provided)';

    return `PRODUCT (from Open Food Facts, barcode ${barcode}):
Name: ${name}${brand}
Serving size: ${servingSize}
Categories: ${(product.categories_tags || []).slice(0, 5).map(t => t.replace(/^en:/, '')).join(', ') || 'unknown'}
NOVA processing class: ${novaGroup}
Nutri-Score: ${nutriScore}
Allergens flagged: ${allergens}
Additives flagged: ${additives}

INGREDIENTS:
${ingredients}

NUTRITION PER 100 g/ml:
${fmtBlock(per100)}

NUTRITION PER SERVING:
${fmtBlock(perServing)}

Note: prefer per-serving values when populating "nutrition_facts". Fall back to per-100g if per-serving is missing.`;
}

// ============================================================
// INGREDIENT ANALYZER — Scan History
// localStorage-persisted log of every successful analysis. Powers
// recap, compare, trend, and the macro target tracker.
// ============================================================

// ============================================================
// INGREDIENT ANALYZER — Cloud Sync
// Profile + targets + scan history sync across devices via
// Supabase REST. Images go straight to pCloud through the
// ingredient-upload edge function — they are never persisted
// to Supabase Storage. localStorage is kept as an offline
// cache and as the synchronous read source for the UI.
// ============================================================

const INGREDIENT_PROFILE_TABLE  = 'ingredient_profiles';
const INGREDIENT_TARGETS_TABLE  = 'ingredient_targets';
const INGREDIENT_SCANS_TABLE    = 'ingredient_scans';
const INGREDIENT_PROFILE_ROW_ID = 'household';

const INGREDIENT_CLOUD_COLUMNS = [
    'id', 'ts', 'person', 'product', 'score', 'verdict', 'tier',
    'frequency_tier', 'frequency_label', 'red_flag_count',
    'nutrition_facts', 'quality_score', 'source', 'analysis',
    'ocr_text', 'logged', 'thumb', 'image_pointer'
].join(',');

let _ingredientCloudBooted = false;
let _ingredientCloudBootPromise = null;

function ingredientCloudAvailable() {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// Maps a local scan record (snake_case + camelCase mix from history)
// onto the canonical row shape stored in Supabase.
function ingredientScanRecordToRow(rec) {
    if (!rec) return null;
    return {
        id:               String(rec.id),
        ts:               Number(rec.ts) || Date.now(),
        person:           String(rec.person || 'both'),
        product:          rec.product || null,
        score:            rec.score == null ? null : Number(rec.score),
        verdict:          rec.verdict || null,
        tier:             rec.tier || null,
        frequency_tier:   rec.frequency_tier || null,
        frequency_label:  rec.frequency_label || null,
        red_flag_count:   Number(rec.red_flag_count) || 0,
        nutrition_facts:  rec.nutrition_facts || null,
        quality_score:    rec.quality_score == null ? null : Number(rec.quality_score),
        source:           rec.source || null,
        analysis:         rec.analysis || null,
        ocr_text:         rec.ocr_text || null,
        logged:           rec.logged || null,
        thumb:            rec.thumb || null,
        image_pointer:    rec.image_pointer || null
    };
}

// Inverse: maps a server row back to the in-memory record shape the
// rest of the analyzer code expects. Largely 1:1 — defensive defaults
// only.
function ingredientScanRowToRecord(row) {
    if (!row) return null;
    return {
        id:               String(row.id),
        ts:               Number(row.ts) || 0,
        person:           row.person || 'both',
        product:          row.product || '',
        score:            row.score == null ? null : Number(row.score),
        verdict:          row.verdict || '',
        tier:             row.tier || '',
        frequency_tier:   row.frequency_tier || null,
        frequency_label:  row.frequency_label || '',
        red_flag_count:   Number(row.red_flag_count) || 0,
        nutrition_facts:  row.nutrition_facts || null,
        quality_score:    row.quality_score == null ? null : Number(row.quality_score),
        source:           row.source || '',
        analysis:         row.analysis || null,
        ocr_text:         row.ocr_text || '',
        logged:           row.logged || null,
        thumb:            row.thumb || '',
        image_pointer:    row.image_pointer || null
    };
}

async function supabaseUpsertIngredient(tableName, row) {
    if (!ingredientCloudAvailable()) {
        throw new Error('Supabase credentials not configured');
    }
    const resp = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${tableName}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(row)
    });
    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Upsert ${tableName} failed ${resp.status}: ${txt}`);
    }
    const data = await resp.json().catch(() => null);
    return Array.isArray(data) ? data[0] : data;
}

// Fire-and-forget wrapper used by every save path — failures are
// logged but never surface to the user. Cloud is "eventually
// consistent" with local; the offline cache always wins for UX.
function ingredientCloudFireAndForget(promise, label) {
    if (!promise || typeof promise.then !== 'function') return;
    promise.catch(err => {
        console.warn(`[ingredient-cloud] ${label} failed:`, err?.message || err);
    });
}

async function upsertIngredientProfileCloud(profile) {
    if (!ingredientCloudAvailable()) return null;
    return await supabaseUpsertIngredient(INGREDIENT_PROFILE_TABLE, {
        id:   INGREDIENT_PROFILE_ROW_ID,
        data: profile
    });
}

async function upsertIngredientTargetsCloud(person, targets) {
    if (!ingredientCloudAvailable()) return null;
    return await supabaseUpsertIngredient(INGREDIENT_TARGETS_TABLE, {
        id:   String(person),
        data: targets
    });
}

async function deleteIngredientTargetsCloud(person) {
    if (!ingredientCloudAvailable()) return null;
    return await supabaseDelete(INGREDIENT_TARGETS_TABLE, String(person));
}

async function insertIngredientScanCloud(record) {
    if (!ingredientCloudAvailable()) return null;
    const row = ingredientScanRecordToRow(record);
    return await supabaseUpsertIngredient(INGREDIENT_SCANS_TABLE, row);
}

async function patchIngredientScanCloud(id, patch) {
    if (!ingredientCloudAvailable()) return null;
    // Only forward columns the table knows about.
    const allowed = new Set([
        'ts', 'person', 'product', 'score', 'verdict', 'tier',
        'frequency_tier', 'frequency_label', 'red_flag_count',
        'nutrition_facts', 'quality_score', 'source', 'analysis',
        'ocr_text', 'logged', 'thumb', 'image_pointer'
    ]);
    const body = {};
    Object.keys(patch || {}).forEach(k => {
        if (allowed.has(k)) body[k] = patch[k];
    });
    if (Object.keys(body).length === 0) return null;
    return await supabasePatch(INGREDIENT_SCANS_TABLE, id, body);
}

async function deleteIngredientScanCloud(id) {
    if (!ingredientCloudAvailable()) return null;
    return await supabaseDelete(INGREDIENT_SCANS_TABLE, id);
}

async function clearIngredientScansCloud() {
    if (!ingredientCloudAvailable()) return null;
    // No bulk DELETE helper — use raw REST with a filter that matches all rows.
    const url = `${SUPABASE_URL}/rest/v1/${INGREDIENT_SCANS_TABLE}?id=neq.__never__`;
    const resp = await fetchWithRetry(url, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'return=minimal'
        }
    });
    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Clear ${INGREDIENT_SCANS_TABLE} failed ${resp.status}: ${txt}`);
    }
}

// POSTs the original capture to ingredient-upload, which writes it
// straight to pCloud and returns a {storage:'pcloud_webdav', ...}
// pointer. Returns null on any failure — the scan still gets saved,
// just without the original image (thumb stays inline).
async function uploadIngredientImageToCloud(scanId, dataUrl, ts) {
    if (!ingredientCloudAvailable()) return null;
    if (!dataUrl || !dataUrl.startsWith('data:')) return null;

    const date = new Date(ts || Date.now());
    const endpoint = `${SUPABASE_URL}/functions/v1/ingredient-upload`;
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            scanId,
            dataUrl,
            year:  date.getUTCFullYear(),
            month: String(date.getUTCMonth() + 1).padStart(2, '0')
        })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        throw new Error(data?.error || `ingredient-upload failed: ${resp.status}`);
    }
    return data?.pointer || null;
}

// Pulls server state into the local cache on app boot. Idempotent —
// also runs a one-time migration if local has data the cloud doesn't
// (handles the rollout: each device's existing localStorage history
// gets pushed up the first time it sees the new schema).
async function loadIngredientCloudState() {
    if (!ingredientCloudAvailable()) return;
    if (_ingredientCloudBootPromise) return _ingredientCloudBootPromise;

    _ingredientCloudBootPromise = (async () => {
        try {
            const [profileRows, targetRows, scanRows] = await Promise.all([
                supabaseGet(INGREDIENT_PROFILE_TABLE, { id: INGREDIENT_PROFILE_ROW_ID }, 1, 'id,data').catch(() => []),
                supabaseGet(INGREDIENT_TARGETS_TABLE, {}, 10, 'id,data').catch(() => []),
                supabaseGet(INGREDIENT_SCANS_TABLE, {}, INGREDIENT_HISTORY_MAX, INGREDIENT_CLOUD_COLUMNS, 'ts.desc').catch(() => [])
            ]);

            // Profile — cloud wins if a row exists; otherwise push local up.
            const cloudProfileRow = Array.isArray(profileRows) ? profileRows[0] : null;
            if (cloudProfileRow?.data) {
                try {
                    localStorage.setItem(INGREDIENT_PROFILE_KEY, JSON.stringify(cloudProfileRow.data));
                } catch (_e) { /* quota */ }
            } else {
                const localRaw = localStorage.getItem(INGREDIENT_PROFILE_KEY);
                if (localRaw) {
                    try {
                        ingredientCloudFireAndForget(
                            upsertIngredientProfileCloud(JSON.parse(localRaw)),
                            'seed profile from local'
                        );
                    } catch (_e) { /* ignore */ }
                }
            }

            // Targets — same per-person logic.
            if (Array.isArray(targetRows) && targetRows.length > 0) {
                const all = {};
                targetRows.forEach(r => { if (r?.id) all[r.id] = r.data || {}; });
                try {
                    localStorage.setItem(INGREDIENT_TARGETS_KEY, JSON.stringify(all));
                } catch (_e) { /* quota */ }
            } else {
                try {
                    const localTargets = JSON.parse(localStorage.getItem(INGREDIENT_TARGETS_KEY) || '{}');
                    Object.keys(localTargets || {}).forEach(person => {
                        ingredientCloudFireAndForget(
                            upsertIngredientTargetsCloud(person, localTargets[person] || {}),
                            `seed targets for ${person}`
                        );
                    });
                } catch (_e) { /* ignore */ }
            }

            // History — merge: cloud is the source of truth, but local-only
            // scans that pre-date the rollout get pushed up so users don't
            // lose anything they already scanned today.
            const cloudScans = Array.isArray(scanRows)
                ? scanRows.map(ingredientScanRowToRecord).filter(Boolean)
                : [];
            const cloudIds = new Set(cloudScans.map(s => s.id));

            let localScans = [];
            try {
                const raw = localStorage.getItem(INGREDIENT_HISTORY_KEY);
                localScans = raw ? JSON.parse(raw) : [];
                if (!Array.isArray(localScans)) localScans = [];
            } catch (_e) { localScans = []; }

            const localOnly = localScans.filter(s => s && s.id && !cloudIds.has(s.id));
            localOnly.forEach(rec => {
                ingredientCloudFireAndForget(
                    insertIngredientScanCloud(rec),
                    `seed scan ${rec.id}`
                );
            });

            const merged = [...cloudScans, ...localOnly]
                .sort((a, b) => (b.ts || 0) - (a.ts || 0))
                .slice(0, INGREDIENT_HISTORY_MAX);

            _ingredientHistoryCache = merged;
            try {
                localStorage.setItem(INGREDIENT_HISTORY_KEY, JSON.stringify(merged));
            } catch (_e) { /* quota */ }

            _ingredientCloudBooted = true;
            console.log(`[ingredient-cloud] booted: ${cloudScans.length} cloud + ${localOnly.length} local-seeded scans`);
        } catch (e) {
            console.warn('[ingredient-cloud] boot failed:', e?.message || e);
        }
    })();

    return _ingredientCloudBootPromise;
}

const INGREDIENT_HISTORY_KEY = 'ingredient_scans_v1';
const INGREDIENT_HISTORY_MAX = 100;
const INGREDIENT_HISTORY_THUMB_PX = 96;
const INGREDIENT_HISTORY_THUMB_QUALITY = 0.55;

let _ingredientHistoryCache = null;
const _ingredientHistoryUI = {
    personFilter: 'all',     // 'all' | 'amar' | 'priya' | 'both'
    compareMode: false,
    compareIds: []
};

function getIngredientHistory() {
    if (_ingredientHistoryCache) return _ingredientHistoryCache;
    try {
        const raw = localStorage.getItem(INGREDIENT_HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        _ingredientHistoryCache = Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
        _ingredientHistoryCache = [];
    }
    return _ingredientHistoryCache;
}

function saveIngredientHistory(list) {
    _ingredientHistoryCache = Array.isArray(list) ? list : [];
    try {
        localStorage.setItem(INGREDIENT_HISTORY_KEY, JSON.stringify(_ingredientHistoryCache));
    } catch (e) {
        // Quota — drop oldest until it fits, then retry.
        try {
            while (_ingredientHistoryCache.length > 25) {
                _ingredientHistoryCache.pop();
                try {
                    localStorage.setItem(INGREDIENT_HISTORY_KEY, JSON.stringify(_ingredientHistoryCache));
                    return;
                } catch (_) { /* keep trimming */ }
            }
        } catch (_) { /* give up silently */ }
        console.warn('Could not persist scan history', e);
    }
}

function makeIngredientScanId() {
    return 'scan_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

async function makeIngredientThumb(dataUrl) {
    if (!dataUrl) return '';
    try {
        const img = await loadImageFromDataUrl(dataUrl);
        const w = img.width || 1;
        const h = img.height || 1;
        const scale = Math.min(1, INGREDIENT_HISTORY_THUMB_PX / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', INGREDIENT_HISTORY_THUMB_QUALITY);
    } catch (_e) {
        return '';
    }
}

async function recordIngredientScan({ analysis, sourceLabel, ocrText, imageDataUrl, profileSnapshot, qualityScore }) {
    if (!analysis) return null;
    const thumb = await makeIngredientThumb(imageDataUrl);
    const profile = profileSnapshot || getActiveIngredientProfile();
    const ts = Date.now();
    const record = {
        id: makeIngredientScanId(),
        ts,
        product: analysis.product_guess || '',
        score: analysis.score == null ? null : Number(analysis.score),
        verdict: analysis.verdict || '',
        tier: getIngredientVerdictTier(analysis.verdict, analysis.score),
        frequency_tier: analysis.consumption_frequency?.tier || null,
        frequency_label: analysis.consumption_frequency?.label || '',
        red_flag_count: Array.isArray(analysis.red_flags) ? analysis.red_flags.length : 0,
        nutrition_facts: analysis.nutrition_facts || null,
        source: sourceLabel || '',
        thumb,
        person: profile.activeUser || 'both',
        quality_score: typeof qualityScore === 'number' ? qualityScore : null,
        analysis,
        ocr_text: String(ocrText || '').slice(0, 8000),
        logged: null,           // { servings, loggedAt }
        image_pointer: null
    };

    // Best-effort image upload to pCloud BEFORE we mirror to local — so
    // the pointer rides with the row from the start and we never have to
    // patch it in (which would race with the not-yet-inserted insert).
    if (ingredientCloudAvailable() && imageDataUrl) {
        try {
            const pointer = await uploadIngredientImageToCloud(record.id, imageDataUrl, ts);
            if (pointer) record.image_pointer = pointer;
        } catch (uploadErr) {
            console.warn('[ingredient-cloud] image upload failed:', uploadErr?.message || uploadErr);
        }
    }

    // Local cache — single source of truth for the UI.
    const list = [record, ...getIngredientHistory()].slice(0, INGREDIENT_HISTORY_MAX);
    saveIngredientHistory(list);

    // Push the full row up. Any failure here leaves the local cache
    // intact and the next boot will retry seeding via loadIngredientCloudState.
    ingredientCloudFireAndForget(
        insertIngredientScanCloud(record),
        `insert scan ${record.id}`
    );

    return record;
}

function deleteIngredientScan(id) {
    const list = getIngredientHistory().filter(r => r.id !== id);
    saveIngredientHistory(list);
    ingredientCloudFireAndForget(
        deleteIngredientScanCloud(id),
        `delete scan ${id}`
    );
}

function clearIngredientHistory() {
    saveIngredientHistory([]);
    ingredientCloudFireAndForget(
        clearIngredientScansCloud(),
        'clear scan history'
    );
}

function getIngredientScanById(id) {
    return getIngredientHistory().find(r => r.id === id) || null;
}

function updateIngredientScan(id, patch) {
    const list = getIngredientHistory();
    const idx = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    saveIngredientHistory(list);
    ingredientCloudFireAndForget(
        patchIngredientScanCloud(id, patch),
        `patch scan ${id}`
    );
    return list[idx];
}

function formatRelativeTime(ts) {
    const ms = Date.now() - ts;
    const sec = Math.round(ms / 1000);
    if (sec < 60) return 'just now';
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 7) return `${day}d ago`;
    const wk = Math.round(day / 7);
    if (wk < 5) return `${wk}w ago`;
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : '2-digit' });
}

function openIngredientHistory() {
    const modal = document.getElementById('ingredientHistoryModal');
    if (!modal) return;
    modal.classList.add('active');
    _ingredientHistoryUI.compareMode = false;
    _ingredientHistoryUI.compareIds = [];
    syncIngredientHistoryFilters();
    syncIngredientHistoryCompareUI();
    renderIngredientHistory();
    renderIngredientHistoryTrend();
}

function closeIngredientHistory() {
    const modal = document.getElementById('ingredientHistoryModal');
    if (modal) modal.classList.remove('active');
}

function setIngredientHistoryFilter(person) {
    _ingredientHistoryUI.personFilter = person;
    syncIngredientHistoryFilters();
    renderIngredientHistory();
}

function syncIngredientHistoryFilters() {
    const row = document.getElementById('ingredientHistoryFilterRow');
    if (!row) return;
    const filters = [
        { id: 'all',   label: 'All' },
        { id: 'amar',  label: 'Amar' },
        { id: 'priya', label: 'Priya' },
        { id: 'both',  label: 'Both' }
    ];
    const active = _ingredientHistoryUI.personFilter;
    row.innerHTML = filters.map(f => `
        <button type="button" class="ingredient-history-filter-pill ${active === f.id ? 'is-active' : ''}"
                onclick="setIngredientHistoryFilter('${f.id}')">${escapeIngredientHtml(f.label)}</button>
    `).join('');
}

function getFilteredIngredientHistory() {
    const list = getIngredientHistory();
    const term = String(document.getElementById('ingredientHistorySearch')?.value || '').trim().toLowerCase();
    const person = _ingredientHistoryUI.personFilter;
    return list.filter(r => {
        if (person !== 'all' && r.person !== person) return false;
        if (!term) return true;
        const hay = `${r.product || ''} ${r.verdict || ''} ${r.source || ''}`.toLowerCase();
        return hay.includes(term);
    });
}

function renderIngredientHistory() {
    const listEl = document.getElementById('ingredientHistoryList');
    const emptyEl = document.getElementById('ingredientHistoryEmpty');
    if (!listEl || !emptyEl) return;

    const items = getFilteredIngredientHistory();
    if (items.length === 0) {
        listEl.innerHTML = '';
        emptyEl.classList.remove('hidden');
        return;
    }
    emptyEl.classList.add('hidden');

    const selected = new Set(_ingredientHistoryUI.compareIds);

    listEl.innerHTML = items.map(r => {
        const tier = r.tier || getIngredientVerdictTier(r.verdict, r.score);
        const score = r.score == null ? '—' : r.score;
        const product = r.product || '(unknown product)';
        const personLabel = r.person === 'amar' ? 'Amar' : r.person === 'priya' ? 'Priya' : 'Both';
        const loggedTag = r.logged ? '<span class="ingredient-history-tag is-logged"><i class="fas fa-utensils mr-1"></i>Logged</span>' : '';
        const thumb = r.thumb
            ? `<div class="ingredient-history-thumb" style="background-image:url('${r.thumb}')"></div>`
            : `<div class="ingredient-history-thumb"><i class="fas fa-leaf"></i></div>`;
        const isSel = selected.has(r.id);
        return `
            <div class="ingredient-history-item ${isSel ? 'is-selected' : ''}" data-id="${r.id}" onclick="onIngredientHistoryItemClick('${r.id}')">
                ${thumb}
                <div class="ingredient-history-meta">
                    <div class="ingredient-history-product">${escapeIngredientHtml(product)}</div>
                    <div class="ingredient-history-row">
                        <span><i class="fas fa-clock mr-1"></i>${escapeIngredientHtml(formatRelativeTime(r.ts))}</span>
                        <span class="ingredient-history-tag">${escapeIngredientHtml(personLabel)}</span>
                        ${r.frequency_label ? `<span class="ingredient-history-tag"><i class="fas fa-calendar-day mr-1"></i>${escapeIngredientHtml(r.frequency_label)}</span>` : ''}
                        ${loggedTag}
                    </div>
                </div>
                <div class="ingredient-history-score" data-tier="${tier}">${escapeIngredientHtml(score)}</div>
                <button class="ingredient-history-delete" onclick="event.stopPropagation(); confirmDeleteIngredientScan('${r.id}')" aria-label="Delete">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

function renderIngredientHistoryTrend() {
    const wrap = document.getElementById('ingredientHistoryTrend');
    if (!wrap) return;
    const list = getIngredientHistory();
    if (list.length < 3) {
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
        return;
    }
    const last7Cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = list.filter(r => r.ts >= last7Cutoff);
    const sample = recent.length >= 3 ? recent : list.slice(0, 10);
    const scored = sample.filter(r => typeof r.score === 'number');
    const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : null;
    const goodCount = sample.filter(r => (r.tier === 'excellent' || r.tier === 'good')).length;
    const goodPct = sample.length ? Math.round((goodCount / sample.length) * 100) : 0;
    const totalScans = list.length;

    wrap.classList.remove('hidden');
    wrap.innerHTML = `
        <div class="ingredient-history-trend-tile">
            <div class="ingredient-history-trend-label">Avg score</div>
            <div class="ingredient-history-trend-value">${avg == null ? '—' : avg}</div>
            <div class="ingredient-history-trend-sub">${recent.length >= 3 ? 'last 7 days' : 'last 10 scans'}</div>
        </div>
        <div class="ingredient-history-trend-tile">
            <div class="ingredient-history-trend-label">Good picks</div>
            <div class="ingredient-history-trend-value">${goodPct}%</div>
            <div class="ingredient-history-trend-sub">scoring 60+</div>
        </div>
        <div class="ingredient-history-trend-tile">
            <div class="ingredient-history-trend-label">Total scans</div>
            <div class="ingredient-history-trend-value">${totalScans}</div>
            <div class="ingredient-history-trend-sub">all time</div>
        </div>
    `;
}

function onIngredientHistoryItemClick(id) {
    if (_ingredientHistoryUI.compareMode) {
        const idx = _ingredientHistoryUI.compareIds.indexOf(id);
        if (idx >= 0) {
            _ingredientHistoryUI.compareIds.splice(idx, 1);
        } else {
            _ingredientHistoryUI.compareIds.push(id);
            if (_ingredientHistoryUI.compareIds.length > 2) {
                _ingredientHistoryUI.compareIds.shift();
            }
        }
        renderIngredientHistory();
        renderIngredientHistoryCompareResult();
        return;
    }
    replayIngredientScan(id);
}

function replayIngredientScan(id) {
    const r = getIngredientScanById(id);
    if (!r || !r.analysis) {
        showNotification('Scan no longer available', 'error');
        return;
    }
    closeIngredientHistory();
    const analyzerModal = document.getElementById('ingredientAnalyzerModal');
    if (analyzerModal && !analyzerModal.classList.contains('active')) {
        analyzerModal.classList.add('active');
        syncIngredientGoalBanner();
        syncIngredientAisleToggleButton();
    }
    if (r.thumb) {
        const img = document.getElementById('ingredientImagePreview');
        const placeholder = document.getElementById('ingredientUploadPlaceholder');
        const preview = document.getElementById('ingredientUploadPreview');
        const coach = document.getElementById('ingredientPhotoCoach');
        if (img) img.src = r.thumb;
        if (placeholder) placeholder.classList.add('hidden');
        if (preview) preview.classList.remove('hidden');
        if (coach) coach.classList.add('hidden');
    }
    _currentIngredientScanId = r.id;
    _currentIngredientLogServings = r.logged?.servings || 1;
    renderIngredientAnalysis(r.analysis, r.ocr_text || '', r.source || '');
    const aisle = document.getElementById('ingredientAisleResults');
    const results = document.getElementById('ingredientResults');
    if (results) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else if (aisle) aisle.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function confirmDeleteIngredientScan(id) {
    if (!confirm('Delete this scan from history?')) return;
    deleteIngredientScan(id);
    renderIngredientHistory();
    renderIngredientHistoryTrend();
    renderIngredientTodayStrip();
}

function clearIngredientHistoryConfirm() {
    if (!confirm('Clear ALL ingredient scan history? This cannot be undone.')) return;
    clearIngredientHistory();
    renderIngredientHistory();
    renderIngredientHistoryTrend();
    renderIngredientTodayStrip();
    showNotification('Scan history cleared', 'success');
}

function exportIngredientHistory() {
    const list = getIngredientHistory();
    if (list.length === 0) {
        showNotification('Nothing to export', 'info');
        return;
    }
    const slim = list.map(r => ({
        id: r.id,
        ts: new Date(r.ts).toISOString(),
        product: r.product,
        score: r.score,
        verdict: r.verdict,
        person: r.person,
        source: r.source,
        nutrition_facts: r.nutrition_facts,
        red_flag_count: r.red_flag_count,
        consumption_frequency: r.frequency_label,
        logged: r.logged
    }));
    const blob = new Blob([JSON.stringify(slim, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ingredient-scans-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function toggleIngredientHistoryCompareMode() {
    _ingredientHistoryUI.compareMode = !_ingredientHistoryUI.compareMode;
    if (!_ingredientHistoryUI.compareMode) _ingredientHistoryUI.compareIds = [];
    syncIngredientHistoryCompareUI();
    renderIngredientHistory();
    renderIngredientHistoryCompareResult();
}

function syncIngredientHistoryCompareUI() {
    const banner = document.getElementById('ingredientHistoryCompareBanner');
    const btn = document.getElementById('ingredientHistoryCompareBtn');
    if (banner) banner.classList.toggle('hidden', !_ingredientHistoryUI.compareMode);
    if (btn) btn.classList.toggle('is-active', _ingredientHistoryUI.compareMode);
    const text = document.getElementById('ingredientHistoryCompareBannerText');
    if (text) {
        const n = _ingredientHistoryUI.compareIds.length;
        text.textContent = n === 0 ? 'Tap two scans to compare' : (n === 1 ? 'Tap one more scan to compare' : 'Comparing two scans');
    }
}

function renderIngredientHistoryCompareResult() {
    const wrap = document.getElementById('ingredientHistoryCompareResult');
    if (!wrap) return;
    if (!_ingredientHistoryUI.compareMode || _ingredientHistoryUI.compareIds.length !== 2) {
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
        return;
    }
    const [a, b] = _ingredientHistoryUI.compareIds.map(getIngredientScanById);
    if (!a || !b) {
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
        return;
    }
    const fmt = (v, suffix) => v == null ? '—' : `${v}${suffix || ''}`;
    const cmp = (av, bv, lowerIsBetter) => {
        if (av == null || bv == null || av === bv) return ['', ''];
        const aBetter = lowerIsBetter ? av < bv : av > bv;
        return aBetter ? ['is-better', 'is-worse'] : ['is-worse', 'is-better'];
    };
    const rows = [
        { key: 'Score',          aV: a.score, bV: b.score, suffix: '', lower: false },
        { key: 'Protein',        aV: a.nutrition_facts?.protein_g, bV: b.nutrition_facts?.protein_g, suffix: 'g', lower: false },
        { key: 'Fiber',          aV: a.nutrition_facts?.fiber_g,   bV: b.nutrition_facts?.fiber_g,   suffix: 'g', lower: false },
        { key: 'Added sugar',    aV: a.nutrition_facts?.added_sugar_g, bV: b.nutrition_facts?.added_sugar_g, suffix: 'g', lower: true },
        { key: 'Sodium',         aV: a.nutrition_facts?.sodium_mg, bV: b.nutrition_facts?.sodium_mg, suffix: 'mg', lower: true },
        { key: 'Saturated fat',  aV: a.nutrition_facts?.saturated_fat_g, bV: b.nutrition_facts?.saturated_fat_g, suffix: 'g', lower: true },
        { key: 'Calories',       aV: a.nutrition_facts?.calories,  bV: b.nutrition_facts?.calories,  suffix: '', lower: true },
        { key: 'Red flags',      aV: a.red_flag_count, bV: b.red_flag_count, suffix: '', lower: true }
    ];

    wrap.classList.remove('hidden');
    wrap.innerHTML = `
        <div class="ingredient-history-compare-grid">
            <div class="ingredient-history-compare-col">
                <h4>${escapeIngredientHtml(a.product || '(unknown)')}</h4>
                <div style="font-size:11px;color:#64748b">${escapeIngredientHtml(formatRelativeTime(a.ts))} &middot; ${escapeIngredientHtml(a.verdict || '')}</div>
            </div>
            <div class="ingredient-history-compare-col">
                <h4>${escapeIngredientHtml(b.product || '(unknown)')}</h4>
                <div style="font-size:11px;color:#64748b">${escapeIngredientHtml(formatRelativeTime(b.ts))} &middot; ${escapeIngredientHtml(b.verdict || '')}</div>
            </div>
        </div>
        ${rows.map(row => {
            const [aClass, bClass] = cmp(row.aV, row.bV, row.lower);
            return `
                <div class="ingredient-history-compare-row">
                    <div class="ingredient-history-compare-cell ${aClass}">${escapeIngredientHtml(fmt(row.aV, row.suffix))}</div>
                    <div class="ingredient-history-compare-key">${escapeIngredientHtml(row.key)}</div>
                    <div class="ingredient-history-compare-cell ${bClass}">${escapeIngredientHtml(fmt(row.bV, row.suffix))}</div>
                </div>
            `;
        }).join('')}
    `;
}

// ============================================================
// INGREDIENT ANALYZER — Macro Target Tracker
// Per-person daily targets stored in localStorage, credited
// against logged scans from history. Resets at local midnight.
// ============================================================

const INGREDIENT_TARGETS_KEY = 'ingredient_targets_v1';

const INGREDIENT_TARGET_FIELDS = [
    { key: 'calories',     label: 'Calories',    unit: 'kcal', max: false, defaults: { amar: 2400, priya: 1800, both: 2100 } },
    { key: 'protein_g',    label: 'Protein',     unit: 'g',    max: false, defaults: { amar: 150,  priya: 110,  both: 130  } },
    { key: 'fiber_g',      label: 'Fiber',       unit: 'g',    max: false, defaults: { amar: 38,   priya: 30,   both: 35   } },
    { key: 'added_sugar_g',label: 'Added sugar', unit: 'g',    max: true,  defaults: { amar: 30,   priya: 25,   both: 25   } },
    { key: 'sodium_mg',    label: 'Sodium',      unit: 'mg',   max: true,  defaults: { amar: 2300, priya: 2000, both: 2300 } },
    { key: 'saturated_fat_g', label: 'Sat fat',  unit: 'g',    max: true,  defaults: { amar: 22,   priya: 18,   both: 20   } }
];

let _ingredientTargetsTodayWho = null;       // person scope for the targets modal view
const INGREDIENT_TODAY_STRIP_FIELDS = ['protein_g', 'fiber_g', 'added_sugar_g', 'sodium_mg'];

function getIngredientTargetDefaults(person) {
    const out = {};
    INGREDIENT_TARGET_FIELDS.forEach(f => { out[f.key] = f.defaults[person] ?? f.defaults.both; });
    return out;
}

function getAllIngredientTargets() {
    try {
        const raw = localStorage.getItem(INGREDIENT_TARGETS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_e) {
        return {};
    }
}

function getIngredientTargetsFor(person) {
    const all = getAllIngredientTargets();
    const stored = all[person] && typeof all[person] === 'object' ? all[person] : {};
    const defaults = getIngredientTargetDefaults(person);
    const merged = {};
    INGREDIENT_TARGET_FIELDS.forEach(f => {
        const v = Number(stored[f.key]);
        merged[f.key] = isFinite(v) && v > 0 ? v : defaults[f.key];
    });
    return merged;
}

function saveIngredientTargetsFor(person, targets) {
    const all = getAllIngredientTargets();
    all[person] = { ...(all[person] || {}), ...targets };
    try {
        localStorage.setItem(INGREDIENT_TARGETS_KEY, JSON.stringify(all));
    } catch (_e) { /* quota */ }
    ingredientCloudFireAndForget(
        upsertIngredientTargetsCloud(person, all[person]),
        `save targets for ${person}`
    );
}

function dayKeyForTimestamp(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayLoggedEntries(person) {
    const today = dayKeyForTimestamp(Date.now());
    return getIngredientHistory().filter(r => {
        if (!r.logged || !r.logged.loggedAt) return false;
        if (person && person !== 'all' && r.person !== person) return false;
        return dayKeyForTimestamp(r.logged.loggedAt) === today;
    });
}

function aggregateLoggedNutrition(entries) {
    const totals = {};
    INGREDIENT_TARGET_FIELDS.forEach(f => { totals[f.key] = 0; });
    entries.forEach(r => {
        const facts = r.nutrition_facts || {};
        const servings = Number(r.logged?.servings || 1);
        INGREDIENT_TARGET_FIELDS.forEach(f => {
            const v = Number(facts[f.key]);
            if (isFinite(v)) totals[f.key] += v * servings;
        });
    });
    INGREDIENT_TARGET_FIELDS.forEach(f => {
        totals[f.key] = Math.round(totals[f.key] * 10) / 10;
    });
    return totals;
}

function computeTargetTone(field, consumed, target) {
    if (!target || !isFinite(target) || target <= 0) return 'neutral';
    const pct = (consumed / target) * 100;
    if (field.max) {
        if (pct >= 100) return 'bad';
        if (pct >= 80) return 'warn';
        return 'good';
    }
    if (pct >= 100) return 'good';
    if (pct >= 60) return 'warn';
    return 'bad';
}

function openIngredientTargets() {
    const modal = document.getElementById('ingredientTargetsModal');
    if (!modal) return;
    modal.classList.add('active');
    if (!_ingredientTargetsTodayWho) {
        _ingredientTargetsTodayWho = getActiveIngredientProfile().activeUser || 'both';
    }
    renderIngredientTargetsWhoRow();
    renderIngredientTargetsToday();
    renderIngredientTargetsEditor();
}

function closeIngredientTargets() {
    const modal = document.getElementById('ingredientTargetsModal');
    if (modal) modal.classList.remove('active');
}

function setIngredientTargetsWho(person) {
    _ingredientTargetsTodayWho = person;
    renderIngredientTargetsWhoRow();
    renderIngredientTargetsToday();
    renderIngredientTargetsEditor();
}

function renderIngredientTargetsWhoRow() {
    const row = document.getElementById('ingredientTargetsWhoRow');
    if (!row) return;
    row.innerHTML = INGREDIENT_PROFILE_PEOPLE.map(p => `
        <button type="button" class="ingredient-profile-who-btn ${_ingredientTargetsTodayWho === p.id ? 'is-active' : ''}"
                onclick="setIngredientTargetsWho('${p.id}')">
            <i class="fas ${p.icon}"></i>${escapeIngredientHtml(p.label)}
        </button>
    `).join('');
}

function renderIngredientTargetsToday() {
    const grid = document.getElementById('ingredientTargetsTodayGrid');
    const dateEl = document.getElementById('ingredientTargetsTodayDate');
    const listEl = document.getElementById('ingredientTargetsLoggedList');
    if (!grid) return;

    if (dateEl) {
        const d = new Date();
        dateEl.textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }

    const targets = getIngredientTargetsFor(_ingredientTargetsTodayWho);
    const entries = getTodayLoggedEntries(_ingredientTargetsTodayWho);
    const totals = aggregateLoggedNutrition(entries);

    grid.innerHTML = INGREDIENT_TARGET_FIELDS.map(f => {
        const consumed = totals[f.key] || 0;
        const target = targets[f.key];
        const tone = computeTargetTone(f, consumed, target);
        const pct = target ? Math.min(150, (consumed / target) * 100) : 0;
        const ringPct = Math.min(100, pct);
        const r = 32;
        const c = 2 * Math.PI * r;
        const offset = c * (1 - ringPct / 100);
        const labelPct = Math.round(pct);
        const valueDisplay = `${formatTargetNumber(consumed)} <small>/ ${formatTargetNumber(target)} ${escapeIngredientHtml(f.unit)}</small>`;
        const arrow = f.max ? 'max' : 'goal';
        return `
            <div class="ingredient-target-tile" data-tone="${tone}">
                <div class="ingredient-target-ring-wrap">
                    <svg width="80" height="80" viewBox="0 0 80 80">
                        <circle class="ingredient-target-ring-bg" cx="40" cy="40" r="${r}"></circle>
                        <circle class="ingredient-target-ring-fg" cx="40" cy="40" r="${r}"
                            stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
                            transform="rotate(-90 40 40)"></circle>
                    </svg>
                    <div class="ingredient-target-ring-center">
                        <span class="pct">${labelPct}%</span>
                        <span class="of">${arrow}</span>
                    </div>
                </div>
                <div class="ingredient-target-tile-label">${escapeIngredientHtml(f.label)}</div>
                <div class="ingredient-target-tile-value">${valueDisplay}</div>
            </div>
        `;
    }).join('');

    if (listEl) {
        if (entries.length === 0) {
            listEl.innerHTML = '';
        } else {
            listEl.innerHTML = entries.map(r => {
                const servings = r.logged?.servings || 1;
                const cal = r.nutrition_facts?.calories;
                const calStr = cal != null ? `${Math.round(cal * servings)} kcal` : '';
                const protein = r.nutrition_facts?.protein_g;
                const proteinStr = protein != null ? `${Math.round(protein * servings * 10) / 10} g protein` : '';
                const meta = [calStr, proteinStr, `${servings}× serving`].filter(Boolean).join(' · ');
                return `
                    <div class="ingredient-targets-logged-row">
                        <div class="ingredient-targets-logged-name">${escapeIngredientHtml(r.product || '(unknown)')}</div>
                        <div class="ingredient-targets-logged-meta">${escapeIngredientHtml(meta)}</div>
                        <button class="ingredient-targets-logged-remove" onclick="unlogIngredientScan('${r.id}')" title="Remove from today">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            }).join('');
        }
    }
}

function formatTargetNumber(n) {
    if (n == null || !isFinite(n)) return '—';
    if (Math.abs(n) >= 100) return String(Math.round(n));
    return String(Math.round(n * 10) / 10);
}

function renderIngredientTargetsEditor() {
    const grid = document.getElementById('ingredientTargetsEditorGrid');
    if (!grid) return;
    const targets = getIngredientTargetsFor(_ingredientTargetsTodayWho);
    grid.innerHTML = INGREDIENT_TARGET_FIELDS.map(f => `
        <div class="ingredient-targets-editor-row">
            <label>${escapeIngredientHtml(f.label)} ${f.max ? '(max)' : ''} <span style="color:#94a3b8">(${escapeIngredientHtml(f.unit)})</span></label>
            <input type="number" min="0" step="1" data-field="${f.key}" value="${targets[f.key]}">
        </div>
    `).join('');
}

function saveIngredientTargetsFromForm() {
    const grid = document.getElementById('ingredientTargetsEditorGrid');
    if (!grid) return;
    const inputs = grid.querySelectorAll('input[data-field]');
    const next = {};
    inputs.forEach(inp => {
        const field = inp.getAttribute('data-field');
        const v = Number(inp.value);
        if (field && isFinite(v) && v > 0) next[field] = v;
    });
    saveIngredientTargetsFor(_ingredientTargetsTodayWho, next);
    renderIngredientTargetsToday();
    renderIngredientTodayStrip();
    showNotification('Targets saved', 'success');
}

function resetIngredientTargetsToDefaults() {
    if (!confirm(`Reset targets for ${_ingredientTargetsTodayWho} to defaults?`)) return;
    const all = getAllIngredientTargets();
    delete all[_ingredientTargetsTodayWho];
    try { localStorage.setItem(INGREDIENT_TARGETS_KEY, JSON.stringify(all)); } catch (_e) { /* quota */ }
    ingredientCloudFireAndForget(
        deleteIngredientTargetsCloud(_ingredientTargetsTodayWho),
        `reset targets for ${_ingredientTargetsTodayWho}`
    );
    renderIngredientTargetsEditor();
    renderIngredientTargetsToday();
    renderIngredientTodayStrip();
    showNotification('Targets reset to defaults', 'success');
}

function unlogIngredientScan(id) {
    updateIngredientScan(id, { logged: null });
    if (_currentIngredientScanId === id) {
        _currentIngredientLogServings = 1;
        renderIngredientLogCard();
    }
    renderIngredientTargetsToday();
    renderIngredientTodayStrip();
}

// Today strip on the analyzer page (above capture area).
function renderIngredientTodayStrip() {
    const strip = document.getElementById('ingredientTodayStrip');
    const bars = document.getElementById('ingredientTodayStripBars');
    const whoEl = document.getElementById('ingredientTodayWho');
    if (!strip || !bars) return;

    const profile = getActiveIngredientProfile();
    const person = profile.activeUser || 'both';
    const entries = getTodayLoggedEntries(person);
    if (entries.length === 0) {
        strip.classList.add('hidden');
        bars.innerHTML = '';
        return;
    }
    strip.classList.remove('hidden');
    if (whoEl) {
        const labelMap = { amar: 'Amar', priya: 'Priya', both: 'You' };
        whoEl.textContent = labelMap[person] || 'You';
    }
    const targets = getIngredientTargetsFor(person);
    const totals = aggregateLoggedNutrition(entries);
    bars.innerHTML = INGREDIENT_TODAY_STRIP_FIELDS.map(key => {
        const f = INGREDIENT_TARGET_FIELDS.find(x => x.key === key);
        if (!f) return '';
        const consumed = totals[key] || 0;
        const target = targets[key];
        const tone = computeTargetTone(f, consumed, target);
        const pct = target ? Math.min(120, Math.round((consumed / target) * 100)) : 0;
        return `
            <div class="ingredient-today-bar" data-tone="${tone}">
                <div class="ingredient-today-bar-label">
                    <span>${escapeIngredientHtml(f.label)}</span>
                    <span>${pct}%</span>
                </div>
                <div class="ingredient-today-bar-track">
                    <div class="ingredient-today-bar-fill" style="width:${Math.min(100, pct)}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// INGREDIENT ANALYZER — Log-this-serving card (results panel)
// ============================================================

let _currentIngredientScanId = null;       // history id of the scan currently rendered
let _currentIngredientLogServings = 1;     // working "servings" count for the log card

function adjustIngredientLogServings(delta) {
    let next = (_currentIngredientLogServings || 1) + delta;
    next = Math.max(0.5, Math.min(20, Math.round(next * 2) / 2));
    _currentIngredientLogServings = next;
    const countEl = document.getElementById('ingredientLogServingsCount');
    if (countEl) countEl.textContent = next % 1 === 0 ? String(next) : next.toFixed(1);
}

function renderIngredientLogCard() {
    const card = document.getElementById('ingredientLogServingCard');
    const previewEl = document.getElementById('ingredientLogServingPreview');
    const countEl = document.getElementById('ingredientLogServingsCount');
    const btn = document.getElementById('ingredientLogServingBtn');
    const btnText = document.getElementById('ingredientLogServingBtnText');
    if (!card) return;

    const record = _currentIngredientScanId ? getIngredientScanById(_currentIngredientScanId) : null;
    const facts = record?.nutrition_facts || lastIngredientAnalysis?.nutrition_facts;
    const hasNutrition = facts && Object.entries(facts).some(([k, v]) => k !== 'serving_size' && k !== 'servings_per_container' && v != null);

    if (!record || !hasNutrition) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');

    if (record.logged) {
        _currentIngredientLogServings = Number(record.logged.servings) || 1;
        card.classList.add('is-logged');
        if (btnText) btnText.textContent = 'Update / re-log';
        if (btn) btn.innerHTML = `<i class="fas fa-rotate mr-2"></i><span id="ingredientLogServingBtnText">Update log</span>`;
    } else {
        card.classList.remove('is-logged');
        if (btn) btn.innerHTML = `<i class="fas fa-plus mr-2"></i><span id="ingredientLogServingBtnText">Log serving</span>`;
    }

    if (countEl) {
        const n = _currentIngredientLogServings;
        countEl.textContent = n % 1 === 0 ? String(n) : n.toFixed(1);
    }

    if (previewEl) {
        const servings = _currentIngredientLogServings;
        const parts = [];
        if (facts.calories != null)  parts.push(`${Math.round(facts.calories * servings)} kcal`);
        if (facts.protein_g != null) parts.push(`${Math.round(facts.protein_g * servings * 10) / 10} g protein`);
        if (facts.fiber_g != null)   parts.push(`${Math.round(facts.fiber_g * servings * 10) / 10} g fiber`);
        if (facts.added_sugar_g != null) parts.push(`${Math.round(facts.added_sugar_g * servings * 10) / 10} g added sugar`);
        if (facts.sodium_mg != null) parts.push(`${Math.round(facts.sodium_mg * servings)} mg sodium`);
        previewEl.textContent = parts.join(' · ') || 'Adds nothing — no numeric nutrition extracted.';
    }
}

function logCurrentIngredientScanServing() {
    if (!_currentIngredientScanId) {
        showNotification('Nothing to log yet — analyze a product first', 'error');
        return;
    }
    const record = getIngredientScanById(_currentIngredientScanId);
    if (!record) {
        showNotification('Scan no longer in history', 'error');
        return;
    }
    const servings = Math.max(0.5, _currentIngredientLogServings || 1);
    updateIngredientScan(_currentIngredientScanId, {
        logged: { servings, loggedAt: Date.now() }
    });
    renderIngredientLogCard();
    renderIngredientTodayStrip();
    showNotification(`Logged ${servings}× serving against today's targets`, 'success');
}

// ============================================================
// INGREDIENT ANALYZER — Photo Quality Coach
// Lightweight client-side image quality assessment to coach the
// user toward better OCR (when barcode lookup fails). Computes:
//   - dimensions     (rejects too-small images)
//   - mean brightness (rejects too dark / too washed out)
//   - global contrast / stddev (rejects flat / low-contrast)
//   - sharpness proxy via Sobel-style 3x3 magnitude (rejects blurry)
// ============================================================

const INGREDIENT_PHOTO_COACH_DOWNSCALE = 200; // longest side for the quality calc canvas
let _ingredientPhotoCoachLast = null;          // { score, issues, dims, brightness, contrast, sharpness }

async function assessIngredientPhotoQuality(dataUrl) {
    if (!dataUrl) return null;
    try {
        const img = await loadImageFromDataUrl(dataUrl);
        const w = img.width || 0;
        const h = img.height || 0;
        if (!w || !h) return null;

        const longest = Math.max(w, h);
        const scale = longest > INGREDIENT_PHOTO_COACH_DOWNSCALE ? INGREDIENT_PHOTO_COACH_DOWNSCALE / longest : 1;
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, cw, ch);
        const imageData = ctx.getImageData(0, 0, cw, ch);
        const data = imageData.data;

        // Build grayscale + brightness stats
        const gray = new Uint8ClampedArray(cw * ch);
        let sum = 0;
        let sqSum = 0;
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            // Rec. 601 luma
            const v = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114);
            gray[j] = v;
            sum += v;
            sqSum += v * v;
        }
        const px = cw * ch;
        const mean = sum / px;
        const variance = (sqSum / px) - (mean * mean);
        const stddev = Math.sqrt(Math.max(0, variance));

        // Sharpness via Sobel-style magnitude (sample every 2 pixels for speed)
        let sharpAcc = 0;
        let sharpCount = 0;
        for (let y = 1; y < ch - 1; y += 2) {
            for (let x = 1; x < cw - 1; x += 2) {
                const i = y * cw + x;
                const gx = -gray[i - cw - 1] - 2 * gray[i - 1] - gray[i + cw - 1]
                          + gray[i - cw + 1] + 2 * gray[i + 1] + gray[i + cw + 1];
                const gy = -gray[i - cw - 1] - 2 * gray[i - cw] - gray[i - cw + 1]
                          + gray[i + cw - 1] + 2 * gray[i + cw] + gray[i + cw + 1];
                sharpAcc += Math.abs(gx) + Math.abs(gy);
                sharpCount++;
            }
        }
        const sharpness = sharpCount ? (sharpAcc / sharpCount) : 0;

        // Issues
        const issues = [];
        // Dimensions
        if (longest < 600) {
            issues.push({ level: 'bad',  icon: 'fa-magnifying-glass-minus',
                          text: 'Image is small. Get closer or use a higher-res photo for clean text.' });
        } else if (longest < 900) {
            issues.push({ level: 'warn', icon: 'fa-magnifying-glass',
                          text: 'Photo is on the small side. A higher-res shot OCRs more reliably.' });
        }
        // Brightness
        if (mean < 60) {
            issues.push({ level: 'bad',  icon: 'fa-moon',
                          text: 'Too dark. Move under brighter, even light.' });
        } else if (mean < 90) {
            issues.push({ level: 'warn', icon: 'fa-cloud',
                          text: 'A bit dark. More even light improves OCR.' });
        } else if (mean > 220) {
            issues.push({ level: 'bad',  icon: 'fa-sun',
                          text: 'Overexposed / glare washing out text. Tilt the package or step out of direct sun.' });
        } else if (mean > 200) {
            issues.push({ level: 'warn', icon: 'fa-sun',
                          text: 'Looks washed out — check for glare on the label.' });
        }
        // Contrast
        if (stddev < 22) {
            issues.push({ level: 'warn', icon: 'fa-circle-half-stroke',
                          text: 'Low contrast. Make sure the label fills the frame and is in focus.' });
        }
        // Sharpness (Sobel mag — empirical thresholds from typical phone shots ~50-150)
        if (sharpness < 18) {
            issues.push({ level: 'bad',  icon: 'fa-bullseye',
                          text: 'Photo looks blurry. Hold steady, tap to focus, and try again.' });
        } else if (sharpness < 32) {
            issues.push({ level: 'warn', icon: 'fa-bullseye',
                          text: 'Slight blur — a sharper shot reads better.' });
        }

        // Score: start 100, subtract per issue
        let score = 100;
        issues.forEach(it => { score -= (it.level === 'bad' ? 22 : 10); });
        score = Math.max(0, Math.min(100, score));

        return {
            score,
            issues,
            dims: { w, h },
            brightness: Math.round(mean),
            contrast: Math.round(stddev),
            sharpness: Math.round(sharpness)
        };
    } catch (e) {
        console.warn('Photo quality assessment failed', e);
        return null;
    }
}

function renderIngredientPhotoCoach(assessment) {
    const card = document.getElementById('ingredientPhotoCoach');
    const titleEl = document.getElementById('ingredientPhotoCoachTitle');
    const subEl = document.getElementById('ingredientPhotoCoachSub');
    const scoreEl = document.getElementById('ingredientPhotoCoachScore');
    const iconEl = document.getElementById('ingredientPhotoCoachIcon');
    const listEl = document.getElementById('ingredientPhotoCoachList');
    if (!card) return;

    if (!assessment) {
        card.classList.add('hidden');
        return;
    }

    _ingredientPhotoCoachLast = assessment;
    const { score, issues } = assessment;
    const worst = issues.some(i => i.level === 'bad') ? 'bad'
                : issues.some(i => i.level === 'warn') ? 'warn' : 'ok';

    // Stay quiet when the photo is clean — coach only nudges when a real problem
    // would hurt OCR. Barcode lookup short-circuits OCR for most products anyway.
    if (worst === 'ok') {
        card.classList.add('hidden');
        return;
    }

    card.setAttribute('data-tone', worst);
    card.classList.remove('hidden');

    if (scoreEl) scoreEl.textContent = String(score);
    if (iconEl) {
        iconEl.className = worst === 'bad'  ? 'fas fa-triangle-exclamation'
                         : worst === 'warn' ? 'fas fa-circle-exclamation'
                         : 'fas fa-circle-check';
    }
    if (titleEl) {
        titleEl.textContent = worst === 'bad'  ? 'Photo could be a problem'
                            : worst === 'warn' ? 'Photo is OK — could be better'
                            : 'Photo quality looks great';
    }
    if (subEl) {
        subEl.textContent = worst === 'ok'
            ? `${assessment.dims.w}×${assessment.dims.h} · brightness ${assessment.brightness} · sharpness ${assessment.sharpness}`
            : 'Barcode lookup will still try first — OCR fallback works best with clean photos.';
    }
    if (listEl) {
        listEl.innerHTML = issues.map(i => `
            <li data-level="${i.level}"><i class="fas ${i.icon}"></i><span>${escapeIngredientHtml(i.text)}</span></li>
        `).join('');
    }
}

async function evaluateAndShowIngredientPhotoCoach(dataUrl) {
    const card = document.getElementById('ingredientPhotoCoach');
    if (card) card.classList.add('hidden');
    const assessment = await assessIngredientPhotoQuality(dataUrl);
    renderIngredientPhotoCoach(assessment);
    return assessment;
}

