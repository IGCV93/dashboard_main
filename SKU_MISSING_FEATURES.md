# SKU Performance Feature - Missing Features List

## 🔴 High Priority (Implement First)

### 1. Export Functionality
- **Status**: ❌ Not Implemented
- **Description**: Export filtered/sorted SKU data to CSV/Excel
- **Requirements**:
  - Export button in filters section
  - Export current filtered view (respects search, brand filter, sort)
  - CSV format (simple)
  - Excel format (formatted with headers, colors)
  - Include all visible columns
  - Include comparison data if comparison mode is active
  - Include target status if targets are available
- **Estimated Effort**: 2-3 hours
- **User Value**: Very High - Users need to export data for analysis/reporting

### 2. Revenue Trend Chart
- **Status**: ❌ Not Implemented
- **Description**: Time-series line chart showing revenue trends over time
- **Requirements**:
  - Load SKU data grouped by date (`groupBy: 'date'`)
  - Line chart showing revenue over time
  - Support multiple SKU selection for comparison
  - Overlay target line if available
  - Toggle between daily/weekly/monthly granularity
  - Interactive tooltips
- **Estimated Effort**: 2-3 hours
- **User Value**: High - Visual trend analysis is crucial

---

## 🟡 Medium Priority

### 3. Custom Period Comparison
- **Status**: ⚠️ Button exists but disabled
- **Description**: Calendar-based period selection for custom comparisons
- **Requirements**:
  - Two date pickers (start/end for each period)
  - Smart period matching (warn if periods differ in length)
  - Side-by-side comparison view
  - Variance analysis
- **Estimated Effort**: 4-5 hours
- **User Value**: Medium - Useful for ad-hoc comparisons

### 4. Side-by-Side Comparison Charts
- **Status**: ❌ Not Implemented
- **Description**: Visual comparison charts (not just table indicators)
- **Requirements**:
  - Side-by-side bar charts for current vs comparison period
  - Growth indicators
  - Variance visualization
- **Estimated Effort**: 3-4 hours
- **User Value**: Medium - Better visual comparison

### 5. Date Range Picker for Filters
- **Status**: ❌ Not Implemented
- **Description**: Allow users to select custom date ranges beyond current period
- **Requirements**:
  - Calendar date picker
  - Quick selectors ("Last 7 days", "Last 30 days", "Last Quarter")
  - Update data when range changes
- **Estimated Effort**: 2-3 hours
- **User Value**: Medium - More flexible filtering

---

## 🟢 Low Priority (Performance Optimizations)

### 6. Virtual Scrolling
- **Status**: ❌ Not Implemented
- **Description**: Only render visible table rows for large datasets
- **Requirements**:
  - Implement virtual scrolling library or custom solution
  - Handle 1000+ SKUs efficiently
  - Maintain scroll position
  - Smooth scrolling performance
- **Estimated Effort**: 4-6 hours
- **User Value**: Low - Only needed for very large datasets (1000+ SKUs)

### 7. Advanced Pagination
- **Status**: ⚠️ Limited (shows first 100 rows)
- **Description**: Full pagination controls
- **Requirements**:
  - Previous/Next buttons
  - Page number display
  - Items per page selector
  - Jump to page
  - Total pages indicator
- **Estimated Effort**: 2-3 hours
- **User Value**: Low - Current 100-row limit may be sufficient

### 8. Progressive Data Loading
- **Status**: ❌ Not Implemented
- **Description**: Load data progressively as user scrolls
- **Requirements**:
  - Initial load: Top 100 SKUs
  - Load more as user scrolls
  - Loading indicators
- **Estimated Effort**: 3-4 hours
- **User Value**: Low - Current approach works for most cases

---

## Implementation Plan

### Phase 1: High Priority (Now)
1. ✅ Export Functionality
2. ✅ Revenue Trend Chart

### Phase 2: Medium Priority (Next)
3. Custom Period Comparison
4. Side-by-Side Comparison Charts
5. Date Range Picker

### Phase 3: Low Priority (If Needed)
6. Virtual Scrolling
7. Advanced Pagination
8. Progressive Data Loading

