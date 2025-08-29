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
            if (!kpis || !kpis.filteredData) return null;
            
            const filteredSalesData = kpis.filteredData;
            const displayChannels = ALL_CHANNELS.filter(ch => selectedChannels.includes(ch));
            
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
                        const [year, month, d] = d.date.split('-');
                        return year === selectedYear && month === monthStr && d === dayStr;
                    });
                    const dayRevenue = dayData.reduce((sum, d) => sum + (d.revenue || 0), 0);
                    trendData.push(dayRevenue);
                }
            }
            
            // Prepare channel breakdown data
            const channelData = displayChannels.map(channel => {
                const channelSales = filteredSalesData.filter(d => d.channel === channel);
                const totalRevenue = channelSales.reduce((sum, d) => sum + (d.revenue || 0), 0);
                return {
                    channel,
                    revenue: totalRevenue,
                    color: CHANNEL_COLORS[channel] || '#6B7280'
                };
            }).sort((a, b) => b.revenue - a.revenue);
            
            return {
                trendLabels,
                trendData,
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
        
        // Create charts with performance optimizations
        const createCharts = useCallback((data) => {
            if (!data || !lineChartRef.current || !barChartRef.current || !pieChartRef.current) return;
            
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
        
        // Create line chart
        const createLineChart = useCallback((data) => {
            if (!lineChartRef.current || !data.trendLabels || !data.trendData) return;
            
            const ctx = lineChartRef.current.getContext('2d');
            
            lineChartInstance.current = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.trendLabels,
                    datasets: [{
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
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `Revenue Trend - ${getDisplayTitle()}`,
                            font: {
                                size: 16,
                                weight: 'bold'
                            }
                        },
                        legend: {
                            display: false
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
            if (!barChartRef.current || !data.channelData) return;
            
            const ctx = barChartRef.current.getContext('2d');
            
            barChartInstance.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.channelData.map(d => d.channel),
                    datasets: [{
                        label: 'Channel Revenue',
                        data: data.channelData.map(d => d.revenue),
                        backgroundColor: data.channelData.map(d => d.color),
                        borderColor: data.channelData.map(d => d.color),
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `Channel Performance - ${getDisplayTitle()}`,
                            font: {
                                size: 16,
                                weight: 'bold'
                            }
                        },
                        legend: {
                            display: false
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
        }, [getDisplayTitle, formatCurrency]);
        
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
                        title: {
                            display: true,
                            text: `Revenue Distribution - ${getDisplayTitle()}`,
                            font: {
                                size: 16,
                                weight: 'bold'
                            }
                        },
                        legend: {
                            position: 'bottom',
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
            // Chart controls
            h('div', { className: 'chart-controls' },
                h('div', { className: 'channel-selector' },
                    h('h3', null, 'Select Channels:'),
                    h('div', { className: 'channel-buttons' },
                        ALL_CHANNELS.map(channel => 
                            h('button', {
                                key: channel,
                                className: `channel-btn ${selectedChannels.includes(channel) ? 'active' : ''}`,
                                onClick: () => handleChannelToggle(channel),
                                style: {
                                    backgroundColor: selectedChannels.includes(channel) ? CHANNEL_COLORS[channel] : 'transparent',
                                    borderColor: CHANNEL_COLORS[channel],
                                    color: selectedChannels.includes(channel) ? 'white' : CHANNEL_COLORS[channel]
                                }
                            }, channel)
                        )
                    )
                )
            ),
            
            // Charts grid
            h('div', { className: 'charts-grid' },
                // Line chart
                h('div', { className: 'chart-card' },
                    h('div', { className: 'chart-header' },
                        h('h3', null, 'Revenue Trend'),
                        h('p', null, getDisplayTitle())
                    ),
                    h('div', { className: 'chart-container' },
                        h('canvas', { ref: lineChartRef })
                    )
                ),
                
                // Bar chart
                h('div', { className: 'chart-card' },
                    h('div', { className: 'chart-header' },
                        h('h3', null, 'Channel Performance'),
                        h('p', null, getDisplayTitle())
                    ),
                    h('div', { className: 'chart-container' },
                        h('canvas', { ref: barChartRef })
                    )
                ),
                
                // Pie chart
                h('div', { className: 'chart-card full-width' },
                    h('div', { className: 'chart-header' },
                        h('h3', null, 'Revenue Distribution'),
                        h('p', null, getDisplayTitle())
                    ),
                    h('div', { className: 'chart-container' },
                        h('canvas', { ref: pieChartRef })
                    )
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
