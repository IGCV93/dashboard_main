/**
 * Chai Vision Dashboard - Main Application Module
 * Entry point for the dashboard application
 */

// Import modules
import { CONFIG, validateConfig, initSupabase } from './config.js';
import { INITIAL_DATA } from '../data/initialData.js';
import { formatCurrency, formatPercent } from './utils/formatters.js';
import { getCurrentQuarter, getCurrentMonth, getCurrentYear, getDaysInPeriod, getDaysElapsed } from './utils/dateUtils.js';
import { DataService } from './services/dataService.js';
import { Dashboard } from './components/Dashboard.js';
import { Settings } from './components/Settings.js';
import { Upload } from './components/Upload.js';
import { Navigation } from './components/Navigation.js';
import { Sidebar } from './components/Sidebar.js';

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
export async function initializeApp(config = CONFIG) {
    try {
        console.log('🚀 Starting Chai Vision Dashboard initialization...');
        
        // Validate configuration
        const configErrors = validateConfig();
        if (configErrors.length > 0) {
            console.warn('Configuration warnings:', configErrors);
        }
        
        // Initialize Supabase if configured
        if (config.FEATURES.ENABLE_SUPABASE) {
            APP_STATE.supabaseClient = initSupabase();
        }
        
        // Initialize data service
        APP_STATE.dataService = new DataService(APP_STATE.supabaseClient, config);
        
        // Load user preferences from localStorage
        loadUserPreferences();
        
        // Initialize React components
        initializeReactApp();
        
        // Set up event listeners
        setupEventListeners();
        
        // Mark as initialized
        APP_STATE.initialized = true;
        
        console.log('✅ Chai Vision Dashboard initialized successfully!');
        
        // Log environment info
        if (config.DEV.ENABLE_LOGGING) {
            logEnvironmentInfo();
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
        showErrorMessage('Failed to initialize dashboard. Please refresh the page.');
    }
}

/**
 * Initialize React application
 */
function initializeReactApp() {
    const { useState, useEffect, useMemo, useRef, createElement: h } = React;
    
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
        
        // Load initial data
        useEffect(() => {
            loadInitialData();
        }, []);
        
        async function loadInitialData() {
            try {
                setLoading(true);
                const data = await APP_STATE.dataService.loadSalesData();
                setSalesData(data);
                setLoading(false);
            } catch (err) {
                console.error('Failed to load data:', err);
                setError('Failed to load sales data');
                setLoading(false);
            }
        }
        
        // Render navigation
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
            brands: INITIAL_DATA.brands,
            activeSection
        });
        
        // Render sidebar
        const sidebar = h(Sidebar, {
            activeSection,
            setActiveSection
        });
        
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
                    return h(Dashboard, {
                        view,
                        selectedPeriod,
                        selectedMonth,
                        selectedYear,
                        selectedBrand,
                        salesData,
                        config: CONFIG,
                        dataService: APP_STATE.dataService
                    });
                    
                case 'settings':
                    return h(Settings, {
                        brands: INITIAL_DATA.brands,
                        targets: INITIAL_DATA.targets,
                        channels: INITIAL_DATA.channels,
                        onUpdate: handleSettingsUpdate
                    });
                    
                case 'upload':
                    return h(Upload, {
                        dataService: APP_STATE.dataService,
                        onUploadComplete: handleUploadComplete,
                        config: CONFIG
                    });
                    
                default:
                    return h('div', null, 'Section not found');
            }
        };
        
        // Handle settings update
        const handleSettingsUpdate = async (updatedData) => {
            try {
                await APP_STATE.dataService.updateSettings(updatedData);
                // Reload data if needed
                await loadInitialData();
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
        const stored = localStorage.getItem(CONFIG.DATA.STORAGE_KEYS.USER_PREFERENCES);
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
    // Apply dark mode if enabled
    if (preferences.darkMode && CONFIG.FEATURES.ENABLE_DARK_MODE) {
        document.body.setAttribute('data-theme', 'dark');
    }
    
    // Apply other preferences as needed
}

/**
 * Save user preferences
 */
function saveUserPreferences(preferences) {
    try {
        APP_STATE.preferences = { ...APP_STATE.preferences, ...preferences };
        localStorage.setItem(
            CONFIG.DATA.STORAGE_KEYS.USER_PREFERENCES,
            JSON.stringify(APP_STATE.preferences)
        );
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
            document.body.removeChild(notification);
        }, 300);
    }, CONFIG.NOTIFICATIONS.DURATION);
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
function logEnvironmentInfo() {
    console.group('📊 Environment Information');
    console.log('Version:', CONFIG.APP.VERSION);
    console.log('Environment:', CONFIG.DEV.ENABLE_LOGGING ? 'Development' : 'Production');
    console.log('Features:', CONFIG.FEATURES);
    console.log('Supabase:', APP_STATE.supabaseClient ? 'Connected' : 'Not configured');
    console.log('Browser:', navigator.userAgent);
    console.log('Screen:', `${window.innerWidth}x${window.innerHeight}`);
    console.log('Local Storage Available:', typeof Storage !== 'undefined');
    console.groupEnd();
}

// Add CSS for notifications
const style = document.createElement('style');
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

// Export for use in other modules
export { APP_STATE, showSuccessMessage, showErrorMessage, showWarningMessage };

// Make initialization function available globally for the HTML file
window.initializeApp = initializeApp;
