/**
 * Preferences Component - User dashboard preferences management
 * Allows users to customize their dashboard experience
 */

(function() {
    'use strict';
    
    function Preferences({ currentUser, onUpdate }) {
        const { useState, useEffect, createElement: h } = React;
        
        // State for preferences
        const [preferences, setPreferences] = useState({
            last_selected_view: 'quarterly',
            last_selected_period: 'Q1',
            last_selected_year: new Date().getFullYear().toString(),
            last_selected_brand: 'All Brands',
            theme: 'light',
            auto_save: true,
            notifications_enabled: true,
            default_dashboard_view: 'quarterly',
            refresh_interval: 30,
            show_tutorials: true,
            compact_mode: false
        });
        
        // State for UI
        const [isLoading, setIsLoading] = useState(true);
        const [isSaving, setIsSaving] = useState(false);
        const [error, setError] = useState(null);
        const [success, setSuccess] = useState(null);
        
        // Load user preferences on component mount
        useEffect(() => {
            loadPreferences();
        }, []);
        
        // Apply preferences when they change
        useEffect(() => {
            applyPreferences(preferences);
        }, [preferences]);
        
        // Load preferences from Supabase or localStorage
        const loadPreferences = async () => {
            try {
                setIsLoading(true);
                setError(null);
                
                const config = window.CONFIG || window.ChaiVision?.CONFIG;
                const supabase = window.APP_STATE?.supabaseClient;
                
                if (supabase && config?.FEATURES?.ENABLE_SUPABASE) {
                    // Load from Supabase
                    const { data, error } = await supabase
                        .from('user_preferences')
                        .select('*')
                        .eq('user_id', currentUser.id)
                        .single();
                    
                    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                        console.error('Failed to load preferences:', error);
                        throw error;
                    }
                    
                    if (data) {
                        setPreferences(prev => ({
                            ...prev,
                            ...data
                        }));
                    }
                } else {
                    // Load from localStorage
                    const saved = localStorage.getItem('chai_vision_preferences');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        setPreferences(prev => ({
                            ...prev,
                            ...parsed
                        }));
                    }
                }
            } catch (err) {
                console.error('Error loading preferences:', err);
                setError('Failed to load preferences. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };
        
        // Apply preferences throughout the application
        const applyPreferences = (prefs) => {
            // Apply theme
            applyTheme(prefs.theme);
            
            // Apply compact mode
            applyCompactMode(prefs.compact_mode);
            
            // Apply notifications
            applyNotifications(prefs.notifications_enabled);
            
            // Apply refresh interval
            applyRefreshInterval(prefs.refresh_interval);
            
            // Apply tutorials setting
            applyTutorials(prefs.show_tutorials);
        };
        
        // Apply theme to the application
        const applyTheme = (theme) => {
            const root = document.documentElement;
            const body = document.body;
            
            // Remove existing theme classes
            root.classList.remove('theme-light', 'theme-dark');
            body.classList.remove('theme-light', 'theme-dark');
            
            // Add new theme class
            root.classList.add(`theme-${theme}`);
            body.classList.add(`theme-${theme}`);
            
            // Update CSS custom properties
            if (theme === 'dark') {
                root.style.setProperty('--bg-primary', '#1f2937');
                root.style.setProperty('--bg-secondary', '#374151');
                root.style.setProperty('--text-primary', '#f9fafb');
                root.style.setProperty('--text-secondary', '#d1d5db');
                root.style.setProperty('--border-color', '#4b5563');
            } else {
                root.style.setProperty('--bg-primary', '#ffffff');
                root.style.setProperty('--bg-secondary', '#f9fafb');
                root.style.setProperty('--text-primary', '#1f2937');
                root.style.setProperty('--text-secondary', '#6b7280');
                root.style.setProperty('--border-color', '#e5e7eb');
            }
            
            console.log(`🎨 Theme applied: ${theme}`);
        };
        
        // Apply compact mode
        const applyCompactMode = (enabled) => {
            const root = document.documentElement;
            
            if (enabled) {
                root.classList.add('compact-mode');
                root.style.setProperty('--spacing-base', '0.75rem');
                root.style.setProperty('--font-size-base', '0.875rem');
            } else {
                root.classList.remove('compact-mode');
                root.style.setProperty('--spacing-base', '1rem');
                root.style.setProperty('--font-size-base', '1rem');
            }
            
            console.log(`📏 Compact mode: ${enabled ? 'enabled' : 'disabled'}`);
        };
        
        // Apply notifications setting
        const applyNotifications = (enabled) => {
            if (enabled) {
                // Request notification permission if not already granted
                if (Notification.permission === 'default') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            console.log('🔔 Notifications enabled');
                        } else {
                            console.log('🔕 Notifications permission denied');
                        }
                    });
                } else if (Notification.permission === 'granted') {
                    console.log('🔔 Notifications already enabled');
                }
            } else {
                console.log('🔕 Notifications disabled');
            }
        };
        
        // Apply refresh interval
        const applyRefreshInterval = (interval) => {
            // Clear existing refresh interval
            if (window.chaiVisionRefreshInterval) {
                clearInterval(window.chaiVisionRefreshInterval);
            }
            
            // Set new refresh interval if auto-save is enabled
            if (preferences.auto_save && interval > 0) {
                window.chaiVisionRefreshInterval = setInterval(() => {
                    // Trigger data refresh
                    if (window.APP_STATE && window.APP_STATE.dataService) {
                        console.log('🔄 Auto-refreshing data...');
                        // This would trigger a data refresh in the dashboard
                        if (window.refreshDashboardData) {
                            window.refreshDashboardData();
                        }
                    }
                }, interval * 1000);
                
                console.log(`⏰ Refresh interval set to ${interval} seconds`);
            }
        };
        
        // Apply tutorials setting
        const applyTutorials = (enabled) => {
            if (enabled) {
                // Show tutorial tooltips or guides
                console.log('📚 Tutorials enabled');
                // This would show tutorial elements
                document.body.classList.add('show-tutorials');
            } else {
                // Hide tutorial elements
                console.log('📚 Tutorials disabled');
                document.body.classList.remove('show-tutorials');
            }
        };
        
        // Save preferences to Supabase or localStorage
        const savePreferences = async (newPreferences) => {
            try {
                setIsSaving(true);
                setError(null);
                setSuccess(null);
                
                const config = window.CONFIG || window.ChaiVision?.CONFIG;
                const supabase = window.APP_STATE?.supabaseClient;
                
                if (supabase && config?.FEATURES?.ENABLE_SUPABASE) {
                    // Save to Supabase
                    const { error } = await supabase
                        .from('user_preferences')
                        .upsert({
                            user_id: currentUser.id,
                            ...newPreferences,
                            updated_at: new Date().toISOString()
                        });
                    
                    if (error) {
                        console.error('Failed to save preferences:', error);
                        throw error;
                    }
                    
                    // Log the preference update
                    await supabase
                        .from('audit_logs')
                        .insert({
                            user_id: currentUser.id,
                            user_email: currentUser.email,
                            user_role: currentUser.role,
                            action: 'preferences_updated',
                            action_details: {
                                updated_preferences: newPreferences,
                                timestamp: new Date().toISOString()
                            },
                            reference_id: `PREF_UPDATE_${Date.now()}`
                        });
                    
                } else {
                    // Save to localStorage
                    localStorage.setItem('chai_vision_preferences', JSON.stringify(newPreferences));
                }
                
                setPreferences(newPreferences);
                setSuccess('Preferences saved successfully!');
                
                // Update global app state
                if (window.APP_STATE) {
                    window.APP_STATE.preferences = newPreferences;
                }
                
                // Call parent update handler if provided
                if (onUpdate) {
                    onUpdate(newPreferences);
                }
                
                // Apply the new preferences immediately
                applyPreferences(newPreferences);
                
                // Clear success message after 3 seconds
                setTimeout(() => setSuccess(null), 3000);
                
            } catch (err) {
                console.error('Error saving preferences:', err);
                setError('Failed to save preferences. Please try again.');
            } finally {
                setIsSaving(false);
            }
        };
        
        // Handle preference change
        const handlePreferenceChange = (key, value) => {
            const newPreferences = {
                ...preferences,
                [key]: value
            };
            setPreferences(newPreferences);
            
            // Apply certain preferences immediately for better UX
            if (key === 'theme') {
                applyTheme(value);
            } else if (key === 'compact_mode') {
                applyCompactMode(value);
            } else if (key === 'notifications_enabled') {
                applyNotifications(value);
            } else if (key === 'show_tutorials') {
                applyTutorials(value);
            }
        };
        
        // Handle save button click
        const handleSave = () => {
            savePreferences(preferences);
        };
        
        // Handle reset to defaults
        const handleReset = () => {
            const defaultPreferences = {
                last_selected_view: 'quarterly',
                last_selected_period: 'Q1',
                last_selected_year: new Date().getFullYear().toString(),
                last_selected_brand: 'All Brands',
                theme: 'light',
                auto_save: true,
                notifications_enabled: true,
                default_dashboard_view: 'quarterly',
                refresh_interval: 30,
                show_tutorials: true,
                compact_mode: false
            };
            setPreferences(defaultPreferences);
            
            // Apply default preferences immediately
            applyPreferences(defaultPreferences);
        };
        
        // Loading state
        if (isLoading) {
            return h('div', { className: 'preferences-loading' },
                h('div', { className: 'loading-spinner' }),
                h('div', { className: 'loading-text' }, 'Loading preferences...')
            );
        }
        
        return h('div', { className: 'preferences-container' },
            // Header
            h('div', { className: 'preferences-header' },
                h('h1', { className: 'preferences-title' }, 'Dashboard Preferences'),
                h('p', { className: 'preferences-subtitle' }, 
                    'Customize your dashboard experience and default settings'
                )
            ),
            
            // Error/Success Messages
            error && h('div', { className: 'preferences-error' },
                h('span', { className: 'error-icon' }, '⚠️'),
                h('span', null, error)
            ),
            
            success && h('div', { className: 'preferences-success' },
                h('span', { className: 'success-icon' }, '✅'),
                h('span', null, success)
            ),
            
            // Preferences Form
            h('div', { className: 'preferences-form' },
                // Dashboard Settings Section
                h('div', { className: 'preferences-section' },
                    h('h2', { className: 'section-title' }, 'Dashboard Settings'),
                    h('div', { className: 'section-content' },
                        // Default View
                        h('div', { className: 'preference-item' },
                            h('label', { className: 'preference-label' }, 'Default Dashboard View'),
                            h('select', {
                                className: 'preference-select',
                                value: preferences.default_dashboard_view,
                                onChange: (e) => handlePreferenceChange('default_dashboard_view', e.target.value)
                            },
                                h('option', { value: 'quarterly' }, 'Quarterly View'),
                                h('option', { value: 'monthly' }, 'Monthly View'),
                                h('option', { value: 'daily' }, 'Daily View')
                            ),
                            h('p', { className: 'preference-help' }, 
                                'Choose the default view when you first open the dashboard'
                            )
                        ),
                        
                        // Default Brand
                        h('div', { className: 'preference-item' },
                            h('label', { className: 'preference-label' }, 'Default Brand'),
                            h('select', {
                                className: 'preference-select',
                                value: preferences.last_selected_brand,
                                onChange: (e) => handlePreferenceChange('last_selected_brand', e.target.value)
                            },
                                h('option', { value: 'All Brands' }, 'All Brands'),
                                h('option', { value: 'LifePro' }, 'LifePro'),
                                h('option', { value: 'PetCove' }, 'PetCove')
                            ),
                            h('p', { className: 'preference-help' }, 
                                'Select your preferred default brand for the dashboard'
                            )
                        ),
                        
                        // Default Period
                        h('div', { className: 'preference-item' },
                            h('label', { className: 'preference-label' }, 'Default Period'),
                            h('select', {
                                className: 'preference-select',
                                value: preferences.last_selected_period,
                                onChange: (e) => handlePreferenceChange('last_selected_period', e.target.value)
                            },
                                h('option', { value: 'Q1' }, 'Q1'),
                                h('option', { value: 'Q2' }, 'Q2'),
                                h('option', { value: 'Q3' }, 'Q3'),
                                h('option', { value: 'Q4' }, 'Q4')
                            ),
                            h('p', { className: 'preference-help' }, 
                                'Choose the default quarter to display'
                            )
                        )
                    )
                ),
                
                // Appearance Section
                h('div', { className: 'preferences-section' },
                    h('h2', { className: 'section-title' }, 'Appearance'),
                    h('div', { className: 'section-content' },
                        // Theme
                        h('div', { className: 'preference-item' },
                            h('label', { className: 'preference-label' }, 'Theme'),
                            h('div', { className: 'theme-options' },
                                h('label', { className: 'theme-option' },
                                    h('input', {
                                        type: 'radio',
                                        name: 'theme',
                                        value: 'light',
                                        checked: preferences.theme === 'light',
                                        onChange: (e) => handlePreferenceChange('theme', e.target.value)
                                    }),
                                    h('span', { className: 'theme-label' }, 'Light'),
                                    h('div', { className: 'theme-preview light' })
                                ),
                                h('label', { className: 'theme-option' },
                                    h('input', {
                                        type: 'radio',
                                        name: 'theme',
                                        value: 'dark',
                                        checked: preferences.theme === 'dark',
                                        onChange: (e) => handlePreferenceChange('theme', e.target.value)
                                    }),
                                    h('span', { className: 'theme-label' }, 'Dark'),
                                    h('div', { className: 'theme-preview dark' })
                                )
                            ),
                            h('p', { className: 'preference-help' }, 
                                'Choose your preferred color theme'
                            )
                        ),
                        
                        // Compact Mode
                        h('div', { className: 'preference-item' },
                            h('label', { className: 'preference-label' }, 'Compact Mode'),
                            h('div', { className: 'toggle-switch' },
                                h('input', {
                                    type: 'checkbox',
                                    id: 'compact-mode',
                                    checked: preferences.compact_mode,
                                    onChange: (e) => handlePreferenceChange('compact_mode', e.target.checked)
                                }),
                                h('label', { htmlFor: 'compact-mode', className: 'toggle-label' })
                            ),
                            h('p', { className: 'preference-help' }, 
                                'Enable compact mode for more data on screen'
                            )
                        )
                    )
                ),
                
                // Behavior Section
                h('div', { className: 'preferences-section' },
                    h('h2', { className: 'section-title' }, 'Behavior'),
                    h('div', { className: 'section-content' },
                        // Auto Save
                        h('div', { className: 'preference-item' },
                            h('label', { className: 'preference-label' }, 'Auto Save'),
                            h('div', { className: 'toggle-switch' },
                                h('input', {
                                    type: 'checkbox',
                                    id: 'auto-save',
                                    checked: preferences.auto_save,
                                    onChange: (e) => handlePreferenceChange('auto_save', e.target.checked)
                                }),
                                h('label', { htmlFor: 'auto-save', className: 'toggle-label' })
                            ),
                            h('p', { className: 'preference-help' }, 
                                'Automatically save your preferences and dashboard state'
                            )
                        ),
                        
                        // Notifications
                        h('div', { className: 'preference-item' },
                            h('label', { className: 'preference-label' }, 'Notifications'),
                            h('div', { className: 'toggle-switch' },
                                h('input', {
                                    type: 'checkbox',
                                    id: 'notifications',
                                    checked: preferences.notifications_enabled,
                                    onChange: (e) => handlePreferenceChange('notifications_enabled', e.target.checked)
                                }),
                                h('label', { htmlFor: 'notifications', className: 'toggle-label' })
                            ),
                            h('p', { className: 'preference-help' }, 
                                'Enable browser notifications for important updates'
                            )
                        ),
                        
                        // Show Tutorials
                        h('div', { className: 'preference-item' },
                            h('label', { className: 'preference-label' }, 'Show Tutorials'),
                            h('div', { className: 'toggle-switch' },
                                h('input', {
                                    type: 'checkbox',
                                    id: 'tutorials',
                                    checked: preferences.show_tutorials,
                                    onChange: (e) => handlePreferenceChange('show_tutorials', e.target.checked)
                                }),
                                h('label', { htmlFor: 'tutorials', className: 'toggle-label' })
                            ),
                            h('p', { className: 'preference-help' }, 
                                'Show helpful tutorials and tips'
                            )
                        ),
                        
                        // Refresh Interval
                        h('div', { className: 'preference-item' },
                            h('label', { className: 'preference-label' }, 'Data Refresh Interval (seconds)'),
                            h('input', {
                                type: 'number',
                                className: 'preference-input',
                                min: '10',
                                max: '300',
                                value: preferences.refresh_interval,
                                onChange: (e) => handlePreferenceChange('refresh_interval', parseInt(e.target.value))
                            }),
                            h('p', { className: 'preference-help' }, 
                                'How often to automatically refresh dashboard data (10-300 seconds)'
                            )
                        )
                    )
                )
            ),
            
            // Action Buttons
            h('div', { className: 'preferences-actions' },
                h('button', {
                    className: 'btn btn-secondary',
                    onClick: handleReset,
                    disabled: isSaving
                }, 'Reset to Defaults'),
                h('button', {
                    className: 'btn btn-primary',
                    onClick: handleSave,
                    disabled: isSaving
                }, isSaving ? 'Saving...' : 'Save Preferences')
            )
        );
    }
    
    // Make Preferences available globally
    window.Preferences = Preferences;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.Preferences = Preferences;
})();
