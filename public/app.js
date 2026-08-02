/* ==========================================================================
   RADHE RTO SERVICES - FRONTEND LOGIC (ENGLISH WITH DIRECT WHATSAPP)
   ========================================================================== */

const API_BASE = '/api';
let allCustomersCache = [];

// Configured Admin Users (Add or edit login users & their WhatsApp numbers here)
const ADMIN_USERS = [
    { username: 'ravi', password: '1234', name: 'Ravi Nakum', phone: '9824582291' },
    { username: 'jignesh', password: '1234', name: 'Jignesh Chauhan', phone: '6351839895' }
];

// Initialize Dashboard & Authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAdminSession();
});

// ============================================================
// 0. ADMIN AUTHENTICATION (Multi-User Support)
// ============================================================

async function handleAdminLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-username').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;

    const btn = document.getElementById('login-submit-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Authenticating...</span>`;

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();

        if (data.success && data.user) {
            const sessionData = { 
                username: data.user.username, 
                name: data.user.name, 
                phone: data.user.phone || '',
                role: data.user.role || 'user',
                loggedInAt: new Date().toISOString() 
            };
            sessionStorage.setItem('rto_admin_session', JSON.stringify(sessionData));
            localStorage.removeItem('rto_admin_session');

            showToast(`Login successful! Welcome, ${data.user.name} 👋`, 'success');
            btn.disabled = false;
            btn.innerHTML = `<span>Login to Dashboard</span> <i class="fa-solid fa-arrow-right"></i>`;

            showAppPortal();
        } else {
            showToast(data.error || 'Invalid username or password!', 'error');
            btn.disabled = false;
            btn.innerHTML = `<span>Login to Dashboard</span> <i class="fa-solid fa-arrow-right"></i>`;
        }
    } catch(err) {
        showToast('Login error: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = `<span>Login to Dashboard</span> <i class="fa-solid fa-arrow-right"></i>`;
    }
}

function checkAdminSession() {
    sessionStorage.removeItem('rto_admin_session');
    localStorage.removeItem('rto_admin_session');

    // Not logged in -> Show Login Page
    document.getElementById('view-login').classList.remove('hidden');
    document.getElementById('app-portal').classList.add('hidden');
}

function getUserQueryParams() {
    const session = sessionStorage.getItem('rto_admin_session');
    if (!session) return '';
    try {
        const data = JSON.parse(session);
        const params = new URLSearchParams();
        if (data.username) params.append('user_id', data.username);
        if (data.role) params.append('user_role', data.role);

        const globalFilter = document.getElementById('global-user-filter');
        if (data.role === 'admin' && globalFilter && globalFilter.value) {
            params.append('filter_user', globalFilter.value);
        }
        return params.toString();
    } catch(e) {
        return '';
    }
}

function getLoggedInUser() {
    const session = sessionStorage.getItem('rto_admin_session');
    if (!session) return null;
    try {
        return JSON.parse(session);
    } catch(e) {
        return null;
    }
}

async function showAppPortal() {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('app-portal').classList.remove('hidden');

    const currentUser = getLoggedInUser();
    if (currentUser) {
        const userLabel = document.getElementById('admin-user-label');
        const userAvatar = document.getElementById('admin-user-avatar');
        if (userLabel) userLabel.textContent = `${currentUser.name}${currentUser.role === 'admin' ? ' (Super Admin)' : ''}`;
        if (userAvatar) userAvatar.textContent = (currentUser.name || currentUser.username).charAt(0).toUpperCase();

        const navUsers = document.getElementById('nav-users');
        const filterContainer = document.getElementById('super-admin-filter-container');

        if (currentUser.role === 'admin') {
            if (navUsers) navUsers.classList.remove('hidden');
            if (filterContainer) filterContainer.classList.remove('hidden');
            loadSuperAdminUserFilter();
        } else {
            if (navUsers) navUsers.classList.add('hidden');
            if (filterContainer) filterContainer.classList.add('hidden');
        }
    }

    loadDashboardStats();
    loadUpcomingExpiriesAlerts();
    loadCustomers();
    loadVehicles();
}

