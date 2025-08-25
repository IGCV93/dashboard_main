/**
 * Data Service - Handle all data operations
 */

import { generateSampleData } from '../../data/initialData.js';

export class DataService {
    constructor(supabaseClient, config) {
        this.supabase = supabaseClient;
        this.config = config;
    }
    
    async loadSalesData() {
        if (this.supabase && this.config.FEATURES.ENABLE_SUPABASE) {
            try {
                const { data, error } = await this.supabase
                    .from('sales_data')
                    .select('*')
                    .order('date', { ascending: false });
                
                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Supabase error:', error);
                return this.loadLocalData();
            }
        } else {
            return this.loadLocalData();
        }
    }
    
    loadLocalData() {
        // Load from localStorage
        const stored = localStorage.getItem('chai_vision_sales_data');
        if (stored) {
            return JSON.parse(stored);
        }
        
        // Generate sample data
        const startDate = '2025-01-01';
        const endDate = new Date().toISOString().split('T')[0];
        return generateSampleData(startDate, endDate);
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
    
    async updateSettings(settings) {
        // Save to localStorage for now
        localStorage.setItem('chai_vision_settings', JSON.stringify(settings));
        return true;
    }
}
