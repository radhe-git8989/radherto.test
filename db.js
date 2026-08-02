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

async function initMySQLTables() {
    if (!pool) return;
    try {
        // 1. Users Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                shop_name VARCHAR(150) DEFAULT 'Radhe RTO Services',
                role VARCHAR(20) NOT NULL DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        try {
            await pool.query(`ALTER TABLE users ADD COLUMN shop_name VARCHAR(150) DEFAULT 'Radhe RTO Services'`);
        } catch(e){}

        // 2. Customers Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(50) DEFAULT 'ravi',
                name VARCHAR(100) NOT NULL,
                mobile_number VARCHAR(20) NOT NULL UNIQUE,
                email VARCHAR(100),
                address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        try {
            await pool.query(`ALTER TABLE customers ADD COLUMN user_id VARCHAR(50) DEFAULT 'ravi'`);
        } catch(e){}

        // 3. Vehicles Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vehicles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                user_id VARCHAR(50) DEFAULT 'ravi',
                vehicle_number VARCHAR(30) NOT NULL UNIQUE,
                vehicle_type VARCHAR(50) DEFAULT 'Car',
                puc_expiry DATE,
                insurance_expiry DATE,
                fitness_expiry DATE,
                tax_expiry DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            );
        `);

        // 4. Activity Logs Table (Audit & Reporting)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                action_type VARCHAR(50) NOT NULL,
                customer_name VARCHAR(100),
                vehicle_number VARCHAR(30),
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seed Default Users if empty
        const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
        if (users[0].count === 0) {
            console.log("🌱 Seeding default users into MySQL database...");
            await pool.query(`INSERT INTO users (username, password, name, phone, shop_name, role) VALUES
                ('ravi', '1234', 'Ravi Nakum', '9824582291', 'Radhe RTO Services', 'admin'),
                ('jignesh', '1234', 'Jignesh Chauhan', '6351839895', 'Jignesh RTO Consultancy', 'user'),
                ('raju', '1234', 'Raju Patel', '9876543210', 'Raju Auto Agency', 'user'),
                ('ashvin', '1234', 'Ashvin Parmar', '9823456789', 'Ashvin RTO Services', 'user');
            `);
        }

        // Seed Sample Customers & Vehicles if empty
        const [custs] = await pool.query('SELECT COUNT(*) as count FROM customers');
        if (custs[0].count === 0) {
            console.log("🌱 Seeding sample data into MySQL database...");
            await pool.query(`INSERT INTO customers (id, user_id, name, mobile_number, email, address) VALUES
                (1, 'ravi', 'Ramesh Patel', '9876543210', 'ramesh@example.com', 'Ahmedabad, Gujarat'),
                (2, 'ravi', 'Kiran Shah', '9825011111', 'kiran@example.com', 'Ahmedabad, Gujarat'),
                (3, 'raju', 'Suresh Sharma', '9823456789', 'suresh@example.com', 'Surat, Gujarat'),
                (4, 'raju', 'Mahesh Varma', '9879022222', 'mahesh@example.com', 'Surat, Gujarat'),
                (5, 'ashvin', 'Priya Shah', '9912345678', 'priya@example.com', 'Vadodara, Gujarat'),
                (6, 'ashvin', 'Dinesh Mehta', '9898033333', 'dinesh@example.com', 'Vadodara, Gujarat'),
                (7, 'jignesh', 'Vijay Rathod', '9712044444', 'vijay@example.com', 'Rajkot, Gujarat'),
                (8, 'jignesh', 'Bhavesh Joshi', '9601055555', 'bhavesh@example.com', 'Rajkot, Gujarat');
            `);

            await pool.query(`INSERT INTO vehicles (id, customer_id, user_id, vehicle_number, vehicle_type, puc_expiry, insurance_expiry, fitness_expiry, tax_expiry) VALUES
                (1, 1, 'ravi', 'GJ-01-AB-1234', 'Car', '${addDays(5)}', '${addDays(10)}', '${addDays(90)}', '${addDays(180)}'),
                (2, 2, 'ravi', 'GJ-01-XY-9876', 'Bike', '${addDays(2)}', '${addDays(-3)}', '${addDays(120)}', '${addDays(200)}'),
                (3, 3, 'raju', 'GJ-05-CD-5678', 'Truck', '${addDays(12)}', '${addDays(14)}', '${addDays(8)}', '${addDays(45)}'),
                (4, 4, 'raju', 'GJ-05-ZZ-1122', 'Auto', '${addDays(1)}', '${addDays(7)}', '${addDays(30)}', '${addDays(60)}'),
                (5, 5, 'ashvin', 'GJ-06-EF-4321', 'Car', '${addDays(25)}', '${addDays(2)}', '${addDays(60)}', '${addDays(150)}'),
                (6, 6, 'ashvin', 'GJ-06-AA-5566', 'Tractor', '${addDays(-5)}', '${addDays(15)}', '${addDays(40)}', '${addDays(100)}'),
                (7, 7, 'jignesh', 'GJ-03-GH-7788', 'Car', '${addDays(3)}', '${addDays(18)}', '${addDays(75)}', '${addDays(160)}'),
                (8, 8, 'jignesh', 'GJ-03-MM-9900', 'Bike', '${addDays(8)}', '${addDays(-1)}', '${addDays(50)}', '${addDays(110)}');
            `);
        }
    } catch(err) {
        console.error('Error initializing MySQL tables:', err.message);
    }
}

async function initDB() {
    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'rto_management_db';
    const port = process.env.DB_PORT || 3306;
    const ssl = (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com'))) ? { rejectUnauthorized: false } : undefined;

    try {
        // Step 1: Attempt to create MySQL database if missing
        try {
            const rootConn = await mysql.createConnection({ host, user, password, port, ssl });
            await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
            await rootConn.end();
        } catch(e) {
            // Safe to ignore if connection without DB fails or user lacks CREATE DB privilege
        }

        // Step 2: Create connection pool with database specified
        const config = {
            host, user, password, database: dbName, port, ssl,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };

        pool = mysql.createPool(config);
        const connection = await pool.getConnection();
        console.log(`✅ Connected to MySQL Database [${dbName}] at ${host}:${port}`);
        connection.release();
        dbType = 'mysql';

        await initMySQLTables();
    } catch (err) {
        console.warn(`⚠️ Could not connect to MySQL (${err.message}). Falling back to embedded SQLite database for seamless execution...`);
        dbType = 'sqlite';
        
        const dbPath = path.join(__dirname, 'rto_fallback.sqlite');
        sqliteDb = new sqlite3.Database(dbPath);

        // Initialize SQLite Tables & Sample Seed Data
        await new Promise((resolve) => {
            sqliteDb.serialize(() => {
                // 1. Users Table
                sqliteDb.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT NOT NULL UNIQUE,
                        password TEXT NOT NULL,
                        name TEXT NOT NULL,
                        phone TEXT,
                        shop_name TEXT DEFAULT 'Radhe RTO Services',
                        role TEXT NOT NULL DEFAULT 'user',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                sqliteDb.run(`ALTER TABLE users ADD COLUMN shop_name TEXT DEFAULT 'Radhe RTO Services'`, () => {});

                // 2. Customers Table
                sqliteDb.run(`
                    CREATE TABLE IF NOT EXISTS customers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT DEFAULT 'ravi',
                        name TEXT NOT NULL,
                        mobile_number TEXT NOT NULL UNIQUE,
                        email TEXT,
                        address TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                sqliteDb.run(`ALTER TABLE customers ADD COLUMN user_id TEXT DEFAULT 'ravi'`, () => {});

                // 3. Vehicles Table
                sqliteDb.run(`
                    CREATE TABLE IF NOT EXISTS vehicles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        customer_id INTEGER NOT NULL,
                        user_id TEXT DEFAULT 'ravi',
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

                // 4. Activity Logs Table (Audit & Reporting)
                sqliteDb.run(`
                    CREATE TABLE IF NOT EXISTS activity_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT NOT NULL,
                        action_type TEXT NOT NULL,
                        customer_name TEXT,
                        vehicle_number TEXT,
                        details TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                // Seed Default Users if empty
                sqliteDb.get("SELECT COUNT(*) as count FROM users", (err, row) => {
                    if (row && row.count === 0) {
                        console.log("🌱 Seeding default users into database...");
                        sqliteDb.run(`INSERT INTO users (username, password, name, phone, shop_name, role) VALUES
                            ('ravi', '1234', 'Ravi Nakum', '9824582291', 'Radhe RTO Services', 'admin'),
                            ('jignesh', '1234', 'Jignesh Chauhan', '6351839895', 'Jignesh RTO Consultancy', 'user'),
                            ('raju', '1234', 'Raju Patel', '9876543210', 'Raju Auto Agency', 'user'),
                            ('ashvin', '1234', 'Ashvin Parmar', '9823456789', 'Ashvin RTO Services', 'user');
                        `);
                    }
                });

                // Insert sample data if empty
                sqliteDb.get("SELECT COUNT(*) as count FROM customers", (err, row) => {
                    if (row && row.count === 0) {
                        console.log("🌱 Seeding sample data into SQLite database...");
                        sqliteDb.run(`INSERT INTO customers (id, user_id, name, mobile_number, email, address) VALUES
                            (1, 'ravi', 'Ramesh Patel', '9876543210', 'ramesh@example.com', 'Ahmedabad, Gujarat'),
                            (2, 'ravi', 'Kiran Shah', '9825011111', 'kiran@example.com', 'Ahmedabad, Gujarat'),
                            (3, 'raju', 'Suresh Sharma', '9823456789', 'suresh@example.com', 'Surat, Gujarat'),
                            (4, 'raju', 'Mahesh Varma', '9879022222', 'mahesh@example.com', 'Surat, Gujarat'),
                            (5, 'ashvin', 'Priya Shah', '9912345678', 'priya@example.com', 'Vadodara, Gujarat'),
                            (6, 'ashvin', 'Dinesh Mehta', '9898033333', 'dinesh@example.com', 'Vadodara, Gujarat'),
                            (7, 'jignesh', 'Vijay Rathod', '9712044444', 'vijay@example.com', 'Rajkot, Gujarat'),
                            (8, 'jignesh', 'Bhavesh Joshi', '9601055555', 'bhavesh@example.com', 'Rajkot, Gujarat');
                        `);

                        sqliteDb.run(`INSERT INTO vehicles (id, customer_id, user_id, vehicle_number, vehicle_type, puc_expiry, insurance_expiry, fitness_expiry, tax_expiry) VALUES
                            (1, 1, 'ravi', 'GJ-01-AB-1234', 'Car', '${addDays(5)}', '${addDays(10)}', '${addDays(90)}', '${addDays(180)}'),
                            (2, 2, 'ravi', 'GJ-01-XY-9876', 'Bike', '${addDays(2)}', '${addDays(-3)}', '${addDays(120)}', '${addDays(200)}'),
                            (3, 3, 'raju', 'GJ-05-CD-5678', 'Truck', '${addDays(12)}', '${addDays(14)}', '${addDays(8)}', '${addDays(45)}'),
                            (4, 4, 'raju', 'GJ-05-ZZ-1122', 'Auto', '${addDays(1)}', '${addDays(7)}', '${addDays(30)}', '${addDays(60)}'),
                            (5, 5, 'ashvin', 'GJ-06-EF-4321', 'Car', '${addDays(25)}', '${addDays(2)}', '${addDays(60)}', '${addDays(150)}'),
                            (6, 6, 'ashvin', 'GJ-06-AA-5566', 'Tractor', '${addDays(-5)}', '${addDays(15)}', '${addDays(40)}', '${addDays(100)}'),
                            (7, 7, 'jignesh', 'GJ-03-GH-7788', 'Car', '${addDays(3)}', '${addDays(18)}', '${addDays(75)}', '${addDays(160)}'),
                            (8, 8, 'jignesh', 'GJ-03-MM-9900', 'Bike', '${addDays(8)}', '${addDays(-1)}', '${addDays(50)}', '${addDays(110)}');
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
