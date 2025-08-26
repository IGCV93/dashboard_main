/**
 * Chai Vision Dashboard - Configuration Module
 * Central configuration for all application settings
 */

(function() {
    'use strict';
    
    // Environment configuration
    const ENV = {
        PRODUCTION: window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1',
        DEVELOPMENT: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    };

    // Load environment variables (if using a build tool)
    // In production, these would be replaced during build
    const getEnvVar = (key, defaultValue = '') => {
        // Check if environment variables are available (e.g., through a build process)
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key];
        }
        // Check localStorage for development overrides
        if (ENV.DEVELOPMENT) {
            const stored = localStorage.getItem(`CHAI_VISION_${key}`);
            if (stored) return stored;
        }
        return defaultValue;
    };

    // Main Configuration Object
    const CONFIG = {
        // Application Info
        APP: {
            NAME: 'Chai Vision',
            VERSION: '1.0.0',
            DESCRIPTION: 'Sales Performance Dashboard',
            AUTHOR: 'Your Company Name',
            SUPPORT_EMAIL: 'support@chaivision.com'
        },

        // Company Branding
        BRANDING: {
            // Add your logo URL here
            LOGO_URL: getEnvVar('LOGO_URL', ''), // e.g., 'https://i.imgur.com/YOUR_IMAGE.png'
            
            // Fallback logo URLs (if main fails)
            FALLBACK_LOGOS: [
                // Add backup logo URLs here
            ],
            
            // Company colors (override CSS variables if needed)
            COLORS: {
                PRIMARY: '#667eea',
                SECONDARY: '#764ba2',
                SUCCESS: '#10B981',
                WARNING: '#F59E0B',
                DANGER: '#EF4444'
            }
        },

        // Supabase Configuration
        SUPABASE: {
            URL: getEnvVar('SUPABASE_URL', 'YOUR_SUPABASE_URL'),
            ANON_KEY: getEnvVar('SUPABASE_ANON_KEY', 'YOUR_SUPABASE_ANON_KEY'),
            ENABLED: false, // Set to true when Supabase is configured
            
            // Table names
            TABLES: {
                SALES_DATA: 'sales_data',
                BRANDS: 'brands',
                TARGETS: 'targets',
                USERS: 'users'
            }
        },

        // Feature Flags
        FEATURES: {
            ENABLE_SUPABASE: getEnvVar('ENABLE_SUPABASE', 'false') === 'true',
            ENABLE_DEMO_MODE: getEnvVar('ENABLE_DEMO_MODE', 'true') === 'true',
            ENABLE_DARK_MODE: getEnvVar('ENABLE_DARK_MODE', 'false') === 'true',
            ENABLE_EXPORT: true,
            ENABLE_NOTIFICATIONS: true,
            ENABLE_ADVANCED_ANALYTICS: false,
            ENABLE_AI_INSIGHTS: false
        },

        // Data Settings
        DATA: {
            // Cache duration in milliseconds
            CACHE_DURATION: ENV.PRODUCTION ? 5 * 60 * 1000 : 1000, // 5 min in prod, 1 sec in dev
            
            // Max file upload size in bytes (10MB)
            MAX_UPLOAD_SIZE: 10 * 1024 * 1024,
            
            // Supported file formats
            SUPPORTED_FORMATS: ['.csv', '.xlsx', '.xls'],
            
            // Batch size for uploads
            UPLOAD_BATCH_SIZE: 1000,
            
            // Auto-save interval (milliseconds)
            AUTO_SAVE_INTERVAL: 30000, // 30 seconds
            
            // Local storage keys
            STORAGE_KEYS: {
                SALES_DATA: 'chai_vision_sales_data',
                USER_PREFERENCES: 'chai_vision_preferences',
                CACHED_TARGETS: 'chai_vision_targets',
                SESSION_DATA: 'chai_vision_session'
            }
        },

        // API Endpoints (for future use)
        API: {
            BASE_URL: ENV.PRODUCTION ? 'https://api.chaivision.com' : 'http://localhost:3000',
            ENDPOINTS: {
                SALES: '/api/sales',
                BRANDS: '/api/brands',
                TARGETS: '/api/targets',
                UPLOAD: '/api/upload',
                EXPORT: '/api/export',
                ANALYTICS: '/api/analytics'
            },
            TIMEOUT: 30000, // 30 seconds
            RETRY_ATTEMPTS: 3
        },

        // Chart Configuration
        CHARTS: {
            DEFAULT_HEIGHT: 400,
            ANIMATION_DURATION: 750,
            RESPONSIVE: true,
            MAINTAIN_ASPECT_RATIO: false,
            
            // Chart.js global defaults
            DEFAULTS: {
                font: {
                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    size: 12
                },
                color: '#6B7280'
            }
        },

        // Date Settings
        DATES: {
            DEFAULT_FORMAT: 'YYYY-MM-DD',
            DISPLAY_FORMAT: 'MMM DD, YYYY',
            FISCAL_YEAR_START: 1, // January
            WEEK_START: 0, // Sunday
            TIMEZONE: 'America/New_York'
        },

        // Performance Settings
        PERFORMANCE: {
            DEBOUNCE_DELAY: 300,
            THROTTLE_DELAY: 100,
            LAZY_LOAD: true,
            VIRTUAL_SCROLL_THRESHOLD: 100,
            MAX_CHART_DATA_POINTS: 365
        },

        // Security Settings
        SECURITY: {
            ENABLE_HTTPS_ONLY: ENV.PRODUCTION,
            CSP_ENABLED: false,
            SANITIZE_INPUTS: true,
            MAX_LOGIN_ATTEMPTS: 5,
            SESSION_TIMEOUT: 30 * 60 * 1000 // 30 minutes
        },

        // Analytics (Optional)
        ANALYTICS: {
            GOOGLE_ANALYTICS_ID: getEnvVar('GOOGLE_ANALYTICS_ID', ''),
            MIXPANEL_TOKEN: getEnvVar('MIXPANEL_TOKEN', ''),
            ENABLE_TRACKING: ENV.PRODUCTION
        },

        // Error Reporting (Optional)
        ERROR_REPORTING: {
            ENABLED: ENV.PRODUCTION,
            SENTRY_DSN: getEnvVar('SENTRY_DSN', ''),
            LOG_LEVEL: ENV.PRODUCTION ? 'error' : 'debug'
        },

        // Notification Settings
        NOTIFICATIONS: {
            POSITION: 'top-right',
            DURATION: 5000,
            MAX_STACK: 3,
            ENABLE_SOUND: false
        },

        // Export Settings
        EXPORT: {
            CSV_DELIMITER: ',',
            EXCEL_SHEET_NAME: 'Sales Data',
            PDF_ORIENTATION: 'landscape',
            PDF_FORMAT: 'A4'
        },

        // Development Tools
        DEV: {
            ENABLE_LOGGING: ENV.DEVELOPMENT,
            ENABLE_PERFORMANCE_MONITORING: ENV.DEVELOPMENT,
            MOCK_API_DELAY: 500,
            SHOW_DEBUG_INFO: ENV.DEVELOPMENT
        }
    };

    // Validate configuration on load
    const validateConfig = () => {
        const errors = [];
        
        // Check Supabase configuration if enabled
        if (CONFIG.FEATURES.ENABLE_SUPABASE) {
            if (CONFIG.SUPABASE.URL === 'YOUR_SUPABASE_URL') {
                errors.push('Supabase URL not configured');
            }
            if (CONFIG.SUPABASE.ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
                errors.push('Supabase Anon Key not configured');
            }
        }
        
        // Check logo configuration
        if (!CONFIG.BRANDING.LOGO_URL && CONFIG.BRANDING.FALLBACK_LOGOS.length === 0) {
            console.info('No logo configured. Using default design.');
        }
        
        // Log configuration status
        if (CONFIG.DEV.ENABLE_LOGGING) {
            console.log('🔧 Configuration loaded:', {
                environment: ENV.PRODUCTION ? 'production' : 'development',
                features: CONFIG.FEATURES,
                supabase: CONFIG.FEATURES.ENABLE_SUPABASE ? 'enabled' : 'disabled',
                version: CONFIG.APP.VERSION
            });
        }
        
        return errors;
    };

    // Initialize Supabase client if configured
    const initSupabase = () => {
        if (!CONFIG.FEATURES.ENABLE_SUPABASE) {
            return null;
        }
        
        try {
            if (window.supabase && 
                CONFIG.SUPABASE.URL !== 'YOUR_SUPABASE_URL' && 
                CONFIG.SUPABASE.ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
                
                const client = window.supabase.createClient(
                    CONFIG.SUPABASE.URL,
                    CONFIG.SUPABASE.ANON_KEY
                );
                
                console.log('✅ Supabase client initialized');
                return client;
            }
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
        }
        
        return null;
    };

    // Make available globally
    window.CONFIG = CONFIG;
    window.validateConfig = validateConfig;
    window.initSupabase = initSupabase;
    
    // Also add to ChaiVision namespace
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.CONFIG = CONFIG;
    window.ChaiVision.validateConfig = validateConfig;
    window.ChaiVision.initSupabase = initSupabase;
})();
