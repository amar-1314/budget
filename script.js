console.log('🎬 SCRIPT STARTING TO LOAD...');

// Airtable Configuration - Multiple storage methods for reliability
const TABLE_NAME = 'Budget';
const PAYMENTS_TABLE = 'Payments';
const PROFILES_TABLE = 'Profiles';
const FIXED_EXPENSES_TABLE = 'FixedExpenses';
const LLC_EXPENSES_TABLE = 'LLCEligibleExpenses';
const BUDGETS_TABLE = 'Budgets';

// Airtable credentials (deprecated - not used, Supabase only)
const BASE_ID = undefined;
const AIRTABLE_API_KEY = undefined;

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

// Try to get credentials from URL parameters first (works in private mode!)
const urlParams = new URLSearchParams(window.location.search);

// Supabase Configuration (Supabase-only mode)
let SUPABASE_URL = urlParams.get('supabase_url') || localStorage.getItem('supabase_url');
let SUPABASE_ANON_KEY = urlParams.get('supabase_key') || localStorage.getItem('supabase_anon_key');

// Feature flag for data source (read operations)
// 'airtable' or 'supabase' - defaults to 'supabase' for Supabase-only mode
let DATA_SOURCE = localStorage.getItem('data_source') || 'supabase';

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

// Supabase configuration already declared above at line 1667
// Just check if credentials are available
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    console.log('✅ Supabase credentials found');
    
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
}

// Realtime notification subscription
let realtimeChannel = null;

async function initializeRealtimeNotifications() {
    // Only set up if notifications are enabled
    if (localStorage.getItem('notifications_enabled') !== 'true') {
        console.log('📱 Notifications not enabled, skipping realtime setup');
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

        // Generate a unique device ID for this browser/device
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
            deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('device_id', deviceId);
        }

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

                    console.log('🔍 Device check:', {
                        currentDevice: deviceId,
                        lastExpenseDevice: lastExpenseDeviceId,
                        shouldNotify: lastExpenseDeviceId !== deviceId
                    });

                    // Only notify if it's from a different device/session
                    if (lastExpenseDeviceId !== deviceId) {
                        console.log('✅ Different device - triggering notification!');

                        // Show notification
                        if ('serviceWorker' in navigator && swRegistration) {
                            console.log('📱 Using Service Worker notification');
                            swRegistration.showNotification('💰 New Expense Added', {
                                body: `${newExpense.Item || 'Expense'} - $${(newExpense.Actual || 0).toFixed(2)}`,
                                icon: './icon-192.png',
                                badge: './icon-192.png',
                                tag: 'expense-notification',
                                requireInteraction: false,
                                vibrate: [200, 100, 200],
                                data: {
                                    url: './',
                                    expenseId: newExpense.id
                                }
                            }).then(() => {
                                console.log('✅ Notification shown successfully!');
                            }).catch(err => {
                                console.error('❌ Failed to show notification:', err);
                            });
                        } else if ('Notification' in window && Notification.permission === 'granted') {
                            console.log('📱 Using basic Notification API');
                            new Notification('💰 New Expense Added', {
                                body: `${newExpense.Item || 'Expense'} - $${(newExpense.Actual || 0).toFixed(2)}`,
                                icon: './icon-192.png',
                                tag: 'expense-notification'
                            });
                        } else {
                            console.warn('⚠️ Notification not available:', {
                                hasServiceWorker: 'serviceWorker' in navigator,
                                hasSwRegistration: !!swRegistration,
                                hasNotification: 'Notification' in window,
                                permission: Notification?.permission
                            });
                        }

                        // Reload data to show the new expense
                        loadData();
                    } else {
                        console.log('⏭️ Same device - skipping notification (self-prevention)');
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime notifications subscribed!');
                    showNotification('✅ Cross-device notifications active!', 'success');
                } else if (status === 'CHANNEL_ERROR') {
                    console.warn('⚠️ Realtime channel error - Cross-device notifications unavailable');
                    console.warn('💡 To fix: Enable Realtime in Supabase Dashboard → Database → Replication → Budget table');
                    showNotification('⚠️ Realtime not enabled in Supabase. Cross-device notifications disabled.', 'error');
                } else if (status === 'TIMED_OUT') {
                    console.warn('⏱️ Realtime connection timed out - Retrying...');
                } else if (status === 'CLOSED') {
                    console.log('🔌 Realtime connection closed');
                }
            });

    } catch (error) {
        console.warn('⚠️ Failed to set up realtime notifications:', error.message);
        console.warn('💡 Cross-device notifications will not work. Local notifications still available.');
        console.warn('💡 To fix: Enable Realtime in Supabase Dashboard → Database → Replication');
        // Don't show error notification to user - gracefully degrade
    }
}

let allExpenses = [];
let allPayments = [];
let currentReceiptData = null; // Store current receipt for editing
let charts = { pie: null, llc: null, line: null, categoryMonthly: null, contributionsMonthly: null, contributionCoverage: null, yearComparison: null, categoryTrend: null, contributionTrend: null };

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

            // Faster backoff: 500ms, 1s, 1.5s instead of 1s, 2s, 4s
            const delayMs = 500 * (attempt + 1);
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
async function supabaseGet(tableName, filters = {}, limit = null) {
    return await retryOperation(async () => {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Supabase credentials not configured');
        }

        let url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*`;

        // Add limit for large tables to prevent timeout
        // Budget table: limit to last 1000 records by default
        if (limit) {
            url += `&limit=${limit}`;
        } else if (tableName === TABLE_NAME) {
            // For Budget table, add default limit and order by id desc to get latest
            url += `&limit=1000&order=id.desc`;
        }

        // Add filters if provided
        if (Object.keys(filters).length > 0) {
            const filterParams = Object.entries(filters).map(([key, value]) =>
                `${key}=eq.${encodeURIComponent(value)}`
            ).join('&');
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

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Supabase GET error (${response.status}): ${error}`);
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

// Convert Airtable record format to Supabase format
function airtableToSupabase(record, tableName) {
    if (!record || !record.fields) return null;

    // Define allowed fields per table (exclude Airtable system fields)
    const allowedFields = {
        'Budget': ['Item', 'Category', 'Year', 'Month', 'Day', 'Budget', 'Actual', 'LLC',
            'AmarContribution', 'PriyaContribution', 'Tags', 'Notes', 'Receipt'],
        'Payments': ['Person', 'Amount', 'Description', 'Year', 'Month', 'Day',
            'PaymentType', 'FromExpense', 'Notes'],
        'Profiles': ['Person', 'Picture'],
        'FixedExpenses': ['Item', 'Category', 'Amount', 'LLC', 'StartYear', 'StartMonth'],
        'LLCEligibleExpenses': ['Item', 'Category'],
        'Budgets': ['Category', 'Year', 'Month', 'Amount', 'Recurring']
    };

    const allowed = allowedFields[tableName] || [];
    const data = { id: record.id };

    // Only copy allowed fields
    allowed.forEach(field => {
        if (record.fields.hasOwnProperty(field)) {
            let value = record.fields[field];

            // Handle attachment fields (convert to string URL)
            if (Array.isArray(value) && value.length > 0 && value[0].url) {
                value = value[0].url; // Take first attachment URL
            }

            data[field] = value;
        }
    });

    return data;
}

// Convert Supabase format to Airtable record format (for compatibility)
function supabaseToAirtable(supabaseRecord) {
    const fields = { ...supabaseRecord };
    
    // Parse Receipt field if it's a JSON string
    if (fields.Receipt && typeof fields.Receipt === 'string') {
        try {
            fields.Receipt = JSON.parse(fields.Receipt);
        } catch (e) {
            console.warn('Failed to parse Receipt field:', e);
        }
    }
    
    return {
        id: supabaseRecord.id,
        fields: fields
    };
}

// Get table name from Airtable table constant
function getTableNameForMigration(tableConstant) {
    const tableMap = {
        [TABLE_NAME]: 'Budget',
        [PAYMENTS_TABLE]: 'Payments',
        [PROFILES_TABLE]: 'Profiles',
        [FIXED_EXPENSES_TABLE]: 'FixedExpenses',
        [LLC_EXPENSES_TABLE]: 'LLCEligibleExpenses',
        [BUDGETS_TABLE]: 'Budgets'
    };
    return tableMap[tableConstant] || tableConstant;
}

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
    updateDataSourceLabel(); // Update data source label in menu
    loadData();
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
        'maxAmount',
        'filterMinAmount',
        'filterMaxAmount'
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

    // Pull-to-refresh functionality
    let touchStartY = 0;
    let touchEndY = 0;
    let isPulling = false;
    let pullDistance = 0;

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
    pullToRefreshIndicator.innerHTML = '<div style="text-align: center;"><div class="loading" style="width: 24px; height: 24px; border-width: 3px; margin: 0 auto 8px;"></div><div>Pull to refresh</div></div>';
    document.body.appendChild(pullToRefreshIndicator);

    document.addEventListener('touchstart', function (e) {
        if (window.scrollY === 0) {
            touchStartY = e.touches[0].clientY;
            isPulling = true;
        }
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (!isPulling) return;

        touchEndY = e.touches[0].clientY;
        pullDistance = touchEndY - touchStartY;

        if (pullDistance > 0 && window.scrollY === 0) {
            // Show indicator
            const translateY = Math.min(pullDistance * 0.5, 80);
            pullToRefreshIndicator.style.transform = `translateY(${translateY}px)`;

            if (pullDistance > 100) {
                pullToRefreshIndicator.innerHTML = '<div style="text-align: center;"><i class="fas fa-arrow-down" style="font-size: 24px; margin-bottom: 8px;"></i><div>Release to refresh</div></div>';
            } else {
                pullToRefreshIndicator.innerHTML = '<div style="text-align: center;"><div class="loading" style="width: 24px; height: 24px; border-width: 3px; margin: 0 auto 8px;"></div><div>Pull to refresh</div></div>';
            }
        }
    }, { passive: true });

    document.addEventListener('touchend', async function (e) {
        if (!isPulling) return;

        if (pullDistance > 100 && window.scrollY === 0) {
            // Trigger refresh
            pullToRefreshIndicator.innerHTML = '<div style="text-align: center;"><div class="loading" style="width: 24px; height: 24px; border-width: 3px; margin: 0 auto 8px;"></div><div>Refreshing...</div></div>';
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

                showNotification('Data refreshed successfully!', 'success');
            } catch (error) {
                showNotification('Failed to refresh data', 'error');
            }

            // Hide indicator
            setTimeout(() => {
                pullToRefreshIndicator.style.transform = 'translateY(0)';
                pullToRefreshIndicator.innerHTML = '<div style="text-align: center;"><div class="loading" style="width: 24px; height: 24px; border-width: 3px; margin: 0 auto 8px;"></div><div>Pull to refresh</div></div>';
            }, 500);
        } else {
            // Reset
            pullToRefreshIndicator.style.transform = 'translateY(0)';
        }

        isPulling = false;
        touchStartY = 0;
        touchEndY = 0;
        pullDistance = 0;
    }, { passive: true });
});

