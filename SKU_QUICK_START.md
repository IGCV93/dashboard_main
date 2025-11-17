# SKU Performance Feature - Quick Start Guide

## 🚀 First Steps to Implement

This guide walks you through the **first 4 steps** needed to get the SKU performance feature working.

---

## Step 1: Database Setup ⚠️ **START HERE**

### What You Need to Do:

1. **Open Supabase SQL Editor**
   - Go to your Supabase project
   - Navigate to SQL Editor

2. **Run the Table Creation Script**
   - Copy the SQL from `SKU_IMPLEMENTATION_ROADMAP.md` → Step 1
   - Run it in the SQL Editor
   - This creates:
     - `sku_sales_data` table
     - All necessary indexes
     - RPC function `sku_sales_agg`

3. **Verify It Worked**
   ```sql
   -- Test query
   SELECT COUNT(*) FROM sku_sales_data;
   -- Should return 0 (empty table is fine)
   ```

4. **Test the RPC Function**
   ```sql
   -- Test RPC (will return empty if no data, but shouldn't error)
   SELECT * FROM sku_sales_agg(
       '2024-01-01'::DATE,
       '2024-12-31'::DATE,
       'Shopify'::TEXT,
       NULL::TEXT,
       NULL::TEXT,
       'sku'::TEXT
   ) LIMIT 10;
   ```

### ✅ Checklist:
- [ ] Table created
- [ ] Indexes created
- [ ] RPC function created
- [ ] Test queries work (even if empty)

**Time Estimate:** 10-15 minutes

---

## Step 2: Add DataService Methods

### What You Need to Do:

1. **Open:** `src/js/services/dataService.js`

2. **Add Three New Methods:**
   - `loadSKUData()` - Main method to load SKU data
   - `loadSKUComparison()` - For YOY/MOM comparisons
   - `searchSKUs()` - For searching/filtering SKUs

3. **Copy Code:**
   - Get the code from `SKU_IMPLEMENTATION_ROADMAP.md` → Step 2
   - Add methods inside the `DataService` class

4. **Test:**
   ```javascript
   // In browser console after page loads:
   const dataService = window.APP_STATE.dataService;
   const testData = await dataService.loadSKUData({
       startDate: '2024-01-01',
       endDate: '2024-12-31',
       channel: 'Shopify',
       groupBy: 'sku'
   });
   console.log('SKU Data:', testData);
   ```

### ✅ Checklist:
- [ ] Methods added to DataService class
- [ ] No syntax errors
- [ ] Methods can be called (even if returns empty array)

**Time Estimate:** 20-30 minutes

---

## Step 3: Update Routing

### What You Need to Do:

1. **Open:** `src/js/utils/routing.js`

2. **Update VALID_SECTIONS:**
   ```javascript
   const VALID_SECTIONS = ['dashboard', 'upload', 'settings', 'sku-performance'];
   ```

3. **Add Helper Functions:**
   - `buildSKUPerformanceRoute()` - Builds URL for SKU page
   - `parseSKUPerformanceRoute()` - Parses URL params

4. **Export Functions:**
   - Add to the `window.ChaiVision.routing` object

5. **Test:**
   ```javascript
   // In browser console:
   const routing = window.ChaiVision.routing;
   const route = routing.buildSKUPerformanceRoute({
       channel: 'Shopify',
       brand: 'LifePro',
       view: 'quarterly',
       period: 'Q4',
       year: '2025'
   });
   console.log('Route:', route);
   ```

### ✅ Checklist:
- [ ] 'sku-performance' added to VALID_SECTIONS
- [ ] Helper functions added
- [ ] Functions exported
- [ ] Can build routes correctly

**Time Estimate:** 15-20 minutes

---

## Step 4: Create Basic Component

### What You Need to Do:

1. **Create New File:** `src/js/components/SKUPerformance.js`
   - Copy code from `SKU_IMPLEMENTATION_ROADMAP.md` → Step 4

2. **Create CSS File:** `src/styles/components/sku-performance.css`
   - Copy CSS from roadmap

3. **Link CSS in:** `index.html`
   ```html
   <link rel="stylesheet" href="src/styles/components/sku-performance.css">
   ```

4. **Load Component in:** `index.html`
   ```html
   <script src="src/js/components/SKUPerformance.js"></script>
   ```

5. **Test:**
   - Navigate to: `/?section=sku-performance&channel=Shopify&brand=LifePro&view=quarterly&period=Q4&year=2025`
   - Should see basic SKU page (even if no data)

### ✅ Checklist:
- [ ] Component file created
- [ ] CSS file created and linked
- [ ] Component loads without errors
- [ ] Basic page structure visible

**Time Estimate:** 30-40 minutes

---

## Step 5: Integrate into App (Next)

After Steps 1-4 are complete, we'll:
1. Add SKUPerformance to app.js routing
2. Add click handler to channel cards
3. Test full navigation flow

---

## Testing After Steps 1-4

### Manual Test:
1. Open browser console
2. Navigate to dashboard
3. Try: `window.location.href = '/?section=sku-performance&channel=Shopify&brand=LifePro&view=quarterly&period=Q4&year=2025'`
4. Should see SKU performance page (may be empty if no data)

### Expected Results:
- ✅ Page loads without errors
- ✅ Shows "Loading..." then "SKU Performance: Shopify" header
- ✅ Shows summary cards (may show 0s if no data)
- ✅ Shows empty table (if no data) or table with data
- ✅ Back button visible

---

## Common Issues & Solutions

### Issue: "RPC function not found"
**Solution:** Make sure you ran the RPC creation SQL in Supabase

### Issue: "Table doesn't exist"
**Solution:** Check that `sku_sales_data` table was created in Supabase

### Issue: "Component not found"
**Solution:** Make sure SKUPerformance.js is loaded in index.html

### Issue: "Route not working"
**Solution:** Check that 'sku-performance' is in VALID_SECTIONS

---

## Next Steps After Phase 1

Once Steps 1-4 are complete and tested:
- ✅ We'll integrate into app.js
- ✅ Add click handlers to channel cards
- ✅ Then move to Phase 2 (filters, search, sorting)

---

## Questions?

If you run into issues:
1. Check browser console for errors
2. Verify database setup completed successfully
3. Check that all files are saved
4. Refresh the page

**Ready to start? Begin with Step 1 (Database Setup)!**

