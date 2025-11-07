/**
 * Data Service - Handles data operations with caching and performance optimizations
 */

(function() {
    'use strict';
    
    class DataService {
        constructor(supabaseClient, config) {
            this.supabase = supabaseClient;
            this.config = config;
            
            // Performance optimizations
            this.cache = new Map();
            this.cacheTimeout = 5 * 60 * 1000; // 5 minutes for filtered data
            this.debounceTimers = new Map();
            this.lastUpdate = 0;
            this.updateThreshold = 30000; // 30 seconds
            
            // Initialize cache cleanup
            this.initCacheCleanup();
        }
        
        /**
         * Initialize cache cleanup interval
         */
        initCacheCleanup() {
            setInterval(() => {
                const now = Date.now();
                for (const [key, value] of this.cache.entries()) {
                    if (now - value.timestamp > this.cacheTimeout) {
                        this.cache.delete(key);
                    }
                }
            }, 60000); // Clean up every minute
        }
        
        /**
         * Clear cache for specific key or all cache
         */
        clearCache(key = null) {
            if (key) {
                this.cache.delete(key);
                console.log(`🗑️ Cleared cache for: ${key}`);
            } else {
                this.cache.clear();
                console.log('🗑️ Cleared all cache');
            }
        }
        
        /**
         * Get cached data or fetch fresh data
         */
        async getCachedData(key, fetchFunction) {
            const cached = this.cache.get(key);
            const now = Date.now();
            
            if (cached && (now - cached.timestamp) < this.cacheTimeout) {
                // Using cached data for: ${key}
                return cached.data;
            }
            
            // Fetching fresh data for: ${key}
            const data = await fetchFunction();
            
            this.cache.set(key, {
                data,
                timestamp: now
            });
            
            return data;
        }
        
        /**
         * Debounced function execution
         */
        debounce(key, func, delay = 300) {
            if (this.debounceTimers.has(key)) {
                clearTimeout(this.debounceTimers.get(key));
            }
            
            return new Promise((resolve) => {
                const timer = setTimeout(() => {
                    this.debounceTimers.delete(key);
                    resolve(func());
                }, delay);
                this.debounceTimers.set(key, timer);
            });
        }
        
        /**
         * Load aggregated data using database-side aggregation (fast, efficient)
         * This uses PostgREST aggregate queries similar to SQL GROUP BY
         */
        async loadAggregatedSalesData(filters = {}) {
            if (!this.supabase || !this.config.FEATURES.ENABLE_SUPABASE) {
                return { totalRevenue: 0, channelRevenues: {}, dailyData: [] };
            }
            
            try {
                const cacheKey = `agg_${this.createCacheKey(filters)}`;
                const cached = this.cache.get(cacheKey);
                if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                    console.log(`⚡ Cache hit for aggregated data`);
                    return cached.data;
                }
                
                const normalizedBrand = (filters.brand && filters.brand !== 'All Brands' && filters.brand !== 'All Brands (Company Total)')
                    ? filters.brand
                    : null;
                const normalizedChannel = (filters.channel && filters.channel !== 'All Channels')
                    ? filters.channel
                    : null;
                const startDate = filters.startDate || null;
                const endDate = filters.endDate || null;

                const { data: channelData, error: channelError } = await this.supabase.rpc('sales_channel_agg', {
                    start_date: startDate,
                    end_date: endDate,
                    brand_filter: normalizedBrand
                });
                
                if (channelError) {
                    console.error('❌ Channel aggregation RPC error:', channelError);
                    throw channelError;
                }
                
                // Calculate total revenue from channel aggregates
                const totalRevenue = (channelData || []).reduce((sum, row) => {
                    return sum + (parseFloat(row.total_revenue) || 0);
                }, 0);
                
                // Map channel aggregates
                const channelRevenues = {};
                (channelData || []).forEach(row => {
                    channelRevenues[row.channel] = parseFloat(row.total_revenue) || 0;
                });
                
                // For charts, we still need daily/monthly aggregates
                // Use RPC for that but with appropriate granularity
                let dailyData = [];
                try {
                    const granularity = filters.view === 'monthly' ? 'day' : 
                                       filters.view === 'quarterly' ? 'month' : 
                                       filters.view === 'annual' ? 'month' : 'day';
                    
                    const { data: rpcData, error: aggError } = await this.supabase.rpc('sales_agg', {
                        start_date: startDate,
                        end_date: endDate,
                        brand_filter: normalizedBrand,
                        channel_filter: normalizedChannel,
                        group_by: granularity
                    });
                    
                    if (aggError) {
                        console.error('❌ sales_agg RPC error:', aggError);
                        throw aggError;
                    }

                    if (rpcData) {
                        dailyData = rpcData.map(r => ({
                            date: typeof r.period_date === 'string' ? r.period_date.split('T')[0] : r.period_date,
                            brand: r.brand,
                            channel: r.channel,
                            revenue: typeof r.revenue === 'string' ? parseFloat(r.revenue) : r.revenue
                        }));
                    }
                } catch (rpcErr) {
                    console.error('❌ Failed to load aggregated chart data via RPC:', rpcErr);
                    throw rpcErr;
                }
                
                const result = {
                    totalRevenue,
                    channelRevenues,
                    dailyData
                };
                
                this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
                console.log(`✅ Aggregated data loaded: Total=${totalRevenue}, Channels=${Object.keys(channelRevenues).length}`);
                return result;
                
            } catch (err) {
                console.error('❌ Failed to load aggregated sales data:', err);
                throw err;
            }
        }
        
        async loadSalesData(filters = {}) {
            // Loading sales data with smart filtering and caching
            
            if (this.supabase && this.config.FEATURES.ENABLE_SUPABASE) {
                try {
                    // Create cache key based on filters
                    const cacheKey = this.createCacheKey(filters);
                    
                    // For dashboard KPIs (total revenue, channel breakdown), use direct aggregation
                    // This is much faster than loading all records - queries database with GROUP BY
                    // For annual/quarterly views, we can use aggregated channel data
                    const shouldUseAggregation = filters.view === 'annual' || 
                        (filters.view === 'quarterly' && filters.brand && filters.brand !== 'All Brands');
                    
                    if (shouldUseAggregation) {
                        console.log('📊 Using direct database aggregation (like SQL GROUP BY) for efficient loading');
                        const aggregated = await this.loadAggregatedSalesData(filters);
                        
                        // Store aggregated data in cache for Dashboard to access
                        this.cache.set(`${cacheKey}_aggregated`, { 
                            data: aggregated, 
                            timestamp: Date.now() 
                        });
                        
                        // Return dailyData for charts/trends, but Dashboard will use aggregated.channelRevenues for totals
                        return aggregated.dailyData;
                    }
                    console.log(`🔍 Loading sales data with filters:`, filters);
                    
                    // Check cache first
                    const cached = this.cache.get(cacheKey);
                    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                        console.log(`⚡ Cache hit: ${cached.data.length} records`);
                        return cached.data;
                    }
                    
                    // Try RPC aggregate first (fast, small payload)
                    // Always use 'day' granularity to return daily aggregates
                    // Dashboard will handle aggregation by date+channel+brand
                    console.log('🎯 Attempting RPC call...');
                    try {
                        // Always request daily aggregates - Dashboard handles grouping
                        console.log(`📊 RPC params: granularity=day, start=${filters.startDate}, end=${filters.endDate}, brand=${filters.brand}`);
                        // Normalize brand name for case-insensitive matching
                        let brandFilter = null;
                        if (filters.brand && filters.brand !== 'All Brands' && filters.brand !== 'All Brands (Company Total)') {
                            brandFilter = filters.brand;
                        }
                        
                        const rpcParams = {
                            start_date: filters.startDate,
                            end_date: filters.endDate,
                            brand_filter: brandFilter,
                            channel_filter: (!filters.channel || filters.channel === 'All Channels') ? null : filters.channel,
                            group_by: 'day' // Always use daily aggregates for proper Dashboard aggregation
                        };
                        console.log('📞 Calling sales_agg RPC...', rpcParams);
                        console.log(`🔍 Brand filter applied: ${brandFilter || 'ALL BRANDS'}`);
                        const { data: rpcData, error: rpcError } = await this.supabase.rpc('sales_agg', rpcParams);
                        if (!rpcError && Array.isArray(rpcData)) {
                            // RPC returns daily aggregates (date+brand+channel already summed per day)
                            // Format: period_date (actual date), brand, channel, revenue (sum for that day+brand+channel)
                            const normalizedRpc = (rpcData || []).map(r => ({
                                date: typeof r.period_date === 'string' ? r.period_date.split('T')[0] : r.period_date,
                                brand: r.brand,
                                channel: r.channel,
                                revenue: typeof r.revenue === 'string' ? parseFloat(r.revenue) : r.revenue
                            }));
                            
                            // CRITICAL: Check if RPC hit a limit (exactly 1000 records is suspicious for annual data)
                            // For annual view with daily aggregates, we could have 365 days × multiple channels = 2000+ records
                            // If we get exactly 1000, it's likely truncated and we need to fall back to REST with pagination
                            const isAnnualView = filters.view === 'annual';
                            const isLargeDateRange = filters.startDate && filters.endDate && 
                                (new Date(filters.endDate) - new Date(filters.startDate)) / (1000 * 60 * 60 * 24) > 90; // More than 90 days
                            
                            if (normalizedRpc.length === 1000 && (isAnnualView || isLargeDateRange)) {
                                console.warn(`⚠️ RPC returned exactly 1000 records (likely limit hit) for ${filters.view} view`);
                                console.warn(`⚠️ Falling back to REST query with pagination to get all data...`);
                                // Don't return here - fall through to REST query with pagination
                            } else {
                                this.cache.set(cacheKey, { data: normalizedRpc, timestamp: Date.now() });
                                console.log(`✅ RPC loaded: ${normalizedRpc.length} records (daily aggregates)`);
                                console.log(`📊 Sample RPC data:`, normalizedRpc.slice(0, 3));
                                return normalizedRpc;
                            }
                        } else if (rpcError) {
                            console.error('❌ RPC sales_agg error:', rpcError);
                            console.warn('⚠️ Falling back to REST query due to RPC error');
                        }
                    } catch (rpcTryErr) {
                        console.error('❌ RPC attempt exception:', rpcTryErr);
                        console.warn('⚠️ Falling back to REST query due to exception');
                    }

                    // Try filtered query first (optimized)
                    let data = await this.loadFilteredData(filters);
                    
                    // If we got 0 records or hit RLS limit (1000), try fallback strategies
                    if (!data || data.length === 0) {
                        console.warn('⚠️ Filtered query returned 0 records, trying fallback...');
                        data = await this.loadWithFallback(filters);
                    } else if (data.length === 1000) {
                        console.warn('⚠️ Hit RLS limit (1000 records), loading via pagination...');
                        data = await this.loadWithPagination(filters);
                    }
                    
                    // Normalize types/fields for frontend calculations
                    const normalized = (data || []).map(row => ({
                        ...row,
                        // Ensure revenue is a number (Supabase may return numeric as string)
                        revenue: typeof row.revenue === 'string' ? parseFloat(row.revenue) : row.revenue,
                        // Ensure date is YYYY-MM-DD string
                        date: typeof row.date === 'string' ? row.date.split('T')[0] : row.date
                    }));
                    
                    // Cache the result
                    this.cache.set(cacheKey, {
                        data: normalized,
                        timestamp: Date.now()
                    });
                    
                    console.log(`✅ Final result: ${normalized.length} records loaded`);
                    return normalized;
                } catch (err) {
                    console.error('❌ Failed to load sales data:', err);
                    throw err;
                }
            } else {
                // Fallback to demo data
                return this.loadLocalData();
            }
        }

        getGranularityFromFilters(filters) {
            // DEPRECATED: Always use 'day' granularity for RPC
            // Dashboard handles grouping by date+channel+brand regardless of view
            // This ensures proper aggregation without double-counting
            return 'day';
        }
        
        /**
         * Create cache key from filters
         */
        createCacheKey(filters) {
            const key = JSON.stringify({
                startDate: filters.startDate || 'all',
                endDate: filters.endDate || 'all',
                brand: filters.brand || 'all',
                channel: filters.channel || 'all'
            });
            return `sales_data_${key}`;
        }
        
        /**
         * Load data with optimized filters
         */
        async loadFilteredData(filters) {
            // Select base columns; we will aggregate client-side until RPC is added
            let query = this.supabase
                .from('sales_data')
                .select('date, brand, channel, revenue')
                .order('date', { ascending: false });
            
            // Apply filters to reduce data load
            if (filters.startDate) {
                query = query.gte('date', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('date', filters.endDate);
            }
            if (filters.brand && filters.brand !== 'All Brands') {
                // Use case-insensitive matching for brand names
                query = query.ilike('brand', filters.brand);
            }
            if (filters.channel && filters.channel !== 'All Channels') {
                query = query.eq('channel', filters.channel);
            }
            
            // No hard limit needed when aggregating, but keep guard for extremely large windows
            const limit = this.calculateOptimalLimit(filters);
            if (limit) query = query.limit(limit);
            
            const { data, error } = await query;
            
            if (error) {
                console.error('❌ Filtered query error:', error);
                throw error;
            }
            
            return data || [];
        }
        
        /**
         * Fallback: Load without brand filter (case-sensitive matching issue)
         */
        async loadWithFallback(filters) {
            // Try without brand filter (might be case mismatch)
            const fallbackFilters = { ...filters };
            delete fallbackFilters.brand;
            
            console.log('🔄 Fallback: Trying without brand filter...');
            let data = await this.loadFilteredData(fallbackFilters);
            
            // If still no data, try with just date range
            if (!data || data.length === 0) {
                console.log('🔄 Fallback: Trying with date range only...');
                const dateOnlyFilters = {
                    startDate: filters.startDate,
                    endDate: filters.endDate
                };
                data = await this.loadFilteredData(dateOnlyFilters);
            }
            
            // Filter client-side for brand (case-insensitive)
            if (data && data.length > 0 && filters.brand && filters.brand !== 'All Brands') {
                const brandKey = filters.brand.toLowerCase();
                data = data.filter(row => {
                    const rowBrand = String(row.brand || '').toLowerCase();
                    return rowBrand === brandKey;
                });
                console.log(`🔍 Client-side brand filter: ${data.length} records match "${filters.brand}"`);
            }
            
            return data || [];
        }
        
        /**
         * Load data via pagination when hitting RLS limits
         */
        async loadWithPagination(filters) {
            const allData = [];
            let offset = 0;
            const pageSize = 1000;
            let hasMore = true;
            const maxPages = 500; // Safety limit
            
            console.log('📄 Starting pagination...');
            
            while (hasMore && allData.length < 500000 && (offset / pageSize) < maxPages) {
                let query = this.supabase
                    .from('sales_data')
                    .select('date, brand, channel, revenue')
                    .order('date', { ascending: false })
                    .range(offset, offset + pageSize - 1);
                
                // Apply same filters
                if (filters.startDate) {
                    query = query.gte('date', filters.startDate);
                }
                if (filters.endDate) {
                    query = query.lte('date', filters.endDate);
                }
                if (filters.brand && filters.brand !== 'All Brands') {
                    query = query.ilike('brand', filters.brand);
                }
                if (filters.channel && filters.channel !== 'All Channels') {
                    query = query.eq('channel', filters.channel);
                }
                
                const { data: pageData, error } = await query;
                
                if (error) {
                    console.error('❌ Pagination error:', error);
                    break;
                }
                
                if (!pageData || pageData.length === 0) {
                    hasMore = false;
                } else {
                    allData.push(...pageData);
                    offset += pageSize;
                    
                    if (offset % 10000 === 0) {
                        console.log(`📄 Loaded ${allData.length} records so far...`);
                    }
                }
                
                // Small delay to prevent overwhelming server
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            
            console.log(`✅ Pagination complete: ${allData.length} records`);
            
            // Apply client-side brand filter if needed (case-insensitive)
            if (allData.length > 0 && filters.brand && filters.brand !== 'All Brands') {
                const brandKey = filters.brand.toLowerCase();
                const filtered = allData.filter(row => {
                    const rowBrand = String(row.brand || '').toLowerCase();
                    return rowBrand === brandKey;
                });
                console.log(`🔍 Client-side brand filter applied: ${filtered.length} records match "${filters.brand}"`);
                return filtered;
            }
            
            return allData;
        }
        
        /**
         * Calculate optimal limit based on filters
         */
        calculateOptimalLimit(filters) {
            // Base limit
            let limit = 10000;
            
            // Reduce limit if we have specific filters
            if (filters.brand && filters.brand !== 'All Brands') {
                limit = Math.min(limit, 50000); // Brand-specific data
            }
            if (filters.channel && filters.channel !== 'All Channels') {
                limit = Math.min(limit, 50000); // Channel-specific data
            }
            if (filters.startDate && filters.endDate) {
                // Calculate days between dates
                const start = new Date(filters.startDate);
                const end = new Date(filters.endDate);
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                
                if (days <= 30) {
                    limit = Math.min(limit, 5000); // Short period
                } else if (days <= 365) {
                    limit = Math.min(limit, 20000); // Medium period
                }
            }
            
            return limit;
        }
        
        loadLocalData() {
            // Load from localStorage with error handling
            try {
                const stored = localStorage.getItem('chai_vision_sales_data');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    return Array.isArray(parsed) ? parsed : [];
                }
            } catch (error) {
                // Failed to parse stored sales data, clearing
                localStorage.removeItem('chai_vision_sales_data');
            }
            
            // Get generateSampleData from window
            const { generateSampleData } = window.ChaiVision?.INITIAL_DATA || {};
            if (generateSampleData) {
                // Generate sample data
                const startDate = '2025-01-01';
                const endDate = new Date().toISOString().split('T')[0];
                return generateSampleData(startDate, endDate);
            }
            
            // Return empty array if nothing available
            return [];
        }
        
        async saveSalesData(data) {
            // Debounce save operations to prevent excessive writes
            return this.debounce('save_sales_data', async () => {
                if (this.supabase && this.config.FEATURES.ENABLE_SUPABASE) {
                    try {
                        // Preferred path: upsert on source_id if supported by DB constraint
                        const { error } = await this.supabase
                            .from('sales_data')
                            .upsert(data, { onConflict: 'source_id' });
                        if (error) {
                            console.error('Supabase upsert error:', error);
                            throw error;
                        }

                        this.cache.delete('sales_data');
                        return true;
                    } catch (error) {
                        // Handle specific error codes
                        if (error?.code === '23505' || error?.code === '21000' || error?.message?.includes('duplicate constrained values')) {
                            // Unique constraint violation or duplicate key error
                            console.warn('Unique constraint violation, attempting individual inserts:', error.message);
                            return await this.insertIndividualRows(data);
                        }
                        
                        // Fallback when ON CONFLICT is not available (e.g., no unique constraint)
                        if (error?.code === '42P10') {
                            try {
                                const sourceIds = Array.from(new Set((data || []).map(r => r.source_id).filter(Boolean)));
                                if (sourceIds.length === 0) throw error;

                                // Find which rows already exist
                                const { data: existing, error: selectError } = await this.supabase
                                    .from('sales_data')
                                    .select('source_id')
                                    .in('source_id', sourceIds);
                                if (selectError) throw selectError;

                                const existingSet = new Set((existing || []).map(r => r.source_id));
                                const toInsert = [];
                                const toUpdate = [];

                                for (const row of data) {
                                    if (existingSet.has(row.source_id)) {
                                        toUpdate.push(row);
                                    } else {
                                        toInsert.push(row);
                                    }
                                }

                                // Insert new rows in bulk
                                if (toInsert.length > 0) {
                                    const { error: insertError } = await this.supabase
                                        .from('sales_data')
                                        .insert(toInsert);
                                    if (insertError) throw insertError;
                                }

                                // Update existing rows one-by-one (safe, preserves differing values per row)
                                for (const row of toUpdate) {
                                    const rowCopy = { ...row };
                                    // Ensure we do not modify created_at; optionally set updated_at client-side
                                    rowCopy.updated_at = new Date().toISOString();
                                    const { error: updateError } = await this.supabase
                                        .from('sales_data')
                                        .update(rowCopy)
                                        .eq('source_id', row.source_id);
                                    if (updateError) throw updateError;
                                }

                                this.cache.delete('sales_data');
                                return true;
                            } catch (fallbackError) {
                                console.error('Supabase fallback merge error:', fallbackError);
                                throw fallbackError;
                            }
                        }

                        console.error('Supabase error:', error);
                        throw error;
                    }
                } else {
                    return this.saveLocalData(data);
                }
            }, 500);
        }
        
        saveLocalData(data) {
            try {
                const existing = this.loadLocalData();
                const updated = [...existing, ...data];
                localStorage.setItem('chai_vision_sales_data', JSON.stringify(updated));
                
                // Invalidate cache
                this.cache.delete('sales_data');
                return true;
            } catch (error) {
                console.error('Failed to save local data:', error);
                return false;
            }
        }
        
        /**
         * Optimized data filtering with memoization
         */
        filterData(data, filters = {}) {
            const filterKey = JSON.stringify(filters);
            
            return this.getCachedData(`filtered_${filterKey}`, () => {
                let filtered = [...data];
                
                if (filters.brand && filters.brand !== 'All Brands') {
                    filtered = filtered.filter(d => d.brand === filters.brand);
                }
                
                if (filters.channel && filters.channel !== 'All Channels') {
                    filtered = filtered.filter(d => d.channel === filters.channel);
                }
                
                if (filters.dateRange) {
                    const { start, end } = filters.dateRange;
                    filtered = filtered.filter(d => {
                        const date = new Date(d.date);
                        return date >= start && date <= end;
                    });
                }
                
                return filtered;
            });
        }
        
        /**
         * Batch operations for better performance with progress tracking
         */
        async batchSaveSalesData(dataArray, batchSize = 1000, onProgress = null) {
            const batches = [];
            for (let i = 0; i < dataArray.length; i += batchSize) {
                batches.push(dataArray.slice(i, i + batchSize));
            }
            
            const results = [];
            let processedBatches = 0;
            let successfulRows = 0;
            let failedRows = 0;
            
            for (const batch of batches) {
                try {
                    const result = await this.saveSalesData(batch);
                    results.push(result);
                    processedBatches++;
                    successfulRows += batch.length;
                    
                    console.log(`Batch ${processedBatches} completed: ${batch.length} rows processed`);
                    
                    // Report progress
                    if (onProgress) {
                        const progress = Math.round((processedBatches / batches.length) * 100);
                        onProgress({
                            processedBatches,
                            totalBatches: batches.length,
                            progress,
                            processedRows: successfulRows,
                            totalRows: dataArray.length,
                            currentBatch: processedBatches,
                            batchSize: batch.length
                        });
                    }
                    
                    // Add small delay between batches to prevent overwhelming the server
                    if (processedBatches < batches.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (error) {
                    console.error(`Batch ${processedBatches + 1} failed:`, error);
                    results.push(false);
                    processedBatches++;
                    failedRows += batch.length;
                    
                    // Continue with next batch even if one fails
                    if (onProgress) {
                        const progress = Math.round((processedBatches / batches.length) * 100);
                        onProgress({
                            processedBatches,
                            totalBatches: batches.length,
                            progress,
                            processedRows: successfulRows,
                            totalRows: dataArray.length,
                            error: error.message,
                            currentBatch: processedBatches
                        });
                    }
                    
                    // Add small delay between batches to prevent overwhelming the server
                    if (processedBatches < batches.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }
            
            return {
                success: results.filter(r => r === true).length,
                failed: results.filter(r => r === false).length,
                total: results.length,
                allSuccessful: results.every(r => r === true),
                successfulRows,
                failedRows
            };
        }
        
        /**
         * Insert rows individually to handle constraint violations
         */
        async insertIndividualRows(data) {
            let successCount = 0;
            let errorCount = 0;
            
            for (const row of data) {
                try {
                    const { error } = await this.supabase
                        .from('sales_data')
                        .upsert([row], { onConflict: 'source_id' });
                    
                    if (error) {
                        console.warn(`Failed to insert row with source_id ${row.source_id}:`, error.message);
                        errorCount++;
                    } else {
                        successCount++;
                    }
                } catch (err) {
                    console.warn(`Failed to insert row with source_id ${row.source_id}:`, err.message);
                    errorCount++;
                }
            }
            
            console.log(`Individual insert completed: ${successCount} successful, ${errorCount} failed`);
            return successCount > 0;
        }
        
        
        generateSampleData() {
            // Generating sample sales data
            const data = [];
            const startDate = new Date('2025-01-01');
            const endDate = new Date();
            endDate.setDate(endDate.getDate() - 2);
            
            const brands = ['LifePro', 'PetCove'];
            const channels = ['Amazon', 'TikTok', 'DTC-Shopify', 'Retail', 'CA International', 'UK International'];
            
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                
                brands.forEach(brand => {
                    channels.forEach(channel => {
                        let baseRevenue = 0;
                        const brandMultiplier = brand === 'LifePro' ? 1 : brand === 'PetCove' ? 0.12 : 0.08;
                        
                        switch(channel) {
                            case 'Amazon':
                                baseRevenue = 250000 * brandMultiplier;
                                break;
                            case 'TikTok':
                                baseRevenue = 30000 * brandMultiplier;
                                break;
                            case 'DTC-Shopify':
                                baseRevenue = 55000 * brandMultiplier;
                                break;
                            case 'Retail':
                                baseRevenue = 11000 * brandMultiplier;
                                break;
                            case 'CA International':
                                baseRevenue = 27000 * brandMultiplier;
                                break;
                            case 'UK International':
                                baseRevenue = 22000 * brandMultiplier;
                                break;
                            default:
                                baseRevenue = 15000 * brandMultiplier;
                        }
                        
                        // Add weekend variation
                        if (isWeekend) {
                            baseRevenue *= 0.7;
                        }
                        
                        // Add some randomness
                        const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
                        const finalRevenue = Math.round(baseRevenue * randomFactor);
                        
                        data.push({
                            date: d.toISOString().split('T')[0],
                            brand: brand,
                            channel: channel,
                            revenue: finalRevenue,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                    });
                });
            }
            
            return data;
        }
        
        /**
         * Clear all caches
         */
        clearCache() {
            this.cache.clear();
            // Cache cleared
        }
        
        /**
         * Get cache statistics
         */
        getCacheStats() {
            return {
                size: this.cache.size,
                keys: Array.from(this.cache.keys()),
                memoryUsage: this.estimateMemoryUsage()
            };
        }
        
        /**
         * Estimate memory usage of cache
         */
        estimateMemoryUsage() {
            let totalSize = 0;
            for (const [key, value] of this.cache.entries()) {
                totalSize += JSON.stringify(key).length;
                totalSize += JSON.stringify(value).length;
            }
            return totalSize;
        }
    }
    
    // Make available globally
    window.DataService = DataService;
    
    // Also add to ChaiVision namespace
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.services = window.ChaiVision.services || {};
    window.ChaiVision.services.DataService = DataService;
    
    // DataService loaded with performance optimizations
})();
