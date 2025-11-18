-- Clear All Data from sku_sales_data Table
-- Run this in Supabase SQL Editor to delete all rows from sku_sales_data
-- WARNING: This will permanently delete all data in the table!

-- ============================================
-- Option 1: TRUNCATE (Recommended - Faster)
-- This removes all rows and resets any auto-increment sequences
-- ============================================
TRUNCATE TABLE sku_sales_data;

-- ============================================
-- Option 2: DELETE (Alternative - Slower but more flexible)
-- Use this if you need to respect foreign key constraints or want to use WHERE clause
-- Uncomment the line below if you prefer DELETE over TRUNCATE
-- ============================================
-- DELETE FROM sku_sales_data;

-- ============================================
-- Verify the table is empty
-- ============================================
SELECT COUNT(*) AS remaining_rows FROM sku_sales_data;

