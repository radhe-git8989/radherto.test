-- ============================================================
-- RTO & Vehicle Document Management System - MySQL Database Schema
-- Database: rto_management_db
-- ============================================================

CREATE DATABASE IF NOT EXISTS `rto_management_db`;
USE `rto_management_db`;

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS `customers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `mobile_number` VARCHAR(15) NOT NULL UNIQUE,
    `email` VARCHAR(100) DEFAULT NULL,
    `address` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Vehicles Table
CREATE TABLE IF NOT EXISTS `vehicles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `customer_id` INT NOT NULL,
    `vehicle_number` VARCHAR(20) NOT NULL UNIQUE,
    `vehicle_type` ENUM('Car', 'Bike', 'Truck', 'Bus', 'Auto', 'Other') DEFAULT 'Car',
    `puc_expiry` DATE DEFAULT NULL,
    `insurance_expiry` DATE DEFAULT NULL,
    `fitness_expiry` DATE DEFAULT NULL,
    `tax_expiry` DATE DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Sample Seed Data for Testing & Demo
-- ============================================================

INSERT INTO `customers` (`id`, `name`, `mobile_number`, `email`, `address`) VALUES
(1, 'Ramesh Patel', '9876543210', 'ramesh@example.com', 'Ahmedabad, Gujarat'),
(2, 'Suresh Sharma', '9823456789', 'suresh@example.com', 'Surat, Gujarat'),
(3, 'Priya Shah', '9912345678', 'priya@example.com', 'Vadodara, Gujarat')
ON DUPLICATE KEY UPDATE `id`=`id`;

INSERT INTO `vehicles` (`id`, `customer_id`, `vehicle_number`, `vehicle_type`, `puc_expiry`, `insurance_expiry`, `fitness_expiry`, `tax_expiry`) VALUES
(1, 1, 'GJ-01-AB-1234', 'Car', DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 90 DAY), DATE_ADD(CURDATE(), INTERVAL 180 DAY)),
(2, 1, 'GJ-01-XY-9876', 'Bike', DATE_ADD(CURDATE(), INTERVAL 2 DAY), DATE_SUB(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 120 DAY), DATE_ADD(CURDATE(), INTERVAL 200 DAY)),
(3, 2, 'GJ-05-CD-5678', 'Truck', DATE_ADD(CURDATE(), INTERVAL 12 DAY), DATE_ADD(CURDATE(), INTERVAL 14 DAY), DATE_ADD(CURDATE(), INTERVAL 8 DAY), DATE_ADD(CURDATE(), INTERVAL 45 DAY)),
(4, 3, 'GJ-06-EF-4321', 'Car', DATE_ADD(CURDATE(), INTERVAL 25 DAY), DATE_ADD(CURDATE(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 60 DAY), DATE_ADD(CURDATE(), INTERVAL 150 DAY))
ON DUPLICATE KEY UPDATE `id`=`id`;
