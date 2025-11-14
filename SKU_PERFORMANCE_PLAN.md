# SKU-Level Performance Feature - Implementation Plan

## Executive Summary

This document outlines the complete plan for adding SKU-level performance analysis to the Chai Vision Dashboard. The feature will allow users to drill down from channel-level performance to detailed SKU analysis with comprehensive comparisons, filtering, and visualization capabilities.

---

## 1. Database Architecture

### 1.1 Recommended Approach: Hybrid Model

**Decision: Create separate `sku_sales_data` table** (NOT extending `sales_data`)

**Rationale:**
- `sales_data` is optimized for aggregated dashboard queries (day+channel+brand level)
- SKU data is much more granular (43,843 rows for Shopify alone from 2024 to Oct 15)
- Separation allows independent optimization and scaling
- Maintains dashboard performance while enabling detailed SKU analysis
- Can aggregate SKU data to populate `sales_data` if needed for reconciliation

### 1.2 Database Schema

```sql
-- SKU Sales Data Table
CREATE TABLE sku_sales_data (
    id BIGSERIAL PRIMARY KEY,
    
    -- Core Dimensions
    date DATE NOT NULL,
    channel VARCHAR(100) NOT NULL,  -- Maps to sales_data.channel
    brand VARCHAR(100) NOT NULL,   -- Maps to sales_data.brand
    sku VARCHAR(100) NOT NULL,      -- Stock Keeping Unit identifier
    
    -- Metrics
    units INTEGER NOT NULL DEFAULT 0,
    revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
    
    -- Metadata
    product_name VARCHAR(255),       -- Optional: human-readable product name
    source VARCHAR(50) DEFAULT 'manual',
    source_id VARCHAR(255),          -- For deduplication
    uploaded_by UUID REFERENCES profiles(id),
    upload_batch_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT sku_sales_data_unique UNIQUE (date, channel, brand, sku, source_id)
);

-- Critical Indexes for Performance
CREATE INDEX idx_sku_sales_date ON sku_sales_data(date DESC);
CREATE INDEX idx_sku_sales_channel ON sku_sales_data(channel);
CREATE INDEX idx_sku_sales_brand ON sku_sales_data(brand);
CREATE INDEX idx_sku_sales_sku ON sku_sales_data(sku);
CREATE INDEX idx_sku_sales_date_channel_brand ON sku_sales_data(date, channel, brand);
CREATE INDEX idx_sku_sales_date_channel_sku ON sku_sales_data(date, channel, sku);

-- Composite index for common query patterns
CREATE INDEX idx_sku_sales_query_optimizer ON sku_sales_data(channel, brand, date DESC, sku);

-- RLS Policy (if needed)
ALTER TABLE sku_sales_data ENABLE ROW LEVEL SECURITY;

-- RPC Function for Aggregated SKU Queries (Performance Critical)
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
        sd.sku,
        sd.channel,
        sd.brand,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION sku_sales_agg(DATE, DATE, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
```

### 1.3 Data Loading Strategy

**For Large Datasets (43K+ rows):**
1. **Server-Side Aggregation**: Always use RPC functions for initial loads
2. **Pagination**: Load SKUs in batches of 100-200 at a time
3. **Virtual Scrolling**: Implement client-side virtualization for table rendering
4. **Progressive Loading**: Load top SKUs first, then lazy-load rest
5. **Caching**: Cache aggregated results for 5 minutes (same as dashboard)

---

## 2. Routing & Navigation

### 2.1 Route Structure

```
/sku-performance?channel={channel}&brand={brand}&period={period}&year={year}&month={month}
```

**Example:**
```
/sku-performance?channel=Shopify&brand=LifePro&period=Q4&year=2025
```

### 2.2 Navigation Flow

1. **From Dashboard**: Click channel card → Navigate to SKU Performance page
2. **Breadcrumb Navigation**: 
   - Dashboard → Channel Performance → SKU Performance
   - Click breadcrumb to return to exact dashboard state
3. **Back Button**: Store previous dashboard state in sessionStorage
4. **URL State Management**: All filters stored in URL for shareability

