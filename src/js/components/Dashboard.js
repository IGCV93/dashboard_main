/**
 * Dashboard Component - Main dashboard view with KPIs and charts
 * ENHANCED WITH PERMISSION FILTERING
 */

(function() {
    'use strict';
    
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
            dynamicChannels,
            dynamicTargets,
            userRole,        // Added for permission checking
            userPermissions  // Added for filtering
        } = props;
        
        // Normalization helper (match upload normalization)
        const normalizeKey = (value) => {
            const str = String(value || '')
                .trim()
                .toLowerCase()
                .replace(/&/g, 'and')
                .replace(/[^a-z0-9]+/g, '');
            return str;
        };

        // Get dependencies from window
        const { formatCurrency, formatPercent } = window.formatters || {};
        const { getDaysInPeriod, getDaysElapsed, getDaysInQuarter, getDaysInMonth } = window.dateUtils || {};
        const KPICards = window.KPICards || window.ChaiVision?.components?.KPICards || (() => null);
        const ChannelPerformance = window.ChannelPerformance || window.ChaiVision?.components?.ChannelPerformance || (() => null);
        const Charts = window.ChaiVision?.components?.Charts || window.Charts || (() => null);
        
        // State for charts and dynamic channels
        const [selectedChannels, setSelectedChannels] = useState([]);
        
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
            const allChannels = (dynamicChannels && dynamicChannels.length > 0) ? dynamicChannels : (INITIAL_DATA.channels || [
                'Amazon', 'TikTok', 'DTC-Shopify', 'Retail',
                'CA International', 'UK International', 'Wholesale', 'Omnichannel'
            ]);
            
            if (!userPermissions) return allChannels;
            
            if (userRole === 'Admin' || userPermissions.channels?.includes('All Channels')) {
                return allChannels;
            }
            
            return allChannels.filter(channel => 
                userPermissions.channels?.includes(channel)
            );
        }, [userPermissions, userRole]);
        
        // Calculate KPIs with permission filtering
        const kpis = useMemo(() => {
            const validateSalesRecord = (record) => {
                // Skip records that are clearly invalid
                if (!record) return false;

                // Date validation - allow any valid date format
                if (record.date) {
                    const date = new Date(record.date);
                    if (isNaN(date.getTime())) return false;

                    // Only exclude clearly impossible future dates (more than 1 year ahead)
                    const oneYearFromNow = new Date();
                    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
                    if (date > oneYearFromNow) return false;

                    // Only exclude very old dates (more than 10 years ago) as likely data errors
                    const tenYearsAgo = new Date();
                    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
                    if (date < tenYearsAgo) return false;
                }

                // Revenue validation - only exclude clearly invalid values
                if (record.revenue !== undefined && record.revenue !== null) {
                    const revenue = parseFloat(record.revenue);
                    if (isNaN(revenue)) return false;
                    // Only exclude extremely negative values (likely data errors)
                    // Allow small negative values as they could be refunds/returns
                    if (revenue < -1000000) return false;
                    // Only exclude unrealistically large values (likely data errors)
                    if (revenue > 100000000) return false;
                }

                return true;
            };

            // Build canonical fields for robust filtering with validation
            const canonicalData = (salesData || [])
                .filter(validateSalesRecord)
                .map(d => ({
                    ...d,
                    _brand: (d.brand_name || d.brand || '').trim(),
                    _brandKey: normalizeKey(d.brand_name || d.brand),
                    _channel: (d.channel_name || d.channel || '').trim(),
                    _channelKey: normalizeKey(d.channel_name || d.channel),
                    revenue: parseFloat(d.revenue) || 0 // Ensure revenue is a number
                }));

            let filteredData = canonicalData;
            
            // PERMISSION FILTER: Filter by user's brand permissions
            if (userRole !== 'Admin' && userPermissions?.brands && !userPermissions.brands.includes('All Brands')) {
                filteredData = filteredData.filter(d => {
                    return userPermissions.brands.some(b => normalizeKey(b) === d._brandKey);
                });
            }
            
            // PERMISSION FILTER: Filter by user's channel permissions
            if (userRole !== 'Admin' && userPermissions?.channels && !userPermissions.channels.includes('All Channels')) {
                filteredData = filteredData.filter(d => {
                    return userPermissions.channels.some(c => normalizeKey(c) === d._channelKey);
                });
            }
            
            // Filter by selected brand (from dropdown). Treat "All Brands (Company Total)" as company total as well.
            if (selectedBrand !== 'All Brands' && selectedBrand !== 'All Brands (Company Total)') {
                const selKey = normalizeKey(selectedBrand);
                const beforeFilterCount = filteredData.length;
                filteredData = filteredData.filter(d => d._brandKey === selKey);
                console.log(`🔍 Brand filter "${selectedBrand}": ${beforeFilterCount} → ${filteredData.length} records`);
                console.log(`🔍 Sample brands in data before filter:`, [...new Set(canonicalData.map(d => d._brand))].slice(0, 5));
                console.log(`🔍 Sample brands in data after filter:`, [...new Set(filteredData.map(d => d._brand))].slice(0, 5));
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
            
            // Debug: Log what data we're working with
            console.log('🔍 Dashboard Debug - Raw salesData length:', salesData?.length || 0);
            console.log('🔍 Dashboard Debug - Filtered data length:', filteredData.length);
            console.log('🔍 Dashboard Debug - Sample filtered data:', filteredData.slice(0, 3));
            
            // Aggregate data by Date + Channel + Brand before calculating channel revenues
            const aggregatedData = {};
            filteredData.forEach(record => {
                const date = record.date;
                const channel = record._channel || record.channel_name || record.channel;
                const brand = record._brand || record.brand_name || record.brand;
                const revenue = parseFloat(record.revenue) || 0;
                
                // Create unique key for Date + Channel + Brand combination
                const key = `${date}|${channel}|${brand}`;
                
                if (!aggregatedData[key]) {
                    aggregatedData[key] = {
                        date: date,
                        channel: channel,
                        brand: brand,
                        revenue: 0,
                        count: 0,
                        // Preserve other fields from the first record
                        ...record
                    };
                }
                
                // Sum revenue and count records
                aggregatedData[key].revenue += revenue;
                aggregatedData[key].count += 1;
            });
            
            // Convert aggregated data back to array for further processing
            const aggregatedArray = Object.values(aggregatedData);
            
            // Debug: Log aggregation results
            const totalRevenueBeforeAgg = filteredData.reduce((sum, d) => sum + (parseFloat(d.revenue) || 0), 0);
            const totalRevenueAfterAgg = aggregatedArray.reduce((sum, d) => sum + (d.revenue || 0), 0);
            console.log('🔍 Dashboard Debug - Aggregated data length:', aggregatedArray.length);
            console.log('🔍 Dashboard Debug - Sample aggregated data:', aggregatedArray.slice(0, 3));
            console.log('🔍 Dashboard Debug - Total revenue BEFORE aggregation:', totalRevenueBeforeAgg);
            console.log('🔍 Dashboard Debug - Total revenue AFTER aggregation:', totalRevenueAfterAgg);
            if (Math.abs(totalRevenueBeforeAgg - totalRevenueAfterAgg) > 0.01) {
                console.warn('⚠️ Revenue mismatch: aggregation may have changed totals');
            }
            
            // Calculate revenue by channel (only for available channels)
            const channelRevenues = {};
            availableChannels.forEach(channel => {
                const chKey = normalizeKey(channel);
                channelRevenues[channel] = aggregatedArray
                    .filter(d => d._channelKey === chKey)
                    .reduce((sum, d) => sum + (d.revenue || 0), 0);
            });
            
            // Get targets (filtered by permissions)
            const channelTargets100 = {};
            const channelTargets85 = {};
            
            availableChannels.forEach(channel => {
                channelTargets100[channel] = 0;
                channelTargets85[channel] = 0;
            });
            
            // Calculate targets based on selection and permissions
            const isCompanyTotal = selectedBrand === 'All Brands' || selectedBrand === 'All Brands (Company Total)';
            const brandsToCalculate = isCompanyTotal ? availableBrands : [selectedBrand];
            
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
                            const year = parseInt(selectedYear);
                            const month = parseInt(selectedMonth);

                            // Calculate days-based distribution instead of simple division by 3
                            const daysInThisMonth = getDaysInMonth ? getDaysInMonth(year, month) : 30;
                            const daysInThisQuarter = getDaysInQuarter ? getDaysInQuarter(year, quarter) : 90;
                            const dayRatio = daysInThisMonth / daysInThisQuarter;

                            availableChannels.forEach(ch => {
                                // Distribute quarterly target based on actual days in month vs quarter
                                monthlyData[ch] = (periodData[ch] || 0) * dayRatio;
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
            
            const totalRevenue = Object.values(channelRevenues).reduce((sum, val) => sum + val, 0);
            
            // Time calculations
            const daysInPeriod = getDaysInPeriod ? getDaysInPeriod(view, selectedPeriod, selectedYear, selectedMonth) : 30;
            const daysElapsed = getDaysElapsed ? getDaysElapsed(view, selectedPeriod, selectedYear, selectedMonth) : 15;
            const daysRemaining = Math.max(0, daysInPeriod - daysElapsed);
            
            // Calculate improved run rate (14-day weighted average)
            const calculateRunRate = (data) => {
                if (!data || data.length === 0) return 0;

                const fourteenDaysAgo = new Date();
                fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

                // Get last 14 days of data
                const recentData = data.filter(d => new Date(d.date) >= fourteenDaysAgo);

                if (recentData.length === 0) return 0;

                // Group by date and sum daily revenues
                const dailyRevenues = {};
                recentData.forEach(d => {
                    const dateKey = d.date;
                    dailyRevenues[dateKey] = (dailyRevenues[dateKey] || 0) + d.revenue;
                });

                const days = Object.keys(dailyRevenues).sort();
                if (days.length === 0) return 0;

                // Calculate weighted average (recent days weighted more heavily)
                let weightedSum = 0;
                let totalWeights = 0;

                days.forEach((day, index) => {
                    // Weight increases linearly for more recent days
                    const weight = index + 1; // Day 1 gets weight 1, day 14 gets weight 14
                    weightedSum += dailyRevenues[day] * weight;
                    totalWeights += weight;
                });

                return totalWeights > 0 ? weightedSum / totalWeights : 0;
            };

            const runRate = calculateRunRate(filteredData);
            
            // Enhanced Projections with multiple scenarios
            const projections = {
                conservative: totalRevenue + (runRate * 0.8 * daysRemaining),
                realistic: totalRevenue + (runRate * daysRemaining),
                optimistic: totalRevenue + (runRate * 1.2 * daysRemaining)
            };

            // Use realistic as main projection for backward compatibility
            const projection = projections.realistic;
            const projectionPercent85 = totalTarget85 > 0 ? projection / totalTarget85 : 0;
            const projectionPercent100 = totalTarget100 > 0 ? projection / totalTarget100 : 0;

            // Calculate percentages for all scenarios
            const projectionScenarios = {
                conservative: {
                    value: projections.conservative,
                    percent85: totalTarget85 > 0 ? projections.conservative / totalTarget85 : 0,
                    percent100: totalTarget100 > 0 ? projections.conservative / totalTarget100 : 0
                },
                realistic: {
                    value: projections.realistic,
                    percent85: projectionPercent85,
                    percent100: projectionPercent100
                },
                optimistic: {
                    value: projections.optimistic,
                    percent85: totalTarget85 > 0 ? projections.optimistic / totalTarget85 : 0,
                    percent100: totalTarget100 > 0 ? projections.optimistic / totalTarget100 : 0
                }
            };
            
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
            
            const debugSummary = {
                totalRows: canonicalData.length,
                filteredRows: filteredData.length,
                selectedBrand,
                year: selectedYear,
                month: selectedMonth,
                totalRevenue
            };
            try { console.debug('KPIs debug:', debugSummary); } catch (e) {}

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
                projectionScenarios, // Add projection scenarios
                daysRemaining,
                daysElapsed,
                daysInPeriod,
                kpiAchievement,
                achievement100,
                gapToKPI,
                gapTo100,
                channelAchievements,
                filteredData: aggregatedArray // Use aggregated data instead of raw filtered data
            };
        }, [salesData, view, selectedPeriod, selectedYear, selectedMonth, selectedBrand, 
            dynamicTargets, availableBrands, availableChannels, userRole, userPermissions]);
        
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
        
        // Show permission notice if user has limited access
        const showPermissionNotice = userRole !== 'Admin' && 
            (userPermissions?.brands?.length > 0 && !userPermissions.brands.includes('All Brands') ||
             userPermissions?.channels?.length > 0 && !userPermissions.channels.includes('All Channels'));
        
        return h('div', null,
            // Permission Notice
            showPermissionNotice && h('div', { 
                className: 'alert-banner warning',
                style: { marginBottom: '20px' }
            },
                h('div', { className: 'alert-content' },
                    h('span', { className: 'alert-icon' }, '🔒'),
                    h('span', { className: 'alert-message' }, 
                        `You have access to: ${availableBrands.join(', ')} brands and ${availableChannels.join(', ')} channels`
                    )
                )
            ),
            
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
                        h('div', { className: 'target-value' }, formatCurrency ? formatCurrency(kpis.totalRevenue, 'USD', false) : '$' + Number(kpis.totalRevenue || 0).toFixed(2)),
                        h('div', { className: 'target-subtitle' }, `${(kpis.achievement100 || 0).toFixed(1)}% of full target`)
                    ),
                    h('div', { className: 'target-item projection-hover' },
                        // Normal content
                        h('div', { className: 'projection-normal' },
                            h('div', { className: 'target-label' }, '📈 End Projection'),
                            h('div', { className: 'target-value' }, formatCurrency ? formatCurrency(kpis.projectionScenarios?.realistic?.value || 0) : '$' + (kpis.projectionScenarios?.realistic?.value || 0)),
                            h('div', { className: 'target-subtitle' }, `${((kpis.projectionScenarios?.realistic?.percent100 || 0) * 100).toFixed(1)}% of full target`)
                        ),
                        // Hover content - showing all 3 scenarios in horizontal layout
                        h('div', { className: 'projection-hover-content' },
                            h('div', { className: 'scenarios-title' }, 'End Projections'),
                            h('div', { className: 'scenarios-grid-horizontal' },
                                h('div', { className: 'scenario-column conservative' },
                                    h('div', { className: 'scenario-type' }, 'Conservative'),
                                    h('div', { className: 'scenario-amount' }, formatCurrency ? formatCurrency(kpis.projectionScenarios?.conservative?.value || 0) : '$' + (kpis.projectionScenarios?.conservative?.value || 0).toLocaleString()),
                                    h('div', { className: 'scenario-percentage' }, `${((kpis.projectionScenarios?.conservative?.percent100 || 0) * 100).toFixed(0)}%`)
                                ),
                                h('div', { className: 'scenario-column realistic' },
                                    h('div', { className: 'scenario-type' }, 'Realistic'),
                                    h('div', { className: 'scenario-amount' }, formatCurrency ? formatCurrency(kpis.projectionScenarios?.realistic?.value || 0) : '$' + (kpis.projectionScenarios?.realistic?.value || 0).toLocaleString()),
                                    h('div', { className: 'scenario-percentage' }, `${((kpis.projectionScenarios?.realistic?.percent100 || 0) * 100).toFixed(0)}%`)
                                ),
                                h('div', { className: 'scenario-column optimistic' },
                                    h('div', { className: 'scenario-type' }, 'Optimistic'),
                                    h('div', { className: 'scenario-amount' }, formatCurrency ? formatCurrency(kpis.projectionScenarios?.optimistic?.value || 0) : '$' + (kpis.projectionScenarios?.optimistic?.value || 0).toLocaleString()),
                                    h('div', { className: 'scenario-percentage' }, `${((kpis.projectionScenarios?.optimistic?.percent100 || 0) * 100).toFixed(0)}%`)
                                )
                            ),
                            h('div', { className: 'scenarios-note' }, '14-day weighted average')
                        )
                    )
                )
            ),
            
            // KPI Cards
            h(KPICards, { kpis }),
            
            // Channel Performance (filtered by permissions)
            h(ChannelPerformance, { 
                kpis: {
                    ...kpis,
                    channels: availableChannels // Pass only available channels
                }
            }),
            
            // Charts (filtered by permissions)
            h(Charts, {
                kpis,
                selectedChannels: selectedChannels.filter(ch => availableChannels.includes(ch)),
                setSelectedChannels,
                view,
                selectedPeriod,
                selectedMonth,
                selectedYear,
                availableChannels // Pass available channels to filter options
            })
        );
    }
    
    // Make Dashboard available globally
    window.Dashboard = Dashboard;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.Dashboard = Dashboard;
})();
