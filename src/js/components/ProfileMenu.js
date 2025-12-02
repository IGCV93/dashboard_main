/**
 * ProfileMenu Component - User profile dropdown menu
 */

(function () {
    'use strict';

    function ProfileMenu({ currentUser, onLogout, onNavigate }) {
        const { useState, useEffect, useRef, createElement: h } = React;

        const [showMenu, setShowMenu] = useState(false);
        const menuRef = useRef(null);

        // Click outside handler
        useEffect(() => {
            const handleClickOutside = (event) => {
                if (menuRef.current && !menuRef.current.contains(event.target)) {
                    setShowMenu(false);
                }
            };

            if (showMenu) {
                document.addEventListener('mousedown', handleClickOutside);
            }

            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }, [showMenu]);

        // Get initials for avatar
        const getInitials = (name) => {
            if (!name) return 'U';
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return parts[0][0] + parts[parts.length - 1][0];
            }
            return name.substring(0, 2).toUpperCase();
        };

        // Get role color
        const getRoleColor = (role) => {
            switch (role) {
                case 'Admin':
                    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                case 'Manager':
                    return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
                default:
                    return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
            }
        };

        const handleLogout = async () => {
            console.log('🔍 handleLogout called');

            // Confirmation dialog to prevent accidental logouts
            if (!confirm('Are you sure you want to sign out?')) {
                console.log('🔍 User cancelled logout');
                return;
            }

            console.log('🔍 User confirmed logout, proceeding...');
            setShowMenu(false);

            try {
                // Get Supabase client
                const config = window.CONFIG || window.ChaiVision?.CONFIG;
                console.log('🔍 Config:', config);

                if (config?.SUPABASE?.URL && window.supabase) {
                    const supabase = window.supabase.createClient(
                        config.SUPABASE.URL,
                        config.SUPABASE.ANON_KEY
                    );

                    console.log('🔍 Logging to audit_logs...');
                    // Log the logout
                    await supabase
                        .from('audit_logs')
                        .insert({
                            user_id: currentUser.id,
                            user_email: currentUser.email,
                            user_role: currentUser.role,
                            action: 'logout',
                            action_details: {
                                timestamp: new Date().toISOString()
                            },
                            reference_id: `LOGOUT_${Date.now()}`
                        });

                    console.log('🔍 Signing out from Supabase...');
                    // Sign out from Supabase
                    await supabase.auth.signOut();
                }

                console.log('🔍 Calling onLogout callback:', typeof onLogout);
                // Call parent logout handler first (this will handle the main logout logic)
                if (onLogout) {
                    onLogout();
                } else {
                    // Fallback if no parent handler
                    console.log('No parent logout handler, using fallback');
                    localStorage.removeItem('chai_vision_remember');
                    sessionStorage.clear();
                    window.location.reload();
                }

            } catch (error) {
                console.error('Logout error:', error);
                // Even if there's an error, still try to logout
                if (onLogout) {
                    onLogout();
                } else {
                    localStorage.removeItem('chai_vision_remember');
                    sessionStorage.clear();
                    window.location.reload();
                }
            }
        };

        return h('div', { className: 'profile-section', ref: menuRef },
            // Profile Button
            h('button', {
                className: 'profile-button',
                onClick: () => setShowMenu(!showMenu)
            },
                h('div', {
                    className: 'profile-avatar',
                    style: { background: getRoleColor(currentUser?.role) }
                },
                    currentUser?.avatar_url ?
                        h('img', {
                            src: currentUser.avatar_url,
                            alt: currentUser.full_name || currentUser.email
                        }) :
                        h('span', null, getInitials(currentUser?.full_name || currentUser?.email))
                ),
                h('div', { className: 'profile-info' },
                    h('div', { className: 'profile-name' },
                        currentUser?.full_name || currentUser?.email?.split('@')[0] || 'User'
                    ),
                    h('div', { className: 'profile-role' }, currentUser?.role || 'User')
                ),
                h('span', {
                    className: `profile-chevron ${showMenu ? 'open' : ''}`
                }, '▼')
            ),

            // Dropdown Menu
            showMenu && h('div', { className: 'profile-dropdown' },
                // User Info Section
                h('div', { className: 'dropdown-header' },
                    h('div', {
                        className: 'dropdown-avatar',
                        style: { background: getRoleColor(currentUser?.role) }
                    },
                        currentUser?.avatar_url ?
                            h('img', {
                                src: currentUser.avatar_url,
                                alt: currentUser.full_name
                            }) :
                            h('span', null, getInitials(currentUser?.full_name || currentUser?.email))
                    ),
                    h('div', { className: 'dropdown-user-info' },
                        h('div', { className: 'dropdown-name' },
                            currentUser?.full_name || 'User'
                        ),
                        h('div', { className: 'dropdown-email' }, currentUser?.email),
                        h('div', {
                            className: 'dropdown-role-badge',
                            style: { background: getRoleColor(currentUser?.role) }
                        }, currentUser?.role)
                    )
                ),

                h('div', { className: 'dropdown-divider' }),

                // Menu Items
                h('div', { className: 'dropdown-menu' },
                    // Profile Settings
                    h('button', {
                        className: 'dropdown-item',
                        onClick: () => {
                            setShowMenu(false);
                            if (onNavigate) onNavigate('profile');
                        }
                    },
                        h('span', { className: 'dropdown-icon' }, '👤'),
                        h('span', null, 'Profile Settings')
                    ),

                    // User Management (Admin only)
                    currentUser?.role === 'Admin' && h('button', {
                        className: 'dropdown-item',
                        onClick: () => {
                            setShowMenu(false);
                            if (onNavigate) onNavigate('users');
                        }
                    },
                        h('span', { className: 'dropdown-icon' }, '👥'),
                        h('span', null, 'User Management')
                    ),

                    // Audit Logs (Admin only)
                    currentUser?.role === 'Admin' && h('button', {
                        className: 'dropdown-item',
                        onClick: () => {
                            setShowMenu(false);
                            if (onNavigate) onNavigate('audit');
                        }
                    },
                        h('span', { className: 'dropdown-icon' }, '📋'),
                        h('span', null, 'Audit Logs')
                    ),

                    // Preferences
                    h('button', {
                        className: 'dropdown-item',
                        onClick: () => {
                            setShowMenu(false);
                            if (onNavigate) onNavigate('preferences');
                        }
                    },
                        h('span', { className: 'dropdown-icon' }, '⚙️'),
                        h('span', null, 'Preferences')
                    )
                ),

                h('div', { className: 'dropdown-divider' }),

                // Sign Out
                h('button', {
                    className: 'dropdown-item dropdown-signout',
                    onClick: () => {
                        console.log('🚨 SIGN OUT BUTTON CLICKED!');
                        console.log('🚨 handleLogout type:', typeof handleLogout);
                        handleLogout();
                    }
                },
                    h('span', { className: 'dropdown-icon' }, '🚪'),
                    h('span', null, 'Sign Out')
                )
            )
        );
    }

    // Make ProfileMenu available globally
    window.ProfileMenu = ProfileMenu;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.ProfileMenu = ProfileMenu;
})();
