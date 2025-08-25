/**
 * Charts Component - All chart visualizations
 */

import { formatCurrency } from '../utils/formatters.js';
import { CHANNEL_COLORS } from '../../data/initialData.js';

export function Charts(props) {
    const { useEffect, useRef, createElement: h } = React;
    
    const {
        kpis,
        selectedChannels,
        setSelectedChannels,
        view,
        selectedPeriod,
        selectedMonth,
        selectedYear
    } = props;
    
    const lineChartRef = useRef(null);
    const barChartRef = useRef(null);
    const pieChartRef = useRef(null);
    const lineChartInstance = useRef(null);
    const barChartInstance = useRef(null);
    const pieChartInstance = useRef(null);
    
    const ALL_CHANNELS = [
        'Amazon', 'TikTok', 'DTC-Shopify', 'Retail',
        'CA International', 'UK International', 'Wholesale', 'Omnichannel'
    ];
    
    useEffect(() => {
        if (!lineChartRef.current || !barChartRef.current || !pieChartRef.current) return;
        
        // Destroy existing charts
        if (lineChartInstance.current) lineChartInstance.current.destroy();
        if (barChartInstance.current) barChartInstance.current.destroy();
        if (pieChartInstance.current) pieChartInstance.current.destroy();
        
        // Filter channels for display
        const displayChannels = ALL_CHANNELS.filter(ch => selectedChannels.includes(ch));
        
        // Create Bar Chart
        const barCtx = barChartRef.current.getContext('2d');
        barChartInstance.current = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: displayChannels,
                datasets: [
                    {
                        label: 'Actual Revenue',
                        data: displayChannels.map(ch => kpis.channelRevenues[ch] || 0),
                        backgroundColor: displayChannels.map(ch => CHANNEL_COLORS[ch] + '99'),
                        borderColor: displayChannels.map(ch => CHANNEL_COLORS[ch]),
                        borderWidth: 2
                    },
                    {
                        label: '85% Target',
                        data: displayChannels.map(ch => kpis.channelTargets85[ch] || 0),
                        backgroundColor: 'rgba(251, 191, 36, 0.3)',
                        borderColor: 'rgb(251, 191, 36)',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (value) => formatCurrency(value) }
                    }
                }
            }
        });
        
        // Create Pie Chart
        const pieCtx = pieChartRef.current.getContext('2d');
        pieChartInstance.current = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: displayChannels,
                datasets: [{
                    data: displayChannels.map(ch => kpis.channelRevenues[ch] || 0),
                    backgroundColor: displayChannels.map(ch => CHANNEL_COLORS[ch] + '99'),
                    borderColor: displayChannels.map(ch => CHANNEL_COLORS[ch]),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'right' }
                }
            }
        });
        
        // Create Line Chart (simplified for brevity)
        const lineCtx = lineChartRef.current.getContext('2d');
        lineChartInstance.current = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Revenue Trend',
                    data: [kpis.totalRevenue * 0.2, kpis.totalRevenue * 0.4, 
                           kpis.totalRevenue * 0.7, kpis.totalRevenue],
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
        
    }, [kpis, selectedChannels]);
    
    const handleChannelToggle = (channel) => {
        if (selectedChannels.includes(channel)) {
            setSelectedChannels(selectedChannels.filter(ch => ch !== channel));
        } else {
            setSelectedChannels([...selectedChannels, channel]);
        }
    };
    
    return h('div', null,
        // Chart Controls
        h('div', { className: 'chart-card' },
            h('div', { className: 'chart-header' },
                h('h3', { className: 'chart-title' }, '📊 Channel Performance Analysis')
            ),
            h('div', { className: 'chart-filters' },
                h('span', { style: { fontWeight: '600', marginRight: '12px' } }, 'Show Channels:'),
                ...ALL_CHANNELS.map(channel =>
                    h('div', {
                        key: channel,
                        className: `filter-checkbox ${selectedChannels.includes(channel) ? 'selected' : ''}`,
                        onClick: () => handleChannelToggle(channel)
                    },
                        h('input', {
                            type: 'checkbox',
                            checked: selectedChannels.includes(channel),
                            onChange: () => {}
                        }),
                        h('label', null, channel)
                    )
                )
            ),
            h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' } },
                h('div', null,
                    h('h4', { style: { marginBottom: '12px' } }, 'Revenue by Channel'),
                    h('div', { className: 'chart-container' },
                        h('canvas', { ref: barChartRef })
                    )
                ),
                h('div', null,
                    h('h4', { style: { marginBottom: '12px' } }, 'Channel Distribution'),
                    h('div', { className: 'chart-container' },
                        h('canvas', { ref: pieChartRef })
                    )
                )
            )
        ),
        
        h('div', { className: 'chart-card' },
            h('div', { className: 'chart-header' },
                h('h3', { className: 'chart-title' }, '📈 Revenue Trend')
            ),
            h('div', { className: 'chart-container' },
                h('canvas', { ref: lineChartRef })
            )
        )
    );
}
