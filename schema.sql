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
