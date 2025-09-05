/**
 * Reference Overrides - Inject exact implementations from specified deployment
 * Files included: Charts.js, ChannelPerformance.js, Dashboard.js
 */

// ==== Charts.js (from reference deployment) ====
/**
 * Charts Component - Data visualization charts with performance optimizations
 */

(function() {
    'use strict';
    // If a Charts component is already defined by the local codebase, do not override it
    try {
        if ((window.ChaiVision && window.ChaiVision.components && window.ChaiVision.components.Charts) || window.Charts) {
            console.log('🛑 ReferenceOverrides: Skipping Charts override (local Charts detected)');
            return;
        }
    } catch (e) {}
    
    function Charts(props) {
        const { useState, useEffect, useMemo, useRef, useCallback, createElement: h } = React;
        
        const {
            kpis,
            selectedChannels,
            setSelectedChannels,
            view,
            selectedPeriod,
            selectedMonth,
            selectedYear,
            availableChannels,
            barChartRef,
            pieChartRef,
            lineChartRef
        } = props;
        const lineChartInstance = useRef(null);
        const barChartInstance = useRef(null);
        const pieChartInstance = useRef(null);
        
        // Performance optimizations
        const [isChartsVisible, setIsChartsVisible] = useState(false);
        const [chartData, setChartData] = useState(null);
        const chartUpdateTimeout = useRef(null);
        
        // Get formatters from window
        const { formatCurrency } = window.formatters || {};
        
        // Get data from window
        const INITIAL_DATA = window.ChaiVision?.INITIAL_DATA || {};
        const ALL_CHANNELS = INITIAL_DATA.channels || [
            'Amazon', 'TikTok', 'DTC-Shopify', 'Retail',
            'CA International', 'UK International', 'Wholesale', 'Omnichannel'
        ];
        const CHANNEL_COLORS = INITIAL_DATA.channelColors || {
            'Amazon': '#FF9900',
            'TikTok': '#000000',
            'DTC-Shopify': '#96bf48',
            'Retail': '#8B5CF6',
            'CA International': '#DC2626',
            'UK International': '#1E40AF',
            'Wholesale': '#14B8A6',
            'Omnichannel': '#EC4899'
        };
        
        // Get display title helper
        const getDisplayTitle = useCallback(() => {
            let periodText = '';
            if (view === 'annual') {
                periodText = selectedYear;
            } else if (view === 'quarterly') {
                periodText = `${selectedPeriod} ${selectedYear}`;
            } else if (view === 'monthly') {
                const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                                  'July', 'August', 'September', 'October', 'November', 'December'];
                periodText = `${monthNames[selectedMonth]} ${selectedYear}`;
            }
            return periodText;
        }, [view, selectedPeriod, selectedMonth, selectedYear]);
        
        // Optimized data processing with memoization
        const processedChartData = useMemo(() => {
            if (!kpis) {
                console.log('Charts: No kpis available');
                return null;
            }
            
            // Use the same logic as reference - get data from kpis
            const displayChannels = ALL_CHANNELS.filter(ch => selectedChannels.includes(ch));
            
            // Prepare channel breakdown data - use kpis.channelRevenues directly
            const channelData = displayChannels.map(channel => {
                const revenue = kpis.channelRevenues?.[channel] || 0;
                return {
                    channel,
                    revenue: revenue,
                    color: CHANNEL_COLORS[channel] || '#6B7280'
                };
            }).sort((a, b) => b.revenue - a.revenue);
            
            console.log('Charts: Processed data:', {
                channelData: channelData.length,
                totalRevenue: kpis.totalRevenue || 0,
                channelRevenues: kpis.channelRevenues
            });
            
            return {
                channelData,
                totalRevenue: kpis.totalRevenue || 0
            };
        }, [kpis, selectedChannels, ALL_CHANNELS, CHANNEL_COLORS]);
        
        // Debounced chart update
        const updateCharts = useCallback(() => {
            if (chartUpdateTimeout.current) {
                clearTimeout(chartUpdateTimeout.current);
            }
            
            chartUpdateTimeout.current = setTimeout(() => {
                if (!processedChartData) return;
                
                // Update chart data state
                setChartData(processedChartData);
                
                // Create/Update charts
                createCharts(processedChartData);
            }, 100);
        }, [processedChartData]);
        
        // Create charts with performance optimizations
        const createCharts = useCallback((data) => {
            // Safeguard: if refs are not provided (when using local Dashboard/Charts), do nothing
            if (!data) return;
            if (!lineChartRef || !barChartRef || !pieChartRef) return;
            if (!lineChartRef.current || !barChartRef.current || !pieChartRef.current) return;
            
            // Destroy existing charts to prevent memory leaks
            destroyCharts();
            
            // Create new charts
            createLineChart(data);
            createBarChart(data);
            createPieChart(data);
        }, []);
        
        // Destroy charts to prevent memory leaks
        const destroyCharts = useCallback(() => {
            if (lineChartInstance.current) {
                lineChartInstance.current.destroy();
                lineChartInstance.current = null;
            }
            if (barChartInstance.current) {
                barChartInstance.current.destroy();
                barChartInstance.current = null;
            }
            if (pieChartInstance.current) {
                pieChartInstance.current.destroy();
                pieChartInstance.current = null;
            }
        }, []);
        
        // Create line chart - with proper time-based aggregation
        const createLineChart = useCallback((data) => {
            if (!lineChartRef || !lineChartRef.current || !kpis?.filteredData) return;
            
            const ctx = lineChartRef.current.getContext('2d');
            
            // Generate trend data based on view
            let trendLabels = [];
            let trendData = [];
            
            if (view === 'annual') {
                // Show monthly trends for the year
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                trendLabels = monthNames;
                
                for (let month = 1; month <= 12; month++) {
                    const monthStr = month.toString().padStart(2, '0');
                    const monthData = kpis.filteredData.filter(d => {
                        if (!d.date) return false;
                        const [year, m] = d.date.split('-');
                        return year === selectedYear && m === monthStr;
                    });
                    const monthRevenue = monthData.reduce((sum, d) => sum + (d.revenue || 0), 0);
                    trendData.push(monthRevenue);
                }
            } else if (view === 'quarterly') {
                // Show monthly trends within the quarter
                const quarterMonths = {
                    'Q1': [{ num: '01', name: 'January' }, { num: '02', name: 'February' }, { num: '03', name: 'March' }],
                    'Q2': [{ num: '04', name: 'April' }, { num: '05', name: 'May' }, { num: '06', name: 'June' }],
                    'Q3': [{ num: '07', name: 'July' }, { num: '08', name: 'August' }, { num: '09', name: 'September' }],
                    'Q4': [{ num: '10', name: 'October' }, { num: '11', name: 'November' }, { num: '12', name: 'December' }]
                };
                
                const months = quarterMonths[selectedPeriod] || [];
                trendLabels = months.map(m => m.name);
                
                months.forEach(month => {
                    const monthData = kpis.filteredData.filter(d => {
                        if (!d.date) return false;
                        const [year, m] = d.date.split('-');
                        return year === selectedYear && m === month.num;
                    });
                    const monthRevenue = monthData.reduce((sum, d) => sum + (d.revenue || 0), 0);
                    trendData.push(monthRevenue);
                });
            } else if (view === 'monthly') {
                // Show daily trends within the month
                const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                trendLabels = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString());
                
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayStr = day.toString().padStart(2, '0');
                    const monthStr = selectedMonth.toString().padStart(2, '0');
                    const dayData = kpis.filteredData.filter(d => {
                        if (!d.date) return false;
                        const [year, month, day] = d.date.split('-');
                        return year === selectedYear && month === monthStr && day === dayStr;
                    });
                    const dayRevenue = dayData.reduce((sum, d) => sum + (d.revenue || 0), 0);
                    trendData.push(dayRevenue);
                }
            }
            
            lineChartInstance.current = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: trendLabels,
                    datasets: [{
                        label: 'Total Revenue Trend',
                        data: trendData,
                        borderColor: 'rgb(102, 126, 234)',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`;
                                }
                            }
                        }
                    }
                }
            });
        }, [formatCurrency, kpis, view, selectedPeriod, selectedMonth, selectedYear]);
        
        // Create bar chart - with channel-specific colors
        const createBarChart = useCallback((data) => {
            if (!barChartRef || !barChartRef.current || !data.channelData) return;
            
            const ctx = barChartRef.current.getContext('2d');
            
            barChartInstance.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.channelData.map(d => d.channel),
                    datasets: [
                        {
                            label: 'Actual Revenue',
                            data: data.channelData.map(d => d.revenue),
                            backgroundColor: data.channelData.map(d => d.color + '99'),
                            borderColor: data.channelData.map(d => d.color),
                            borderWidth: 2
                        },
                        {
                            label: '85% Target',
                            data: data.channelData.map(d => {
                                // Get target from kpis
                                return kpis?.channelTargets85?.[d.channel] || d.revenue * 0.85;
                            }),
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
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    return `${context.dataset.label}: ${formatCurrency ? formatCurrency(context.parsed.y) : `$${context.parsed.y.toLocaleString()}`}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`
                            }
                        }
                    }
                }
            });
        }, [formatCurrency, kpis]);
        
        // Create pie chart - matching reference implementation exactly
        const createPieChart = useCallback((data) => {
            if (!pieChartRef || !pieChartRef.current || !data.channelData) return;
            
            const ctx = pieChartRef.current.getContext('2d');
            
            pieChartInstance.current = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.channelData.map(d => d.channel),
                    datasets: [{
                        data: data.channelData.map(d => d.revenue),
                        backgroundColor: data.channelData.map(d => d.color + '99'),
                        borderColor: data.channelData.map(d => d.color),
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'right'
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((context.parsed / total) * 100).toFixed(1);
                                    return `${context.label}: ${formatCurrency ? formatCurrency(context.parsed) : `$${context.parsed.toLocaleString()}`} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }, [formatCurrency]);
        
        // Intersection Observer for lazy loading
        useEffect(() => {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            setIsChartsVisible(true);
                            observer.disconnect();
                        }
                    });
                },
                { threshold: 0.1 }
            );
            
            const chartsContainer = document.querySelector('.charts-container');
            if (chartsContainer) {
                observer.observe(chartsContainer);
            }
            
            return () => observer.disconnect();
        }, []);
        
        // Update charts when data changes
        useEffect(() => {
            if (isChartsVisible && processedChartData) {
                updateCharts();
            }
        }, [isChartsVisible, processedChartData, updateCharts]);
        
        // Cleanup on unmount
        useEffect(() => {
            return () => {
                destroyCharts();
                if (chartUpdateTimeout.current) {
                    clearTimeout(chartUpdateTimeout.current);
                }
            };
        }, [destroyCharts]);
        
        // Channel selection handler with debouncing
        const handleChannelToggle = useCallback((channel) => {
            setSelectedChannels(prev => {
                if (prev.includes(channel)) {
                    return prev.filter(ch => ch !== channel);
                } else {
                    return [...prev, channel];
                }
            });
        }, [setSelectedChannels]);
        
        if (!isChartsVisible) {
            return h('div', { className: 'charts-container' },
                h('div', { className: 'charts-loading' },
                    h('div', { className: 'loading-spinner' }),
                    h('p', null, 'Loading charts...')
                )
            );
        }
        
        return h('div', { className: 'charts-container' },
            // Channel Performance Analysis Section - exact replica
            h('div', { className: 'chart-card' },
                h('div', { className: 'chart-header' },
                    h('h3', { className: 'chart-title' }, '📊 Channel Performance Analysis')
                ),
                h('div', { className: 'chart-filters' },
                    h('span', { style: { fontWeight: '600', marginRight: '12px' } }, 'Show Channels:'),
                    ...(availableChannels || ALL_CHANNELS).map(channel =>
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
            
            // Revenue Trend Section - exact replica
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
    
    // Make available globally
    window.Charts = Charts;
    
    // Also add to ChaiVision namespace
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.Charts = Charts;
    
    console.log('✅ Charts component loaded with performance optimizations');
})();

// ==== ChannelPerformance.js (from reference deployment) ====
/**
 * Channel Performance Component
 * ENHANCED WITH PERMISSION FILTERING
 */

(function() {
    'use strict';
    // If local ChannelPerformance exists, skip overriding
    try {
        if ((window.ChaiVision && window.ChaiVision.components && window.ChaiVision.components.ChannelPerformance) || window.ChannelPerformance) {
            console.log('🛑 ReferenceOverrides: Skipping ChannelPerformance override (local detected)');
            return;
        }
    } catch (e) {}
    
    function ChannelPerformance({ kpis }) {
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
        
        return h('div', { className: 'channel-section' },
            h('div', { className: 'section-header' },
                h('h2', { className: 'section-title' }, '🛍️ Channel Performance Breakdown')
            ),
            h('div', { className: 'channel-grid' },
                channelsToDisplay.map(channel => {
                    const achievement = kpis.channelAchievements?.[channel] || 0;
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
                            }, 
                                `${achievement.toFixed(1)}%`
                            )
                        ),
                        h('div', { className: 'channel-metrics' },
                            h('div', { className: 'metric-item' },
                                h('div', { className: 'metric-label' }, 'REVENUE'),
                                h('div', { className: 'metric-value' }, 
                                    formatCurrency ? formatCurrency(kpis.channelRevenues?.[channel] || 0) : 
                                    '$' + (kpis.channelRevenues?.[channel] || 0)
                                )
                            ),
                            h('div', { className: 'metric-item' },
                                h('div', { className: 'metric-label' }, '85% TARGET'),
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
                        )
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

// ==== Dashboard.js (from reference deployment) ====
/**
 * Dashboard Component - Exact replica of reference implementation
 * Maintains current data flow while matching reference design
 */

(function() {
    'use strict';
    // If local Dashboard exists, skip overriding
    try {
        if ((window.ChaiVision && window.ChaiVision.components && window.ChaiVision.components.Dashboard) || window.Dashboard) {
            console.log('🛑 ReferenceOverrides: Skipping Dashboard override (local detected)');
            return;
        }
    } catch (e) {}
    
    function Dashboard(props) {
        const { useState, useEffect, useMemo, useRef, createElement: h } = React;
        
        const {
            view,
            setView,
            selectedPeriod,
            setSelectedPeriod,
            selectedMonth,
            setSelectedMonth,
            selectedYear,
            setSelectedYear,
            selectedBrand,
            setSelectedBrand,
            salesData,
            config,
            dataService,
            dynamicBrands,
            dynamicTargets,
            userRole,
            userPermissions
        } = props;
        
        // Get dependencies from window
        const { formatCurrency, formatPercent } = window.formatters || {};
        const { getDaysInPeriod, getDaysElapsed } = window.dateUtils || {};
        const Charts = window.Charts || (() => null);
        
        // State for charts
        const [selectedChannels, setSelectedChannels] = useState([
            'Amazon', 'TikTok', 'DTC-Shopify', 'Retail', 
            'CA International', 'UK International', 'Wholesale', 'Omnichannel'
        ]);
        
        // Initialize selected channels based on user permissions
        useEffect(() => {
            if (userPermissions?.channels) {
                if (userPermissions.channels.includes('All Channels') || userRole === 'Admin') {
                    setSelectedChannels([
                        'Amazon', 'TikTok', 'DTC-Shopify', 'Retail', 
                        'CA International', 'UK International', 'Wholesale', 'Omnichannel'
                    ]);
                } else {
                    setSelectedChannels(userPermissions.channels);
                }
            }
        }, [userPermissions, userRole]);
        
        // Get initial data
        const INITIAL_DATA = window.ChaiVision?.INITIAL_DATA || {};
        
        // Filter brands based on user permissions
        const availableBrands = useMemo(() => {
            if (!userPermissions) return dynamicBrands || [];
            
            if (userRole === 'Admin' || userPermissions.brands?.includes('All Brands')) {
                return dynamicBrands || [];
            }
            
            return dynamicBrands?.filter(brand => 
                userPermissions.brands?.includes(brand)
            ) || [];
        }, [dynamicBrands, userPermissions, userRole]);
        
        // Filter channels based on user permissions
        const availableChannels = useMemo(() => {
            const allChannels = INITIAL_DATA.channels || [
                'Amazon', 'TikTok', 'DTC-Shopify', 'Retail',
                'CA International', 'UK International', 'Wholesale', 'Omnichannel'
            ];
            
            if (!userPermissions) return allChannels;
            
            if (userRole === 'Admin' || userPermissions.channels?.includes('All Channels')) {
                return allChannels;
            }
            
            return allChannels.filter(channel => 
                userPermissions.channels?.includes(channel)
            );
        }, [userPermissions, userRole]);
        
        // Calculate KPIs with permission filtering - matching reference logic
        const kpis = useMemo(() => {
            let filteredData = salesData || [];
            
            // PERMISSION FILTER: Filter by user's brand permissions
            if (userRole !== 'Admin' && userPermissions?.brands && !userPermissions.brands.includes('All Brands')) {
                filteredData = filteredData.filter(d => 
                    userPermissions.brands.includes(d.brand)
                );
            }
            
            // PERMISSION FILTER: Filter by user's channel permissions
            if (userRole !== 'Admin' && userPermissions?.channels && !userPermissions.channels.includes('All Channels')) {
                filteredData = filteredData.filter(d => 
                    userPermissions.channels.includes(d.channel)
                );
            }
            
            // Filter by selected brand (from dropdown)
            if (selectedBrand !== 'All Brands') {
                filteredData = filteredData.filter(d => d.brand === selectedBrand);
            }
            
            // Filter by period
            if (view === 'annual') {
                filteredData = filteredData.filter(d => d.date && d.date.startsWith(selectedYear));
            } else if (view === 'quarterly') {
                const quarterMonths = {
                    'Q1': ['01', '02', '03'],
                    'Q2': ['04', '05', '06'],
                    'Q3': ['07', '08', '09'],
                    'Q4': ['10', '11', '12']
                };
                const months = quarterMonths[selectedPeriod] || [];
                filteredData = filteredData.filter(d => {
                    if (!d.date) return false;
                    const [year, month] = d.date.split('-');
                    return year === selectedYear && months.includes(month);
                });
            } else if (view === 'monthly') {
                const monthStr = selectedMonth.toString().padStart(2, '0');
                filteredData = filteredData.filter(d => {
                    if (!d.date) return false;
                    const [year, month] = d.date.split('-');
                    return year === selectedYear && month === monthStr;
                });
            }
            
            // Calculate revenue by channel (only for available channels)
            const channelRevenues = {};
            availableChannels.forEach(channel => {
                channelRevenues[channel] = filteredData
                    .filter(d => d.channel === channel)
                    .reduce((sum, d) => sum + (d.revenue || 0), 0);
            });
            
            const totalRevenue = Object.values(channelRevenues).reduce((sum, val) => sum + val, 0);
            
            // Get targets (filtered by permissions)
            const channelTargets100 = {};
            const channelTargets85 = {};
            
            availableChannels.forEach(channel => {
                channelTargets100[channel] = 0;
                channelTargets85[channel] = 0;
            });
            
            // Calculate targets based on selection and permissions
            const brandsToCalculate = selectedBrand === 'All Brands' ? availableBrands : [selectedBrand];
            
            brandsToCalculate.forEach(brand => {
                const brandData = dynamicTargets?.[selectedYear]?.brands?.[brand];
                if (brandData) {
                    let periodData;
                    if (view === 'annual') {
                        periodData = brandData.annual;
                    } else if (view === 'quarterly') {
                        periodData = brandData[selectedPeriod];
                    } else if (view === 'monthly') {
                        const quarter = `Q${Math.ceil(selectedMonth / 3)}`;
                        periodData = brandData[quarter];
                        if (periodData) {
                            const monthlyData = {};
                            availableChannels.forEach(ch => {
                                monthlyData[ch] = (periodData[ch] || 0) / 3;
                            });
                            periodData = monthlyData;
                        }
                    }
                    if (periodData) {
                        availableChannels.forEach(channel => {
                            channelTargets100[channel] += periodData[channel] || 0;
                        });
                    }
                }
            });
            
            // Calculate 85% targets
            availableChannels.forEach(channel => {
                channelTargets85[channel] = channelTargets100[channel] * 0.85;
            });
            
            const totalTarget100 = Object.values(channelTargets100).reduce((sum, val) => sum + val, 0);
            const totalTarget85 = totalTarget100 * 0.85;
            
            // Time calculations
            const daysInPeriod = getDaysInPeriod ? getDaysInPeriod(view, selectedPeriod, selectedYear, selectedMonth) : 30;
            const daysElapsed = getDaysElapsed ? getDaysElapsed(view, selectedPeriod, selectedYear, selectedMonth) : 15;
            const daysRemaining = Math.max(0, daysInPeriod - daysElapsed);
            
            // Calculate run rate (7-day average)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const last7DaysData = filteredData.filter(d => new Date(d.date) >= sevenDaysAgo);
            const runRate = last7DaysData.length > 0 ? 
                last7DaysData.reduce((sum, d) => sum + d.revenue, 0) / Math.min(7, last7DaysData.length) : 0;
            
            // Projections
            const projection = totalRevenue + (runRate * daysRemaining);
            const projectionPercent85 = totalTarget85 > 0 ? projection / totalTarget85 : 0;
            const projectionPercent100 = totalTarget100 > 0 ? projection / totalTarget100 : 0;
            
            // KPI Achievement
            const kpiAchievement = totalTarget85 > 0 ? (totalRevenue / totalTarget85) * 100 : 0;
            const achievement100 = totalTarget100 > 0 ? (totalRevenue / totalTarget100) * 100 : 0;
            const gapToKPI = Math.max(0, totalTarget85 - totalRevenue);
            const gapTo100 = Math.max(0, totalTarget100 - totalRevenue);
            
            // Channel achievements (only for available channels)
            const channelAchievements = {};
            availableChannels.forEach(channel => {
                channelAchievements[channel] = channelTargets85[channel] > 0 ? 
                    (channelRevenues[channel] / channelTargets85[channel]) * 100 : 0;
            });
            
            // Calculate required run rate to achieve target
            const requiredRunRate = daysRemaining > 0 ? gapToKPI / daysRemaining : 0;
            const isTargetAchieved = kpiAchievement >= 100;
            
            return {
                totalRevenue,
                channelRevenues,
                totalTarget85,
                totalTarget100,
                channelTargets85,
                channelTargets100,
                runRate,
                requiredRunRate,
                isTargetAchieved,
                projection,
                projectionPercent85,
                projectionPercent100,
                daysRemaining,
                daysElapsed,
                daysInPeriod,
                kpiAchievement,
                achievement100,
                gapToKPI,
                gapTo100,
                channelAchievements,
                filteredData
            };
        }, [salesData, view, selectedPeriod, selectedMonth, selectedYear, selectedBrand, dynamicTargets, dynamicBrands, userPermissions, userRole, availableChannels, availableBrands]);
        
        // Handle channel selection for charts
        const handleChannelToggle = (channel) => {
            if (selectedChannels.includes(channel)) {
                setSelectedChannels(selectedChannels.filter(ch => ch !== channel));
            } else {
                setSelectedChannels([...selectedChannels, channel]);
            }
        };
        
        // Render main content - exact replica of reference (filters are now in header)
        const renderMainContent = () => {
            return h('div', null,
                // Page Header
                h('div', { className: 'page-header' },
                    h('div', { className: 'page-title' },
                        // Title without emoji (clean)
                        h('h1', null, (
                            selectedBrand && selectedBrand !== 'All Brands'
                                ? `${selectedBrand} - ${view === 'annual' ? selectedYear : view === 'quarterly' ? `${selectedPeriod} ${selectedYear}` : `${selectedYear}-${String(selectedMonth).padStart(2,'0')}`} Performance`
                                : 'Sales Dashboard'
                        )),
                        h('div', { className: 'page-subtitle' }, 
                            `Last updated: ${new Date().toLocaleTimeString()}`
                        )
                    )
                ),
                
                // Target Overview - exact replica
                h('div', { className: 'target-overview' },
                    h('div', { className: 'target-grid' },
                        h('div', { className: 'target-item' },
                            h('div', { className: 'target-label' }, '🎯 Full Projection (100%)'),
                            h('div', { className: 'target-value' }, formatCurrency ? formatCurrency(kpis.totalTarget100) : '$' + kpis.totalTarget100),
                            h('div', { className: 'target-subtitle' }, 'Complete target goal')
                        ),
                        h('div', { className: 'target-item' },
                            h('div', { className: 'target-label' }, '✅ KPI Target (85%)'),
                            h('div', { className: 'target-value' }, formatCurrency ? formatCurrency(kpis.totalTarget85) : '$' + kpis.totalTarget85),
                            h('div', { className: 'target-subtitle' }, 'Minimum achievement')
                        ),
                        h('div', { className: 'target-item' },
                            h('div', { className: 'target-label' }, '📊 Current Achievement'),
                            h('div', { className: 'target-value' }, formatCurrency ? formatCurrency(kpis.totalRevenue) : '$' + kpis.totalRevenue),
                            h('div', { className: 'target-subtitle' }, `${kpis.achievement100.toFixed(1)}% of full target`)
                        ),
                        h('div', { className: 'target-item' },
                            h('div', { className: 'target-label' }, '📈 End Projection'),
                            h('div', { className: 'target-value' }, formatCurrency ? formatCurrency(kpis.projection) : '$' + kpis.projection),
                            h('div', { className: 'target-subtitle' }, `${kpis.projectionPercent100.toFixed(1)}% of full target`)
                        )
                    )
                ),
                
                // KPI Grid - exact replica of reference
                h('div', { className: 'kpi-grid' },
                    h('div', { className: 'kpi-card success' },
                        h('div', { className: 'kpi-icon success' }, '💰'),
                        h('div', { className: 'kpi-label' }, 'Total Revenue'),
                        h('div', { className: 'kpi-value' }, formatCurrency ? formatCurrency(kpis.totalRevenue) : '$' + kpis.totalRevenue),
                        h('div', { className: 'kpi-subtitle' }, 'Current period performance'),
                        h('div', { className: 'progress-bar' },
                            h('div', { 
                                className: 'progress-fill',
                                style: { width: `${Math.min(100, kpis.achievement100)}%` }
                            },
                                h('div', { className: 'progress-text' }, `${kpis.achievement100.toFixed(1)}%`)
                            )
                        )
                    ),
                    h('div', { className: 'kpi-card warning' },
                        h('div', { className: 'kpi-icon warning' }, '🎯'),
                        h('div', { className: 'kpi-label' }, 'KPI Achievement'),
                        h('div', { className: 'kpi-value' }, `${kpis.kpiAchievement.toFixed(1)}%`),
                        h('div', { className: 'kpi-subtitle' }, '85% target progress'),
                        h('div', { className: 'progress-bar' },
                            h('div', { 
                                className: 'progress-fill',
                                style: { width: `${Math.min(100, kpis.kpiAchievement)}%` }
                            },
                                h('div', { className: 'progress-text' }, `${kpis.kpiAchievement.toFixed(1)}%`)
                            )
                        )
                    ),
                    h('div', { className: 'kpi-card danger' },
                        h('div', { className: 'kpi-icon danger' }, '📈'),
                        h('div', { className: 'kpi-label' }, 'Daily Run Rate'),
                        h('div', { className: 'kpi-value' }, formatCurrency ? formatCurrency(kpis.runRate) : '$' + kpis.runRate),
                        h('div', { className: 'kpi-subtitle' }, '7-day average'),
                        h('div', { className: 'kpi-change change-positive' },
                            h('span', null, '📊'),
                            h('span', null, kpis.isTargetAchieved ? 'Target Achieved!' : `Required: ${formatCurrency ? formatCurrency(kpis.requiredRunRate) : '$' + Math.round(kpis.requiredRunRate)}/day`)
                        )
                    ),
                    h('div', { className: 'kpi-card success' },
                        h('div', { className: 'kpi-icon success' }, '📅'),
                        h('div', { className: 'kpi-label' }, 'Days Progressed'),
                        h('div', { className: 'kpi-value' }, kpis.daysRemaining),
                        h('div', { className: 'kpi-subtitle' }, `Days remaining of ${kpis.daysInPeriod} total`),
                        h('div', { className: 'progress-bar' },
                            h('div', { 
                                className: 'progress-fill',
                                style: { width: `${(kpis.daysElapsed / kpis.daysInPeriod) * 100}%` }
                            },
                                h('div', { className: 'progress-text' }, `${kpis.daysElapsed} days`)
                            )
                        )
                    )
                ),
                
                // Channel Performance Section - exact replica
                h('div', { className: 'channel-section' },
                    h('div', { className: 'section-header' },
                        h('h2', { className: 'section-title' }, '📊 Channel Performance'),
                        h('div', { className: 'section-subtitle' }, 'Individual channel breakdowns')
                    ),
                    h('div', { className: 'channel-grid' },
                        ...availableChannels.map(channel => {
                            const revenue = kpis.channelRevenues[channel] || 0;
                            const target = kpis.channelTargets85[channel] || 0;
                            const achievement = kpis.channelAchievements[channel] || 0;
                            const channelClass = channel.toLowerCase().replace(/\s+/g, '-').replace('ca-international', 'ca-intl');
                            
                            // Get channel-specific color
                            const channelColor = INITIAL_DATA.CHANNEL_COLORS?.[channel] || '#667eea';
                            
                            return h('div', { 
                                key: channel,
                                className: `channel-card ${channelClass}`
                            },
                                h('div', { className: 'channel-header' },
                                    h('h3', { className: 'channel-name' }, channel),
                                    h('div', { className: 'channel-achievement' }, `${achievement.toFixed(0)}%`)
                                ),
                                h('div', { className: 'channel-metrics' },
                                    h('div', { className: 'metric' },
                                        h('div', { className: 'metric-label' }, 'Revenue'),
                                        h('div', { className: 'metric-value' }, formatCurrency ? formatCurrency(revenue) : '$' + revenue)
                                    ),
                                    h('div', { className: 'metric' },
                                        h('div', { className: 'metric-label' }, 'Target (85%)'),
                                        h('div', { className: 'metric-value' }, formatCurrency ? formatCurrency(target) : '$' + target)
                                    )
                                ),
                                h('div', { className: 'progress-bar' },
                                    h('div', { 
                                        className: 'progress-fill',
                                        style: { 
                                            width: `${Math.min(100, achievement)}%`,
                                            background: channelColor
                                        }
                                    },
                                        h('div', { className: 'progress-text' }, `${achievement.toFixed(0)}%`)
                                    )
                                )
                            );
                        })
                    )
                ),
                
            );
        };
        
        // Create refs for charts
        const barChartRef = useRef(null);
        const pieChartRef = useRef(null);
        const lineChartRef = useRef(null);
        
        // Render
        return h('div', { className: 'main-content' },
            renderMainContent(),
            // Charts component with refs
            h(Charts, {
                kpis,
                selectedChannels: selectedChannels.filter(ch => availableChannels.includes(ch)),
                setSelectedChannels,
                view,
                selectedPeriod,
                selectedMonth,
                selectedYear,
                availableChannels,
                barChartRef,
                pieChartRef,
                lineChartRef
            })
        );
    }
    
    // Make Dashboard available globally
    window.Dashboard = Dashboard;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.Dashboard = Dashboard;
    // Ensure module-bridge mapping also points to this Dashboard
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.Dashboard = Dashboard;
})();


