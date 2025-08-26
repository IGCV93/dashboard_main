/**
 * Dashboard Component - Main dashboard view with KPIs and charts
 */

(function() {
    'use strict';
    
    function Dashboard(props) {
        const { useState, useEffect, useMemo, useRef, createElement: h } = React;
        
        const {
            view,
            selectedPeriod,
            selectedMonth,
            selectedYear,
            selectedBrand,
            salesData,
            config,
            dataService,
            dynamicBrands,  // Accept dynamic brands from props
            dynamicTargets  // Accept dynamic targets from props
        } = props;
        
        // Get dependencies from window
        const { formatCurrency, formatPercent } = window.formatters || {};
        const { getDaysInPeriod, getDaysElapsed } = window.dateUtils || {};
        const KPICards = window.KPICards || (() => null);
        const ChannelPerformance = window.ChannelPerformance || (() => null);
        const Charts = window.Charts || (() => null);
        
        // State for charts
        const [selectedChannels, setSelectedChannels] = useState([
            'Amazon', 'TikTok', 'DTC-Shopify', 'Retail', 
            'CA International', 'UK International', 'Wholesale', 'Omnichannel'
        ]);
        
        // FIX: Use dynamic props instead of static INITIAL_DATA
        const INITIAL_DATA = window.ChaiVision?.INITIAL_DATA || {};
        
        // Use dynamic values from props, fallback to INITIAL_DATA if not provided
        const brandsToUse = dynamicBrands || INITIAL_DATA.brands || [];
        const targetsToUse = dynamicTargets || INITIAL_DATA.targets || {};
        
        // Calculate KPIs
        const kpis = useMemo(() => {
            let filteredData = salesData || [];
            
            // Filter by brand
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
            
            // Calculate revenue by channel
            const ALL_CHANNELS = ['Amazon', 'TikTok', 'DTC-Shopify', 'Retail', 
                                 'CA International', 'UK International', 'Wholesale', 'Omnichannel'];
            
            const channelRevenues = {};
            ALL_CHANNELS.forEach(channel => {
                channelRevenues[channel] = filteredData
                    .filter(d => d.channel === channel)
                    .reduce((sum, d) => sum + (d.revenue || 0), 0);
            });
            
            const totalRevenue = Object.values(channelRevenues).reduce((sum, val) => sum + val, 0);
            
            // Get targets
            const channelTargets100 = {};
            const channelTargets85 = {};
            
            ALL_CHANNELS.forEach(channel => {
                channelTargets100[channel] = 0;
                channelTargets85[channel] = 0;
            });
            
            // Calculate targets based on selection - USE DYNAMIC TARGETS
            if (selectedBrand === 'All Brands') {
                brandsToUse.forEach(brand => {
                    const brandData = targetsToUse[selectedYear]?.brands?.[brand];
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
                                ALL_CHANNELS.forEach(ch => {
                                    monthlyData[ch] = (periodData[ch] || 0) / 3;
                                });
                                periodData = monthlyData;
                            }
                        }
                        if (periodData) {
                            ALL_CHANNELS.forEach(channel => {
                                channelTargets100[channel] += periodData[channel] || 0;
                            });
                        }
                    }
                });
            } else {
                const brandData = targetsToUse[selectedYear]?.brands?.[selectedBrand];
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
                            ALL_CHANNELS.forEach(ch => {
                                monthlyData[ch] = (periodData[ch] || 0) / 3;
                            });
                            periodData = monthlyData;
                        }
                    }
                    if (periodData) {
                        ALL_CHANNELS.forEach(channel => {
                            channelTargets100[channel] = periodData[channel] || 0;
                        });
                    }
                }
            }
            
            // Calculate 85% targets
            ALL_CHANNELS.forEach(channel => {
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
            
            // Channel achievements
            const channelAchievements = {};
            ALL_CHANNELS.forEach(channel => {
                channelAchievements[channel] = channelTargets85[channel] > 0 ? 
                    (channelRevenues[channel] / channelTargets85[channel]) * 100 : 0;
            });
            
            return {
                totalRevenue,
                channelRevenues,
                totalTarget85,
                totalTarget100,
                channelTargets85,
                channelTargets100,
                runRate,
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
                filteredData // Include filtered data for charts
            };
        }, [salesData, view, selectedPeriod, selectedYear, selectedMonth, selectedBrand, targetsToUse, brandsToUse]); // Updated dependencies
        
        // Get display title
        const getDisplayTitle = () => {
            let periodText = '';
            if (view === 'annual') {
                periodText = `${selectedYear} Annual`;
            } else if (view === 'quarterly') {
                periodText = `${selectedPeriod} ${selectedYear}`;
            } else if (view === 'monthly') {
                const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                                  'July', 'August', 'September', 'October', 'November', 'December'];
                periodText = `${monthNames[selectedMonth]} ${selectedYear}`;
            }
            
            const brandText = selectedBrand === 'All Brands' ? 'Company' : selectedBrand;
            return `${brandText} - ${periodText} Performance`;
        };
        
        return h('div', null,
            // Page Header
            h('div', { className: 'page-header' },
                h('div', { className: 'page-title' },
                    h('h1', null, getDisplayTitle()),
                    h('div', { className: 'page-subtitle' }, `Last updated: ${new Date().toLocaleTimeString()}`)
                )
            ),
            
            // Target Overview Section
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
            
            // KPI Cards
            h(KPICards, { kpis }),
            
            // Channel Performance
            h(ChannelPerformance, { kpis }),
            
            // Charts
            h(Charts, {
                kpis,
                selectedChannels,
                setSelectedChannels,
                view,
                selectedPeriod,
                selectedMonth,
                selectedYear
            })
        );
    }
    
    // Make Dashboard available globally
    window.Dashboard = Dashboard;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.Dashboard = Dashboard;
})();
