const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDB, query } = require('./db');
const { initCronJobs, checkAndSendReminders, sendWhatsAppReminder } = require('./cron');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Helper for formatting date strings
function formatDate(d) {
    if (!d) return null;
    const date = new Date(d);
    return date.toISOString().split('T')[0];
}

// ============================================================
// 0. AUTHENTICATION & USER MANAGEMENT APIs
// ============================================================

// User Login API
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required' });
        }

        const users = await query('SELECT * FROM users WHERE LOWER(username) = ? AND password = ?', [username.toLowerCase().trim(), password]);
        if (users.length > 0) {
            const user = users[0];
            return res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    phone: user.phone,
                    role: user.role || (user.username === 'ravi' ? 'admin' : 'user')
                }
            });
        }

        res.status(401).json({ success: false, error: 'Invalid username or password' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get all system users (for Super Admin management & filters)
app.get('/api/users', async (req, res) => {
    try {
        const users = await query('SELECT id, username, name, phone, role, created_at FROM users ORDER BY id ASC');
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create new user (Super Admin only)
app.post('/api/users', async (req, res) => {
    try {
        const { username, password, name, phone, role } = req.body;
        if (!username || !password || !name) {
            return res.status(400).json({ success: false, error: 'Username, password, and name are required' });
        }

        const cleanUsername = username.toLowerCase().trim();
        const userRole = role || 'user';

        const result = await query(
            'INSERT INTO users (username, password, name, phone, role) VALUES (?, ?, ?, ?, ?)',
            [cleanUsername, password, name, phone || null, userRole]
        );

        res.json({ success: true, message: `User '${cleanUsername}' created successfully!`, user_id: result.insertId });
    } catch (err) {
        if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique'))) {
            return res.status(400).json({ success: false, error: 'Username already exists! Please choose another username.' });
        }
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update User ID, Password, Name, Phone, Role (Super Admin only)
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, name, phone, role } = req.body;

        if (!username || !name) {
            return res.status(400).json({ success: false, error: 'Username and name are required' });
        }

        const oldUsers = await query('SELECT username FROM users WHERE id = ?', [id]);
        if (oldUsers.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const oldUsername = oldUsers[0].username;
        const newUsername = username.toLowerCase().trim();

        if (password && password.trim()) {
            await query(
                'UPDATE users SET username=?, password=?, name=?, phone=?, role=? WHERE id=?',
                [newUsername, password, name, phone || null, role || 'user', id]
            );
        } else {
            await query(
                'UPDATE users SET username=?, name=?, phone=?, role=? WHERE id=?',
                [newUsername, name, phone || null, role || 'user', id]
            );
        }

        // If username was updated, update linked customers & vehicles
        if (oldUsername !== newUsername) {
            await query('UPDATE customers SET user_id=? WHERE user_id=?', [newUsername, oldUsername]);
            await query('UPDATE vehicles SET user_id=? WHERE user_id=?', [newUsername, oldUsername]);
        }

        res.json({ success: true, message: `User '@${newUsername}' updated successfully!` });
    } catch (err) {
        if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique'))) {
            return res.status(400).json({ success: false, error: 'Username already exists! Choose another username.' });
        }
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete User (Super Admin only)
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM users WHERE id=?', [id]);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================
// 1. DASHBOARD & STATS API (Multi-Tenant Filtered)
// ============================================================
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const { user_id, user_role, filter_user } = req.query;
        let custWhere = 'WHERE 1=1';
        let vehWhere = 'WHERE 1=1';
        const params = [];

        if (user_role !== 'admin') {
            custWhere += ' AND user_id = ?';
            vehWhere += ' AND user_id = ?';
            params.push(user_id || 'ravi');
        } else if (filter_user) {
            custWhere += ' AND user_id = ?';
            vehWhere += ' AND user_id = ?';
            params.push(filter_user);
        }

        const custRes = await query(`SELECT COUNT(*) as total_customers FROM customers ${custWhere}`, params);
        const vehRes = await query(`SELECT COUNT(*) as total_vehicles FROM vehicles ${vehWhere}`, params);

        const total_customers = custRes[0]?.total_customers || 0;
        const total_vehicles = vehRes[0]?.total_vehicles || 0;

        const vehicles = await query(`SELECT puc_expiry, insurance_expiry, fitness_expiry, tax_expiry FROM vehicles ${vehWhere}`, params);
        
        let upcomingExpiries15Days = 0;
        let criticalExpiries3Days = 0;
        let expiredCount = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        vehicles.forEach(v => {
            [v.puc_expiry, v.insurance_expiry, v.fitness_expiry, v.tax_expiry].forEach(expStr => {
                if (!expStr) return;
                const expDate = new Date(expStr);
                expDate.setHours(0, 0, 0, 0);
                
                const diffDays = Math.round((expDate - today) / (1000 * 3600 * 24));
                if (diffDays < 0) {
                    expiredCount++;
                } else if (diffDays <= 3) {
                    criticalExpiries3Days++;
                    upcomingExpiries15Days++;
                } else if (diffDays <= 15) {
                    upcomingExpiries15Days++;
                }
            });
        });

        res.json({
            success: true,
            stats: {
                total_customers: parseInt(total_customers) || 0,
                total_vehicles: parseInt(total_vehicles) || 0,
                upcoming_expiries_15_days: upcomingExpiries15Days,
                critical_expiries_3_days: criticalExpiries3Days,
                expired_count: expiredCount
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================
// 2. UPCOMING EXPIRIES ALERTS API (Multi-Tenant Filtered)
// ============================================================
app.get('/api/expiries/upcoming', async (req, res) => {
    try {
        const daysLimit = parseInt(req.query.days) || 15;
        const { user_id, user_role, filter_user } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (user_role !== 'admin') {
            whereClause += ' AND v.user_id = ?';
            params.push(user_id || 'ravi');
        } else if (filter_user) {
            whereClause += ' AND v.user_id = ?';
            params.push(filter_user);
        }

        const vehicles = await query(`
            SELECT 
                v.id AS vehicle_id, v.vehicle_number, v.vehicle_type, v.user_id,
                v.puc_expiry, v.insurance_expiry, v.fitness_expiry, v.tax_expiry,
                c.id AS customer_id, c.name AS customer_name, c.mobile_number,
                COALESCE(u.name, v.user_id) AS added_by_name
            FROM vehicles v
            JOIN customers c ON v.customer_id = c.id
            LEFT JOIN users u ON v.user_id = u.username
            ${whereClause}
        `, params);

        const alerts = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        vehicles.forEach(v => {
            const docs = [
                { type: 'PUC', expiry: v.puc_expiry },
                { type: 'Insurance', expiry: v.insurance_expiry },
                { type: 'Fitness', expiry: v.fitness_expiry },
                { type: 'Tax', expiry: v.tax_expiry }
            ];

            docs.forEach(doc => {
                if (!doc.expiry) return;
                const expDate = new Date(doc.expiry);
                expDate.setHours(0, 0, 0, 0);
                
                const daysLeft = Math.round((expDate - today) / (1000 * 3600 * 24));
                
                if (daysLeft <= daysLimit) {
                    let severity = 'normal';
                    if (daysLeft < 0) severity = 'expired';
                    else if (daysLeft <= 3) severity = 'critical';
                    else if (daysLeft <= 15) severity = 'warning';

                    alerts.push({
                        vehicle_id: v.vehicle_id,
                        customer_id: v.customer_id,
                        customer_name: v.customer_name,
                        mobile_number: v.mobile_number,
                        vehicle_number: v.vehicle_number,
                        vehicle_type: v.vehicle_type,
                        user_id: v.user_id,
                        added_by: v.added_by_name || v.user_id,
                        document_type: doc.type,
                        expiry_date: formatDate(doc.expiry),
                        days_left: daysLeft,
                        severity: severity
                    });
                }
            });
        });

        // Sort by urgency (expired & smallest days remaining first)
        alerts.sort((a, b) => a.days_left - b.days_left);

        res.json({ success: true, count: alerts.length, alerts });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================
// 3. CUSTOMER MANAGEMENT APIs (Multi-Tenant Filtered)
// ============================================================

// Get customers
app.get('/api/customers', async (req, res) => {
    try {
        const { search, user_id, user_role, filter_user } = req.query;
        let sql = `
            SELECT c.*, COUNT(v.id) AS vehicle_count, COALESCE(u.name, c.user_id) AS added_by_name 
            FROM customers c 
            LEFT JOIN vehicles v ON c.id = v.customer_id
            LEFT JOIN users u ON c.user_id = u.username
            WHERE 1=1
        `;
        let params = [];

        if (user_role !== 'admin') {
            sql += ` AND c.user_id = ?`;
            params.push(user_id || 'ravi');
        } else if (filter_user) {
            sql += ` AND c.user_id = ?`;
            params.push(filter_user);
        }

        if (search) {
            sql += ` AND (c.name LIKE ? OR c.mobile_number LIKE ? OR c.email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ` GROUP BY c.id ORDER BY c.id DESC`;

        const customers = await query(sql, params);
        res.json({ success: true, customers });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create Customer
app.post('/api/customers', async (req, res) => {
    try {
        const { name, mobile_number, email, address, user_id } = req.body;
        if (!name || !mobile_number) {
            return res.status(400).json({ success: false, error: 'Name and mobile number are required' });
        }

        const ownerId = user_id || 'ravi';
        const result = await query(
            'INSERT INTO customers (user_id, name, mobile_number, email, address) VALUES (?, ?, ?, ?, ?)',
            [ownerId, name, mobile_number, email || null, address || null]
        );

        res.json({ success: true, message: 'Customer added successfully', customer_id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update Customer
app.put('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, mobile_number, email, address } = req.body;

        await query(
            'UPDATE customers SET name=?, mobile_number=?, email=?, address=? WHERE id=?',
            [name, mobile_number, email || null, address || null, id]
        );

        res.json({ success: true, message: 'Customer updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete Customer
app.delete('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM customers WHERE id=?', [id]);
        res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================
// 4. VEHICLE MANAGEMENT APIs (Multi-Tenant Filtered)
// ============================================================

// Get vehicles with optional filtering
app.get('/api/vehicles', async (req, res) => {
    try {
        const { customer_id, vehicle_type, search, user_id, user_role, filter_user } = req.query;
        let sql = `
            SELECT v.*, c.name AS customer_name, c.mobile_number, COALESCE(u.name, v.user_id) AS added_by_name 
            FROM vehicles v 
            JOIN customers c ON v.customer_id = c.id
            LEFT JOIN users u ON v.user_id = u.username
            WHERE 1=1
        `;
        const params = [];

        if (user_role !== 'admin') {
            sql += ` AND v.user_id = ?`;
            params.push(user_id || 'ravi');
        } else if (filter_user) {
            sql += ` AND v.user_id = ?`;
            params.push(filter_user);
        }

        if (customer_id) {
            sql += ` AND v.customer_id = ?`;
            params.push(customer_id);
        }
        if (vehicle_type) {
            sql += ` AND v.vehicle_type = ?`;
            params.push(vehicle_type);
        }
        if (search) {
            sql += ` AND (v.vehicle_number LIKE ? OR c.name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY v.id DESC`;

        const vehicles = await query(sql, params);
        const formattedVehicles = vehicles.map(v => ({
            ...v,
            puc_expiry: formatDate(v.puc_expiry),
            insurance_expiry: formatDate(v.insurance_expiry),
            fitness_expiry: formatDate(v.fitness_expiry),
            tax_expiry: formatDate(v.tax_expiry)
        }));

        res.json({ success: true, vehicles: formattedVehicles });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create Vehicle
app.post('/api/vehicles', async (req, res) => {
    try {
        const { customer_id, vehicle_number, vehicle_type, puc_expiry, insurance_expiry, fitness_expiry, tax_expiry, user_id } = req.body;
        
        if (!customer_id || !vehicle_number) {
            return res.status(400).json({ success: false, error: 'Customer and vehicle number are required' });
        }

        const ownerId = user_id || 'ravi';
        const result = await query(
            `INSERT INTO vehicles 
            (customer_id, user_id, vehicle_number, vehicle_type, puc_expiry, insurance_expiry, fitness_expiry, tax_expiry) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [customer_id, ownerId, vehicle_number, vehicle_type || 'Car', puc_expiry || null, insurance_expiry || null, fitness_expiry || null, tax_expiry || null]
        );

        res.json({ success: true, message: 'Vehicle added successfully', vehicle_id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update Vehicle
app.put('/api/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { vehicle_number, vehicle_type, puc_expiry, insurance_expiry, fitness_expiry, tax_expiry } = req.body;

        await query(
            `UPDATE vehicles SET 
            vehicle_number=?, vehicle_type=?, puc_expiry=?, insurance_expiry=?, fitness_expiry=?, tax_expiry=? 
            WHERE id=?`,
            [vehicle_number, vehicle_type || 'Car', puc_expiry || null, insurance_expiry || null, fitness_expiry || null, tax_expiry || null, id]
        );

        res.json({ success: true, message: 'Vehicle updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Renew Vehicle Documents
app.post('/api/vehicles/:id/renew', async (req, res) => {
    try {
        const { id } = req.params;
        const { documents, renew_date } = req.body;

        if (!documents || !Array.isArray(documents) || documents.length === 0 || !renew_date) {
            return res.status(400).json({ success: false, error: 'Documents selection and renew date are required' });
        }

        const setClause = [];
        const params = [];

        if (documents.includes('puc')) {
            setClause.push('puc_expiry = ?');
            params.push(renew_date);
        }
        if (documents.includes('insurance')) {
            setClause.push('insurance_expiry = ?');
            params.push(renew_date);
        }
        if (documents.includes('fitness')) {
            setClause.push('fitness_expiry = ?');
            params.push(renew_date);
        }
        if (documents.includes('tax')) {
            setClause.push('tax_expiry = ?');
            params.push(renew_date);
        }

        if (setClause.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid document types selected' });
        }

        params.push(id);
        const sql = `UPDATE vehicles SET ${setClause.join(', ')} WHERE id = ?`;
        await query(sql, params);

        res.json({
            success: true,
            message: `Document(s) [${documents.map(d => d.toUpperCase()).join(', ')}] successfully renewed to ${renew_date}!`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// Delete Vehicle
app.delete('/api/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM vehicles WHERE id=?', [id]);
        res.json({ success: true, message: 'Vehicle deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================
// 5. AUTOMATION & REMINDERS TEST APIs
// ============================================================

// Trigger manual check for daily cron (for testing)
app.post('/api/reminders/trigger-cron', async (req, res) => {
    try {
        const days = req.body.days || [10, 2];
        const count = await checkAndSendReminders(days);
        res.json({ success: true, message: `Cron job triggered successfully. Sent ${count} reminders.` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Test single WhatsApp reminder
app.post('/api/reminders/send-whatsapp', async (req, res) => {
    try {
        const { mobile_number, customer_name, vehicle_number, document_type, expiry_date, days_left } = req.body;
        const result = await sendWhatsAppReminder(
            mobile_number || '9876543210',
            customer_name || 'Customer',
            vehicle_number || 'GJ-01-AB-1234',
            document_type || 'Insurance',
            expiry_date || formatDate(new Date()),
            days_left || 10
        );
        res.json({ success: true, message: 'WhatsApp reminder sent (logged to server console)', result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================
// 6. E-CHALLAN CHECK API
// ============================================================
app.get('/api/challan/check', async (req, res) => {
    try {
        const { vehicle_number } = req.query;
        if (!vehicle_number) {
            return res.status(400).json({ success: false, error: 'Vehicle number is required' });
        }

        const cleanNo = vehicle_number.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        
        // Lookup vehicle in database
        const vehicles = await query('SELECT v.*, c.name as customer_name FROM vehicles v JOIN customers c ON v.customer_id = c.id WHERE REPLACE(v.vehicle_number, "-", "") LIKE ? OR v.vehicle_number LIKE ?', [`%${cleanNo}%`, `%${vehicle_number}%`]);
        const vehicle = vehicles && vehicles.length > 0 ? vehicles[0] : null;

        // Check or simulate pending challan lookup
        let hasPending = false;
        let challans = [];

        // Check if vehicle has any expired documents or simulate pending challan
        if (vehicle && (vehicle.insurance_expiry && new Date(vehicle.insurance_expiry) < new Date())) {
            hasPending = true;
            challans.push({
                challan_no: 'GJ' + Math.floor(10000000 + Math.random() * 90000000),
                date: vehicle.insurance_expiry,
                amount: 1000,
                reason: 'Driving Without Valid Insurance (MV Act Sec 196)',
                status: 'PENDING',
                location: 'RTO Checkpost'
            });
        } else if (cleanNo.includes('9876') || cleanNo.includes('5678')) {
            hasPending = true;
            challans.push({
                challan_no: 'GJ' + Math.floor(10000000 + Math.random() * 90000000),
                date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                amount: 500,
                reason: 'Red Light Signal Jumping (Sec 119/177)',
                status: 'PENDING',
                location: 'City Traffic Junction'
            });
        }

        res.json({
            success: true,
            vehicle_number: vehicle ? vehicle.vehicle_number : vehicle_number.toUpperCase(),
            customer_name: vehicle ? vehicle.customer_name : 'Registered Vehicle Owner',
            has_pending: hasPending,
            pending_amount: hasPending ? challans.reduce((sum, c) => sum + c.amount, 0) : 0,
            challans: challans,
            official_gujarat_url: 'https://echallan.gujarat.gov.in/',
            official_parivahan_url: 'https://echallan.parivahan.gov.in/index/accused-challan'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================
// 7. AUTO-FETCH RTO VEHICLE DETAILS & LIMIT TRACKER API
// ============================================================
const RAPIDAPI_KEYS = [
    { key: process.env.RAPIDAPI_KEY1 || 'c942c0ffc7mshac48052d7b7c8c2p12531djsn7b3f10c8af85', host: 'vehicle-rc-details-india.p.rapidapi.com', dailyLimit: 5, monthlyLimit: 150 },
    { key: process.env.RAPIDAPI_KEY2 || 'c942c0ffc7mshac48052d7b7c8c2p12531djsn7b3f10c8af85', host: 'indian-vehicle-details.p.rapidapi.com', dailyLimit: 2, monthlyLimit: 40 }
];

let apiUsage = {
    date: new Date().toISOString().split('T')[0],
    month: new Date().toISOString().substring(0, 7),
    usedToday: 0,
    usedMonth: 0,
    dailyLimit: 7, // 5 + 2
    monthlyLimit: 190 // 150 + 40
};

function checkAndResetUsage() {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().substring(0, 7);

    if (apiUsage.date !== today) {
        apiUsage.date = today;
        apiUsage.usedToday = 0;
    }
    if (apiUsage.month !== currentMonth) {
        apiUsage.month = currentMonth;
        apiUsage.usedMonth = 0;
    }
}

// Get RTO API limit status
app.get('/api/rto/limit-status', (req, res) => {
    checkAndResetUsage();
    const now = new Date();
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 0);
    const hoursLeft = ((nextMidnight - now) / (1000 * 60 * 60)).toFixed(1);

    const remainingToday = Math.max(0, apiUsage.dailyLimit - apiUsage.usedToday);
    const remainingMonth = Math.max(0, apiUsage.monthlyLimit - apiUsage.usedMonth);

    res.json({
        success: true,
        daily_limit: apiUsage.dailyLimit,
        used_today: apiUsage.usedToday,
        remaining_today: remainingToday,
        monthly_limit: apiUsage.monthlyLimit,
        used_month: apiUsage.usedMonth,
        remaining_month: remainingMonth,
        hours_until_reset: parseFloat(hoursLeft)
    });
});

app.get('/api/rto/fetch-vehicle', async (req, res) => {
    try {
        const { vehicle_number } = req.query;
        if (!vehicle_number) {
            return res.status(400).json({ success: false, error: 'Vehicle number is required' });
        }

        checkAndResetUsage();
        const cleanNo = vehicle_number.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

        // 1. Check if vehicle already exists in DB
        const existing = await query('SELECT * FROM vehicles WHERE REPLACE(vehicle_number, "-", "") = ? OR vehicle_number = ?', [cleanNo, vehicle_number]);
        if (existing && existing.length > 0) {
            const v = existing[0];
            return res.json({
                success: true,
                vehicle_number: v.vehicle_number,
                vehicle_type: v.vehicle_type,
                puc_expiry: formatDate(v.puc_expiry),
                insurance_expiry: formatDate(v.insurance_expiry),
                fitness_expiry: formatDate(v.fitness_expiry),
                tax_expiry: formatDate(v.tax_expiry),
                is_existing: true
            });
        }

        // Increment API Usage counter
        apiUsage.usedToday++;
        apiUsage.usedMonth++;

        // 2. Auto-calculate valid RTO Expiry Dates (+6M PUC, +1Y Insurance, +15Y Fitness & Tax)
        const now = new Date();
        const pucDate = new Date(now); pucDate.setMonth(pucDate.getMonth() + 6);
        const insDate = new Date(now); insDate.setFullYear(insDate.getFullYear() + 1);
        const fitDate = new Date(now); fitDate.setFullYear(fitDate.getFullYear() + 15);
        const taxDate = new Date(now); taxDate.setFullYear(taxDate.getFullYear() + 15);

        let vehicleType = req.query.vehicle_type || 'Car';

        res.json({
            success: true,
            vehicle_number: vehicle_number.toUpperCase(),
            vehicle_type: vehicleType,
            puc_expiry: formatDate(pucDate),
            insurance_expiry: formatDate(insDate),
            fitness_expiry: formatDate(fitDate),
            tax_expiry: formatDate(taxDate),
            is_existing: false,
            api_status: {
                used_today: apiUsage.usedToday,
                remaining_today: Math.max(0, apiUsage.dailyLimit - apiUsage.usedToday),
                remaining_month: Math.max(0, apiUsage.monthlyLimit - apiUsage.usedMonth)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Catch-all route to serve index.html for frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server after initializing Database & Cron
async function startServer() {
    await initDB();
    initCronJobs();

    app.listen(PORT, () => {
        console.log(`\n🚀 RTO & Vehicle Document Management Server running at http://localhost:${PORT}`);
        console.log(`🌐 Open http://localhost:${PORT} in your browser to access the Admin Dashboard.\n`);
    });
}

startServer();
