-- Verify Dashboard Data - Q4 2025 for LifePro
-- Run these queries in Supabase SQL Editor to confirm dashboard accuracy

-- ============================================
-- Query 1: Q4 2025 LifePro - Total Revenue by Channel (matches Dashboard aggregation)
-- This should match your "Channel Performance Breakdown" section
-- Note: This matches how Dashboard aggregates by date+channel+brand per day
-- ============================================
SELECT 
    channel,
    SUM(revenue) AS total_revenue,
    COUNT(DISTINCT date) AS distinct_dates,
    COUNT(*) AS record_count
FROM sales_data
WHERE date >= '2025-10-01' 
  AND date <= '2025-12-31'
  AND LOWER(brand) = LOWER('LifePro')
GROUP BY channel
ORDER BY total_revenue DESC;

-- ============================================
-- Query 1B: Q4 2025 LifePro - Daily Aggregates (what RPC should return)
-- This shows the daily sums by date+channel+brand (already aggregated per day)
-- ============================================
SELECT 
    date,
    channel,
    SUM(revenue) AS daily_revenue,
    COUNT(*) AS records_per_day
FROM sales_data
WHERE date >= '2025-10-01' 
  AND date <= '2025-12-31'
  AND LOWER(brand) = LOWER('LifePro')
GROUP BY date, channel
ORDER BY date DESC, channel
LIMIT 50; -- First 50 days

-- ============================================
-- Query 2: Q4 2025 LifePro - Overall Total Revenue
-- This should match your "CURRENT ACHIEVEMENT" card
-- ============================================
SELECT 
    SUM(revenue) AS total_revenue_q4_lifepro,
    COUNT(*) AS total_records
FROM sales_data
WHERE date >= '2025-10-01' 
  AND date <= '2025-12-31'
  AND LOWER(brand) = LOWER('LifePro');

-- ============================================
-- Query 3: Q4 2025 LifePro - Monthly Breakdown
-- This shows revenue by month for the charts
-- ============================================
SELECT 
    DATE_TRUNC('month', date)::date AS month,
    SUM(revenue) AS monthly_revenue,
    COUNT(*) AS record_count
FROM sales_data
WHERE date >= '2025-10-01' 
  AND date <= '2025-12-31'
  AND LOWER(brand) = LOWER('LifePro')
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;

-- ============================================
-- Query 4: Q4 2025 LifePro - Daily Totals (aggregated by date+brand+channel)
-- This matches what the dashboard aggregates client-side
-- ============================================
SELECT 
    date,
    channel,
    SUM(revenue) AS daily_revenue,
    COUNT(*) AS record_count
FROM sales_data
WHERE date >= '2025-10-01' 
  AND date <= '2025-12-31'
  AND LOWER(brand) = LOWER('LifePro')
GROUP BY date, channel
ORDER BY date DESC, channel
LIMIT 100; -- Show first 100 days (you can remove limit to see all)

-- ============================================
-- Query 5: Q4 2025 LifePro - Channel Totals with Percentage of Total
-- Helpful for understanding channel distribution
-- ============================================
WITH channel_totals AS (
    SELECT 
        channel,
        SUM(revenue) AS channel_revenue
    FROM sales_data
    WHERE date >= '2025-10-01' 
      AND date <= '2025-12-31'
      AND LOWER(brand) = LOWER('LifePro')
    GROUP BY channel
),
grand_total AS (
    SELECT SUM(channel_revenue) AS total FROM channel_totals
)
SELECT 
    ct.channel,
    ct.channel_revenue,
    ROUND((ct.channel_revenue / gt.total * 100)::numeric, 2) AS percentage_of_total
FROM channel_totals ct
CROSS JOIN grand_total gt
ORDER BY ct.channel_revenue DESC;



