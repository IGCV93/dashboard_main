 /**
 * Charts Component - Data visualization charts with performance optimizations
 */

(function() {
    'use strict';
    
    function Charts(props) {
        const { useState, useEffect, useMemo, useRef, useCallback, createElement: h } = React;
        
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
        
        // Performance optimizations
        const [isChartsVisible, setIsChartsVisible] = useState(true);
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
        
        // Ensure default channel selection so charts are populated
        useEffect(() => {
            if (Array.isArray(selectedChannels) && selectedChannels.length === 0 && typeof setSelectedChannels === 'function') {
                setSelectedChannels(ALL_CHANNELS);
            }
        }, [ALL_CHANNELS, selectedChannels, setSelectedChannels]);
        
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
            if (!kpis || !kpis.filteredData) return null;
            
            const filteredSalesData = kpis.filteredData;
            // Use explicitly available channels from kpis when provided (permission-filtered), otherwise fallback
            const availableFromKpis = Array.isArray(kpis.availableChannels) && kpis.availableChannels.length > 0
                ? kpis.availableChannels
                : ALL_CHANNELS;
            const displayChannels = availableFromKpis.filter(ch => selectedChannels.includes(ch));
            
            // Prepare trend data based on view
            let trendLabels = [];
            let trendData = [];
            
            if (view === 'annual') {
                // Show monthly trends for the year
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                trendLabels = monthNames;
                
                for (let month = 1; month <= 12; month++) {
                    const monthStr = month.toString().padStart(2, '0');
                    const monthData = filteredSalesData.filter(d => {
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
                    const monthData = filteredSalesData.filter(d => {
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
                    const dayData = filteredSalesData.filter(d => {
                        if (!d.date) return false;
                        const [year, month, dayPart] = d.date.split('-');
                        return year === selectedYear && month === monthStr && dayPart === dayStr;
                    });
                    const dayRevenue = dayData.reduce((sum, d) => sum + (d.revenue || 0), 0);
                    trendData.push(dayRevenue);
                }
            }
            
            // Prepare channel breakdown data using normalized matching
            const normalizeKey = (value) => String(value || '')
                .trim()
                .toLowerCase()
                .replace(/&/g, 'and')
                .replace(/[^a-z0-9]+/g, '');
            const channelData = displayChannels.map(channel => {
                const key = normalizeKey(channel);
                const channelSales = filteredSalesData.filter(d => normalizeKey(d.channel_name || d.channel) === key);
                const totalRevenue = channelSales.reduce((sum, d) => sum + (d.revenue || 0), 0);
                return {
                    channel,
                    revenue: totalRevenue,
                    color: CHANNEL_COLORS[channel] || '#6B7280'
                };
            }).sort((a, b) => b.revenue - a.revenue);
            
            // Build 85% target series per label for the selected view (daily/monthly target)
            const totalTarget85 = kpis?.totalTarget85 || 0;
            const pointsCount = trendLabels.length || 1;
            const perPointTarget = totalTarget85 / pointsCount;
            const target85Series = trendLabels.map(() => perPointTarget);

            return {
                trendLabels,
                trendData,
                target85Series,
                channelData,
                totalRevenue: trendData.reduce((sum, val) => sum + val, 0)
            };
        }, [kpis, selectedChannels, view, selectedPeriod, selectedMonth, selectedYear, ALL_CHANNELS, CHANNEL_COLORS]);
        
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
        
        // Create charts with performance optimizations
        const createCharts = useCallback((data) => {
            const refsReady = !!(lineChartRef.current && barChartRef.current && pieChartRef.current);
            if (!data || !refsReady) {
                console.warn('Charts: Refs not ready or data missing. Retrying...', {
                    hasData: !!data,
                    lineReady: !!lineChartRef.current,
                    barReady: !!barChartRef.current,
                    pieReady: !!pieChartRef.current
                });
                // Retry shortly in case refs are not attached yet
                setTimeout(() => {
                    const refsReadyNow = !!(lineChartRef.current && barChartRef.current && pieChartRef.current);
                    if (!refsReadyNow) {
                        console.error('Charts: Refs still not ready. Skipping chart creation.');
                        return;
                    }
                    destroyCharts();
                    createLineChart(data);
                    createBarChart(data); // Pass processed data
                    createPieChart(data);
                }, 50);
                return;
            }
            
            // Destroy existing charts to prevent memory leaks
            destroyCharts();
            
            // Create new charts
            createLineChart(data);
            createBarChart(kpis); // Pass kpis instead of processed data
            createPieChart(data);
        }, []);
        
        // Create line chart
        const createLineChart = useCallback((data) => {
            if (!lineChartRef.current || !data.trendLabels || !data.trendData) return;
            
            const ctx = lineChartRef.current.getContext('2d');
            
            lineChartInstance.current = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.trendLabels,
                    datasets: [
                        {
                            label: 'Revenue Trend',
                            data: data.trendData,
                            borderColor: '#667eea',
                            backgroundColor: 'rgba(102, 126, 234, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: '#667eea',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: '85% Target',
                            data: data.target85Series || [],
                            borderColor: '#10B981',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            fill: false,
                            tension: 0,
                            pointRadius: 0,
                            borderDash: [6, 4]
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
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    animation: {
                        duration: 750
                    }
                }
            });
        }, [getDisplayTitle, formatCurrency]);
        
        // Create bar chart
        const createBarChart = useCallback((data) => {
            if (!barChartRef.current) return;
            
            // DEBUG: Check if we have valid data
            if (!data || !data.channelData || data.channelData.length === 0) {
                console.log('🔍 Charts: Skipping bar chart creation - no valid channel data', {
                    hasData: !!data,
                    hasChannelData: !!(data && data.channelData),
                    channelDataLength: data && data.channelData ? data.channelData.length : 0
                });
                return;
            }
            
            const ctx = barChartRef.current.getContext('2d');
            
            // DEBUG: Log what we're working with
            console.log('🔍 Charts: Channel data for bar chart:', {
                channelData: data.channelData,
                channelDataLength: data.channelData.length
            });
            
            // Extract channel names and revenues from channelData
            const channelNames = data.channelData.map(ch => ch.channel);
            const actualData = data.channelData.map(ch => ch.revenue);
            
            // Get target data from kpis (we need to access kpis for targets)
            const target85Data = channelNames.map(ch => Number(kpis?.channelTargets85?.[ch] || 0));
            
            console.log('🔍 Charts: Bar chart data prepared:', {
                channelNames,
                actualData,
                target85Data
            });
            barChartInstance.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: channelNames,
                    datasets: [
                        {
                            label: 'Actual Revenue',
                            data: actualData,
                            backgroundColor: 'rgba(251, 191, 36, 0.6)', /* amber */
                            borderColor: 'rgb(245, 158, 11)',
                            borderWidth: 2,
                            categoryPercentage: 0.6,
                            barPercentage: 0.45
                        },
                        {
                            label: '85% Target',
                            data: target85Data,
                            backgroundColor: 'rgba(229, 231, 235, 0.9)', /* gray-200 */
                            borderColor: 'rgb(209, 213, 219)',
                            borderWidth: 2,
                            categoryPercentage: 0.6,
                            barPercentage: 0.45
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
                    },
                    animation: {
                        duration: 750
                    }
                }
            });
        }, [getDisplayTitle, formatCurrency, kpis]);
        
        // Create pie chart
        const createPieChart = useCallback((data) => {
            if (!pieChartRef.current || !data.channelData) return;
            
            const ctx = pieChartRef.current.getContext('2d');
            
            pieChartInstance.current = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.channelData.map(d => d.channel),
                    datasets: [{
                        data: data.channelData.map(d => d.revenue),
                        backgroundColor: data.channelData.map(d => d.color),
                        borderColor: '#ffffff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                usePointStyle: true,
                                padding: 20
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.parsed;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${context.label}: ${formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 750
                    }
                }
            });
        }, [getDisplayTitle, formatCurrency]);
        
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
            console.log('🔍 Charts: useEffect triggered', {
                isChartsVisible,
                hasProcessedChartData: !!processedChartData,
                hasKpis: !!kpis,
                filteredDataLength: kpis && kpis.filteredData ? kpis.filteredData.length : 0,
                timestamp: new Date().toISOString()
            });
            
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
            // Combined Analysis Card (Bar + Pie with filter chips)
            h('div', { className: 'chart-card' },
                h('div', { className: 'chart-header' },
                    h('h3', { className: 'chart-title' }, '📊 Channel Performance Analysis'),
                    h('p', { className: 'chart-subtitle' }, getDisplayTitle())
                ),
                h('div', { className: 'chart-filters' },
                    h('span', { className: 'filter-label' }, 'Show Channels:'),
                    h('div', { className: 'filter-buttons' },
                        ALL_CHANNELS.map(channel => 
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
            
            // Revenue Trend Card (Line)
            h('div', { className: 'chart-card' },
                h('div', { className: 'chart-header' },
                    h('h3', { className: 'chart-title' }, '📈 Revenue Trend'),
                    h('p', { className: 'chart-subtitle' }, getDisplayTitle())
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
