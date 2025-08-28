/**
 * Navigation Component - Top navigation bar
 */

(function() {
    'use strict';
    
    function Navigation(props) {
        const { createElement: h } = React;
        const {
            view, setView,
            selectedPeriod, setSelectedPeriod,
            selectedMonth, setSelectedMonth,
            selectedYear, setSelectedYear,
            selectedBrand, setSelectedBrand,
            brands, activeSection,
            currentUser,
            onLogout,
            setActiveSection,
            showProfileMenu, setShowProfileMenu,
            ProfileMenu
        } = props;
        
        const ProfileMenuComponent = ProfileMenu || window.ProfileMenu || window.ChaiVision?.components?.ProfileMenu;
        
        return h('nav', { className: 'top-nav' },
            h('div', { className: 'nav-left' },
                h('div', { 
                    className: 'logo',
                    onClick: () => {
                        if (typeof setActiveSection === 'function') {
                            setActiveSection('dashboard');
                        }
                        // Also use routing navigation if available
                        if (window.ChaiVision?.routing?.navigateToSection) {
                            window.ChaiVision.routing.navigateToSection('dashboard');
                        }
                    },
                    style: { cursor: 'pointer' }
                },
                    h('div', { className: 'logo-placeholder' }, 'CV'),
                    h('span', { className: 'logo-text' }, 'Chai Vision')
                ),
                

                

            ),
            // Right side: Profile menu
            h('div', { className: 'nav-right' },
                currentUser && ProfileMenuComponent ? h(ProfileMenuComponent, {
                    currentUser,
                    onLogout,
                    onNavigate: (section) => {
                        if (typeof setActiveSection === 'function') {
                            setActiveSection(section);
                        }
                    },
                    showMenu: showProfileMenu,
                    setShowMenu: setShowProfileMenu
                }) : currentUser ? h('button', {
                    onClick: onLogout,
                    style: {
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }
                }, currentUser.full_name?.charAt(0) || currentUser.email?.charAt(0) || 'U') : null
            )
        );
    }
    
    // Make Navigation available globally
    window.Navigation = Navigation;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.Navigation = Navigation;
})();
