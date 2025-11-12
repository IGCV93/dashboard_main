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
         * Creates a user via Supabase Auth signUp
         */
        async createUser(userData, password, createdBy) {
            if (!this.client) throw new Error('Supabase client not initialized');
            
            // Create user via Supabase Auth
            const { data: authData, error: authError } = await this.client.auth.signUp({
                email: userData.email,
                password: password,
                options: {
                    data: {
                        full_name: userData.full_name || '',
                        role: userData.role || 'User'
                    },
                    email_redirect_to: null // Don't require email confirmation for admin-created users
                }
            });
            
            if (authError) throw authError;
            
            if (!authData.user) {
                throw new Error('User creation failed - no user returned');
            }
            
            // Wait a moment for the profile trigger to create the profile record
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Update profile with role and full_name
            const { error: profileError } = await this.client
                .from(this.tables.USERS)
                .update({
                    full_name: userData.full_name || '',
                    role: userData.role || 'User',
                    status: 'active'
                })
                .eq('id', authData.user.id);
            
            if (profileError) {
                console.warn('Profile update error (may be handled by trigger):', profileError);
            }
            
            // Add brand permissions if provided
            if (userData.brands && userData.brands.length > 0) {
                await this.updateUserPermissions(authData.user.id, userData.brands, userData.channels || [], createdBy);
            }
            
            // Log the action
            await this.logAction(createdBy, 'user_created', {
                new_user_id: authData.user.id,
                new_user_email: userData.email,
                role: userData.role,
                brands: userData.brands || [],
                channels: userData.channels || []
            });
            
            return {
                user: authData.user,
                success: true
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
