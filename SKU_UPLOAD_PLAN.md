# SKU-Level Data Upload - Implementation Plan

## 📋 Overview

Add SKU-level data upload functionality to the existing Upload component, allowing users to upload SKU sales data to the `sku_sales_data` table alongside the existing channel-level `sales_data` uploads.

---

## 🔍 Current Upload System Analysis

### Current Flow:
1. **File Upload**: CSV/Excel file via drag-drop or file picker
2. **File Parsing**: Uses PapaParse (CSV) or XLSX (Excel)
3. **Data Validation**: 
   - Permission-based validation (brand/channel restrictions)
   - Date format validation
   - Required fields check
4. **Data Formatting**: Maps to `sales_data` table structure
5. **Database Insert**: Uses `dataService.batchSaveSalesData()` 
6. **Template Download**: Generates CSV template with allowed brands/channels

### Current Data Structure (sales_data):
- `date`, `channel`, `brand`, `revenue`
- Optional: `brand_id`, `channel_id`, `source`, `source_id`, `uploaded_by`, `upload_batch_id`

### SKU Data Structure (sku_sales_data):
- `date`, `channel`, `brand`, `sku`, `units`, `revenue`
- Optional: `product_name`, `source`, `source_id`, `uploaded_by`, `upload_batch_id`

---

## 🎯 Implementation Strategy

### Option 1: Auto-Detection (Recommended)
**Approach**: Automatically detect SKU data by checking for SKU column presence

**Pros:**
- Single upload interface
- User-friendly (no need to choose)
- Works with mixed files

**Cons:**
- Need robust detection logic
- Edge cases (missing SKU column but has Units)

**Detection Logic:**
```javascript
const hasSKUColumn = (headers) => {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    return normalizedHeaders.includes('sku') || 
           normalizedHeaders.includes('sku code') ||
           normalizedHeaders.includes('product sku');
};

const hasUnitsColumn = (headers) => {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    return normalizedHeaders.includes('units') || 
           normalizedHeaders.includes('quantity') ||
           normalizedHeaders.includes('qty');
};

// If has SKU column OR (has Units column AND no Revenue column), treat as SKU data
const isSKUData = hasSKUColumn(headers) || (hasUnitsColumn(headers) && !hasRevenueColumn(headers));
```

### Option 2: Separate Upload Section
**Approach**: Add a toggle or separate card for SKU uploads

**Pros:**
- Explicit user control
- Clear separation
- Easier to maintain

**Cons:**
- More UI complexity
- User must know which type to choose

### Option 3: Hybrid (Best UX)
**Approach**: Auto-detect but allow manual override

**Implementation:**
- Auto-detect on file upload
- Show detected type to user
- Allow manual toggle if detection is wrong
- Default to auto-detection

---

## 📝 Recommended Plan: Hybrid Approach

### Phase 1: Detection & UI
1. **Add Upload Type Toggle**
   - Radio buttons or toggle: "Channel Data" / "SKU Data" / "Auto-Detect"
   - Default: "Auto-Detect"
   - Show detected type after file parse

2. **Update Upload Cards**
   - Add SKU template download card
   - Show upload type indicator
   - Update validation messages for SKU data

### Phase 2: Data Service Extension
1. **Add `batchSaveSKUData()` method** to `dataService.js`
   - Similar to `batchSaveSalesData()`
   - Insert into `sku_sales_data` table
   - Handle deduplication (date + channel + brand + sku + source_id)
   - Batch processing for large files

2. **Add SKU validation logic**
   - Required: date, channel, brand, sku, units, revenue
   - Optional: product_name
   - Permission validation (same as sales_data)

### Phase 3: Template Generation
1. **SKU Template Format:**
   ```csv
   Date,Channel,Brand,SKU,Product Name,Units,Revenue
   2025-01-01,Shopify,LifePro,SKU-001,Product Name,10,250.00
   ```

2. **Template Download Function**
   - Generate CSV with SKU columns
   - Include allowed brands/channels
   - Add instructions

### Phase 4: Data Formatting & Upload
1. **SKU Data Formatter**
   - Map columns: Date, Channel, Brand, SKU, Units, Revenue, Product Name
   - Normalize brand/channel names (same as sales_data)
   - Generate source_id for deduplication
   - Handle date formats (same as sales_data)

2. **Upload Logic**
   - Route to `batchSaveSKUData()` if SKU data detected
   - Route to `batchSaveSalesData()` if channel data
   - Show appropriate success messages

---

## 🗄️ Database Considerations

### Table: `sku_sales_data`
- **Unique Constraint**: `(date, channel, brand, sku, source_id)`
- **Deduplication**: Use `ON CONFLICT` or check before insert
- **Batch Size**: Same as sales_data (1000-2000 rows per batch)

### Data Validation:
- **Required Fields**: date, channel, brand, sku, units, revenue
- **Data Types**: 
  - date: DATE
  - channel, brand, sku: VARCHAR(100)
  - units: INTEGER
  - revenue: DECIMAL(12, 2)
  - product_name: VARCHAR(255) (optional)

---

## 📊 File Format Detection

### SKU Data Indicators:
1. **Column Names** (case-insensitive):
   - `SKU`, `SKU Code`, `Product SKU`, `Item SKU`
   - `Units`, `Quantity`, `Qty`
   - `Product Name`, `Product Name`, `Item Name`

2. **Column Combination**:
   - Has SKU column → SKU data
   - Has Units column + no Revenue column → SKU data
   - Has both SKU and Revenue → SKU data (preferred)

