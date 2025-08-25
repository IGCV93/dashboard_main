/**
 * Navigation Component - Top navigation bar
 */

export function Navigation(props) {
    const { createElement: h } = React;
    const {
        view, setView,
        selectedPeriod, setSelectedPeriod,
        selectedMonth, setSelectedMonth,
        selectedYear, setSelectedYear,
        selectedBrand, setSelectedBrand,
        brands, activeSection
    } = props;
    
    return h('nav', { className: 'top-nav' },
        h('div', { className: 'nav-left' },
            h('div', { className: 'logo' },
                h('div', { className: 'logo-placeholder' }, 'CV'),
                h('span', { className: 'logo-text' }, 'Chai Vision')
            ),
            
            activeSection === 'dashboard' && h('div', { className: 'period-selector' },
                h('button', {
                    className: `period-btn ${view === 'annual' ? 'active' : ''}`,
                    onClick: () => setView('annual')
                }, 'Annual'),
                h('button', {
                    className: `period-btn ${view === 'quarterly' ? 'active' : ''}`,
                    onClick: () => setView('quarterly')
                }, 'Quarterly'),
                h('button', {
                    className: `period-btn ${view === 'monthly' ? 'active' : ''}`,
                    onClick: () => setView('monthly')
                }, 'Monthly'),
                
                view === 'quarterly' && [
                    h('select', {
                        key: 'quarter',
                        value: selectedPeriod,
                        onChange: (e) => setSelectedPeriod(e.target.value),
                        style: { marginLeft: '8px', padding: '10px', borderRadius: '8px' }
                    },
                        h('option', { value: 'Q1' }, 'Q1'),
                        h('option', { value: 'Q2' }, 'Q2'),
                        h('option', { value: 'Q3' }, 'Q3'),
                        h('option', { value: 'Q4' }, 'Q4')
                    ),
                    h('select', {
                        key: 'year',
                        value: selectedYear,
                        onChange: (e) => setSelectedYear(e.target.value),
                        style: { marginLeft: '8px', padding: '10px', borderRadius: '8px' }
                    },
                        h('option', { value: '2024' }, '2024'),
                        h('option', { value: '2025' }, '2025'),
                        h('option', { value: '2026' }, '2026')
                    )
                ]
            ),
            
            activeSection === 'dashboard' && h('div', { className: 'brand-selector' },
                h('span', { className: 'brand-label' }, 'Brand:'),
                h('select', {
                    value: selectedBrand,
                    onChange: (e) => setSelectedBrand(e.target.value),
                    style: { padding: '10px 16px', borderRadius: '8px' }
                },
                    h('option', { value: 'All Brands' }, '🏢 All Brands'),
                    ...brands.map(brand =>
                        h('option', { key: brand, value: brand }, brand)
                    )
                )
            )
        )
    );
}
