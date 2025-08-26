/**
 * Supabase Service - Handle all Supabase database operations
 */

(function() {
    'use strict';
    
    class SupabaseService {
        constructor(supabaseClient, config) {
            this.client = supabaseClient;
            this.config = config;
            this.tables = config?.SUPABASE?.TABLES || {
                SALES_DATA: 'sales_data',
                BRANDS: 'brands',
                TARGETS: 'targets',
                USERS: 'users'
            };
        }

        /**
         * Check if Supabase is properly initialized
         */
        isInitialized() {
            return this.client !== null && this.client !== undefined;
        }

        /**
         * Test Supabase connection
         */
        async testConnection() {
            if (!this.isInitialized()) {
                return { success: false, error: 'Supabase client not initialized' };
            }

            try {
                const { data, error } = await this.client
                    .from(this.tables.SALES_DATA)
                    .select('count')
                    .limit(1);

                if (error) throw error;
                return { success: true, message: 'Connected to Supabase' };
            } catch (error) {
                console.error('Supabase connection test failed:', error);
                return { success: false, error: error.message };
            }
        }

        // ============================================
        // SALES DATA OPERATIONS
        // ============================================

        /**
         * Fetch sales data with optional filters
         */
        async getSalesData(filters = {}) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                let query = this.client
                    .from(this.tables.SALES_DATA)
                    .select('*');

                // Apply filters
                if (filters.startDate) {
                    query = query.gte('date', filters.startDate);
                }
                if (filters.endDate) {
                    query = query.lte('date', filters.endDate);
                }
                if (filters.brand && filters.brand !== 'All Brands') {
                    query = query.eq('brand', filters.brand);
                }
                if (filters.channel) {
                    query = query.eq('channel', filters.channel);
                }

                // Order by date descending
                query = query.order('date', { ascending: false });

                // Limit results if specified
                if (filters.limit) {
                    query = query.limit(filters.limit);
                }

                const { data, error } = await query;

                if (error) throw error;
                return data || [];
            } catch (error) {
                console.error('Error fetching sales data:', error);
                throw error;
            }
        }

        /**
         * Insert sales data records
         */
        async insertSalesData(records) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                // Ensure records have required fields
                const formattedRecords = records.map(record => ({
                    date: record.date,
                    channel: record.channel,
                    brand: record.brand,
                    revenue: parseFloat(record.revenue) || 0,
                    created_at: record.created_at || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }));

                const { data, error } = await this.client
                    .from(this.tables.SALES_DATA)
                    .insert(formattedRecords)
                    .select();

                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Error inserting sales data:', error);
                throw error;
            }
        }

        /**
         * Update sales data record
         */
        async updateSalesData(id, updates) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                const { data, error } = await this.client
                    .from(this.tables.SALES_DATA)
                    .update({
                        ...updates,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id)
                    .select();

                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Error updating sales data:', error);
                throw error;
            }
        }

        /**
         * Delete sales data records
         */
        async deleteSalesData(ids) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                const { error } = await this.client
                    .from(this.tables.SALES_DATA)
                    .delete()
                    .in('id', Array.isArray(ids) ? ids : [ids]);

                if (error) throw error;
                return { success: true };
            } catch (error) {
                console.error('Error deleting sales data:', error);
                throw error;
            }
        }

        /**
         * Bulk upsert sales data (insert or update)
         */
        async upsertSalesData(records) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                const { data, error } = await this.client
                    .from(this.tables.SALES_DATA)
                    .upsert(records, { onConflict: 'date,channel,brand' })
                    .select();

                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Error upserting sales data:', error);
                throw error;
            }
        }

        // ============================================
        // BRANDS OPERATIONS
        // ============================================

        /**
         * Get all brands
         */
        async getBrands() {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                const { data, error } = await this.client
                    .from(this.tables.BRANDS)
                    .select('*')
                    .order('name');

                if (error) throw error;
                return data || [];
            } catch (error) {
                console.error('Error fetching brands:', error);
                throw error;
            }
        }

        /**
         * Create a new brand
         */
        async createBrand(brand) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                const { data, error } = await this.client
                    .from(this.tables.BRANDS)
                    .insert({
                        name: brand.name,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select();

                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Error creating brand:', error);
                throw error;
            }
        }

        /**
         * Update brand
         */
        async updateBrand(id, updates) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                const { data, error } = await this.client
                    .from(this.tables.BRANDS)
                    .update({
                        ...updates,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id)
                    .select();

                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Error updating brand:', error);
                throw error;
            }
        }

        /**
         * Delete brand
         */
        async deleteBrand(id) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                const { error } = await this.client
                    .from(this.tables.BRANDS)
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                return { success: true };
            } catch (error) {
                console.error('Error deleting brand:', error);
                throw error;
            }
        }

        // ============================================
        // TARGETS OPERATIONS
        // ============================================

        /**
         * Get targets for a specific year and brand
         */
        async getTargets(year, brand = null) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                let query = this.client
                    .from(this.tables.TARGETS)
                    .select('*')
                    .eq('year', year);

                if (brand && brand !== 'All Brands') {
                    query = query.eq('brand', brand);
                }

                const { data, error } = await query;

                if (error) throw error;
                return data || [];
            } catch (error) {
                console.error('Error fetching targets:', error);
                throw error;
            }
        }

        /**
         * Save targets
         */
        async saveTargets(targets) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                const formattedTargets = targets.map(target => ({
                    ...target,
                    updated_at: new Date().toISOString()
                }));

                const { data, error } = await this.client
                    .from(this.tables.TARGETS)
                    .upsert(formattedTargets, { onConflict: 'year,brand,period,channel' })
                    .select();

                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Error saving targets:', error);
                throw error;
            }
        }

        // ============================================
        // AGGREGATION OPERATIONS
        // ============================================

        /**
         * Get aggregated sales by channel
         */
        async getSalesByChannel(startDate, endDate, brand = null) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                let query = this.client
                    .from(this.tables.SALES_DATA)
                    .select('channel, revenue');

                if (startDate) query = query.gte('date', startDate);
                if (endDate) query = query.lte('date', endDate);
                if (brand && brand !== 'All Brands') {
                    query = query.eq('brand', brand);
                }

                const { data, error } = await query;

                if (error) throw error;

                // Aggregate by channel
                const aggregated = {};
                data.forEach(record => {
                    if (!aggregated[record.channel]) {
                        aggregated[record.channel] = 0;
                    }
                    aggregated[record.channel] += record.revenue;
                });

                return aggregated;
            } catch (error) {
                console.error('Error getting sales by channel:', error);
                throw error;
            }
        }

        /**
         * Get sales trend data
         */
        async getSalesTrend(period = 'daily', startDate, endDate) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                let query = this.client
                    .from(this.tables.SALES_DATA)
                    .select('date, revenue')
                    .order('date');

                if (startDate) query = query.gte('date', startDate);
                if (endDate) query = query.lte('date', endDate);

                const { data, error } = await query;

                if (error) throw error;

                // Aggregate by period
                const aggregated = {};
                data.forEach(record => {
                    let key = record.date;
                    
                    if (period === 'monthly') {
                        key = record.date.substring(0, 7); // YYYY-MM
                    } else if (period === 'quarterly') {
                        const date = new Date(record.date);
                        const quarter = Math.floor(date.getMonth() / 3) + 1;
                        key = `${date.getFullYear()}-Q${quarter}`;
                    }

                    if (!aggregated[key]) {
                        aggregated[key] = 0;
                    }
                    aggregated[key] += record.revenue;
                });

                return aggregated;
            } catch (error) {
                console.error('Error getting sales trend:', error);
                throw error;
            }
        }

        // ============================================
        // REAL-TIME SUBSCRIPTIONS
        // ============================================

        /**
         * Subscribe to sales data changes
         */
        subscribeSalesData(callback) {
            if (!this.isInitialized()) {
                console.error('Cannot subscribe: Supabase client not initialized');
                return null;
            }

            const subscription = this.client
                .channel('sales-changes')
                .on('postgres_changes', 
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: this.tables.SALES_DATA 
                    },
                    (payload) => {
                        console.log('Sales data change:', payload);
                        callback(payload);
                    }
                )
                .subscribe();

            return subscription;
        }

        /**
         * Unsubscribe from real-time updates
         */
        unsubscribe(subscription) {
            if (subscription) {
                this.client.removeChannel(subscription);
            }
        }

        // ============================================
        // AUTHENTICATION (if needed)
        // ============================================

        /**
         * Sign in user
         */
        async signIn(email, password) {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                const { data, error } = await this.client.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Error signing in:', error);
                throw error;
            }
        }

        /**
         * Sign out user
         */
        async signOut() {
            if (!this.isInitialized()) {
                throw new Error('Supabase client not initialized');
            }

            try {
                const { error } = await this.client.auth.signOut();
                if (error) throw error;
                return { success: true };
            } catch (error) {
                console.error('Error signing out:', error);
                throw error;
            }
        }

        /**
         * Get current user
         */
        async getCurrentUser() {
            if (!this.isInitialized()) {
                return null;
            }

            try {
                const { data: { user } } = await this.client.auth.getUser();
                return user;
            } catch (error) {
                console.error('Error getting current user:', error);
                return null;
            }
        }
    }
    
    // Make SupabaseService available globally
    window.SupabaseService = SupabaseService;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.services = window.ChaiVision.services || {};
    window.ChaiVision.services.SupabaseService = SupabaseService;
})();