async function loadProfilePictures() {
    try {
        let data;

        if (DATA_SOURCE === 'supabase') {
            // Load from Supabase
            try {
                const profiles = await supabaseGet(PROFILES_TABLE);
                data = { records: profiles.map(supabaseToAirtable) };
            } catch (error) {
                console.log('Profiles table not found in Supabase - will be created on first upload');
                return;
            }
        } else {
            // Load from Airtable
            const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${PROFILES_TABLE}`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });

            if (!response.ok) {
                console.log('Profiles table not found - will be created on first upload');
                return;
            }

            data = await response.json();
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
    try {
        // Show loading in expenses list
        const expensesList = document.getElementById('expensesList');
        if (expensesList) {
            expensesList.innerHTML = '<div class="text-center py-12 text-gray-400"><div class="spinner mx-auto mb-4"></div><p>Loading expenses...</p></div>';
        }

        // Load data based on feature flag
        if (DATA_SOURCE === 'supabase') {
            // Load from Supabase
            try {
                const expensesData = await supabaseGet(TABLE_NAME);
                allExpenses = expensesData.map(supabaseToAirtable);

                try {
                    const paymentsData = await supabaseGet(PAYMENTS_TABLE);
                    allPayments = paymentsData.map(supabaseToAirtable);
                } catch (e) {
                    console.log('Payments table not found in Supabase - will be created on first payment');
                    allPayments = [];
                }
            } catch (error) {
                console.error('Error loading from Supabase:', error);
                showNotification('Error loading from Supabase: ' + error.message, 'error');
                throw error;
            }
        } else {
            // Load from Airtable (default)
            const expensesResponse = await fetchWithRetry(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });
            if (!expensesResponse.ok) throw new Error('Failed to fetch expenses');
            const expensesData = await expensesResponse.json();
            allExpenses = expensesData.records;

            // Load payments with retry
            try {
                const paymentsResponse = await fetchWithRetry(`https://api.airtable.com/v0/${BASE_ID}/${PAYMENTS_TABLE}`, {
                    headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
                });
                if (paymentsResponse.ok) {
                    const paymentsData = await paymentsResponse.json();
                    allPayments = paymentsData.records;
                }
            } catch (e) {
                console.log('Payments table not found - will be created on first payment');
                allPayments = [];
            }
        }

        await loadCategoryBudgets(); // Load budget definitions
        populateFilters();
        populateCategorySelector();
        populateCategoryDatalist();
        populateItemDatalist();
        populateTagsDatalist();
        updateTagFilterDropdown();
        populateFilterDropdowns(); // Populate new Filters tab dropdowns
        renderExpenses();
        renderPayments();
        updateStats();
        updateCharts();
        updateMismatchNotification();

        // Hide global loading overlay
        const overlay = document.getElementById('globalLoadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }

        showNotification('Data loaded successfully!', 'success');
    } catch (error) {
        console.error('Error:', error);

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
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    if (years.includes(currentYear)) yearSelector.value = currentYear;
    if (months.includes(currentMonth)) monthSelector.value = currentMonth;
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
                        <div class="expense-item"><span class="expense-label">Receipt:</span>${fields.Receipt && fields.Receipt.length > 0 ? `<button onclick="event.stopPropagation(); viewReceiptFromExpense('${expense.id}');" class="text-purple-600 hover:text-purple-800" title="View Receipt" style="background: none; border: none; cursor: pointer; padding: 0;"><i class="fas fa-receipt text-xl"></i></button>` : '<span class="text-gray-300"><i class="fas fa-receipt text-xl"></i></span>'}</div>
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
                        <div class="expense-item"><span class="expense-label">Receipt:</span>${fields.Receipt && fields.Receipt.length > 0 ? `<button onclick="event.stopPropagation(); viewReceiptFromExpense('${expense.id}');" class="text-purple-600 hover:text-purple-800" title="View Receipt" style="background: none; border: none; cursor: pointer; padding: 0;"><i class="fas fa-receipt text-xl"></i></button>` : '<span class="text-gray-300"><i class="fas fa-receipt text-xl"></i></span>'}</div>
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
    const expense = allExpenses.find(exp => exp.id === expenseId);
    if (!expense) return;

    // Show loading spinner briefly
    document.getElementById('expenseDetailContent').innerHTML = `
                <div class="text-center py-12">
                    <div class="loading mx-auto mb-4"></div>
                    <p class="text-gray-500">Loading details...</p>
                </div>
            `;
    document.getElementById('expenseDetailModal').classList.add('active');

    // Use setTimeout to allow modal animation to start
    setTimeout(() => {
        currentExpenseIdForDetail = expenseId;
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

        if (fields.Receipt && fields.Receipt.length > 0) {
            detailHTML += `
                     <div class="bg-gray-50 p-4 rounded mb-4">
                         <p class="text-xs text-gray-500 mb-2"><i class="fas fa-receipt mr-1"></i>Receipt</p>
                         <button onclick="viewReceiptFromExpense('${currentExpenseIdForDetail}');" class="btn-primary">
                             <i class="fas fa-image mr-2"></i>View Receipt
                         </button>
                     </div>
                 `;
        }

        document.getElementById('expenseDetailContent').innerHTML = detailHTML;
    }, 50); // Small delay for visual feedback
}

