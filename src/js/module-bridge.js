/**
 * Module Bridge - Makes modules work with both script tags and ES6 imports
 * This file creates a global namespace for the application
 */

// Create global namespace
window.ChaiVision = window.ChaiVision || {};

// ============================================
// CONFIGURATION BRIDGE
// ============================================
// Only set defaults if a real CONFIG isn't already defined by src/js/config.js
window.ChaiVision.CONFIG = window.ChaiVision.CONFIG || {
    // Application Info
    APP: {
        NAME: 'Chai Vision',
        VERSION: '1.0.0',
        DESCRIPTION: 'Sales Performance Dashboard'
    },

    // Branding
    BRANDING: {
        LOGO_URL: '', // Add your logo URL here
        FALLBACK_LOGOS: []
    },

    // Supabase Configuration
    SUPABASE: {
        URL: 'YOUR_SUPABASE_URL',
        ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
        ENABLED: false,
        TABLES: {
            SALES_DATA: 'sales_data',
            BRANDS: 'brands',
            TARGETS: 'targets',
            USERS: 'users'
        }
    },

    // Feature Flags
    FEATURES: {
        ENABLE_SUPABASE: false,
        ENABLE_DEMO_MODE: true,
        ENABLE_DARK_MODE: false
    },

    // Data Settings
    DATA: {
        CACHE_DURATION: 5 * 60 * 1000,
        MAX_UPLOAD_SIZE: 10 * 1024 * 1024,
        SUPPORTED_FORMATS: ['.csv', '.xlsx', '.xls'],
        STORAGE_KEYS: {
            SALES_DATA: 'chai_vision_sales_data',
            USER_PREFERENCES: 'chai_vision_preferences',
            CACHED_TARGETS: 'chai_vision_targets'
        }
    },

    // Initial Data
    INITIAL_DATA: window.ChaiVision.INITIAL_DATA || {}
};

// ============================================
// UTILITY FUNCTIONS BRIDGE
// ============================================
window.ChaiVision.utils = {
    formatters: window.formatters || {},
    dateUtils: window.dateUtils || {},
    validators: window.validators || {}
};

// ============================================
// SERVICES BRIDGE
// ============================================
window.ChaiVision.services = {
    DataService: window.DataService || class DataService {
        constructor(supabaseClient, config) {
            this.supabase = supabaseClient;
            this.config = config;
        }
        
        async loadSalesData() {
            // Load from localStorage for demo
            const stored = localStorage.getItem('chai_vision_sales_data');
            if (stored) {
                return JSON.parse(stored);
            }
            
            // Generate sample data
            return window.ChaiVision.INITIAL_DATA.generateSampleData(
                '2025-01-01',
                new Date().toISOString().split('T')[0]
            );
        }
        
        async saveSalesData(data) {
            const existing = await this.loadSalesData();
            const updated = [...existing, ...data];
            localStorage.setItem('chai_vision_sales_data', JSON.stringify(updated));
            return true;
        }
        
        async updateSettings(settings) {
            localStorage.setItem('chai_vision_settings', JSON.stringify(settings));
            return true;
        }
    },
    SupabaseService: window.SupabaseService || class SupabaseService {
        constructor(client, config) {
            this.client = client;
            this.config = config;
        }
    }
};

