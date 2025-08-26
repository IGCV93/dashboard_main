/**
 * Chai Vision Dashboard - Main Application Module
 * Entry point for the dashboard application
 */

(function() {
    'use strict';
    
    // Global state
    let APP_STATE = {
        initialized: false,
        supabaseClient: null,
        dataService: null,
        currentUser: null,
        preferences: {}
    };

    /**
     * Initialize the application
     */
    function initializeApp(config) {
        // Use global CONFIG if not passed
        config = config || window.CONFIG || window.ChaiVision?.CONFIG;
        
        if (!config) {
            console.error('Configuration not found!');
            showErrorMessage('Failed to load configuration. Please refresh the page.');
            return;
        }
        
        try {
            console.log('🚀 Starting Chai Vision Dashboard initialization...');
            
            // Validate configuration
            const validateConfig = window.validateConfig || window.ChaiVision?.validateConfig;
            if (validateConfig) {
                const configErrors = validateConfig();
                if (configErrors.length > 0) {
                    console.warn('Configuration warnings:', configErrors);
                }
            }
            
            // Initialize Supabase if configured
            const initSupabase = window.initSupabase || window.ChaiVision?.initSupabase;
            if (config.FEATURES.ENABLE_SUPABASE && initSupabase) {
                APP_STATE.supabaseClient = initSupabase();
            }
            
            // Get DataService class
            const DataService = window.DataService || window.ChaiVision?.services?.DataService;
            if (DataService) {
                // Initialize data service
                APP_STATE.dataService = new DataService(APP_STATE.supabaseClient, config);
            } else {
                console.warn('DataService not found, using fallback');
                // Create a simple fallback data service
                APP_STATE.dataService = createFallbackDataService(config);
            }
            
            // Load user preferences from localStorage
            loadUserPreferences();
            
            // Initialize React components
            initializeReactApp(config);
            
            // Set up event listeners
            setupEventListeners();
            
            // Mark as initialized
            APP_STATE.initialized = true;
            
            console.log('✅ Chai Vision Dashboard initialized successfully!');
            
            // Log environment info
            if (config.DEV && config.DEV.ENABLE_LOGGING) {
                logEnvironmentInfo(config);
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            showErrorMessage('Failed to initialize dashboard. Please refresh the page.');
        }
    }

    /**
     * Create fallback data service
     */
    function createFallbackDataService(config) {
        return {
            async loadSalesData() {
                const stored = localStorage.getItem('chai_vision_sales_data');
                if (stored) {
                    return JSON.parse(stored);
                }
                
                // Generate sample data if available
                const INITIAL_DATA = window.ChaiVision?.INITIAL_DATA;
                if (INITIAL_DATA && INITIAL_DATA.generateSampleData) {
                    return INITIAL_DATA.generateSampleData(
                        '2025-01-01',
                        new Date().toISOString().split('T')[0]
                    );
                }
                
                return [];
            },
            
            async saveSalesData(data) {
                const existing = await this.loadSalesData();
                const updated = [...existing, ...data];
                localStorage.setItem('chai_vision_sales_data', JSON.stringify(updated));
                return true;
            },
            
            async updateSettings(settings) {
                localStorage.setItem('chai_vision_settings', JSON.stringify(settings));
                return true;
            }
        };
    }

    /**
     * Initialize React application
     */
    function initializeReactApp(config) {
        const { useState, useEffect, useMemo, useRef, createElement: h } = React;
        
        // Get helper functions
        const getCurrentQuarter = () => {
            const month = new Date().getMonth();
            return `Q${Math.floor(month / 3) + 1}`;
        };
        
        const getCurrentMonth = () => {
            return new Date().getMonth() + 1;
        };
        
        const getCurrentYear = () => {
            return new Date().getFullYear().toString();
        };
        
        // Main App Component
        function App() {
            // State management
            const [view, setView] = useState('quarterly');
            const [selectedPeriod, setSelectedPeriod] = useState(getCurrentQuarter());
            const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
            const [selectedYear, setSelectedYear] = useState(getCurrentYear());
            const [selectedBrand, setSelectedBrand] = useState('All Brands');
            const [activeSection, setActiveSection] = useState('dashboard');
            const [salesData, setSalesData] = useState([]);
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState(null);
            
            // Get initial data
            const INITIAL_DATA = window.ChaiVision?.INITIAL_DATA || {};
            const channels = INITIAL_DATA.channels || ['Amazon', 'TikTok', 'DTC-Shopify', 'Retail'];
            
            // IMPORTANT: Lift brand and target state to App level for sharing
            const [dynamicBrands, setDynamicBrands] = useState(INITIAL_DATA.brands || ['LifePro', 'PetCove']);
            const [dynamicTargets, setDynamicTargets] = useState(INITIAL_DATA.targets || {});
            
            // Load initial data
            useEffect(() => {
                loadInitialData();
            }, []);
            
            // Re-generate sample data when brands change
            useEffect(() => {
                regenerateSampleData();
            }, [dynamicBrands]);
            
            async function loadInitialData() {
                try {
                    setLoading(true);
                    if (APP_STATE.dataService) {
                        const data = await APP_STATE.dataService.loadSalesData();
                        setSalesData(data);
                    }
                    setLoading(false);
                } catch (err) {
                    console.error('Failed to load data:', err);
                    setError('Failed to load sales data');
                    setLoading(false);
                }
            }
            
            // Regenerate sample data for new brands
            function regenerateSampleData() {
                const data = [];
                const startDate = new Date('2025-01-01');
                const endDate = new Date();
                endDate.setDate(endDate.getDate() - 2); // Two days ago
                
                // Generate sample data for all brands including new ones
                for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    const dayOfWeek = d.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    
                    dynamicBrands.forEach(brand => {
                        channels.forEach(channel => {
                            // Generate different patterns for different channels and brands
                            let baseRevenue = 0;
                            const brandMultiplier = brand === 'LifePro' ? 1 : 
                                                   brand === 'PetCove' ? 0.12 : 0.08;
                            
                            switch(channel) {
                                case 'Amazon':
                                    baseRevenue = 250000 * brandMultiplier;
                                    break;
                                case 'TikTok':
                                    baseRevenue = 30000 * brandMultiplier;
                                    break;
                                case 'DTC-Shopify':
                                    baseRevenue = 55000 * brandMultiplier;
                                    break;
                                case 'Retail':
                                    baseRevenue = 11000 * brandMultiplier;
                                    break;
                                case 'CA International':
                                    baseRevenue = 27000 * brandMultiplier;
                                    break;
                                case 'UK International':
                                    baseRevenue = 8200 * brandMultiplier;
                                    break;
                                case 'Wholesale':
                                    baseRevenue = 5500 * brandMultiplier;
                                    break;
                                case 'Omnichannel':
                                    baseRevenue = 8200 * brandMultiplier;
                                    break;
                            }
                            
                            const weekendMultiplier = isWeekend ? 1.3 : 1;
                            const variance = (Math.random() - 0.5) * baseRevenue * 0.3;
                            
                            if (Math.random() > 0.3) {
                                data.push({
                                    date: d.toISOString().split('T')[0],
                                    channel,
                                    brand,
                                    revenue: Math.max(0, baseRevenue * weekendMultiplier + variance),
                                    timestamp: new Date().toISOString()
                                });
                            }
                        });
                    });
                }
                
                setSalesData(data);
            }
            
            // Handle settings update - This is the key function that receives updates from Settings
            const handleSettingsUpdate = async (updatedData) => {
                try {
                    // Update the brands and targets in App state
                    if (updatedData.brands) {
                        setDynamicBrands(updatedData.brands);
                    }
                    if (updatedData.targets) {
                        setDynamicTargets(updatedData.targets);
                    }
                    
                    // Save to data service if available
                    if (APP_STATE.dataService) {
                        await APP_STATE.dataService.updateSettings(updatedData);
                    }
                    
                    // Save to localStorage for persistence
                    localStorage.setItem('chai_vision_brands', JSON.stringify(updatedData.brands || dynamicBrands));
                    localStorage.setItem('chai_vision_targets', JSON.stringify(updatedData.targets || dynamicTargets));
                    
                    showSuccessMessage('Settings updated successfully');
                } catch (err) {
                    console.error('Failed to update settings:', err);
                    showErrorMessage('Failed to update settings');
                }
            };
            
            // Handle upload complete
            const handleUploadComplete = async (uploadedData) => {
                try {
                    // Merge uploaded data with existing
                    const mergedData = [...salesData, ...uploadedData];
                    setSalesData(mergedData);
                    showSuccessMessage(`Successfully uploaded ${uploadedData.length} records`);
                } catch (err) {
                    console.error('Failed to process upload:', err);
                    showErrorMessage('Failed to process uploaded data');
                }
            };
            
            // Get components from window
            const Navigation = window.Navigation || window.ChaiVision?.components?.Navigation;
            const Sidebar = window.Sidebar || window.ChaiVision?.components?.Sidebar;
            const Dashboard = window.Dashboard || window.ChaiVision?.components?.Dashboard;
            const Settings = window.Settings || window.ChaiVision?.components?.Settings;
            const Upload = window.Upload || window.ChaiVision?.components?.Upload;
            
            // Render navigation
            const navigation = Navigation ? h(Navigation, {
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
                brands: dynamicBrands,  // Pass dynamic brands
                activeSection
            }) : null;
            
            // Render sidebar
            const sidebar = Sidebar ? h(Sidebar, {
                activeSection,
                setActiveSection
            }) : null;
            
            // Render main content based on active section
            const renderContent = () => {
                if (loading) {
                    return h('div', { className: 'loading-container' },
                        h('div', { className: 'loading-spinner' }),
                        h('div', { className: 'loading-text' }, 'Loading dashboard...')
                    );
                }
                
                if (error) {
                    return h('div', { className: 'error-container' },
                        h('h2', null, 'Error'),
                        h('p', null, error),
                        h('button', {
                            className: 'btn btn-primary',
                            onClick: loadInitialData
                        }, 'Retry')
                    );
                }
                
                switch (activeSection) {
                    case 'dashboard':
                        // Get INITIAL_DATA and create enhanced config
                        const INITIAL_DATA = window.ChaiVision?.INITIAL_DATA || {};
                        const enhancedConfig = {
                            ...config,
                            INITIAL_DATA: {
                                ...INITIAL_DATA,
                                brands: dynamicBrands,  // Pass dynamic brands
                                targets: dynamicTargets  // Pass dynamic targets
                            }
                        };
                        
                        return Dashboard ? h(Dashboard, {
                            view,
                            selectedPeriod,
                            selectedMonth,
                            selectedYear,
                            selectedBrand,
                            salesData,
                            config: enhancedConfig,
                            dataService: APP_STATE.dataService,
                            dynamicBrands,  // Pass as prop
                            dynamicTargets  // Pass as prop
                        }) : h('div', null, 'Dashboard component not found');
                        
                    case 'settings':
                        return Settings ? h(Settings, {
                            brands: dynamicBrands,  // Pass current brands
                            targets: dynamicTargets,  // Pass current targets
                            channels,
                            onUpdate: handleSettingsUpdate  // Pass update handler
                        }) : h('div', null, 'Settings component not found');
                        
                    case 'upload':
                        return Upload ? h(Upload, {
                            dataService: APP_STATE.dataService,
                            onUploadComplete: handleUploadComplete,
                            config,
                            brands: dynamicBrands  // Pass dynamic brands for validation
                        }) : h('div', null, 'Upload component not found');
                        
                    default:
                        return h('div', null, 'Section not found');
                }
            };
            
            // Load saved brands and targets on mount
            useEffect(() => {
                const savedBrands = localStorage.getItem('chai_vision_brands');
                const savedTargets = localStorage.getItem('chai_vision_targets');
                
                if (savedBrands) {
                    try {
                        setDynamicBrands(JSON.parse(savedBrands));
                    } catch (e) {
                        console.error('Failed to load saved brands:', e);
                    }
                }
                
                if (savedTargets) {
                    try {
                        setDynamicTargets(JSON.parse(savedTargets));
                    } catch (e) {
                        console.error('Failed to load saved targets:', e);
                    }
                }
            }, []);
            
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
    }

    /**
     * Load user preferences from localStorage
     */
    function loadUserPreferences() {
        try {
            const config = window.CONFIG || window.ChaiVision?.CONFIG;
            const storageKey = config?.DATA?.STORAGE_KEYS?.USER_PREFERENCES || 'chai_vision_preferences';
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                APP_STATE.preferences = JSON.parse(stored);
                applyUserPreferences(APP_STATE.preferences);
            }
        } catch (error) {
            console.error('Failed to load user preferences:', error);
        }
    }

    /**
     * Apply user preferences
     */
    function applyUserPreferences(preferences) {
        const config = window.CONFIG || window.ChaiVision?.CONFIG;
        
        // Apply dark mode if enabled
        if (preferences.darkMode && config?.FEATURES?.ENABLE_DARK_MODE) {
            document.body.setAttribute('data-theme', 'dark');
        }
        
        // Apply other preferences as needed
    }

    /**
     * Save user preferences
     */
    function saveUserPreferences(preferences) {
        try {
            const config = window.CONFIG || window.ChaiVision?.CONFIG;
            const storageKey = config?.DATA?.STORAGE_KEYS?.USER_PREFERENCES || 'chai_vision_preferences';
            APP_STATE.preferences = { ...APP_STATE.preferences, ...preferences };
            localStorage.setItem(storageKey, JSON.stringify(APP_STATE.preferences));
        } catch (error) {
            console.error('Failed to save user preferences:', error);
        }
    }

    /**
     * Set up global event listeners
     */
    function setupEventListeners() {
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // Trigger chart resize if needed
                window.dispatchEvent(new Event('dashboard:resize'));
            }, 250);
        });
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                window.dispatchEvent(new Event('dashboard:save'));
            }
            
            // Ctrl/Cmd + / for help
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                showHelp();
            }
        });
        
        // Handle visibility change (tab switch)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && APP_STATE.initialized) {
                // Refresh data when tab becomes visible
                window.dispatchEvent(new Event('dashboard:refresh'));
            }
        });
        
        // Handle online/offline status
        window.addEventListener('online', () => {
            showSuccessMessage('Connection restored');
            window.dispatchEvent(new Event('dashboard:refresh'));
        });
        
        window.addEventListener('offline', () => {
            showWarningMessage('Working offline - some features may be limited');
        });
    }

    /**
     * Show success message
     */
    function showSuccessMessage(message) {
        showNotification(message, 'success');
    }

    /**
     * Show error message
     */
    function showErrorMessage(message) {
        showNotification(message, 'error');
    }

    /**
     * Show warning message
     */
    function showWarningMessage(message) {
        showNotification(message, 'warning');
    }

    /**
     * Show notification
     */
    function showNotification(message, type = 'info') {
        const config = window.CONFIG || window.ChaiVision?.CONFIG;
        const duration = config?.NOTIFICATIONS?.DURATION || 5000;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            max-width: 400px;
        `;
        
        // Set background based on type
        const backgrounds = {
            success: 'linear-gradient(135deg, #10B981, #059669)',
            error: 'linear-gradient(135deg, #EF4444, #DC2626)',
            warning: 'linear-gradient(135deg, #F59E0B, #D97706)',
            info: 'linear-gradient(135deg, #3B82F6, #2563EB)'
        };
        notification.style.background = backgrounds[type] || backgrounds.info;
        
        // Add to document
        document.body.appendChild(notification);
        
        // Remove after duration
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    /**
     * Show help modal
     */
    function showHelp() {
        // This would open a help modal
        console.log('Help requested - would show help modal');
        showNotification('Help documentation coming soon!', 'info');
    }

    /**
     * Log environment information
     */
    function logEnvironmentInfo(config) {
        console.group('📊 Environment Information');
        console.log('Version:', config.APP.VERSION);
        console.log('Environment:', config.DEV.ENABLE_LOGGING ? 'Development' : 'Production');
        console.log('Features:', config.FEATURES);
        console.log('Supabase:', APP_STATE.supabaseClient ? 'Connected' : 'Not configured');
        console.log('Browser:', navigator.userAgent);
        console.log('Screen:', `${window.innerWidth}x${window.innerHeight}`);
        console.log('Local Storage Available:', typeof Storage !== 'undefined');
        console.groupEnd();
    }

    // Add CSS for notifications (if not already added)
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Export functions and state
    window.APP_STATE = APP_STATE;
    window.initializeApp = initializeApp;
    window.showSuccessMessage = showSuccessMessage;
    window.showErrorMessage = showErrorMessage;
    window.showWarningMessage = showWarningMessage;
    window.saveUserPreferences = saveUserPreferences;
    
    // Also add to ChaiVision namespace
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.APP_STATE = APP_STATE;
    window.ChaiVision.initializeApp = initializeApp;
    window.ChaiVision.showSuccessMessage = showSuccessMessage;
    window.ChaiVision.showErrorMessage = showErrorMessage;
    window.ChaiVision.showWarningMessage = showWarningMessage;
})();
