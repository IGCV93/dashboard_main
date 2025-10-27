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
            this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
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
        
        async loadSalesData() {
            // Loading sales data
            
            return this.getCachedData('sales_data', async () => {
                if (this.supabase && this.config.FEATURES.ENABLE_SUPABASE) {
                    try {
                        // Trying Supabase (MAIN DataService)
                        const { data, error } = await this.supabase
                            .from('sales_data')
                            .select('*')
                            .order('date', { ascending: false });
                        
                        if (error) {
                            console.error('❌ Supabase error:', error);
                            throw error;
                        }
                        
                        // Supabase data loaded: ${data?.length || 0} records

                        // Normalize types/fields for frontend calculations
                        const normalized = (data || []).map(row => ({
                            ...row,
                            // Ensure revenue is a number (Supabase may return numeric as string)
                            revenue: typeof row.revenue === 'string' ? parseFloat(row.revenue) : row.revenue,
                            // Ensure date is YYYY-MM-DD string
                            date: typeof row.date === 'string' ? row.date.split('T')[0] : row.date
                        }));
                        
                        // Do not auto-generate sample data when Supabase is enabled
                        // Always return the real dataset (may be empty)
                        
                        return normalized;
                    } catch (error) {
                        console.error('❌ Supabase error:', error);
                        // Do not fall back to sample data when Supabase is enabled
                        // Return empty array instead
                        return [];
                    }
                } else {
                    // Supabase disabled, using local data
                    return this.loadLocalData();
                }
            });
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
                        if (error) throw error;

                        this.cache.delete('sales_data');
                        return true;
                    } catch (error) {
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
            
            for (const batch of batches) {
                try {
                    const result = await this.saveSalesData(batch);
                    results.push(result);
                    processedBatches++;
                    
                    // Report progress
                    if (onProgress) {
                        const progress = Math.round((processedBatches / batches.length) * 100);
                        onProgress({
                            processedBatches,
                            totalBatches: batches.length,
                            progress,
                            processedRows: processedBatches * batchSize,
                            totalRows: dataArray.length
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
                    
                    // Continue with next batch even if one fails
                    if (onProgress) {
                        const progress = Math.round((processedBatches / batches.length) * 100);
                        onProgress({
                            processedBatches,
                            totalBatches: batches.length,
                            progress,
                            processedRows: processedBatches * batchSize,
                            totalRows: dataArray.length,
                            error: error.message
                        });
                    }
                }
            }
            
            return {
                success: results.filter(r => r === true).length,
                failed: results.filter(r => r === false).length,
                total: results.length,
                allSuccessful: results.every(r => r === true)
            };
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