### 2.3 Routing Implementation

**Update `src/js/utils/routing.js`:**
- Add `sku-performance` to VALID_SECTIONS
- Add helper functions for SKU performance route building
- Store/restore dashboard state when navigating

---

## 3. Component Architecture

### 3.1 New Component: `SKUPerformance.js`

**Location:** `src/js/components/SKUPerformance.js`

**Responsibilities:**
- Main container for SKU performance view
- Coordinate data loading, filtering, and display
- Handle comparison logic (YOY, MOM, custom periods)

**Props:**
```javascript
{
    channel: string,           // Required: channel name
    brand: string,             // Optional: brand filter
    view: 'annual'|'quarterly'|'monthly',
    selectedPeriod: string,    // Q1, Q2, Q3, Q4
    selectedYear: string,
    selectedMonth: number,
    dataService: DataService,
    userPermissions: object,
    onNavigateBack: function
}
```

### 3.2 Sub-Components

#### 3.2.1 `SKUPerformanceHeader.js`
- Breadcrumb navigation
- Period selector (with comparison mode toggle)
- Channel/Brand display
- Quick stats summary

#### 3.2.2 `SKUPerformanceFilters.js`
- Brand filter (if multiple brands in channel)
- SKU search/filter
- Date range picker (for custom comparisons)
- Sort options (Revenue, Units, Growth %, Contribution %)
- View toggle (Table, Chart, Summary Cards)

#### 3.2.3 `SKUPerformanceTable.js`
- Virtual scrolling table (handles 40K+ rows)
- Sortable columns
- Expandable rows for trend details
- Export functionality

#### 3.2.4 `SKUPerformanceCharts.js`
- Top SKUs bar chart
- Revenue trend over time (line chart)
- SKU contribution pie chart
- Comparison charts (YOY, MOM overlays)

#### 3.2.5 `SKUPerformanceSummary.js`
- Summary cards (Top Performers, Underperformers, Growth Leaders)
- KPI contribution metrics
- Target gap analysis

#### 3.2.6 `SKUComparisonPanel.js`
- Side-by-side period comparison
- Growth metrics
- Variance analysis

---

## 4. Data Service Extensions

### 4.1 New Methods in `DataService`

```javascript
// Load SKU data with aggregation
async loadSKUData(filters = {}) {
    // Uses RPC function for performance
    // Returns aggregated SKU data
}

// Load SKU comparison data (for YOY, MOM)
async loadSKUComparison(currentFilters, comparisonFilters) {
    // Loads two periods for comparison
    // Returns structured comparison data
}

// Load SKU trends (for charts)
async loadSKUTrends(filters, granularity = 'day') {
    // Returns time-series data for trend charts
}

// Search/filter SKUs
async searchSKUs(query, filters) {
    // Full-text search on SKU codes and product names
}
```

### 4.2 Caching Strategy

- **Aggregated SKU Data**: 5-minute cache (same as dashboard)
- **Comparison Data**: 10-minute cache (less frequently accessed)
- **Search Results**: 2-minute cache (user-driven queries)
- **Chart Data**: 5-minute cache

---

## 5. Features & Functionality

### 5.1 Core Features

#### 5.1.1 SKU List View
- **Virtual Scrolling Table** with columns:
  - SKU Code
  - Product Name (if available)
  - Units Sold
  - Revenue
  - Revenue % of Channel Total
  - Units % of Channel Total
  - Average Unit Price
  - Contribution to Channel Target (%)
  - Growth Indicators (YOY, MOM)
  
- **Sorting**: By any column (default: Revenue DESC)
- **Pagination**: Server-side pagination (100 SKUs per page)
- **Search**: Real-time SKU code/product name search

#### 5.1.2 Comparison Features

**Year-over-Year (YOY):**
- Compare current period to same period last year
- Show: Revenue change, Units change, Growth %
- Visual indicators (↑ green, ↓ red)

**Month-over-Month (MOM):**
- Compare current month to previous month
- Show: Revenue change, Units change, Growth %
- Only available for monthly view

