/**
 * SKU Performance Component - Minimal Working Version
 * Shows SKU-level sales performance for a specific channel
 */

(function () {
    'use strict';

    function SKUPerformance(props) {
        const { useState, useEffect, useMemo, createElement: h } = React;

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

        // Calculate date range based on view
        const getDateRange = () => {
            const year = parseInt(selectedYear);
            const month = parseInt(selectedMonth);

            if (view === 'quarterly') {
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

                    const data = await dataService.loadSKUData(filters);
                    setSkuData(data || []);
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

            // Data Table
            h('div', { className: 'data-table-container' },
                h('table', { className: 'data-table' },
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
                        filteredAndSortedData.slice(0, 50).map((item, index) => {
                            const contribution = totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(1) : '0.0';
                            return h('tr', { key: item.sku || index },
                                h('td', { className: 'sku-code' }, item.sku || '—'),
                                h('td', null, item.product_name || '—'),
                                h('td', null, (item.units || 0).toLocaleString()),
                                h('td', null, `$${(item.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
                                h('td', null, `${contribution}%`)
                            );
                        })
                    )
                ),
                filteredAndSortedData.length > 50 && h('div', { className: 'table-footer' },
                    `Showing 50 of ${filteredAndSortedData.length} SKUs`
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
