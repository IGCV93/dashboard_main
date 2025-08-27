/**
 * Supabase Service - Enhanced with complete authentication
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
                CHANNELS: 'channels',
                TARGETS: 'kpi_targets',
                TARGETS_HISTORY: 'kpi_targets_history',
                USERS: 'profiles',
                BRAND_PERMISSIONS: 'user_brand_permissions',
                CHANNEL_PERMISSIONS: 'user_channel_permissions',
                AUDIT_LOGS: 'audit_logs',
                USER_PREFERENCES: 'user_preferences'
            };
        }

        // ============================================
        // AUTHENTICATION METHODS
        // ============================================
        
        /**
         * Sign in user
         */
        async signIn(email, password) {
            if (!this.client) throw new Error('Supabase client not initialized');
            
            const { data, error } = await this.client.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            // Get full user profile
            const profile = await this.getUserProfile(data.user.id);
            
            // Log the login
            await this.logAction(data.user.id, 'login', {
                email,
                timestamp: new Date().toISOString()
            });
            
            return { user: data.user, profile, session: data.session };
        }
        
        /**
         * Sign out user
         */
        async signOut() {
            if (!this.client) throw new Error('Supabase client not initialized');
            
            // Get current user before signing out
            const { data: { user } } = await this.client.auth.getUser();
            
            if (user) {
                // Log the logout
                await this.logAction(user.id, 'logout', {
                    timestamp: new Date().toISOString()
                });
            }
            
            const { error } = await this.client.auth.signOut();
            if (error) throw error;
            
            return { success: true };
        }
        
        /**
         * Get current session
         */
        async getSession() {
            if (!this.client) return null;
            
            const { data: { session } } = await this.client.auth.getSession();
            return session;
        }
        
        /**
         * Get current user with profile
         */
        async getCurrentUser() {
            if (!this.client) return null;
            
            const { data: { user } } = await this.client.auth.getUser();
            if (!user) return null;
            
            const profile = await this.getUserProfile(user.id);
            const permissions = await this.getUserPermissions(user.id);
            
            return {
                ...user,
                ...profile,
                permissions
            };
        }
        
        /**
         * Get user profile
         */
        async getUserProfile(userId) {
            const { data, error } = await this.client
                .from(this.tables.USERS)
                .select('*')
                .eq('id', userId)
                .single();
            
            if (error) throw error;
            return data;
        }
        
        /**
         * Get user permissions
         */
        async getUserPermissions(userId) {
            // Get brand permissions
            const { data: brands } = await this.client
                .from(this.tables.BRAND_PERMISSIONS)
                .select('brand')
                .eq('user_id', userId);
            
            // Get channel permissions
            const { data: channels } = await this.client
                .from(this.tables.CHANNEL_PERMISSIONS)
                .select('channel')
                .eq('user_id', userId);
            
            return {
                brands: brands?.map(b => b.brand) || [],
                channels: channels?.map(c => c.channel) || []
            };
        }
        
        /**
         * Update user profile
         */
        async updateUserProfile(userId, updates) {
            const { data, error } = await this.client
                .from(this.tables.USERS)
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        }
        
        /**
         * Reset password request
         */
        async resetPassword(email) {
            const { error } = await this.client.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });
            
            if (error) throw error;
            return { success: true };
        }
        
        /**
         * Update password
         */
        async updatePassword(newPassword) {
            const { error } = await this.client.auth.updateUser({
                password: newPassword
            });
            
            if (error) throw error;
            return { success: true };
        }
        
        // ============================================
        // USER MANAGEMENT (Admin Only)
        // ============================================
        
        /**
         * Get all users (admin only)
         */
        async getAllUsers() {
            const { data, error } = await this.client
                .from(this.tables.USERS)
                .select(`
                    *,
                    ${this.tables.BRAND_PERMISSIONS} (brand),
                    ${this.tables.CHANNEL_PERMISSIONS} (channel)
                `)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data;
        }
        
        /**
         * Create new user (admin only)
         */
        async createUser(userData, password, createdBy) {
            // This would typically be done via admin API
            // For now, return instruction
            return {
                message: 'User creation must be done via Supabase Dashboard',
                userData,
                nextSteps: 'After creating user in dashboard, update their profile and permissions'
            };
        }
        
        /**
         * Update user permissions
         */
        async updateUserPermissions(userId, brands, channels, updatedBy) {
            // Clear existing permissions
            await this.client
                .from(this.tables.BRAND_PERMISSIONS)
                .delete()
                .eq('user_id', userId);
            
            await this.client
                .from(this.tables.CHANNEL_PERMISSIONS)
                .delete()
                .eq('user_id', userId);
            
            // Add new brand permissions
            if (brands && brands.length > 0) {
                const brandPermissions = brands.map(brand => ({
                    user_id: userId,
                    brand,
                    created_by: updatedBy
                }));
                
                await this.client
                    .from(this.tables.BRAND_PERMISSIONS)
                    .insert(brandPermissions);
            }
            
            // Add new channel permissions
            if (channels && channels.length > 0) {
                const channelPermissions = channels.map(channel => ({
                    user_id: userId,
                    channel,
                    created_by: updatedBy
                }));
                
                await this.client
                    .from(this.tables.CHANNEL_PERMISSIONS)
                    .insert(channelPermissions);
            }
            
            return { success: true };
        }
        
        /**
         * Deactivate user
         */
        async deactivateUser(userId, deactivatedBy) {
            const { data, error } = await this.client
                .from(this.tables.USERS)
                .update({
                    status: 'inactive',
                    deactivated_at: new Date().toISOString(),
                    deactivated_by: deactivatedBy
                })
                .eq('id', userId)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        }
        
        /**
         * Reactivate user
         */
        async reactivateUser(userId) {
            const { data, error } = await this.client
                .from(this.tables.USERS)
                .update({
                    status: 'active',
                    deactivated_at: null,
                    deactivated_by: null
                })
                .eq('id', userId)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        }
        
        // ============================================
        // USER PREFERENCES
        // ============================================
        
        /**
         * Get user preferences
         */
        async getUserPreferences(userId) {
            const { data, error } = await this.client
                .from(this.tables.USER_PREFERENCES)
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error && error.code !== 'PGRST116') throw error; // Ignore not found
            return data || {};
        }
        
        /**
         * Update user preferences
         */
        async updateUserPreferences(userId, preferences) {
            const { data, error } = await this.client
                .from(this.tables.USER_PREFERENCES)
                .upsert({
                    user_id: userId,
                    ...preferences,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (error) throw error;
            return data;
        }
        
        // ============================================
        // AUDIT LOGGING
        // ============================================
        
        /**
         * Log an action
         */
        async logAction(userId, action, details = {}) {
            try {
                const { data: user } = await this.client
                    .from(this.tables.USERS)
                    .select('email, role')
                    .eq('id', userId)
                    .single();
                
                await this.client
                    .from(this.tables.AUDIT_LOGS)
                    .insert({
                        user_id: userId,
                        user_email: user?.email,
                        user_role: user?.role,
                        action,
                        action_details: details,
                        reference_id: details.reference_id || `${action}_${Date.now()}`,
                        created_at: new Date().toISOString()
                    });
            } catch (error) {
                console.error('Failed to log action:', error);
            }
        }
        
        /**
         * Get audit logs
         */
        async getAuditLogs(filters = {}) {
            let query = this.client
                .from(this.tables.AUDIT_LOGS)
                .select('*')
                .order('created_at', { ascending: false });
            
            if (filters.user_id) {
                query = query.eq('user_id', filters.user_id);
            }
            
            if (filters.action) {
                query = query.eq('action', filters.action);
            }
            
            if (filters.start_date) {
                query = query.gte('created_at', filters.start_date);
            }
            
            if (filters.end_date) {
                query = query.lte('created_at', filters.end_date);
            }
            
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            return data;
        }
        
        // ... (keep all existing methods from the original file) ...
    }
    
    // Make SupabaseService available globally
    window.SupabaseService = SupabaseService;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.services = window.ChaiVision.services || {};
    window.ChaiVision.services.SupabaseService = SupabaseService;
})();