// ============================================
// COMPONENTS BRIDGE
// ============================================
window.ChaiVision.components = {
    Dashboard: window.ChaiVision.components?.Dashboard || window.Dashboard || function Dashboard(props) {
        const { createElement: h } = React;
        return h('div', null, 'Dashboard Component');
    },
    Settings: window.Settings || function Settings(props) {
        const { createElement: h } = React;
        return h('div', null, 'Settings Component');
    },
    Upload: window.Upload || function Upload(props) {
        const { createElement: h } = React;
        return h('div', null, 'Upload Component');
    },
    Navigation: window.Navigation || function Navigation(props) {
        const { createElement: h } = React;
        return h('div', null, 'Navigation Component');
    },
    Sidebar: window.Sidebar || function Sidebar(props) {
        const { createElement: h } = React;
        return h('div', null, 'Sidebar Component');
    },
    KPICards: window.KPICards || function KPICards(props) {
        const { createElement: h } = React;
        return h('div', null, 'KPI Cards Component');
    },
    ChannelPerformance: window.ChannelPerformance || function ChannelPerformance(props) {
        const { createElement: h } = React;
        return h('div', null, 'Channel Performance Component');
    },
    Charts: window.ChaiVision.components?.Charts || window.Charts || function Charts(props) {
        const { createElement: h } = React;
        return h('div', null, 'Charts Component');
    }
};

