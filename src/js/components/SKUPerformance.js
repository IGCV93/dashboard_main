/**
 * SKU Performance Component
 * Shows SKU-level sales performance for a specific channel
 */

(function() {
    'use strict';
    
    function SKUPerformance(props) {
        const { useState, useEffect, useMemo, useRef, createElement: h } = React;
        
        // Add debug logging
        console.log('🎯 SKUPerformance component mounted with props:', {
            channel: props.channel,
            brand: props.brand,
            view: props.view,
            selectedYear: props.selectedYear,
            hasDataService: !!props.dataService,
            propsKeys: Object.keys(props)
        });
        
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
        // Use useCallback to get a stable function reference
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
                console.log('🔄 SKUPerformance loadData starting...', { channel, brand, hasDataService: !!dataService });
                
                if (!dataService || !channel) {
                    const errorMsg = 'Missing required data service or channel';
                    console.error('❌ SKUPerformance:', errorMsg, { dataService: !!dataService, channel });
                    setError(errorMsg);
                    setLoading(false);
                    return;
                }
                
                try {
                    setLoading(true);
                    setError(null);
                    console.log('📅 Getting effective date range...');
                    
                    // Get effective date range
                    const dateRange = getEffectiveDateRange();
                    console.log('📅 Date range:', dateRange);
                    
                    if (!dateRange.start || !dateRange.end) {
                        console.error('❌ Invalid date range:', dateRange);
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
                    
                    console.log('🔍 Loading SKU data with filters:', filters);
                    const data = await dataService.loadSKUData(filters);
                    console.log('✅ SKU data loaded:', { rowCount: data.length, sample: data[0] });
                    
                    setSkuData(data);
                    
                    // Calculate totals
                    const total = data.reduce((sum, item) => sum + (item.revenue || 0), 0);
                    const units = data.reduce((sum, item) => sum + (item.units || 0), 0);
                    console.log('📊 Totals calculated:', { revenue: total, units: units });
                    setTotalRevenue(total);
                    setTotalUnits(units);
                    
                } catch (err) {
                    console.error('❌ Failed to load SKU data:', err);
                    setError('Failed to load SKU data. Please try again.');
                } finally {
                    console.log('✅ Loading complete, setting loading=false');
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
            console.log('🔍 Filtering SKU data:', {
                skuDataLength: skuData.length,
                selectedBrandFilter,
                searchQuery,
                firstItem: skuData[0]
            });
            
            let filtered = [...skuData];
            
            // Apply brand filter
            if (selectedBrandFilter && selectedBrandFilter !== 'All Brands') {
                console.log(`🔍 Applying brand filter: "${selectedBrandFilter}"`);
                filtered = filtered.filter(item => item.brand === selectedBrandFilter);
                console.log(`🔍 After brand filter: ${filtered.length} items`);
            }
            
            // Apply search filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                console.log(`🔍 Applying search filter: "${query}"`);
                filtered = filtered.filter(item => {
                    const skuMatch = item.sku.toLowerCase().includes(query);
                    const productMatch = item.product_name 
                        ? item.product_name.toLowerCase().includes(query)
                        : false;
                    return skuMatch || productMatch;
                });
                console.log(`🔍 After search filter: ${filtered.length} items`);
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
            
            console.log(`🔍 Final filtered data: ${filtered.length} items (sorted by ${sortBy} ${sortOrder})`);
            return filtered;
        }, [skuData, searchQuery, selectedBrandFilter, sortBy, sortOrder, totalRevenue]);
        
        // Handle search input with debouncing
        const handleSearchChange = (e) => {
            const value = e.target.value;
            setSearchQuery(value);
            
            // Clear existing timeout
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
            
            // Debounce search (optional - for very large datasets)
            // For now, we'll filter immediately since it's client-side
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
                    // Escape commas and quotes in CSV
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
        
        const exportToExcel = () => {
            if (dataWithComparison.length === 0) {
                alert('No data to export');
                return;
            }
            
            // Check if XLSX is available
            if (typeof XLSX === 'undefined') {
                alert('Excel export requires XLSX library. Falling back to CSV.');
                exportToCSV();
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
                    item.revenue,
                    avgPrice,
                    parseFloat(contributionPercent)
                ];
                
                if (comparisonMode && comparisonData) {
                    const growth = item.comparison ? (item.comparison.growthPercent || 0) : null;
                    const growthAmount = item.comparison ? (item.comparison.growthAmount || 0) : null;
                    row.push(growth, growthAmount);
                }
                
                if (channelTarget85 > 0) {
                    const targetData = calculateSKUTargetContribution.get(item.sku);
                    const status = targetData ? (targetData.performancePercent >= 100 ? 'Exceeding' : 
                        targetData.performancePercent >= 85 ? 'On Track' : 'Behind') : '';
                    const performance = targetData ? targetData.performancePercent : null;
                    row.push(status, performance);
                }
                
                return row;
            });
            
            // Create workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            
            // Set column widths
            const colWidths = [
                { wch: 15 }, // SKU
                { wch: 25 }, // Product Name
                { wch: 15 }, // Brand
                { wch: 10 }, // Units
                { wch: 15 }, // Revenue
                { wch: 12 }, // Avg Price
                { wch: 15 }, // Contribution %
            ];
            if (comparisonMode && comparisonData) {
                colWidths.push({ wch: 12 }, { wch: 15 }); // Growth %, Growth Amount
            }
            if (channelTarget85 > 0) {
                colWidths.push({ wch: 15 }, { wch: 15 }); // Target Status, Performance %
            }
            ws['!cols'] = colWidths;
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, 'SKU Performance');
            
            // Download
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `sku_performance_${channel}_${dateStr}.xlsx`);
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
            
            const rowHeight = 50; // Estimated row height in pixels
            const containerHeight = 600; // Table container height
            const bufferRows = 5; // Extra rows to render above/below visible area
            
            const start = Math.max(0, visibleRange.start - bufferRows);
            const end = Math.min(dataWithComparison.length, visibleRange.end + bufferRows);
            
            return dataWithComparison.slice(start, end).map((item, idx) => ({
                ...item,
                virtualIndex: start + idx
            }));
        }, [virtualScrollEnabled, dataWithComparison, visibleRange]);
        
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
        
        // Calculate target contribution for each SKU (based on historical average)
        // For now, we'll use equal distribution as a placeholder
        // In future, this can be enhanced with actual historical data
        const calculateSKUTargetContribution = useMemo(() => {
            if (!channelTarget85 || channelTarget85 === 0 || skuData.length === 0) {
                return new Map();
            }
            
            // Calculate historical average % for each SKU
            // For now, use equal distribution - in future, load historical data
            const avgContributionPercent = 100 / skuData.length;
            const targetMap = new Map();
            
            skuData.forEach(item => {
                // Use current contribution % as proxy for historical average
                const currentContribution = totalRevenue > 0 
                    ? (item.revenue / totalRevenue) * 100
                    : avgContributionPercent;
                
                // Use current contribution % or fallback to average
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
            
            // Top SKUs for bar chart (top 20)
            const topSKUs = filteredAndSortedData
                .slice()
                .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                .slice(0, 20);
            
            // SKU contribution for pie chart (top 10 + others)
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
            
            // Check if Chart.js is available
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
                            backgroundColor: chartData.topSKUs.map((item, idx) => {
                                // Color based on performance if target data available
                                const targetData = calculateSKUTargetContribution.get(item.sku);
                                if (targetData) {
                                    if (targetData.performancePercent >= 100) return 'rgba(5, 150, 105, 0.7)';
                                    if (targetData.performancePercent >= 85) return 'rgba(217, 119, 6, 0.7)';
                                    return 'rgba(220, 38, 38, 0.7)';
                                }
                                return 'rgba(102, 126, 234, 0.7)';
                            }),
                            borderColor: chartData.topSKUs.map((item, idx) => {
                                const targetData = calculateSKUTargetContribution.get(item.sku);
                                if (targetData) {
                                    if (targetData.performancePercent >= 100) return 'rgb(5, 150, 105)';
                                    if (targetData.performancePercent >= 85) return 'rgb(217, 119, 6)';
                                    return 'rgb(220, 38, 38)';
                                }
                                return 'rgb(102, 126, 234)';
                            }),
                            borderWidth: 2
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
                                    label: function(context) {
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
                                ticks: {
                                    callback: function(value) {
                                        return formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`;
                                    }
                                }
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
                    '#667eea', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
                    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
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
                                    font: {
                                        size: 11
                                    }
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
                        }
                    }
                });
            }
            
            // Create Revenue Trend Chart
            if (trendChartRef.current && trendData && trendData.length > 0) {
                const ctx = trendChartRef.current.getContext('2d');
                
                // Get top SKUs for trend (if none selected, use top 5)
                const skusToShow = selectedSKUsForTrend.length > 0 
                    ? selectedSKUsForTrend 
                    : chartData?.topSKUs?.slice(0, 5).map(item => item.sku) || [];
                
                if (skusToShow.length > 0) {
                    // Prepare labels (dates)
                    const labels = trendData.map(item => {
                        const date = new Date(item.date);
                        if (view === 'annual') {
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        } else if (view === 'monthly') {
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        } else {
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        }
                    });
                    
                    // Prepare datasets for each SKU
                    const colors = [
                        '#667eea', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
                        '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
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
                            tension: 0.4
                        };
                    });
                    
                    trendChartInstance.current = new ChartLib(ctx, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: datasets
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
                                    position: 'top',
                                    labels: {
                                        usePointStyle: true,
                                        padding: 15,
                                        font: {
                                            size: 11
                                        }
                                    }
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            const value = context.parsed.y;
                                            return `${context.dataset.label}: ${formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`}`;
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    display: true,
                                    title: {
                                        display: true,
                                        text: 'Date'
                                    }
                                },
                                y: {
                                    beginAtZero: true,
                                    title: {
                                        display: true,
                                        text: 'Revenue'
                                    },
                                    ticks: {
                                        callback: function(value) {
                                            return formatCurrency ? formatCurrency(value) : `$${value.toLocaleString()}`;
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }
            
            // Create Comparison Chart (side-by-side bars)
            if (comparisonChartRef.current && comparisonMode && comparisonData && comparisonData.merged && comparisonData.merged.length > 0) {
                const ctx = comparisonChartRef.current.getContext('2d');
                
                // Get top 10 SKUs for comparison
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
                                    backgroundColor: 'rgba(102, 126, 234, 0.7)',
                                    borderColor: 'rgb(102, 126, 234)',
                                    borderWidth: 2
                                },
                                {
                                    label: 'Comparison Period',
                                    data: comparisonDataValues,
                                    backgroundColor: 'rgba(156, 163, 175, 0.7)',
                                    borderColor: 'rgb(156, 163, 175)',
                                    borderWidth: 2
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'top',
                                    labels: {
                                        usePointStyle: true,
                                        padding: 15,
                                        font: {
                                            size: 11
                                        }
                                    }
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
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
                                x: {
                                    display: true,
                                    title: {
                                        display: true,
                                        text: 'SKU'
                                    }
                                },
                                y: {
                                    beginAtZero: true,
                                    title: {
                                        display: true,
                                        text: 'Revenue'
                                    },
                                    ticks: {
                                        callback: function(value) {
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
                if (topSKUsChartInstance.current) {
                    topSKUsChartInstance.current.destroy();
                }
                if (contributionChartInstance.current) {
                    contributionChartInstance.current.destroy();
                }
                if (trendChartInstance.current) {
                    trendChartInstance.current.destroy();
                }
                if (comparisonChartInstance.current) {
                    comparisonChartInstance.current.destroy();
                }
            };
        }, [chartData, loading, totalRevenue, formatCurrency, calculateSKUTargetContribution, trendData, selectedSKUsForTrend, view, comparisonMode, comparisonData]);
        
        // Debug render state
        console.log('🎨 Rendering SKUPerformance:', { loading, error, skuDataCount: skuData.length });
        
        // Loading state
        if (loading) {
            console.log('📦 Showing loading state');
            return h('div', { className: 'sku-performance-container' },
                h('div', { className: 'loading-container' },
                    h('div', { className: 'loading-spinner' }),
                    h('div', { className: 'loading-text' }, 'Loading SKU performance data...')
                )
            );
        }
        
        // Error state
        if (error) {
            console.log('❌ Showing error state:', error);
            return h('div', { className: 'sku-performance-container' },
                h('div', { className: 'error-container' },
                    h('h2', null, 'Error'),
                    h('p', null, error),
                    h('button', {
                        className: 'btn btn-primary',
                        onClick: () => window.location.reload()
                    }, 'Retry')
                )
            );
        }
        
        // Main render
        console.log('🎨 Rendering main SKU performance view with', skuData.length, 'SKUs');
        return h('div', { className: 'sku-performance-container' },
            // Header with breadcrumb
            h('div', { className: 'sku-performance-header' },
                h('button', {
                    className: 'btn-back',
                    onClick: onNavigateBack || (() => window.history.back())
                }, '← Back'),
                h('div', { className: 'breadcrumb' },
                    h('span', null, 'Dashboard'),
                    h('span', null, '→'),
                    h('span', null, channel),
                    h('span', null, '→'),
                    h('span', { className: 'current' }, 'SKU Performance')
                )
            ),
            
            // Page title
            h('div', { className: 'page-header' },
                h('h1', null, `SKU Performance: ${channel}`),
                h('p', { className: 'page-subtitle' }, 
                    brand ? `Brand: ${brand}` : 'All Brands'
                )
            ),
            
            // Filters section
            h('div', { className: 'sku-filters' },
                h('div', { className: 'filters-row' },
                    h('div', { className: 'filter-group' },
                        h('label', { className: 'filter-label' }, 'Search SKU:'),
                        h('input', {
                            type: 'text',
                            className: 'search-input',
                            placeholder: 'Search by SKU code or product name...',
                            value: searchQuery,
                            onChange: handleSearchChange
                        })
                    ),
                    availableBrands.length > 1 && h('div', { className: 'filter-group' },
                        h('label', { className: 'filter-label' }, 'Brand:'),
                        h('select', {
                            className: 'sort-select',
                            value: selectedBrandFilter,
                            onChange: (e) => setSelectedBrandFilter(e.target.value)
                        },
                            h('option', { value: 'All Brands' }, 'All Brands'),
                            availableBrands.map(brandName => 
                                h('option', { key: brandName, value: brandName }, brandName)
                            )
                        )
                    ),
                    h('div', { className: 'filter-group' },
                        h('label', { className: 'filter-label' }, 'Sort by:'),
                        h('div', { style: { display: 'flex', gap: '8px' } },
                            h('select', {
                                className: 'sort-select',
                                value: sortBy,
                                onChange: (e) => handleSortChange(e.target.value)
                            },
                                h('option', { value: 'revenue' }, `Revenue${getSortIndicator('revenue')}`),
                                h('option', { value: 'units' }, `Units${getSortIndicator('units')}`),
                                h('option', { value: 'contribution' }, `Contribution %${getSortIndicator('contribution')}`),
                                h('option', { value: 'sku' }, `SKU Code${getSortIndicator('sku')}`)
                            ),
                            h('button', {
                                className: 'sort-order-btn',
                                onClick: () => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'),
                                title: `Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`
                            }, sortOrder === 'asc' ? '↑' : '↓')
                        )
                    ),
                    h('div', { className: 'filter-group' },
                        h('label', { className: 'filter-label' }, 'Compare:'),
                        h('div', { className: 'comparison-buttons' },
                            h('button', {
                                className: `comparison-btn ${comparisonMode === 'yoy' ? 'active' : ''}`,
                                onClick: () => setComparisonMode(comparisonMode === 'yoy' ? null : 'yoy'),
                                disabled: loadingComparison
                            }, 'YOY'),
                            h('button', {
                                className: `comparison-btn ${comparisonMode === 'mom' ? 'active' : ''}`,
                                onClick: () => setComparisonMode(comparisonMode === 'mom' ? null : 'mom'),
                                disabled: loadingComparison || view !== 'monthly'
                            }, 'MOM'),
                            h('button', {
                                className: `comparison-btn ${comparisonMode === 'custom' ? 'active' : ''}`,
                                onClick: () => {
                                    if (comparisonMode === 'custom') {
                                        setComparisonMode(null);
                                    } else {
                                        setComparisonMode('custom');
                                        // Set default custom comparison dates (same period, previous year)
                                        const currentRange = getEffectiveDateRange();
                                        if (currentRange.start && currentRange.end) {
                                            const startDate = new Date(currentRange.start);
                                            const endDate = new Date(currentRange.end);
                                            startDate.setFullYear(startDate.getFullYear() - 1);
                                            endDate.setFullYear(endDate.getFullYear() - 1);
                                            setCustomComparisonStartDate(startDate.toISOString().split('T')[0]);
                                            setCustomComparisonEndDate(endDate.toISOString().split('T')[0]);
                                        }
                                    }
                                },
                                title: 'Compare with custom period'
                            }, 'Custom')
                        )
                    ),
                    h('div', { className: 'filter-group' },
                        h('label', { className: 'filter-label' }, 'Export:'),
                        h('div', { className: 'export-buttons' },
                            h('button', {
                                className: 'export-btn export-csv',
                                onClick: exportToCSV,
                                disabled: dataWithComparison.length === 0,
                                title: 'Export to CSV'
                            }, '📥 CSV'),
                            h('button', {
                                className: 'export-btn export-excel',
                                onClick: exportToExcel,
                                disabled: dataWithComparison.length === 0,
                                title: 'Export to Excel'
                            }, '📊 Excel')
                        )
                    )
                ),
                h('div', { className: 'date-range-section' },
                    h('div', { className: 'date-range-toggle' },
                        h('label', { className: 'toggle-label' },
                            h('input', {
                                type: 'checkbox',
                                checked: useCustomDateRange,
                                onChange: (e) => {
                                    setUseCustomDateRange(e.target.checked);
                                    if (!e.target.checked) {
                                        setCustomStartDate('');
                                        setCustomEndDate('');
                                    }
                                }
                            }),
                            h('span', null, 'Use Custom Date Range')
                        )
                    ),
                    useCustomDateRange && h('div', { className: 'date-range-controls' },
                        h('div', { className: 'quick-selectors' },
                            h('button', {
                                className: 'quick-date-btn',
                                onClick: () => handleQuickDateRange('last7')
                            }, 'Last 7 Days'),
                            h('button', {
                                className: 'quick-date-btn',
                                onClick: () => handleQuickDateRange('last30')
                            }, 'Last 30 Days'),
                            h('button', {
                                className: 'quick-date-btn',
                                onClick: () => handleQuickDateRange('last90')
                            }, 'Last 90 Days'),
                            h('button', {
                                className: 'quick-date-btn',
                                onClick: () => handleQuickDateRange('thisMonth')
                            }, 'This Month'),
                            h('button', {
                                className: 'quick-date-btn',
                                onClick: () => handleQuickDateRange('lastMonth')
                            }, 'Last Month')
                        ),
                        h('div', { className: 'custom-date-inputs' },
                            h('div', { className: 'date-input-group' },
                                h('label', { className: 'date-label' }, 'Start Date:'),
                                h('input', {
                                    type: 'date',
                                    className: 'date-input',
                                    value: customStartDate,
                                    onChange: (e) => setCustomStartDate(e.target.value),
                                    max: customEndDate || new Date().toISOString().split('T')[0]
                                })
                            ),
                            h('div', { className: 'date-input-group' },
                                h('label', { className: 'date-label' }, 'End Date:'),
                                h('input', {
                                    type: 'date',
                                    className: 'date-input',
                                    value: customEndDate,
                                    onChange: (e) => setCustomEndDate(e.target.value),
                                    min: customStartDate,
                                    max: new Date().toISOString().split('T')[0]
                                })
                            )
                        )
                    )
                ),
                comparisonMode && getComparisonLabel() && h('div', { className: 'comparison-label' },
                    h('span', { className: 'comparison-badge' }, getComparisonLabel()),
                    loadingComparison && h('span', { className: 'loading-indicator' }, 'Loading...')
                ),
                comparisonMode === 'custom' && h('div', { className: 'custom-comparison-dates' },
                    h('div', { className: 'custom-date-inputs' },
                        h('div', { className: 'date-input-group' },
                            h('label', { className: 'date-label' }, 'Comparison Start:'),
                            h('input', {
                                type: 'date',
                                className: 'date-input',
                                value: customComparisonStartDate,
                                onChange: (e) => setCustomComparisonStartDate(e.target.value),
                                max: customComparisonEndDate || new Date().toISOString().split('T')[0]
                            })
                        ),
                        h('div', { className: 'date-input-group' },
                            h('label', { className: 'date-label' }, 'Comparison End:'),
                            h('input', {
                                type: 'date',
                                className: 'date-input',
                                value: customComparisonEndDate,
                                onChange: (e) => setCustomComparisonEndDate(e.target.value),
                                min: customComparisonStartDate,
                                max: new Date().toISOString().split('T')[0]
                            })
                        )
                    )
                )
            ),
            
            // Summary section - Basic Stats
            h('div', { className: 'sku-summary' },
                h('div', { className: 'summary-card' },
                    h('div', { className: 'summary-label' }, 'Total SKUs'),
                    h('div', { className: 'summary-value' }, 
                        searchQuery ? filteredAndSortedData.length : skuData.length
                    ),
                    searchQuery && h('div', { className: 'summary-subtitle' }, 
                        `Showing ${filteredAndSortedData.length} of ${skuData.length}`
                    )
                ),
                h('div', { className: 'summary-card' },
                    h('div', { className: 'summary-label' }, 'Total Revenue'),
                    h('div', { className: 'summary-value' }, 
                        formatCurrency 
                            ? formatCurrency(totalRevenue)
                            : `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )
                ),
                h('div', { className: 'summary-card' },
                    h('div', { className: 'summary-label' }, 'Total Units'),
                    h('div', { className: 'summary-value' }, totalUnits.toLocaleString())
                ),
                h('div', { className: 'summary-card' },
                    h('div', { className: 'summary-label' }, 'Avg Price'),
                    h('div', { className: 'summary-value' }, 
                        totalUnits > 0
                            ? formatCurrency
                                ? formatCurrency(totalRevenue / totalUnits)
                                : `$${(totalRevenue / totalUnits).toFixed(2)}`
                            : '$0.00'
                    )
                )
            ),
            
            // Enhanced Summary Cards - Insights
            filteredAndSortedData.length > 0 && h('div', { className: 'sku-insights' },
                // Top Performers
                h('div', { className: 'insight-card' },
                    h('div', { className: 'insight-header' },
                        h('h3', { className: 'insight-title' }, '🏆 Top Performers'),
                        h('span', { className: 'insight-subtitle' }, 'Top 5 by Revenue')
                    ),
                    h('div', { className: 'insight-list' },
                        skuData
                            .slice()
                            .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                            .slice(0, 5)
                            .map((item, idx) => {
                                const contribution = totalRevenue > 0 
                                    ? ((item.revenue / totalRevenue) * 100).toFixed(1)
                                    : '0.0';
                                return h('div', { key: idx, className: 'insight-item' },
                                    h('div', { className: 'insight-rank' }, `#${idx + 1}`),
                                    h('div', { className: 'insight-content' },
                                        h('div', { className: 'insight-name' }, item.sku),
                                        h('div', { className: 'insight-meta' }, 
                                            formatCurrency 
                                                ? formatCurrency(item.revenue)
                                                : `$${item.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                            h('span', { className: 'insight-contribution' }, ` • ${contribution}%`)
                                        )
                                    )
                                );
                            })
                    )
                ),
                
                // Growth Leaders (only if comparison data available)
                comparisonMode && comparisonData && comparisonData.merged && comparisonData.merged.length > 0 && h('div', { className: 'insight-card' },
                    h('div', { className: 'insight-header' },
                        h('h3', { className: 'insight-title' }, '📈 Growth Leaders'),
                        h('span', { className: 'insight-subtitle' }, 'Top 5 by Growth %')
                    ),
                    h('div', { className: 'insight-list' },
                        comparisonData.merged
                            .filter(item => item.comparison && item.comparison.growthPercent > 0)
                            .sort((a, b) => (b.comparison.growthPercent || 0) - (a.comparison.growthPercent || 0))
                            .slice(0, 5)
                            .map((item, idx) => {
                                const growthPercent = item.comparison.growthPercent || 0;
                                return h('div', { key: idx, className: 'insight-item' },
                                    h('div', { className: 'insight-rank' }, `#${idx + 1}`),
                                    h('div', { className: 'insight-content' },
                                        h('div', { className: 'insight-name' }, item.sku),
                                        h('div', { className: 'insight-meta' }, 
                                            h('span', { className: 'insight-growth', style: { color: '#059669', fontWeight: 600 } }, `+${growthPercent.toFixed(1)}%`),
                                            h('span', { style: { color: '#6b7280', marginLeft: '8px' } }, 
                                                formatCurrency 
                                                    ? formatCurrency(item.revenue)
                                                    : `$${item.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                            )
                                        )
                                    )
                                );
                            })
                    )
                ),
                
                // Underperformers (only if target data available)
                channelTarget85 > 0 && calculateSKUTargetContribution.size > 0 && h('div', { className: 'insight-card' },
                    h('div', { className: 'insight-header' },
                        h('h3', { className: 'insight-title' }, '⚠️ Underperformers'),
                        h('span', { className: 'insight-subtitle' }, 'SKUs Below Target')
                    ),
                    h('div', { className: 'insight-list' },
                        skuData
                            .map(item => {
                                const targetData = calculateSKUTargetContribution.get(item.sku);
                                return targetData ? { ...item, targetData } : null;
                            })
                            .filter(item => item && item.targetData.performancePercent < 85)
                            .sort((a, b) => (a.targetData.performancePercent || 0) - (b.targetData.performancePercent || 0))
                            .slice(0, 5)
                            .map((item, idx) => {
                                const performance = item.targetData.performancePercent;
                                const gap = item.targetData.gap;
                                return h('div', { key: idx, className: 'insight-item' },
                                    h('div', { className: 'insight-rank', style: { color: '#dc2626' } }, `#${idx + 1}`),
                                    h('div', { className: 'insight-content' },
                                        h('div', { className: 'insight-name' }, item.sku),
                                        h('div', { className: 'insight-meta' }, 
                                            h('span', { style: { color: '#dc2626', fontWeight: 600 } }, `${performance.toFixed(0)}% of target`),
                                            gap > 0 && h('span', { style: { color: '#6b7280', marginLeft: '8px' } }, 
                                                `Need: ${formatCurrency ? formatCurrency(gap) : `$${gap.toLocaleString()}`}`
                                            )
                                        )
                                    )
                                );
                            })
                    )
                ),
                
                // Channel Summary
                h('div', { className: 'insight-card' },
                    h('div', { className: 'insight-header' },
                        h('h3', { className: 'insight-title' }, '📊 Channel Summary')
                    ),
                    h('div', { className: 'insight-stats' },
                        h('div', { className: 'insight-stat' },
                            h('div', { className: 'insight-stat-label' }, 'Top SKU Contribution'),
                            h('div', { className: 'insight-stat-value' }, 
                                filteredAndSortedData.length > 0 
                                    ? `${((Math.max(...filteredAndSortedData.map(s => s.revenue || 0)) / totalRevenue) * 100).toFixed(1)}%`
                                    : '0%'
                            )
                        ),
                        h('div', { className: 'insight-stat' },
                            h('div', { className: 'insight-stat-label' }, 'Avg Revenue per SKU'),
                            h('div', { className: 'insight-stat-value' }, 
                                filteredAndSortedData.length > 0
                                    ? formatCurrency
                                        ? formatCurrency(totalRevenue / filteredAndSortedData.length)
                                        : `$${(totalRevenue / filteredAndSortedData.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : '$0.00'
                            )
                        ),
                        h('div', { className: 'insight-stat' },
                            h('div', { className: 'insight-stat-label' }, 'Avg Units per SKU'),
                            h('div', { className: 'insight-stat-value' }, 
                                filteredAndSortedData.length > 0
                                    ? Math.round(totalUnits / filteredAndSortedData.length).toLocaleString()
                                    : '0'
                            )
                        )
                    )
                )
            ),
            
            // Charts section
            filteredAndSortedData.length > 0 && h('div', { className: 'sku-charts-section' },
                h('div', { className: 'chart-card' },
                    h('div', { className: 'chart-header' },
                        h('h3', { className: 'chart-title' }, '📊 Top SKUs by Revenue'),
                        h('p', { className: 'chart-subtitle' }, 'Top 20 performing SKUs')
                    ),
                    h('div', { className: 'chart-container', style: { height: '400px' } },
                        h('canvas', { ref: topSKUsChartRef })
                    )
                ),
                h('div', { className: 'chart-card' },
                    h('div', { className: 'chart-header' },
                        h('h3', { className: 'chart-title' }, '🥧 SKU Contribution'),
                        h('p', { className: 'chart-subtitle' }, 'Revenue distribution across SKUs')
                    ),
                    h('div', { className: 'chart-container', style: { height: '400px' } },
                        h('canvas', { ref: contributionChartRef })
                    )
                ),
                trendData && trendData.length > 0 && h('div', { className: 'chart-card', style: { gridColumn: '1 / -1' } },
                    h('div', { className: 'chart-header' },
                        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' } },
                            h('div', null,
                                h('h3', { className: 'chart-title' }, '📈 Revenue Trend'),
                                h('p', { className: 'chart-subtitle' }, 'Revenue trends over time (Top 5 SKUs)')
                            ),
                            h('div', { className: 'trend-sku-selector' },
                                h('select', {
                                    className: 'sku-select-multi',
                                    multiple: true,
                                    value: selectedSKUsForTrend,
                                    onChange: (e) => {
                                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                                        setSelectedSKUsForTrend(selected);
                                    },
                                    style: { minWidth: '200px', fontSize: '12px', padding: '4px' }
                                },
                                    chartData?.topSKUs?.slice(0, 10).map(item => 
                                        h('option', { key: item.sku, value: item.sku }, item.sku)
                                    )
                                )
                            )
                        )
                    ),
                    h('div', { className: 'chart-container', style: { height: '400px' } },
                        loadingTrend ? h('div', { style: { textAlign: 'center', padding: '40px', color: '#6b7280' } }, 'Loading trend data...') :
                        h('canvas', { ref: trendChartRef })
                    )
                ),
                comparisonMode && comparisonData && comparisonData.merged && comparisonData.merged.length > 0 && h('div', { className: 'chart-card', style: { gridColumn: '1 / -1' } },
                    h('div', { className: 'chart-header' },
                        h('h3', { className: 'chart-title' }, '📊 Period Comparison'),
                        h('p', { className: 'chart-subtitle' }, `Current vs ${getComparisonLabel() || 'Comparison Period'} - Top 10 SKUs`)
                    ),
                    h('div', { className: 'chart-container', style: { height: '400px' } },
                        h('canvas', { ref: comparisonChartRef })
                    )
                )
            ),
            
            // Data table
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
                        className: `sku-table ${virtualScrollEnabled ? 'virtual-scroll-table' : ''}`,
                        style: virtualScrollEnabled ? {
                            height: `${dataWithComparison.length * 50}px`,
                            position: 'relative'
                        } : {}
                    },
                        h('thead', { style: virtualScrollEnabled ? { position: 'sticky', top: 0, zIndex: 10, background: 'white' } : {} },
                            h('tr', null,
                                h('th', { 
                                    className: 'sortable-header',
                                    onClick: () => handleSortChange('sku'),
                                    style: { cursor: 'pointer' }
                                }, `SKU${getSortIndicator('sku')}`),
                                h('th', null, 'Product Name'),
                                h('th', { 
                                    className: 'sortable-header',
                                    onClick: () => handleSortChange('units'),
                                    style: { cursor: 'pointer' }
                                }, `Units${getSortIndicator('units')}`),
                                h('th', { 
                                    className: 'sortable-header',
                                    onClick: () => handleSortChange('revenue'),
                                    style: { cursor: 'pointer' }
                                }, `Revenue${getSortIndicator('revenue')}`),
                                comparisonMode && comparisonData && h('th', null, getComparisonLabel() || 'Growth'),
                                h('th', null, 'Avg Price'),
                                h('th', { 
                                    className: 'sortable-header',
                                    onClick: () => handleSortChange('contribution'),
                                    style: { cursor: 'pointer' }
                                }, `Contribution %${getSortIndicator('contribution')}`),
                                channelTarget85 > 0 && h('th', null, 'Target Status')
                            )
                        ),
                        h('tbody', { 
                            style: virtualScrollEnabled ? { 
                                position: 'relative',
                                height: `${dataWithComparison.length * 50}px`
                            } : {}
                        },
                            (virtualScrollEnabled ? virtualScrollData : paginatedData).map((item, index) => {
                                const actualIndex = virtualScrollEnabled ? item.virtualIndex : startIndex + index;
                                const avgPrice = item.units > 0 ? item.revenue / item.units : 0;
                                const contributionPercent = totalRevenue > 0 
                                    ? ((item.revenue / totalRevenue) * 100).toFixed(2)
                                    : '0.00';
                                
                                // Calculate growth if comparison data exists
                                const growthDisplay = item.comparison ? (() => {
                                    const growthPercent = item.comparison.growthPercent || 0;
                                    const growthAmount = item.comparison.growthAmount || 0;
                                    const isPositive = growthPercent >= 0;
                                    return h('div', { 
                                        className: `growth-cell ${isPositive ? 'positive' : 'negative'}`,
                                        title: `${isPositive ? '+' : ''}${growthPercent.toFixed(1)}% (${formatCurrency ? formatCurrency(Math.abs(growthAmount)) : `$${Math.abs(growthAmount).toLocaleString()}`})`
                                    },
                                        h('span', { className: 'growth-arrow' }, isPositive ? '↑' : '↓'),
                                        h('span', null, `${Math.abs(growthPercent).toFixed(1)}%`)
                                    );
                                })() : null;
                                
                                // Get target contribution data
                                const targetData = calculateSKUTargetContribution.get(item.sku);
                                const targetStatusDisplay = targetData ? (() => {
                                    const performance = targetData.performancePercent;
                                    let statusClass = 'target-status';
                                    let statusText = '';
                                    let statusColor = '#6b7280';
                                    
                                    if (performance >= 100) {
                                        statusClass += ' exceeding';
                                        statusText = '✓ Exceeding';
                                        statusColor = '#059669';
                                    } else if (performance >= 85) {
                                        statusClass += ' on-track';
                                        statusText = '✓ On Track';
                                        statusColor = '#d97706';
                                    } else {
                                        statusClass += ' underperforming';
                                        statusText = '⚠ Behind';
                                        statusColor = '#dc2626';
                                    }
                                    
                                    return h('div', { 
                                        className: statusClass,
                                        style: { color: statusColor, fontWeight: 600, fontSize: '12px' },
                                        title: `Target: ${formatCurrency ? formatCurrency(targetData.target) : `$${targetData.target.toLocaleString()}`}, Performance: ${performance.toFixed(1)}%`
                                    }, statusText);
                                })() : null;
                                
                                const rowStyle = virtualScrollEnabled ? {
                                    position: 'absolute',
                                    top: `${item.virtualIndex * 50}px`,
                                    height: '50px',
                                    width: '100%'
                                } : {};
                                
                                return h('tr', { key: virtualScrollEnabled ? item.virtualIndex : index, style: rowStyle },
                                    h('td', { className: 'sku-code' }, item.sku),
                                    h('td', { className: 'product-name' }, item.product_name || '—'),
                                    h('td', null, item.units.toLocaleString()),
                                    h('td', { className: 'revenue-cell' }, 
                                        formatCurrency
                                            ? formatCurrency(item.revenue)
                                            : `$${item.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    ),
                                    comparisonMode && comparisonData && h('td', null, growthDisplay || h('span', { style: { color: '#9ca3af' } }, '—')),
                                    h('td', null,
                                        formatCurrency
                                            ? formatCurrency(avgPrice)
                                            : `$${avgPrice.toFixed(2)}`
                                    ),
                                    h('td', null, `${contributionPercent}%`),
                                    channelTarget85 > 0 && h('td', null, targetStatusDisplay || h('span', { style: { color: '#9ca3af' } }, '—'))
                                );
                            })
                        )
                    )
                ),
                
                // Pagination Controls
                filteredAndSortedData.length > itemsPerPage && h('div', { className: 'pagination-controls' },
                    h('div', { className: 'pagination-info' },
                        h('span', null, `Showing ${startIndex + 1}-${Math.min(endIndex, dataWithComparison.length)} of ${dataWithComparison.length} SKUs`)
                    ),
                    h('div', { className: 'pagination-buttons' },
                        h('button', {
                            className: 'pagination-btn',
                            onClick: () => setCurrentPage(prev => Math.max(1, prev - 1)),
                            disabled: currentPage === 1,
                            title: 'Previous page'
                        }, '← Prev'),
                        h('div', { className: 'page-numbers' },
                            Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                
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
                            disabled: currentPage === totalPages,
                            title: 'Next page'
                        }, 'Next →'),
                        totalPages > 5 && h('div', { className: 'page-jump' },
                            h('span', null, 'Go to:'),
                            h('input', {
                                type: 'number',
                                className: 'page-input',
                                min: 1,
                                max: totalPages,
                                value: currentPage,
                                onChange: (e) => {
                                    const page = parseInt(e.target.value);
                                    if (page >= 1 && page <= totalPages) {
                                        setCurrentPage(page);
                                    }
                                }
                            }),
                            h('span', null, `of ${totalPages}`)
                        )
                    ),
                    h('div', { className: 'pagination-settings' },
                        h('label', { className: 'items-per-page-label' }, 'Items per page:'),
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
                            h('option', { value: 100 }, '100'),
                            h('option', { value: 200 }, '200')
                        ),
                        h('label', { className: 'virtual-scroll-label', style: { marginLeft: '16px' } },
                            h('input', {
                                type: 'checkbox',
                                checked: virtualScrollEnabled,
                                onChange: (e) => {
                                    setVirtualScrollEnabled(e.target.checked);
                                    if (e.target.checked) {
                                        setVisibleRange({ start: 0, end: Math.ceil(600 / 50) });
                                    }
                                }
                            }),
                            h('span', { style: { marginLeft: '6px' } }, 'Virtual Scrolling')
                        )
                    )
                ),
                
                // Loading more indicator
                loadingMore && h('div', { className: 'loading-more' },
                    h('div', { className: 'loading-spinner', style: { width: '20px', height: '20px' } }),
                    h('span', null, 'Loading more data...')
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

