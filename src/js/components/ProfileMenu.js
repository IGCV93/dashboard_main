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

        // Get config from window
        const CONFIG = window.CONFIG || window.ChaiVision?.CONFIG || {};

        // Get role color
        const getRoleColor = (role) => {
            const roles = CONFIG.COLORS?.ROLES || {};
            switch (role) {
                case 'Admin':
                    return roles.ADMIN || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                case 'Manager':
                    return roles.MANAGER || 'linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)';
                default:
                    return roles.USER || roles.DEFAULT || 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)';
            }
        };

        const handleLogout = async () => {
            // Confirmation dialog to prevent accidental logouts
            if (!confirm('Are you sure you want to sign out?')) {
                return;
            }

            setShowMenu(false);

            try {
                // Get Supabase client
                const config = window.CONFIG || window.ChaiVision?.CONFIG;

                if (config?.SUPABASE?.URL && window.supabase) {
                    const supabase = window.supabase.createClient(
                        config.SUPABASE.URL,
                        config.SUPABASE.ANON_KEY
                    );

                    // Log the logout event
                    // We don't await this to prevent blocking the logout if it fails/hangs
                    supabase
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
                        })
                        .then(() => console.log('Logout logged'))
                        .catch(err => console.error('Failed to log logout:', err));
                }

                // Call parent logout handler (this handles the actual auth signout and redirect)
                if (onLogout) {
                    onLogout();
                } else {
                    // Fallback if no parent handler
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
                    onClick: handleLogout
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