function handleAdminLogout() {
    sessionStorage.removeItem('rto_admin_session');
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
    } else if (tabName === 'users') {
        loadUsers();
    }
}

// ============================================================
// 1. DASHBOARD STATS & ALERTS
// ============================================================

async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_BASE}/dashboard/stats?${getUserQueryParams()}`);
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
        const res = await fetch(`${API_BASE}/expiries/upcoming?days=${daysLimit}&${getUserQueryParams()}`);
        const data = await res.json();

        if (!data.success || data.alerts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400"><i class="fa-solid fa-circle-check text-emerald-400 text-lg mr-2"></i> Everything looks good! No document expiries in the next ${daysLimit} days.</td></tr>`;
            return;
        }

        let html = '';
        const currentUser = getLoggedInUser();
        const isAdmin = currentUser && currentUser.role === 'admin';

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

            let addedByBadge = isAdmin ? `<span class="block text-[11px] font-medium text-amber-300 mt-0.5">By: ${escapeHtml(item.added_by || item.user_id)}</span>` : '';

            html += `
                <tr class="hover:bg-slate-700/40 transition ${rowBg}">
                    <td class="px-6 py-4 font-semibold text-white">${escapeHtml(item.customer_name)} ${addedByBadge}</td>
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
    // Format customer mobile number with country code 91
    let cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length === 10) {
        cleanMobile = '91' + cleanMobile;
    }

    let statusText = daysLeft < 0 
        ? `has *EXPIRED* (${Math.abs(daysLeft)} days ago)` 
        : `will expire in *${daysLeft} days*`;

    // Get logged-in admin's phone number & name
    let adminPhone = '9824582291';
    let adminName = 'Radhe RTO Services';
    const session = sessionStorage.getItem('rto_admin_session');
    if (session) {
        try {
            const data = JSON.parse(session);
            if (data.phone) adminPhone = data.phone;
            if (data.name) adminName = data.name;
        } catch(e) {}
    }

    let message = `🚨 *Radhe RTO Services - Document Expiry Alert* 🚨\n\nDear *${name}*,\nYour vehicle *${vehicle}* document (*${docType.toUpperCase()}*) ${statusText} on *${expiry}*.\n\nPlease contact us immediately for quick & hassle-free renewal!\n\n*${adminName}*\n📞 Call / WhatsApp: +91-${adminPhone}`;

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
        const res = await fetch(`${API_BASE}/customers?search=${encodeURIComponent(search)}&${getUserQueryParams()}`);
        const data = await res.json();

        if (data.success) {
            allCustomersCache = data.customers;
            updateCustomerDropdowns();

            if (data.customers.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">No customers found. Click 'Add New Customer' to create one.</td></tr>`;
                return;
            }

            const currentUser = getLoggedInUser();
            const isAdmin = currentUser && currentUser.role === 'admin';

            let html = '';
            data.customers.forEach(c => {
                let ownerBadge = isAdmin ? `<span class="block text-[11px] font-medium text-amber-300 mt-0.5">By: ${escapeHtml(c.added_by_name || c.user_id)}</span>` : '';
                html += `
                    <tr class="hover:bg-slate-700/40 transition">
                        <td class="px-6 py-4 text-slate-400">#${c.id}</td>
                        <td class="px-6 py-4 font-semibold text-white">${escapeHtml(c.name)} ${ownerBadge}</td>
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
    const name = document.getElementById('cust-name').value.trim();
    const mobile_number = document.getElementById('cust-mobile').value.trim();
    const email = document.getElementById('cust-email').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const currentUser = getLoggedInUser();

    const body = { name, mobile_number, email, address, user_id: currentUser ? currentUser.username : 'ravi' };

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
            const customerId = id || data.customer_id;

            // Auto-fetch & save vehicle if vehicle number was provided!
            if (vehNumber && customerId) {
                try {
                    const rtoRes = await fetch(`${API_BASE}/rto/fetch-vehicle?vehicle_number=${encodeURIComponent(vehNumber)}`);
                    const rtoData = await rtoRes.json();
                    
                    if (rtoData.success) {
                        await fetch(`${API_BASE}/vehicles`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                customer_id: customerId,
                                vehicle_number: vehNumber,
                                vehicle_type: rtoData.vehicle_type,
                                puc_expiry: rtoData.puc_expiry,
                                insurance_expiry: rtoData.insurance_expiry,
                                fitness_expiry: rtoData.fitness_expiry,
                                tax_expiry: rtoData.tax_expiry
                            })
                        });
                        showToast(`Customer & Vehicle ${vehNumber} (with RTO dates) saved!`, 'success');
                    }
                } catch(ve){}
            } else {
                showToast(data.message, 'success');
            }

            closeCustomerModal();
            loadCustomers();
            loadVehicles();
            loadDashboardStats();
            loadUpcomingExpiriesAlerts();
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

        const fullQuery = queryParams.toString() ? `${queryParams.toString()}&${getUserQueryParams()}` : getUserQueryParams();
        const res = await fetch(`${API_BASE}/vehicles?${fullQuery}`);
        const data = await res.json();

        if (data.success) {
            allVehiclesCache = data.vehicles;

            if (data.vehicles.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">No vehicles found. Click 'Add New Vehicle' to create one.</td></tr>`;
                return;
            }

            const currentUser = getLoggedInUser();
            const isAdmin = currentUser && currentUser.role === 'admin';

            let html = '';
            data.vehicles.forEach(v => {
                let ownerBadge = isAdmin ? `<span class="block text-[11px] font-medium text-amber-300 mt-0.5">By: ${escapeHtml(v.added_by_name || v.user_id)}</span>` : '';
                html += `
                    <tr class="hover:bg-slate-700/40 transition">
                        <td class="px-6 py-4 font-mono font-bold text-white">${escapeHtml(v.vehicle_number)} ${ownerBadge}</td>
                        <td class="px-6 py-4"><span class="bg-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded-md font-semibold">${escapeHtml(v.vehicle_type)}</span></td>
                        <td class="px-6 py-4 text-slate-200">${escapeHtml(v.customer_name)} <span class="block text-xs font-mono text-indigo-400">${escapeHtml(v.mobile_number)}</span></td>
                        <td class="px-6 py-4">${formatExpiryBadge(v.puc_expiry)}</td>
                        <td class="px-6 py-4">${formatExpiryBadge(v.insurance_expiry)}</td>
                        <td class="px-6 py-4">${formatExpiryBadge(v.fitness_expiry)}</td>
                        <td class="px-6 py-4">${formatExpiryBadge(v.tax_expiry)}</td>
                        <td class="px-6 py-4 text-center">
                            <div class="flex items-center justify-center space-x-2">
                                <button onclick="openRenewModal(${v.id})" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow transition flex items-center space-x-1" title="Renew Documents">
                                    <i class="fa-solid fa-arrows-rotate"></i>
                                    <span>Renew</span>
                                </button>
                                <button onclick="editVehicle(${v.id})" class="text-slate-400 hover:text-purple-400 transition p-1" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                                <button onclick="deleteVehicle(${v.id})" class="text-slate-400 hover:text-rose-400 transition p-1" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                            </div>
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

function cleanDateOnly(dateStr) {
    if (!dateStr) return '';
    const str = String(dateStr);
    if (str.includes('T')) return str.split('T')[0];
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return str;
}

function formatExpiryBadge(dateStr) {
    if (!dateStr) return `<span class="text-slate-500 text-xs">N/A</span>`;
    
    const displayDate = cleanDateOnly(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(dateStr);
    expDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((expDate - today) / (1000 * 3600 * 24));
    
    if (diffDays < 0) {
        return `<span class="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs px-2 py-0.5 rounded font-mono font-bold">${displayDate} (Expired)</span>`;
    } else if (diffDays <= 15) {
        return `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2 py-0.5 rounded font-mono font-bold">${displayDate} (${diffDays}d)</span>`;
    } else {
        return `<span class="text-slate-300 font-mono text-xs">${displayDate}</span>`;
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
    const currentUser = getLoggedInUser();

    const body = {
        customer_id: document.getElementById('veh-customer-id').value,
        vehicle_number: document.getElementById('veh-number').value.trim().toUpperCase(),
        vehicle_type: document.getElementById('veh-type').value,
        puc_expiry: document.getElementById('veh-puc').value || null,
        insurance_expiry: document.getElementById('veh-insurance').value || null,
        fitness_expiry: document.getElementById('veh-fitness').value || null,
        tax_expiry: document.getElementById('veh-tax').value || null,
        user_id: currentUser ? currentUser.username : 'ravi'
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

// ============================================================
// SUPER ADMIN USER MANAGEMENT & FILTER FUNCTIONS
// ============================================================
async function loadSuperAdminUserFilter() {
    const filterSelect = document.getElementById('global-user-filter');
    if (!filterSelect) return;

    try {
        const res = await fetch(`${API_BASE}/users`);
        const data = await res.json();
        if (data.success) {
            let html = `<option value="">All Users (Super Admin View)</option>`;
            data.users.forEach(u => {
                html += `<option value="${u.username}">${escapeHtml(u.name)} (@${u.username})</option>`;
            });
            filterSelect.innerHTML = html;
        }
    } catch(e){}
}

function onUserFilterChange() {
    loadDashboardStats();
    loadUpcomingExpiriesAlerts();
    loadCustomers();
    loadVehicles();
}

async function loadUsers() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading system users...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE}/users`);
        const data = await res.json();

        if (data.success) {
            if (data.users.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">No users found. Click 'Add New System User' to create one.</td></tr>`;
                return;
            }

            let html = '';
            data.users.forEach(u => {
                let roleBadge = u.role === 'admin' 
                    ? `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2.5 py-1 rounded-full font-bold">Super Admin</span>`
                    : `<span class="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2.5 py-1 rounded-full font-semibold">Normal User</span>`;

                let deleteBtn = u.username === 'ravi' 
                    ? `<span class="text-xs text-slate-500 font-mono">System Owner</span>`
                    : `<button onclick="deleteSystemUser(${u.id}, '${escapeHtml(u.username)}')" class="text-slate-400 hover:text-rose-400 transition" title="Delete User"><i class="fa-solid fa-trash-can"></i> Delete</button>`;

                html += `
                    <tr class="hover:bg-slate-700/40 transition">
                        <td class="px-6 py-4 text-slate-400">#${u.id}</td>
                        <td class="px-6 py-4 font-mono font-bold text-white">@${escapeHtml(u.username)}</td>
                        <td class="px-6 py-4 font-semibold text-slate-200">${escapeHtml(u.name)}</td>
                        <td class="px-6 py-4 font-mono text-xs text-indigo-300">${escapeHtml(u.phone || '-')}</td>
                        <td class="px-6 py-4">${roleBadge}</td>
                        <td class="px-6 py-4 text-center">${deleteBtn}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }
    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-rose-400">Error loading users: ${err.message}</td></tr>`;
    }
}

function openUserModal() {
    document.getElementById('user-form').reset();
    document.getElementById('user-modal').classList.remove('hidden');
}

function closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
}

async function saveSystemUser(e) {
    e.preventDefault();
    const username = document.getElementById('new-user-name').value.trim().toLowerCase();
    const password = document.getElementById('new-user-pass').value;
    const name = document.getElementById('new-user-fullname').value.trim();
    const phone = document.getElementById('new-user-phone').value.trim();
    const role = document.getElementById('new-user-role').value;

    try {
        const res = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, name, phone, role })
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            closeUserModal();
            loadUsers();
            loadSuperAdminUserFilter();
        } else {
            showToast(data.error || 'Failed to create user', 'error');
        }
    } catch(err) {
        showToast(err.message, 'error');
    }
}

