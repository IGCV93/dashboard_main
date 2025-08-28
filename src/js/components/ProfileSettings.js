/**
 * ProfileSettings Component - User profile management
 * Allows users to update their profile information
 */

(function() {
    'use strict';
    
    function ProfileSettings({ currentUser, onUpdate }) {
        const { useState, useEffect, createElement: h } = React;
        
        // State for form fields
        const [formData, setFormData] = useState({
            full_name: '',
            company: '',
            timezone: '',
            avatar_url: '',
            status: 'active'
        });
        
        // State for UI
        const [isLoading, setIsLoading] = useState(false);
        const [error, setError] = useState('');
        const [success, setSuccess] = useState('');
        const [isEditing, setIsEditing] = useState(false);
        
        // Get Supabase client
        const getSupabaseClient = () => {
            const config = window.CONFIG || window.ChaiVision?.CONFIG;
            if (config?.SUPABASE?.URL && window.supabase) {
                return window.supabase.createClient(
                    config.SUPABASE.URL,
                    config.SUPABASE.ANON_KEY
                );
            }
            return null;
        };
        
        // Initialize form data when component mounts
        useEffect(() => {
            if (currentUser) {
                setFormData({
                    full_name: currentUser.full_name || '',
                    company: currentUser.company || 'Chai Vision',
                    timezone: currentUser.timezone || 'America/New_York',
                    avatar_url: currentUser.avatar_url || '',
                    status: currentUser.status || 'active'
                });
            }
        }, [currentUser]);
        
        // Handle form field changes
        const handleInputChange = (field, value) => {
            setFormData(prev => ({
                ...prev,
                [field]: value
            }));
        };
        
        // Handle form submission
        const handleSubmit = async (e) => {
            e.preventDefault();
            
            if (!currentUser) {
                setError('No user data available');
                return;
            }
            
            setIsLoading(true);
            setError('');
            setSuccess('');
            
            try {
                const supabase = getSupabaseClient();
                
                if (supabase && window.CONFIG?.FEATURES?.ENABLE_SUPABASE) {
                    // Update profile in Supabase
                    const { data, error: updateError } = await supabase
                        .from('profiles')
                        .update({
                            full_name: formData.full_name,
                            company: formData.company,
                            timezone: formData.timezone,
                            avatar_url: formData.avatar_url,
                            status: formData.status,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', currentUser.id)
                        .select()
                        .single();
                    
                    if (updateError) {
                        throw updateError;
                    }
                    
                    // Log the profile update
                    await supabase
                        .from('audit_logs')
                        .insert({
                            user_id: currentUser.id,
                            user_email: currentUser.email,
                            user_role: currentUser.role,
                            action: 'profile_updated',
                            action_details: {
                                updated_fields: Object.keys(formData),
                                timestamp: new Date().toISOString()
                            },
                            reference_id: `PROFILE_UPDATE_${Date.now()}`
                        });
                    
                    // Update local user data
                    const updatedUser = {
                        ...currentUser,
                        ...formData
                    };
                    
                    // Notify parent component
                    if (onUpdate) {
                        onUpdate(updatedUser);
                    }
                    
                    setSuccess('Profile updated successfully!');
                    setIsEditing(false);
                    
                    // Clear success message after 3 seconds
                    setTimeout(() => setSuccess(''), 3000);
                    
                } else {
                    // Demo mode - just update local storage
                    const updatedUser = {
                        ...currentUser,
                        ...formData
                    };
                    
                    localStorage.setItem('chai_vision_user', JSON.stringify(updatedUser));
                    
                    if (onUpdate) {
                        onUpdate(updatedUser);
                    }
                    
                    setSuccess('Profile updated successfully! (Demo mode)');
                    setIsEditing(false);
                    
                    setTimeout(() => setSuccess(''), 3000);
                }
                
            } catch (error) {
                console.error('Failed to update profile:', error);
                setError('Failed to update profile. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };
        
        // Handle cancel edit
        const handleCancel = () => {
            // Reset form data to original values
            setFormData({
                full_name: currentUser.full_name || '',
                company: currentUser.company || 'Chai Vision',
                timezone: currentUser.timezone || 'America/New_York',
                avatar_url: currentUser.avatar_url || '',
                status: currentUser.status || 'active'
            });
            setIsEditing(false);
            setError('');
        };
        
        // Get initials for avatar preview
        const getInitials = (name) => {
            if (!name) return 'U';
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return parts[0][0] + parts[parts.length - 1][0];
            }
            return name.substring(0, 2).toUpperCase();
        };
        
        // Get role color for avatar
        const getRoleColor = (role) => {
            switch(role) {
                case 'Admin':
                    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                case 'Manager':
                    return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
                default:
                    return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
            }
        };
        
        // Timezone options
        const timezoneOptions = [
            { value: 'America/New_York', label: 'Eastern Time (ET)' },
            { value: 'America/Chicago', label: 'Central Time (CT)' },
            { value: 'America/Denver', label: 'Mountain Time (MT)' },
            { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
            { value: 'Europe/London', label: 'London (GMT)' },
            { value: 'Europe/Paris', label: 'Paris (CET)' },
            { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
            { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
            { value: 'Australia/Sydney', label: 'Sydney (AEST)' }
        ];
        
        // Status options
        const statusOptions = [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'suspended', label: 'Suspended' }
        ];
        
        return h('div', { className: 'profile-settings-container' },
            // Header
            h('div', { className: 'settings-header' },
                h('h2', { className: 'settings-title' }, '👤 Profile Settings'),
                h('p', { className: 'settings-subtitle' }, 
                    'Manage your account information and preferences'
                )
            ),
            
            // Error/Success Messages
            error && h('div', { className: 'alert-banner danger' },
                h('div', { className: 'alert-content' },
                    h('span', { className: 'alert-icon' }, '❌'),
                    h('span', { className: 'alert-message' }, error),
                    h('button', { 
                        className: 'alert-close',
                        onClick: () => setError('')
                    }, '×')
                )
            ),
            
            success && h('div', { className: 'alert-banner success' },
                h('div', { className: 'alert-content' },
                    h('span', { className: 'alert-icon' }, '✅'),
                    h('span', { className: 'alert-message' }, success)
                )
            ),
            
            // Profile Information Card
            h('div', { className: 'profile-card' },
                // Avatar Section
                h('div', { className: 'avatar-section' },
                    h('div', { 
                        className: 'avatar-preview',
                        style: { background: getRoleColor(currentUser?.role) }
                    }, 
                        formData.avatar_url ? 
                            h('img', { 
                                src: formData.avatar_url, 
                                alt: formData.full_name || 'Profile',
                                onError: () => handleInputChange('avatar_url', '')
                            }) :
                            h('span', null, getInitials(formData.full_name))
                    ),
                    h('div', { className: 'avatar-info' },
                        h('h3', null, formData.full_name || 'User'),
                        h('p', null, currentUser?.email),
                        h('span', { 
                            className: 'role-badge',
                            style: { background: getRoleColor(currentUser?.role) }
                        }, currentUser?.role)
                    )
                ),
                
                // Form Section
                h('form', { 
                    className: 'profile-form',
                    onSubmit: handleSubmit
                },
                    // Personal Information
                    h('div', { className: 'form-section' },
                        h('h4', { className: 'section-title' }, 'Personal Information'),
                        
                        h('div', { className: 'form-row' },
                            h('div', { className: 'form-group' },
                                h('label', null, 'Full Name'),
                                h('input', {
                                    type: 'text',
                                    className: 'input-field',
                                    value: formData.full_name,
                                    onChange: (e) => handleInputChange('full_name', e.target.value),
                                    placeholder: 'Enter your full name',
                                    disabled: !isEditing,
                                    required: true
                                })
                            ),
                            h('div', { className: 'form-group' },
                                h('label', null, 'Company'),
                                h('input', {
                                    type: 'text',
                                    className: 'input-field',
                                    value: formData.company,
                                    onChange: (e) => handleInputChange('company', e.target.value),
                                    placeholder: 'Enter company name',
                                    disabled: !isEditing
                                })
                            )
                        ),
                        
                        h('div', { className: 'form-row' },
                            h('div', { className: 'form-group' },
                                h('label', null, 'Avatar URL'),
                                h('input', {
                                    type: 'url',
                                    className: 'input-field',
                                    value: formData.avatar_url,
                                    onChange: (e) => handleInputChange('avatar_url', e.target.value),
                                    placeholder: 'https://example.com/avatar.jpg',
                                    disabled: !isEditing
                                }),
                                h('small', { className: 'field-help' }, 
                                    'Leave empty to use initials'
                                )
                            ),
                            h('div', { className: 'form-group' },
                                h('label', null, 'Account Status'),
                                h('select', {
                                    className: 'input-field',
                                    value: formData.status,
                                    onChange: (e) => handleInputChange('status', e.target.value),
                                    disabled: !isEditing
                                },
                                    statusOptions.map(option =>
                                        h('option', { 
                                            key: option.value, 
                                            value: option.value 
                                        }, option.label)
                                    )
                                )
                            )
                        ),
                        
                        h('div', { className: 'form-group' },
                            h('label', null, 'Timezone'),
                            h('select', {
                                className: 'input-field',
                                value: formData.timezone,
                                onChange: (e) => handleInputChange('timezone', e.target.value),
                                disabled: !isEditing
                            },
                                timezoneOptions.map(option =>
                                    h('option', { 
                                        key: option.value, 
                                        value: option.value 
                                    }, option.label)
                                )
                            ),
                            h('small', { className: 'field-help' }, 
                                'Used for date/time displays and notifications'
                            )
                        )
                    ),
                    
                    // Account Information (Read-only)
                    h('div', { className: 'form-section' },
                        h('h4', { className: 'section-title' }, 'Account Information'),
                        
                        h('div', { className: 'form-row' },
                            h('div', { className: 'form-group' },
                                h('label', null, 'Email Address'),
                                h('input', {
                                    type: 'email',
                                    className: 'input-field',
                                    value: currentUser?.email || '',
                                    disabled: true,
                                    style: { backgroundColor: '#f9fafb' }
                                }),
                                h('small', { className: 'field-help' }, 
                                    'Email cannot be changed'
                                )
                            ),
                            h('div', { className: 'form-group' },
                                h('label', null, 'User Role'),
                                h('input', {
                                    type: 'text',
                                    className: 'input-field',
                                    value: currentUser?.role || 'User',
                                    disabled: true,
                                    style: { backgroundColor: '#f9fafb' }
                                }),
                                h('small', { className: 'field-help' }, 
                                    'Role is managed by administrators'
                                )
                            )
                        ),
                        
                        h('div', { className: 'form-row' },
                            h('div', { className: 'form-group' },
                                h('label', null, 'Account Created'),
                                h('input', {
                                    type: 'text',
                                    className: 'input-field',
                                    value: currentUser?.created_at ? 
                                        new Date(currentUser.created_at).toLocaleDateString() : 'N/A',
                                    disabled: true,
                                    style: { backgroundColor: '#f9fafb' }
                                })
                            ),
                            h('div', { className: 'form-group' },
                                h('label', null, 'Last Login'),
                                h('input', {
                                    type: 'text',
                                    className: 'input-field',
                                    value: currentUser?.last_login ? 
                                        new Date(currentUser.last_login).toLocaleString() : 'N/A',
                                    disabled: true,
                                    style: { backgroundColor: '#f9fafb' }
                                })
                            )
                        )
                    ),
                    
                    // Action Buttons
                    h('div', { className: 'form-actions' },
                        isEditing ? 
                            h('div', { className: 'action-buttons' },
                                h('button', {
                                    type: 'submit',
                                    className: 'btn btn-primary',
                                    disabled: isLoading
                                }, isLoading ? 'Saving...' : 'Save Changes'),
                                h('button', {
                                    type: 'button',
                                    className: 'btn btn-secondary',
                                    onClick: handleCancel,
                                    disabled: isLoading
                                }, 'Cancel')
                            ) :
                            h('button', {
                                type: 'button',
                                className: 'btn btn-primary',
                                onClick: () => setIsEditing(true)
                            }, 'Edit Profile')
                    )
                )
            )
        );
    }
    
    // Make ProfileSettings available globally
    window.ProfileSettings = ProfileSettings;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.ProfileSettings = ProfileSettings;
})();
