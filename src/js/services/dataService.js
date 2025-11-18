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
                
                const normalizedBrand = (filters.brand && filters.brand !== 'All Brands' && filters.brand !== 'All Brands (Company Total)' && filters.brand !== 'All My Brands')
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
                        (filters.view === 'quarterly' && filters.brand && filters.brand !== 'All Brands' && filters.brand !== 'All My Brands');
                    
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
                        if (filters.brand && filters.brand !== 'All Brands' && filters.brand !== 'All Brands (Company Total)' && filters.brand !== 'All My Brands') {
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
            if (filters.brand && filters.brand !== 'All Brands' && filters.brand !== 'All My Brands') {
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
            if (data && data.length > 0 && filters.brand && filters.brand !== 'All Brands' && filters.brand !== 'All My Brands') {
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
                if (filters.brand && filters.brand !== 'All Brands' && filters.brand !== 'All My Brands') {
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
            if (allData.length > 0 && filters.brand && filters.brand !== 'All Brands' && filters.brand !== 'All My Brands') {
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
            if (filters.brand && filters.brand !== 'All Brands' && filters.brand !== 'All My Brands') {
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
                
                if (filters.brand && filters.brand !== 'All Brands' && filters.brand !== 'All My Brands') {
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
         * Save SKU sales data to database
         */
        /**
         * Helper function to wrap Supabase queries with timeout protection
         */
        async queryWithTimeout(queryPromise, timeoutMs = 30000, operationName = 'Query') {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`${operationName} timeout after ${timeoutMs}ms`)), timeoutMs);
            });
            
            try {
                return await Promise.race([queryPromise, timeoutPromise]);
            } catch (error) {
                console.error(`${operationName} failed or timed out:`, error);
                throw error;
            }
        }

        async saveSKUData(data) {
            console.log(`🔍 DEBUG [saveSKUData] - START: Processing ${data?.length || 0} rows`);
            
            if (this.supabase && this.config.FEATURES.ENABLE_SUPABASE) {
                try {
                    // Check for existing records to avoid duplicates
                    // Unique constraint: (date, channel, brand, sku, source_id)
                    const sourceIds = Array.from(new Set((data || []).map(r => r.source_id).filter(Boolean)));
                    console.log(`🔍 DEBUG [saveSKUData] - Extracted ${sourceIds.length} unique source_ids`);
                    
                    if (sourceIds.length > 0) {
                        // Supabase .in() query has a limit (typically 1000 items)
                        // Split into chunks to handle large batches
                        const CHUNK_SIZE = 1000;
                        const existingSet = new Set();
                        const numChunks = Math.ceil(sourceIds.length / CHUNK_SIZE);
                        console.log(`🔍 DEBUG [saveSKUData] - Checking existing records in ${numChunks} chunks`);
                        
                        for (let i = 0; i < sourceIds.length; i += CHUNK_SIZE) {
                            const chunk = sourceIds.slice(i, i + CHUNK_SIZE);
                            const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
                            console.log(`🔍 DEBUG [saveSKUData] - Checking chunk ${chunkNum}/${numChunks} (${chunk.length} IDs)`);
                            
                            try {
                                const selectQuery = this.supabase
                                    .from('sku_sales_data')
                                    .select('source_id')
                                    .in('source_id', chunk);
                                
                                const { data: existing, error: selectError } = await this.queryWithTimeout(
                                    selectQuery,
                                    15000,
                                    `Check existing chunk ${chunkNum}/${numChunks}`
                                );
                                
                                if (selectError) {
                                    console.warn(`Could not check for existing SKU records (chunk ${chunkNum}/${numChunks}):`, selectError);
                                    // Continue with insert - database will handle duplicates via constraint
                                } else if (existing) {
                                    existing.forEach(r => existingSet.add(r.source_id));
                                    console.log(`🔍 DEBUG [saveSKUData] - Chunk ${chunkNum}: Found ${existing.length} existing records`);
                                }
                            } catch (chunkError) {
                                console.warn(`Chunk ${chunkNum} check failed (continuing):`, chunkError.message);
                                // Continue - duplicates will be handled by database constraint
                            }
                        }
                        
                        console.log(`🔍 DEBUG [saveSKUData] - Total existing records found: ${existingSet.size}`);
                        
                        // Filter out existing records
                        const toInsert = data.filter(row => !existingSet.has(row.source_id));
                        console.log(`🔍 DEBUG [saveSKUData] - After filtering: ${toInsert.length} to insert, ${data.length - toInsert.length} to skip`);
                        
                        if (toInsert.length === 0) {
                            // All records already exist
                            console.log(`🔍 DEBUG [saveSKUData] - END: All records already exist`);
                            this.cache.delete('sku_data');
                            return { success: true, inserted: 0, skipped: data.length };
                        }
                        
                        // Insert only new records
                        console.log(`🔍 DEBUG [saveSKUData] - Starting INSERT of ${toInsert.length} rows`);
                        const insertQuery = this.supabase
                            .from('sku_sales_data')
                            .insert(toInsert)
                            .select('id', { count: 'exact', head: false });
                        
                        const { error: insertError, count } = await this.queryWithTimeout(
                            insertQuery,
                            30000,
                            `Insert ${toInsert.length} rows`
                        );
                        
                        if (insertError) {
                            console.log(`🔍 DEBUG [saveSKUData] - INSERT ERROR:`, insertError);
                            // If error is due to duplicates (constraint violation), that's okay
                            if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
                                console.warn('Some SKU records were duplicates (skipped), trying individual insert');
                                this.cache.delete('sku_data');
                                // Try to insert individually to get accurate count
                                return await this.insertSKUDataIndividually(toInsert);
                            }
                            console.error('Supabase SKU insert error:', insertError);
                            throw insertError;
                        }
                        
                        const insertedCount = count || toInsert.length;
                        console.log(`🔍 DEBUG [saveSKUData] - END: Successfully inserted ${insertedCount} rows, skipped ${data.length - insertedCount}`);
                        this.cache.delete('sku_data');
                        return { success: true, inserted: insertedCount, skipped: data.length - insertedCount };
                    } else {
                        console.log(`🔍 DEBUG [saveSKUData] - No source_ids, inserting all ${data.length} rows`);
                        // No source_ids, insert all
                        const insertQuery = this.supabase
                            .from('sku_sales_data')
                            .insert(data)
                            .select('id', { count: 'exact', head: false });
                        
                        const { error: insertError, count } = await this.queryWithTimeout(
                            insertQuery,
                            30000,
                            `Insert ${data.length} rows (no source_id check)`
                        );
                        
                        if (insertError) {
                            console.log(`🔍 DEBUG [saveSKUData] - INSERT ERROR:`, insertError);
                            if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
                                console.warn('Some SKU records were duplicates (skipped), trying individual insert');
                                this.cache.delete('sku_data');
                                // Try to insert individually to get accurate count
                                return await this.insertSKUDataIndividually(data);
                            }
                            console.error('Supabase SKU insert error:', insertError);
                            throw insertError;
                        }
                        
                        const insertedCount = count || data.length;
                        console.log(`🔍 DEBUG [saveSKUData] - END: Successfully inserted ${insertedCount} rows`);
                        this.cache.delete('sku_data');
                        return { success: true, inserted: insertedCount, skipped: data.length - insertedCount };
                    }
                } catch (error) {
                    console.error('🔍 DEBUG [saveSKUData] - EXCEPTION:', error);
                    throw error;
                }
            } else {
                console.log(`🔍 DEBUG [saveSKUData] - Using localStorage fallback`);
                // Fallback: Store in localStorage
                return this.saveLocalSKUData(data);
            }
        }
        
        /**
         * Insert SKU rows individually to handle constraint violations and get accurate count
         */
        async insertSKUDataIndividually(data) {
            let inserted = 0;
            let skipped = 0;
            
            for (const row of data) {
                try {
                    const { error } = await this.supabase
                        .from('sku_sales_data')
                        .insert(row);
                    
                    if (error) {
                        if (error.code === '23505' || error.message?.includes('duplicate')) {
                            skipped++;
                        } else {
                            console.error('Error inserting SKU row:', error);
                            skipped++;
                        }
                    } else {
                        inserted++;
                    }
                } catch (err) {
                    console.error('Exception inserting SKU row:', err);
                    skipped++;
                }
            }
            
            this.cache.delete('sku_data');
            return { success: true, inserted, skipped };
        }
        
        saveLocalSKUData(data) {
            try {
                const existing = JSON.parse(localStorage.getItem('chai_vision_sku_data') || '[]');
                const updated = [...existing, ...data];
                localStorage.setItem('chai_vision_sku_data', JSON.stringify(updated));
                
                this.cache.delete('sku_data');
                return true;
            } catch (error) {
                console.error('Failed to save local SKU data:', error);
                return false;
            }
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
         * Batch save SKU sales data with progress tracking
         */
        async batchSaveSKUData(dataArray, batchSize = 1000, onProgress = null) {
            const batches = [];
            for (let i = 0; i < dataArray.length; i += batchSize) {
                batches.push(dataArray.slice(i, i + batchSize));
            }
            
            // DEBUG: Log batch setup
            console.log('🔍 DEBUG [dataService] - batchSaveSKUData setup:', {
                totalRows: dataArray.length,
                batchSize: batchSize,
                numberOfBatches: batches.length,
                lastBatchSize: batches[batches.length - 1]?.length
            });
            
            const results = [];
            let processedBatches = 0;
            let successfulRows = 0;
            let skippedRows = 0;
            let failedRows = 0;
            
            for (const batch of batches) {
                try {
                    console.log(`🔍 DEBUG [dataService] - Processing batch ${processedBatches + 1}/${batches.length} (${batch.length} rows)`);
                    
                    // Wrap saveSKUData with timeout (60 seconds max per batch)
                    const savePromise = this.saveSKUData(batch);
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error(`Batch ${processedBatches + 1} timeout after 60s`)), 60000);
                    });
                    
                    const result = await Promise.race([savePromise, timeoutPromise]);
                    const isSuccess = result && (result.success === true || result === true);
                    results.push(isSuccess ? result : false);
                    processedBatches++;
                    
                    // Track actual inserted rows, not just batch length
                    if (result && typeof result === 'object') {
                        successfulRows += result.inserted || 0;
                        skippedRows += result.skipped || 0;
                    } else if (isSuccess) {
                        // Fallback: if result is just true, assume all were inserted
                        successfulRows += batch.length;
                    }
                    
                    console.log(`✅ SKU Batch ${processedBatches}/${batches.length} completed: ${batch.length} rows (inserted: ${result?.inserted || batch.length}, skipped: ${result?.skipped || 0})`);
                    console.log(`🔍 DEBUG [dataService] - Running totals: inserted=${successfulRows}, skipped=${skippedRows}, failed=${failedRows}`);
                    
                    // Report progress
                    if (onProgress) {
                        const progress = Math.round((processedBatches / batches.length) * 100);
                        const progressObj = {
                            processedBatches,
                            totalBatches: batches.length,
                            progress,
                            processedRows: successfulRows + skippedRows,
                            totalRows: dataArray.length,
                            insertedRows: successfulRows,
                            skippedRows: skippedRows,
                            currentBatch: processedBatches,
                            batchSize: batch.length
                        };
                        console.log(`🔍 DEBUG [dataService] - Calling onProgress for batch ${processedBatches}:`, progressObj);
                        onProgress(progressObj);
                    }
                    
                    // Add small delay between batches
                    if (processedBatches < batches.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (error) {
                    console.error(`❌ SKU Batch ${processedBatches + 1} failed:`, error);
                    results.push(false);
                    processedBatches++;
                    failedRows += batch.length;
                    
                    // Report error progress
                    if (onProgress) {
                        const errorProgressObj = {
                            processedBatches,
                            totalBatches: batches.length,
                            progress: Math.round((processedBatches / batches.length) * 100),
                            processedRows: successfulRows + skippedRows,
                            totalRows: dataArray.length,
                            insertedRows: successfulRows,
                            skippedRows: skippedRows,
                            error: error.message,
                            currentBatch: processedBatches,
                            batchSize: batch.length
                        };
                        console.log(`🔍 DEBUG [dataService] - Calling onProgress for FAILED batch ${processedBatches}:`, errorProgressObj);
                        onProgress(errorProgressObj);
                    }
                }
            }
            
            console.log(`🔍 DEBUG [dataService] - Batch loop completed. Processed ${processedBatches}/${batches.length} batches`);
            
            const successfulBatches = results.filter(r => r !== false).length;
            const failed = results.filter(r => r === false).length;
            
            console.log(`🔍 DEBUG [dataService] - Final stats: successful=${successfulBatches}, failed=${failed}`);
            
            // Ensure progress callback is called one final time with 100%
            if (onProgress) {
                const finalProgressObj = {
                    processedBatches: batches.length,
                    totalBatches: batches.length,
                    progress: 100,
                    processedRows: successfulRows + skippedRows,
                    totalRows: dataArray.length,
                    insertedRows: successfulRows,
                    skippedRows: skippedRows,
                    currentBatch: batches.length,
                    batchSize: batches[batches.length - 1]?.length || 0
                };
                console.log(`🔍 DEBUG [dataService] - Calling FINAL onProgress (100%):`, finalProgressObj);
                onProgress(finalProgressObj);
            } else {
                console.log(`🔍 DEBUG [dataService] - No onProgress callback to call`);
            }
            
            const returnValue = {
                allSuccessful: failed === 0,
                total: batches.length,
                success: successfulBatches,
                failed,
                successfulRows,
                skippedRows,
                failedRows
            };
            
            console.log(`🔍 DEBUG [dataService] - Returning:`, returnValue);
            
            return returnValue;
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
        
        async updateSettings(updatedData = {}) {
            if (this.supabase && this.config?.FEATURES?.ENABLE_SUPABASE) {
                try {
                    // Persisting settings relies on server-side logic; for now we clear caches
                    this.clearCache();
                    return true;
                } catch (error) {
                    console.error('Failed to update settings via Supabase:', error);
                    throw error;
                }
            }
            
            try {
                this.config = this.config || {};
                this.config.INITIAL_DATA = this.config.INITIAL_DATA || {};
                
                if (Array.isArray(updatedData.brands)) {
                    this.config.INITIAL_DATA.brands = updatedData.brands;
                }
                
                if (updatedData.targets) {
                    this.config.INITIAL_DATA.targets = updatedData.targets;
                }
                
                const persisted = {
                    brands: updatedData.brands,
                    targets: updatedData.targets
                };
                localStorage.setItem('chai_vision_settings', JSON.stringify(persisted));
            } catch (error) {
                console.warn('Unable to persist settings locally:', error);
            }
            
            this.clearCache();
            return true;
        }
        
        /**
         * Load brands from the brands table
         */
        async loadBrands() {
            if (this.supabase && this.config?.FEATURES?.ENABLE_SUPABASE) {
                try {
                    const { data, error } = await this.supabase
                        .from('brands')
                        .select('name')
                        .order('name', { ascending: true });
                    
                    if (error) {
                        console.error('Failed to load brands:', error);
                        // Fallback to INITIAL_DATA
                        return this.config?.INITIAL_DATA?.brands || [];
                    }
                    
                    return (data || []).map(b => b.name);
                } catch (error) {
                    console.error('Error loading brands:', error);
                    return this.config?.INITIAL_DATA?.brands || [];
                }
            }
            
            // Fallback for demo mode
            return this.config?.INITIAL_DATA?.brands || [];
        }
        
        /**
         * Delete rows in batches to avoid timeout
         */
        async deleteInBatches(table, filterFn, batchSize = 1000) {
            let totalDeleted = 0;
            let hasMore = true;
            const maxIterations = 1000; // Safety limit
            let iterations = 0;
            
            console.log(`🗑️ Starting batch deletion from ${table}...`);
            
            while (hasMore && iterations < maxIterations) {
                iterations++;
                
                // Get a batch of IDs to delete
                let query = this.supabase.from(table).select('id').limit(batchSize);
                query = filterFn(query);
                
                const { data: batch, error: selectError } = await query;
                
                if (selectError) {
                    // If table doesn't have 'id' column, use RPC or direct delete
                    if (selectError.message?.includes('column') || selectError.code === '42703') {
                        console.log(`⚠️ Table ${table} doesn't have 'id' column, using direct deletion`);
                        // Try direct deletion - this may timeout for large datasets
                        // but it's the best we can do without an ID column
                        let deleteQuery = this.supabase.from(table).delete();
                        deleteQuery = filterFn(deleteQuery);
                        const { error: deleteError, count } = await deleteQuery;
                        
                        if (deleteError) {
                            // Check if it's a timeout
                            if (deleteError.code === '57014' || deleteError.message?.includes('timeout')) {
                                throw new Error(`Deletion timed out. The brand has too much data. Please delete sales data manually or contact support.`);
                            }
                            throw deleteError;
                        }
                        
                        console.log(`✅ Direct deletion completed for ${table}`);
                        hasMore = false;
                        break;
                    }
                    throw selectError;
                }
                
                if (!batch || batch.length === 0) {
                    hasMore = false;
                    break;
                }
                
                // Delete this batch by IDs
                const ids = batch.map(row => row.id);
                const { error: deleteError, count } = await this.supabase
                    .from(table)
                    .delete()
                    .in('id', ids);
                
                if (deleteError) {
                    // Check for timeout
                    if (deleteError.code === '57014' || deleteError.message?.includes('timeout')) {
                        throw new Error(`Deletion timed out after deleting ${totalDeleted} rows. Please try again or contact support.`);
                    }
                    throw deleteError;
                }
                
                const deletedCount = count || ids.length;
                totalDeleted += deletedCount;
                
                console.log(`🗑️ Deleted batch ${iterations}: ${deletedCount} rows (total: ${totalDeleted})`);
                
                // If we got fewer than batchSize, we're done
                if (batch.length < batchSize) {
                    hasMore = false;
                }
                
                // Small delay to prevent overwhelming the server
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            console.log(`✅ Batch deletion complete: ${totalDeleted} rows deleted from ${table}`);
            return totalDeleted;
        }
        
        async deleteBrand(brandName, reassignTo = null) {
            if (!brandName) {
                throw new Error('Brand name is required for deletion');
            }
            
            if (this.supabase && this.config?.FEATURES?.ENABLE_SUPABASE) {
                try {
                    const brandLookup = await this.supabase
                        .from('brands')
                        .select('id, name')
                        .eq('name', brandName)
                        .maybeSingle();
                    
                    if (brandLookup.error) {
                        throw brandLookup.error;
                    }
                    
                    const brandId = brandLookup.data?.id;
                    
                    // If reassigning, update data instead of deleting
                    if (reassignTo) {
                        console.log(`🔄 Reassigning data from "${brandName}" to "${reassignTo}"...`);
                        
                        // Get target brand ID
                        const targetBrandLookup = await this.supabase
                            .from('brands')
                            .select('id, name')
                            .eq('name', reassignTo)
                            .maybeSingle();
                        
                        if (targetBrandLookup.error || !targetBrandLookup.data) {
                            throw new Error(`Target brand "${reassignTo}" not found`);
                        }
                        
                        const targetBrandId = targetBrandLookup.data.id;
                        
                        // Reassign sales_data by brand_id
                        if (brandId !== undefined && brandId !== null) {
                            const { error: updateError } = await this.supabase
                                .from('sales_data')
                                .update({ brand_id: targetBrandId, brand: reassignTo })
                                .eq('brand_id', brandId);
                            
                            if (updateError && !updateError.message?.includes('column') && updateError.code !== '42703') {
                                throw updateError;
                            }
                        }
                        
                        // Reassign sales_data by brand name (case-insensitive)
                        const { data: matchingRows } = await this.supabase
                            .from('sales_data')
                            .select('brand')
                            .ilike('brand', brandName)
                            .limit(1);
                        
                        if (matchingRows && matchingRows.length > 0) {
                            const { data: allMatching } = await this.supabase
                                .from('sales_data')
                                .select('brand')
                                .ilike('brand', brandName);
                            
                            const uniqueBrands = [...new Set((allMatching || []).map(r => r.brand))];
                            
                            for (const brandVariation of uniqueBrands) {
                                const { error: updateError } = await this.supabase
                                    .from('sales_data')
                                    .update({ brand: reassignTo })
                                    .eq('brand', brandVariation);
                                
                                if (updateError) {
                                    throw updateError;
                                }
                            }
                        }
                        
                        // Reassign KPI targets
                        const tablesToReassign = [
                            { table: 'kpi_targets', column: 'brand' },
                            { table: 'kpi_targets_history', column: 'brand' },
                            { table: 'user_brand_permissions', column: 'brand' }
                        ];
                        
                        for (const { table, column } of tablesToReassign) {
                            const { data: matchingRows } = await this.supabase
                                .from(table)
                                .select(column)
                                .ilike(column, brandName);
                            
                            if (matchingRows && matchingRows.length > 0) {
                                const uniqueValues = [...new Set(matchingRows.map(r => r[column]))];
                                
                                for (const value of uniqueValues) {
                                    const { error: updateError } = await this.supabase
                                        .from(table)
                                        .update({ [column]: reassignTo })
                                        .eq(column, value);
                                    
                                    if (updateError) {
                                        throw updateError;
                                    }
                                }
                            }
                        }
                        
                        console.log(`✅ Data reassigned successfully`);
                    } else {
                        // Delete data (original behavior)
                        const cleanupActions = [
                            async () => {
                                // Delete sales_data by brand_id in batches
                                if (brandId !== undefined && brandId !== null) {
                                    try {
                                        await this.deleteInBatches('sales_data', (query) => {
                                            return query.eq('brand_id', brandId);
                                        });
                                    } catch (error) {
                                        // If brand_id column doesn't exist, continue to brand name deletion
                                        if (!error.message?.includes('column') && error.code !== '42703') {
                                            throw error;
                                        }
                                    }
                                }
                            },
                            async () => {
                                // Delete sales_data by brand name in batches (case-insensitive)
                                // Get unique brand name variations first
                                const { data: matchingRows } = await this.supabase
                                    .from('sales_data')
                                    .select('brand')
                                    .ilike('brand', brandName)
                                    .limit(1); // Just check if any exist
                                
                                if (matchingRows && matchingRows.length > 0) {
                                    // Get all unique brand name variations
                                    const { data: allMatching } = await this.supabase
                                        .from('sales_data')
                                        .select('brand')
                                        .ilike('brand', brandName);
                                    
                                    const uniqueBrands = [...new Set((allMatching || []).map(r => r.brand))];
                                    
                                    // Delete each variation in batches
                                    for (const brandVariation of uniqueBrands) {
                                        await this.deleteInBatches('sales_data', (query) => {
                                            return query.eq('brand', brandVariation);
                                        });
                                    }
                                }
                            }
                        ];
                        
                        const tablesToClean = [
                            { table: 'kpi_targets', column: 'brand' },
                            { table: 'kpi_targets_history', column: 'brand' },
                            { table: 'user_brand_permissions', column: 'brand' }
                        ];
                        
                        for (const step of cleanupActions) {
                            await step();
                        }
                        
                        // Case-insensitive deletion for other tables
                        for (const { table, column } of tablesToClean) {
                            // Get matching rows with case variations
                            const { data: matchingRows } = await this.supabase
                                .from(table)
                                .select(column)
                                .ilike(column, brandName);
                            
                            if (matchingRows && matchingRows.length > 0) {
                                const uniqueValues = [...new Set(matchingRows.map(r => r[column]))];
                                
                                for (const value of uniqueValues) {
                                    const { error } = await this.supabase
                                        .from(table)
                                        .delete()
                                        .eq(column, value);
                                    
                                    if (error && !String(error.message || '').toLowerCase().includes('does not exist')) {
                                        throw error;
                                    }
                                }
                            }
                        }
                    }
                    
                    // Delete the brand record itself (whether reassigning or deleting)
                    const { error: brandDeleteError } = await this.supabase
                        .from('brands')
                        .delete()
                        .eq('name', brandName);
                    
                    if (brandDeleteError && !String(brandDeleteError.message || '').toLowerCase().includes('does not exist')) {
                        throw brandDeleteError;
                    }
                    
                    try {
                        await this.supabase
                            .from('audit_logs')
                            .insert({
                                action: reassignTo ? 'brand_reassigned' : 'brand_deleted',
                                user_id: null,
                                user_email: null,
                                user_role: 'system',
                                action_details: { 
                                    brand_name: brandName,
                                    reassigned_to: reassignTo || null
                                },
                                reference_id: reassignTo 
                                    ? `BRAND_REASSIGN_${Date.now()}_${brandName}_${reassignTo}`
                                    : `BRAND_DELETE_${Date.now()}_${brandName}`
                            });
                    } catch (auditError) {
                        console.warn('Unable to log brand action:', auditError);
                    }
                    
                    this.clearCache();
                    return true;
                } catch (error) {
                    console.error('Failed to delete brand via Supabase:', error);
                    throw error;
                }
            }
            
            this.config = this.config || {};
            this.config.INITIAL_DATA = this.config.INITIAL_DATA || {};
            
            if (Array.isArray(this.config.INITIAL_DATA.brands)) {
                this.config.INITIAL_DATA.brands = this.config.INITIAL_DATA.brands.filter(brand => brand !== brandName);
            }
            
            if (this.config.INITIAL_DATA.targets) {
                Object.entries(this.config.INITIAL_DATA.targets).forEach(([year, yearData]) => {
                    if (!yearData?.brands) {
                        return;
                    }
                    if (yearData.brands[brandName]) {
                        const updatedBrands = { ...yearData.brands };
                        delete updatedBrands[brandName];
                        this.config.INITIAL_DATA.targets[year] = {
                            ...yearData,
                            brands: updatedBrands
                        };
                    }
                });
            }
            
            try {
                const stored = localStorage.getItem('chai_vision_settings');
                const parsed = stored ? JSON.parse(stored) : {};
                if (Array.isArray(parsed.brands)) {
                    parsed.brands = parsed.brands.filter(brand => brand !== brandName);
                }
                if (parsed.targets) {
                    Object.keys(parsed.targets).forEach((year) => {
                        if (parsed.targets[year]?.brands?.[brandName]) {
                            delete parsed.targets[year].brands[brandName];
                        }
                    });
                }
                localStorage.setItem('chai_vision_settings', JSON.stringify(parsed));
            } catch (error) {
                console.warn('Unable to update cached settings for brand deletion:', error);
            }
            
            this.clearCache();
            return true;
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
        
        /**
         * Map dashboard channel names to database channel names
         * Dashboard channels may have prefixes (NPK, DTC, etc.) that don't exist in SKU data
         */
        mapChannelNameForSKU(dashboardChannelName) {
            if (!dashboardChannelName) return null;
            
            // Channel name mapping: Dashboard -> Database
            const channelMap = {
                'NPK Shopify': 'Shopify',
                'DTC-Shopify': 'Shopify',
                'DTC Shopify': 'Shopify',
                'Shopify': 'Shopify',
                'Amazon': 'Amazon',
                'TikTok': 'TikTok',
                'Omnichannel': 'Omni Channel',
                'Omni Channel': 'Omni Channel',
                'Wholesale': 'Wholesale',
                'Retail': 'Retail',
                'CA International': 'CA International',
                'UK International': 'UK International'
            };
            
            // Try exact match first
            if (channelMap[dashboardChannelName]) {
                console.log(`📝 Mapped channel: "${dashboardChannelName}" -> "${channelMap[dashboardChannelName]}"`);
                return channelMap[dashboardChannelName];
            }
            
            // Try case-insensitive partial match (e.g., if channel contains "Shopify")
            const lowerChannelName = dashboardChannelName.toLowerCase();
            if (lowerChannelName.includes('shopify')) {
                console.log(`📝 Mapped channel (partial): "${dashboardChannelName}" -> "Shopify"`);
                return 'Shopify';
            }
            if (lowerChannelName.includes('amazon')) {
                return 'Amazon';
            }
            if (lowerChannelName.includes('tiktok')) {
                return 'TikTok';
            }
            if (lowerChannelName.includes('omni')) {
                return 'Omni Channel';
            }
            
            // Fallback: return original name
            console.log(`📝 No mapping found for channel: "${dashboardChannelName}", using as-is`);
            return dashboardChannelName;
        }

        /**
         * Load aggregated SKU sales data
         * @param {Object} filters - Filter object
         * @param {string} filters.startDate - Start date (YYYY-MM-DD)
         * @param {string} filters.endDate - End date (YYYY-MM-DD)
         * @param {string} filters.channel - Channel name (optional)
         * @param {string} filters.brand - Brand name (optional)
         * @param {string} filters.sku - SKU code (optional, for single SKU)
         * @param {string} filters.groupBy - 'sku', 'date', 'month', 'quarter'
         * @returns {Promise<Array>} Array of aggregated SKU data
         */
        async loadSKUData(filters = {}) {
            if (!this.supabase || !this.config.FEATURES.ENABLE_SUPABASE) {
                console.warn('SKU data loading requires Supabase');
                return [];
            }
            
            try {
                const cacheKey = `sku_data_${this.createCacheKey(filters)}`;
                const cached = this.cache.get(cacheKey);
                if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                    console.log(`⚡ Cache hit for SKU data`);
                    return cached.data;
                }
                
                const {
                    startDate,
                    endDate,
                    channel,
                    brand,
                    sku,
                    groupBy = 'sku'
                } = filters;
                
                // Map dashboard channel name to database channel name
                const mappedChannel = channel ? this.mapChannelNameForSKU(channel) : null;
                
                // Normalize filters
                const normalizedChannel = (mappedChannel && mappedChannel !== 'All Channels') ? mappedChannel : null;
                const normalizedBrand = (brand && brand !== 'All Brands' && brand !== 'All Brands (Company Total)' && brand !== 'All My Brands') ? brand : null;
                const normalizedSku = sku || null;
                
                console.log(`📊 Loading SKU data via RPC:`, {
                    startDate,
                    endDate,
                    channelOriginal: channel,
                    channelMapped: normalizedChannel,
                    brand: normalizedBrand,
                    sku: normalizedSku,
                    groupBy
                });
                
                const { data, error } = await this.supabase.rpc('sku_sales_agg', {
                    start_date: startDate,
                    end_date: endDate,
                    channel_filter: normalizedChannel,
                    brand_filter: normalizedBrand,
                    sku_filter: normalizedSku,
                    group_by: groupBy
                });
                
                if (error) {
                    console.error('❌ SKU aggregation RPC error:', error);
                    throw error;
                }
                
                // Normalize the response
                const normalized = (data || []).map(row => ({
                    date: row.period_date,
                    sku: row.sku,
                    channel: row.channel,
                    brand: row.brand,
                    units: parseInt(row.total_units) || 0,
                    revenue: parseFloat(row.total_revenue) || 0,
                    recordCount: parseInt(row.record_count) || 0
                }));
                
                // Cache the result
                this.cache.set(cacheKey, {
                    data: normalized,
                    timestamp: Date.now()
                });
                
                console.log(`✅ SKU data loaded: ${normalized.length} SKUs`);
                return normalized;
                
            } catch (err) {
                console.error('❌ Failed to load SKU data:', err);
                throw err;
            }
        }
        
        /**
         * Load SKU data for comparison (YOY, MOM, custom periods)
         * @param {Object} currentFilters - Filters for current period
         * @param {Object} comparisonFilters - Filters for comparison period
         * @returns {Promise<Object>} Object with current and comparison data
         */
        async loadSKUComparison(currentFilters, comparisonFilters) {
            try {
                const [currentData, comparisonData] = await Promise.all([
                    this.loadSKUData(currentFilters),
                    this.loadSKUData(comparisonFilters)
                ]);
                
                // Create a map for quick lookup
                const comparisonMap = new Map();
                comparisonData.forEach(item => {
                    const key = `${item.sku}_${item.channel}_${item.brand}`;
                    comparisonMap.set(key, item);
                });
                
                // Merge comparison data with current data
                const merged = currentData.map(current => {
                    const key = `${current.sku}_${current.channel}_${current.brand}`;
                    const comparison = comparisonMap.get(key);
                    
                    if (comparison) {
                        const growthAmount = current.revenue - comparison.revenue;
                        const growthPercent = comparison.revenue > 0 
                            ? ((growthAmount / comparison.revenue) * 100) 
                            : (current.revenue > 0 ? 100 : 0);
                        
                        return {
                            ...current,
                            comparison: {
                                revenue: comparison.revenue,
                                units: comparison.units,
                                growthAmount,
                                growthPercent
                            }
                        };
                    }
                    
                    return {
                        ...current,
                        comparison: null
                    };
                });
                
                return {
                    current: currentData,
                    comparison: comparisonData,
                    merged
                };
                
            } catch (err) {
                console.error('❌ Failed to load SKU comparison:', err);
                throw err;
            }
        }
        
        /**
         * Search SKUs by code or product name
         * @param {string} query - Search query
         * @param {Object} filters - Additional filters
         * @returns {Promise<Array>} Filtered SKU data
         */
        async searchSKUs(query, filters = {}) {
            if (!query || query.trim().length === 0) {
                return this.loadSKUData(filters);
            }
            
            const allData = await this.loadSKUData(filters);
            const searchTerm = query.toLowerCase().trim();
            
            return allData.filter(item => {
                const skuMatch = item.sku.toLowerCase().includes(searchTerm);
                const productMatch = item.product_name 
                    ? item.product_name.toLowerCase().includes(searchTerm)
                    : false;
                return skuMatch || productMatch;
            });
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
