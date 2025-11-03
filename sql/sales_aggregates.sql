-- Sales aggregates RPC function for Supabase
-- Run this in the Supabase SQL editor

-- Optional: helpful index suggestions for speed (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_sales_data_date ON public.sales_data(date);
CREATE INDEX IF NOT EXISTS idx_sales_data_brand_key ON public.sales_data(LOWER(brand));
CREATE INDEX IF NOT EXISTS idx_sales_data_channel_key ON public.sales_data(LOWER(channel));

-- Function: sales_agg
-- Returns aggregated revenue grouped by a chosen grain ('day' | 'month' | 'quarter')
-- Filters are optional; pass NULL for brand_filter/channel_filter to include all
CREATE OR REPLACE FUNCTION public.sales_agg(
    start_date date,
    end_date date,
    brand_filter text DEFAULT NULL,
    channel_filter text DEFAULT NULL,
    group_by text DEFAULT 'month'
)
RETURNS TABLE(
    period_date date,
    brand text,
    channel text,
    revenue numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN group_by = 'day' THEN sd.date::date
            WHEN group_by = 'quarter' THEN date_trunc('quarter', sd.date)::date
            ELSE date_trunc('month', sd.date)::date -- default 'month'
        END AS period_date,
        sd.brand,
        sd.channel,
        SUM(sd.revenue)::numeric AS revenue
    FROM public.sales_data sd
    WHERE sd.date BETWEEN start_date AND end_date
      AND (brand_filter IS NULL OR LOWER(sd.brand) = LOWER(brand_filter))
      AND (channel_filter IS NULL OR LOWER(sd.channel) = LOWER(channel_filter))
    GROUP BY 1, 2, 3
    ORDER BY 1 DESC, 2, 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to anon/authenticated roles
GRANT EXECUTE ON FUNCTION public.sales_agg(date, date, text, text, text) TO anon, authenticated;

-- Function: sales_channel_agg
-- Returns aggregated revenue grouped by channel (like SQL GROUP BY channel)
-- This is much faster than loading all records - returns only 1 row per channel
CREATE OR REPLACE FUNCTION public.sales_channel_agg(
    start_date date,
    end_date date,
    brand_filter text DEFAULT NULL
)
RETURNS TABLE(
    channel text,
    total_revenue numeric,
    record_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sd.channel::text,
        SUM(sd.revenue)::numeric AS total_revenue,
        COUNT(*)::bigint AS record_count
    FROM public.sales_data sd
    WHERE sd.date BETWEEN start_date AND end_date
      AND (brand_filter IS NULL OR LOWER(sd.brand) = LOWER(brand_filter))
    GROUP BY sd.channel
    ORDER BY total_revenue DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to anon/authenticated roles
GRANT EXECUTE ON FUNCTION public.sales_channel_agg(date, date, text) TO anon, authenticated;




