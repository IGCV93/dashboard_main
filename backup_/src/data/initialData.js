/**
 * Chai Vision Dashboard - Initial Data Configuration
 * Default brands, channels, and target values
 */

(function() {
    'use strict';
    
    // All available sales channels
    const ALL_CHANNELS = [
        'Amazon',
        'TikTok',
        'DTC-Shopify',
        'Retail',
        'CA International',
        'UK International',
        'Wholesale',
        'Omnichannel'
    ];

    // Channel color configuration for charts and UI
    const CHANNEL_COLORS = {
        'Amazon': '#FF9900',
        'TikTok': '#000000',
        'DTC-Shopify': '#96bf48',
        'Retail': '#8B5CF6',
        'CA International': '#DC2626',
        'UK International': '#1E40AF',
        'Wholesale': '#14B8A6',
        'Omnichannel': '#EC4899'
    };

    // Channel icons (emoji or icon class)
    const CHANNEL_ICONS = {
        'Amazon': '📦',
        'TikTok': '📱',
        'DTC-Shopify': '🛒',
        'Retail': '🏪',
        'CA International': '🇨🇦',
        'UK International': '🇬🇧',
        'Wholesale': '📊',
        'Omnichannel': '🌐'
    };

    // Default brands
    const DEFAULT_BRANDS = [
        'LifePro',
        'PetCove',
        'Joyberri',
        'Oaktiv',
        'Loft & Ivy',
        'New Brands'
    ];

    // Helper function to create default channel targets
    function createDefaultChannelTargets(totalAmount) {
        // Default distribution weights (must sum to 1.0)
        const weights = {
            'Amazon': 0.50,        // 50%
            'TikTok': 0.10,        // 10%
            'DTC-Shopify': 0.15,   // 15%
            'Retail': 0.05,        // 5%
            'CA International': 0.08, // 8%
            'UK International': 0.05, // 5%
            'Wholesale': 0.04,     // 4%
            'Omnichannel': 0.03   // 3%
        };
        
        const targets = {};
        ALL_CHANNELS.forEach(channel => {
            targets[channel] = Math.round(totalAmount * (weights[channel] || 0));
        });
        
        return targets;
    }

    // Target configuration by year, brand, and period
    const DEFAULT_TARGETS = {
        2025: {
            brands: {
                'LifePro': {
                    annual: {
                        'Amazon': 90500000,
                        'TikTok': 10000000,
                        'DTC-Shopify': 20000000,
                        'Retail': 4000000,
                        'CA International': 10000000,
                        'UK International': 3000000,
                        'Wholesale': 2000000,
                        'Omnichannel': 3000000
                    },
                    Q1: {
                        'Amazon': 20000000,
                        'TikTok': 2000000,
                        'DTC-Shopify': 4000000,
                        'Retail': 800000,
                        'CA International': 2000000,
                        'UK International': 600000,
                        'Wholesale': 400000,
                        'Omnichannel': 600000
                    },
                    Q2: {
                        'Amazon': 30000000,
                        'TikTok': 3000000,
                        'DTC-Shopify': 6000000,
                        'Retail': 1200000,
                        'CA International': 3000000,
                        'UK International': 900000,
                        'Wholesale': 600000,
                        'Omnichannel': 900000
                    },
                    Q3: {
                        'Amazon': 20000000,
                        'TikTok': 2500000,
                        'DTC-Shopify': 5000000,
                        'Retail': 1000000,
                        'CA International': 2500000,
                        'UK International': 750000,
                        'Wholesale': 500000,
                        'Omnichannel': 750000
                    },
                    Q4: {
                        'Amazon': 20500000,
                        'TikTok': 2500000,
                        'DTC-Shopify': 5000000,
                        'Retail': 1000000,
                        'CA International': 2500000,
                        'UK International': 750000,
                        'Wholesale': 500000,
                        'Omnichannel': 750000
                    }
                },
                'PetCove': {
                    annual: {
                        'Amazon': 9600000,
                        'TikTok': 1200000,
                        'DTC-Shopify': 2400000,
                        'Retail': 360000,
                        'CA International': 1200000,
                        'UK International': 400000,
                        'Wholesale': 240000,
                        'Omnichannel': 360000
                    },
                    Q1: {
                        'Amazon': 2400000,
                        'TikTok': 300000,
                        'DTC-Shopify': 600000,
                        'Retail': 90000,
                        'CA International': 300000,
                        'UK International': 100000,
                        'Wholesale': 60000,
                        'Omnichannel': 90000
                    },
                    Q2: {
                        'Amazon': 2400000,
                        'TikTok': 300000,
                        'DTC-Shopify': 600000,
                        'Retail': 90000,
                        'CA International': 300000,
                        'UK International': 100000,
                        'Wholesale': 60000,
                        'Omnichannel': 90000
                    },
                    Q3: {
                        'Amazon': 2400000,
                        'TikTok': 300000,
                        'DTC-Shopify': 600000,
                        'Retail': 90000,
                        'CA International': 300000,
                        'UK International': 100000,
                        'Wholesale': 60000,
                        'Omnichannel': 90000
                    },
                    Q4: {
                        'Amazon': 2400000,
                        'TikTok': 300000,
                        'DTC-Shopify': 600000,
                        'Retail': 90000,
                        'CA International': 300000,
                        'UK International': 100000,
                        'Wholesale': 60000,
                        'Omnichannel': 90000
                    }
                },
                'Joyberri': {
                    annual: createDefaultChannelTargets(5000000),
                    Q1: createDefaultChannelTargets(1250000),
                    Q2: createDefaultChannelTargets(1250000),
                    Q3: createDefaultChannelTargets(1250000),
                    Q4: createDefaultChannelTargets(1250000)
                },
                'Oaktiv': {
                    annual: createDefaultChannelTargets(3000000),
                    Q1: createDefaultChannelTargets(750000),
                    Q2: createDefaultChannelTargets(750000),
                    Q3: createDefaultChannelTargets(750000),
                    Q4: createDefaultChannelTargets(750000)
                },
                'Loft & Ivy': {
                    annual: createDefaultChannelTargets(4000000),
                    Q1: createDefaultChannelTargets(1000000),
                    Q2: createDefaultChannelTargets(1000000),
                    Q3: createDefaultChannelTargets(1000000),
                    Q4: createDefaultChannelTargets(1000000)
                },
                'New Brands': {
                    annual: createDefaultChannelTargets(2000000),
                    Q1: createDefaultChannelTargets(500000),
                    Q2: createDefaultChannelTargets(500000),
                    Q3: createDefaultChannelTargets(500000),
                    Q4: createDefaultChannelTargets(500000)
                }
            }
        },
        2024: {
            brands: {}
        },
        2026: {
            brands: {}
        }
    };

    // Sample data generator for demo mode
    function generateSampleData(startDate, endDate, brands = DEFAULT_BRANDS, channels = ALL_CHANNELS) {
        const data = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            brands.forEach(brand => {
                channels.forEach(channel => {
                    // Generate different patterns for different channels
                    let baseRevenue = getBaseRevenue(brand, channel);
                    
                    // Apply variations
                    const weekendMultiplier = isWeekend ? 1.3 : 1;
                    const seasonalMultiplier = getSeasonalMultiplier(d);
                    const randomVariance = (Math.random() - 0.5) * baseRevenue * 0.3;
                    
                    // Sometimes no sales (especially for smaller channels)
                    if (Math.random() > 0.95 && channel !== 'Amazon') {
                        return;
                    }
                    
                    const revenue = Math.max(0, 
                        baseRevenue * weekendMultiplier * seasonalMultiplier + randomVariance
                    );
                    
                    data.push({
                        date: d.toISOString().split('T')[0],
                        channel,
                        brand,
                        revenue,
                        timestamp: new Date().toISOString()
                    });
                });
            });
        }
        
        return data;
    }

    // Get base revenue for brand/channel combination
    function getBaseRevenue(brand, channel) {
        const baseValues = {
            'LifePro': {
                'Amazon': 250000,
                'TikTok': 30000,
                'DTC-Shopify': 55000,
                'Retail': 11000,
                'CA International': 27000,
                'UK International': 8200,
                'Wholesale': 5500,
                'Omnichannel': 8200
            },
            'PetCove': {
                'Amazon': 30000,
                'TikTok': 3500,
                'DTC-Shopify': 6500,
                'Retail': 1000,
                'CA International': 3300,
                'UK International': 1100,
                'Wholesale': 650,
                'Omnichannel': 1000
            }
        };
        
        return baseValues[brand]?.[channel] || 5000;
    }

    // Get seasonal multiplier based on date
    function getSeasonalMultiplier(date) {
        const month = date.getMonth();
        
        if (month === 10 || month === 11) {
            return 1.5;
        }
        
        if (month >= 9) {
            return 1.2;
        }
        
        if (month === 6 || month === 7) {
            return 0.9;
        }
        
        return 1.0;
    }

    // Export template for CSV uploads
    const CSV_TEMPLATE_HEADERS = ['Date', 'Channel', 'Brand', 'Revenue'];

    const CSV_TEMPLATE_DATA = [
        ['2025-01-01', 'Amazon', 'LifePro', '250000'],
        ['2025-01-01', 'TikTok', 'LifePro', '30000'],
        ['2025-01-01', 'DTC-Shopify', 'PetCove', '6500'],
        ['2025-01-02', 'Amazon', 'LifePro', '275000']
    ];

    // Validation rules for data uploads
    const VALIDATION_RULES = {
        date: {
            required: true,
            format: /^\d{4}-\d{2}-\d{2}$/,
            minDate: '2020-01-01',
            maxDate: '2030-12-31'
        },
        channel: {
            required: true,
            values: ALL_CHANNELS
        },
        brand: {
            required: true,
            maxLength: 50
        },
        revenue: {
            required: true,
            min: 0,
            max: 10000000000,
            type: 'number'
        }
    };

    // Main export object
    const INITIAL_DATA = {
        brands: DEFAULT_BRANDS,
        channels: ALL_CHANNELS,
        channelColors: CHANNEL_COLORS,
        channelIcons: CHANNEL_ICONS,
        targets: DEFAULT_TARGETS,
        generateSampleData,
        csvTemplate: {
            headers: CSV_TEMPLATE_HEADERS,
            data: CSV_TEMPLATE_DATA
        },
        validationRules: VALIDATION_RULES
    };

    // Make available globally
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.INITIAL_DATA = INITIAL_DATA;
    
    // Also make individual exports available
    window.ALL_CHANNELS = ALL_CHANNELS;
    window.DEFAULT_BRANDS = DEFAULT_BRANDS;
    window.CHANNEL_COLORS = CHANNEL_COLORS;
})();