**Custom Period Comparison:**
- Select two periods from calendar pickers
- Smart period matching:
  - If comparing Q4 2025, suggest Q4 2024
  - If comparing Jan 2025, suggest Jan 2024
  - Warn if periods are different lengths
- Side-by-side comparison view
- Variance analysis

#### 5.1.3 Target Contribution Analysis

**For each SKU, show:**
- **Revenue Contribution**: % of total channel revenue
- **Target Contribution**: How much this SKU should contribute (based on historical average or manual allocation)
- **Gap Analysis**: 
  - If channel is at 80% of target, show which SKUs are underperforming
  - Calculate "revenue needed" from each SKU to hit target
- **Visual Indicators**:
  - Green: Contributing positively to target
  - Yellow: On track
  - Red: Underperforming

**Calculation:**
```
SKU Target Contribution = (SKU Historical Avg % of Channel) × Channel Target
SKU Gap = SKU Target Contribution - SKU Actual Revenue
SKU Performance % = (SKU Actual Revenue / SKU Target Contribution) × 100
```

#### 5.1.4 Filters

**Brand Filter:**
- Dropdown if multiple brands in channel
- "All Brands" option
- Respects user permissions

**SKU Search:**
- Real-time search as user types
- Searches SKU code and product name
- Debounced (500ms delay)

**Date Range:**
- Calendar picker for custom ranges
- Quick selectors: "Last 7 days", "Last 30 days", "Last Quarter", etc.

**Sort Options:**
- Revenue (High to Low / Low to High)
- Units (High to Low / Low to High)
- Growth % (YOY / MOM)
- Contribution % (High to Low)
- Alphabetical (SKU Code)

**View Options:**
- Table View (default)
- Chart View (top 20 SKUs)
- Summary Cards View

### 5.2 Visualizations

#### 5.2.1 Top SKUs Bar Chart
- Horizontal bar chart
- Top 20 SKUs by revenue
- Color-coded by performance vs target
- Tooltip shows: Revenue, Units, Contribution %, Growth %

#### 5.2.2 Revenue Trend Chart
- Line chart showing revenue over time
- Multiple SKUs can be selected for comparison
- Overlay target line
- Toggle between daily/weekly/monthly granularity

#### 5.2.3 SKU Contribution Pie Chart
- Shows top 10 SKUs + "Others" category
- Interactive: Click slice to filter table
- Shows percentage of total channel revenue

#### 5.2.4 Comparison Charts
- Side-by-side bar charts for period comparisons
- Growth indicators
- Variance visualization

### 5.3 Summary Cards

**Top Performers Card:**
- Top 5 SKUs by revenue
- Quick stats: Total revenue, Units, Growth %

**Underperformers Card:**
- SKUs below target contribution
- Shows gap to target
- Sorted by gap size

**Growth Leaders Card:**
- Top 5 SKUs by YOY/MOM growth %
- Shows growth percentage and revenue impact

**Channel Summary Card:**
- Total SKUs in channel
- Total revenue from all SKUs
- Average revenue per SKU
- Top SKU contribution %

---

## 6. Performance Optimizations

### 6.1 Data Loading Strategy

**Initial Load:**
1. Load aggregated SKU summary (top 100 SKUs) via RPC
2. Show summary cards immediately
3. Load full dataset in background
4. Progressive rendering as data arrives

**Table Rendering:**
1. **Virtual Scrolling**: Only render visible rows (50-100 at a time)
2. **Lazy Loading**: Load next page as user scrolls
3. **Debounced Search**: Wait 500ms after user stops typing
4. **Memoized Calculations**: Cache computed values (contribution %, growth %)

**Chart Rendering:**
1. Limit to top 20 SKUs for initial render
2. Lazy load full dataset for export
3. Use Chart.js with performance optimizations
4. Debounce chart updates (100ms delay)

### 6.2 Caching Strategy

**Client-Side:**
- Cache aggregated SKU data for 5 minutes
- Cache comparison data for 10 minutes
- Cache search results for 2 minutes
- Use IndexedDB for large datasets (if browser supports)

**Server-Side (RPC):**
- Database query caching (PostgreSQL query cache)
- Materialized views for common aggregations (optional)

