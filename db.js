const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let dbType = 'mysql'; // 'mysql' or 'sqlite'
let pool = null;
let sqliteDb = null;

// Helper to format dates to YYYY-MM-DD
function formatDate(d) {
    if (!d) return null;
    const date = new Date(d);
    return date.toISOString().split('T')[0];
}

function addDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return formatDate(d);
}

// Universal Query Wrapper for MySQL & SQLite
async function query(sql, params = []) {
    if (dbType === 'mysql' && pool) {
        try {
            const [rows] = await pool.query(sql, params);
            return rows;
        } catch (err) {
            console.error('MySQL Query Error:', err.message);
            throw err;
        }
    } else if (sqliteDb) {
        return new Promise((resolve, reject) => {
            // Convert MySQL specific SQL syntax to SQLite if needed
            let convertedSql = sql
                .replace(/NOW\(\)/g, "DATETIME('now')")
                .replace(/CURDATE\(\)/g, "DATE('now')")
                .replace(/DATE_ADD\(CURDATE\(\),\s*INTERVAL\s*(\d+)\s*DAY\)/g, "DATE('now', '+$1 day')")
                .replace(/DATE_SUB\(CURDATE\(\),\s*INTERVAL\s*(\d+)\s*DAY\)/g, "DATE('now', '-$1 day')");

            const trimSql = convertedSql.trim().toUpperCase();
            if (trimSql.startsWith('SELECT')) {
                sqliteDb.all(convertedSql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            } else {
                sqliteDb.run(convertedSql, params, function (err) {
                    if (err) reject(err);
                    else resolve({ insertId: this.lastID, affectedRows: this.changes });
                });
            }
        });
    } else {
        throw new Error('Database connection not initialized');
    }
}

async function initDB() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'rto_management_db',
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };

    try {
        // Attempt MySQL connection
        pool = mysql.createPool(config);
        const connection = await pool.getConnection();
        console.log(`✅ Connected to MySQL Database [${config.database}] at ${config.host}:${config.port}`);
        connection.release();
        dbType = 'mysql';
    } catch (err) {
        console.warn(`⚠️ Could not connect to MySQL (${err.message}). Falling back to embedded SQLite database for seamless execution...`);
        dbType = 'sqlite';
        
        const dbPath = path.join(__dirname, 'rto_fallback.sqlite');
        sqliteDb = new sqlite3.Database(dbPath);

        // Initialize SQLite Tables & Sample Seed Data
        await new Promise((resolve) => {
            sqliteDb.serialize(() => {
                sqliteDb.run(`
                    CREATE TABLE IF NOT EXISTS customers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        mobile_number TEXT NOT NULL UNIQUE,
                        email TEXT,
                        address TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                sqliteDb.run(`
                    CREATE TABLE IF NOT EXISTS vehicles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        customer_id INTEGER NOT NULL,
                        vehicle_number TEXT NOT NULL UNIQUE,
                        vehicle_type TEXT DEFAULT 'Car',
                        puc_expiry DATE,
                        insurance_expiry DATE,
                        fitness_expiry DATE,
                        tax_expiry DATE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
                    );
                `);

                // Insert sample data if empty
                sqliteDb.get("SELECT COUNT(*) as count FROM customers", (err, row) => {
                    if (row && row.count === 0) {
                        console.log("🌱 Seeding sample data into SQLite database...");
                        sqliteDb.run(`INSERT INTO customers (id, name, mobile_number, email, address) VALUES
                            (1, 'Ramesh Patel', '9876543210', 'ramesh@example.com', 'Ahmedabad, Gujarat'),
                            (2, 'Suresh Sharma', '9823456789', 'suresh@example.com', 'Surat, Gujarat'),
                            (3, 'Priya Shah', '9912345678', 'priya@example.com', 'Vadodara, Gujarat');
                        `);

                        sqliteDb.run(`INSERT INTO vehicles (id, customer_id, vehicle_number, vehicle_type, puc_expiry, insurance_expiry, fitness_expiry, tax_expiry) VALUES
                            (1, 1, 'GJ-01-AB-1234', 'Car', '${addDays(5)}', '${addDays(10)}', '${addDays(90)}', '${addDays(180)}'),
                            (2, 1, 'GJ-01-XY-9876', 'Bike', '${addDays(2)}', '${addDays(-3)}', '${addDays(120)}', '${addDays(200)}'),
                            (3, 2, 'GJ-05-CD-5678', 'Truck', '${addDays(12)}', '${addDays(14)}', '${addDays(8)}', '${addDays(45)}'),
                            (4, 3, 'GJ-06-EF-4321', 'Car', '${addDays(25)}', '${addDays(2)}', '${addDays(60)}', '${addDays(150)}');
                        `);
                    }
                    resolve();
                });
            });
        });
        console.log(`✅ SQLite Database Initialized at ${dbPath}`);
    }
}

module.exports = {
    initDB,
    query,
    getDbType: () => dbType
};
