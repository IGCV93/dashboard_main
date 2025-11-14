# SKU Performance Feature - Quick Summary

## 🎯 Objective
Add SKU-level performance analysis when users click on a channel card, showing detailed SKU sales data with comparisons, filters, and visualizations.

## 📊 Data Structure

### Database Table: `sku_sales_data`
- **Fields**: date, channel, brand, sku, units, revenue, product_name
- **Volume**: ~43K rows for Shopify alone (2024 to Oct 15)
- **Strategy**: Separate table (NOT extending sales_data) for performance

## 🚀 Key Features

### 1. **SKU Performance Table**
- Virtual scrolling (handles 40K+ rows)
- Sortable columns: SKU, Units, Revenue, Contribution %, Growth %
- Search/filter by SKU code or product name
- Pagination: 100 SKUs per page

### 2. **Comparisons**
- **YOY**: Compare to same period last year
- **MOM**: Compare to previous month (monthly view only)
- **Custom**: Select any two periods with smart matching

### 3. **Target Contribution**
- Shows how each SKU contributes to channel target
- Calculates gap: how much more revenue needed
- Visual indicators: Green (exceeding), Yellow (on track), Red (underperforming)

### 4. **Visualizations**
- Top SKUs bar chart (top 20)
- Revenue trend over time (line chart)
- SKU contribution pie chart
- Comparison charts (side-by-side)

### 5. **Summary Cards**
- Top Performers (top 5 SKUs)
- Underperformers (below target)
- Growth Leaders (top 5 by growth %)
- Channel Summary (totals and averages)

## 🎨 UI Layout

```
[Back Button] [Breadcrumb Navigation]
[Period Selector] [Comparison Toggle]
[Summary Cards Row - 4 cards]
[Filters: Search, Brand, Sort]
[Charts Section - 2 charts side-by-side]
[SKU Performance Table - Virtual Scrolling]
```

## ⚡ Performance Optimizations

1. **Server-Side Aggregation**: Use RPC functions for fast queries
2. **Virtual Scrolling**: Only render visible rows (50-100 at a time)
3. **Progressive Loading**: Summary → Charts → Table
4. **Caching**: 5-minute cache for aggregated data
5. **Pagination**: Load 100 SKUs per page

## 🔄 Navigation Flow

1. User clicks channel card on Dashboard
2. Navigate to: `/sku-performance?channel=Shopify&brand=LifePro&period=Q4&year=2025`
3. Store dashboard state in sessionStorage
4. Breadcrumb allows easy return to exact dashboard view

## 📈 Comparison Logic

### YOY Example:
- Current: Q4 2025
- Compare: Q4 2024
- Show: Growth %, Growth Amount ($), Visual indicators

### MOM Example:
- Current: January 2025
- Compare: December 2024
- Show: Growth %, Growth Amount ($)

### Custom Comparison:
- Select any two periods
- Smart matching: Suggests similar periods (e.g., Q4 2024 when comparing Q4 2025)
- Warns if periods have different lengths

## 🎯 Target Contribution Calculation

**Method**: Historical Average
1. Calculate SKU's historical % of channel revenue
2. Apply % to current channel target = SKU target contribution
3. Compare actual vs target = performance %

**Display**:
- Contribution %: (SKU Revenue / Channel Total) × 100
- Target Performance: (Actual / Target) × 100
- Gap: Target - Actual (with $ amount)

## 🗄️ Database Schema Highlights

```sql
CREATE TABLE sku_sales_data (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    channel VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    units INTEGER NOT NULL,
    revenue DECIMAL(12, 2) NOT NULL,
    product_name VARCHAR(255),
    -- ... indexes for performance
);
```

**Key Indexes**:
- `idx_sku_sales_date_channel_brand` - For filtered queries
- `idx_sku_sales_date_channel_sku` - For SKU trend queries
- `idx_sku_sales_query_optimizer` - Composite for common patterns

## 📋 Implementation Phases

### Phase 1 (Weeks 1-2): Foundation
- Database schema & RPC functions
- Basic component structure
- Routing & navigation
- Virtual scrolling table

### Phase 2 (Weeks 3-4): Core Features
- Filters & search
- Summary cards
- YOY/MOM comparisons
- Target contribution

### Phase 3 (Week 5): Visualizations
- Charts (bar, line, pie)
- Comparison charts

### Phase 4 (Week 6): Advanced
- Custom period comparison
- Export functionality
- Performance optimizations

### Phase 5 (Week 7): Polish
- Responsive design
- Error handling
- Testing & refinements

## ❓ Questions to Answer

1. **Product Names**: Do we have product names for SKUs, or just codes?
2. **Historical Data**: How far back does SKU data go? (needed for YOY)
3. **Data Updates**: How frequently is SKU data updated?
4. **Default View**: Table, Charts, or Summary Cards first?
5. **Export Format**: CSV, Excel, or both?

## 🎯 Success Metrics

- Page load: < 2 seconds
- Table scroll: 60 FPS
- Chart render: < 500ms
- Memory: < 50MB for full dataset

## 📝 Next Steps

1. ✅ Review this plan
2. ⏳ Answer questions above
3. ⏳ Approve database schema
4. ⏳ Begin Phase 1 implementation

---

**See `SKU_PERFORMANCE_PLAN.md` for full detailed plan.**


