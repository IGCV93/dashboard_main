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
            VERSION: '2.0.0', // Updated for auth version
            DESCRIPTION: 'Sales Performance Dashboard with Authentication',
            AUTHOR: 'Chai Vision',
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

        // Supabase Configuration - REPLACE WITH YOUR ACTUAL VALUES
        SUPABASE: {
            // IMPORTANT: Replace these with your actual Supabase project details
            URL: getEnvVar('https://ebardgekhelbaoiwzwmu.supabase.co', 'https://ebardgekhelbaoiwzwmu.supabase.co'), // Replace with your URL
            ANON_KEY: getEnvVar('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViYXJkZ2VraGVsYmFvaXd6d211Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM4MzksImV4cCI6MjA3MTgwOTgzOX0.9DAaE4c4C8HOaNcV7J3xhfdTc85Drc2fKnLTs_4lk0w', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViYXJkZ2VraGVsYmFvaXd6d211Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM4MzksImV4cCI6MjA3MTgwOTgzOX0.9DAaE4c4C8HOaNcV7J3xhfdTc85Drc2fKnLTs_4lk0w'), // Replace with your anon key
            ENABLED: true, // Set to true to enable Supabase
            
            // Table names (matching our schema)
            TABLES: {
                // Core tables
                SALES_DATA: 'sales_data',
                BRANDS: 'brands',
                CHANNELS: 'channels',
                
                // KPI tables
                TARGETS: 'kpi_targets',
                TARGETS_HISTORY: 'kpi_targets_history',
                
                // User tables
                USERS: 'profiles',
                BRAND_PERMISSIONS: 'user_brand_permissions',
                CHANNEL_PERMISSIONS: 'user_channel_permissions',
                
                // System tables
                AUDIT_LOGS: 'audit_logs',
                USER_PREFERENCES: 'user_preferences'
            },
            
            // Auth settings
            AUTH: {
                PERSIST_SESSION: true,
                AUTO_REFRESH_TOKEN: true,
                DETECT_SESSION_IN_URL: true,
                STORAGE_KEY: 'chai-vision-auth',
                COOKIE_OPTIONS: {
                    name: 'chai-vision-auth',
                    lifetime: 60 * 60 * 24 * 30, // 30 days
                    domain: '',
                    path: '/',
                    sameSite: 'lax'
                }
            }
        },

        // Feature Flags
        FEATURES: {
            ENABLE_SUPABASE: true, // Enable Supabase integration
            ENABLE_DEMO_MODE: true, // Keep demo mode available
            ENABLE_DARK_MODE: false,
            ENABLE_EXPORT: true,
            ENABLE_NOTIFICATIONS: false, // Set to false as per requirements
            ENABLE_ADVANCED_ANALYTICS: false,
            ENABLE_AI_INSIGHTS: false,
            ENABLE_AUTH: true, // Enable authentication
            REQUIRE_LOGIN: true, // Require login to access dashboard
            ENABLE_PASSWORD_RESET: true, // Enable password reset functionality
            ENABLE_USER_MANAGEMENT: true, // Enable user management for admins
            ENABLE_AUDIT_LOGS: true, // Enable audit logging
            ENABLE_USER_PREFERENCES: true // Enable saving user preferences
        },

        // User Roles Configuration
        ROLES: {
            ADMIN: 'Admin',
            MANAGER: 'Manager',
            USER: 'User',
            
            // Role permissions
            PERMISSIONS: {
                'Admin': {
                    canViewDashboard: true,
                    canEditKPIs: true,
                    canUploadData: true,
                    canManageUsers: true,
                    canViewAuditLogs: true,
                    canExportData: true,
                    canEditSettings: true,
                    canDeleteData: true
                },
                'Manager': {
                    canViewDashboard: true,
                    canEditKPIs: true,
                    canUploadData: true,
                    canManageUsers: false,
                    canViewAuditLogs: false,
                    canExportData: true,
                    canEditSettings: true,
                    canDeleteData: false
                },
                'User': {
                    canViewDashboard: true,
                    canEditKPIs: false,
                    canUploadData: false,
                    canManageUsers: false,
                    canViewAuditLogs: false,
                    canExportData: false,
                    canEditSettings: false,
                    canDeleteData: false
                }
            }
        },

        // Demo Accounts Configuration
        DEMO_ACCOUNTS: {
            ENABLED: true,
            ACCOUNTS: [
                {
                    email: 'demo-admin@chaivision.com',
                    password: 'demo123',
                    role: 'Admin',
                    name: 'Demo Admin'
                },
                {
                    email: 'demo-manager@chaivision.com',
                    password: 'demo123',
                    role: 'Manager',
                    name: 'Demo Manager'
                },
                {
                    email: 'demo-user@chaivision.com',
                    password: 'demo123',
                    role: 'User',
                    name: 'Demo User'
                }
            ]
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
                SESSION_DATA: 'chai_vision_session',
                REMEMBER_ME: 'chai_vision_remember',
                LAST_SELECTED_BRAND: 'chai_vision_last_brand',
                LAST_SELECTED_PERIOD: 'chai_vision_last_period',
                LAST_SELECTED_VIEW: 'chai_vision_last_view'
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
                ANALYTICS: '/api/analytics',
                USERS: '/api/users',
                AUTH: '/api/auth'
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
            TIMEZONE: 'America/New_York',
            DEFAULT_PERIOD: 'quarterly',
            DEFAULT_QUARTER: 'Q4', // Current quarter
            DEFAULT_YEAR: '2025'
        },

        // Performance Settings
        PERFORMANCE: {
            DEBOUNCE_DELAY: 300,
            THROTTLE_DELAY: 100,
            LAZY_LOAD: true,
            VIRTUAL_SCROLL_THRESHOLD: 100,
            MAX_CHART_DATA_POINTS: 365,
            REALTIME_UPDATE_INTERVAL: 30000, // 30 seconds for real-time updates
            MAX_CONCURRENT_REQUESTS: 5
        },

        // Security Settings
        SECURITY: {
            ENABLE_HTTPS_ONLY: ENV.PRODUCTION,
            CSP_ENABLED: false,
            SANITIZE_INPUTS: true,
            MAX_LOGIN_ATTEMPTS: 5,
            SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
            PASSWORD_MIN_LENGTH: 6,
            REQUIRE_STRONG_PASSWORD: false,
            ENABLE_TWO_FACTOR: false,
            ALLOWED_EMAIL_DOMAINS: [], // Empty = allow all
            IP_WHITELIST: [] // Empty = allow all
        },

        // Analytics (Optional)
        ANALYTICS: {
            GOOGLE_ANALYTICS_ID: getEnvVar('GOOGLE_ANALYTICS_ID', ''),
            MIXPANEL_TOKEN: getEnvVar('MIXPANEL_TOKEN', ''),
            ENABLE_TRACKING: ENV.PRODUCTION && false // Disabled for now
        },

        // Error Reporting (Optional)
        ERROR_REPORTING: {
            ENABLED: ENV.PRODUCTION,
            SENTRY_DSN: getEnvVar('SENTRY_DSN', ''),
            LOG_LEVEL: ENV.PRODUCTION ? 'error' : 'debug'
        },

        // Notification Settings (Currently disabled)
        NOTIFICATIONS: {
            ENABLED: false,
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
            PDF_FORMAT: 'A4',
            INCLUDE_TIMESTAMPS: true,
            INCLUDE_USER_INFO: true
        },

        // Development Tools
        DEV: {
            ENABLE_LOGGING: ENV.DEVELOPMENT,
            ENABLE_PERFORMANCE_MONITORING: ENV.DEVELOPMENT,
            MOCK_API_DELAY: 500,
            SHOW_DEBUG_INFO: ENV.DEVELOPMENT,
            BYPASS_AUTH: false, // Set to true to bypass auth in development
            USE_LOCAL_DATA: false // Set to true to use localStorage instead of Supabase
        }
    };

    // Validate configuration on load
    const validateConfig = () => {
        const errors = [];
        
        // Check Supabase configuration if enabled
        if (CONFIG.FEATURES.ENABLE_SUPABASE) {
            if (CONFIG.SUPABASE.URL === 'https://YOUR-PROJECT-ID.supabase.co') {
                errors.push('Supabase URL not configured - please update with your project URL');
            }
            if (CONFIG.SUPABASE.ANON_KEY === 'YOUR-ANON-KEY-HERE') {
                errors.push('Supabase Anon Key not configured - please update with your anon key');
            }
        }
        
        // Check if auth is properly configured
        if (CONFIG.FEATURES.ENABLE_AUTH && !CONFIG.FEATURES.ENABLE_SUPABASE) {
            console.warn('Authentication is enabled but Supabase is disabled. Auth will use demo mode.');
        }
        
        // Check logo configuration
        if (!CONFIG.BRANDING.LOGO_URL && CONFIG.BRANDING.FALLBACK_LOGOS.length === 0) {
            console.info('No logo configured. Using default CV design.');
        }
        
        // Log configuration status
        if (CONFIG.DEV.ENABLE_LOGGING) {
            console.log('🔧 Configuration loaded:', {
                environment: ENV.PRODUCTION ? 'production' : 'development',
                version: CONFIG.APP.VERSION,
                features: CONFIG.FEATURES,
                supabase: CONFIG.FEATURES.ENABLE_SUPABASE ? 'enabled' : 'disabled',
                auth: CONFIG.FEATURES.ENABLE_AUTH ? 'enabled' : 'disabled',
                demoMode: CONFIG.FEATURES.ENABLE_DEMO_MODE ? 'enabled' : 'disabled'
            });
        }
        
        return errors;
    };

    // Initialize Supabase client if configured
    const initSupabase = () => {
        if (!CONFIG.FEATURES.ENABLE_SUPABASE) {
            console.log('Supabase is disabled in configuration');
            return null;
        }
        
        try {
            if (window.supabase && 
                CONFIG.SUPABASE.URL !== 'https://YOUR-PROJECT-ID.supabase.co' && 
                CONFIG.SUPABASE.ANON_KEY !== 'YOUR-ANON-KEY-HERE') {
                
                const client = window.supabase.createClient(
                    CONFIG.SUPABASE.URL,
                    CONFIG.SUPABASE.ANON_KEY,
                    {
                        auth: CONFIG.SUPABASE.AUTH
                    }
                );
                
                console.log('✅ Supabase client initialized');
                return client;
            } else {
                console.warn('Supabase credentials not properly configured');
                return null;
            }
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            return null;
        }
    };

    // Helper function to check if user has permission
    const hasPermission = (userRole, permission) => {
        const rolePermissions = CONFIG.ROLES.PERMISSIONS[userRole];
        return rolePermissions ? rolePermissions[permission] : false;
    };

    // Make available globally
    window.CONFIG = CONFIG;
    window.validateConfig = validateConfig;
    window.initSupabase = initSupabase;
    window.hasPermission = hasPermission;
    
    // Also add to ChaiVision namespace
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.CONFIG = CONFIG;
    window.ChaiVision.validateConfig = validateConfig;
    window.ChaiVision.initSupabase = initSupabase;
    window.ChaiVision.hasPermission = hasPermission;
    
    // Run validation on load
    const configErrors = validateConfig();
    if (configErrors.length > 0 && CONFIG.DEV.ENABLE_LOGGING) {
        console.warn('⚠️ Configuration issues detected:', configErrors);
    }
})();
