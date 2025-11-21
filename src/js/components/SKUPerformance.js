/**
 * SKU Performance Component
 * Shows SKU-level sales performance for a specific channel
 * Updated with standard Dashboard styling and responsive layout
 */

(function () {
    'use strict';

    function SKUPerformance(props) {
        const { useState, useEffect, useMemo, useRef, createElement: h } = React;

        const {
            channel,
            brand,
            view,
            selectedPeriod,
            selectedMonth,
            selectedYear,
            dataService,
            userPermissions,
            channelTarget85 = 0,
            onNavigateBack
        } = props;

        // Theme colors from main.css
        const THEME = {
            primary: '#667eea',
            secondary: '#764ba2',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#3b82f6',
            textPrimary: '#1f2937',
            textSecondary: '#6b7280',
            gridLines: '#f3f4f6'
        };

        // State
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const [skuData, setSkuData] = useState([]);
        const [totalRevenue, setTotalRevenue] = useState(0);
        const [totalUnits, setTotalUnits] = useState(0);

        // Filter and sort state
        const [searchQuery, setSearchQuery] = useState('');
        const [selectedBrandFilter, setSelectedBrandFilter] = useState(brand || 'All Brands');
        const [sortBy, setSortBy] = useState('revenue'); // 'revenue', 'units', 'contribution', 'sku'
        const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
        const searchTimeoutRef = useRef(null);

        // Get unique brands from SKU data for brand filter
        const availableBrands = useMemo(() => {
            const brands = new Set();
            skuData.forEach(item => {
                if (item.brand) brands.add(item.brand);
            });
            return Array.from(brands).sort();
        }, [skuData]);

        // Comparison state
        const [comparisonMode, setComparisonMode] = useState(null); // 'yoy', 'mom', 'custom', null
        const [comparisonData, setComparisonData] = useState(null);
        const [loadingComparison, setLoadingComparison] = useState(false);

        // Custom comparison period state
        const [customComparisonStartDate, setCustomComparisonStartDate] = useState('');
        const [customComparisonEndDate, setCustomComparisonEndDate] = useState('');

        // Chart refs
        const topSKUsChartRef = useRef(null);
        const contributionChartRef = useRef(null);
        const trendChartRef = useRef(null);
        const comparisonChartRef = useRef(null);
        const topSKUsChartInstance = useRef(null);
        const contributionChartInstance = useRef(null);
        const trendChartInstance = useRef(null);
        const comparisonChartInstance = useRef(null);

        // Trend data state
        const [trendData, setTrendData] = useState(null);
        const [loadingTrend, setLoadingTrend] = useState(false);
        const [selectedSKUsForTrend, setSelectedSKUsForTrend] = useState([]);

        // Custom date range state
        const [useCustomDateRange, setUseCustomDateRange] = useState(false);
        const [customStartDate, setCustomStartDate] = useState('');
        const [customEndDate, setCustomEndDate] = useState('');

        // Pagination state
        const [currentPage, setCurrentPage] = useState(1);
        const [itemsPerPage, setItemsPerPage] = useState(50);

        // Virtual scrolling state
        const [virtualScrollEnabled, setVirtualScrollEnabled] = useState(false);
        const tableContainerRef = useRef(null);
        const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

        // Progressive loading state
        const [loadedDataCount, setLoadedDataCount] = useState(100);
        const [loadingMore, setLoadingMore] = useState(false);

        // Helper function to calculate date range
        const calculateDateRange = useMemo(() => {
            return (view, period, year, month) => {
                if (view === 'annual') {
                    return {
                        start: `${year}-01-01`,
                        end: `${year}-12-31`
                    };
                } else if (view === 'quarterly') {
                    const quarterMonths = {
                        'Q1': { start: '01-01', end: '03-31' },
                        'Q2': { start: '04-01', end: '06-30' },
                        'Q3': { start: '07-01', end: '09-30' },
                        'Q4': { start: '10-01', end: '12-31' }
                    };
                    const q = quarterMonths[period] || quarterMonths['Q1'];
                    return {
                        start: `${year}-${q.start}`,
                        end: `${year}-${q.end}`
                    };
                } else if (view === 'monthly') {
                    const daysInMonth = new Date(year, month, 0).getDate();
                    return {
                        start: `${year}-${String(month).padStart(2, '0')}-01`,
                        end: `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`
                    };
                }
                return { start: null, end: null };
            };
        }, []);

        // Get effective date range (custom or calculated)
        const getEffectiveDateRange = React.useCallback(() => {
            if (useCustomDateRange && customStartDate && customEndDate) {
                return {
                    start: customStartDate,
                    end: customEndDate
                };
            }
            return calculateDateRange(view, selectedPeriod, selectedYear, selectedMonth);
        }, [useCustomDateRange, customStartDate, customEndDate, view, selectedPeriod, selectedYear, selectedMonth, calculateDateRange]);

        // Load SKU data on mount
        useEffect(() => {
            const loadData = async () => {
                if (!dataService || !channel) {
                    setError('Missing required data service or channel');
                    setLoading(false);
                    return;
                }

                try {
                    setLoading(true);
                    setError(null);

                    // Get effective date range
                    const dateRange = getEffectiveDateRange();

                    if (!dateRange.start || !dateRange.end) {
                        setError('Invalid date range');
                        setLoading(false);
                        return;
                    }

                    const filters = {
                        startDate: dateRange.start,
                        endDate: dateRange.end,
                        channel: channel,
                        brand: brand || null,
                        groupBy: 'sku'
                    };

                    const data = await dataService.loadSKUData(filters);

                    setSkuData(data);

                    // Calculate totals
                    const total = data.reduce((sum, item) => sum + (item.revenue || 0), 0);
                    const units = data.reduce((sum, item) => sum + (item.units || 0), 0);
                    setTotalRevenue(total);
                    setTotalUnits(units);

                } catch (err) {
                    console.error('Failed to load SKU data:', err);
                    setError('Failed to load SKU data. Please try again.');
                } finally {
                    setLoading(false);
                }
            };

            loadData();
        }, [channel, brand, dataService, getEffectiveDateRange]);

        // Load comparison data when comparison mode is selected
        useEffect(() => {
            const loadComparison = async () => {
                if (!comparisonMode || !dataService || !channel) {
                    setComparisonData(null);
                    return;
                }

                try {
                    setLoadingComparison(true);

                    const currentDateRange = getEffectiveDateRange();
                    if (!currentDateRange.start || !currentDateRange.end) {
                        setLoadingComparison(false);
                        return;
                    }

                    let comparisonDateRange = null;

                    if (comparisonMode === 'yoy') {
                        // Same period, previous year
                        const currentYear = parseInt(selectedYear);
                        const prevYear = (currentYear - 1).toString();
                        comparisonDateRange = calculateDateRange(view, selectedPeriod, prevYear, selectedMonth);
                    } else if (comparisonMode === 'mom' && view === 'monthly') {
                        // Previous month
                        let prevMonth = selectedMonth - 1;
                        let prevYear = selectedYear;
                        if (prevMonth < 1) {
                            prevMonth = 12;
                            prevYear = (parseInt(selectedYear) - 1).toString();
                        }
                        comparisonDateRange = calculateDateRange('monthly', null, prevYear, prevMonth);
                    } else if (comparisonMode === 'custom') {
                        // Custom period comparison
                        if (customComparisonStartDate && customComparisonEndDate) {
                            comparisonDateRange = {
                                start: customComparisonStartDate,
                                end: customComparisonEndDate
                            };
                        } else {
                            setLoadingComparison(false);
                            return;
                        }
                    }

                    if (!comparisonDateRange || !comparisonDateRange.start || !comparisonDateRange.end) {
                        setLoadingComparison(false);
                        return;
                    }

                    const currentFilters = {
                        startDate: currentDateRange.start,
                        endDate: currentDateRange.end,
                        channel: channel,
                        brand: brand || null,
                        groupBy: 'sku'
                    };

                    const comparisonFilters = {
                        startDate: comparisonDateRange.start,
                        endDate: comparisonDateRange.end,
                        channel: channel,
                        brand: brand || null,
                        groupBy: 'sku'
                    };

                    const comparison = await dataService.loadSKUComparison(currentFilters, comparisonFilters);
                    setComparisonData(comparison);

                } catch (err) {
                    console.error('Failed to load comparison data:', err);
                    setComparisonData(null);
                } finally {
                    setLoadingComparison(false);
                }
            };

            loadComparison();
        }, [comparisonMode, channel, brand, dataService, getEffectiveDateRange, view, selectedPeriod, selectedYear, selectedMonth, customComparisonStartDate, customComparisonEndDate]);

        // Load trend data (grouped by date)
        useEffect(() => {
            const loadTrendData = async () => {
                if (!dataService || !channel) {
                    setTrendData(null);
                    return;
                }

                try {
                    setLoadingTrend(true);

                    const dateRange = getEffectiveDateRange();
                    if (!dateRange.start || !dateRange.end) {
                        setLoadingTrend(false);
                        return;
                    }

                    const filters = {
                        startDate: dateRange.start,
                        endDate: dateRange.end,
                        channel: channel,
                        brand: brand || null,
                        groupBy: 'date' // Group by date for trend chart
                    };

                    const data = await dataService.loadSKUData(filters);

                    // Group by date and aggregate
                    const dateMap = new Map();
                    data.forEach(item => {
                        const dateKey = item.date;
                        if (!dateMap.has(dateKey)) {
                            dateMap.set(dateKey, { date: dateKey, skus: new Map() });
                        }
                        const dateData = dateMap.get(dateKey);
                        if (!dateData.skus.has(item.sku)) {
                            dateData.skus.set(item.sku, { sku: item.sku, revenue: 0, units: 0 });
                        }
                        const skuData = dateData.skus.get(item.sku);
                        skuData.revenue += item.revenue || 0;
                        skuData.units += item.units || 0;
                    });

                    // Convert to array and sort by date
                    const trendArray = Array.from(dateMap.values())
                        .map(item => ({
                            date: item.date,
                            skus: Array.from(item.skus.values())
                        }))
                        .sort((a, b) => new Date(a.date) - new Date(b.date));

                    setTrendData(trendArray);

                } catch (err) {
                    console.error('Failed to load trend data:', err);
                    setTrendData(null);
                } finally {
                    setLoadingTrend(false);
                }
            };

            loadTrendData();
        }, [channel, brand, dataService, getEffectiveDateRange]);

        // Get formatters
        const { formatCurrency } = window.formatters || {};

        // Filter and sort SKU data
        const filteredAndSortedData = useMemo(() => {
            let filtered = [...skuData];

            // Apply brand filter
            if (selectedBrandFilter && selectedBrandFilter !== 'All Brands') {
                filtered = filtered.filter(item => item.brand === selectedBrandFilter);
            }

            // Apply search filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                filtered = filtered.filter(item => {
                    const skuMatch = item.sku.toLowerCase().includes(query);
                    const productMatch = item.product_name
                        ? item.product_name.toLowerCase().includes(query)
                        : false;
                    return skuMatch || productMatch;
                });
            }

            // Apply sorting
            filtered.sort((a, b) => {
                let aValue, bValue;

                switch (sortBy) {
                    case 'revenue':
                        aValue = a.revenue || 0;
                        bValue = b.revenue || 0;
                        break;
                    case 'units':
                        aValue = a.units || 0;
                        bValue = b.units || 0;
                        break;
                    case 'contribution':
                        aValue = totalRevenue > 0 ? (a.revenue / totalRevenue) * 100 : 0;
                        bValue = totalRevenue > 0 ? (b.revenue / totalRevenue) * 100 : 0;
                        break;
                    case 'sku':
                        aValue = a.sku.toLowerCase();
                        bValue = b.sku.toLowerCase();
                        break;
                    default:
                        aValue = a.revenue || 0;
                        bValue = b.revenue || 0;
                }

                if (sortBy === 'sku') {
                    // String comparison for SKU
                    return sortOrder === 'asc'
                        ? aValue.localeCompare(bValue)
                        : bValue.localeCompare(aValue);
                } else {
                    // Numeric comparison
                    return sortOrder === 'asc'
                        ? aValue - bValue
                        : bValue - aValue;
                }
            });

            return filtered;
        }, [skuData, searchQuery, selectedBrandFilter, sortBy, sortOrder, totalRevenue]);

        // Handle search input
        const handleSearchChange = (e) => {
            const value = e.target.value;
            setSearchQuery(value);
        };

        // Handle sort change
        const handleSortChange = (newSortBy) => {
            if (sortBy === newSortBy) {
                // Toggle sort order if clicking same column
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            } else {
                setSortBy(newSortBy);
                setSortOrder('desc'); // Default to descending for new sort
            }
        };

        // Get sort indicator
        const getSortIndicator = (column) => {
            if (sortBy !== column) return '';
            return sortOrder === 'asc' ? ' ↑' : ' ↓';
        };

        // Export functions
        const exportToCSV = () => {
            if (dataWithComparison.length === 0) {
                alert('No data to export');
                return;
            }

            // Prepare headers
            const headers = ['SKU', 'Product Name', 'Brand', 'Units', 'Revenue', 'Avg Price', 'Contribution %'];
            if (comparisonMode && comparisonData) {
                headers.push('Growth %', 'Growth Amount');
            }
            if (channelTarget85 > 0) {
                headers.push('Target Status', 'Performance %');
            }

            // Prepare data rows
            const rows = dataWithComparison.map(item => {
                const avgPrice = item.units > 0 ? item.revenue / item.units : 0;
                const contributionPercent = totalRevenue > 0
                    ? ((item.revenue / totalRevenue) * 100).toFixed(2)
                    : '0.00';

                const row = [
                    item.sku,
                    item.product_name || '',
                    item.brand || '',
                    item.units,
                    item.revenue.toFixed(2),
                    avgPrice.toFixed(2),
                    contributionPercent
                ];

                if (comparisonMode && comparisonData) {
                    const growth = item.comparison ? (item.comparison.growthPercent || 0).toFixed(1) : '';
                    const growthAmount = item.comparison ? (item.comparison.growthAmount || 0).toFixed(2) : '';
                    row.push(growth, growthAmount);
                }

                if (channelTarget85 > 0) {
                    const targetData = calculateSKUTargetContribution.get(item.sku);
                    const status = targetData ? (targetData.performancePercent >= 100 ? 'Exceeding' :
                        targetData.performancePercent >= 85 ? 'On Track' : 'Behind') : '';
                    const performance = targetData ? targetData.performancePercent.toFixed(1) : '';
                    row.push(status, performance);
                }

                return row;
            });

            // Create CSV content
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => {
                    const cellStr = String(cell);
                    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                        return `"${cellStr.replace(/"/g, '""')}"`;
                    }
                    return cellStr;
                }).join(','))
            ].join('\n');

            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            a.download = `sku_performance_${channel}_${dateStr}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        };

        // Quick date range selectors
        const handleQuickDateRange = (range) => {
            const today = new Date();
            let startDate, endDate;

            switch (range) {
                case 'last7':
                    endDate = new Date(today);
                    startDate = new Date(today);
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'last30':
                    endDate = new Date(today);
                    startDate = new Date(today);
                    startDate.setDate(startDate.getDate() - 30);
                    break;
                case 'last90':
                    endDate = new Date(today);
                    startDate = new Date(today);
                    startDate.setDate(startDate.getDate() - 90);
                    break;
                case 'lastQuarter':
                    endDate = new Date(today);
                    startDate = new Date(today);
                    startDate.setMonth(startDate.getMonth() - 3);
                    break;
                case 'thisMonth':
                    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                    endDate = new Date(today);
                    break;
                case 'lastMonth':
                    startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                    break;
                default:
                    return;
            }

            setCustomStartDate(startDate.toISOString().split('T')[0]);
            setCustomEndDate(endDate.toISOString().split('T')[0]);
            setUseCustomDateRange(true);
        };

        // Get comparison period label
        const getComparisonLabel = () => {
            if (comparisonMode === 'yoy') {
                return `vs ${parseInt(selectedYear) - 1} (YOY)`;
            } else if (comparisonMode === 'mom') {
                let prevMonth = selectedMonth - 1;
                let prevYear = selectedYear;
                if (prevMonth < 1) {
                    prevMonth = 12;
                    prevYear = (parseInt(selectedYear) - 1).toString();
                }
                const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
                return `vs ${monthNames[prevMonth]} ${prevYear} (MOM)`;
            } else if (comparisonMode === 'custom') {
                if (customComparisonStartDate && customComparisonEndDate) {
                    const start = new Date(customComparisonStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const end = new Date(customComparisonEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    return `vs ${start} - ${end} (Custom)`;
                }
            }
            return null;
        };

        // Merge comparison data with current data for display
        const dataWithComparison = useMemo(() => {
            if (!comparisonData || !comparisonData.merged) {
                return filteredAndSortedData.map(item => ({ ...item, comparison: null }));
            }

            // Create a map of SKU to comparison data
            const comparisonMap = new Map();
            comparisonData.merged.forEach(item => {
                comparisonMap.set(item.sku, item.comparison);
            });

            // Merge with filtered data
            return filteredAndSortedData.map(item => ({
                ...item,
                comparison: comparisonMap.get(item.sku) || null
            }));
        }, [filteredAndSortedData, comparisonData]);

        // Pagination calculations
        const totalPages = Math.ceil(dataWithComparison.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedData = dataWithComparison.slice(startIndex, endIndex);

        // Virtual scrolling calculations
        const virtualScrollData = useMemo(() => {
            if (!virtualScrollEnabled) return paginatedData;

            const bufferRows = 5;
            const start = Math.max(0, visibleRange.start - bufferRows);
            const end = Math.min(dataWithComparison.length, visibleRange.end + bufferRows);

            return dataWithComparison.slice(start, end).map((item, idx) => ({
                ...item,
                virtualIndex: start + idx
            }));
        }, [virtualScrollEnabled, dataWithComparison, visibleRange, paginatedData]);

        // Reset page when filters change
        useEffect(() => {
            setCurrentPage(1);
        }, [searchQuery, selectedBrandFilter, sortBy, sortOrder]);

        // Handle scroll for virtual scrolling
        useEffect(() => {
            if (!virtualScrollEnabled || !tableContainerRef.current) return;

            const handleScroll = () => {
                const container = tableContainerRef.current;
                if (!container) return;

                const scrollTop = container.scrollTop;
                const rowHeight = 50;
                const containerHeight = container.clientHeight;

                const start = Math.floor(scrollTop / rowHeight);
                const end = start + Math.ceil(containerHeight / rowHeight);

                setVisibleRange({ start, end });
            };

            const container = tableContainerRef.current;
            container.addEventListener('scroll', handleScroll);
            handleScroll(); // Initial calculation

            return () => {
                container.removeEventListener('scroll', handleScroll);
            };
        }, [virtualScrollEnabled]);

        // Progressive loading - load more data when needed
        useEffect(() => {
            if (dataWithComparison.length > loadedDataCount && !loadingMore) {
                // Auto-load more if user is near the end
                if (currentPage >= Math.ceil(loadedDataCount / itemsPerPage) - 2) {
                    setLoadingMore(true);
                    setTimeout(() => {
                        setLoadedDataCount(Math.min(loadedDataCount + 100, dataWithComparison.length));
                        setLoadingMore(false);
                    }, 300);
                }
            }
        }, [currentPage, dataWithComparison.length, loadedDataCount, itemsPerPage, loadingMore]);

        // Calculate target contribution for each SKU
        const calculateSKUTargetContribution = useMemo(() => {
            if (!channelTarget85 || channelTarget85 === 0 || skuData.length === 0) {
                return new Map();
            }

            const avgContributionPercent = 100 / skuData.length;
            const targetMap = new Map();

            skuData.forEach(item => {
                const currentContribution = totalRevenue > 0
                    ? (item.revenue / totalRevenue) * 100
                    : avgContributionPercent;

                const historicalAvgPercent = currentContribution || avgContributionPercent;
                const skuTarget = (channelTarget85 * historicalAvgPercent) / 100;

                targetMap.set(item.sku, {
                    target: skuTarget,
                    contributionPercent: historicalAvgPercent,
                    gap: skuTarget - item.revenue,
                    performancePercent: skuTarget > 0 ? (item.revenue / skuTarget) * 100 : 0
                });
            });

            return targetMap;
        }, [channelTarget85, skuData, totalRevenue]);

        // Prepare chart data
        const chartData = useMemo(() => {
            if (filteredAndSortedData.length === 0) return null;

            const topSKUs = filteredAndSortedData
                .slice()
                .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                .slice(0, 20);

            const top10 = filteredAndSortedData
                .slice()
                .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                .slice(0, 10);
            const othersRevenue = filteredAndSortedData
                .slice()
                .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                .slice(10)
                .reduce((sum, item) => sum + (item.revenue || 0), 0);

            return {
                topSKUs,
                top10,
                othersRevenue
            };
        }, [filteredAndSortedData]);

        // Create charts
        useEffect(() => {
            if (!chartData || loading) return;

            const ChartLib = window.Chart || (typeof Chart !== 'undefined' ? Chart : null);
            if (!ChartLib) {
                console.warn('Chart.js not available, skipping chart rendering');
                return;
            }

            // Destroy existing charts
            if (topSKUsChartInstance.current) {
                topSKUsChartInstance.current.destroy();
                topSKUsChartInstance.current = null;
            }
            if (contributionChartInstance.current) {
                contributionChartInstance.current.destroy();
                contributionChartInstance.current = null;
            }
            if (trendChartInstance.current) {
                trendChartInstance.current.destroy();
                trendChartInstance.current = null;
            }
            if (comparisonChartInstance.current) {
                comparisonChartInstance.current.destroy();
                comparisonChartInstance.current = null;
            }

            // Create Top SKUs bar chart
            if (topSKUsChartRef.current && chartData.topSKUs.length > 0) {
                const ctx = topSKUsChartRef.current.getContext('2d');

                topSKUsChartInstance.current = new ChartLib(ctx, {
                    type: 'bar',
                    data: {
                        labels: chartData.topSKUs.map(item => item.sku),
                        datasets: [{
                            label: 'Revenue',
                            data: chartData.topSKUs.map(item => item.revenue),
                            backgroundColor: chartData.topSKUs.map((item) => {
                                const targetData = calculateSKUTargetContribution.get(item.sku);
                                if (targetData) {
                                    if (targetData.performancePercent >= 100) return THEME.success + 'B3'; // 70% opacity
                                    if (targetData.performancePercent >= 85) return THEME.warning + 'B3';
                                    return THEME.error + 'B3';
                                }
                                return THEME.primary + 'B3';
                            }),
                            borderColor: chartData.topSKUs.map((item) => {
                                const targetData = calculateSKUTargetContribution.get(item.sku);
                                if (targetData) {
                                    if (targetData.performancePercent >= 100) return THEME.success;
                                    if (targetData.performancePercent >= 85) return THEME.warning;
                                    return THEME.error;
                                }
                                return THEME.primary;
                            }),
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        const value = context.parsed.x;
                                        const contribution = totalRevenue > 0
                                            ? ((value / totalRevenue) * 100).toFixed(1)
                                            : '0.0';
                                        return `${formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`} (${contribution}%)`;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                beginAtZero: true,
                                grid: { color: THEME.gridLines },
                                ticks: {
                                    callback: function (value) {
                                        return formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`;
                                    },
                                    font: { size: 10 }
                                }
                            },
                            y: {
                                grid: { display: false },
                                ticks: { font: { size: 10 } }
                            }
                        }
                    }
                });
            }

            // Create SKU contribution pie chart
            if (contributionChartRef.current && chartData.top10.length > 0) {
                const ctx = contributionChartRef.current.getContext('2d');

                const pieLabels = [...chartData.top10.map(item => item.sku)];
                const pieData = [...chartData.top10.map(item => item.revenue)];
                const pieColors = [
                    THEME.primary, THEME.warning, THEME.success, THEME.error, THEME.secondary,
                    THEME.info, '#ec4899', '#84cc16', '#f97316', '#6366f1'
                ];

                if (chartData.othersRevenue > 0) {
                    pieLabels.push('Others');
                    pieData.push(chartData.othersRevenue);
                    pieColors.push('#9ca3af');
                }

                contributionChartInstance.current = new ChartLib(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: pieLabels,
                        datasets: [{
                            data: pieData,
                            backgroundColor: pieColors,
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
                                    padding: 15,
                                    font: { size: 11 }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        const value = context.parsed;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return `${context.label}: ${formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`} (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }

            // Create Revenue Trend Chart
            if (trendChartRef.current && trendData && trendData.length > 0) {
                const ctx = trendChartRef.current.getContext('2d');

                const skusToShow = selectedSKUsForTrend.length > 0
                    ? selectedSKUsForTrend
                    : chartData?.topSKUs?.slice(0, 5).map(item => item.sku) || [];

                if (skusToShow.length > 0) {
                    const labels = trendData.map(item => {
                        const date = new Date(item.date);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    });

                    const colors = [
                        THEME.primary, THEME.warning, THEME.success, THEME.error, THEME.secondary,
                        THEME.info, '#ec4899', '#84cc16', '#f97316', '#6366f1'
                    ];

                    const datasets = skusToShow.map((sku, idx) => {
                        const skuData = trendData.map(item => {
                            const skuInfo = item.skus.find(s => s.sku === sku);
                            return skuInfo ? skuInfo.revenue : 0;
                        });

                        return {
                            label: sku,
                            data: skuData,
                            borderColor: colors[idx % colors.length],
                            backgroundColor: colors[idx % colors.length] + '20',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.4,
                            pointRadius: 2
                        };
                    });

                    trendChartInstance.current = new ChartLib(ctx, {
                        type: 'line',
                        data: { labels, datasets },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: {
                                mode: 'index',
                                intersect: false
                            },
                            plugins: {
                                legend: {
                                    position: 'top',
                                    labels: { usePointStyle: true, padding: 15, font: { size: 11 } }
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function (context) {
                                            const value = context.parsed.y;
                                            return `${context.dataset.label}: ${formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`}`;
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    display: true,
                                    grid: { display: false },
                                    ticks: { font: { size: 10 } }
                                },
                                y: {
                                    beginAtZero: true,
                                    grid: { color: THEME.gridLines },
                                    ticks: {
                                        callback: function (value) {
                                            return formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`;
                                        },
                                        font: { size: 10 }
                                    }
                                }
                            }
                        }
                    });
                }
            }

            // Create Comparison Chart
            if (comparisonChartRef.current && comparisonMode && comparisonData && comparisonData.merged && comparisonData.merged.length > 0) {
                const ctx = comparisonChartRef.current.getContext('2d');

                const topSKUsForComparison = comparisonData.merged
                    .slice()
                    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                    .slice(0, 10);

                if (topSKUsForComparison.length > 0) {
                    const labels = topSKUsForComparison.map(item => item.sku);
                    const currentData = topSKUsForComparison.map(item => item.revenue || 0);
                    const comparisonDataValues = topSKUsForComparison.map(item =>
                        item.comparison ? (item.comparison.revenue || 0) : 0
                    );

                    comparisonChartInstance.current = new ChartLib(ctx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [
                                {
                                    label: 'Current Period',
                                    data: currentData,
                                    backgroundColor: THEME.primary + 'B3',
                                    borderColor: THEME.primary,
                                    borderWidth: 1
                                },
                                {
                                    label: 'Comparison Period',
                                    data: comparisonDataValues,
                                    backgroundColor: '#9ca3afB3',
                                    borderColor: '#9ca3af',
                                    borderWidth: 1
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { position: 'top' },
                                tooltip: {
                                    callbacks: {
                                        label: function (context) {
                                            const value = context.parsed.y;
                                            const datasetLabel = context.dataset.label;
                                            const item = topSKUsForComparison[context.dataIndex];

                                            if (datasetLabel === 'Current Period') {
                                                const growth = item.comparison ? item.comparison.growthPercent : null;
                                                if (growth !== null) {
                                                    return `${datasetLabel}: ${formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`} (${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%)`;
                                                }
                                            }
                                            return `${datasetLabel}: ${formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`}`;
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    grid: { color: THEME.gridLines },
                                    ticks: {
                                        callback: function (value) {
                                            return formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`;
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }

            return () => {
                if (topSKUsChartInstance.current) topSKUsChartInstance.current.destroy();
                if (contributionChartInstance.current) contributionChartInstance.current.destroy();
                if (trendChartInstance.current) trendChartInstance.current.destroy();
                if (comparisonChartInstance.current) comparisonChartInstance.current.destroy();
            };
        }, [chartData, loading, totalRevenue, formatCurrency, calculateSKUTargetContribution, trendData, selectedSKUsForTrend, view, comparisonMode, comparisonData]);

        // Loading state
        if (loading) {
            return h('div', { className: 'sku-performance-container' },
                h('div', { className: 'loading-container' },
                    h('div', { className: 'loading-spinner' }),
                    h('div', { className: 'loading-text' }, 'Loading SKU performance data...')
                )
            );
        }

        // Error state
        if (error) {
            return h('div', { className: 'sku-performance-container' },
                h('div', { className: 'error-container' },
                    h('h2', null, 'Error'),
                    h('p', null, error),
                    h('button', {
                        className: 'btn-back',
                        onClick: () => window.location.reload()
                    }, 'Retry')
                )
            );
        }

        // Main render
        return h('div', { className: 'sku-performance-container' },
            // Header
            h('div', { className: 'sku-performance-header' },
                h('button', {
                    className: 'btn-back',
                    onClick: onNavigateBack || (() => window.history.back())
                }, '← Back to Dashboard'),
                h('div', { className: 'breadcrumb' },
                    h('span', null, 'Dashboard'),
                    h('span', null, '›'),
                    h('span', null, channel),
                    h('span', null, '›'),
                    h('span', { className: 'current' }, 'SKU Performance')
                )
            ),

            // Page Title - Styled like Dashboard
            h('div', { className: 'page-header' },
                h('div', { className: 'page-title' },
                    h('h1', null, `SKU Performance: ${channel}`),
                    h('div', { className: 'page-subtitle' },
                        brand ? `Brand: ${brand}` : 'All Brands'
                    )
                )
            ),

            // Filters Section
            h('div', { className: 'filter-controls' },
                h('div', { className: 'filter-group search-box' },
                    h('input', {
                        type: 'text',
                        placeholder: 'Search SKUs...',
                        value: searchQuery,
                        onChange: (e) => setSearchQuery(e.target.value),
                        className: 'search-input'
                    })
                ),
                h('div', { className: 'filter-group sort-box' },
                    h('select', {
                        value: sortConfig.key,
                        onChange: (e) => handleSortChange(e.target.value),
                        className: 'sort-select'
                    },
                        h('option', { value: 'revenue' }, 'Revenue'),
                        h('option', { value: 'units' }, 'Units'),
                        h('option', { value: 'contribution' }, 'Contribution'),
                        h('option', { value: 'sku' }, 'SKU Name')
                    ),
                    h('button', {
                        className: 'sort-order-btn',
                        onClick: () => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' })),
                        title: sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'
                    }, sortConfig.direction === 'asc' ? '↑' : '↓')
                ),

                // Date Range
                h('div', { className: 'date-range-selector' },
                    h('div', { className: 'quick-selectors' },
                        ['7d', '30d', '90d', 'YTD'].map(range =>
                            h('button', {
                                key: range,
                                className: `quick-date-btn ${dateRange.period === range ? 'active' : ''}`,
                                onClick: () => setDateRange(prev => ({ ...prev, period: range }))
                            }, range)
                        )
                    ),
                    h('div', { className: 'custom-date-inputs' },
                        h('input', {
                            type: 'date',
                            value: dateRange.startDate,
                            onChange: (e) => setDateRange(prev => ({ ...prev, startDate: e.target.value, period: 'custom' })),
                            className: 'date-input'
                        }),
                        h('span', null, 'to'),
                        h('input', {
                            type: 'date',
                            value: dateRange.endDate,
                            onChange: (e) => setDateRange(prev => ({ ...prev, endDate: e.target.value, period: 'custom' })),
                            className: 'date-input'
                        })
                    )
                ),

                // Comparison Toggle
                h('div', { className: 'comparison-controls' },
                    h('label', { className: 'toggle-label' },
                        h('input', {
                            type: 'checkbox',
                            checked: comparisonMode,
                            onChange: (e) => setComparisonMode(e.target.checked)
                        }),
                        'Compare Period'
                    )
                ),

                // Export Buttons
                h('div', { className: 'export-buttons' },
                    h('button', {
                        className: 'export-btn export-csv',
                        onClick: () => exportData('csv'),
                        disabled: filteredAndSortedData.length === 0
                    }, 'Export CSV'),
                    h('button', {
                        className: 'export-btn export-excel',
                        onClick: () => exportData('excel'),
                        disabled: filteredAndSortedData.length === 0
                    }, 'Export Excel')
                )
            ),

            // Summary Cards
            h('div', { className: 'sku-summary' },
                // Total Revenue
                h('div', { className: 'summary-card' },
                    h('div', { className: 'summary-label' }, 'Total Revenue'),
                    h('div', { className: 'summary-value' },
                        formatCurrency ? formatCurrency(totalRevenue) : `$${totalRevenue.toLocaleString()}`
                    ),
                    comparisonMode && comparisonData && h('div', { className: 'summary-subtitle' },
                        (() => {
                            const growth = comparisonData.summary ? comparisonData.summary.revenueGrowth : 0;
                            const isPos = growth >= 0;
                            return h('span', { style: { color: isPos ? 'var(--success-color)' : 'var(--error-color)' } },
                                `${isPos ? '+' : ''}${growth.toFixed(1)}% vs previous`
                            );
                        })()
                    )
                ),
                // Total Units
                h('div', { className: 'summary-card' },
                    h('div', { className: 'summary-label' }, 'Total Units'),
                    h('div', { className: 'summary-value' }, totalUnits.toLocaleString()),
                    comparisonMode && comparisonData && h('div', { className: 'summary-subtitle' },
                        (() => {
                            const growth = comparisonData.summary ? comparisonData.summary.unitsGrowth : 0;
                            const isPos = growth >= 0;
                            return h('span', { style: { color: isPos ? 'var(--success-color)' : 'var(--error-color)' } },
                                `${isPos ? '+' : ''}${growth.toFixed(1)}% vs previous`
                            );
                        })()
                    )
                ),
                // Avg Price
                h('div', { className: 'summary-card' },
                    h('div', { className: 'summary-label' }, 'Avg Price'),
                    h('div', { className: 'summary-value' },
                        formatCurrency ? formatCurrency(avgPrice) : `$${avgPrice.toFixed(2)}`
                    )
                ),
                // Top Performer
                h('div', { className: 'summary-card' },
                    h('div', { className: 'summary-label' }, 'Top Performer'),
                    h('div', { className: 'summary-value', style: { fontSize: '18px' } },
                        topPerformer ? topPerformer.product_name || topPerformer.sku : '—'
                    ),
                    topPerformer && h('div', { className: 'summary-subtitle' },
                        formatCurrency ? formatCurrency(topPerformer.revenue) : `$${topPerformer.revenue.toLocaleString()}`
                    )
                )
            ),

            // Charts Section
            filteredAndSortedData.length > 0 && h('div', { className: 'charts-grid' },
                h('div', { className: 'chart-card' },
                    h('div', { className: 'chart-header' },
                        h('div', null,
                            h('h3', { className: 'chart-title' }, 'Top Revenue SKUs'),
                            h('p', { className: 'chart-subtitle' }, 'Top 20 performing items')
                        )
                    ),
                    h('div', { className: 'chart-container' },
                        h('canvas', { ref: topSKUsChartRef })
                    )
                ),
                h('div', { className: 'chart-card' },
                    h('div', { className: 'chart-header' },
                        h('div', null,
                            h('h3', { className: 'chart-title' }, 'Revenue Distribution'),
                            h('p', { className: 'chart-subtitle' }, 'Top 10 SKUs vs Others')
                        )
                    ),
                    h('div', { className: 'chart-container' },
                        h('canvas', { ref: contributionChartRef })
                    )
                ),
                trendData && trendData.length > 0 && h('div', { className: 'chart-card', style: { gridColumn: '1 / -1' } },
                    h('div', { className: 'chart-header' },
                        h('div', null,
                            h('h3', { className: 'chart-title' }, 'Revenue Trend'),
                            h('p', { className: 'chart-subtitle' }, 'Performance over time')
                        ),
                        h('div', { className: 'trend-sku-selector' },
                            h('select', {
                                className: 'sku-select-multi',
                                multiple: true,
                                value: selectedSKUsForTrend,
                                onChange: (e) => {
                                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                                    setSelectedSKUsForTrend(selected);
                                }
                            },
                                chartData?.topSKUs?.slice(0, 10).map(item =>
                                    h('option', { key: item.sku, value: item.sku }, item.sku)
                                )
                            )
                        )
                    ),
                    h('div', { className: 'chart-container' },
                        loadingTrend ? h('div', { className: 'loading-spinner' }) :
                            h('canvas', { ref: trendChartRef })
                    )
                )
            ),

            // Data Table
            h('div', {
                className: `sku-table-container ${virtualScrollEnabled ? 'virtual-scroll-enabled' : ''}`,
                ref: tableContainerRef
            },
                filteredAndSortedData.length === 0 ? (
                    h('div', { className: 'empty-state' },
                        h('p', null, searchQuery
                            ? `No SKUs found matching "${searchQuery}"`
                            : 'No SKU data found for the selected period.'
                        )
                    )
                ) : (
                    h('table', {
                        className: 'sku-table',
                        style: virtualScrollEnabled ? {
                            height: `${dataWithComparison.length * 50}px`,
                            position: 'relative',
                            display: 'block'
                        } : {}
                    },
                        h('thead', null,
                            h('tr', null,
                                h('th', { onClick: () => handleSortChange('sku'), style: { cursor: 'pointer' } }, `SKU${getSortIndicator('sku')}`),
                                h('th', null, 'Product Name'),
                                h('th', { onClick: () => handleSortChange('units'), style: { cursor: 'pointer' } }, `Units${getSortIndicator('units')}`),
                                h('th', { onClick: () => handleSortChange('revenue'), style: { cursor: 'pointer' } }, `Revenue${getSortIndicator('revenue')}`),
                                comparisonMode && comparisonData && h('th', null, getComparisonLabel() || 'Growth'),
                                h('th', null, 'Avg Price'),
                                h('th', { onClick: () => handleSortChange('contribution'), style: { cursor: 'pointer' } }, `Contribution${getSortIndicator('contribution')}`),
                                channelTarget85 > 0 && h('th', null, 'Target Status')
                            )
                        ),
                        h('tbody', null,
                            (virtualScrollEnabled ? virtualScrollData : paginatedData).map((item, index) => {
                                const avgPrice = item.units > 0 ? item.revenue / item.units : 0;
                                const contributionPercent = totalRevenue > 0
                                    ? ((item.revenue / totalRevenue) * 100).toFixed(2)
                                    : '0.00';

                                // Growth
                                const growthDisplay = item.comparison ? (() => {
                                    const growthPercent = item.comparison.growthPercent || 0;
                                    const isPositive = growthPercent >= 0;
                                    return h('div', {
                                        className: `growth-cell ${isPositive ? 'positive' : 'negative'}`
                                    },
                                        h('span', null, `${isPositive ? '+' : ''}${growthPercent.toFixed(1)}%`)
                                    );
                                })() : null;

                                // Target Status
                                const targetData = calculateSKUTargetContribution.get(item.sku);
                                const targetStatusDisplay = targetData ? (() => {
                                    const performance = targetData.performancePercent;
                                    let statusClass = 'target-status';
                                    let statusText = '';

                                    if (performance >= 100) {
                                        statusClass += ' exceeding';
                                        statusText = 'Exceeding';
                                    } else if (performance >= 85) {
                                        statusClass += ' on-track';
                                        statusText = 'On Track';
                                    } else {
                                        statusClass += ' underperforming';
                                        statusText = 'Behind';
                                    }

                                    return h('span', { className: statusClass }, statusText);
                                })() : null;

                                const rowStyle = virtualScrollEnabled ? {
                                    position: 'absolute',
                                    top: `${item.virtualIndex * 50}px`,
                                    height: '50px',
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center'
                                } : {};

                                return h('tr', { key: item.sku, style: rowStyle },
                                    h('td', { className: 'sku-code' }, item.sku),
                                    h('td', { className: 'product-name' }, item.product_name || '—'),
                                    h('td', null, item.units.toLocaleString()),
                                    h('td', { className: 'revenue-cell' },
                                        formatCurrency
                                            ? formatCurrency(item.revenue)
                                            : `$${item.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                    ),
                                    comparisonMode && comparisonData && h('td', null, growthDisplay || '—'),
                                    h('td', null,
                                        formatCurrency
                                            ? formatCurrency(avgPrice)
                                            : `$${avgPrice.toFixed(2)}`
                                    ),
                                    h('td', null, `${contributionPercent}%`),
                                    channelTarget85 > 0 && h('td', null, targetStatusDisplay || '—')
                                );
                            })
                        )
                    )
                ),

                // Pagination
                filteredAndSortedData.length > itemsPerPage && h('div', { className: 'pagination-controls' },
                    h('div', { className: 'pagination-info' },
                        `Showing ${startIndex + 1}-${Math.min(endIndex, dataWithComparison.length)} of ${dataWithComparison.length} SKUs`
                    ),
                    h('div', { className: 'pagination-buttons' },
                        h('button', {
                            className: 'pagination-btn',
                            onClick: () => setCurrentPage(prev => Math.max(1, prev - 1)),
                            disabled: currentPage === 1
                        }, 'Previous'),
                        h('div', { style: { display: 'flex', gap: '4px' } },
                            Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (currentPage <= 3) pageNum = i + 1;
                                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;

                                return h('button', {
                                    key: pageNum,
                                    className: `page-btn ${currentPage === pageNum ? 'active' : ''}`,
                                    onClick: () => setCurrentPage(pageNum)
                                }, pageNum);
                            })
                        ),
                        h('button', {
                            className: 'pagination-btn',
                            onClick: () => setCurrentPage(prev => Math.min(totalPages, prev + 1)),
                            disabled: currentPage === totalPages
                        }, 'Next')
                    ),
                    h('div', { className: 'pagination-settings' },
                        h('label', { className: 'items-per-page-label' },
                            'Show',
                            h('select', {
                                className: 'items-per-page-select',
                                value: itemsPerPage,
                                onChange: (e) => {
                                    setItemsPerPage(parseInt(e.target.value));
                                    setCurrentPage(1);
                                }
                            },
                                h('option', { value: 25 }, '25'),
                                h('option', { value: 50 }, '50'),
                                h('option', { value: 100 }, '100')
                            )
                        ),
                        h('label', { className: 'virtual-scroll-label' },
                            h('input', {
                                type: 'checkbox',
                                checked: virtualScrollEnabled,
                                onChange: (e) => setVirtualScrollEnabled(e.target.checked)
                            }),
                            'Virtual Scroll'
                        )
                    )
                )
            )
        );
    }

    // Make available globally
    window.SKUPerformance = SKUPerformance;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.SKUPerformance = SKUPerformance;
})();
