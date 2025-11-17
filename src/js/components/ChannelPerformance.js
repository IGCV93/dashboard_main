/**
 * Channel Performance Component
 * ENHANCED WITH PERMISSION FILTERING
 */

(function() {
    'use strict';
    
    function ChannelPerformance({ kpis, view, selectedPeriod, selectedYear, selectedMonth, selectedBrand, onChannelClick }) {
        const { createElement: h } = React;
        
        // Get dependencies from window
        const { formatCurrency } = window.formatters || {};
        const CHANNEL_COLORS = window.CHANNEL_COLORS || {
            'Amazon': '#FF9900',
            'TikTok': '#000000',
            'DTC-Shopify': '#96bf48',
            'Retail': '#8B5CF6',
            'CA International': '#DC2626',
            'UK International': '#1E40AF',
            'Wholesale': '#14B8A6',
            'Omnichannel': '#EC4899'
        };
        
        // Use channels from kpis (filtered by permissions) or fall back to default
        const channelsToDisplay = kpis.channels || kpis.availableChannels || 
            ['Amazon', 'TikTok', 'DTC-Shopify', 'Retail',
             'CA International', 'UK International', 'Wholesale', 'Omnichannel'];
        
        // Handle channel card click
        const handleChannelClick = (channelName) => {
            if (!onChannelClick) {
                // Fallback: use routing helper if onChannelClick not provided
                const routing = window.ChaiVision?.routing;
                if (routing && routing.buildSKUPerformanceRoute) {
                    // Store current dashboard state
                    const dashboardState = {
                        view: view || 'quarterly',
                        selectedPeriod: selectedPeriod || null,
                        selectedYear: selectedYear || new Date().getFullYear().toString(),
                        selectedMonth: selectedMonth || null,
                        selectedBrand: selectedBrand || 'All Brands'
                    };
                    sessionStorage.setItem('dashboard_state', JSON.stringify(dashboardState));
                    
                    // Build and navigate to SKU performance route
                    const route = routing.buildSKUPerformanceRoute({
                        channel: channelName,
                        brand: selectedBrand && selectedBrand !== 'All Brands' && selectedBrand !== 'All My Brands' ? selectedBrand : null,
                        view: view || 'quarterly',
                        period: selectedPeriod || null,
                        year: selectedYear || new Date().getFullYear().toString(),
                        month: selectedMonth || null
                    });
                    
                    window.location.href = route;
                }
            } else {
                onChannelClick(channelName, {
                    view: view || 'quarterly',
                    selectedPeriod: selectedPeriod || null,
                    selectedYear: selectedYear || new Date().getFullYear().toString(),
                    selectedMonth: selectedMonth || null,
                    selectedBrand: selectedBrand || 'All Brands'
                });
            }
        };
        
        return h('div', { className: 'channel-section' },
            h('div', { className: 'section-header' },
                h('h2', { className: 'section-title' }, '🛍️ Channel Performance Breakdown')
            ),
            h('div', { className: 'channel-grid' },
                channelsToDisplay.map(channel => {
                    // Ensure channel is a string
                    const channelName = typeof channel === 'string' ? channel : (channel?.name || String(channel));
                    const achievement = kpis.channelAchievements?.[channelName] || 0;
                    const channelClass = channelName.toLowerCase().replace(/[\s-]/g, '-');
                    
                    return h('div', { 
                        key: channelName, 
                        className: `channel-card ${channelClass}`,
                        onClick: () => handleChannelClick(channelName),
                        style: {
                            cursor: 'pointer',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        },
                        onMouseEnter: (e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        },
                        onMouseLeave: (e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '';
                        }
                    },
                        h('div', { className: 'channel-header' },
                            h('h3', { className: 'channel-name' }, channelName),
                            h('span', { 
                                className: 'channel-badge',
                                style: {
                                    background: achievement >= 100 ? 
                                        'linear-gradient(135deg, #D1FAE5, #A7F3D0)' :
                                        achievement >= 85 ? 
                                        'linear-gradient(135deg, #FEF3C7, #FDE68A)' :
                                        'linear-gradient(135deg, #FEE2E2, #FCA5A5)',
                                    color: achievement >= 100 ? '#065F46' :
                                           achievement >= 85 ? '#92400E' : '#991B1B'
                                }
                            }, 
                                `${achievement.toFixed(1)}%`
                            )
                        ),
                        h('div', { className: 'channel-metrics' },
                            h('div', { className: 'metric-item' },
                                h('div', { className: 'metric-label' }, 'Revenue'),
                                h('div', { className: 'metric-value' }, 
                                    formatCurrency ? formatCurrency(kpis.channelRevenues?.[channel] || 0, 'USD', false) : 
                                    '$' + Number(kpis.channelRevenues?.[channel] || 0).toFixed(2)
                                )
                            ),
                            h('div', { className: 'metric-item' },
                                h('div', { className: 'metric-label' }, '85% Target'),
                                h('div', { className: 'metric-value' }, 
                                    formatCurrency ? formatCurrency(kpis.channelTargets85?.[channel] || 0) : 
                                    '$' + (kpis.channelTargets85?.[channel] || 0)
                                )
                            )
                        ),
                        h('div', { className: 'progress-bar', style: { height: '20px' } },
                            h('div', {
                                className: 'progress-fill',
                                style: { 
                                    width: `${Math.min(100, achievement)}%`,
                                    background: `linear-gradient(90deg, ${CHANNEL_COLORS[channel]}, ${CHANNEL_COLORS[channel]}99)`
                                }
                            },
                                h('span', { className: 'progress-text', style: { fontSize: '11px' } }, 
                                    `${achievement.toFixed(0)}%`
                                )
                            )
                        ),
                        h('div', { 
                            className: 'channel-click-hint',
                            style: {
                                marginTop: '12px',
                                fontSize: '11px',
                                color: '#6b7280',
                                textAlign: 'center',
                                opacity: 0.7
                            }
                        }, 'Click to view SKU details →')
                    );
                })
            )
        );
    }
    
    // Make ChannelPerformance available globally
    window.ChannelPerformance = ChannelPerformance;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.ChannelPerformance = ChannelPerformance;
})();
