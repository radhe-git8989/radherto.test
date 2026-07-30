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
// 1. DASHBOARD & STATS API
// ============================================================
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const [{ total_customers }] = await query('SELECT COUNT(*) as total_customers FROM customers');
        const [{ total_vehicles }] = await query('SELECT COUNT(*) as total_vehicles FROM vehicles');

        const vehicles = await query('SELECT puc_expiry, insurance_expiry, fitness_expiry, tax_expiry FROM vehicles');
        
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
// 2. UPCOMING EXPIRIES ALERTS API (Prominent Dashboard Table)
// ============================================================
app.get('/api/expiries/upcoming', async (req, res) => {
    try {
        const daysLimit = parseInt(req.query.days) || 15;
        const vehicles = await query(`
            SELECT 
                v.id AS vehicle_id, v.vehicle_number, v.vehicle_type,
                v.puc_expiry, v.insurance_expiry, v.fitness_expiry, v.tax_expiry,
                c.id AS customer_id, c.name AS customer_name, c.mobile_number
            FROM vehicles v
            JOIN customers c ON v.customer_id = c.id
        `);

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
// 3. CUSTOMER MANAGEMENT APIs
// ============================================================

// Get all customers
app.get('/api/customers', async (req, res) => {
    try {
        const search = req.query.search ? `%${req.query.search}%` : null;
        let sql = `
            SELECT c.*, COUNT(v.id) AS vehicle_count 
            FROM customers c 
            LEFT JOIN vehicles v ON c.id = v.customer_id
        `;
        let params = [];

        if (search) {
            sql += ` WHERE c.name LIKE ? OR c.mobile_number LIKE ? OR c.email LIKE ?`;
            params = [search, search, search];
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
        const { name, mobile_number, email, address } = req.body;
        if (!name || !mobile_number) {
            return res.status(400).json({ success: false, error: 'Name and mobile number are required' });
        }

        const result = await query(
            'INSERT INTO customers (name, mobile_number, email, address) VALUES (?, ?, ?, ?)',
            [name, mobile_number, email || null, address || null]
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
// 4. VEHICLE MANAGEMENT APIs
// ============================================================

// Get vehicles with optional filtering
app.get('/api/vehicles', async (req, res) => {
    try {
        const { customer_id, vehicle_type, search } = req.query;
        let sql = `
            SELECT v.*, c.name AS customer_name, c.mobile_number 
            FROM vehicles v 
            JOIN customers c ON v.customer_id = c.id
            WHERE 1=1
        `;
        const params = [];

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
        res.json({ success: true, vehicles });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create Vehicle
app.post('/api/vehicles', async (req, res) => {
    try {
        const { customer_id, vehicle_number, vehicle_type, puc_expiry, insurance_expiry, fitness_expiry, tax_expiry } = req.body;
        
        if (!customer_id || !vehicle_number) {
            return res.status(400).json({ success: false, error: 'Customer and vehicle number are required' });
        }

        const result = await query(
            `INSERT INTO vehicles 
            (customer_id, vehicle_number, vehicle_type, puc_expiry, insurance_expiry, fitness_expiry, tax_expiry) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [customer_id, vehicle_number, vehicle_type || 'Car', puc_expiry || null, insurance_expiry || null, fitness_expiry || null, tax_expiry || null]
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
