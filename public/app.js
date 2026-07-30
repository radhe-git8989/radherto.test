/* ==========================================================================
   RADHE RTO SERVICES - FRONTEND LOGIC (ENGLISH WITH DIRECT WHATSAPP)
   ========================================================================== */

const API_BASE = '/api';
let allCustomersCache = [];

// Initialize Dashboard & Authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAdminSession();
});

// ============================================================
// 0. ADMIN AUTHENTICATION (Username: ravi | Password: 1234)
// ============================================================

function handleAdminLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value;

    const btn = document.getElementById('login-submit-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Authenticating...</span>`;

    setTimeout(() => {
        if (user.toLowerCase() === 'ravi' && pass === '1234') {
            const sessionData = { username: 'ravi', loggedInAt: new Date().toISOString() };
            localStorage.setItem('rto_admin_session', JSON.stringify(sessionData));

            showToast('Login successful! Welcome, Ravi 👋', 'success');
            btn.disabled = false;
            btn.innerHTML = `<span>Login to Dashboard</span> <i class="fa-solid fa-arrow-right"></i>`;

            showAppPortal();
        } else {
            showToast('Invalid username or password! (Username: ravi, Password: 1234)', 'error');
            btn.disabled = false;
            btn.innerHTML = `<span>Login to Dashboard</span> <i class="fa-solid fa-arrow-right"></i>`;
        }
    }, 400);
}

function checkAdminSession() {
    const session = localStorage.getItem('rto_admin_session');
    if (session) {
        try {
            const data = JSON.parse(session);
            if (data && data.username === 'ravi') {
                showAppPortal();
                return;
            }
        } catch (e) {
            console.error('Session error:', e);
        }
    }

    // Not logged in -> Show Login Page
    document.getElementById('view-login').classList.remove('hidden');
    document.getElementById('app-portal').classList.add('hidden');
}

function showAppPortal() {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('app-portal').classList.remove('hidden');

    loadDashboardStats();
    loadUpcomingExpiriesAlerts();
    loadCustomers();
    loadVehicles();
}

function handleAdminLogout() {
    localStorage.removeItem('rto_admin_session');
    showToast('Successfully logged out.', 'info');

    document.getElementById('app-portal').classList.add('hidden');
    document.getElementById('view-login').classList.remove('hidden');
}

function toggleLoginPassword(iconEl) {
    const passInput = document.getElementById('login-password');
    if (passInput.type === 'password') {
        passInput.type = 'text';
        iconEl.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        passInput.type = 'password';
        iconEl.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// Navigation Tabs Switcher
function switchTab(tabName) {
    document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
    
    // Reset nav styles
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.className = 'nav-btn px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 text-slate-300 hover:bg-slate-700 hover:text-white transition';
    });

    const activeNav = document.getElementById(`nav-${tabName}`);
    const activeView = document.getElementById(`view-${tabName}`);

    if (activeNav && activeView) {
        activeNav.className = 'nav-btn px-4 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2 bg-indigo-600 text-white shadow-md';
        activeView.classList.remove('hidden');
    }

    if (tabName === 'dashboard') {
        loadDashboardStats();
        loadUpcomingExpiriesAlerts();
    } else if (tabName === 'customers') {
        loadCustomers();
    } else if (tabName === 'vehicles') {
        loadVehicles();
    }
}

// ============================================================
// 1. DASHBOARD STATS & ALERTS
// ============================================================

