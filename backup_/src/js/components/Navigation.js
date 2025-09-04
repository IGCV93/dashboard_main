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
                
                // Filters in header (match reference)
                activeSection !== 'settings' && h('div', { className: 'period-selector' },
                    h('button', {
                        className: `period-btn ${view === 'annual' ? 'active' : ''}`,
                        onClick: () => setView && setView('annual')
                    }, 'Annual'),
                    h('button', {
                        className: `period-btn ${view === 'quarterly' ? 'active' : ''}`,
                        onClick: () => setView && setView('quarterly')
                    }, 'Quarterly'),
                    h('button', {
                        className: `period-btn ${view === 'monthly' ? 'active' : ''}`,
                        onClick: () => setView && setView('monthly')
                    }, 'Monthly'),
                    
                    view === 'annual' && h('select', {
                        value: selectedYear,
                        onChange: (e) => setSelectedYear && setSelectedYear(e.target.value),
                        style: { marginLeft: '8px', padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB', fontWeight: '600' }
                    },
                        h('option', { value: '2024' }, '2024'),
                        h('option', { value: '2025' }, '2025'),
                        h('option', { value: '2026' }, '2026')
                    ),
                    
                    view === 'quarterly' && [
                        h('select', {
                            key: 'quarter',
                            value: selectedPeriod,
                            onChange: (e) => setSelectedPeriod && setSelectedPeriod(e.target.value),
                            style: { marginLeft: '8px', padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB', fontWeight: '600' }
                        },
                            h('option', { value: 'Q1' }, 'Q1'),
                            h('option', { value: 'Q2' }, 'Q2'),
                            h('option', { value: 'Q3' }, 'Q3'),
                            h('option', { value: 'Q4' }, 'Q4')
                        ),
                        h('select', {
                            key: 'year',
                            value: selectedYear,
                            onChange: (e) => setSelectedYear && setSelectedYear(e.target.value),
                            style: { marginLeft: '8px', padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB', fontWeight: '600' }
                        },
                            h('option', { value: '2024' }, '2024'),
                            h('option', { value: '2025' }, '2025'),
                            h('option', { value: '2026' }, '2026')
                        )
                    ],
                    
                    view === 'monthly' && [
                        h('select', {
                            key: 'month',
                            value: selectedMonth,
                            onChange: (e) => setSelectedMonth && setSelectedMonth(parseInt(e.target.value)),
                            style: { marginLeft: '8px', padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB', fontWeight: '600' }
                        },
                            h('option', { value: 1 }, 'January'),
                            h('option', { value: 2 }, 'February'),
                            h('option', { value: 3 }, 'March'),
                            h('option', { value: 4 }, 'April'),
                            h('option', { value: 5 }, 'May'),
                            h('option', { value: 6 }, 'June'),
                            h('option', { value: 7 }, 'July'),
                            h('option', { value: 8 }, 'August'),
                            h('option', { value: 9 }, 'September'),
                            h('option', { value: 10 }, 'October'),
                            h('option', { value: 11 }, 'November'),
                            h('option', { value: 12 }, 'December')
                        ),
                        h('select', {
                            key: 'year',
                            value: selectedYear,
                            onChange: (e) => setSelectedYear && setSelectedYear(e.target.value),
                            style: { marginLeft: '8px', padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB', fontWeight: '600' }
                        },
                            h('option', { value: '2024' }, '2024'),
                            h('option', { value: '2025' }, '2025'),
                            h('option', { value: '2026' }, '2026')
                        )
                    ]
                ),
                
                activeSection !== 'settings' && h('div', { className: 'brand-selector' },
                    h('span', { className: 'brand-label' }, 'Brand:'),
                    h('select', {
                        value: selectedBrand,
                        onChange: (e) => setSelectedBrand && setSelectedBrand(e.target.value),
                        style: { 
                            padding: '10px 16px', 
                            borderRadius: '8px', 
                            border: '2px solid #E5E7EB', 
                            fontWeight: '600',
                            background: selectedBrand === 'All Brands' ? 
                                'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))' : 
                                'white'
                        }
                    },
                        h('option', { value: 'All Brands', style: { fontWeight: '700' } }, '🏢 All Brands (Company Total)'),
                        ...(brands || []).map(brand => h('option', { key: brand, value: brand }, brand))
                    )
                )

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
