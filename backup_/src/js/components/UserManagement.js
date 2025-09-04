/**
 * UserManagement Component - Admin panel for managing users
 */

(function() {
    'use strict';
    
    function UserManagement({ dataService, currentUser, brands, channels }) {
        const { useState, useEffect, createElement: h } = React;
        
        const [users, setUsers] = useState([]);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState('');
        const [showAddUser, setShowAddUser] = useState(false);
        const [editingUser, setEditingUser] = useState(null);
        const [searchTerm, setSearchTerm] = useState('');
        const [filterRole, setFilterRole] = useState('all');
        const [filterStatus, setFilterStatus] = useState('active');
        
        // New user form state
        const [newUser, setNewUser] = useState({
            email: '',
            full_name: '',
            role: 'User',
            selectedBrands: [],
            selectedChannels: []
        });
        
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
        
        // Load users
        const loadUsers = async () => {
            setLoading(true);
            setError('');
            
            const supabase = getSupabaseClient();
            if (!supabase) {
                setError('Supabase not configured');
                setLoading(false);
                return;
            }
            
            try {
                // Get all users
                const { data: profiles, error: profilesError } = await supabase
                    .from('profiles')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (profilesError) throw profilesError;
                
                // Get permissions for each user
                const usersWithPermissions = await Promise.all(profiles.map(async (profile) => {
                    // Get brand permissions
                    const { data: brandPerms } = await supabase
                        .from('user_brand_permissions')
                        .select('brand')
                        .eq('user_id', profile.id);
                    
                    // Get channel permissions
                    const { data: channelPerms } = await supabase
                        .from('user_channel_permissions')
                        .select('channel')
                        .eq('user_id', profile.id);
                    
                    return {
                        ...profile,
                        brands: brandPerms?.map(p => p.brand) || [],
                        channels: channelPerms?.map(p => p.channel) || []
                    };
                }));
                
                setUsers(usersWithPermissions);
            } catch (err) {
                console.error('Error loading users:', err);
                setError('Failed to load users');
            } finally {
                setLoading(false);
            }
        };
        
        // Load users on mount
        useEffect(() => {
            loadUsers();
        }, []);
        
        // Filter users based on search and filters
        const filteredUsers = users.filter(user => {
            // Search filter
            if (searchTerm && !user.email.toLowerCase().includes(searchTerm.toLowerCase()) &&
                !user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            
            // Role filter
            if (filterRole !== 'all' && user.role !== filterRole) {
                return false;
            }
            
            // Status filter
            if (filterStatus !== 'all' && user.status !== filterStatus) {
                return false;
            }
            
            return true;
        });
        
        // Handle user activation/deactivation
        const toggleUserStatus = async (user) => {
            const supabase = getSupabaseClient();
            if (!supabase) return;
            
            try {
                const newStatus = user.status === 'active' ? 'inactive' : 'active';
                
                const { error } = await supabase
                    .from('profiles')
                    .update({ 
                        status: newStatus,
                        deactivated_at: newStatus === 'inactive' ? new Date().toISOString() : null,
                        deactivated_by: newStatus === 'inactive' ? currentUser.id : null
                    })
                    .eq('id', user.id);
                
                if (error) throw error;
                
                // Log the action
                await supabase
                    .from('audit_logs')
                    .insert({
                        user_id: currentUser.id,
                        user_email: currentUser.email,
                        user_role: currentUser.role,
                        action: newStatus === 'active' ? 'user_activated' : 'user_deactivated',
                        action_details: {
                            target_user_id: user.id,
                            target_user_email: user.email,
                            new_status: newStatus
                        },
                        reference_id: `USER_STATUS_${Date.now()}`
                    });
                
                // Reload users
                loadUsers();
            } catch (err) {
                console.error('Error updating user status:', err);
                alert('Failed to update user status');
            }
        };
        
        // Handle password reset
        const sendPasswordReset = async (user) => {
            const supabase = getSupabaseClient();
            if (!supabase) return;
            
            if (!confirm(`Send password reset email to ${user.email}?`)) return;
            
            try {
                const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                });
                
                if (error) throw error;
                
                // Log the action
                await supabase
                    .from('audit_logs')
                    .insert({
                        user_id: currentUser.id,
                        user_email: currentUser.email,
                        user_role: currentUser.role,
                        action: 'password_reset_sent',
                        action_details: {
                            target_user_email: user.email
                        },
                        reference_id: `PWD_RESET_${Date.now()}`
                    });
                
                alert(`Password reset email sent to ${user.email}`);
            } catch (err) {
                console.error('Error sending password reset:', err);
                alert('Failed to send password reset email');
            }
        };
        
        // Update user permissions
        const updateUserPermissions = async () => {
            if (!editingUser) return;
            
            const supabase = getSupabaseClient();
            if (!supabase) return;
            
            try {
                // Update profile
                await supabase
                    .from('profiles')
                    .update({
                        role: editingUser.role,
                        full_name: editingUser.full_name
                    })
                    .eq('id', editingUser.id);
                
                // Clear existing permissions
                await supabase
                    .from('user_brand_permissions')
                    .delete()
                    .eq('user_id', editingUser.id);
                
                await supabase
                    .from('user_channel_permissions')
                    .delete()
                    .eq('user_id', editingUser.id);
                
                // Add new brand permissions
                if (editingUser.brands.length > 0) {
                    await supabase
                        .from('user_brand_permissions')
                        .insert(
                            editingUser.brands.map(brand => ({
                                user_id: editingUser.id,
                                brand,
                                created_by: currentUser.id
                            }))
                        );
                }
                
                // Add new channel permissions
                if (editingUser.channels.length > 0) {
                    await supabase
                        .from('user_channel_permissions')
                        .insert(
                            editingUser.channels.map(channel => ({
                                user_id: editingUser.id,
                                channel,
                                created_by: currentUser.id
                            }))
                        );
                }
                
                // Log the action
                await supabase
                    .from('audit_logs')
                    .insert({
                        user_id: currentUser.id,
                        user_email: currentUser.email,
                        user_role: currentUser.role,
                        action: 'user_permissions_updated',
                        action_details: {
                            target_user_id: editingUser.id,
                            target_user_email: editingUser.email,
                            new_role: editingUser.role,
                            brands: editingUser.brands,
                            channels: editingUser.channels
                        },
                        reference_id: `USER_UPDATE_${Date.now()}`
                    });
                
                setEditingUser(null);
                loadUsers();
                alert('User permissions updated successfully');
            } catch (err) {
                console.error('Error updating user:', err);
                alert('Failed to update user permissions');
            }
        };
        
        if (loading) {
            return h('div', { className: 'loading-container' }, 'Loading users...');
        }
        
        return h('div', { className: 'user-management' },
            // Header
            h('div', { className: 'user-management-header' },
                h('h2', null, '👥 User Management'),
                h('button', {
                    className: 'btn btn-primary',
                    onClick: () => setShowAddUser(true)
                }, '+ Add User')
            ),
            
            // Filters
            h('div', { className: 'user-filters' },
                h('input', {
                    type: 'text',
                    placeholder: 'Search users...',
                    className: 'search-input',
                    value: searchTerm,
                    onChange: (e) => setSearchTerm(e.target.value)
                }),
                h('select', {
                    className: 'filter-select',
                    value: filterRole,
                    onChange: (e) => setFilterRole(e.target.value)
                },
                    h('option', { value: 'all' }, 'All Roles'),
                    h('option', { value: 'Admin' }, 'Admin'),
                    h('option', { value: 'Manager' }, 'Manager'),
                    h('option', { value: 'User' }, 'User')
                ),
                h('select', {
                    className: 'filter-select',
                    value: filterStatus,
                    onChange: (e) => setFilterStatus(e.target.value)
                },
                    h('option', { value: 'active' }, 'Active'),
                    h('option', { value: 'inactive' }, 'Inactive'),
                    h('option', { value: 'all' }, 'All Status')
                )
            ),
            
            // Users Table
            h('div', { className: 'users-table' },
                h('table', null,
                    h('thead', null,
                        h('tr', null,
                            h('th', null, 'Name'),
                            h('th', null, 'Email'),
                            h('th', null, 'Role'),
                            h('th', null, 'Brands'),
                            h('th', null, 'Channels'),
                            h('th', null, 'Actions')
                        )
                    ),
                    h('tbody', null,
                        filteredUsers.map(user =>
                            h('tr', { key: user.id },
                                h('td', null, user.full_name || '-'),
                                h('td', null, user.email),
                                h('td', null,
                                    h('span', { 
                                        className: `role-badge role-${user.role.toLowerCase()}`
                                    }, user.role)
                                ),
                                h('td', null,
                                    user.brands.length === brands.length ? 
                                        h('span', { className: 'all-badge' }, 'All Brands') :
                                        user.brands.join(', ') || '-'
                                ),
                                h('td', null,
                                    user.channels.length === channels.length ? 
                                        h('span', { className: 'all-badge' }, 'All Channels') :
                                        user.channels.join(', ') || '-'
                                ),
                                h('td', { className: 'action-buttons' },
                                    h('button', {
                                        className: 'btn-small btn-edit',
                                        onClick: () => setEditingUser({...user})
                                    }, 'Edit'),
                                    h('button', {
                                        className: `btn-small ${user.status === 'active' ? 'btn-deactivate' : 'btn-activate'}`,
                                        onClick: () => toggleUserStatus(user),
                                        disabled: user.id === currentUser.id
                                    }, user.status === 'active' ? 'Deactivate' : 'Activate'),
                                    h('button', {
                                        className: 'btn-small btn-reset',
                                        onClick: () => sendPasswordReset(user)
                                    }, 'Reset Pwd')
                                )
                            )
                        )
                    )
                )
            ),
            
            // Edit User Modal
            editingUser && h('div', { className: 'modal-overlay' },
                h('div', { className: 'modal-content' },
                    h('h3', null, `Edit User: ${editingUser.email}`),
                    h('div', { className: 'form-group' },
                        h('label', null, 'Full Name'),
                        h('input', {
                            type: 'text',
                            value: editingUser.full_name || '',
                            onChange: (e) => setEditingUser({...editingUser, full_name: e.target.value})
                        })
                    ),
                    h('div', { className: 'form-group' },
                        h('label', null, 'Role'),
                        h('select', {
                            value: editingUser.role,
                            onChange: (e) => setEditingUser({...editingUser, role: e.target.value})
                        },
                            h('option', { value: 'Admin' }, 'Admin'),
                            h('option', { value: 'Manager' }, 'Manager'),
                            h('option', { value: 'User' }, 'User')
                        )
                    ),
                    h('div', { className: 'form-group' },
                        h('label', null, 'Brands'),
                        h('div', { className: 'checkbox-group' },
                            brands.map(brand =>
                                h('label', { key: brand },
                                    h('input', {
                                        type: 'checkbox',
                                        checked: editingUser.brands.includes(brand),
                                        onChange: (e) => {
                                            if (e.target.checked) {
                                                setEditingUser({
                                                    ...editingUser,
                                                    brands: [...editingUser.brands, brand]
                                                });
                                            } else {
                                                setEditingUser({
                                                    ...editingUser,
                                                    brands: editingUser.brands.filter(b => b !== brand)
                                                });
                                            }
                                        }
                                    }),
                                    h('span', null, brand)
                                )
                            )
                        )
                    ),
                    h('div', { className: 'form-group' },
                        h('label', null, 'Channels'),
                        h('div', { className: 'checkbox-group' },
                            channels.map(channel =>
                                h('label', { key: channel },
                                    h('input', {
                                        type: 'checkbox',
                                        checked: editingUser.channels.includes(channel),
                                        onChange: (e) => {
                                            if (e.target.checked) {
                                                setEditingUser({
                                                    ...editingUser,
                                                    channels: [...editingUser.channels, channel]
                                                });
                                            } else {
                                                setEditingUser({
                                                    ...editingUser,
                                                    channels: editingUser.channels.filter(c => c !== channel)
                                                });
                                            }
                                        }
                                    }),
                                    h('span', null, channel)
                                )
                            )
                        )
                    ),
                    h('div', { className: 'modal-actions' },
                        h('button', {
                            className: 'btn btn-primary',
                            onClick: updateUserPermissions
                        }, 'Save Changes'),
                        h('button', {
                            className: 'btn btn-secondary',
                            onClick: () => setEditingUser(null)
                        }, 'Cancel')
                    )
                )
            ),
            
            // Add User Instructions
            showAddUser && h('div', { className: 'modal-overlay' },
                h('div', { className: 'modal-content' },
                    h('h3', null, 'Add New User'),
                    h('div', { className: 'info-message' },
                        h('p', null, 'To add a new user:'),
                        h('ol', null,
                            h('li', null, 'Go to Supabase Dashboard → Authentication → Users'),
                            h('li', null, 'Click "Add user" → "Create new user"'),
                            h('li', null, 'Enter email and password'),
                            h('li', null, 'After creation, return here to set permissions')
                        )
                    ),
                    h('button', {
                        className: 'btn btn-secondary',
                        onClick: () => {
                            setShowAddUser(false);
                            loadUsers(); // Refresh in case new user was added
                        }
                    }, 'Close & Refresh')
                )
            )
        );
    }
    
    // Make UserManagement available globally
    window.UserManagement = UserManagement;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.UserManagement = UserManagement;
})();
