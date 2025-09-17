/**
 * KPI Cards Component
 */

(function() {
    'use strict';
    
    function KPICards({ kpis }) {
        const { createElement: h } = React;
        
        // Get formatCurrency from window
        const { formatCurrency } = window.formatters || {};
        
        return h('div', { className: 'kpi-grid' },
            // KPI Achievement Card
            h('div', { 
                className: `kpi-card ${kpis.kpiAchievement >= 100 ? 'success' : 
                                      kpis.kpiAchievement >= 85 ? 'warning' : 'danger'}` 
            },
                h('div', { 
                    className: `kpi-icon ${kpis.kpiAchievement >= 100 ? 'success' : 
                                          kpis.kpiAchievement >= 85 ? 'warning' : 'danger'}` 
                }, '💰'),
                h('div', { className: 'kpi-label' }, 'KPI Achievement (85% Target)'),
                h('div', { className: 'kpi-value' }, `${kpis.kpiAchievement.toFixed(1)}%`),
                h('div', { className: 'kpi-subtitle' }, `Gap to KPI: ${formatCurrency ? formatCurrency(kpis.gapToKPI) : '$' + kpis.gapToKPI}`),
                h('div', { className: 'progress-bar large' },
                    h('div', {
                        className: 'progress-fill',
                        style: { 
                            width: `${Math.min(100, kpis.kpiAchievement)}%`,
                            background: kpis.kpiAchievement >= 100 ? 
                                'linear-gradient(90deg, #10B981, #34D399)' :
                                kpis.kpiAchievement >= 85 ? 
                                'linear-gradient(90deg, #F59E0B, #FBBF24)' :
                                'linear-gradient(90deg, #EF4444, #F87171)'
                        }
                    },
                        h('span', { className: 'progress-text' }, 
                            kpis.kpiAchievement >= 100 ? '✓' : `${kpis.kpiAchievement.toFixed(0)}%`
                        )
                    )
                )
            ),
            
            // Days Progress Card
            h('div', { className: 'kpi-card' },
                h('div', { className: 'kpi-icon warning' }, '📅'),
                h('div', { className: 'kpi-label' }, 'Days Progress'),
                h('div', { className: 'kpi-value' }, `${kpis.daysRemaining}`),
                h('div', { className: 'kpi-subtitle' }, `Days remaining of ${kpis.daysInPeriod} total`),
                h('div', { className: 'progress-bar' },
                    h('div', {
                        className: 'progress-fill',
                        style: { 
                            width: `${(kpis.daysElapsed / kpis.daysInPeriod) * 100}%`,
                            background: 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                        }
                    },
                        h('span', { className: 'progress-text' }, `${kpis.daysElapsed} days`)
                    )
                )
            ),
            
            // Daily Run Rate Card
            h('div', { className: 'kpi-card' },
                h('div', { className: 'kpi-icon success' }, '🚀'),
                h('div', { className: 'kpi-label' }, 'Daily Run Rate'),
                h('div', { className: 'kpi-value' }, formatCurrency ? formatCurrency(kpis.runRate) : '$' + kpis.runRate),
                h('div', { className: 'kpi-subtitle' }, '14-day weighted average'),
                h('div', { className: 'kpi-change change-neutral' }, 
                    `📊 Required: ${formatCurrency ? formatCurrency(kpis.gapToKPI / Math.max(1, kpis.daysRemaining)) : '$' + (kpis.gapToKPI / Math.max(1, kpis.daysRemaining))}/day`
                )
            )
        );
    }
    
    // Make KPICards available globally
    window.KPICards = KPICards;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.KPICards = KPICards;
})();