// ============================================
// MAIN APP INITIALIZATION
// ============================================
window.ChaiVision.initializeApp = function(config = window.ChaiVision.CONFIG) {
    console.log('✅ Initializing Chai Vision Dashboard with bridge...');
    
    const { useState, useEffect, useMemo, useRef, createElement: h } = React;
    
    // Initialize Supabase if configured
    let supabaseClient = null;
    if (config.FEATURES.ENABLE_SUPABASE && 
        config.SUPABASE.URL !== 'YOUR_SUPABASE_URL' && 
        window.supabase) {
        try {
            supabaseClient = window.supabase.createClient(
                config.SUPABASE.URL,
                config.SUPABASE.ANON_KEY
            );
            console.log('✅ Supabase client initialized');
        } catch (error) {
            console.warn('⚠️ Failed to initialize Supabase:', error);
        }
    }
    
    // Initialize data service
    const dataService = new window.ChaiVision.services.DataService(supabaseClient, config);
    
    // Main App Component
    function App() {
        const [view, setView] = useState('quarterly');
        const [selectedPeriod, setSelectedPeriod] = useState(getCurrentQuarter());
        const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
        const [selectedYear, setSelectedYear] = useState(getCurrentYear());
        const [selectedBrand, setSelectedBrand] = useState('All Brands');
        const [activeSection, setActiveSection] = useState('dashboard');
        const [salesData, setSalesData] = useState([]);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        
        // Enhanced setActiveSection that also updates URL
        const setActiveSectionWithRouting = (section) => {
            setActiveSection(section);
            // Update URL when section changes
            if (window.ChaiVision?.routing?.updateURL) {
                window.ChaiVision.routing.updateURL(section);
            }
        };
        
        // Helper functions
        function getCurrentQuarter() {
            const month = new Date().getMonth();
            return `Q${Math.floor(month / 3) + 1}`;
        }
        
        function getCurrentMonth() {
            return new Date().getMonth() + 1;
        }
        
        // Load initial data and initialize routing
        useEffect(() => {
            loadInitialData();
            
            // Initialize routing after a short delay to ensure components are loaded
            setTimeout(() => {
                if (window.ChaiVision?.routing?.initializeRouting) {
                    window.ChaiVision.routing.initializeRouting(setActiveSectionWithRouting, 'dashboard');
                }
            }, 100);
        }, []);
        
        async function loadInitialData() {
            try {
                setLoading(true);
                const data = await dataService.loadSalesData();
                setSalesData(data);
                setLoading(false);
            } catch (err) {
                console.error('Failed to load data:', err);
                setError('Failed to load sales data');
                setLoading(false);
            }
        }
        
        // Update selected year to latest year from data when sales data changes
        useEffect(() => {
            if (salesData && salesData.length > 0) {
                const { getLatestYearFromData } = window.dateUtils || {};
                if (getLatestYearFromData) {
                    const latestYear = getLatestYearFromData(salesData);
                    setSelectedYear(latestYear);
                }
            }
        }, [salesData]);
        
        // Get components
        const Navigation = window.ChaiVision.components.Navigation;
        const Sidebar = window.ChaiVision.components.Sidebar;
        const Dashboard = window.ChaiVision.components.Dashboard;
        const Settings = window.ChaiVision.components.Settings;
        const Upload = window.ChaiVision.components.Upload;
        
        // Render navigation
        // Derive dynamic brand/channel lists from loaded data
        const brandsFromData = Array.from(new Set((salesData || [])
            .map(d => d.brand_name || d.brand)
            .filter(Boolean))).sort();
        const channelsFromData = Array.from(new Set((salesData || [])
            .map(d => d.channel_name || d.channel)
            .filter(Boolean))).sort();

        const navigation = h(Navigation, {
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
            brands: brandsFromData.length > 0 ? brandsFromData : (config.INITIAL_DATA.brands || ['LifePro', 'PetCove']),
            activeSection,
            setActiveSection: setActiveSectionWithRouting,
            salesData // Add sales data for year detection
        });
        
        // Render sidebar
        const sidebar = h(Sidebar, {
            activeSection,
            setActiveSection: setActiveSectionWithRouting
        });
        
        // Render main content based on active section
        const renderContent = () => {
            if (loading) {
                return h('div', { className: 'loading-container', style: { padding: '40px', textAlign: 'center' } },
                    h('div', { className: 'loading-spinner' }),
                    h('div', { className: 'loading-text' }, 'Loading dashboard...')
                );
            }
            
            if (error) {
                return h('div', { className: 'error-container', style: { padding: '40px', textAlign: 'center' } },
                    h('h2', null, 'Error'),
                    h('p', null, error),
                    h('button', {
                        className: 'btn btn-primary',
                        onClick: loadInitialData,
                        style: {
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            marginTop: '20px'
                        }
                    }, 'Retry')
                );
            }
            
            switch (activeSection) {
                case 'dashboard':
                    return h(Dashboard, {
                        view,
                        selectedPeriod,
                        selectedMonth,
                        selectedYear,
                        selectedBrand,
                        salesData,
                        config,
                        dataService,
                        dynamicBrands: brandsFromData,
                        dynamicChannels: channelsFromData
                    });
                    
                case 'settings':
                    return h(Settings, {
                        brands: config.INITIAL_DATA.brands,
                        targets: config.INITIAL_DATA.targets,
                        channels: config.INITIAL_DATA.channels,
                        onUpdate: handleSettingsUpdate,
                        salesData // Add sales data for year detection
                    });
                    
                case 'upload':
                    return h(Upload, {
                        dataService,
                        onUploadComplete: handleUploadComplete,
                        config
                    });
                    
                default:
                    return h('div', null, 'Section not found');
            }
        };
        
        // Handle settings update
        const handleSettingsUpdate = async (updatedData) => {
            try {
                await dataService.updateSettings(updatedData);
                await loadInitialData();
                console.log('Settings updated successfully');
            } catch (err) {
                console.error('Failed to update settings:', err);
            }
        };
        
        // Handle upload complete
        const handleUploadComplete = async (uploadedData) => {
            try {
                const mergedData = [...salesData, ...uploadedData];
                setSalesData(mergedData);
                console.log(`Successfully uploaded ${uploadedData.length} records`);
            } catch (err) {
                console.error('Failed to process upload:', err);
            }
        };
        
        // Main render
        return h('div', { className: 'app-wrapper' },
            navigation,
            h('div', { className: 'app-container' },
                sidebar,
                h('main', { className: 'main-content' },
                    renderContent()
                )
            )
        );
    }
    
    // Render the app
    ReactDOM.render(React.createElement(App), document.getElementById('root'));
    console.log('✅ Chai Vision Dashboard rendered successfully!');
};

// Auto-initialize if all components are loaded
window.addEventListener('load', () => {
    // Check if components are loaded after a short delay
    setTimeout(() => {
        if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
            console.log('Auto-initializing Chai Vision Dashboard...');
            // You can auto-initialize here if desired
            // window.ChaiVision.initializeApp();
        }
    }, 100);
});

console.log('✅ Chai Vision module bridge loaded');