async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_BASE}/dashboard/stats`);
        const data = await res.json();
        if (data.success) {
            document.getElementById('stat-customers').innerText = data.stats.total_customers;
            document.getElementById('stat-vehicles').innerText = data.stats.total_vehicles;
            document.getElementById('stat-expiries-15').innerText = data.stats.upcoming_expiries_15_days;
            document.getElementById('stat-critical-expiries').innerText = data.stats.critical_expiries_3_days + data.stats.expired_count;
        }
    } catch (err) {
        console.error('Error fetching stats:', err);
    }
}

async function loadUpcomingExpiriesAlerts() {
    const daysLimit = document.getElementById('alert-days-filter').value || 15;
    const tbody = document.getElementById('alerts-table-body');
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading document expiry alerts...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE}/expiries/upcoming?days=${daysLimit}`);
        const data = await res.json();

        if (!data.success || data.alerts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400"><i class="fa-solid fa-circle-check text-emerald-400 text-lg mr-2"></i> Everything looks good! No document expiries in the next ${daysLimit} days.</td></tr>`;
            return;
        }

        let html = '';
        data.alerts.forEach(item => {
            let badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            let statusText = `${item.days_left} Days Left`;
            let rowBg = '';

            if (item.days_left < 0) {
                badgeClass = 'bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold';
                statusText = `Expired (${Math.abs(item.days_left)} days ago)`;
                rowBg = 'bg-rose-500/5';
            } else if (item.days_left <= 3) {
                badgeClass = 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-semibold';
                statusText = `URGENT (${item.days_left} Days Left)`;
                rowBg = 'bg-rose-500/5';
            }

            html += `
                <tr class="hover:bg-slate-700/40 transition ${rowBg}">
                    <td class="px-6 py-4 font-semibold text-white">${escapeHtml(item.customer_name)}</td>
                    <td class="px-6 py-4 font-mono text-xs text-indigo-300">${escapeHtml(item.mobile_number)}</td>
                    <td class="px-6 py-4 font-mono font-bold text-white">${escapeHtml(item.vehicle_number)}</td>
                    <td class="px-6 py-4"><span class="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-slate-700 text-indigo-300 border border-slate-600">${escapeHtml(item.document_type)}</span></td>
                    <td class="px-6 py-4 font-mono text-xs">${item.expiry_date}</td>
                    <td class="px-6 py-4 font-bold ${item.days_left <= 3 ? 'text-rose-400' : 'text-amber-400'}">${item.days_left} d</td>
                    <td class="px-6 py-4"><span class="px-3 py-1 rounded-full text-xs border ${badgeClass}">${statusText}</span></td>
                    <td class="px-6 py-4 text-center">
                        <button onclick="sendWhatsAppDirect('${item.mobile_number}', '${escapeHtml(item.customer_name)}', '${escapeHtml(item.vehicle_number)}', '${item.document_type}', '${item.expiry_date}', ${item.days_left})" 
                                class="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/30 transition mx-auto" title="Send Direct WhatsApp Message">
                            <i class="fa-brands fa-whatsapp text-sm"></i>
                            <span>Send WhatsApp</span>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-rose-400">Failed to load alerts. Error: ${err.message}</td></tr>`;
    }
}