### Channel Data Indicators:
1. **Column Names**:
   - `Revenue` (without SKU/Units columns)
   - `Sales`, `Amount`

2. **Column Combination**:
   - Has Revenue but no SKU/Units → Channel data

---

## 🎨 UI/UX Design

### Upload Type Selector:
```
┌─────────────────────────────────────┐
│ Upload Type:                        │
│ ○ Auto-Detect (Recommended)        │
│ ○ Channel Sales Data                │
│ ○ SKU-Level Data                    │
└─────────────────────────────────────┘
```

### After File Parse:
```
┌─────────────────────────────────────┐
│ ✅ File parsed: 1,234 records      │
│ 📊 Detected: SKU-Level Data         │
│ [Change Type] [Continue]            │
└─────────────────────────────────────┘
```

### Template Cards:
```
┌──────────────────┐  ┌──────────────────┐
│ 📄 Channel       │  │ 📄 SKU Data      │
│ Template         │  │ Template         │
│                  │  │                  │
│ [Download]       │  │ [Download]       │
└──────────────────┘  └──────────────────┘
```

---

## 🔧 Technical Implementation Details

### 1. Detection Function
```javascript
const detectUploadType = (headers, sampleRow) => {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    
    const hasSKU = normalizedHeaders.some(h => 
        h.includes('sku') || h === 'sku code' || h === 'product sku'
    );
    const hasUnits = normalizedHeaders.some(h => 
        h.includes('units') || h.includes('quantity') || h === 'qty'
    );
    const hasRevenue = normalizedHeaders.some(h => 
        h.includes('revenue') || h.includes('sales') || h.includes('amount')
    );
    
    if (hasSKU || (hasUnits && !hasRevenue)) {
        return 'sku';
    }
    return 'channel';
};
```

### 2. SKU Data Validation
```javascript
const validateSKUData = (row, index) => {
    const errors = [];
    
    // Required fields
    if (!row.SKU && !row.sku) errors.push('SKU is required');
    if (!row.Units && row.Units !== 0 && !row.units && row.units !== 0) {
        errors.push('Units is required');
    }
    if (!row.Revenue && row.Revenue !== 0 && !row.revenue && row.revenue !== 0) {
        errors.push('Revenue is required');
    }
    
    // Data type validation
    const units = parseInt(row.Units || row.units);
    if (isNaN(units) || units < 0) {
        errors.push('Units must be a non-negative integer');
    }
    
    const revenue = parseFloat(row.Revenue || row.revenue);
    if (isNaN(revenue) || revenue < 0) {
        errors.push('Revenue must be a non-negative number');
    }
    
    return errors;
};
```

### 3. SKU Data Formatting
```javascript
const formatSKUData = (row, index, batchId, brandMap, channelMap) => {
    return {
        date: formatDate(row.Date || row.date),
        channel: normalizeChannel(row.Channel || row.channel, channelMap),
        brand: normalizeBrand(row.Brand || row.brand, brandMap),
        sku: String(row.SKU || row.sku || '').trim(),
        units: parseInt(row.Units || row.units || 0),
        revenue: parseFloat(row.Revenue || row.revenue || 0),
        product_name: row['Product Name'] || row.product_name || null,
        source: 'manual',
        source_id: buildSKUSourceId(date, channel, brand, sku, index),
        uploaded_by: currentUser?.id,
        upload_batch_id: batchId
    };
};
```

---

## 📋 Implementation Checklist

### Step 1: Data Service Extension
- [ ] Add `batchSaveSKUData()` method
- [ ] Add `saveSKUData()` helper method
- [ ] Handle deduplication (ON CONFLICT)
- [ ] Add error handling and retry logic

### Step 2: Upload Component Updates
- [ ] Add upload type selector (Auto/Channel/SKU)
- [ ] Add detection function
- [ ] Add SKU validation function
- [ ] Add SKU data formatting function
- [ ] Update upload flow to route to correct method
- [ ] Add SKU template download function

### Step 3: UI Updates
- [ ] Add SKU template download card
- [ ] Add upload type selector
- [ ] Show detected type after parse
- [ ] Update validation messages for SKU data
- [ ] Update success messages

### Step 4: Testing
- [ ] Test SKU data detection
- [ ] Test SKU data validation
- [ ] Test SKU data upload
- [ ] Test deduplication
- [ ] Test permission validation
- [ ] Test template generation

---

## 🎯 Recommended Approach: Hybrid with Auto-Detection

**Primary Method**: Auto-detect upload type
**Fallback**: Manual selection if detection fails
**User Control**: Show detected type, allow override

**Benefits:**
- Best user experience (no manual selection needed)
- Handles edge cases (manual override)
- Clear feedback (shows what was detected)
- Maintains single upload interface

---

## 📝 Questions to Confirm

1. **Detection Priority**: Should we prefer SKU detection if both SKU and Revenue columns exist?
   - **Recommendation**: Yes, if SKU column exists, treat as SKU data

2. **Mixed Files**: What if file has both channel and SKU data?
   - **Recommendation**: Detect primary type, reject mismatched rows

3. **Units Column**: If file has Units but no SKU, what should we do?
   - **Recommendation**: Require SKU column for SKU data (Units alone isn't enough)

4. **Template**: Should SKU template include sample data?
   - **Recommendation**: Yes, include 2-3 sample rows

5. **Deduplication**: Should we update existing records or skip?
   - **Recommendation**: Skip duplicates (ON CONFLICT DO NOTHING)

---

## 🚀 Next Steps

1. Review and approve this plan
2. Confirm detection strategy
3. Implement dataService methods
4. Update Upload component
5. Add templates
6. Test with sample data

