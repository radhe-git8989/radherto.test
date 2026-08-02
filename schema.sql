-- ============================================================
-- RTO & Vehicle Document Management System Database Schema
-- Compatible with MySQL 5.7+ / 8.0+ / MariaDB / phpMyAdmin
-- ============================================================

CREATE DATABASE IF NOT EXISTS `rto_management_db`;
USE `rto_management_db`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20),
    `shop_name` VARCHAR(150) DEFAULT 'Radhe RTO Services',
    `role` VARCHAR(20) NOT NULL DEFAULT 'user',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS `customers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(50) DEFAULT 'ravi',
    `name` VARCHAR(100) NOT NULL,
    `mobile_number` VARCHAR(20) NOT NULL UNIQUE,
    `email` VARCHAR(100),
    `address` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Vehicles Table
CREATE TABLE IF NOT EXISTS `vehicles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `customer_id` INT NOT NULL,
    `user_id` VARCHAR(50) DEFAULT 'ravi',
    `vehicle_number` VARCHAR(30) NOT NULL UNIQUE,
    `vehicle_type` VARCHAR(50) DEFAULT 'Car',
    `puc_expiry` DATE,
    `insurance_expiry` DATE,
    `fitness_expiry` DATE,
    `tax_expiry` DATE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default Seed Users
INSERT INTO `users` (`username`, `password`, `name`, `phone`, `shop_name`, `role`) VALUES
('ravi', '1234', 'Ravi Nakum', '9824582291', 'Radhe RTO Services', 'admin'),
('jignesh', '1234', 'Jignesh Chauhan', '6351839895', 'Jignesh RTO Consultancy', 'user'),
('raju', '1234', 'Raju Patel', '9876543210', 'Raju Auto Agency', 'user'),
('ashvin', '1234', 'Ashvin Parmar', '9823456789', 'Ashvin RTO Services', 'user')
ON DUPLICATE KEY UPDATE `name`=`name`;

-- Seed Customers (2 separate entries for each user)
INSERT INTO `customers` (`id`, `user_id`, `name`, `mobile_number`, `email`, `address`) VALUES
(1, 'ravi', 'Ramesh Patel', '9876543210', 'ramesh@example.com', 'Ahmedabad, Gujarat'),
(2, 'ravi', 'Kiran Shah', '9825011111', 'kiran@example.com', 'Ahmedabad, Gujarat'),
(3, 'raju', 'Suresh Sharma', '9823456789', 'suresh@example.com', 'Surat, Gujarat'),
(4, 'raju', 'Mahesh Varma', '9879022222', 'mahesh@example.com', 'Surat, Gujarat'),
(5, 'ashvin', 'Priya Shah', '9912345678', 'priya@example.com', 'Vadodara, Gujarat'),
(6, 'ashvin', 'Dinesh Mehta', '9898033333', 'dinesh@example.com', 'Vadodara, Gujarat'),
(7, 'jignesh', 'Vijay Rathod', '9712044444', 'vijay@example.com', 'Rajkot, Gujarat'),
(8, 'jignesh', 'Bhavesh Joshi', '9601055555', 'bhavesh@example.com', 'Rajkot, Gujarat')
ON DUPLICATE KEY UPDATE `name`=`name`;

-- Seed Vehicles (2 separate entries for each user)
INSERT INTO `vehicles` (`id`, `customer_id`, `user_id`, `vehicle_number`, `vehicle_type`, `puc_expiry`, `insurance_expiry`, `fitness_expiry`, `tax_expiry`) VALUES
(1, 1, 'ravi', 'GJ-01-AB-1234', 'Car', DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 90 DAY), DATE_ADD(CURDATE(), INTERVAL 180 DAY)),
(2, 2, 'ravi', 'GJ-01-XY-9876', 'Bike', DATE_ADD(CURDATE(), INTERVAL 2 DAY), DATE_SUB(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 120 DAY), DATE_ADD(CURDATE(), INTERVAL 200 DAY)),
(3, 3, 'raju', 'GJ-05-CD-5678', 'Truck', DATE_ADD(CURDATE(), INTERVAL 12 DAY), DATE_ADD(CURDATE(), INTERVAL 14 DAY), DATE_ADD(CURDATE(), INTERVAL 8 DAY), DATE_ADD(CURDATE(), INTERVAL 45 DAY)),
(4, 4, 'raju', 'GJ-05-ZZ-1122', 'Auto', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 7 DAY), DATE_ADD(CURDATE(), INTERVAL 30 DAY), DATE_ADD(CURDATE(), INTERVAL 60 DAY)),
(5, 5, 'ashvin', 'GJ-06-EF-4321', 'Car', DATE_ADD(CURDATE(), INTERVAL 25 DAY), DATE_ADD(CURDATE(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 60 DAY), DATE_ADD(CURDATE(), INTERVAL 150 DAY)),
(6, 6, 'ashvin', 'GJ-06-AA-5566', 'Tractor', DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 15 DAY), DATE_ADD(CURDATE(), INTERVAL 40 DAY), DATE_ADD(CURDATE(), INTERVAL 100 DAY)),
(7, 7, 'jignesh', 'GJ-03-GH-7788', 'Car', DATE_ADD(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 18 DAY), DATE_ADD(CURDATE(), INTERVAL 75 DAY), DATE_ADD(CURDATE(), INTERVAL 160 DAY)),
(8, 8, 'jignesh', 'GJ-03-MM-9900', 'Bike', DATE_ADD(CURDATE(), INTERVAL 8 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 50 DAY), DATE_ADD(CURDATE(), INTERVAL 110 DAY))
ON DUPLICATE KEY UPDATE `vehicle_number`=`vehicle_number`;
