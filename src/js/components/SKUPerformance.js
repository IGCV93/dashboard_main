/**
 * SKU Performance Component - Minimal Working Version
 * Shows SKU-level sales performance for a specific channel
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

        // State
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const [skuData, setSkuData] = useState([]);
        const [searchQuery, setSearchQuery] = useState('');
        const [sortBy, setSortBy] = useState('revenue');
        const [sortOrder, setSortOrder] = useState('desc');
        const [currentPage, setCurrentPage] = useState(1);
        const [itemsPerPage] = useState(20);

        // Chart refs
        const topSKUsChartRef = useRef(null);
        const contributionChartRef = useRef(null);
        const topSKUsChartInstance = useRef(null);
        const contributionChartInstance = useRef(null);

        // Calculate date range based on view
        const getDateRange = () => {
            const year = parseInt(selectedYear);
            const month = parseInt(selectedMonth);

            if (view === 'annual') {
                return {
                    start: `${year}-01-01`,
                    end: `${year}-12-31`
                };
            } else if (view === 'quarterly') {
                const quarter = selectedPeriod.replace('Q', '');
                const startMonth = (quarter - 1) * 3 + 1;
                const endMonth = startMonth + 2;
                const endDay = new Date(year, endMonth, 0).getDate();
                return {
                    start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
                    end: `${year}-${String(endMonth).padStart(2, '0')}-${endDay}`
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

        // Load SKU data
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

                    const dateRange = getDateRange();
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

                    const rawData = await dataService.loadSKUData(filters);

                    // Aggregate data by SKU
                    const aggregatedMap = (rawData || []).reduce((acc, item) => {
                        const sku = item.sku || 'Unknown';
                        if (!acc[sku]) {
                            acc[sku] = {
                                ...item,
                                revenue: 0,
                                units: 0,
                                count: 0
                            };
                        }
                        acc[sku].revenue += (Number(item.revenue) || 0);
                        acc[sku].units += (Number(item.units) || 0);
                        acc[sku].count += 1;
                        return acc;
                    }, {});

                    const aggregatedData = Object.values(aggregatedMap).map(item => ({
                        ...item,
                        price: item.units > 0 ? item.revenue / item.units : 0
                    }));

                    setSkuData(aggregatedData);
                } catch (err) {
                    console.error('Failed to load SKU data:', err);
                    setError('Failed to load SKU data. Please try again.');
                } finally {
                    setLoading(false);
                }
            };

            loadData();
        }, [channel, brand, view, selectedPeriod, selectedMonth, selectedYear, dataService]);

        // Filter and sort data
        const filteredAndSortedData = useMemo(() => {
            let filtered = skuData;

            // Apply search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                filtered = filtered.filter(item =>
                    (item.sku && item.sku.toLowerCase().includes(query)) ||
                    (item.product_name && item.product_name.toLowerCase().includes(query))
                );
            }

            // Apply sorting
            filtered = [...filtered].sort((a, b) => {
                let aVal, bVal;
                switch (sortBy) {
                    case 'revenue':
                        aVal = a.revenue || 0;
                        bVal = b.revenue || 0;
                        break;
                    case 'units':
                        aVal = a.units || 0;
                        bVal = b.units || 0;
                        break;
                    case 'sku':
                        aVal = a.sku || '';
                        bVal = b.sku || '';
                        break;
                    default:
                        aVal = a.revenue || 0;
                        bVal = b.revenue || 0;
                }

                if (sortOrder === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });

            return filtered;
        }, [skuData, searchQuery, sortBy, sortOrder]);

        // Pagination calculations
        const totalPages = useMemo(() => Math.ceil(filteredAndSortedData.length / itemsPerPage), [filteredAndSortedData.length, itemsPerPage]);
        const startIndex = useMemo(() => (currentPage - 1) * itemsPerPage, [currentPage, itemsPerPage]);
        const endIndex = useMemo(() => startIndex + itemsPerPage, [startIndex, itemsPerPage]);
        const paginatedData = useMemo(() => filteredAndSortedData.slice(startIndex, endIndex), [filteredAndSortedData, startIndex, endIndex]);

        // Reset to page 1 when filters change
        useEffect(() => {
            setCurrentPage(1);
        }, [searchQuery, sortBy, sortOrder]);

        // Calculate summary metrics
        const totalRevenue = useMemo(() => {
            return filteredAndSortedData.reduce((sum, item) => sum + (item.revenue || 0), 0);
        }, [filteredAndSortedData]);

        const totalUnits = useMemo(() => {
            return filteredAndSortedData.reduce((sum, item) => sum + (item.units || 0), 0);
        }, [filteredAndSortedData]);

        const avgPrice = useMemo(() => {
            if (totalUnits === 0) return 0;
            return totalRevenue / totalUnits;
        }, [totalRevenue, totalUnits]);

        const topPerformer = useMemo(() => {
            if (filteredAndSortedData.length === 0) return null;
            return [...filteredAndSortedData].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];
        }, [filteredAndSortedData]);

        // Prepare chart data
        const chartData = useMemo(() => {
            if (filteredAndSortedData.length === 0) return null;

            // Top 10 SKUs by revenue
            const top10 = [...filteredAndSortedData]
                .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                .slice(0, 10);

            return { top10 };
        }, [filteredAndSortedData]);

        // Create charts
        useEffect(() => {
            if (!chartData || loading) return;

            const ChartLib = window.Chart || (typeof Chart !== 'undefined' ? Chart : null);
            if (!ChartLib) {
                console.warn('Chart.js not available');
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

            // Create Top SKUs bar chart
            if (topSKUsChartRef.current && chartData.top10.length > 0) {
                const ctx = topSKUsChartRef.current.getContext('2d');
                topSKUsChartInstance.current = new ChartLib(ctx, {
                    type: 'bar',
                    data: {
                        labels: chartData.top10.map(item => item.sku),
                        datasets: [{
                            label: 'Revenue',
                            data: chartData.top10.map(item => item.revenue),
                            backgroundColor: 'rgba(102, 126, 234, 0.7)',
                            borderColor: 'rgba(102, 126, 234, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            title: {
                                display: true,
                                text: 'Top 10 SKUs by Revenue'
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        return `Revenue: $${context.parsed.y.toLocaleString()}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: (value) => `$${value.toLocaleString()}`
                                }
                            },
                            x: {
                                ticks: {
                                    maxRotation: 45,
                                    minRotation: 45,
                                    autoSkip: false
                                }
                            }
                        }
                    }
                });
            }

            // Create Contribution pie chart
            if (contributionChartRef.current && chartData.top10.length > 0) {
                const ctx = contributionChartRef.current.getContext('2d');
                const othersRevenue = totalRevenue - chartData.top10.reduce((sum, item) => sum + item.revenue, 0);

                contributionChartInstance.current = new ChartLib(ctx, {
                    type: 'pie',
                    data: {
                        labels: [...chartData.top10.map(item => item.sku), 'Others'],
                        datasets: [{
                            data: [...chartData.top10.map(item => item.revenue), othersRevenue],
                            backgroundColor: [
                                'rgba(102, 126, 234, 0.8)',
                                'rgba(118, 75, 162, 0.8)',
                                'rgba(237, 100, 166, 0.8)',
                                'rgba(255, 154, 158, 0.8)',
                                'rgba(250, 208, 196, 0.8)',
                                'rgba(16, 185, 129, 0.8)',
                                'rgba(245, 158, 11, 0.8)',
                                'rgba(239, 68, 68, 0.8)',
                                'rgba(59, 130, 246, 0.8)',
                                'rgba(156, 163, 175, 0.8)',
                                'rgba(209, 213, 219, 0.8)'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    boxWidth: 12,
                                    padding: 15,
                                    font: {
                                        size: 11
                                    }
                                }
                            },
                            title: {
                                display: true,
                                text: 'Revenue Contribution by SKU'
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        const value = context.parsed;
                                        const percentage = ((value / totalRevenue) * 100).toFixed(1);
                                        return `${context.label}: $${value.toLocaleString()} (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }

            return () => {
                if (topSKUsChartInstance.current) topSKUsChartInstance.current.destroy();
                if (contributionChartInstance.current) contributionChartInstance.current.destroy();
            };
        }, [chartData, loading, totalRevenue]);

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
            // Header with back button
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

            // Page Title
            h('div', { className: 'page-header' },
                h('div', { className: 'page-title' },
                    h('h1', null, `SKU Performance: ${channel}`),
                    h('div', { className: 'page-subtitle' },
                        brand ? `Brand: ${brand}` : 'All Brands'
                    )
                )
            ),

            // Filters
            h('div', { className: 'filter-controls' },
                h('div', { className: 'filter-group' },
                    h('input', {
                        type: 'text',
                        placeholder: 'Search SKUs...',
                        value: searchQuery,
                        onChange: (e) => setSearchQuery(e.target.value),
                        className: 'search-input'
                    })
                ),
                h('div', { className: 'filter-group' },
                    h('select', {
                        value: sortBy,
                        onChange: (e) => setSortBy(e.target.value),
                        className: 'sort-select'
                    },
                        h('option', { value: 'revenue' }, 'Sort by Revenue'),
                        h('option', { value: 'units' }, 'Sort by Units'),
                        h('option', { value: 'sku' }, 'Sort by SKU')
                    ),
                    h('button', {
                        className: 'sort-order-btn',
                        onClick: () => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'),
                        title: sortOrder === 'asc' ? 'Ascending' : 'Descending'
                    }, sortOrder === 'asc' ? '↑' : '↓')
                )
            ),

            // Summary Cards
            h('div', { className: 'kpi-grid' },
                h('div', { className: 'kpi-card' },
                    h('div', { className: 'kpi-label' }, 'Total Revenue'),
                    h('div', { className: 'kpi-value' },
                        `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )
                ),
                h('div', { className: 'kpi-card' },
                    h('div', { className: 'kpi-label' }, 'Total Units'),
                    h('div', { className: 'kpi-value' }, totalUnits.toLocaleString())
                ),
                h('div', { className: 'kpi-card' },
                    h('div', { className: 'kpi-label' }, 'Avg Price'),
                    h('div', { className: 'kpi-value' }, `$${avgPrice.toFixed(2)}`)
                ),
                h('div', { className: 'kpi-card' },
                    h('div', { className: 'kpi-label' }, 'Top Performer'),
                    h('div', { className: 'kpi-value', style: { fontSize: '16px' } },
                        topPerformer ? (topPerformer.product_name || topPerformer.sku) : '—'
                    ),
                    topPerformer && h('div', { className: 'kpi-subtitle' },
                        `$${topPerformer.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )
                )
            ),

            // Charts Section
            h('div', { className: 'charts-grid' },
                h('div', { className: 'chart-card' },
                    h('canvas', { ref: topSKUsChartRef })
                ),
                h('div', { className: 'chart-card' },
                    h('canvas', { ref: contributionChartRef })
                )
            ),

            // Data Table
            h('div', { className: 'data-table-container' },
                h('table', { className: 'sku-table' },
                    h('thead', null,
                        h('tr', null,
                            h('th', null, 'SKU'),
                            h('th', null, 'Product Name'),
                            h('th', null, 'Units'),
                            h('th', null, 'Revenue'),
                            h('th', null, 'Contribution %')
                        )
                    ),
                    h('tbody', null,
                        paginatedData.map((item, index) => {
                            const contribution = totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(1) : '0.0';
                            const rowKey = item.sku ? `${item.sku}-${startIndex + index}` : `row-${startIndex + index}`;
                            return h('tr', { key: rowKey },
                                h('td', { className: 'sku-code' }, item.sku || '—'),
                                h('td', null, item.product_name || '—'),
                                h('td', null, (item.units || 0).toLocaleString()),
                                h('td', null, `$${(item.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
                                h('td', null, `${contribution}%`)
                            );
                        })
                    )
                ),

                // Pagination Controls
                filteredAndSortedData.length > itemsPerPage && h('div', { className: 'pagination-controls' },
                    h('div', { className: 'pagination-info' },
                        `Showing ${startIndex + 1}-${Math.min(endIndex, filteredAndSortedData.length)} of ${filteredAndSortedData.length} SKUs`
                    ),
                    h('div', { className: 'pagination-buttons' },
                        h('button', {
                            className: 'pagination-btn',
                            onClick: () => setCurrentPage(1),
                            disabled: currentPage === 1
                        }, '« First'),
                        h('button', {
                            className: 'pagination-btn',
                            onClick: () => setCurrentPage(prev => Math.max(1, prev - 1)),
                            disabled: currentPage === 1
                        }, '‹ Prev'),
                        h('span', { className: 'pagination-page-info' },
                            `Page ${currentPage} of ${totalPages}`
                        ),
                        h('button', {
                            className: 'pagination-btn',
                            onClick: () => setCurrentPage(prev => Math.min(totalPages, prev + 1)),
                            disabled: currentPage === totalPages
                        }, 'Next ›'),
                        h('button', {
                            className: 'pagination-btn',
                            onClick: () => setCurrentPage(totalPages),
                            disabled: currentPage === totalPages
                        }, 'Last »')
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
