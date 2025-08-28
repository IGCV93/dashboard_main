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