### 6.3 Pagination & Virtualization

**Table Pagination:**
- Server-side pagination: 100 SKUs per page
- Virtual scrolling: Render only visible rows
- Infinite scroll: Load next page on scroll

**Chart Data Limiting:**
- Top 20 SKUs for initial display
- Option to "Show All" (loads full dataset)

---

## 7. UI/UX Design

### 7.1 Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ [← Back] Breadcrumb: Dashboard > Shopify > SKU Analysis │
├─────────────────────────────────────────────────────────┤
│ Period: Q4 2025  [Compare: YOY | MOM | Custom]         │
│ Channel: Shopify | Brand: LifePro                        │
├─────────────────────────────────────────────────────────┤
│ [Summary Cards Row]                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ Top SKUs │ │ Growth   │ │ Underper │ │ Channel  │  │
│ │          │ │ Leaders  │ │ formers  │ │ Summary  │  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│ [Filters Row]                                           │
│ Search: [________] Brand: [Dropdown] Sort: [Revenue▼]  │
├─────────────────────────────────────────────────────────┤
│ [Charts Section]                                        │
│ ┌────────────────────┐ ┌────────────────────┐        │
│ │ Top SKUs Bar Chart  │ │ Revenue Trend      │        │
│ └────────────────────┘ └────────────────────┘        │
├─────────────────────────────────────────────────────────┤
│ [SKU Performance Table]                                │
│ ┌──────┬──────────┬──────┬─────────┬──────────┬───┐   │
│ │ SKU  │ Product  │Units │ Revenue │ Contrib% │...│   │
│ ├──────┼──────────┼──────┼─────────┼──────────┼───┤   │
│ │ ...  │ ...      │ ...  │ ...     │ ...      │...│   │
│ └──────┴──────────┴──────┴─────────┴──────────┴───┘   │
│ [Virtual Scrolling - 100 rows visible]                 │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Responsive Design

**Desktop (>1024px):**
- Full layout with all sections visible
- Side-by-side charts
- Full table with all columns

**Tablet (768px - 1024px):**
- Stacked charts
- Table with horizontal scroll
- Collapsible filters

**Mobile (<768px):**
- Single column layout
- Collapsible sections
- Simplified table (key columns only)
- Swipeable cards

### 7.3 Loading States

- **Initial Load**: Skeleton screens for table and charts
- **Progressive Loading**: Show summary cards first, then charts, then table
- **Pagination Loading**: Loading indicator at bottom of table
- **Search Loading**: Debounced spinner in search input

### 7.4 Error States

- **No Data**: Friendly message with suggestion to check filters
- **Load Error**: Retry button with error details
- **Permission Error**: Clear message about access restrictions

---

## 8. Comparison Logic Details

### 8.1 Year-over-Year (YOY)

**Calculation:**
```javascript
// Current period: Q4 2025
// Comparison period: Q4 2024
const currentRevenue = sku.revenue; // Q4 2025
const previousRevenue = sku.yoyData.revenue; // Q4 2024
const growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
const growthAmount = currentRevenue - previousRevenue;
```

**Display:**
- Growth % with color indicator (green ↑, red ↓)
- Growth amount ($)
- Visual comparison in charts

### 8.2 Month-over-Month (MOM)

**Calculation:**
```javascript
// Current: January 2025
// Previous: December 2024
const currentRevenue = sku.revenue; // Jan 2025
const previousRevenue = sku.momData.revenue; // Dec 2024
const growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
```

**Display:**
- Growth % with color indicator
- Growth amount ($)
- Only available for monthly view

### 8.3 Custom Period Comparison

**Smart Period Matching:**
```javascript
function getSuggestedComparisonPeriod(currentPeriod) {
    if (currentPeriod.view === 'quarterly') {
        // Suggest same quarter, previous year
        return {
            view: 'quarterly',
            period: currentPeriod.period, // Same quarter
            year: (parseInt(currentPeriod.year) - 1).toString()
        };
    } else if (currentPeriod.view === 'monthly') {
        // Suggest same month, previous year OR previous month
        return {
            view: 'monthly',
            month: currentPeriod.month,
            year: (parseInt(currentPeriod.year) - 1).toString()
        };
    }
    // ... etc
}
```

