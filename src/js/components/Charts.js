/**
 * Charts Component - Data visualization charts
 */

(function() {
    'use strict';
    
    function Charts(props) {
        const { useState, useEffect, useMemo, useRef, createElement: h } = React;
        
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
        
        // Get formatters from window
        const { formatCurrency } = window.formatters || {};
        
        // Get data from window
        const INITIAL_DATA = window.ChaiVision?.INITIAL_DATA || {};
        const ALL_CHANNELS = INITIAL_DATA.channels || [];
        const CHANNEL_COLORS = INITIAL_DATA.channelColors || {};
        
        // Get display title helper
        const getDisplayTitle = () => {
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
        };
        
        // Create/Update charts
        useEffect(() => {
            if (!lineChartRef.current || !barChartRef.current || !pieChartRef.current) return;
            
            // Destroy existing charts
            if (lineChartInstance.current) lineChartInstance.current.destroy();
            if (barChartInstance.current) barChartInstance.current.destroy();
            if (pieChartInstance.current) pieChartInstance.current.destroy();
            
            // Filter channels for display
            const displayChannels = ALL_CHANNELS.filter(ch => selectedChannels.includes(ch));
            
            // Prepare trend data based on view
            let trendLabels = [];
            let trendData = [];
            
            const filteredSalesData = kpis.filteredData || [];
            
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
                const year = parseInt(selectedYear);
                const month = parseInt(selectedMonth) - 1;
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                
                for (let day = 1; day <= daysInMonth; day++) {
                    trendLabels.push(day.toString());
                    const dayStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                    const dayData = filteredSalesData.filter(d => d.date === dayStr);
                    const dayRevenue = dayData.reduce((sum, d) => sum + (d.revenue || 0), 0);
                    trendData.push(dayRevenue);
                }
            }
            
            // Add a target line for comparison
            const targetLine = [];
            if (view === 'annual') {
                // Monthly targets (annual target / 12)
                const monthlyTarget = kpis.totalTarget85 / 12;
                for (let i = 0; i < 12; i++) {
                    targetLine.push(monthlyTarget);
                }
            } else if (view === 'quarterly') {
                // Monthly targets within quarter (quarterly target / 3)
                const monthlyTarget = kpis.totalTarget85 / 3;
                for (let i = 0; i < 3; i++) {
                    targetLine.push(monthlyTarget);
                }
            } else if (view === 'monthly') {
                // Daily targets (monthly target / days in month)
                const dailyTarget = kpis.totalTarget85 / kpis.daysInPeriod;
                for (let i = 0; i < trendLabels.length; i++) {
                    targetLine.push(dailyTarget);
                }
            }
            
            // Bar Chart - Channel Comparison
            const barCtx = barChartRef.current.getContext('2d');
            barChartInstance.current = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: displayChannels,
                    datasets: [
                        {
                            label: 'Actual Revenue',
                            data: displayChannels.map(ch => kpis.channelRevenues[ch] || 0),
                            backgroundColor: displayChannels.map(ch => (CHANNEL_COLORS[ch] || '#667eea') + '99'),
                            borderColor: displayChannels.map(ch => CHANNEL_COLORS[ch] || '#667eea'),
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
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = context.parsed.y;
                                    return `${context.dataset.label}: ${formatCurrency ? formatCurrency(value) : '$' + value}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => formatCurrency ? formatCurrency(value) : '$' + value
                            }
                        }
                    }
                }
            });
            
            // Pie Chart - Revenue Distribution
            const pieCtx = pieChartRef.current.getContext('2d');
            pieChartInstance.current = new Chart(pieCtx, {
                type: 'doughnut',
                data: {
                    labels: displayChannels,
                    datasets: [{
                        data: displayChannels.map(ch => kpis.channelRevenues[ch] || 0),
                        backgroundColor: displayChannels.map(ch => (CHANNEL_COLORS[ch] || '#667eea') + '99'),
                        borderColor: displayChannels.map(ch => CHANNEL_COLORS[ch] || '#667eea'),
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
                                    const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                    const value = context.parsed;
                                    return `${context.label}: ${formatCurrency ? formatCurrency(value) : '$' + value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
            
            // Line Chart - Revenue Trend (Updated with target line and enhanced styling)
            const lineCtx = lineChartRef.current.getContext('2d');
            
            lineChartInstance.current = new Chart(lineCtx, {
                type: 'line',
                data: {
                    labels: trendLabels,
                    datasets: [
                        {
                            label: view === 'annual' ? 'Monthly Revenue' : 
                                   view === 'quarterly' ? 'Monthly Revenue' : 
                                   'Daily Revenue',
                            data: trendData,
                            borderColor: 'rgb(102, 126, 234)',
                            backgroundColor: 'rgba(102, 126, 234, 0.1)',
                            tension: 0.4,
                            fill: true,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: 'rgb(102, 126, 234)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2
                        },
                        {
                            label: '85% Target Line',
                            data: targetLine,
                            borderColor: 'rgba(251, 191, 36, 0.8)',
                            backgroundColor: 'transparent',
                            borderDash: [5, 5],
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 0,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    if (context.dataset.label.includes('Target')) {
                                        return `Target: ${formatCurrency ? formatCurrency(context.parsed.y) : '$' + context.parsed.y}`;
                                    }
                                    return `Revenue: ${formatCurrency ? formatCurrency(context.parsed.y) : '$' + context.parsed.y}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => formatCurrency ? formatCurrency(value) : '$' + value
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                maxRotation: view === 'monthly' ? 45 : 0,
                                minRotation: view === 'monthly' ? 45 : 0
                            }
                        }
                    }
                }
            });
            
        }, [kpis, selectedChannels, view, selectedPeriod, selectedMonth, selectedYear]);
        
        // Handle channel selection toggle
        const handleChannelToggle = (channel) => {
            if (selectedChannels.includes(channel)) {
                setSelectedChannels(selectedChannels.filter(ch => ch !== channel));
            } else {
                setSelectedChannels([...selectedChannels, channel]);
            }
        };
        
        return h('div', null,
            // Charts Section
            h('div', { className: 'chart-card' },
                h('div', { className: 'chart-header' },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' } },
                        h('h3', { className: 'chart-title' }, '📊 Channel Performance Analysis'),
                        h('div', { className: 'chart-filters' },
                            h('span', { className: 'filter-label' }, 'Show Channels:'),
                            h('div', { className: 'filter-buttons' },
                                ...ALL_CHANNELS.map(channel =>
                                    h('button', {
                                        key: channel,
                                        className: `filter-btn ${selectedChannels.includes(channel) ? 'selected' : ''}`,
                                        onClick: () => handleChannelToggle(channel),
                                        style: {
                                            backgroundColor: selectedChannels.includes(channel) ? CHANNEL_COLORS[channel] : 'transparent',
                                            borderColor: CHANNEL_COLORS[channel]
                                        }
                                    }, channel)
                                )
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
            
            // Revenue Trend Chart with enhanced header
            h('div', { className: 'chart-card' },
                h('div', { className: 'chart-header' },
                    h('div', null,
                        h('h3', { className: 'chart-title' }, 
                            view === 'annual' ? '📈 Monthly Revenue Trend' :
                            view === 'quarterly' ? '📈 Monthly Revenue Trend' :
                            '📈 Daily Revenue Trend'
                        ),
                        h('p', { 
                            style: { 
                                fontSize: '13px', 
                                color: '#6B7280', 
                                marginTop: '4px' 
                            }
                        }, 
                            view === 'annual' ? `Showing all 12 months of ${selectedYear}` :
                            view === 'quarterly' ? `Showing 3 months in ${selectedPeriod} ${selectedYear}` :
                            `Showing daily performance for ${getDisplayTitle()}`
                        )
                    )
                ),
                h('div', { className: 'chart-container' },
                    h('canvas', { ref: lineChartRef })
                )
            )
        );
    }
    
    // Make Charts available globally
    window.Charts = Charts;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.Charts = Charts;
})();
