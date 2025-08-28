/**
 * Data Service - Handle all data operations
 */

(function() {
    'use strict';
    
    class DataService {
        constructor(supabaseClient, config) {
            this.supabase = supabaseClient;
            this.config = config;
        }
        
        async loadSalesData() {
            console.log('🔍 Loading sales data...');
            
            if (this.supabase && this.config.FEATURES.ENABLE_SUPABASE) {
                try {
                    console.log('🔍 Trying Supabase...');
                    const { data, error } = await this.supabase
                        .from('sales_data')
                        .select('*')
                        .order('date', { ascending: false });
                    
                    if (error) {
                        console.error('❌ Supabase error:', error);
                        throw error;
                    }
                    
                    console.log('✅ Supabase data loaded:', data?.length || 0, 'records');
                    
                    // If no data in Supabase, generate sample data
                    if (!data || data.length === 0) {
                        console.log('📊 No data in Supabase, generating sample data...');
                        const sampleData = this.generateSampleData();
                        return sampleData;
                    }
                    
                    return data;
                } catch (error) {
                    console.error('❌ Supabase error, falling back to local:', error);
                    return this.loadLocalData();
                }
            } else {
                console.log('🔍 Supabase disabled, using local data...');
                return this.loadLocalData();
            }
        }
        
        loadLocalData() {
            // Load from localStorage
            const stored = localStorage.getItem('chai_vision_sales_data');
            if (stored) {
                return JSON.parse(stored);
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
            if (this.supabase && this.config.FEATURES.ENABLE_SUPABASE) {
                try {
                    const { error } = await this.supabase
                        .from('sales_data')
                        .insert(data);
                    
                    if (error) throw error;
                    return true;
                } catch (error) {
                    console.error('Supabase error:', error);
                    return this.saveLocalData(data);
                }
            } else {
                return this.saveLocalData(data);
            }
        }
        
        saveLocalData(data) {
            const existing = this.loadLocalData();
            const updated = [...existing, ...data];
            localStorage.setItem('chai_vision_sales_data', JSON.stringify(updated));
            return true;
        }
        
        generateSampleData() {
            console.log('📊 Generating sample sales data...');
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
                                baseRevenue = 8200 * brandMultiplier;
                                break;
                        }
                        
                        const weekendMultiplier = isWeekend ? 1.3 : 1;
                        const variance = (Math.random() - 0.5) * baseRevenue * 0.3;
                        
                        if (Math.random() > 0.3) {
                            data.push({
                                date: d.toISOString().split('T')[0],
                                channel,
                                brand,
                                revenue: Math.max(0, baseRevenue * weekendMultiplier + variance),
                                timestamp: new Date().toISOString()
                            });
                        }
                    });
                });
            }
            
            console.log('✅ Generated', data.length, 'sample records');
            return data;
        }
        
        async updateSettings(settings) {
            // Save to localStorage for now
            localStorage.setItem('chai_vision_settings', JSON.stringify(settings));
            return true;
        }
    }
    
    // Make DataService available globally
    window.DataService = DataService;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.services = window.ChaiVision.services || {};
    window.ChaiVision.services.DataService = DataService;
})();