// ============================================================
// DIRECT WHATSAPP SENDER FUNCTION (Opens WhatsApp App / Web)
// ============================================================
function sendWhatsAppDirect(mobile, name, vehicle, docType, expiry, daysLeft) {
    // Format mobile number with country code 91
    let cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length === 10) {
        cleanMobile = '91' + cleanMobile;
    }

    let statusText = daysLeft < 0 
        ? `has *EXPIRED* (${Math.abs(daysLeft)} days ago)` 
        : `will expire in *${daysLeft} days*`;

    let message = `🚨 *Radhe RTO Services - Document Expiry Alert* 🚨\n\nDear *${name}*,\nYour vehicle *${vehicle}* document (*${docType.toUpperCase()}*) ${statusText} on *${expiry}*.\n\nPlease contact us immediately for quick & hassle-free renewal!\n\n*Radhe RTO Services*\n📞 Call / WhatsApp: +91-${cleanMobile.slice(-10)}`;

    let waUrl = `https://api.whatsapp.com/send?phone=${cleanMobile}&text=${encodeURIComponent(message)}`;

    // Open WhatsApp directly in new browser tab / phone app
    window.open(waUrl, '_blank');

    showToast(`Opening WhatsApp for ${vehicle} (${name})...`, 'success');

    // Send log to server in background
    fetch(`${API_BASE}/reminders/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mobile_number: mobile,
            customer_name: name,
            vehicle_number: vehicle,
            document_type: docType,
            expiry_date: expiry,
            days_left: daysLeft
        })
    }).catch(err => console.error(err));
}

// ============================================================
// 2. CUSTOMER MANAGEMENT
// ============================================================

async function loadCustomers() {
    const search = document.getElementById('customer-search').value.trim();
    const tbody = document.getElementById('customers-table-body');

    try {
        const res = await fetch(`${API_BASE}/customers?search=${encodeURIComponent(search)}`);
        const data = await res.json();

        if (data.success) {
            allCustomersCache = data.customers;
            updateCustomerDropdowns();

            if (data.customers.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">No customers found. Click 'Add New Customer' to create one.</td></tr>`;
                return;
            }

            let html = '';
            data.customers.forEach(c => {
                html += `
                    <tr class="hover:bg-slate-700/40 transition">
                        <td class="px-6 py-4 text-slate-400">#${c.id}</td>
                        <td class="px-6 py-4 font-semibold text-white">${escapeHtml(c.name)}</td>
                        <td class="px-6 py-4 font-mono text-indigo-300">${escapeHtml(c.mobile_number)}</td>
                        <td class="px-6 py-4 text-slate-400">${escapeHtml(c.email || '-')}</td>
                        <td class="px-6 py-4 text-slate-400 text-xs">${escapeHtml(c.address || '-')}</td>
                        <td class="px-6 py-4"><span class="bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-md text-xs font-bold">${c.vehicle_count || 0} Vehicles</span></td>
                        <td class="px-6 py-4 text-center space-x-2">
                            <button onclick="editCustomer(${c.id})" class="text-slate-400 hover:text-indigo-400 transition" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="deleteCustomer(${c.id})" class="text-slate-400 hover:text-rose-400 transition" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }
    } catch (err) {
        console.error('Error loading customers:', err);
    }
}

function updateCustomerDropdowns() {
    const filterSelect = document.getElementById('vehicle-customer-filter');
    const modalSelect = document.getElementById('veh-customer-id');

    let filterHtml = `<option value="">All Customers</option>`;
    let modalHtml = `<option value="">-- Choose Owner --</option>`;

    allCustomersCache.forEach(c => {
        filterHtml += `<option value="${c.id}">${escapeHtml(c.name)} (${c.mobile_number})</option>`;
        modalHtml += `<option value="${c.id}">${escapeHtml(c.name)} (${c.mobile_number})</option>`;
    });

    if (filterSelect) filterSelect.innerHTML = filterHtml;
    if (modalSelect) modalSelect.innerHTML = modalHtml;
}

function openCustomerModal(id = null) {
    document.getElementById('customer-form').reset();
    document.getElementById('cust-id').value = '';
    document.getElementById('customer-modal-title').innerText = 'Add New Customer';

    if (id) {
        const cust = allCustomersCache.find(c => c.id === id);
        if (cust) {
            document.getElementById('cust-id').value = cust.id;
            document.getElementById('cust-name').value = cust.name;
            document.getElementById('cust-mobile').value = cust.mobile_number;
            document.getElementById('cust-email').value = cust.email || '';
            document.getElementById('cust-address').value = cust.address || '';
            document.getElementById('customer-modal-title').innerText = 'Edit Customer';
        }
    }

    document.getElementById('customer-modal').classList.remove('hidden');
}

function closeCustomerModal() {
    document.getElementById('customer-modal').classList.add('hidden');
}

async function saveCustomer(e) {
    e.preventDefault();
    const id = document.getElementById('cust-id').value;
    const body = {
        name: document.getElementById('cust-name').value.trim(),
        mobile_number: document.getElementById('cust-mobile').value.trim(),
        email: document.getElementById('cust-email').value.trim(),
        address: document.getElementById('cust-address').value.trim()
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/customers/${id}` : `${API_BASE}/customers`;

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeCustomerModal();
            loadCustomers();
            loadDashboardStats();
        } else {
            showToast(data.error || 'Failed to save customer', 'error');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function editCustomer(id) {
    openCustomerModal(id);
}

async function deleteCustomer(id) {
    if (!confirm('Are you sure you want to delete this customer? All linked vehicles will also be deleted.')) return;
    try {
        const res = await fetch(`${API_BASE}/customers/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'info');
            loadCustomers();
            loadVehicles();
            loadDashboardStats();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============================================================
// 3. VEHICLE MANAGEMENT
// ============================================================

let allVehiclesCache = [];

async function loadVehicles() {
    const search = document.getElementById('vehicle-search').value.trim();
    const vehicleType = document.getElementById('vehicle-type-filter').value;
    const customerId = document.getElementById('vehicle-customer-filter').value;

    const tbody = document.getElementById('vehicles-table-body');

    try {
        const queryParams = new URLSearchParams();
        if (search) queryParams.append('search', search);
        if (vehicleType) queryParams.append('vehicle_type', vehicleType);
        if (customerId) queryParams.append('customer_id', customerId);

        const res = await fetch(`${API_BASE}/vehicles?${queryParams.toString()}`);
        const data = await res.json();

        if (data.success) {
            allVehiclesCache = data.vehicles;

            if (data.vehicles.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">No vehicles found. Click 'Add New Vehicle' to create one.</td></tr>`;
                return;
            }

            let html = '';
            data.vehicles.forEach(v => {
                html += `
                    <tr class="hover:bg-slate-700/40 transition">
                        <td class="px-6 py-4 font-mono font-bold text-white">${escapeHtml(v.vehicle_number)}</td>
                        <td class="px-6 py-4"><span class="bg-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded-md font-semibold">${escapeHtml(v.vehicle_type)}</span></td>
                        <td class="px-6 py-4 text-slate-200">${escapeHtml(v.customer_name)} <span class="block text-xs font-mono text-indigo-400">${escapeHtml(v.mobile_number)}</span></td>
                        <td class="px-6 py-4">${formatExpiryBadge(v.puc_expiry)}</td>
                        <td class="px-6 py-4">${formatExpiryBadge(v.insurance_expiry)}</td>
                        <td class="px-6 py-4">${formatExpiryBadge(v.fitness_expiry)}</td>
                        <td class="px-6 py-4">${formatExpiryBadge(v.tax_expiry)}</td>
                        <td class="px-6 py-4 text-center space-x-2">
                            <button onclick="editVehicle(${v.id})" class="text-slate-400 hover:text-purple-400 transition" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="deleteVehicle(${v.id})" class="text-slate-400 hover:text-rose-400 transition" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
        }
    } catch (err) {
        console.error('Error loading vehicles:', err);
    }
}

function formatExpiryBadge(dateStr) {
    if (!dateStr) return `<span class="text-slate-500 text-xs">N/A</span>`;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(dateStr);
    expDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((expDate - today) / (1000 * 3600 * 24));
    
    if (diffDays < 0) {
        return `<span class="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs px-2 py-0.5 rounded font-mono font-bold">${dateStr} (Expired)</span>`;
    } else if (diffDays <= 15) {
        return `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2 py-0.5 rounded font-mono font-bold">${dateStr} (${diffDays}d)</span>`;
    } else {
        return `<span class="text-slate-300 font-mono text-xs">${dateStr}</span>`;
    }
}

function openVehicleModal(id = null) {
    document.getElementById('vehicle-form').reset();
    document.getElementById('veh-id').value = '';
    document.getElementById('vehicle-modal-title').innerText = 'Add New Vehicle';

    updateCustomerDropdowns();

    if (id) {
        const v = allVehiclesCache.find(item => item.id === id);
        if (v) {
            document.getElementById('veh-id').value = v.id;
            document.getElementById('veh-customer-id').value = v.customer_id;
            document.getElementById('veh-number').value = v.vehicle_number;
            document.getElementById('veh-type').value = v.vehicle_type || 'Car';
            document.getElementById('veh-puc').value = v.puc_expiry || '';
            document.getElementById('veh-insurance').value = v.insurance_expiry || '';
            document.getElementById('veh-fitness').value = v.fitness_expiry || '';
            document.getElementById('veh-tax').value = v.tax_expiry || '';
            document.getElementById('vehicle-modal-title').innerText = 'Edit Vehicle';
        }
    }

    document.getElementById('vehicle-modal').classList.remove('hidden');
}

function closeVehicleModal() {
    document.getElementById('vehicle-modal').classList.add('hidden');
}

async function saveVehicle(e) {
    e.preventDefault();
    const id = document.getElementById('veh-id').value;
    const body = {
        customer_id: document.getElementById('veh-customer-id').value,
        vehicle_number: document.getElementById('veh-number').value.trim().toUpperCase(),
        vehicle_type: document.getElementById('veh-type').value,
        puc_expiry: document.getElementById('veh-puc').value || null,
        insurance_expiry: document.getElementById('veh-insurance').value || null,
        fitness_expiry: document.getElementById('veh-fitness').value || null,
        tax_expiry: document.getElementById('veh-tax').value || null
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/vehicles/${id}` : `${API_BASE}/vehicles`;

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeVehicleModal();
            loadVehicles();
            loadDashboardStats();
            loadUpcomingExpiriesAlerts();
        } else {
            showToast(data.error || 'Failed to save vehicle', 'error');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function editVehicle(id) {
    openVehicleModal(id);
}

async function deleteVehicle(id) {
    if (!confirm('Are you sure you want to delete this vehicle record?')) return;
    try {
        const res = await fetch(`${API_BASE}/vehicles/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'info');
            loadVehicles();
            loadDashboardStats();
            loadUpcomingExpiriesAlerts();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function triggerCronJob() {
    try {
        const res = await fetch(`${API_BASE}/reminders/trigger-cron`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: [10, 2, 5, 12, 14, 25] })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`⏰ ${data.message}`, 'info');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Helper: Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    let bgClass = 'bg-slate-800 border-indigo-500 text-indigo-200';
    let icon = 'fa-circle-info text-indigo-400';
    if (type === 'success') {
        bgClass = 'bg-slate-800 border-emerald-500 text-emerald-200';
        icon = 'fa-circle-check text-emerald-400';
    } else if (type === 'error') {
        bgClass = 'bg-slate-800 border-rose-500 text-rose-200';
        icon = 'fa-triangle-exclamation text-rose-400';
    }

    toast.className = `flex items-center space-x-3 px-4 py-3 rounded-xl border shadow-xl ${bgClass} text-xs font-medium transition duration-300`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-base"></i> <span>${escapeHtml(message)}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