**Period Length Validation:**
```javascript
function validatePeriodComparison(period1, period2) {
    const days1 = getDaysInPeriod(period1);
    const days2 = getDaysInPeriod(period2);
    
    if (Math.abs(days1 - days2) > 2) {
        // Warn user: "Periods have different lengths. Comparison may be skewed."
        return {
            valid: true,
            warning: `Period 1: ${days1} days, Period 2: ${days2} days`
        };
    }
    return { valid: true };
}
```

**Comparison Display:**
- Side-by-side table columns
- Variance column (difference)
- Growth % column
- Visual comparison charts

---

## 9. Target Contribution Calculation

### 9.1 Methodology

**Option 1: Historical Average (Recommended)**
```javascript
// Calculate SKU's historical average % of channel revenue
const historicalAvgPercent = (sku.historicalRevenue / channel.historicalRevenue) * 100;

// Apply to current channel target
const skuTargetContribution = (channelTarget * historicalAvgPercent) / 100;

// Calculate performance
const skuPerformance = (sku.currentRevenue / skuTargetContribution) * 100;
```

**Option 2: Manual Allocation (Future Enhancement)**
- Allow admins to set SKU-level targets
- Store in `sku_targets` table
- Use manual targets if available, fallback to historical average

### 9.2 Display Logic

**Contribution %:**
```
SKU Contribution % = (SKU Revenue / Channel Total Revenue) × 100
```

**Target Performance:**
```
SKU Target Performance = (SKU Actual Revenue / SKU Target Contribution) × 100

If > 100%: Green indicator (exceeding target)
If 85-100%: Yellow indicator (on track)
If < 85%: Red indicator (underperforming)
```

**Gap Analysis:**
```
Gap to Target = SKU Target Contribution - SKU Actual Revenue
Gap % = (Gap to Target / SKU Target Contribution) × 100
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create database schema and RPC functions
- [ ] Extend DataService with SKU data methods
- [ ] Create SKUPerformance component structure
- [ ] Implement routing and navigation
- [ ] Basic table view with virtual scrolling

### Phase 2: Core Features (Week 3-4)
- [ ] Implement filters (search, brand, sort)
- [ ] Add summary cards
- [ ] Implement YOY comparison
- [ ] Implement MOM comparison
- [ ] Add target contribution calculations

### Phase 3: Visualizations (Week 5)
- [ ] Top SKUs bar chart
- [ ] Revenue trend chart
- [ ] SKU contribution pie chart
- [ ] Comparison charts

### Phase 4: Advanced Features (Week 6)
- [ ] Custom period comparison
- [ ] Export functionality
- [ ] Advanced filtering
- [ ] Performance optimizations

### Phase 5: Polish & Testing (Week 7)
- [ ] Responsive design
- [ ] Error handling
- [ ] Loading states
- [ ] User testing and refinements

---

## 11. Technical Considerations

### 11.1 Data Volume Handling

**For 43,843 rows (Shopify 2024-Oct 15):**
- Use RPC aggregation to reduce to ~500-1000 unique SKUs
- Virtual scrolling: Only render 50-100 rows at a time
- Pagination: Load 100 SKUs per page
- Estimated memory: ~5-10MB for full dataset (acceptable)

### 11.2 Query Performance

**Optimized Queries:**
- Always use indexed columns (date, channel, brand, sku)
- Use RPC functions for aggregation (server-side)
- Limit result sets with pagination
- Use materialized views for common queries (optional)

**Query Examples:**
```sql
-- Fast: Aggregated SKU summary
SELECT sku, SUM(revenue), SUM(units)
FROM sku_sales_data
WHERE date BETWEEN '2024-01-01' AND '2024-10-15'
  AND channel = 'Shopify'
GROUP BY sku
ORDER BY SUM(revenue) DESC
LIMIT 100;

