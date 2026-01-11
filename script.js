// Version format: YEAR.WEEK.DEPLOYMENT (e.g., 25.48.1)
const BUILD_TIMESTAMP = '2026-01-11T02:13:14Z'; // Auto-updated on deployment
const APP_VERSION = '26.02.5'; // Auto-updated on deployment

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
    const PULL_THRESHOLD = 150; // Increased threshold for less sensitivity

    const pullToRefreshIndicator = document.createElement('div');
    pullToRefreshIndicator.id = 'pullToRefreshIndicator';
    pullToRefreshIndicator.style.cssText = `
                 position: fixed;
                 top: -80px;
                 left: 0;
                 right: 0;
                 height: 80px;
                 background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 z-index: 9998;
                 transition: transform 0.3s ease;
                 color: white;
                 font-weight: 600;
                 font-size: 14px;
             `;
    pullToRefreshIndicator.innerHTML = '<div style="text-align: center;"><i class="fas fa-arrow-down" style="font-size: 20px; margin-bottom: 6px; opacity: 0.7;"></i><div>Pull down to refresh</div></div>';
    document.body.appendChild(pullToRefreshIndicator);
    
    // Haptic feedback helper
    function triggerHaptic(pattern = [50]) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }

    document.addEventListener('touchstart', function (e) {
        if (window.scrollY === 0) {
            touchStartY = e.touches[0].clientY;
            isPulling = true;
            hasTriggeredHaptic = false;
        }
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (!isPulling) return;

        touchEndY = e.touches[0].clientY;
        pullDistance = touchEndY - touchStartY;

        // Only start showing indicator after 30px pull (reduces accidental triggers)
        if (pullDistance > 30 && window.scrollY === 0) {
            // Reduced sensitivity: slower translation (0.35 instead of 0.5)
            const translateY = Math.min((pullDistance - 30) * 0.35, 80);
            pullToRefreshIndicator.style.transform = `translateY(${translateY}px)`;
            
            // Calculate progress percentage
            const progress = Math.min((pullDistance / PULL_THRESHOLD) * 100, 100);

            if (pullDistance >= PULL_THRESHOLD) {
                // Ready to refresh - trigger haptic once
                if (!hasTriggeredHaptic) {
                    triggerHaptic([30]); // Short vibration when threshold reached
                    hasTriggeredHaptic = true;
                }
                pullToRefreshIndicator.innerHTML = '<div style="text-align: center;"><i class="fas fa-check-circle" style="font-size: 24px; margin-bottom: 6px;"></i><div>Release to refresh</div></div>';
                pullToRefreshIndicator.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)'; // Green
            } else {
                pullToRefreshIndicator.innerHTML = `<div style="text-align: center;"><i class="fas fa-arrow-down" style="font-size: 20px; margin-bottom: 6px; opacity: ${0.5 + progress/200};"></i><div>Pull down to refresh</div></div>`;
                pullToRefreshIndicator.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; // Purple
            }
        }
    }, { passive: true });

    document.addEventListener('touchend', async function (e) {
        if (!isPulling) return;

        if (pullDistance >= PULL_THRESHOLD && window.scrollY === 0) {
            // Trigger haptic on release
            triggerHaptic([20, 30, 20]); // Pattern: short-pause-short
            
            // Trigger refresh
            pullToRefreshIndicator.innerHTML = '<div style="text-align: center;"><div class="loading" style="width: 24px; height: 24px; border-width: 3px; margin: 0 auto 8px;"></div><div>Refreshing...</div></div>';
            pullToRefreshIndicator.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            pullToRefreshIndicator.style.transform = 'translateY(80px)';

            try {
                // Reload all data
                await loadData();
                await loadProfilePictures();
                await loadFixedExpenses();
                await loadLLCExpenses();

                // Force UI refresh
                renderExpenses();
                renderPayments();
                updateStats();

                triggerHaptic([50]); // Success haptic
                showNotification('Data refreshed successfully!', 'success');
            } catch (error) {
                triggerHaptic([100, 50, 100]); // Error haptic pattern
                showNotification('Failed to refresh data', 'error');
            }

            // Hide indicator
            setTimeout(() => {
                pullToRefreshIndicator.style.transform = 'translateY(0)';
                pullToRefreshIndicator.innerHTML = '<div style="text-align: center;"><i class="fas fa-arrow-down" style="font-size: 20px; margin-bottom: 6px; opacity: 0.7;"></i><div>Pull down to refresh</div></div>';
            }, 500);
        } else {
            // Reset
            pullToRefreshIndicator.style.transform = 'translateY(0)';
            pullToRefreshIndicator.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
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

async function loadData() {
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
        
        showNotification('Data loaded successfully!', 'success');
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

    const rentalIncomeEl = document.getElementById('rentalIncomeTotal');
    if (rentalIncomeEl) {
        rentalIncomeEl.textContent = `$${totalRentalIncome.toFixed(2)}`;
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
            categoryInput.style.backgroundColor = '';
            categoryInput.style.borderColor = '';
            const existingHint = document.getElementById('categoryHint');
            if (existingHint) existingHint.remove();
        }
        if (tagsInput && tagsInput.dataset.autoFilled === 'true') {
            tagsInput.value = '';
            tagsInput.dataset.autoFilled = 'false';
            tagsInput.style.backgroundColor = '';
            tagsInput.style.borderColor = '';
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
        categoryInput.style.backgroundColor = '';
        categoryInput.style.borderColor = '';
        const existingHint = document.getElementById('categoryHint');
        if (existingHint) existingHint.remove();
        
        // Also clear tags and LLC if they were auto-filled
        if (tagsInput && tagsInput.dataset.autoFilled === 'true') {
            tagsInput.value = '';
            tagsInput.dataset.autoFilled = 'false';
            tagsInput.style.backgroundColor = '';
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
                categoryInput.style.backgroundColor = '#f0fdf4'; // Light green
                categoryInput.style.borderColor = '#86efac'; // Green border

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
                    categoryInput.style.backgroundColor = '';
                    categoryInput.style.borderColor = '';
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

                        categoryInput.style.backgroundColor = '#fef3c7'; // Light yellow (less confident)
                        categoryInput.style.borderColor = '#fbbf24'; // Yellow border

                        const existingHint = document.getElementById('categoryHint');
                        if (existingHint) existingHint.remove();

                        const hint = document.createElement('div');
                        hint.id = 'categoryHint';
                        hint.className = 'text-xs text-yellow-700 mt-1 flex items-center gap-1';
                        hint.innerHTML = `<i class="fas fa-lightbulb"></i> Suggested based on similar item "${historicalItem}" (${Math.round(confidence)}% confidence)`;
                        (categoryInput.parentElement?.parentElement || categoryInput.parentElement).appendChild(hint);

                        setTimeout(() => {
                            categoryInput.style.backgroundColor = '';
                            categoryInput.style.borderColor = '';
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
        tagsInput.style.backgroundColor = matchType === 'exact' ? '#f0fdf4' : '#fef3c7';
        tagsInput.style.borderColor = matchType === 'exact' ? '#86efac' : '#fbbf24';
        
        const existingHint = document.getElementById('tagsHint');
        if (existingHint) existingHint.remove();
        
        const hint = document.createElement('div');
        hint.id = 'tagsHint';
        hint.className = matchType === 'exact' ? 'text-xs text-green-600 mt-1 flex items-center gap-1' : 'text-xs text-yellow-700 mt-1 flex items-center gap-1';
        hint.innerHTML = `<i class="fas fa-magic"></i> Auto-suggested tags (${Math.round(confidence)}% confidence)`;
        tagsInput.parentElement.appendChild(hint);
        
        setTimeout(() => {
            tagsInput.style.backgroundColor = '';
            tagsInput.style.borderColor = '';
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
        llcBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
        llcBtn.style.color = 'white';
        llcBtn.style.borderColor = '#1d4ed8';
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Business</span>';
    } else {
        llcBtn.style.background = 'white';
        llcBtn.style.color = '#6b7280';
        llcBtn.style.borderColor = '#e5e7eb';
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
        llcBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
        llcBtn.style.color = 'white';
        llcBtn.style.borderColor = '#3b82f6';
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Business</span>';
    } else {
        llcSelect.value = 'No';
        llcBtn.style.background = 'white';
        llcBtn.style.color = '#6b7280';
        llcBtn.style.borderColor = '#e5e7eb';
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Personal</span>';
    }
}

// More Details Toggle Function
function toggleMoreDetails() {
    const panel = document.getElementById('moreDetailsPanel');
    const btn = document.getElementById('moreDetailsBtn');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        btn.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
        btn.style.color = 'white';
        btn.style.borderColor = '#8b5cf6';
        btn.innerHTML = '<i class="fas fa-chevron-up"></i><span>Less</span>';
    } else {
        panel.classList.add('hidden');
        btn.style.background = 'white';
        btn.style.color = '#6b7280';
        btn.style.borderColor = '#e5e7eb';
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
    llcBtn.style.background = 'white';
    llcBtn.style.color = '#6b7280';
    llcBtn.style.borderColor = '#e5e7eb';
    llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Personal</span>';
    
    // Hide more details panel
    document.getElementById('moreDetailsPanel').classList.add('hidden');
    const moreBtn = document.getElementById('moreDetailsBtn');
    moreBtn.style.background = 'white';
    moreBtn.style.color = '#6b7280';
    moreBtn.style.borderColor = '#e5e7eb';
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
                // Don't add to contributions - rental income reduces target instead
            }
            // Handle Priya's mortgage contributions separately
            else if (payment.fields.Person === 'Priya' && payment.fields.PaymentType === 'PriyaMortgageContribution') {
                // Don't add yet - will be used to adjust Amar's mortgage contribution
            }
            // Add regular payments (excluding rental income) to respective person
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

    // Check for mismatches
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    Object.keys(monthlyData).forEach(key => {
        const data = monthlyData[key];

        // Check if contributions match spending
        // Rental income is tracked separately and only affects remaining balance, not mismatch detection
        const diff = Math.abs(data.spending - data.contributions);

        // Allow small rounding differences (< $0.01)
        if (diff > 0.01) {
            const monthName = monthNames[parseInt(data.month) - 1];
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
        llcBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
        llcBtn.style.color = 'white';
        llcBtn.style.borderColor = '#3b82f6';
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Business</span>';
    } else {
        llcBtn.style.background = 'white';
        llcBtn.style.color = '#6b7280';
        llcBtn.style.borderColor = '#e5e7eb';
        llcBtn.innerHTML = '<i class="fas fa-building"></i><span>Personal</span>';
    }

    // Auto-expand more details if there's additional data
    const hasMoreDetails = expense.fields.Tags || expense.fields.Notes || 
                          expense.fields.AmarContribution || expense.fields.PriyaContribution;
    
    const moreDetailsPanel = document.getElementById('moreDetailsPanel');
    const moreBtn = document.getElementById('moreDetailsBtn');
    
    if (hasMoreDetails) {
        moreDetailsPanel.classList.remove('hidden');
        moreBtn.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
        moreBtn.style.color = 'white';
        moreBtn.style.borderColor = '#8b5cf6';
        moreBtn.innerHTML = '<i class="fas fa-chevron-up"></i><span>Less</span>';
    } else {
        moreDetailsPanel.classList.add('hidden');
        moreBtn.style.background = 'white';
        moreBtn.style.color = '#6b7280';
        moreBtn.style.borderColor = '#e5e7eb';
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

const CLIENT_RECEIPT_SCAN_ENABLED_KEY = 'client_receipt_scan_enabled';

function isClientReceiptScanningEnabled() {
    return localStorage.getItem(CLIENT_RECEIPT_SCAN_ENABLED_KEY) !== 'false';
}

function toggleClientReceiptScanning(enabled) {
    localStorage.setItem(CLIENT_RECEIPT_SCAN_ENABLED_KEY, enabled ? 'true' : 'false');
    console.log(`🧾 Client receipt scanning ${enabled ? 'enabled' : 'disabled'}`);
    showNotification(
        enabled ? '✅ Client receipt scanning enabled' : '⏸️ Client receipt scanning disabled (backend-only)',
        'success'
    );
}

function loadClientReceiptScanningState() {
    const toggle = document.getElementById('clientReceiptScanToggle');
    if (toggle) {
        toggle.checked = isClientReceiptScanningEnabled();
    }
}

// Helper function to format tags: lowercase and replace spaces with hyphens
function formatTags(tags) {
    if (!tags) return '';
    const normalized = String(tags)
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => t
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '')
        )
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
            let mimeType = 'image/webp';
            let base64Data = canvas.toDataURL(mimeType, quality);

            // Fallback to JPEG if WebP not supported
            if (!base64Data || base64Data === 'data:,') {
                mimeType = 'image/jpeg';
                base64Data = canvas.toDataURL(mimeType, quality);
            }

            const originalSize = file.size;
            const compressedSize = Math.round((base64Data.length * 3) / 4); // Approximate size

            const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
            console.log(`📦 Image compressed: ${(originalSize / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB (${compressionRatio}% reduction)`);

            resolve({
                base64: base64Data,
                filename: file.name.replace(/\.[^.]+$/, '.webp'), // Change extension to .webp
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
        const clientScanEnabled = isClientReceiptScanningEnabled();
        
        if (isGrocery) {
            if (clientScanEnabled) {
                // Client-side scan
                fields.receipt_scanned = false;
                fields.receipt_processing_status = 'processing';
                console.log('Grocery receipt - will be scanned client-side');
            } else {
                // Backend scan
                fields.receipt_scanned = false;
                fields.receipt_processing_status = 'pending';
                console.log('Grocery receipt - will be scanned server-side');
            }
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

        if (clientScanEnabled) {
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
            // Grocery receipt: backend will scan asynchronously.
            showNotification(`Receipt saved! (${(compressed.size / 1024).toFixed(0)}KB) - Scanning in background...`, 'success');

            // Best-effort kick to backend processor (safe if webhook is also configured)
            try {
                await kickoffBackendReceiptProcessing(expenseId);
            } catch (e) {
                console.warn('Backend receipt processing kickoff failed:', e?.message || e);
            }
        }
        
    } catch (error) {
        console.error('Error uploading receipt:', error);
        hideScanningSpinner();
        showNotification('Error: ' + error.message, 'error');
    }
}

async function kickoffBackendReceiptProcessing(expenseId) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    if (!expenseId) return;

    const endpoint = `${SUPABASE_URL}/functions/v1/process-receipt`;
    await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ expenseId })
    }).catch(() => null);
}

// Auto-extract items from a newly uploaded receipt (runs in background)
async function autoExtractReceiptItems(expenseId, base64Data, mimeType, expenseFields) {
    try {
        // Extract base64 from data URL if needed
        let cleanBase64 = base64Data;
        if (base64Data.startsWith('data:')) {
            const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                cleanBase64 = matches[2];
            }
        }
        
        if (!cleanBase64 || !mimeType.startsWith('image/')) {
            console.log('Cannot extract items: not a valid image');
            return;
        }
        
        showNotification('Extracting items from receipt...', 'info');
        
        const dataUrl = base64Data.startsWith('data:')
            ? base64Data
            : `data:${mimeType};base64,${cleanBase64}`;

        const extractedData = await extractReceiptDataWithOcrSpaceAndGemini(dataUrl);
        
        if (extractedData && extractedData.items && extractedData.items.length > 0) {
            // Determine purchase date from expense fields
            let purchaseDate = extractedData.date;
            if (!purchaseDate && expenseFields) {
                const year = expenseFields.Year || new Date().getFullYear();
                const month = String(expenseFields.Month || 1).padStart(2, '0');
                const day = String(expenseFields.Day || 1).padStart(2, '0');
                purchaseDate = `${year}-${month}-${day}`;
            }
            
            // Save items to ReceiptItems table
            for (const item of extractedData.items) {
                const unit = String(item.quantity_unit || '').trim();
                const baseName = String(item.description || item.raw_description || 'Unknown Item').trim() || 'Unknown Item';
                const itemName = unit && unit !== 'ea' ? `${baseName} (${unit})` : baseName;

                await supabasePost(RECEIPT_ITEMS_TABLE, {
                    expense_id: expenseId,
                    item_name: itemName,
                    quantity: item.quantity || 1,
                    unit_price: item.unit_price || 0,
                    total_price: item.total_price || 0,
                    store: extractedData.store || expenseFields?.Item || 'Unknown',
                    purchase_date: purchaseDate
                });
            }
            
            // Mark receipt as scanned
            await supabasePatch(TABLE_NAME, expenseId, { 
                receipt_scanned: true,
                receipt_processing_status: 'completed',
                receipt_error: null
            });
            
            showNotification(`Extracted ${extractedData.items.length} items from receipt!`, 'success');
        } else {
            showNotification('No items could be extracted from receipt', 'warning');
            // Still mark as scanned to avoid repeated attempts
            await supabasePatch(TABLE_NAME, expenseId, { 
                receipt_scanned: true,
                receipt_processing_status: 'completed',
                receipt_error: null
            });
        }
        
    } catch (error) {
        console.error('Auto-extract receipt items error:', error);
        // Don't show error to user - this is background processing
        // They can manually process later via "Process Unscanned Receipts"
        console.log('Receipt will remain unscanned for later processing');
    }
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
            'receipt_processing_status': 'eq.failed'
        }, 100);
        // Filter to only grocery category expenses
        const groceryFailed = (failed || []).filter(expense => {
            const category = (expense.Category || '').toLowerCase();
            return category.includes('grocery') || category.includes('groceries');
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
        
        updateScanningSpinner('Manual retry...', 'Sending image to Gemini');

        const imgDataUrl = await compressReceiptImageToDataUrl(receiptUrl);
        const extractedData = normalizeReceiptExtractedData(await extractReceiptDataWithGeminiFromImage(imgDataUrl));

        if (!extractedData?.items || extractedData.items.length === 0) {
            throw new Error('No items found in receipt');
        }

        updateScanningSpinner('Saving items...', `Found ${extractedData.items.length} items`);

        // Save items to ReceiptItems table
        const year = expense.Year || new Date().getFullYear();
        const month = String(expense.Month || 1).padStart(2, '0');
        const day = String(expense.Day || 1).padStart(2, '0');
        const purchaseDate = extractedData.date || `${year}-${month}-${day}`;

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
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            updateScanningSpinner('Scanning receipt...', `Attempt ${attempt}/${maxRetries}`);
            console.log(`Receipt scan attempt ${attempt}/${maxRetries} for expense ${expenseId}`);

            let extractedData;
            if (attempt === 1) {
                extractedData = await extractReceiptDataWithOcrSpaceAndGemini(base64DataUrl);
            } else {
                updateScanningSpinner('Extracting items...', 'Sending image to Gemini');
                const imgDataUrl = await compressReceiptImageToDataUrl(base64DataUrl);
                extractedData = await extractReceiptDataWithGeminiFromImage(imgDataUrl);
            }
            
            extractedData = normalizeReceiptExtractedData(extractedData);

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
            } else {
                // No items found - not an error, just no items
                await supabasePatch(TABLE_NAME, expenseId, { 
                    receipt_scanned: true, 
                    receipt_processing_status: 'completed',
                    receipt_error: null
                });
                return { success: true, itemCount: 0 };
            }
            
        } catch (error) {
            console.error(`Scan attempt ${attempt} failed:`, error.message);
            lastError = error;
            
            // Check if it's a rate limit error
            const isRateLimit = error.message?.includes('rate limit') || 
                               error.message?.includes('Rate limit') ||
                               error.message?.includes('quota') ||
                               error.message?.includes('429');
            
            if (isRateLimit && attempt < maxRetries) {
                // Wait before retry on rate limit
                updateScanningSpinner('Rate limited...', `Waiting to retry (${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 3000 * attempt)); // Exponential backoff
            } else if (attempt < maxRetries) {
                // Short delay before retry for other errors
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    // All retries failed
    return { success: false, error: lastError?.message || 'Unknown error' };
}

// Receipt Tracker & Google Gemini OCR Integration
// API key is obfuscated to prevent automated scanning/revocation
const _gk = () => {
    return '';
};
const GEMINI_API_KEY = '';
const GEMINI_API_URL = '';

// Gemini API call with retry logic and rate limit handling
async function callGeminiWithRetry(requestBody, maxRetries = 3) {
    throw new Error('Gemini is handled server-side');
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

    for (const rawItem of extracted.items) {
        const item = rawItem && typeof rawItem === 'object' ? { ...rawItem } : {};
        const rawDesc = String(item.raw_description || item.description || '').trim();
        const descLower = rawDesc.toLowerCase();

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
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase credentials not configured');
    }

    const endpoint = `${SUPABASE_URL}/functions/v1/ocr-space`;
    const body = receiptDataUrlOrUrl && receiptDataUrlOrUrl.startsWith('data:')
        ? { base64Image: receiptDataUrlOrUrl }
        : { imageUrl: receiptDataUrlOrUrl };

    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(body)
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
        throw new Error(data?.error || `OCR proxy failed: ${resp.status}`);
    }

    const parsedText = data?.text || '';
    return parsedText;
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

async function extractReceiptDataWithGeminiFromOcrText(ocrText) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase credentials not configured');
    }

    const endpoint = `${SUPABASE_URL}/functions/v1/gemini-parse`;
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ ocrText })
    });

    const rawText = await resp.text().catch(() => '');
    const data = rawText ? safeJsonParse(rawText) : null;
    if (!resp.ok) {
        const errMsg = data?.error || `Gemini parse failed: ${resp.status}`;
        const snippet = data?.geminiText ? `\nGemini output (first 500 chars):\n${String(data.geminiText).slice(0, 500)}` : '';
        const bodySnippet = !data && rawText ? `\nResponse body (first 500 chars):\n${String(rawText).slice(0, 500)}` : '';
        throw new Error(`${errMsg}${snippet}${bodySnippet}`);
    }

    return data?.data || null;
}

async function extractReceiptDataWithGeminiFromImage(imageDataUrl) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase credentials not configured');
    }

    const endpoint = `${SUPABASE_URL}/functions/v1/gemini-parse`;
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ imageDataUrl })
    });

    const rawText = await resp.text().catch(() => '');
    const data = rawText ? safeJsonParse(rawText) : null;
    if (!resp.ok) {
        const errMsg = data?.error || `Gemini parse failed: ${resp.status}`;
        const snippet = data?.geminiText ? `\nGemini output (first 500 chars):\n${String(data.geminiText).slice(0, 500)}` : '';
        const bodySnippet = !data && rawText ? `\nResponse body (first 500 chars):\n${String(rawText).slice(0, 500)}` : '';
        throw new Error(`${errMsg}${snippet}${bodySnippet}`);
    }

    return data?.data || null;
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
        let receiptData;
        try {
            receiptData = await extractReceiptDataWithOcrSpaceAndGemini(dataUrl);
        } catch (e) {
            console.warn('OCR+Gemini failed, retrying with image parsing:', e?.message || e);
            updateScanningSpinner('Retrying...', 'Sending image to Gemini');
            const imgDataUrl = await compressReceiptImageToDataUrl(dataUrl);
            receiptData = await extractReceiptDataWithGeminiFromImage(imgDataUrl);
        }
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

        container.innerHTML = results.map(r => `
            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center">
                <div class="flex-1">
                    <div class="font-bold text-gray-800">${r.item_name}</div>
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
    const prompt = `Analyze this receipt image and extract the following information in JSON format:
{
  "store": "store/merchant name",
  "date": "YYYY-MM-DD format",
  "total": numeric total amount,
  "items": [
    {
      "description": "item name/description",
      "quantity": numeric quantity (default 1 if not shown),
      "unit_price": numeric unit price (0 if not shown),
      "total_price": numeric total price for this item
    }
  ]
}

Important:
- Extract ALL line items from the receipt
- For quantity, use 1 if not explicitly shown
- For prices, extract the actual numbers without currency symbols
- Return ONLY valid JSON, no markdown or explanations`;

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096
        }
    };

    try {
        // Use the retry helper for better error handling
        const result = await callGeminiWithRetry(requestBody);
        const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textResponse) return null;

        // Clean up JSON
        let jsonStr = textResponse.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
        jsonStr = jsonStr.trim();

        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('extractReceiptDataWithGemini error:', error);
        throw error; // Re-throw so caller can handle
    }
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
    } catch (error) {
        console.log('Could not load fixed expenses:', error);
        allFixedExpenses = [];
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
        return `
                    <div class="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h4 class="font-bold text-gray-800">${fields.Item || 'Unnamed'}</h4>
                                <p class="text-sm text-gray-600">${fields.Category || 'N/A'}</p>
                                <p class="text-xs text-gray-500 mt-1">Starts: ${startMonth} ${fields.StartYear || 'N/A'}</p>
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
    const fields = {
        Item: document.getElementById('fixedItemName').value,
        Category: document.getElementById('fixedCategory').value,
        Amount: parseFloat(document.getElementById('fixedAmount').value),
        LLC: document.getElementById('fixedLLC').value,
        StartYear: parseInt(document.getElementById('fixedStartYear').value),
        StartMonth: document.getElementById('fixedStartMonth').value
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
    closeAllModalsExcept('aiInsightsModal');
    document.getElementById('aiInsightsModal').classList.add('active');
    generateAIInsights();
}

function closeAIInsights() {
    document.getElementById('aiInsightsModal').classList.remove('active');
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

    // Load client receipt scanning toggle state
    loadClientReceiptScanningState();
    
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
    loadClientReceiptScanningState();
    scheduleDailyRefresh();
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
    } else {
        alert('Please provide both Supabase URL and Key.');
    }
}