function closeExpenseDetailModal() {
    document.getElementById('expenseDetailModal').classList.remove('active');
    currentExpenseIdForDetail = null;
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

        // Create modal dynamically
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10002'; // Higher than other modals
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 100%; width: 95vw; max-height: 95vh; padding: 0; display: flex; flex-direction: column;">
                <div class="modal-header" style="position: sticky; top: 0; background: white; z-index: 1; border-bottom: 1px solid #e5e7eb; padding: 16px; flex-shrink: 0;">
                    <h2 class="modal-title" style="margin: 0; font-size: 18px;"><i class="fas fa-receipt mr-2"></i>Receipt</h2>
                    <button class="close-modal" onclick="this.closest('.modal').remove()" style="position: absolute; right: 16px; top: 16px;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="flex: 1; overflow: auto; padding: 16px; text-align: center; background: #f9fafb;">
                    <img src="${receiptUrl}" 
                         alt="Receipt" 
                         style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); background: white;"
                         onerror="this.parentElement.innerHTML='<p style=\\'color: #ef4444; padding: 20px;\\'>Error loading receipt image</p>'">
                </div>
                <div class="modal-footer" style="position: sticky; bottom: 0; background: white; border-top: 1px solid #e5e7eb; padding: 16px; display: flex; gap: 12px; flex-shrink: 0;">
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
function viewReceiptFromExpense(expenseId) {
    const expense = allExpenses.find(exp => exp.id === expenseId);
    if (expense && expense.fields.Receipt) {
        viewReceipt(expense.fields.Receipt);
    } else {
        showNotification('No receipt found for this expense', 'error');
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

    // Sum up budgets for categories in filtered month (including rollover)
    if (categoryBudgets[monthKey]) {
        Object.keys(categoryBudgets[monthKey]).forEach(cat => {
            const budgetInfo = categoryBudgets[monthKey][cat];
            if (budgetInfo && budgetInfo.amount > 0) {
                const baseBudget = budgetInfo.amount;
                // Add rollover from previous month
                const rollover = calculateRollover(cat, parseInt(selectedYear), selectedMonth);
                totalBudget += (baseBudget + rollover);
            }
        });
    }

    const totalActual = expenses.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const llcTotal = expenses.filter(exp => exp.fields.LLC === 'Yes').reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);
    const remaining = totalBudget - totalActual;

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

    // Calculate contributions (from expenses + standalone payments)
    // Filter payments by same year/month as expenses
    let filteredPayments = allPayments;
    if (selectedYear !== 'all') {
        filteredPayments = filteredPayments.filter(p => String(p.fields.Year) === selectedYear);
    }
    if (selectedMonth !== 'all') {
        filteredPayments = filteredPayments.filter(p => p.fields.Month === selectedMonth);
    }

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
    const amarRemaining = amarBaseRemaining >= 0
        ? amarBaseRemaining - amarRentalIncome
        : amarBaseRemaining + amarRentalIncome;
    const priyaRemaining = priyaBaseRemaining >= 0
        ? priyaBaseRemaining - priyaRentalIncome
        : priyaBaseRemaining + priyaRentalIncome;
    const amarContribPercent = amarShare > 0 ? (amarContribTotal / amarShare) * 100 : 0;
    const priyaContribPercent = priyaShare > 0 ? (priyaContribTotal / priyaShare) * 100 : 0;

    // Update budget display with intelligent info
    const budgetEl = document.getElementById('totalBudget');
    if (totalBudget === 0) {
        budgetEl.innerHTML = `<span class="text-gray-400">$0.00</span><br><span class="text-xs text-gray-400">Set budgets</span>`;
    } else {
        budgetEl.textContent = `$${totalBudget.toFixed(2)}`;
    }

    document.getElementById('totalActual').textContent = `$${totalActual.toFixed(2)}`;
    document.getElementById('llcTotal').textContent = `$${llcTotal.toFixed(2)}`;
    document.getElementById('rentalIncomeTotal').textContent = `$${totalRentalIncome.toFixed(2)}`;

    // Update remaining: always show Budget - Spent
    const remainingEl = document.getElementById('remaining');
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

    // Update predicted total
    updatePredictedTotal();

    // Update Amar's stats
    document.getElementById('amarShare').textContent = `$${amarShare.toFixed(2)}`;
    document.getElementById('amarContribution').textContent = `$${amarContribTotal.toFixed(2)}`;
    document.getElementById('amarContributionPercent').textContent = amarContribPercent.toFixed(0);
    document.getElementById('amarRemaining').textContent = `$${amarRemaining.toFixed(2)}`;
    document.getElementById('amarContributionProgress').style.width = `${Math.min(amarContribPercent, 100)}%`;
    document.getElementById('amarRemainingProgress').style.width = `${Math.min(100 - amarContribPercent, 100)}%`;

    // Update Priya's stats
    document.getElementById('priyaShare').textContent = `$${priyaShare.toFixed(2)}`;
    document.getElementById('priyaContribution').textContent = `$${priyaContribTotal.toFixed(2)}`;
    document.getElementById('priyaContributionPercent').textContent = priyaContribPercent.toFixed(0);
    document.getElementById('priyaRemaining').textContent = `$${priyaRemaining.toFixed(2)}`;
    document.getElementById('priyaContributionProgress').style.width = `${Math.min(priyaContribPercent, 100)}%`;
    document.getElementById('priyaRemainingProgress').style.width = `${Math.min(100 - priyaContribPercent, 100)}%`;
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
    const itemName = itemInput.value.trim().toLowerCase();

    // Clear auto-filled category and hint if item name is cleared or too short
    if (itemName.length < 3) {
        if (categoryInput.dataset.autoFilled === 'true') {
            categoryInput.value = '';
            categoryInput.dataset.autoFilled = 'false';
            categoryInput.style.backgroundColor = '';
            categoryInput.style.borderColor = '';

            const existingHint = document.getElementById('categoryHint');
            if (existingHint) existingHint.remove();
        }
        return;
    }

    // If category was auto-filled but item changed, clear it first
    if (categoryInput.dataset.autoFilled === 'true' && categoryInput.dataset.lastItem !== itemName) {
        categoryInput.value = '';
        categoryInput.dataset.autoFilled = 'false';
        categoryInput.style.backgroundColor = '';
        categoryInput.style.borderColor = '';

        const existingHint = document.getElementById('categoryHint');
        if (existingHint) existingHint.remove();
    }

    // Build item-category frequency map from historical data
    const itemCategoryMap = {};

    allExpenses.forEach(exp => {
        if (exp.fields.Item && exp.fields.Category) {
            const item = exp.fields.Item.trim().toLowerCase();
            const category = exp.fields.Category.trim();

            if (!itemCategoryMap[item]) {
                itemCategoryMap[item] = {};
            }

            if (!itemCategoryMap[item][category]) {
                itemCategoryMap[item][category] = 0;
            }

            itemCategoryMap[item][category]++;
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
                categoryInput.parentElement.appendChild(hint);

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
                        categoryInput.parentElement.appendChild(hint);

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
        contributor
    });

    // Filter expenses
    let filtered = allExpenses.filter(exp => {
        // Year filter
        if (year && exp.fields.Year !== parseInt(year)) return false;

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

    // Calculate contributions with mortgage adjustments
    const amarMortgageContrib = expenses
        .filter(exp => exp.fields.Category === 'Mortgage')
        .reduce((sum, exp) => sum + (exp.fields.AmarContribution || 0), 0);
    const amarNonMortgageContrib = expenses
        .filter(exp => exp.fields.Category !== 'Mortgage')
        .reduce((sum, exp) => sum + (exp.fields.AmarContribution || 0), 0);
    const priyaContribFromExpenses = expenses.reduce((sum, exp) => sum + (exp.fields.PriyaContribution || 0), 0);

    // Get unique year-month combinations from filtered expenses
    const filteredPeriods = new Set(expenses.map(exp => `${exp.fields.Year}-${String(exp.fields.Month).padStart(2, '0')}`));

    // Calculate Priya's mortgage contributions for the filtered periods
    let priyaMortgageContribs = 0;
    filteredPeriods.forEach(period => {
        const [year, month] = period.split('-');
        const periodContrib = allPayments
            .filter(p =>
                String(p.fields.Year) === year &&
                String(p.fields.Month).padStart(2, '0') === month &&
                p.fields.Person === 'Priya' &&
                p.fields.PaymentType === 'PriyaMortgageContribution'
            )
            .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);
        priyaMortgageContribs += periodContrib;
    });

    // Add standalone payments for the filtered periods (excluding rental income)
    let amarStandalonePayments = 0;
    let priyaStandalonePayments = 0;
    filteredPeriods.forEach(period => {
        const [year, month] = period.split('-');
        amarStandalonePayments += allPayments
            .filter(p =>
                !p.fields.FromExpense &&
                String(p.fields.Year) === year &&
                String(p.fields.Month).padStart(2, '0') === month &&
                p.fields.Person === 'Amar' &&
                p.fields.PaymentType !== 'RentalIncome'
            )
            .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);

        priyaStandalonePayments += allPayments
            .filter(p =>
                !p.fields.FromExpense &&
                String(p.fields.Year) === year &&
                String(p.fields.Month).padStart(2, '0') === month &&
                p.fields.Person === 'Priya' &&
                p.fields.PaymentType !== 'PriyaMortgageContribution' &&
                p.fields.PaymentType !== 'RentalIncome'
            )
            .reduce((sum, p) => sum + (p.fields.Amount || 0), 0);
    });

    // Apply adjustment
    const amarAdjustedMortgage = Math.max(0, amarMortgageContrib - priyaMortgageContribs);
    const amarTotal = amarNonMortgageContrib + amarAdjustedMortgage + amarStandalonePayments;
    const priyaTotal = priyaContribFromExpenses + priyaMortgageContribs + priyaStandalonePayments;

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
        const resultsDiv = document.getElementById('filterResults');

        console.log('  Element availability:', {
            filterYear: filterYear ? '✅ EXISTS' : '❌ NULL',
            filterContributor: filterContributor ? '✅ EXISTS' : '❌ NULL',
            resultsDiv: resultsDiv ? '✅ EXISTS' : '❌ NULL'
        });
        console.log('');

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

function openAddExpenseModal() {
    closeAllModalsExcept('expenseModal');
    document.getElementById('modalTitle').textContent = 'Add Expense';
    document.getElementById('expenseForm').reset();
    document.getElementById('recordId').value = '';
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentDay = now.getDate();
    document.getElementById('month').value = currentMonth;
    document.getElementById('day').value = currentDay;
    currentReceiptData = null;
    document.getElementById('receiptFile').value = '';
    document.getElementById('currentReceipt').style.display = 'none';
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

function openContributionModal(person) {
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

    const recordId = document.getElementById('paymentRecordId').value;
    const paymentType = document.getElementById('contributionPaymentType').value;
    const person = document.getElementById('contributionPerson').value;
    const amount = parseFloat(document.getElementById('contributionAmount').value) || 0;
    const description = document.getElementById('contributionDescription').value || 'Payment';
    const year = parseInt(document.getElementById('contributionYear').value);
    const month = document.getElementById('contributionMonth').value;

    try {
        if (paymentType === 'RentalIncome' && !recordId) {
            // Create two separate payment records (50/50 split)
            const splitAmount = amount / 2;

            // Create Amar's rental income payment
            const amarFields = {
                Person: 'Amar',
                Amount: splitAmount,
                Description: description || 'Rental Income',
                Year: year,
                Month: month,
                PaymentType: 'RentalIncome'
            };

            const amarResponse = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${PAYMENTS_TABLE}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: amarFields })
            });
            if (!amarResponse.ok) throw new Error('Failed to save Amar\'s rental income');

            // Create Priya's rental income payment
            const priyaFields = {
                Person: 'Priya',
                Amount: splitAmount,
                Description: description || 'Rental Income',
                Year: year,
                Month: month,
                PaymentType: 'RentalIncome'
            };

            const priyaResponse = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${PAYMENTS_TABLE}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: priyaFields })
            });
            if (!priyaResponse.ok) throw new Error('Failed to save Priya\'s rental income');

            closeContributionModal();
            await loadData();
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

            const url = recordId
                ? `https://api.airtable.com/v0/${BASE_ID}/${PAYMENTS_TABLE}/${recordId}`
                : `https://api.airtable.com/v0/${BASE_ID}/${PAYMENTS_TABLE}`;
            const response = await fetch(url, {
                method: recordId ? 'PATCH' : 'POST',
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields })
            });
            if (!response.ok) throw new Error('Failed to save payment');

            closeContributionModal();
            await loadData();

            let message = recordId ? 'Payment updated!' : `${person}'s payment of $${amount.toFixed(2)} recorded!`;
            if (paymentType === 'PriyaMortgageContribution') {
                message = `Priya's mortgage contribution of $${amount.toFixed(2)} recorded (reduces Amar's net contribution)`;
            }
            showNotification(message, 'success');
        }
    } catch (error) {
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
    try {
        const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${PAYMENTS_TABLE}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
        });
        if (!response.ok) throw new Error('Failed to delete payment');
        await loadData();
        showNotification('Payment deleted!', 'success');
    } catch (error) {
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

    // Handle receipt
    document.getElementById('receiptFile').value = '';
    if (expense.fields.Receipt && expense.fields.Receipt.length > 0) {
        currentReceiptData = expense.fields.Receipt[0];
        document.getElementById('receiptFileName').textContent = currentReceiptData.filename;
        document.getElementById('receiptViewLink').href = currentReceiptData.url;
        document.getElementById('currentReceipt').style.display = 'block';
    } else {
        currentReceiptData = null;
        document.getElementById('currentReceipt').style.display = 'none';
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
    return tags.trim()
        .toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/,\s*/g, ',') // Normalize commas
        .split(',')
        .map(tag => tag.trim().replace(/\s+/g, '-'))
        .filter(tag => tag) // Remove empty tags
        .join(',');
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

        const fields = {
            Item: document.getElementById('itemName').value.trim(),
            Category: formatCategory(document.getElementById('category').value),
            Year: parseInt(document.getElementById('year').value),
            Month: document.getElementById('month').value,
            Day: parseInt(document.getElementById('day').value),
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
            const duplicates = findDuplicateExpenses(fields);
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
            fields.Receipt = [currentReceiptData];
            await saveExpenseToSupabase(recordId, fields);
        } else {
            // No receipt
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

    allExpenses.forEach(exp => {
        let matchScore = 0;
        let reasons = [];

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

        // If match score is high enough, consider it a potential duplicate
        // Score >= 5 means at least: same item + same amount, or same item + same date
        if (matchScore >= 5) {
            duplicates.push({
                expense: exp,
                matchScore: matchScore,
                reasons: reasons
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

        modal.innerHTML = `
                     <div class="modal-content" style="max-width: 600px;">
                         <div class="flex justify-between items-center mb-6">
                             <h2 class="text-2xl font-bold text-orange-600 flex items-center gap-2">
                                 <i class="fas fa-exclamation-triangle"></i>
                                 Possible Duplicate Expense
                             </h2>
                         </div>
                         
                         <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
                             <p class="text-sm text-yellow-800">
                                 <i class="fas fa-info-circle mr-2"></i>
                                 We found ${duplicates.length} similar expense${duplicates.length > 1 ? 's' : ''} that might be duplicate${duplicates.length > 1 ? 's' : ''}. 
                                 Please review before adding.
                             </p>
                         </div>
                         
                         <div class="mb-6">
                             <h3 class="font-bold text-gray-800 mb-3">New Expense:</h3>
                             <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                                 <div class="grid grid-cols-2 gap-2 text-sm">
                                     <div><span class="font-semibold">Item:</span> ${newExpense.Item}</div>
                                     <div><span class="font-semibold">Amount:</span> $${newExpense.Actual.toFixed(2)}</div>
                                     <div><span class="font-semibold">Date:</span> ${monthNames[newExpense.Month]} ${newExpense.Day}, ${newExpense.Year}</div>
                                     <div><span class="font-semibold">Category:</span> ${newExpense.Category || 'None'}</div>
                                 </div>
                             </div>
                         </div>
                         
                         <div class="mb-6">
                             <h3 class="font-bold text-gray-800 mb-3">Similar Existing Expense${duplicates.length > 1 ? 's' : ''}:</h3>
                             <div class="space-y-3">
                                 ${duplicates.map(dup => `
                                     <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                                         <div class="grid grid-cols-2 gap-2 text-sm mb-2">
                                             <div><span class="font-semibold">Item:</span> ${dup.expense.fields.Item}</div>
                                             <div><span class="font-semibold">Amount:</span> $${(dup.expense.fields.Actual || 0).toFixed(2)}</div>
                                             <div><span class="font-semibold">Date:</span> ${monthNames[dup.expense.fields.Month]} ${dup.expense.fields.Day || 1}, ${dup.expense.fields.Year}</div>
                                             <div><span class="font-semibold">Category:</span> ${dup.expense.fields.Category || 'None'}</div>
                                         </div>
                                         <div class="text-xs text-red-700 font-semibold">
                                             <i class="fas fa-check-circle mr-1"></i>
                                             Match: ${dup.reasons.join(', ')}
                                         </div>
                                     </div>
                                 `).join('')}
                             </div>
                         </div>
                         
                         <div class="flex gap-3">
                             <button id="confirmAddBtn" class="btn-primary flex-1">
                                 <i class="fas fa-check mr-2"></i>
                                 Add Anyway (Not a Duplicate)
                             </button>
                             <button id="cancelAddBtn" class="btn-secondary flex-1">
                                 <i class="fas fa-times mr-2"></i>
                                 Cancel
                             </button>
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

async function uploadReceiptAndSave(recordId, fields, file) {
    try {
        showNotification('Uploading receipt...', 'info');

        // Convert file to base64 for storage in database
        const reader = new FileReader();
        
        const base64Promise = new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const base64Data = await base64Promise;
        
        // Store receipt as base64 in the Receipt field
        // Format: [{ url: "data:image/...", filename: "..." }]
        fields.Receipt = JSON.stringify([{
            url: base64Data,
            filename: file.name,
            type: file.type,
            size: file.size
        }]);

        // Save expense with receipt data
        await saveExpenseToSupabase(recordId, fields);
        
        showNotification('Expense and receipt saved successfully!', 'success');
    } catch (error) {
        console.error('Error uploading receipt:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

function removeReceipt() {
    currentReceiptData = null;
    document.getElementById('receiptFile').value = '';
    document.getElementById('currentReceipt').style.display = 'none';
    document.getElementById('ocrScanSection').style.display = 'none';
}

// OCR Configuration
const OCR_API_KEY = 'K89301729188957';
const OCR_API_URL = 'https://api.ocr.space/parse/image';

// Handle receipt file selection
function handleReceiptFileChange() {
    const fileInput = document.getElementById('receiptFile');
    const ocrScanSection = document.getElementById('ocrScanSection');

    if (fileInput.files && fileInput.files.length > 0) {
        // Show OCR scan button when file is selected
        ocrScanSection.style.display = 'block';
    } else {
        // Hide OCR scan button when no file
        ocrScanSection.style.display = 'none';
    }
}

// Scan receipt with OCR
async function scanReceiptWithOCR() {
    const fileInput = document.getElementById('receiptFile');
    const scanBtn = document.getElementById('ocrScanBtn');

    if (!fileInput.files || fileInput.files.length === 0) {
        showNotification('Please select a receipt image first', 'error');
        return;
    }

    const file = fileInput.files[0];

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        showNotification('Please upload a valid image or PDF file', 'error');
        return;
    }

    // Validate file size (5MB limit for free tier)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('File size exceeds 5MB limit. Please use a smaller image.', 'error');
        return;
    }

    // Show loading state
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Scanning...';

    try {
        // Prepare form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('apikey', OCR_API_KEY);
        formData.append('language', 'eng');
        formData.append('OCREngine', '2'); // Engine 2 for receipts
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');
        formData.append('isTable', 'false');

        // Call OCR API
        const startTime = Date.now();
        const response = await fetch(OCR_API_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('OCR Result:', result);

        // Check for errors
        if (result.IsErroredOnProcessing) {
            throw new Error(result.ErrorMessage?.[0] || 'OCR processing failed');
        }

        // Extract text
        const extractedText = result.ParsedResults?.[0]?.ParsedText || 'No text extracted';
        const exitCode = result.ParsedResults?.[0]?.FileParseExitCode || 0;
        const errorMessage = result.ParsedResults?.[0]?.ErrorMessage;

        if (exitCode !== 1) {
            throw new Error(errorMessage || 'Failed to parse the image');
        }

        // Show results in modal
        displayOCRResults(file, extractedText, processingTime, result);

        showNotification('Receipt scanned successfully!', 'success');

    } catch (error) {
        console.error('OCR Error:', error);
        showNotification(`OCR failed: ${error.message}`, 'error');
    } finally {
        // Reset button
        scanBtn.disabled = false;
        scanBtn.innerHTML = '<i class="fas fa-magic mr-2"></i>Scan Receipt with OCR';
    }
}

// Display OCR results in modal
function displayOCRResults(file, extractedText, processingTime, rawResponse) {
    // Create image preview URL
    const imageUrl = URL.createObjectURL(file);

    // Update modal content
    document.getElementById('ocrReceiptPreview').src = imageUrl;
    document.getElementById('ocrProcessingTime').textContent = `${processingTime}s`;

    // Calculate confidence (if available)
    const confidence = rawResponse.ParsedResults?.[0]?.TextOrientation || 'N/A';
    document.getElementById('ocrConfidence').textContent = confidence;

    // Parse receipt into structured data
    const parsedData = parseReceipt(extractedText);
    console.log('Parsed Receipt Data:', parsedData);

    // Display parsed data in a nice format
    const parsedHTML = formatParsedReceiptHTML(parsedData);
    document.getElementById('ocrExtractedText').innerHTML = parsedHTML;

    // Show raw extracted text
    document.getElementById('ocrRawText').textContent = extractedText;

    // Show raw JSON
    document.getElementById('ocrRawJson').textContent = JSON.stringify(rawResponse, null, 2);

    // Open modal
    document.getElementById('ocrResultsModal').classList.add('active');
}

// Close OCR results modal
function closeOCRResultsModal() {
    document.getElementById('ocrResultsModal').classList.remove('active');

    // Clean up image URL
    const previewImg = document.getElementById('ocrReceiptPreview');
    if (previewImg.src.startsWith('blob:')) {
        URL.revokeObjectURL(previewImg.src);
    }
}

// Scan another receipt
function scanAnotherReceipt() {
    closeOCRResultsModal();
    // Focus back on file input
    document.getElementById('receiptFile').click();
}

// Parse receipt text into structured data - Universal parser for all store formats
function parseReceipt(ocrText) {
    const parsed = {
        store: '',
        date: '',
        time: '',
        items: [],
        subtotal: 0,
        discount: 0,
        tax: 0,
        total: 0,
        rawText: ocrText
    };

    const lines = ocrText.split('\n').map(line => line.trim());

    // Extract store name - comprehensive list
    const storePatterns = [
        /^(walmart|target|costco|sam's club|kroger|safeway|albertsons|publix|whole foods|trader joe's|aldi|food lion|giant|stop & shop|wegmans|cvs|walgreens|rite aid|dollar general|dollar tree|best buy|home depot|lowe's|meijer|heb|winco|sprouts)/im
    ];

    for (const pattern of storePatterns) {
        const storeMatch = ocrText.match(pattern);
        if (storeMatch) {
            parsed.store = storeMatch[1].charAt(0).toUpperCase() + storeMatch[1].slice(1).toLowerCase();
            break;
        }
    }

    // Fallback: get first capitalized words
    if (!parsed.store) {
        const firstLine = lines.slice(0, 5).join(' ');
        const nameMatch = firstLine.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
        if (nameMatch) {
            parsed.store = nameMatch[1];
        }
    }

    // Extract date (multiple formats)
    const datePatterns = [
        /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g,  // MM/DD/YY, DD/MM/YY
        /\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g      // YYYY/MM/DD
    ];

    for (const pattern of datePatterns) {
        const dateMatches = ocrText.match(pattern);
        if (dateMatches && dateMatches.length > 0) {
            parsed.date = dateMatches[dateMatches.length - 1];
            break;
        }
    }

    // Extract time
    const timePattern = /\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\b/i;
    const timeMatch = ocrText.match(timePattern);
    if (timeMatch) {
        parsed.time = timeMatch[1];
    }

    // Extract financial totals using flexible matching
    parsed.subtotal = extractAmount(lines, ['subtotal', 'sub total', 'sub-total']);
    parsed.tax = extractAmount(lines, ['tax', 'sales tax', 'state tax', 'hst', 'gst', 'pst']);
    parsed.discount = extractAmount(lines, ['discount', 'savings', 'you saved', 'total savings', 'coupon']);
    parsed.total = extractAmount(lines, ['total', 'amount due', 'balance', 'grand total', 'final total']);

    // Extract items using multi-strategy approach
    parsed.items = extractReceiptItems(ocrText);

    // Validation: if no total found, try to calculate from items
    if (parsed.total === 0 && parsed.items.length > 0) {
        parsed.total = parsed.items.reduce((sum, item) => sum + item.price, 0);
    }

    return parsed;
}

// Helper: Extract amount from lines using flexible keyword matching
function extractAmount(lines, keywords) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();

        // Check if line contains any of the keywords
        for (const keyword of keywords) {
            if (line.includes(keyword)) {
                // Strategy 1: Amount on same line (e.g., "TOTAL 26.94" or "TOTAL: $26.94")
                const sameLineMatch = lines[i].match(/[\$]?\s*(\d+[,.]?\d*\.?\d{2})\s*$/);
                if (sameLineMatch) {
                    return parseFloat(sameLineMatch[1].replace(',', ''));
                }

                // Strategy 2: Amount on next line
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1];
                    const nextLineMatch = nextLine.match(/^[\$]?\s*(\d+[,.]?\d*\.?\d{2})\s*$/);
                    if (nextLineMatch) {
                        return parseFloat(nextLineMatch[1].replace(',', ''));
                    }
                }

                // Strategy 3: Amount within next 3 lines (for split amounts)
                for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                    const amountMatch = lines[j].match(/^(\d+\.\d{2})$/);
                    if (amountMatch) {
                        return parseFloat(amountMatch[1]);
                    }
                }
            }
        }
    }
    return 0;
}

// Extract individual items from receipt - Universal multi-strategy parser
function extractReceiptItems(ocrText) {
    const lines = ocrText.split('\n').map(line => line.trim());

    // Find items section boundaries
    const bounds = findItemsBoundaries(lines);
    if (!bounds) {
        console.log('No items section found, trying full text parse');
        return parseItemsFromFullText(lines);
    }

    console.log(`Items section: lines ${bounds.start} to ${bounds.end}`);

    // Try multiple parsing strategies and use the one with most results
    const strategies = [
        parseItemsSameLineFormat,      // Format: "ITEM NAME 2.99"
        parseItemsSeparateLineFormat,  // Format: "ITEM NAME\n123456789 F\n2.99"
        parseItemsWithUPC,             // Format: "ITEM 123456789 F 2.99"
        parseItemsTableFormat          // Format: "ITEM    2.99" (tabular)
    ];

    let bestResult = [];
    for (const strategy of strategies) {
        const result = strategy(lines, bounds.start, bounds.end);
        if (result.length > bestResult.length) {
            bestResult = result;
        }
    }

    console.log(`Extracted ${bestResult.length} items using best strategy`);
    return bestResult;
}

// Find items section start and end
function findItemsBoundaries(lines) {
    let start = -1;
    let end = -1;

    // Look for section headers
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.match(/ITEMS? SOLD|ITEM\s+PRICE|DESCRIPTION|PRODUCT|QTY\s+DESCRIPTION/i)) {
            start = i + 1;
        }

        if (start !== -1 && line.match(/^(SUBTOTAL|SUB TOTAL|SUB-TOTAL|TOTAL|TAX|AMOUNT DUE)$/i)) {
            end = i;
            break;
        }
    }

    // If no explicit markers, estimate based on content
    if (start === -1) {
        // Look for first line with a price-like pattern
        for (let i = 5; i < lines.length; i++) {
            if (lines[i].match(/\d+\.\d{2}/)) {
                start = i - 2 >= 0 ? i - 2 : 0;
                break;
            }
        }
    }

    if (end === -1 && start !== -1) {
        // Look for totals section
        for (let i = start; i < lines.length; i++) {
            if (lines[i].match(/subtotal|total|tax|balance/i)) {
                end = i;
                break;
            }
        }
    }

    return (start !== -1 && end !== -1) ? { start, end } : null;
}

// Strategy 1: Items with price on same line
function parseItemsSameLineFormat(lines, start, end) {
    const items = [];

    for (let i = start; i < end; i++) {
        const line = lines[i];
        if (!line || line.length < 3) continue;

        // Match: "PRODUCT NAME 12.99" or "PRODUCT NAME $12.99"
        const match = line.match(/^(.+?)\s+\$?\s*(\d+\.\d{2})$/);
        if (match) {
            let name = match[1].trim();
            const price = parseFloat(match[2]);

            // Clean product name
            name = name.replace(/\d{12,14}\s*[A-Z]?/, '').trim();
            if (name.length > 2 && price > 0 && price < 10000) {
                items.push({ name, price, taxable: false });
            }
        }
    }

    return items;
}

// Strategy 2: Items with UPC and price on separate lines (Walmart format)
function parseItemsSeparateLineFormat(lines, start, end) {
    const items = [];
    const productNames = [];
    const prices = [];

    // Extract product names
    for (let i = start; i < end; i++) {
        const line = lines[i];
        const nextLine = i + 1 < end ? lines[i + 1] : '';

        if (!line || line.length < 2) continue;
        if (isSystemCode(line)) continue;
        if (line.match(/^[\d\s.]+$/)) continue;
        if (line.match(/^\d{1,2}\s*AT\s*\d/i)) continue;
        if (line.match(/^\d+\.\d+\s*lb/i)) continue;

        // Check for UPC code patterns
        const hasUPC = line.match(/\d{12,14}\s*[A-Z]$/);
        const nextIsUPC = nextLine.match(/^\d{12,14}\s*[A-Z]$/);

        if (hasUPC) {
            const name = line.replace(/\d{12,14}\s*[A-Z]$/, '').trim();
            if (name.length > 1) productNames.push(name);
        } else if (nextIsUPC) {
            productNames.push(line.trim());
            i++; // Skip UPC line
        }
    }

    // Extract prices
    let skipNext = false;
    for (let i = start; i < end; i++) {
        if (skipNext) {
            skipNext = false;
            continue;
        }

        const line = lines[i];
        const nextLine = i + 1 < end ? lines[i + 1] : '';

        // Full price with tax indicator
        if (line.match(/^(\d+\.\d{2})\s*[NT]?$/)) {
            const match = line.match(/^(\d+\.\d{2})/);
            prices.push(parseFloat(match[1]));
        }
        // Split price: "3" + ".97"
        else if (line.match(/^\d+$/) && nextLine.match(/^\.\d{2}$/)) {
            prices.push(parseFloat(line + nextLine));
            skipNext = true;
        }
        // Split price: "2" + "67"
        else if (line.match(/^\d{1,2}$/) && nextLine.match(/^\d{2}$/) && !nextLine.match(/^\d{12}/)) {
            prices.push(parseInt(line) + parseInt(nextLine) / 100);
            skipNext = true;
        }
    }

    // Match products with prices
    const minLength = Math.min(productNames.length, prices.length);
    for (let i = 0; i < minLength; i++) {
        items.push({
            name: productNames[i],
            price: prices[i],
            taxable: false
        });
    }

    return items;
}

// Strategy 3: Items with UPC on same line
function parseItemsWithUPC(lines, start, end) {
    const items = [];

    for (let i = start; i < end; i++) {
        const line = lines[i];
        if (!line || line.length < 5) continue;

        // Match: "PRODUCT NAME 123456789012 F 2.99"
        const match = line.match(/^(.+?)\s+\d{12,14}\s*[A-Z]?\s+(\d+\.\d{2})$/);
        if (match) {
            const name = match[1].trim();
            const price = parseFloat(match[2]);
            if (name.length > 2 && price > 0 && price < 10000) {
                items.push({ name, price, taxable: false });
            }
        }
    }

    return items;
}

// Strategy 4: Table format with spaces
function parseItemsTableFormat(lines, start, end) {
    const items = [];

    for (let i = start; i < end; i++) {
        const line = lines[i];
        if (!line || line.length < 10) continue;

        // Match: "PRODUCT NAME          2.99" (multiple spaces)
        const match = line.match(/^(.+?)\s{2,}(\d+\.\d{2})$/);
        if (match) {
            const name = match[1].trim();
            const price = parseFloat(match[2]);
            if (name.length > 2 && price > 0 && price < 10000 && !isSystemCode(name)) {
                items.push({ name, price, taxable: false });
            }
        }
    }

    return items;
}

// Fallback: Parse from full text when no boundaries found
function parseItemsFromFullText(lines) {
    const items = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.length < 5) continue;
        if (isSystemCode(line)) continue;

        // Try to find item-price pattern
        const match = line.match(/^([A-Za-z\s'-]+)\s+\$?(\d+\.\d{2})$/);
        if (match) {
            const name = match[1].trim();
            const price = parseFloat(match[2]);
            if (name.length > 2 && price > 0 && price < 10000) {
                items.push({ name, price, taxable: false });
            }
        }
    }

    return items.slice(0, 50); // Limit to 50 items max
}

// Helper: Check if line is a system code or metadata
function isSystemCode(line) {
    return line.match(/^(ST#|TC#|OP#|TE#|TR#|REF#|TRANS|AID|TERMINAL|APPR#|#|CARD|VISA|MASTERCARD|AMEX|DISCOVER)/i);
}

// Format parsed receipt as HTML table
function formatParsedReceiptHTML(parsedData) {
    let html = '<div class="parsed-receipt-container">';

    // Store and date info
    html += '<div class="receipt-header mb-4">';
    html += '<div class="grid grid-cols-3 gap-4">';
    html += `<div class="bg-purple-50 p-3 rounded-lg">
                         <div class="text-xs text-gray-600 mb-1">Store</div>
                         <div class="font-bold text-purple-700">${parsedData.store || 'Unknown'}</div>
                      </div>`;
    html += `<div class="bg-blue-50 p-3 rounded-lg">
                         <div class="text-xs text-gray-600 mb-1">Date</div>
                         <div class="font-bold text-blue-700">${parsedData.date || 'N/A'}</div>
                      </div>`;
    html += `<div class="bg-green-50 p-3 rounded-lg">
                         <div class="text-xs text-gray-600 mb-1">Time</div>
                         <div class="font-bold text-green-700">${parsedData.time || 'N/A'}</div>
                      </div>`;
    html += '</div></div>';

    // Items table
    if (parsedData.items.length > 0) {
        html += '<div class="receipt-items mb-4">';
        html += '<h4 class="font-semibold text-gray-700 mb-2"><i class="fas fa-shopping-cart mr-2"></i>Items Purchased</h4>';
        html += '<div class="overflow-x-auto">';
        html += '<table class="w-full text-sm">';
        html += '<thead class="bg-gray-100"><tr><th class="text-left p-2">Item</th><th class="text-right p-2">Price</th></tr></thead>';
        html += '<tbody>';

        parsedData.items.forEach((item, index) => {
            const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
            html += `<tr class="${rowClass}">
                                 <td class="p-2">${item.name}</td>
                                 <td class="p-2 text-right font-mono">$${item.price.toFixed(2)}</td>
                              </tr>`;
        });

        html += '</tbody></table>';
        html += '</div></div>';
    }

    // Totals summary
    html += '<div class="receipt-totals border-t-2 border-gray-300 pt-3">';
    if (parsedData.subtotal > 0) {
        html += `<div class="flex justify-between mb-2">
                             <span class="text-gray-600">Subtotal:</span>
                             <span class="font-mono">$${parsedData.subtotal.toFixed(2)}</span>
                          </div>`;
    }
    if (parsedData.discount > 0) {
        html += `<div class="flex justify-between mb-2 text-green-600">
                             <span>Discount:</span>
                             <span class="font-mono">-$${parsedData.discount.toFixed(2)}</span>
                          </div>`;
    }
    if (parsedData.tax > 0) {
        html += `<div class="flex justify-between mb-2">
                             <span class="text-gray-600">Tax:</span>
                             <span class="font-mono">$${parsedData.tax.toFixed(2)}</span>
                          </div>`;
    }
    html += `<div class="flex justify-between font-bold text-lg border-t pt-2">
                         <span>Total:</span>
                         <span class="text-purple-600 font-mono">$${parsedData.total.toFixed(2)}</span>
                      </div>`;
    html += '</div>';

    html += '</div>';
    return html;
}

async function saveExpenseToAirtable(recordId, fields) {
    try {
        // Filter out empty optional fields (Tags, Notes) to avoid Airtable errors if fields don't exist
        const cleanFields = { ...fields };
        if (!cleanFields.Tags || cleanFields.Tags.trim() === '') {
            delete cleanFields.Tags;
        }
        if (!cleanFields.Notes || cleanFields.Notes.trim() === '') {
            delete cleanFields.Notes;
        }

        // DUAL-WRITE: Save to Airtable
        let airtableError = null;
        try {
            const url = recordId ? `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}/${recordId}` : `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;
            const response = await fetch(url, {
                method: recordId ? 'PATCH' : 'POST',
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: cleanFields })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Airtable error:', errorData);
                airtableError = new Error(errorData.error?.message || 'Failed to save to Airtable');
                throw airtableError;
            }

            const airtableResult = await response.json();
            const savedRecordId = recordId || airtableResult.id;

            // DUAL-WRITE: Also save to Supabase if configured
            if (SUPABASE_URL && SUPABASE_ANON_KEY) {
                try {
                    const supabaseData = { ...cleanFields };
                    if (recordId) {
                        supabaseData.id = recordId;
                        await supabasePatch(TABLE_NAME, recordId, supabaseData);
                    } else {
                        supabaseData.id = savedRecordId; // Use same ID as Airtable for consistency
                        await supabasePost(TABLE_NAME, supabaseData);
                    }
                    console.log('✅ Saved to Supabase successfully');
                } catch (supabaseError) {
                    console.error('⚠️ Failed to save to Supabase (continuing with Airtable):', supabaseError);
                    // Don't throw - Airtable save succeeded, Supabase is secondary
                }
            }

            // Use Airtable record ID for subsequent operations
            recordId = savedRecordId;
        } catch (error) {
            // If Airtable fails, try Supabase as fallback
            if (SUPABASE_URL && SUPABASE_ANON_KEY) {
                try {
                    console.log('Airtable failed, trying Supabase fallback...');
                    const supabaseData = { ...cleanFields };
                    if (recordId) {
                        supabaseData.id = recordId;
                        await supabasePatch(TABLE_NAME, recordId, supabaseData);
                    } else {
                        const result = await supabasePost(TABLE_NAME, supabaseData);
                        recordId = result.id;
                    }
                    console.log('✅ Saved to Supabase (fallback) successfully');
                } catch (supabaseError) {
                    // Both failed
                    throw airtableError || supabaseError;
                }
            } else {
                throw error;
            }
        }

        // Create payment entries for visibility (but marked to avoid double counting)
        await createPaymentEntriesFromContributions(fields, recordId);

        // Auto-add category to budget manager for expense month if it doesn't exist
        if (fields.Category) {
            const expenseYear = fields.Year;
            const expenseMonth = fields.Month;
            const monthKey = `${expenseYear}-${expenseMonth}`;

            // Check if budget exists for this category in this month
            const budgetExists = categoryBudgets[monthKey] && categoryBudgets[monthKey][fields.Category];

            if (!budgetExists) {
                try {
                    const budgetData = {
                        Category: fields.Category,
                        Year: expenseYear,
                        Month: expenseMonth,
                        Amount: 0,
                        Recurring: 'No'
                    };

                    // DUAL-WRITE: Create budget record in both Airtable and Supabase
                    try {
                        // Save to Airtable
                        const airtableResponse = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${BUDGETS_TABLE}`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ fields: budgetData })
                        });

                        if (airtableResponse.ok) {
                            const airtableResult = await airtableResponse.json();
                            const budgetId = airtableResult.id;

                            // Also save to Supabase if configured
                            if (SUPABASE_URL && SUPABASE_ANON_KEY) {
                                try {
                                    await supabasePost(BUDGETS_TABLE, { ...budgetData, id: budgetId });
                                    console.log('✅ Budget saved to Supabase');
                                } catch (supabaseError) {
                                    console.error('⚠️ Failed to save budget to Supabase:', supabaseError);
                                }
                            }
                        }
                    } catch (airtableError) {
                        // Try Supabase as fallback
                        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
                            try {
                                await supabasePost(BUDGETS_TABLE, budgetData);
                                console.log('✅ Budget saved to Supabase (fallback)');
                            } catch (supabaseError) {
                                console.error('Failed to save budget:', supabaseError);
                            }
                        }
                    }

                    console.log(`Auto-added category "${fields.Category}" to budget manager for ${monthKey} with $0 budget`);
                    // Reload budgets to include the new one
                    await loadCategoryBudgets();
                } catch (error) {
                    console.error('Error auto-adding category to budget:', error);
                }
            }
        }

        closeModal();
        await loadData();
        showNotification(recordId ? 'Updated!' : 'Added!', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function saveExpenseToSupabase(recordId, fields) {
    try {
        // Filter out empty optional fields
        const cleanFields = { ...fields };
        if (!cleanFields.Tags || cleanFields.Tags.trim() === '') {
            delete cleanFields.Tags;
        }
        if (!cleanFields.Notes || cleanFields.Notes.trim() === '') {
            delete cleanFields.Notes;
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
            const result = await supabasePost(TABLE_NAME, cleanFields);
            savedRecordId = result.id || newId;
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
        
        // Send push notification for new expenses
        if (!recordId && localStorage.getItem('notifications_enabled') === 'true') {
            // Mark this device as the creator to prevent self-notification
            const deviceId = localStorage.getItem('device_id');
            if (deviceId) {
                sessionStorage.setItem('last_expense_device_id', deviceId);
            }

            sendPushNotification(
                '💰 New Expense Added',
                `${cleanFields.Item} - $${cleanFields.Actual.toFixed(2)}`
            );
        }
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
                    await supabasePost(PAYMENTS_TABLE, payment);
                    console.log('✅ Payment saved to Supabase');
                } catch (error) {
                    console.error('Error saving payment to Supabase:', error);
                    // Try Supabase as fallback
                    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
                        try {
                            await supabasePost(PAYMENTS_TABLE, payment.fields);
                            console.log('✅ Payment saved to Supabase (fallback)');
                        } catch (supabaseError) {
                            console.error('Failed to save payment to Supabase:', supabaseError);
                        }
                    }
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
        // Delete from Supabase
        await supabaseDelete(TABLE_NAME, id);
        console.log('✅ Deleted from Supabase successfully');

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

let allFixedExpenses = [];

async function loadFixedExpenses() {
    try {
        let data;

        if (DATA_SOURCE === 'supabase') {
            // Load from Supabase
            try {
                const fixedExpenses = await supabaseGet(FIXED_EXPENSES_TABLE);
                data = { records: fixedExpenses.map(supabaseToAirtable) };
            } catch (error) {
                console.log('Fixed expenses table not found in Supabase');
                allFixedExpenses = [];
                return;
            }
        } else {
            // Load from Airtable
            const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${FIXED_EXPENSES_TABLE}`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });

            if (!response.ok) {
                console.log('Fixed expenses table not found');
                allFixedExpenses = [];
                return;
            }

            data = await response.json();
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

        if (DATA_SOURCE === 'supabase') {
            // Load from Supabase
            try {
                const budgets = await supabaseGet(BUDGETS_TABLE);
                data = { records: budgets.map(supabaseToAirtable) };
            } catch (error) {
                console.log('Budgets table not found in Supabase - will be created on first budget');
                allBudgetRecords = [];
                categoryBudgets = {};
                return;
            }
        } else {
            // Load from Airtable
            const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${BUDGETS_TABLE}`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });

            if (!response.ok) {
                console.log('Budgets table not found - will be created on first budget');
                allBudgetRecords = [];
                categoryBudgets = {};
                return;
            }

            data = await response.json();
        }

        allBudgetRecords = data.records;

        // Convert to nested structure for easy lookup
        categoryBudgets = {};
        allBudgetRecords.forEach(record => {
            const { Category, Year, Month, Amount, Recurring } = record.fields;
            const monthKey = `${Year}-${Month}`;

            if (!categoryBudgets[monthKey]) {
                categoryBudgets[monthKey] = {};
            }

            categoryBudgets[monthKey][Category] = {
                id: record.id,
                amount: Amount || 0,
                recurring: Recurring === 'Yes'
            };
        });

        // Check if we need to auto-create budgets for current month from recurring
        await autoCreateRecurringBudgets();

        const sourceName = DATA_SOURCE === 'supabase' ? 'Supabase' : 'Airtable';
        console.log(`Loaded budgets from ${sourceName}:`, Object.keys(categoryBudgets).length, 'months');
    } catch (error) {
        console.error('Could not load category budgets:', error);
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
                        fields: {
                            Category: category,
                            Year: currentYear,
                            Month: currentMonth,
                            Amount: budgetInfo.amount,
                            Recurring: 'Yes'
                        }
                    });
                }
            });

            if (budgetsToCreate.length > 0) {
                try {
                    // Create all budgets in Airtable
                    for (const budget of budgetsToCreate) {
                        await fetch(`https://api.airtable.com/v0/${BASE_ID}/${BUDGETS_TABLE}`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(budget)
                        });
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
            // Update existing budget
            const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${BUDGETS_TABLE}/${budgetInfo.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: { Amount: budget }
                })
            });

            if (!response.ok) throw new Error('Failed to update budget');
        } else {
            // Create new budget
            const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${BUDGETS_TABLE}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: {
                        Category: category,
                        Year: selectedYear,
                        Month: selectedMonth,
                        Amount: budget,
                        Recurring: 'No'
                    }
                })
            });

            if (!response.ok) throw new Error('Failed to create budget');
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
            // Update existing budget
            const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${BUDGETS_TABLE}/${budgetInfo.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: { Recurring: isRecurring ? 'Yes' : 'No' }
                })
            });

            if (!response.ok) throw new Error('Failed to update recurring status');

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
        try {
            const budgetInfo = categoryBudgets[monthKey] && categoryBudgets[monthKey][category];

            if (budgetInfo && budgetInfo.id) {
                const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${BUDGETS_TABLE}/${budgetInfo.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
                });

                if (!response.ok) throw new Error('Failed to delete budget');

                await loadCategoryBudgets();
                renderBudgetTable();
                updateStats();
                showNotification(`Budget for ${category} removed`, 'success');
            }
        } catch (error) {
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
            const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${BUDGETS_TABLE}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: {
                        Category: trimmed,
                        Year: selectedYear,
                        Month: selectedMonth,
                        Amount: 0,
                        Recurring: 'No'
                    }
                })
            });

            if (!response.ok) throw new Error('Failed to create budget');

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

    try {
        const url = id
            ? `https://api.airtable.com/v0/${BASE_ID}/${FIXED_EXPENSES_TABLE}/${id}`
            : `https://api.airtable.com/v0/${BASE_ID}/${FIXED_EXPENSES_TABLE}`;

        const response = await fetch(url, {
            method: id ? 'PATCH' : 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        });

        if (!response.ok) throw new Error('Failed to save fixed expense');

        closeAddFixedExpenseForm();
        await loadFixedExpenses();
        renderFixedExpenses();
        showNotification(id ? 'Fixed expense updated!' : 'Fixed expense added!', 'success');
    } catch (error) {
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

    try {
        const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${FIXED_EXPENSES_TABLE}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
        });

        if (!response.ok) throw new Error('Failed to delete');

        await loadFixedExpenses();
        renderFixedExpenses();
        showNotification('Fixed expense deleted!', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

let allLLCExpenses = [];

async function loadLLCExpenses() {
    try {
        let data;

        if (DATA_SOURCE === 'supabase') {
            // Load from Supabase
            try {
                const llcExpenses = await supabaseGet(LLC_EXPENSES_TABLE);
                data = { records: llcExpenses.map(supabaseToAirtable) };
            } catch (error) {
                console.log('LLC expenses table not found in Supabase');
                allLLCExpenses = [];
                return;
            }
        } else {
            // Load from Airtable
            const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${LLC_EXPENSES_TABLE}`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });

            if (!response.ok) {
                console.log('LLC expenses table not found');
                allLLCExpenses = [];
                return;
            }

            data = await response.json();
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

    try {
        const url = id
            ? `https://api.airtable.com/v0/${BASE_ID}/${LLC_EXPENSES_TABLE}/${id}`
            : `https://api.airtable.com/v0/${BASE_ID}/${LLC_EXPENSES_TABLE}`;

        const response = await fetch(url, {
            method: id ? 'PATCH' : 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        });

        if (!response.ok) throw new Error('Failed to save LLC expense');

        closeAddLLCExpenseForm();
        await loadLLCExpenses();
        renderLLCExpenses();
        showNotification(id ? 'LLC expense updated!' : 'LLC expense added!', 'success');
    } catch (error) {
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

    try {
        const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${LLC_EXPENSES_TABLE}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
        });

        if (!response.ok) throw new Error('Failed to delete');

        await loadLLCExpenses();
        renderLLCExpenses();
        showNotification('LLC expense deleted!', 'success');
    } catch (error) {
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

    // Populate category dropdown
    const categories = [...new Set(allExpenses.map(e => e.fields.Category).filter(c => c))];
    const categorySelect = document.getElementById('searchCategory');
    categorySelect.innerHTML = '<option value="">All Categories</option>' +
        categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

function closeSmartSearch() {
    document.getElementById('smartSearchModal').classList.remove('active');
}

function performNaturalSearch() {
    const query = document.getElementById('naturalSearchInput').value.toLowerCase();

    if (!query.trim()) {
        showNotification('Please enter a search query', 'error');
        return;
    }

    let results = [...allExpenses];

    // Parse natural language query
    const filters = parseNaturalLanguage(query);

    // Apply filters
    if (filters.category) {
        results = results.filter(exp =>
            exp.fields.Category && exp.fields.Category.toLowerCase().includes(filters.category)
        );
    }

    if (filters.item) {
        results = results.filter(exp =>
            exp.fields.Item && exp.fields.Item.toLowerCase().includes(filters.item)
        );
    }

    if (filters.minAmount !== null) {
        results = results.filter(exp => (exp.fields.Actual || 0) >= filters.minAmount);
    }

    if (filters.maxAmount !== null) {
        results = results.filter(exp => (exp.fields.Actual || 0) <= filters.maxAmount);
    }

    if (filters.year) {
        results = results.filter(exp => exp.fields.Year === filters.year);
    }

    if (filters.month) {
        results = results.filter(exp => exp.fields.Month === filters.month);
    }

    if (filters.dateRange) {
        results = results.filter(exp => {
            const expDate = new Date(exp.fields.Year, exp.fields.Month - 1, exp.fields.Day || 1);
            return expDate >= filters.dateRange.start && expDate <= filters.dateRange.end;
        });
    }

    displaySearchResults(results, `Natural search: "${query}"`);
}

function parseNaturalLanguage(query) {
    const filters = {
        category: null,
        item: null,
        minAmount: null,
        maxAmount: null,
        year: null,
        month: null,
        dateRange: null
    };

    // Extract category (check all categories in your data)
    const allCategories = [...new Set(allExpenses.map(e => e.fields.Category).filter(c => c))];
    allCategories.forEach(cat => {
        if (query.includes(cat.toLowerCase())) {
            filters.category = cat.toLowerCase();
        }
    });

    // Also check common category keywords
    const categoryKeywords = {
        'grocery': 'grocery',
        'groceries': 'grocery',
        'gas': 'gas',
        'fuel': 'gas',
        'dining': 'dining',
        'restaurant': 'dining',
        'food': 'dining',
        'mortgage': 'mortgage',
        'rent': 'mortgage',
        'utilities': 'utilities',
        'utility': 'utilities',
        'healthcare': 'healthcare',
        'medical': 'healthcare',
        'shopping': 'shopping',
        'entertainment': 'entertainment'
    };

    Object.keys(categoryKeywords).forEach(keyword => {
        if (query.includes(keyword)) {
            filters.category = categoryKeywords[keyword];
        }
    });

    // Extract amount patterns - improved
    // "over $100" or "more than 100" or "greater than 100"
    const overMatch = query.match(/(?:over|more than|greater than|above)\s+\$?(\d+(?:\.\d{2})?)/i);
    if (overMatch) {
        filters.minAmount = parseFloat(overMatch[1]);
    }

    // "under $100" or "less than 100" or "below 100"
    const underMatch = query.match(/(?:under|less than|below)\s+\$?(\d+(?:\.\d{2})?)/i);
    if (underMatch) {
        filters.maxAmount = parseFloat(underMatch[1]);
    }

    // "between $50 and $100"
    const betweenMatch = query.match(/between\s+\$?(\d+(?:\.\d{2})?)\s+and\s+\$?(\d+(?:\.\d{2})?)/i);
    if (betweenMatch) {
        filters.minAmount = parseFloat(betweenMatch[1]);
        filters.maxAmount = parseFloat(betweenMatch[2]);
    }

    // Exact amount "$100" or "100 dollars"
    const exactMatch = query.match(/\$(\d+(?:\.\d{2})?)/);
    if (exactMatch && !overMatch && !underMatch && !betweenMatch) {
        const amount = parseFloat(exactMatch[1]);
        filters.minAmount = amount - 0.01;
        filters.maxAmount = amount + 0.01;
    }

    // Extract year
    const yearMatch = query.match(/\b(20\d{2})\b/);
    if (yearMatch) {
        filters.year = parseInt(yearMatch[1]);
    }

    // Extract month
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];
    monthNames.forEach((month, index) => {
        if (query.includes(month)) {
            filters.month = index + 1;
        }
    });

    // Extract time ranges
    const now = new Date();
    if (query.includes('last month')) {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        filters.dateRange = { start: lastMonth, end: lastMonthEnd };
    } else if (query.includes('this month')) {
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filters.dateRange = { start: thisMonth, end: now };
    } else if (query.includes('last 3 months')) {
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        filters.dateRange = { start: threeMonthsAgo, end: now };
    }

    // Extract item keywords (anything not matched above)
    // Skip if query starts with "all" (like "all utility" means category, not item)
    if (!query.startsWith('all ')) {
        const categoryKeywordsList = Object.keys(categoryKeywords);
        const stopWords = ['over', 'under', 'in', 'last', 'this', 'month', 'months', 'the', 'a', 'an',
            'less', 'than', 'more', 'between', 'and', 'below', 'above', 'greater', 'all',
            'expenses', 'expense', 'my', 'find', 'show', 'get'];

        const words = query.split(' ').filter(w =>
            !stopWords.includes(w) &&
            !w.startsWith('$') &&
            !categoryKeywordsList.includes(w) &&
            !monthNames.includes(w) &&
            !/^\d+$/.test(w)
        );

        if (words.length > 0) {
            filters.item = words[0];
        }
    }

    return filters;
}

function applyQuickFilter(filterType) {
    let results = [...allExpenses];
    let description = '';

    switch (filterType) {
        case 'dining':
            results = results.filter(exp =>
                exp.fields.Category && exp.fields.Category.toLowerCase().includes('dining')
            );
            description = 'Dining';
            break;

        case 'shopping':
            results = results.filter(exp =>
                exp.fields.Category && exp.fields.Category.toLowerCase().includes('shopping')
            );
            description = 'Shopping';
            break;

        case 'misc':
            results = results.filter(exp =>
                exp.fields.Category && exp.fields.Category.toLowerCase().includes('misc')
            );
            description = 'Misc';
            break;

        case 'over100':
            results = results.filter(exp => (exp.fields.Actual || 0) > 100);
            description = 'Over $100';
            break;

        case 'over500':
            results = results.filter(exp => (exp.fields.Actual || 0) > 500);
            description = 'Over $500';
            break;

        case 'llcOnly':
            results = results.filter(exp => exp.fields.LLC === 'Yes');
            description = 'LLC Expenses Only';
            break;
    }

    displaySearchResults(results, description);
}

function applyAdvancedFilters() {
    const minAmount = parseFloat(document.getElementById('filterMinAmount').value);
    const maxAmount = parseFloat(document.getElementById('filterMaxAmount').value);
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const category = document.getElementById('searchCategory').value;

    let results = [...allExpenses];
    let filterDesc = [];

    if (!isNaN(minAmount)) {
        results = results.filter(exp => (exp.fields.Actual || 0) >= minAmount);
        filterDesc.push(`Min: $${minAmount}`);
    }

    if (!isNaN(maxAmount)) {
        results = results.filter(exp => (exp.fields.Actual || 0) <= maxAmount);
        filterDesc.push(`Max: $${maxAmount}`);
    }

    if (startDate) {
        const start = new Date(startDate);
        results = results.filter(exp => {
            const expDate = new Date(exp.fields.Year, exp.fields.Month - 1, exp.fields.Day || 1);
            return expDate >= start;
        });
        filterDesc.push(`From: ${startDate}`);
    }

    if (endDate) {
        const end = new Date(endDate);
        results = results.filter(exp => {
            const expDate = new Date(exp.fields.Year, exp.fields.Month - 1, exp.fields.Day || 1);
            return expDate <= end;
        });
        filterDesc.push(`To: ${endDate}`);
    }

    if (category) {
        results = results.filter(exp => exp.fields.Category === category);
        filterDesc.push(`Category: ${category}`);
    }

    displaySearchResults(results, filterDesc.join(', ') || 'Advanced Filters');
}

function clearSearchFilters() {
    console.log('🔍 clearSearchFilters() called for Advanced Search tab');
    document.getElementById('naturalSearchInput').value = '';
    document.getElementById('filterMinAmount').value = '';
    document.getElementById('filterMaxAmount').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('searchCategory').value = '';

    document.getElementById('searchResults').innerHTML = `
                 <div class="text-center py-8 text-gray-400">
                     <i class="fas fa-search text-4xl mb-3"></i>
                     <p>Enter search criteria above to find expenses</p>
                 </div>
             `;
}

function displaySearchResults(results, description) {
    const container = document.getElementById('searchResults');

    if (results.length === 0) {
        container.innerHTML = `
                     <div class="text-center py-8 text-gray-400">
                         <i class="fas fa-inbox text-4xl mb-3"></i>
                         <p>No expenses found matching: ${description}</p>
                     </div>
                 `;
        return;
    }

    // Calculate total
    const total = results.reduce((sum, exp) => sum + (exp.fields.Actual || 0), 0);

    // Sort by date (newest first)
    results.sort((a, b) => {
        const dateA = new Date(a.fields.Year, a.fields.Month - 1, a.fields.Day || 1);
        const dateB = new Date(b.fields.Year, b.fields.Month - 1, b.fields.Day || 1);
        return dateB - dateA;
    });

    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    container.innerHTML = `
                 <div class="mb-4 p-4 bg-purple-50 rounded-lg">
                     <div class="flex justify-between items-center">
                         <div>
                             <h3 class="font-bold text-gray-800">Search Results: ${description}</h3>
                             <p class="text-sm text-gray-600">${results.length} expense${results.length !== 1 ? 's' : ''} found</p>
                         </div>
                         <div class="text-right">
                             <div class="text-2xl font-bold text-purple-600">$${total.toFixed(2)}</div>
                             <div class="text-xs text-gray-600">Total</div>
                         </div>
                     </div>
                 </div>
                 
                 <div class="space-y-2 max-h-96 overflow-y-auto">
                     ${results.map(exp => `
                         <div class="card p-4 hover:shadow-lg transition-shadow cursor-pointer" onclick="editExpense('${exp.id}')">
                             <div class="flex justify-between items-start">
                                 <div class="flex-1">
                                     <div class="font-semibold text-gray-800">${exp.fields.Item}</div>
                                     <div class="text-sm text-gray-600 mt-1">
                                         <span class="inline-flex items-center gap-1">
                                             <i class="fas fa-calendar text-gray-400"></i>
                                             ${monthNames[exp.fields.Month]} ${exp.fields.Day || 1}, ${exp.fields.Year}
                                         </span>
                                         ${exp.fields.Category ? `
                                             <span class="ml-3 inline-flex items-center gap-1">
                                                 <i class="fas fa-tag text-gray-400"></i>
                                                 ${exp.fields.Category}
                                             </span>
                                         ` : ''}
                                         ${exp.fields.LLC === 'Yes' ? `
                                             <span class="ml-3 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">LLC</span>
                                         ` : ''}
                                     </div>
                                 </div>
                                 <div class="text-right">
                                     <div class="text-lg font-bold text-purple-600">$${(exp.fields.Actual || 0).toFixed(2)}</div>
                                     ${exp.fields.Budget ? `<div class="text-xs text-gray-500">Budget: $${exp.fields.Budget.toFixed(2)}</div>` : ''}
                                 </div>
                             </div>
                         </div>
                     `).join('')}
                 </div>
             `;
}

function toggleDataSource() {
    const currentSource = DATA_SOURCE === 'supabase' ? 'Supabase' : 'Airtable';
    const newSource = DATA_SOURCE === 'supabase' ? 'airtable' : 'supabase';
    const newSourceName = newSource === 'supabase' ? 'Supabase' : 'Airtable';

    if (!confirm(`Switch data source from ${currentSource} to ${newSourceName}?\n\nThis will reload all data from ${newSourceName}.`)) {
        return;
    }

    // Check if Supabase is configured when switching to it
    if (newSource === 'supabase' && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
        alert('⚠️ Supabase credentials not configured!\n\nPlease configure Supabase in Settings first.');
        openSettings();
        return;
    }

    DATA_SOURCE = newSource;
    localStorage.setItem('data_source', DATA_SOURCE);

    // Update UI label
    const label = document.getElementById('currentDataSource');
    if (label) label.textContent = newSourceName;

    showNotification(`✅ Switched to ${newSourceName}`, 'success');
    loadData();
}

function updateDataSourceLabel() {
    const label = document.getElementById('currentDataSource');
    if (label) {
        label.textContent = DATA_SOURCE === 'supabase' ? 'Supabase' : 'Airtable';
    }
}

async function migrateDataFromAirtableToSupabase() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        alert('⚠️ Supabase credentials not configured!\n\nPlease configure Supabase in Settings first.');
        return;
    }

    if (!confirm('🚀 Migrate all data from Airtable to Supabase?\n\nThis will copy all records to Supabase. This may take a few minutes.')) {
        return;
    }

    console.log('🚀 MIGRATION STARTED');
    console.log('Supabase URL:', SUPABASE_URL);
    console.log('Airtable Base ID:', BASE_ID);
    showNotification('🔄 Starting migration...', 'info');

    // Helper function to migrate a single record with duplicate handling
    async function migrateRecord(tableName, record, recordType) {
        try {
            const data = airtableToSupabase(record, tableName);
            console.log(`Migrating ${recordType}:`, record.id, data);

            try {
                await supabasePost(tableName, data);
                console.log(`✅ Inserted ${recordType}:`, record.id);
                return { success: true, action: 'inserted' };
            } catch (postError) {
                console.log(`⚠️ Insert failed for ${recordType} ${record.id}:`, postError.message);

                // If duplicate or PGRST204, try updating
                if (postError.message.includes('duplicate') || postError.message.includes('PGRST204') || postError.message.includes('already exists')) {
                    try {
                        await supabasePatch(tableName, record.id, data);
                        console.log(`✅ Updated ${recordType}:`, record.id);
                        return { success: true, action: 'updated' };
                    } catch (patchError) {
                        console.error(`❌ Update failed for ${recordType} ${record.id}:`, patchError.message);
                        return { success: false, error: patchError.message };
                    }
                } else {
                    console.error(`❌ Unexpected error for ${recordType} ${record.id}:`, postError.message);
                    return { success: false, error: postError.message };
                }
            }
        } catch (e) {
            console.error(`❌ Error processing ${recordType} ${record.id}:`, e);
            return { success: false, error: e.message };
        }
    }

    try {
        let migratedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        const errors = [];

        // Migrate Expenses (Budget table)
        console.log('\n📊 Migrating Expenses...');
        try {
            const expensesResponse = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });
            if (expensesResponse.ok) {
                const expensesData = await expensesResponse.json();
                console.log(`Found ${expensesData.records.length} expenses in Airtable`);

                for (const record of expensesData.records) {
                    const result = await migrateRecord(TABLE_NAME, record, 'Expense');
                    if (result.success) {
                        if (result.action === 'inserted') migratedCount++;
                        else updatedCount++;
                    } else {
                        errorCount++;
                        errors.push(`Expense ${record.id}: ${result.error}`);
                    }
                }
            } else {
                console.error('Failed to fetch expenses from Airtable:', expensesResponse.status);
            }
        } catch (e) {
            console.error('Error fetching expenses:', e);
            errors.push(`Expenses fetch: ${e.message}`);
        }

        // Migrate Payments
        console.log('\n💰 Migrating Payments...');
        try {
            const paymentsResponse = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${PAYMENTS_TABLE}`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });
            if (paymentsResponse.ok) {
                const paymentsData = await paymentsResponse.json();
                console.log(`Found ${paymentsData.records.length} payments in Airtable`);

                for (const record of paymentsData.records) {
                    const result = await migrateRecord(PAYMENTS_TABLE, record, 'Payment');
                    if (result.success) {
                        if (result.action === 'inserted') migratedCount++;
                        else updatedCount++;
                    } else {
                        errorCount++;
                        errors.push(`Payment ${record.id}: ${result.error}`);
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching payments:', e);
            errors.push(`Payments fetch: ${e.message}`);
        }

        // Migrate Profiles
        console.log('\n👤 Migrating Profiles...');
        try {
            const profilesResponse = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${PROFILES_TABLE}`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });
            if (profilesResponse.ok) {
                const profilesData = await profilesResponse.json();
                console.log(`Found ${profilesData.records.length} profiles in Airtable`);

                for (const record of profilesData.records) {
                    const result = await migrateRecord(PROFILES_TABLE, record, 'Profile');
                    if (result.success) {
                        if (result.action === 'inserted') migratedCount++;
                        else updatedCount++;
                    } else {
                        errorCount++;
                        errors.push(`Profile ${record.id}: ${result.error}`);
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching profiles:', e);
            errors.push(`Profiles fetch: ${e.message}`);
        }

        // Migrate Fixed Expenses
        console.log('\n🔁 Migrating Fixed Expenses...');
        try {
            const fixedResponse = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${FIXED_EXPENSES_TABLE}`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });
            if (fixedResponse.ok) {
                const fixedData = await fixedResponse.json();
                console.log(`Found ${fixedData.records.length} fixed expenses in Airtable`);

                for (const record of fixedData.records) {
                    const result = await migrateRecord(FIXED_EXPENSES_TABLE, record, 'FixedExpense');
                    if (result.success) {
                        if (result.action === 'inserted') migratedCount++;
                        else updatedCount++;
                    } else {
                        errorCount++;
                        errors.push(`FixedExpense ${record.id}: ${result.error}`);
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching fixed expenses:', e);
            errors.push(`FixedExpenses fetch: ${e.message}`);
        }

        // Migrate LLC Expenses
        console.log('\n🏢 Migrating LLC Expenses...');
        try {
            const llcResponse = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${LLC_EXPENSES_TABLE}`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });
            if (llcResponse.ok) {
                const llcData = await llcResponse.json();
                console.log(`Found ${llcData.records.length} LLC expenses in Airtable`);

                for (const record of llcData.records) {
                    const result = await migrateRecord(LLC_EXPENSES_TABLE, record, 'LLCExpense');
                    if (result.success) {
                        if (result.action === 'inserted') migratedCount++;
                        else updatedCount++;
                    } else {
                        errorCount++;
                        errors.push(`LLCExpense ${record.id}: ${result.error}`);
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching LLC expenses:', e);
            errors.push(`LLCExpenses fetch: ${e.message}`);
        }

        // Migrate Budgets
        console.log('\n💵 Migrating Budgets...');
        try {
            const budgetsResponse = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${BUDGETS_TABLE}`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });
            if (budgetsResponse.ok) {
                const budgetsData = await budgetsResponse.json();
                console.log(`Found ${budgetsData.records.length} budgets in Airtable`);

                for (const record of budgetsData.records) {
                    const result = await migrateRecord(BUDGETS_TABLE, record, 'Budget');
                    if (result.success) {
                        if (result.action === 'inserted') migratedCount++;
                        else updatedCount++;
                    } else {
                        errorCount++;
                        errors.push(`Budget ${record.id}: ${result.error}`);
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching budgets:', e);
            errors.push(`Budgets fetch: ${e.message}`);
        }

        console.log('\n✅ MIGRATION COMPLETE');
        console.log(`Inserted: ${migratedCount}, Updated: ${updatedCount}, Errors: ${errorCount}`);

        if (errors.length > 0) {
            console.error('Migration errors:', errors);
        }

        alert(`✅ Migration Complete!\n\nInserted: ${migratedCount} records\nUpdated: ${updatedCount} records\nErrors: ${errorCount}\n\n${errors.length > 0 ? 'Check console for error details.\n\n' : ''}You can now switch to Supabase using the Data Source toggle.`);
        showNotification(`✅ Migrated ${migratedCount + updatedCount} records (${migratedCount} new, ${updatedCount} updated)`, 'success');
    } catch (error) {
        console.error('❌ MIGRATION FAILED:', error);
        alert('❌ Migration failed: ' + error.message + '\n\nCheck browser console for details.');
        showNotification('❌ Migration failed', 'error');
    }
}

function openSettings() {
    closeAllModalsExcept('settingsModal');
    document.getElementById('supabaseUrl').value = SUPABASE_URL || '';
    document.getElementById('supabaseAnonKey').value = SUPABASE_ANON_KEY || '';
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

async function migrateAirtableReceiptsToSupabase() {
    if (!confirm('This will migrate all Airtable receipts to Supabase format (base64). Continue?')) {
        return;
    }

    try {
        showNotification('Starting receipt migration...', 'info');
        
        // Load all expenses from Supabase
        const expenses = await supabaseGet(TABLE_NAME);
        let migratedCount = 0;
        let skippedCount = 0;
        
        for (const expense of expenses) {
            // Check if receipt exists
            if (expense.Receipt) {
                // If it's a string starting with http, it's an Airtable URL
                if (typeof expense.Receipt === 'string' && expense.Receipt.startsWith('http')) {
                    console.log(`Expense ${expense.id} has Airtable URL receipt: ${expense.Receipt.substring(0, 50)}...`);
                    skippedCount++;
                    continue;
                }
                
                // Try to parse as JSON
                if (typeof expense.Receipt === 'string') {
                    try {
                        const receiptData = JSON.parse(expense.Receipt);
                        
                        // Check if it's already in the correct format (base64)
                        if (Array.isArray(receiptData) && receiptData[0]?.url?.startsWith('data:')) {
                            skippedCount++;
                            continue; // Already migrated
                        }
                        
                        // If it's an Airtable format with URL
                        if (Array.isArray(receiptData) && receiptData[0]?.url?.startsWith('http')) {
                            console.log(`Expense ${expense.id} has Airtable receipt that needs manual re-upload`);
                            skippedCount++;
                            continue;
                        }
                    } catch (e) {
                        // Not JSON, might be a plain URL string
                        console.log(`Expense ${expense.id} has non-JSON receipt`);
                        skippedCount++;
                    }
                }
            } else {
                skippedCount++;
            }
        }
        
        showNotification(`Migration complete! Migrated: ${migratedCount}, Skipped: ${skippedCount}`, 'success');
        alert(`Receipt Migration Complete!\n\nMigrated: ${migratedCount}\nSkipped: ${skippedCount}\n\nNote: Airtable-hosted receipts cannot be automatically migrated. Please re-upload them manually.`);
    } catch (error) {
        console.error('Receipt migration error:', error);
        showNotification('Migration failed: ' + error.message, 'error');
    }
}

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
        
        if (notificationPermission === 'granted') {
            // Wait for service worker to be ready
            const registration = await navigator.serviceWorker.ready;
            
            showNotification('✅ Push notifications enabled! You will receive notifications even when the app is closed.', 'success');
            localStorage.setItem('notifications_enabled', 'true');
            
            // Set up realtime notifications for cross-device alerts
            await initializeRealtimeNotifications();

            // Test notification
            setTimeout(() => {
                sendPushNotification('🎉 Notifications Active', 'You will now receive alerts for new expenses!');
            }, 1000);
        } else {
            showNotification('Push notifications denied', 'error');
            localStorage.setItem('notifications_enabled', 'false');
        }
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        alert('Failed to enable notifications: ' + error.message);
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

function saveSettings() {
    SUPABASE_URL = document.getElementById('supabaseUrl').value;
    SUPABASE_ANON_KEY = document.getElementById('supabaseAnonKey').value;
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        localStorage.setItem('supabase_url', SUPABASE_URL);
        localStorage.setItem('supabase_anon_key', SUPABASE_ANON_KEY);
        showNotification('Settings saved!', 'success');
        closeSettingsModal();
        // Reload data with new credentials
        DATA_SOURCE = 'supabase';
        localStorage.setItem('data_source', 'supabase');
        loadData();
    } else {
        alert('Please provide both Supabase URL and Key.');
    }
}