-- Fast: Single SKU trend
SELECT date, SUM(revenue), SUM(units)
FROM sku_sales_data
WHERE sku = 'LP-BRMDYR-BLK'
  AND date BETWEEN '2024-01-01' AND '2024-10-15'
GROUP BY date
ORDER BY date;
```

### 11.3 Caching Strategy

**Client-Side:**
- Cache aggregated data: 5 minutes
- Cache comparison data: 10 minutes
- Cache search results: 2 minutes
- Invalidate on data upload

**Server-Side:**
- PostgreSQL query cache
- Consider materialized views for monthly/quarterly aggregates

### 11.4 Error Handling

**Network Errors:**
- Retry with exponential backoff
- Show user-friendly error messages
- Fallback to cached data if available

**Data Errors:**
- Validate SKU data on load
- Handle missing comparison data gracefully
- Show warnings for incomplete periods

---

## 12. Testing Strategy

### 12.1 Unit Tests
- SKU data aggregation logic
- Comparison calculations (YOY, MOM)
- Target contribution calculations
- Filter/search logic

### 12.2 Integration Tests
- Data loading with various filters
- Navigation flow
- Comparison period selection
- Export functionality

### 12.3 Performance Tests
- Load time with 40K+ rows
- Virtual scrolling performance
- Chart rendering with 100+ SKUs
- Memory usage monitoring

### 12.4 User Acceptance Tests
- End-to-end user flows
- Filter combinations
- Comparison scenarios
- Mobile responsiveness

---

## 13. Future Enhancements

### 13.1 Phase 2 Features (Post-MVP)
- SKU-level target setting (manual allocation)
- SKU forecasting/predictions
- SKU performance alerts
- SKU grouping/categorization
- Multi-SKU comparison tool
- SKU performance history tracking

### 13.2 Advanced Analytics
- SKU correlation analysis
- Seasonal trend analysis
- SKU lifecycle tracking
- Inventory integration
- Profit margin analysis (if cost data available)

---

## 14. Questions & Decisions Needed

### 14.1 Data Questions
1. **Product Names**: Do we have product names for SKUs, or just codes?
   - **Answer Needed**: From screenshot, we see SKU codes but need to confirm product names availability

2. **Historical Data**: How far back does SKU data go?
   - **Answer Needed**: For YOY comparisons, need at least 1 year of history

3. **Data Updates**: How frequently is SKU data updated?
   - **Answer Needed**: For cache invalidation strategy

### 14.2 Business Logic Questions
1. **Target Allocation**: Should SKU targets be based on historical average, or manual allocation?
   - **Recommendation**: Start with historical average, add manual allocation later

2. **Comparison Defaults**: What should be the default comparison view?
   - **Recommendation**: YOY for quarterly/annual, MOM for monthly

3. **SKU Grouping**: Should we support grouping SKUs (e.g., by product line)?
   - **Recommendation**: Phase 2 feature

### 14.3 UX Questions
1. **Default View**: Table, Charts, or Summary Cards first?
   - **Recommendation**: Summary Cards → Charts → Table (progressive disclosure)

2. **Export Format**: CSV, Excel, or both?
   - **Recommendation**: Both (CSV for data, Excel for formatted reports)

---

## 15. Success Metrics

### 15.1 Performance Metrics
- Page load time: < 2 seconds for initial render
- Table scroll performance: 60 FPS
- Chart render time: < 500ms
- Memory usage: < 50MB for full dataset

### 15.2 User Experience Metrics
- Time to find specific SKU: < 30 seconds
- Comparison setup time: < 10 seconds
- User satisfaction: > 4/5 rating

### 15.3 Business Metrics
- Feature adoption rate: % of users using SKU view
- Average session time on SKU page
- Export/download frequency

---

## Conclusion

This plan provides a comprehensive roadmap for implementing SKU-level performance analysis. The architecture is designed to handle large datasets efficiently while providing rich analytical capabilities. The phased approach allows for iterative development and user feedback.

**Next Steps:**
1. Review and approve this plan
2. Answer questions in Section 14
3. Set up database schema
4. Begin Phase 1 implementation

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-XX  
**Author:** AI Assistant  
**Status:** Draft - Awaiting Review


