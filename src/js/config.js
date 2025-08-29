/**
 * Chai Vision Dashboard - Configuration Module
 * Central configuration for all application settings with performance optimizations
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
            URL: getEnvVar('SUPABASE_URL', 'https://ebardgekhelbaoiwzwmu.supabase.co'), // Replace with your URL
            ANON_KEY: getEnvVar('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViYXJkZ2VraGVsYmFvaXd6d211Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM4MzksImV4cCI6MjA3MTgwOTgzOX0.9DAaE4c4C8HOaNcV7J3xhfdTc85Drc2fKnLTs_4lk0w'), // Replace with your anon key
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
            },
            
            // Performance settings for Supabase
            PERFORMANCE: {
                CONNECTION_POOL_SIZE: 10,
                REQUEST_TIMEOUT: 30000,
                RETRY_ATTEMPTS: 3,
                RETRY_DELAY: 1000,
                BATCH_SIZE: 1000,
                CACHE_DURATION: 5 * 60 * 1000 // 5 minutes
            }
        },

        // Feature Flags
        FEATURES: {
            ENABLE_SUPABASE: true,
            ENABLE_AUTH: true,
            ENABLE_DEMO_MODE: true,
            ENABLE_DARK_MODE: true,
            ENABLE_NOTIFICATIONS: true,
            ENABLE_AUDIT_LOGS: true,
            ENABLE_USER_MANAGEMENT: true,
            ENABLE_DATA_EXPORT: true,
            ENABLE_REAL_TIME_UPDATES: false, // Disabled for performance
            ENABLE_OFFLINE_MODE: true,
            ENABLE_PWA: false, // Disabled for now
            ENABLE_ANALYTICS: false, // Disabled for privacy
            ENABLE_TUTORIALS: false,
            ENABLE_KEYBOARD_SHORTCUTS: true,
            ENABLE_AUTO_SAVE: true,
            ENABLE_BATCH_OPERATIONS: true
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
            RETRY_ATTEMPTS: 3,
            RATE_LIMIT: {
                REQUESTS_PER_MINUTE: 60,
                BURST_LIMIT: 10
            }
        },

        // Chart Configuration with performance optimizations
        CHARTS: {
            DEFAULT_HEIGHT: 400,
            ANIMATION_DURATION: 750,
            RESPONSIVE: true,
            MAINTAIN_ASPECT_RATIO: false,
            LAZY_LOADING: true,
            VIRTUALIZATION_THRESHOLD: 1000,
            MAX_DATA_POINTS: 365,
            REDUCE_MOTION: true,
            
            // Chart.js global defaults
            DEFAULTS: {
                font: {
                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    size: 12
                },
                color: '#6B7280',
                animation: {
                    duration: 750,
                    easing: 'easeOutQuart'
                },
                responsiveAnimationDuration: 500
            },
            
            // Performance settings
            PERFORMANCE: {
                ENABLE_LAZY_LOADING: true,
                ENABLE_VIRTUALIZATION: true,
                ENABLE_DEBOUNCING: true,
                DEBOUNCE_DELAY: 100,
                ENABLE_MEMOIZATION: true,
                CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
                MAX_CACHE_SIZE: 50 // Maximum number of cached chart configurations
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
            DEFAULT_YEAR: '2025',
            CACHE_DURATION: 24 * 60 * 60 * 1000 // 24 hours
        },

        // Performance Settings - Enhanced
        PERFORMANCE: {
            // Debouncing and throttling
            DEBOUNCE_DELAY: 300,
            THROTTLE_DELAY: 100,
            SEARCH_DEBOUNCE: 500,
            SCROLL_THROTTLE: 16, // ~60fps
            
            // Lazy loading
            LAZY_LOAD: true,
            LAZY_LOAD_THRESHOLD: 0.1,
            LAZY_LOAD_ROOT_MARGIN: '50px',
            
            // Virtualization
            VIRTUAL_SCROLL_THRESHOLD: 100,
            VIRTUAL_SCROLL_ITEM_HEIGHT: 50,
            
            // Data management
            MAX_CHART_DATA_POINTS: 365,
            MAX_TABLE_ROWS: 1000,
            BATCH_SIZE: 100,
            
            // Caching
            CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
            MEMORY_CACHE_SIZE: 100,
            DISK_CACHE_SIZE: 50 * 1024 * 1024, // 50MB
            
            // Real-time updates
            REALTIME_UPDATE_INTERVAL: 30000, // 30 seconds for real-time updates
            MAX_CONCURRENT_REQUESTS: 5,
            REQUEST_QUEUE_SIZE: 10,
            
            // Rendering optimizations
            ENABLE_VIRTUAL_DOM: true,
            ENABLE_MEMOIZATION: true,
            ENABLE_DEBOUNCING: true,
            ENABLE_THROTTLING: true,
            
            // Memory management
            GARBAGE_COLLECTION_INTERVAL: 60000, // 1 minute
            MAX_MEMORY_USAGE: 100 * 1024 * 1024, // 100MB
            MEMORY_WARNING_THRESHOLD: 80 * 1024 * 1024, // 80MB
            
            // Network optimizations
            ENABLE_REQUEST_CACHING: true,
            ENABLE_RESPONSE_COMPRESSION: true,
            ENABLE_CONNECTION_POOLING: true,
            
            // UI optimizations
            ENABLE_SMOOTH_SCROLLING: true,
            ENABLE_HARDWARE_ACCELERATION: true,
            ENABLE_REDUCED_MOTION: true,
            
            // Monitoring
            ENABLE_PERFORMANCE_MONITORING: true,
            PERFORMANCE_LOG_INTERVAL: 30000, // 30 seconds
            SLOW_RENDER_THRESHOLD: 16, // 16ms = 60fps
            SLOW_NETWORK_THRESHOLD: 1000 // 1 second
        },

        // Security Settings
        SECURITY: {
            ENABLE_CSRF_PROTECTION: true,
            ENABLE_XSS_PROTECTION: true,
            ENABLE_CONTENT_SECURITY_POLICY: true,
            ENABLE_HTTPS_ONLY: ENV.PRODUCTION,
            SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
            MAX_LOGIN_ATTEMPTS: 5,
            LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
            PASSWORD_MIN_LENGTH: 8,
            REQUIRE_STRONG_PASSWORDS: true,
            ENABLE_2FA: false,
            ENABLE_AUDIT_LOGGING: true,
            SENSITIVE_FIELDS: ['password', 'token', 'key', 'secret'],
            ALLOWED_ORIGINS: ENV.PRODUCTION ? ['https://chaivision.com'] : ['http://localhost:3000'],
            CORS_SETTINGS: {
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
            }
        },

        // Development Settings
        DEV: {
            ENABLE_LOGGING: !ENV.PRODUCTION,
            ENABLE_DEBUG_MODE: !ENV.PRODUCTION,
            ENABLE_HOT_RELOAD: !ENV.PRODUCTION,
            ENABLE_SOURCE_MAPS: !ENV.PRODUCTION,
            ENABLE_ERROR_BOUNDARIES: true,
            ENABLE_PERFORMANCE_PROFILING: !ENV.PRODUCTION,
            ENABLE_MEMORY_LEAK_DETECTION: !ENV.PRODUCTION,
            LOG_LEVEL: ENV.PRODUCTION ? 'error' : 'debug',
            MAX_LOG_ENTRIES: 1000,
            ENABLE_CONSOLE_OVERRIDE: !ENV.PRODUCTION,
            ENABLE_NETWORK_MONITORING: !ENV.PRODUCTION,
            ENABLE_RENDER_PROFILING: !ENV.PRODUCTION,
            ENABLE_STATE_INSPECTOR: !ENV.PRODUCTION,
            ENABLE_COMPONENT_TREE: !ENV.PRODUCTION,
            ENABLE_PERFORMANCE_METRICS: true,
            ENABLE_ERROR_REPORTING: ENV.PRODUCTION,
            ERROR_REPORTING_ENDPOINT: ENV.PRODUCTION ? 'https://errors.chaivision.com' : null
        },

        // User Interface Settings
        UI: {
            THEME: 'light', // 'light', 'dark', 'auto'
            LANGUAGE: 'en',
            CURRENCY: 'USD',
            TIMEZONE: 'America/New_York',
            DATE_FORMAT: 'MM/DD/YYYY',
            TIME_FORMAT: '12', // '12' or '24'
            DECIMAL_PLACES: 2,
            THOUSANDS_SEPARATOR: ',',
            DECIMAL_SEPARATOR: '.',
            ENABLE_ANIMATIONS: true,
            ENABLE_TRANSITIONS: true,
            ENABLE_HOVER_EFFECTS: true,
            ENABLE_FOCUS_INDICATORS: true,
            ENABLE_KEYBOARD_NAVIGATION: true,
            ENABLE_SCREEN_READER_SUPPORT: true,
            ENABLE_HIGH_CONTRAST_MODE: false,
            ENABLE_LARGE_TEXT_MODE: false,
            ENABLE_REDUCED_MOTION: false,
            ENABLE_COMPACT_MODE: false,
            SIDEBAR_COLLAPSED: false,
            DASHBOARD_LAYOUT: 'grid', // 'grid', 'list', 'compact'
            CHART_DEFAULT_TYPE: 'line', // 'line', 'bar', 'pie', 'doughnut'
            TABLE_PAGE_SIZE: 25,
            ENABLE_INFINITE_SCROLL: true,
            ENABLE_VIRTUAL_SCROLLING: true,
            ENABLE_LAZY_LOADING: true,
            ENABLE_PROGRESSIVE_LOADING: true,
            ENABLE_SKELETON_LOADING: true,
            ENABLE_ERROR_BOUNDARIES: true,
            ENABLE_OFFLINE_INDICATOR: true,
            ENABLE_LOADING_STATES: true,
            ENABLE_EMPTY_STATES: true,
            ENABLE_ERROR_STATES: true,
            ENABLE_SUCCESS_STATES: true,
            ENABLE_WARNING_STATES: true,
            ENABLE_INFO_STATES: true
        },

        // Data Settings
        DATA: {
            CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
            MAX_UPLOAD_SIZE: 10 * 1024 * 1024, // 10MB
            SUPPORTED_FORMATS: ['.csv', '.xlsx', '.xls'],
            STORAGE_KEYS: {
                SALES_DATA: 'chai_vision_sales_data',
                USER_PREFERENCES: 'chai_vision_preferences',
                CACHED_TARGETS: 'chai_vision_targets',
                SESSION_DATA: 'chai_vision_session',
                CACHE_DATA: 'chai_vision_cache',
                OFFLINE_DATA: 'chai_vision_offline'
            },
            VALIDATION: {
                MAX_ROWS: 100000,
                MAX_COLUMNS: 50,
                REQUIRED_COLUMNS: ['date', 'channel', 'brand', 'revenue'],
                DATE_FORMATS: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'],
                CURRENCY_FORMATS: ['$', '€', '£', '¥'],
                NUMBER_FORMATS: ['1,234.56', '1.234,56', '1 234.56']
            },
            EXPORT: {
                FORMATS: ['csv', 'xlsx', 'pdf'],
                MAX_EXPORT_SIZE: 10000,
                INCLUDE_CHARTS: true,
                INCLUDE_METADATA: true
            },
            BACKUP: {
                ENABLE_AUTO_BACKUP: true,
                BACKUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
                MAX_BACKUP_SIZE: 100 * 1024 * 1024, // 100MB
                BACKUP_RETENTION: 7 // days
            }
        },

        // Role-based permissions
        ROLES: {
            PERMISSIONS: {
                Admin: {
                    view_dashboard: true,
                    edit_data: true,
                    upload_data: true,
                    export_data: true,
                    manage_users: true,
                    view_audit_logs: true,
                    manage_settings: true,
                    view_analytics: true,
                    manage_brands: true,
                    manage_channels: true,
                    manage_targets: true,
                    view_reports: true,
                    create_reports: true,
                    share_reports: true,
                    delete_data: true,
                    manage_permissions: true
                },
                Manager: {
                    view_dashboard: true,
                    edit_data: true,
                    upload_data: true,
                    export_data: true,
                    manage_users: false,
                    view_audit_logs: true,
                    manage_settings: false,
                    view_analytics: true,
                    manage_brands: false,
                    manage_channels: false,
                    manage_targets: false,
                    view_reports: true,
                    create_reports: true,
                    share_reports: true,
                    delete_data: false,
                    manage_permissions: false
                },
                Analyst: {
                    view_dashboard: true,
                    edit_data: false,
                    upload_data: false,
                    export_data: true,
                    manage_users: false,
                    view_audit_logs: false,
                    manage_settings: false,
                    view_analytics: true,
                    manage_brands: false,
                    manage_channels: false,
                    manage_targets: false,
                    view_reports: true,
                    create_reports: true,
                    share_reports: false,
                    delete_data: false,
                    manage_permissions: false
                },
                Viewer: {
                    view_dashboard: true,
                    edit_data: false,
                    upload_data: false,
                    export_data: false,
                    manage_users: false,
                    view_audit_logs: false,
                    manage_settings: false,
                    view_analytics: true,
                    manage_brands: false,
                    manage_channels: false,
                    manage_targets: false,
                    view_reports: true,
                    create_reports: false,
                    share_reports: false,
                    delete_data: false,
                    manage_permissions: false
                }
            }
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
        
        // Performance validation
        if (CONFIG.PERFORMANCE.CACHE_DURATION < 60000) {
            console.warn('Cache duration is very short. Consider increasing for better performance.');
        }
        
        if (CONFIG.PERFORMANCE.MAX_CONCURRENT_REQUESTS > 10) {
            console.warn('High concurrent request limit may impact performance.');
        }
        
        // Log configuration status
        if (CONFIG.DEV.ENABLE_LOGGING) {
            console.log('🔧 Configuration loaded:', {
                environment: ENV.PRODUCTION ? 'production' : 'development',
                version: CONFIG.APP.VERSION,
                features: CONFIG.FEATURES,
                supabase: CONFIG.FEATURES.ENABLE_SUPABASE ? 'enabled' : 'disabled',
                auth: CONFIG.FEATURES.ENABLE_AUTH ? 'enabled' : 'disabled',
                demoMode: CONFIG.FEATURES.ENABLE_DEMO_MODE ? 'enabled' : 'disabled',
                performance: {
                    lazyLoading: CONFIG.PERFORMANCE.LAZY_LOAD,
                    virtualization: CONFIG.PERFORMANCE.ENABLE_VIRTUALIZATION,
                    caching: CONFIG.PERFORMANCE.ENABLE_REQUEST_CACHING
                }
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
                        auth: CONFIG.SUPABASE.AUTH,
                        db: {
                            schema: 'public'
                        },
                        global: {
                            headers: {
                                'X-Client-Info': 'chai-vision-dashboard'
                            }
                        }
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

    // Performance monitoring utilities
    const performanceUtils = {
        // Measure function execution time
        measureTime: (name, fn) => {
            const start = performance.now();
            const result = fn();
            const end = performance.now();
            console.log(`⏱️ ${name} took ${(end - start).toFixed(2)}ms`);
            return result;
        },
        
        // Debounce function
        debounce: (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },
        
        // Throttle function
        throttle: (func, limit) => {
            let inThrottle;
            return function() {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },
        
        // Memory usage monitoring
        getMemoryUsage: () => {
            if ('memory' in performance) {
                return {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                };
            }
            return null;
        },
        
        // Check if memory usage is high
        isMemoryUsageHigh: () => {
            const memory = performanceUtils.getMemoryUsage();
            if (memory && memory.used > CONFIG.PERFORMANCE.MEMORY_WARNING_THRESHOLD) {
                console.warn('⚠️ High memory usage detected:', memory);
                return true;
            }
            return false;
        }
    };

    // Make available globally
    window.CONFIG = CONFIG;
    window.validateConfig = validateConfig;
    window.initSupabase = initSupabase;
    window.hasPermission = hasPermission;
    window.performanceUtils = performanceUtils;
    
    // Also add to ChaiVision namespace
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.CONFIG = CONFIG;
    window.ChaiVision.validateConfig = validateConfig;
    window.ChaiVision.initSupabase = initSupabase;
    window.ChaiVision.hasPermission = hasPermission;
    window.ChaiVision.performanceUtils = performanceUtils;
    
    // Run validation on load
    const configErrors = validateConfig();
    if (configErrors.length > 0 && CONFIG.DEV.ENABLE_LOGGING) {
        console.warn('⚠️ Configuration issues detected:', configErrors);
    }
    
    // Initialize performance monitoring
    if (CONFIG.PERFORMANCE.ENABLE_PERFORMANCE_MONITORING) {
        setInterval(() => {
            performanceUtils.isMemoryUsageHigh();
        }, CONFIG.PERFORMANCE.PERFORMANCE_LOG_INTERVAL);
    }
    
    console.log('✅ Configuration module loaded with performance optimizations');
})();
