/**
 * Channel Performance Component
 */

import { formatCurrency } from '../utils/formatters.js';
import { CHANNEL_COLORS } from '../../data/initialData.js';

export function ChannelPerformance({ kpis }) {
    const { createElement: h } = React;
    
    const ALL_CHANNELS = [
        'Amazon', 'TikTok', 'DTC-Shopify', 'Retail',
        'CA International', 'UK International', 'Wholesale', 'Omnichannel'
    ];
    
    return h('div', { className: 'channel-section' },
        h('div', { className: 'section-header' },
            h('h2', { className: 'section-title' }, '🛍️ Channel Performance Breakdown')
        ),
        h('div', { className: 'channel-grid' },
            ALL_CHANNELS.map(channel => {
                const achievement = kpis.channelAchievements[channel] || 0;
                const channelClass = channel.toLowerCase().replace(/[\s-]/g, '-');
                
                return h('div', { key: channel, className: `channel-card ${channelClass}` },
                    h('div', { className: 'channel-header' },
                        h('h3', { className: 'channel-name' }, channel),
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
                        }, `${achievement.toFixed(1)}%`)
                    ),
                    h('div', { className: 'channel-metrics' },
                        h('div', { className: 'metric-item' },
                            h('div', { className: 'metric-label' }, 'Revenue'),
                            h('div', { className: 'metric-value' }, 
                                formatCurrency(kpis.channelRevenues[channel] || 0)
                            )
                        ),
                        h('div', { className: 'metric-item' },
                            h('div', { className: 'metric-label' }, '85% Target'),
                            h('div', { className: 'metric-value' }, 
                                formatCurrency(kpis.channelTargets85[channel] || 0)
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
                    )
                );
            })
        )
    );
}
