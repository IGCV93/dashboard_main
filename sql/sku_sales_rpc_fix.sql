-- Fixed RPC Function for SKU Sales Aggregation
-- Run this in Supabase SQL Editor to fix the type mismatch error

CREATE OR REPLACE FUNCTION sku_sales_agg(
    start_date DATE,
    end_date DATE,
    channel_filter TEXT DEFAULT NULL,
    brand_filter TEXT DEFAULT NULL,
    sku_filter TEXT DEFAULT NULL,
    group_by TEXT DEFAULT 'sku'  -- 'sku', 'date', 'month', 'quarter'
)
RETURNS TABLE(
    period_date DATE,
    sku TEXT,
    channel TEXT,
    brand TEXT,
    total_units BIGINT,
    total_revenue NUMERIC,
    record_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN group_by = 'date' THEN sd.date
            WHEN group_by = 'month' THEN DATE_TRUNC('month', sd.date)::DATE
            WHEN group_by = 'quarter' THEN DATE_TRUNC('quarter', sd.date)::DATE
            ELSE sd.date  -- Default: group by SKU (aggregate all dates)
        END AS period_date,
        sd.sku::TEXT,        -- Cast VARCHAR to TEXT
        sd.channel::TEXT,    -- Cast VARCHAR to TEXT
        sd.brand::TEXT,      -- Cast VARCHAR to TEXT
        SUM(sd.units)::BIGINT AS total_units,
        SUM(sd.revenue)::NUMERIC AS total_revenue,
        COUNT(*)::BIGINT AS record_count
    FROM sku_sales_data sd
    WHERE sd.date BETWEEN start_date AND end_date
      AND (channel_filter IS NULL OR LOWER(sd.channel) = LOWER(channel_filter))
      AND (brand_filter IS NULL OR LOWER(sd.brand) = LOWER(brand_filter))
      AND (sku_filter IS NULL OR LOWER(sd.sku) = LOWER(sku_filter))
    GROUP BY 
        CASE
            WHEN group_by = 'date' THEN sd.date
            WHEN group_by = 'month' THEN DATE_TRUNC('month', sd.date)::DATE
            WHEN group_by = 'quarter' THEN DATE_TRUNC('quarter', sd.date)::DATE
            ELSE sd.date
        END,
        sd.sku,
        sd.channel,
        sd.brand
    ORDER BY total_revenue DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION sku_sales_agg(DATE, DATE, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Test the function (should work now)
SELECT * FROM sku_sales_agg(
    '2024-01-01'::DATE,
    '2024-12-31'::DATE,
    'Shopify'::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    'sku'::TEXT
) LIMIT 10;