async function deleteSystemUser(id, username) {
    if (!confirm(`Are you sure you want to delete user '@${username}'?`)) return;
    try {
        const res = await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'info');
            loadUsers();
            loadSuperAdminUserFilter();
        } else {
            showToast(data.error || 'Failed to delete user', 'error');
        }
    } catch(err) {
        showToast(err.message, 'error');
    }
}
function openRenewModal(id) {
    const vehicle = allVehiclesCache.find(v => v.id === id);
    if (!vehicle) {
        showToast('Vehicle details not found!', 'error');
        return;
    }

    document.getElementById('renew-form').reset();
    document.getElementById('renew-veh-id').value = vehicle.id;
    document.getElementById('renew-vehicle-info').innerText = `${vehicle.vehicle_number} (${vehicle.customer_name})`;
    
    // Default all checkboxes to unchecked
    document.getElementById('renew-doc-all').checked = false;
    document.querySelectorAll('.renew-doc-check').forEach(cb => cb.checked = false);

    document.getElementById('renew-modal').classList.remove('hidden');
}

function closeRenewModal() {
    document.getElementById('renew-modal').classList.add('hidden');
}

function toggleAllRenewDocs(selectAllCb) {
    const checked = selectAllCb.checked;
    document.querySelectorAll('.renew-doc-check').forEach(cb => cb.checked = checked);
}

function setRenewDateToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const formatted = `${year}-${month}-${day}`;
    
    const input = document.getElementById('renew-date');
    if (input) {
        input.value = formatted;
    }
}

async function saveRenewDocuments(e) {
    e.preventDefault();
    const vehId = document.getElementById('renew-veh-id').value;
    const renewDate = document.getElementById('renew-date').value;

    const checkedDocs = Array.from(document.querySelectorAll('.renew-doc-check:checked')).map(cb => cb.value);

    if (checkedDocs.length === 0) {
        showToast('Please select at least one document (PUC, Insurance, Fitness, Tax) to renew!', 'error');
        return;
    }

    if (!renewDate) {
        showToast('Please select a new expiry date!', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/vehicles/${vehId}/renew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                documents: checkedDocs,
                renew_date: renewDate
            })
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            closeRenewModal();
            loadVehicles();
            loadDashboardStats();
            loadUpcomingExpiriesAlerts();
        } else {
            showToast(data.error || 'Failed to renew documents', 'error');
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

// ============================================================
// E-CHALLAN CHECK MODAL FUNCTIONS
// ============================================================
function openChallanModal(vehicleNumber = '') {
    const modal = document.getElementById('challan-modal');
    if (modal) modal.classList.remove('hidden');

    const input = document.getElementById('challan-search-input');
    if (input) {
        input.value = vehicleNumber;
        if (vehicleNumber) {
            fetchChallanDetails();
        } else {
            document.getElementById('challan-results').innerHTML = `
                <p class="text-xs text-slate-400 text-center py-6">Enter a vehicle number above and click 'Check' to search pending e-Challans.</p>
            `;
        }
    }
}

function closeChallanModal() {
    const modal = document.getElementById('challan-modal');
    if (modal) modal.classList.add('hidden');
}

function checkVehicleChallan(vehicleNumber) {
    // Copy vehicle number to clipboard
    try {
        navigator.clipboard.writeText(vehicleNumber);
        showToast(`Vehicle ${vehicleNumber} copied to clipboard!`, 'info');
    } catch(e){}
    openChallanModal(vehicleNumber);
}

async function fetchChallanDetails() {
    const input = document.getElementById('challan-search-input');
    const vehicleNumber = input.value.trim().toUpperCase();

    if (!vehicleNumber) {
        showToast('Please enter a valid vehicle number!', 'error');
        return;
    }

    const container = document.getElementById('challan-results');
    container.innerHTML = `
        <div class="text-center py-6 text-slate-400 space-y-2">
            <i class="fa-solid fa-spinner fa-spin text-amber-400 text-2xl"></i>
            <p class="text-xs">Searching e-Challan database for <span class="font-mono font-bold text-white">${vehicleNumber}</span>...</p>
        </div>
    `;

    try {
        const res = await fetch(`${API_BASE}/challan/check?vehicle_number=${encodeURIComponent(vehicleNumber)}`);
        const data = await res.json();

        if (data.success) {
            if (data.has_pending && data.challans.length > 0) {
                let html = `
                    <div class="bg-rose-500/15 border border-rose-500/30 rounded-2xl p-4 space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5">
                                <i class="fa-solid fa-triangle-exclamation"></i>
                                <span>Pending e-Challan Found!</span>
                            </span>
                            <span class="text-sm font-mono font-extrabold text-rose-300">Total: ₹${data.pending_amount}</span>
                        </div>
                `;

                data.challans.forEach(c => {
                    html += `
                        <div class="bg-slate-900/90 border border-rose-500/20 rounded-xl p-3 text-xs space-y-1">
                            <div class="flex justify-between font-mono font-bold text-white">
                                <span>Challan #: ${c.challan_no}</span>
                                <span class="text-rose-400">₹${c.amount} (${c.status})</span>
                            </div>
                            <p class="text-slate-300">${c.reason}</p>
                            <p class="text-slate-400 text-[11px]">Date: ${c.date} | Location: ${c.location}</p>
                        </div>
                    `;
                });

                html += `
                    </div>
                    <p class="text-xs text-amber-300/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-center">
                        💡 Click below to open official Government portal & pay online.
                    </p>
                `;

                container.innerHTML = html;
            } else {
                container.innerHTML = `
                    <div class="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-4 text-center space-y-2">
                        <div class="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl mx-auto">
                            <i class="fa-solid fa-circle-check"></i>
                        </div>
                        <h4 class="text-sm font-bold text-emerald-300">No Pending Challans Found!</h4>
                        <p class="text-xs text-slate-300">Vehicle <span class="font-mono font-bold text-white">${data.vehicle_number}</span> has no unpaid e-Challans on record.</p>
                    </div>
                `;
            }
        } else {
            container.innerHTML = `<p class="text-xs text-rose-400 text-center py-4">Error: ${data.error}</p>`;
        }
    } catch(err) {
        container.innerHTML = `<p class="text-xs text-rose-400 text-center py-4">Failed to fetch challan: ${err.message}</p>`;
    }
}

async function autoFetchRTODates() {
    const numInput = document.getElementById('veh-number');
    const vehicleNumber = numInput ? numInput.value.trim().toUpperCase() : '';

    if (!vehicleNumber) {
        showToast('Please enter a vehicle number first!', 'error');
        return;
    }

    showToast(`Fetching RTO dates for ${vehicleNumber}...`, 'info');

    try {
        const res = await fetch(`${API_BASE}/rto/fetch-vehicle?vehicle_number=${encodeURIComponent(vehicleNumber)}`);
        const data = await res.json();

        if (data.limit_reached) {
            showApiLimitModal(data.message);
            updateApiLimitBadge();
            return;
        }

        if (data.success) {
            if (data.puc_expiry) document.getElementById('veh-puc').value = data.puc_expiry;
            if (data.insurance_expiry) document.getElementById('veh-insurance').value = data.insurance_expiry;
            if (data.fitness_expiry) document.getElementById('veh-fitness').value = data.fitness_expiry;
            if (data.tax_expiry) document.getElementById('veh-tax').value = data.tax_expiry;

            showToast(`RTO dates for ${vehicleNumber} auto-filled! You can adjust them anytime.`, 'success');
            updateApiLimitBadge();
        } else {
            showToast(data.error || 'Failed to fetch RTO details', 'error');
        }
    } catch(err) {
        showToast(`Error fetching RTO dates: ${err.message}`, 'error');
    }
}

async function autoFetchCustomerVehicle() {
    const numInput = document.getElementById('cust-veh-number');
    const vehicleNumber = numInput ? numInput.value.trim().toUpperCase() : '';

    if (!vehicleNumber) {
        showToast('Please enter a vehicle number!', 'error');
        return;
    }

    showToast(`Validating RTO details for ${vehicleNumber}...`, 'info');

    try {
        const res = await fetch(`${API_BASE}/rto/fetch-vehicle?vehicle_number=${encodeURIComponent(vehicleNumber)}`);
        const data = await res.json();

        if (data.success) {
            showToast(`RTO record found for ${vehicleNumber}! Click 'Save Customer' to finish.`, 'success');
        } else {
            showToast(data.error || 'Vehicle check completed', 'info');
        }
    } catch(err) {
        showToast(`RTO check complete`, 'info');
    }
}

// ============================================================
// API LIMIT TRACKER FRONTEND LOGIC (RTO API badge kept hidden per settings)
// ============================================================
async function updateApiLimitBadge() {
    const badge = document.getElementById('api-limit-badge');
    if (badge) badge.classList.add('hidden');
}

async function showApiLimitModal(customMsg = null) {
    const modal = document.getElementById('api-limit-modal');
    const body = document.getElementById('api-limit-modal-body');
    if (!modal || !body) return;

    try {
        const res = await fetch(`${API_BASE}/rto/limit-status`);
        const data = await res.json();

        let warningBanner = '';
        if (customMsg || (data.success && data.remaining_today === 0)) {
            warningBanner = `
                <div class="bg-rose-500/15 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-300 space-y-1">
                    <span class="font-bold flex items-center space-x-1">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>Today's Free Search Limit Reached!</span>
                    </span>
                    <p>${customMsg || `Today's ${data.daily_limit} RTO searches limit has been exhausted.`}</p>
                </div>
            `;
        }

        body.innerHTML = `
            ${warningBanner}
            <div class="space-y-2 text-xs">
                <div class="flex justify-between items-center bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                    <span class="text-slate-300 font-medium">Daily Limit (2 Keys Combined):</span>
                    <span class="font-mono font-bold text-amber-300">${data.used_today} / ${data.daily_limit} Used (${data.remaining_today} Left)</span>
                </div>
                <div class="flex justify-between items-center bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                    <span class="text-slate-300 font-medium">Monthly Limit (2 Keys Combined):</span>
                    <span class="font-mono font-bold text-indigo-300">${data.used_month} / ${data.monthly_limit} Used (${data.remaining_month} Pending)</span>
                </div>
                <div class="flex justify-between items-center bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                    <span class="text-slate-300 font-medium">Daily Limit Reset In:</span>
                    <span class="font-mono font-bold text-emerald-400">⏱️ ${data.hours_until_reset} hours</span>
                </div>
            </div>
            <p class="text-[11px] text-slate-400 text-center pt-1">💡 Note: Daily 5 free API searches renew automatically every 24 hours at midnight!</p>
        `;

        modal.classList.remove('hidden');
    } catch(e){}
}

function closeApiLimitModal() {
    const modal = document.getElementById('api-limit-modal');
    if (modal) modal.classList.add('hidden');
}

// Call limit badge update on load
document.addEventListener('DOMContentLoaded', () => {
    updateApiLimitBadge();
});

function triggerMainPageFetch() {
    const input = document.getElementById('vehicle-search');
    const vehicleNumber = input ? input.value.trim().toUpperCase() : '';

    if (!vehicleNumber) {
        showToast('Please enter a vehicle number in the search box first!', 'error');
        return;
    }

    // Open Vehicle Modal and populate vehicle number & fetch dates
    openVehicleModal();
    document.getElementById('veh-number').value = vehicleNumber;
    autoFetchRTODates();
}
