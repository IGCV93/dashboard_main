/**
 * Chai Vision Dashboard - Main Application Module
 * Entry point for the dashboard application
 * ENHANCED WITH AUTHENTICATION, PERMISSIONS, AND PHASE 5 FEATURES
 */

(function() {
    'use strict';
    
    // Global state
    let APP_STATE = {
        initialized: false,
        supabaseClient: null,
        dataService: null,
        currentUser: null,
        userPermissions: {
            brands: [],
            channels: []
        },
        preferences: {},
        rememberMe: false
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
            // Validate configuration
            const validateConfig = window.validateConfig || window.ChaiVision?.validateConfig;
            if (validateConfig) {
                const configErrors = validateConfig();
                if (configErrors.length > 0) {
                    // Configuration warnings detected but not logged
                }
            }
            
            // Check for remember me
            APP_STATE.rememberMe = localStorage.getItem('chai_vision_remember') === 'true';
            
            // Initialize Supabase if configured
            const initSupabase = window.initSupabase || window.ChaiVision?.initSupabase;
            if (config.FEATURES.ENABLE_SUPABASE && initSupabase) {
                APP_STATE.supabaseClient = initSupabase();
                
                // Set up auth listener with multi-tab sync
                if (APP_STATE.supabaseClient) {
                    APP_STATE.supabaseClient.auth.onAuthStateChange((event, session) => {
                        // Auth state changed: event
                        
                        // Broadcast auth changes to other tabs
                        if (window.BroadcastChannel) {
                            const channel = new BroadcastChannel('chai_vision_auth');
                            channel.postMessage({ event, session });
                        }
                        
                        if (event === 'SIGNED_OUT') {
                            handleSignOut();
                        } else if (event === 'SIGNED_IN' && session) {
                            // Sync session across tabs
                            localStorage.setItem('chai_vision_session', JSON.stringify(session));
                        }
                    });
                    
                    // Listen for auth changes from other tabs - DISABLED to prevent loops
                    // if (window.BroadcastChannel) {
                    //     const channel = new BroadcastChannel('chai_vision_auth');
                    //     channel.onmessage = (e) => {
                    //         if (e.data.event === 'SIGNED_OUT') {
                    //             window.location.reload();
                    //         } else if (e.data.event === 'SIGNED_IN') {
                    //             window.location.reload();
                    //         }
                    //     };
                    // }
                }
            }
            
            // Get DataService class
            const DataService = window.DataService || window.ChaiVision?.services?.DataService;
            if (DataService) {
                APP_STATE.dataService = new DataService(APP_STATE.supabaseClient, config);
            } else {
                // DataService not found, using fallback
                APP_STATE.dataService = createFallbackDataService(config);
            }
            
            // Save preferences periodically
            setInterval(saveUserPreferences, 30000); // Every 30 seconds
            
            // Initialize React components
            initializeReactApp(config);
            
            // Set up event listeners
            setupEventListeners();
            
            // Mark as initialized
            APP_STATE.initialized = true;
            
            // Dashboard initialized successfully
            
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            if (window.showErrorMessage) {
                window.showErrorMessage('Failed to initialize dashboard. Please refresh the page.');
            }
        }
    }
    
    /**
     * Save user preferences
     */
    async function saveUserPreferences() {
        if (!APP_STATE.currentUser || !APP_STATE.preferences) return;
        
        const supabase = APP_STATE.supabaseClient;
        if (!supabase) {
            localStorage.setItem('chai_vision_preferences', JSON.stringify(APP_STATE.preferences));
            return;
        }
        
        try {
            await supabase
                .from('user_preferences')
                .upsert({
                    user_id: APP_STATE.currentUser.id,
                    last_selected_brand: APP_STATE.preferences.last_selected_brand,
                    last_selected_period: APP_STATE.preferences.last_selected_period,
                    last_selected_year: APP_STATE.preferences.last_selected_year,
                    last_selected_view: APP_STATE.preferences.last_selected_view,
                    updated_at: new Date().toISOString()
                });
        } catch (error) {
            console.error('Failed to save preferences:', error);
            // If it's a conflict error, try to update instead
            if (error.code === '23505' || error.message.includes('duplicate key')) {
                try {
                    await supabase
                        .from('user_preferences')
                        .update({
                            last_selected_brand: APP_STATE.preferences.last_selected_brand,
                            last_selected_period: APP_STATE.preferences.last_selected_period,
                            last_selected_year: APP_STATE.preferences.last_selected_year,
                            last_selected_view: APP_STATE.preferences.last_selected_view,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', APP_STATE.currentUser.id);
                } catch (updateError) {
                    console.error('Failed to update preferences:', updateError);
                }
            }
        }
    }
    
    /**
     * Load user preferences
     */
    async function loadUserPreferences(userId) {
        const supabase = APP_STATE.supabaseClient;
        if (!supabase) {
            const saved = localStorage.getItem('chai_vision_preferences');
            return saved ? JSON.parse(saved) : {};
        }
        
        try {
            const { data } = await supabase
                .from('user_preferences')
                .select('last_selected_brand, last_selected_period, last_selected_year, last_selected_view, theme, compact_mode, notifications_enabled, refresh_interval, show_tutorials, auto_save')
                .eq('user_id', userId)
                .single();
            
            return data || {};
        } catch (error) {
            console.error('Failed to load preferences:', error);
            return {};
        }
    }
    
    /**
     * Apply user preferences to the application
     */
    function applyUserPreferences(prefs) {
        // Apply theme
        if (prefs.theme) {
            applyTheme(prefs.theme);
        }
        
        // Apply compact mode
        if (prefs.compact_mode !== undefined) {
            applyCompactMode(prefs.compact_mode);
        }
        
        // Apply notifications
        if (prefs.notifications_enabled !== undefined) {
            applyNotifications(prefs.notifications_enabled);
        }
        
        // Apply refresh interval
        if (prefs.refresh_interval && prefs.auto_save) {
            applyRefreshInterval(prefs.refresh_interval);
        }
        
        // Apply tutorials
        if (prefs.show_tutorials !== undefined) {
            applyTutorials(prefs.show_tutorials);
        }
    }
    
    /**
     * Apply theme to the application
     */
    function applyTheme(theme) {
        const root = document.documentElement;
        const body = document.body;
        
        // Remove existing theme classes
        root.classList.remove('theme-light', 'theme-dark');
        body.classList.remove('theme-light', 'theme-dark');
        
        // Add new theme class
        root.classList.add(`theme-${theme}`);
        body.classList.add(`theme-${theme}`);
        
        // Update CSS custom properties
        if (theme === 'dark') {
            root.style.setProperty('--bg-primary', '#1f2937');
            root.style.setProperty('--bg-secondary', '#374151');
            root.style.setProperty('--text-primary', '#f9fafb');
            root.style.setProperty('--text-secondary', '#d1d5db');
            root.style.setProperty('--border-color', '#4b5563');
        } else {
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f9fafb');
            root.style.setProperty('--text-primary', '#1f2937');
            root.style.setProperty('--text-secondary', '#6b7280');
            root.style.setProperty('--border-color', '#e5e7eb');
        }
        
        // Theme applied: ${theme}
    }
    
    /**
     * Apply compact mode
     */
    function applyCompactMode(enabled) {
        const root = document.documentElement;
        
        if (enabled) {
            root.classList.add('compact-mode');
            root.style.setProperty('--spacing-base', '0.75rem');
            root.style.setProperty('--font-size-base', '0.875rem');
        } else {
            root.classList.remove('compact-mode');
            root.style.setProperty('--spacing-base', '1rem');
            root.style.setProperty('--font-size-base', '1rem');
        }
        
        // Compact mode: ${enabled ? 'enabled' : 'disabled'}
    }
    
    /**
     * Apply notifications setting
     */
    function applyNotifications(enabled) {
        if (enabled) {
            // Request notification permission if not already granted
            if (Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    // Notification permission handled
                });
            } else if (Notification.permission === 'granted') {
                // Notifications already enabled
            }
        } else {
            // Notifications disabled
        }
    }
    
    /**
     * Apply refresh interval
     */
    function applyRefreshInterval(interval) {
        // Clear existing refresh interval
        if (window.chaiVisionRefreshInterval) {
            clearInterval(window.chaiVisionRefreshInterval);
        }
        
        // Set new refresh interval if auto-save is enabled
        if (interval > 0) {
            window.chaiVisionRefreshInterval = setInterval(() => {
                // Trigger data refresh
                if (window.APP_STATE && window.APP_STATE.dataService) {
                    // Auto-refreshing data
                    // This would trigger a data refresh in the dashboard
                    if (window.refreshDashboardData) {
                        window.refreshDashboardData();
                    }
                }
            }, interval * 1000);
            
            // Refresh interval set to ${interval} seconds
        }
    }
    
    /**
     * Apply tutorials setting
     */
    function applyTutorials(enabled) {
        if (enabled) {
            // Show tutorial tooltips or guides
            // Tutorials enabled
            // This would show tutorial elements
            document.body.classList.add('show-tutorials');
        } else {
            // Hide tutorial elements
            // Tutorials disabled
            document.body.classList.remove('show-tutorials');
        }
    }
    
    /**
     * Handle sign out
     */
    function handleSignOut() {
        // Handling sign out
        
        // Clear all local storage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('chai_vision_')) {
                localStorage.removeItem(key);
            }
        });
        
        // Clear session storage
        sessionStorage.clear();
        
        // Clear app state
        APP_STATE.currentUser = null;
        APP_STATE.userPermissions = { brands: [], channels: [] };
        APP_STATE.preferences = {};
        
        // Notify other tabs (but don't reload this tab)
        if (window.BroadcastChannel) {
            const channel = new BroadcastChannel('chai_vision_auth');
            channel.postMessage({ event: 'SIGNED_OUT' });
        }
        
        // Force a page reload to reset React state completely
        // Sign out completed - reloading page
        window.location.reload();
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
            },
            
            async loadUserPermissions(userId) {
                // Demo mode permissions
                return {
                    brands: ['All Brands'],
                    channels: ['All Channels']
                };
            }
        };
    }
    
    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Global error handler with better messaging
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            if (window.showErrorMessage && event.error?.message) {
                window.showErrorMessage('An error occurred. Please try again.');
            }
        });
        
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            if (window.showWarningMessage) {
                window.showWarningMessage('Something went wrong. Please refresh if issues persist.');
            }
        });
        
        // Save preferences before unload
        window.addEventListener('beforeunload', () => {
            saveUserPreferences();
        });
    }
    
    /**
     * Show error message (fallback if notifications not loaded)
     */
    function showErrorMessage(message) {
        const root = document.getElementById('root');
        if (root) {
            root.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px;">
                    <div style="text-align: center; max-width: 500px;">
                        <h2 style="color: #EF4444;">Error</h2>
                        <p style="color: #6B7280;">${message}</p>
                        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            Reload Page
                        </button>
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * Show success message (fallback)
     */
    window.showSuccessMessage = window.showSuccessMessage || function(message) {
        // Success: message
    };

    /**
     * Initialize React application
     */
    function initializeReactApp(config) {
        const { useState, useEffect, useMemo, useRef, createElement: h } = React;
        
        // Helper functions
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
            // Authentication state
            const [isAuthenticated, setIsAuthenticated] = useState(false);
            const [currentUser, setCurrentUser] = useState(null);
            const [userPermissions, setUserPermissions] = useState({ brands: [], channels: [] });
            const [showProfileMenu, setShowProfileMenu] = useState(false);
            const [checkingAuth, setCheckingAuth] = useState(true);
            
            // Dashboard state - Initialize with saved preferences or defaults
            const [view, setView] = useState(APP_STATE.preferences.last_selected_view || 'quarterly');
            const [selectedPeriod, setSelectedPeriod] = useState(APP_STATE.preferences.last_selected_period || getCurrentQuarter());
            const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
            const [selectedYear, setSelectedYear] = useState(APP_STATE.preferences.last_selected_year || getCurrentYear());
            const [selectedBrand, setSelectedBrand] = useState(APP_STATE.preferences.last_selected_brand || 'All Brands');
            const [activeSection, setActiveSection] = useState('dashboard');
            const [salesData, setSalesData] = useState([]);
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState(null);
            const initialBrandSetRef = useRef(false);
            
            // Get initial data
            const INITIAL_DATA = window.ChaiVision?.INITIAL_DATA || {};
            const channels = INITIAL_DATA.channels || ['Amazon', 'TikTok', 'DTC-Shopify', 'Retail'];
            
            // Brand and target state
            const [dynamicBrands, setDynamicBrands] = useState(INITIAL_DATA.brands || ['LifePro', 'PetCove']);
            const [dynamicTargets, setDynamicTargets] = useState(INITIAL_DATA.targets || {});
            
            // Save preferences when they change
            useEffect(() => {
                APP_STATE.preferences = {
                    last_selected_view: view,
                    last_selected_period: selectedPeriod,
                    last_selected_year: selectedYear,
                    last_selected_brand: selectedBrand
                };
            }, [view, selectedPeriod, selectedYear, selectedBrand]);
            
            // Check for saved session with remember me
            useEffect(() => {
                const checkAuth = async () => {
                    // Starting authentication check
                    setCheckingAuth(true);
                    
                    // Add timeout to prevent infinite loading
                    const authTimeout = setTimeout(() => {
                        // Auth check timeout - proceeding without authentication
                        setCheckingAuth(false);
                        setLoading(false);
                        setIsAuthenticated(false); // Force to login screen
                    }, 5000); // Reduced to 5 seconds
                    
                    try {
                        if (APP_STATE.supabaseClient && config.FEATURES.ENABLE_SUPABASE) {
                            const { data: { session } } = await APP_STATE.supabaseClient.auth.getSession();
                            
                            if (session) {
                                // Get user profile
                                const { data: profile } = await APP_STATE.supabaseClient
                                    .from('profiles')
                                    .select('*')
                                    .eq('id', session.user.id)
                                    .single();
                                
                                if (profile?.status !== 'active') {
                                    await APP_STATE.supabaseClient.auth.signOut();
                                    if (window.showErrorMessage) {
                                        window.showErrorMessage('Your account is inactive. Please contact an administrator.');
                                    }
                                    clearTimeout(authTimeout);
                                    setCheckingAuth(false);
                                    return;
                                }
                                
                                // Get user permissions
                                const { data: brandPerms } = await APP_STATE.supabaseClient
                                    .from('user_brand_permissions')
                                    .select('brand')
                                    .eq('user_id', session.user.id);
                                
                                const { data: channelPerms } = await APP_STATE.supabaseClient
                                    .from('user_channel_permissions')
                                    .select('channel')
                                    .eq('user_id', session.user.id);
                                
                                const user = {
                                    ...session.user,
                                    ...profile
                                };
                                
                                const permissions = {
                                    brands: profile?.role === 'Admin' ? ['All Brands'] : 
                                           brandPerms?.map(p => p.brand) || [],
                                    channels: profile?.role === 'Admin' ? ['All Channels'] : 
                                             channelPerms?.map(p => p.channel) || []
                                };
                                
                                                                 // Load user preferences
                                 const prefs = await loadUserPreferences(user.id);
                                 if (prefs) {
                                     if (prefs.last_selected_view) setView(prefs.last_selected_view);
                                     if (prefs.last_selected_period) setSelectedPeriod(prefs.last_selected_period);
                                     if (prefs.last_selected_year) setSelectedYear(prefs.last_selected_year);
                                     if (prefs.last_selected_brand) setSelectedBrand(prefs.last_selected_brand);
                                     APP_STATE.preferences = prefs;
                                     
                                     // Apply preferences to the application
                                     applyUserPreferences(prefs);
                                 }
                                
                                setCurrentUser(user);
                                setUserPermissions(permissions);
                                setIsAuthenticated(true);
                                APP_STATE.currentUser = user;
                                APP_STATE.userPermissions = permissions;
                                
                                if (window.showSuccessMessage) {
                                    window.showSuccessMessage(`Welcome back, ${user.full_name || user.email}!`);
                                }

                                // Ensure data loads after refresh when already authenticated
                                try { await loadInitialData(); } catch (e) { console.error('Initial data load failed:', e); }
                            } else if (APP_STATE.rememberMe) {
                                // Check for saved session in localStorage
                                const savedSession = localStorage.getItem('chai_vision_session');
                                if (savedSession) {
                                    try {
                                        const sessionData = JSON.parse(savedSession);
                                        await APP_STATE.supabaseClient.auth.setSession(sessionData);
                                    } catch (err) {
                                        console.error('Failed to restore session:', err);
                                    }
                                }
                            }
                        } else {
                            // Supabase disabled, checking demo mode
                            // Check demo mode session
                            const savedUser = localStorage.getItem('chai_vision_user_session');
                            if (savedUser) {
                                // Found saved demo user session
                                const user = JSON.parse(savedUser);
                                setCurrentUser(user);
                                setUserPermissions(user.permissions || { brands: ['All Brands'], channels: ['All Channels'] });
                                setIsAuthenticated(true);
                                APP_STATE.currentUser = user;
                                APP_STATE.userPermissions = user.permissions;
                            } else {
                                // No saved demo session found
                            }
                        }
                    } catch (error) {
                        console.error('Auth check error:', error);
                        // Don't let auth errors prevent the app from loading
                    } finally {
                        clearTimeout(authTimeout);
                        setCheckingAuth(false);
                        setLoading(false);
                    }
                };
                
                checkAuth();
            }, []);
            
            // Load brands from database on authentication
            useEffect(() => {
                const loadBrandsFromDB = async () => {
                    if (isAuthenticated && APP_STATE.dataService?.loadBrands) {
                        try {
                            const dbBrands = await APP_STATE.dataService.loadBrands();
                            if (Array.isArray(dbBrands) && dbBrands.length > 0) {
                                setDynamicBrands(dbBrands);
                            }
                        } catch (error) {
                            console.error('Failed to load brands from database:', error);
                        }
                    }
                };
                
                if (isAuthenticated) {
                    loadBrandsFromDB();
                }
            }, [isAuthenticated]);
            
            // Filter brands based on user permissions
            const availableBrands = useMemo(() => {
                if (!currentUser || !userPermissions.brands) return [];
                
                if (userPermissions.brands.includes('All Brands') || currentUser.role === 'Admin') {
                    return dynamicBrands;
                }
                
                return dynamicBrands.filter(brand => userPermissions.brands.includes(brand));
            }, [dynamicBrands, userPermissions, currentUser]);
            
            // Filter channels based on user permissions
            const availableChannels = useMemo(() => {
                if (!currentUser || !userPermissions.channels) return [];
                
                if (userPermissions.channels.includes('All Channels') || currentUser.role === 'Admin') {
                    return channels;
                }
                
                return channels.filter(channel => userPermissions.channels.includes(channel));
            }, [channels, userPermissions, currentUser]);
            
            // Set default brand on permission change
            useEffect(() => {
                if (availableBrands.length === 0) {
                    return;
                }

                if (selectedBrand === 'All Brands') {
                    return;
                }

                if (!availableBrands.includes(selectedBrand)) {
                    setSelectedBrand(availableBrands[0]);
                }
            }, [availableBrands, selectedBrand]);

            useEffect(() => {
                if (initialBrandSetRef.current) {
                    return;
                }

                if (!isAuthenticated || !currentUser) {
                    return;
                }

                const canAccessAllBrands = currentUser.role === 'Admin' ||
                    userPermissions?.brands?.includes('All Brands');

                if (canAccessAllBrands) {
                    if (selectedBrand !== 'All Brands') {
                        setSelectedBrand('All Brands');
                    }
                    initialBrandSetRef.current = true;
                    return;
                }

                if (userPermissions?.brands?.length > 0) {
                    const fallbackBrand = userPermissions.brands[0];
                    if (selectedBrand !== fallbackBrand) {
                        setSelectedBrand(fallbackBrand);
                    }
                }

                initialBrandSetRef.current = true;
            }, [isAuthenticated, currentUser, userPermissions, selectedBrand]);
            
            // Handle login
            const handleLogin = async (user) => {
                let permissions = { brands: [], channels: [] };
                
                if (config.FEATURES.ENABLE_SUPABASE && APP_STATE.supabaseClient) {
                    // Fetch from database
                    const { data: brandPerms } = await APP_STATE.supabaseClient
                        .from('user_brand_permissions')
                        .select('brand')
                        .eq('user_id', user.id);
                    
                    const { data: channelPerms } = await APP_STATE.supabaseClient
                        .from('user_channel_permissions')
                        .select('channel')
                        .eq('user_id', user.id);
                    
                    permissions = {
                        brands: user.role === 'Admin' ? ['All Brands'] : 
                               brandPerms?.map(p => p.brand) || [],
                        channels: user.role === 'Admin' ? ['All Channels'] : 
                                 channelPerms?.map(p => p.channel) || []
                    };
                } else {
                    // Demo mode permissions
                    if (user.role === 'Admin') {
                        permissions = { brands: ['All Brands'], channels: ['All Channels'] };
                    } else if (user.email === 'demo-manager@chaivision.com') {
                        permissions = { brands: ['LifePro', 'PetCove'], channels: ['Amazon', 'TikTok', 'DTC-Shopify'] };
                    } else if (user.email === 'demo-user@chaivision.com') {
                        permissions = { brands: ['LifePro'], channels: ['Amazon', 'TikTok'] };
                    }
                }
                
                const fullUser = { ...user, permissions };
                
                setCurrentUser(fullUser);
                setUserPermissions(permissions);
                setIsAuthenticated(true);
                APP_STATE.currentUser = fullUser;
                APP_STATE.userPermissions = permissions;
                
                // Save session for demo mode
                if (!config.FEATURES.ENABLE_SUPABASE) {
                    localStorage.setItem('chai_vision_user_session', JSON.stringify(fullUser));
                }
                
                // Save remember me preference
                if (APP_STATE.rememberMe) {
                    localStorage.setItem('chai_vision_remember', 'true');
                }
                
                // Set default brand if user only has access to specific brands
                if (permissions.brands.length > 0 && !permissions.brands.includes('All Brands')) {
                    setSelectedBrand(permissions.brands[0]);
                }
                
                loadInitialData();
            };
            
            // Handle logout
            const handleLogout = async () => {
                if (APP_STATE.supabaseClient && config.FEATURES.ENABLE_SUPABASE) {
                    await APP_STATE.supabaseClient.auth.signOut();
                }
                handleSignOut();
            };
            
            // Load initial data
            async function loadInitialData() {
                try {
                    // Loading initial data
                    setLoading(true);
                    setError(null);
                    
                    if (APP_STATE.dataService) {
                        // Build filters based on current selections
                        const filters = {
                            startDate: getDateRangeStart(view, selectedPeriod, selectedYear, selectedMonth),
                            endDate: getDateRangeEnd(view, selectedPeriod, selectedYear, selectedMonth),
                            brand: selectedBrand,
                            channel: 'All Channels', // Load all channels, filter in UI
                            view
                        };
                        
                        const data = await APP_STATE.dataService.loadSalesData(filters);
                        console.log(`📊 Data loaded: ${data?.length || 0} records`);
                        
                        // Only filter if we have valid permissions
                        let filteredData = data;
                        if (userPermissions.brands && userPermissions.brands.length > 0 && 
                            userPermissions.channels && userPermissions.channels.length > 0) {
                            filteredData = data.filter(d => {
                                const brandAllowed = userPermissions.brands.includes('All Brands') || 
                                                    userPermissions.brands.includes(d.brand);
                                const channelAllowed = userPermissions.channels.includes('All Channels') || 
                                                      userPermissions.channels.includes(d.channel);
                                return brandAllowed && channelAllowed;
                            });
                            console.log(`🔍 Filtered data: ${filteredData?.length || 0} records`);
                        } else {
                            console.log('📋 No permissions set, using all data');
                        }
                        
                        setSalesData(filteredData || []);
                    } else {
                        // No data service available
                        setSalesData([]);
                    }
                } catch (err) {
                    console.error('❌ Failed to load data:', err);
                    setError('Failed to load sales data');
                } finally {
                    setLoading(false);
                }
            }
            
            // Helper functions for date range calculation
            function getDateRangeStart(view, period, year, month) {
                if (view === 'annual') {
                    return `${year}-01-01`;
                } else if (view === 'quarterly') {
                    const quarterMonths = { 'Q1': '01', 'Q2': '04', 'Q3': '07', 'Q4': '10' };
                    return `${year}-${quarterMonths[period]}-01`;
                } else if (view === 'monthly') {
                    return `${year}-${String(month).padStart(2, '0')}-01`;
                }
                return null;
            }
            
            function getDateRangeEnd(view, period, year, month) {
                if (view === 'annual') {
                    return `${year}-12-31`;
                } else if (view === 'quarterly') {
                    const quarterEnds = { 'Q1': '03-31', 'Q2': '06-30', 'Q3': '09-30', 'Q4': '12-31' };
                    return `${year}-${quarterEnds[period]}`;
                } else if (view === 'monthly') {
                    const daysInMonth = new Date(year, month, 0).getDate();
                    return `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;
                }
                return null;
            }
            
            // Refresh data when filters change (with debouncing)
            useEffect(() => {
                if (isAuthenticated && APP_STATE.dataService) {
                    // Debounce filter changes to prevent rapid API calls
                    const timeoutId = setTimeout(() => {
                        loadInitialData();
                    }, 300); // 300ms delay
                    
                    return () => clearTimeout(timeoutId);
                }
            }, [view, selectedPeriod, selectedYear, selectedMonth, selectedBrand]);
            
            // Regenerate sample data only in demo mode (Supabase disabled)
            useEffect(() => {
                if (!config.FEATURES.ENABLE_SUPABASE && isAuthenticated && availableBrands.length > 0) {
                    regenerateSampleData();
                }
            }, [availableBrands, availableChannels]);
            
            function regenerateSampleData() {
                const data = [];
                const startDate = new Date('2025-01-01');
                const endDate = new Date();
                endDate.setDate(endDate.getDate() - 2);
                
                for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    const dayOfWeek = d.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    
                    availableBrands.forEach(brand => {
                        availableChannels.forEach(channel => {
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
            
            const handleDeleteBrand = async ({ brand, brands, targets }) => {
                if (!brand) {
                    return;
                }
                
                try {
                    if (APP_STATE.dataService?.deleteBrand) {
                        await APP_STATE.dataService.deleteBrand(brand);
                    }
                    
                    // Reload brands from database after deletion
                    if (APP_STATE.dataService?.loadBrands) {
                        const dbBrands = await APP_STATE.dataService.loadBrands();
                        if (Array.isArray(dbBrands) && dbBrands.length > 0) {
                            setDynamicBrands(dbBrands);
                        } else if (Array.isArray(brands)) {
                            setDynamicBrands(brands);
                        }
                    } else if (Array.isArray(brands)) {
                        setDynamicBrands(brands);
                    }
                    
                    if (targets) {
                        setDynamicTargets(targets);
                    }
                    
                    setUserPermissions((prev) => {
                        if (!prev || !Array.isArray(prev.brands)) {
                            return prev;
                        }
                        
                        if (prev.brands.includes('All Brands') || !prev.brands.includes(brand)) {
                            return prev;
                        }
                        
                        const updatedBrands = prev.brands.filter(b => b !== brand);
                        const updatedPermissions = { ...prev, brands: updatedBrands };
                        APP_STATE.userPermissions = updatedPermissions;
                        return updatedPermissions;
                    });
                    
                    if (selectedBrand === brand) {
                        if (userPermissions?.brands?.includes('All Brands') || currentUser?.role === 'Admin') {
                            setSelectedBrand('All Brands');
                        } else if (Array.isArray(brands) && brands.length > 0) {
                            setSelectedBrand(brands[0]);
                        } else {
                            setSelectedBrand('All Brands');
                        }
                    }
                    
                    if (APP_STATE.preferences?.last_selected_brand === brand) {
                        APP_STATE.preferences.last_selected_brand = 'All Brands';
                    }
                    
                    if (window.showSuccessMessage) {
                        window.showSuccessMessage(`Brand "${brand}" deleted successfully`);
                    }
                } catch (err) {
                    console.error('Failed to delete brand:', err);
                    if (window.showErrorMessage) {
                        window.showErrorMessage('Failed to delete brand. Please try again.');
                    }
                    throw err;
                }
            };
            
            // Handle settings update
            const handleSettingsUpdate = async (updatedData) => {
                try {
                    if (updatedData.brands) {
                        setDynamicBrands(updatedData.brands);
                    }
                    if (updatedData.targets) {
                        setDynamicTargets(updatedData.targets);
                    }
                    
                    if (APP_STATE.dataService) {
                        await APP_STATE.dataService.updateSettings(updatedData);
                    }
                    
                    if (window.showSuccessMessage) {
                        window.showSuccessMessage('Settings updated successfully');
                    }
                } catch (err) {
                    console.error('Failed to update settings:', err);
                    if (window.showErrorMessage) {
                        window.showErrorMessage('Failed to update settings');
                    }
                }
            };
            
            // Handle upload complete
            const handleUploadComplete = async (uploadResult) => {
                try {
                    // Handle both old format (array) and new format (object)
                    const uploadedData = uploadResult.originalData || uploadResult;
                    const actualSaved = uploadResult.actualSaved || uploadedData.length;
                    const failedRows = uploadResult.failedRows || 0;
                    
                    // Refresh data from database instead of merging with cached data
                    if (dataService) {
                        console.log('🔄 Refreshing data from database after upload...');
                        // Clear cache to ensure fresh data
                        dataService.clearCache('sales_data');
                        dataService.clearCache('channels');
                        const freshData = await dataService.loadSalesData();
                        setSalesData(freshData);
                        console.log(`📊 Loaded ${freshData.length} records from database`);
                    } else {
                        // Fallback: merge with existing data
                        const mergedData = [...salesData, ...uploadedData];
                        setSalesData(mergedData);
                    }
                    
                    if (window.showSuccessMessage) {
                        if (failedRows > 0) {
                            window.showSuccessMessage(`Upload completed: ${actualSaved} records saved, ${failedRows} records failed`);
                        } else {
                            window.showSuccessMessage(`Successfully uploaded ${actualSaved} records`);
                        }
                    }
                } catch (err) {
                    console.error('Failed to process upload:', err);
                    if (window.showErrorMessage) {
                        window.showErrorMessage('Failed to process upload');
                    }
                }
            };
            
            // Click outside handler for profile menu
            useEffect(() => {
                const handleClickOutside = (event) => {
                    if (showProfileMenu && !event.target.closest('.profile-section')) {
                        setShowProfileMenu(false);
                    }
                };
                
                document.addEventListener('click', handleClickOutside);
                return () => document.removeEventListener('click', handleClickOutside);
            }, [showProfileMenu]);
            
            // Get components from window
            const Login = window.Login || window.ChaiVision?.components?.Login;
            const Navigation = window.Navigation || window.ChaiVision?.components?.Navigation;
            const Sidebar = window.Sidebar || window.ChaiVision?.components?.Sidebar;
            const Dashboard = window.Dashboard || window.ChaiVision?.components?.Dashboard;
            const Settings = window.Settings || window.ChaiVision?.components?.Settings;
            const Upload = window.Upload || window.ChaiVision?.components?.Upload;
            const UserManagement = window.UserManagement || window.ChaiVision?.components?.UserManagement;
            const AuditLogs = window.AuditLogs || window.ChaiVision?.components?.AuditLogs;
            const ProfileMenu = window.ProfileMenu || window.ChaiVision?.components?.ProfileMenu;
            const ProfileSettings = window.ProfileSettings || window.ChaiVision?.components?.ProfileSettings;
            const Preferences = window.Preferences || window.ChaiVision?.components?.Preferences;
            
            // Component loading verified
            
            // If checking auth, show loading
            if (checkingAuth) {
                return h('div', { className: 'loading-container' },
                    h('div', { className: 'loading-spinner' }),
                    h('div', { className: 'loading-text' }, 'Checking authentication...')
                );
            }
            
            // If not authenticated, show login
            if (!isAuthenticated) {
                // User not authenticated, showing login
                if (Login) {
                    return h(Login, { 
                        onLogin: handleLogin,
                        rememberMe: APP_STATE.rememberMe,
                        setRememberMe: (value) => { APP_STATE.rememberMe = value; }
                    });
                } else {
                    console.error('❌ Login component not found!');
                    return h('div', { 
                        style: { 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            minHeight: '100vh',
                            flexDirection: 'column',
                            gap: '20px'
                        } 
                    },
                        h('h2', null, 'Login Component Not Found'),
                        h('p', null, 'Please refresh the page or contact support.'),
                        h('button', {
                            onClick: () => window.location.reload(),
                            style: {
                                padding: '10px 20px',
                                background: '#667eea',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }
                        }, 'Refresh Page')
                    );
                }
            }
            
            // State verified and ready
            
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
                brands: availableBrands,
                activeSection,
                currentUser,
                showProfileMenu,
                setShowProfileMenu,
                onLogout: handleLogout,
                userRole: currentUser?.role,
                setActiveSection,
                ProfileMenu
            }) : null;
            
            // Render sidebar
            const sidebar = Sidebar ? h(Sidebar, {
                activeSection,
                setActiveSection,
                userRole: currentUser?.role
            }) : null;
            
            // Render main content based on active section and permissions
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
                        return Dashboard ? h(Dashboard, {
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
                            salesData,
                            config,
                            dataService: APP_STATE.dataService,
                            dynamicBrands: availableBrands,
                            dynamicTargets,
                            userRole: currentUser?.role,
                            userPermissions
                        }) : h('div', null, 'Dashboard component not found');
                        
                    case 'settings':
                        // Only Admin and Manager can access settings
                        if (currentUser?.role === 'User') {
                            return h('div', { className: 'access-denied' },
                                h('h2', null, 'Access Denied'),
                                h('p', null, 'You do not have permission to access this section.')
                            );
                        }
                        return Settings ? h(Settings, {
                            brands: availableBrands,
                            targets: dynamicTargets,
                            channels: availableChannels,
                            onUpdate: handleSettingsUpdate,
                            onDeleteBrand: handleDeleteBrand,
                            userRole: currentUser?.role,
                            userPermissions,
                            currentUser
                        }) : h('div', null, 'Settings component not found');
                        
                    case 'upload':
                        // Only Admin and Manager can upload
                        if (currentUser?.role === 'User') {
                            return h('div', { className: 'access-denied' },
                                h('h2', null, 'Access Denied'),
                                h('p', null, 'You do not have permission to upload data.')
                            );
                        }
                        return Upload ? h(Upload, {
                            dataService: APP_STATE.dataService,
                            onUploadComplete: handleUploadComplete,
                            config,
                            brands: availableBrands,
                            channels: availableChannels,
                            userRole: currentUser?.role,
                            userPermissions,
                            currentUser
                        }) : h('div', null, 'Upload component not found');
                        
                    case 'users':
                        // Only Admin can access user management
                        if (currentUser?.role !== 'Admin') {
                            return h('div', { className: 'access-denied' },
                                h('h2', null, 'Access Denied'),
                                h('p', null, 'Only administrators can manage users.')
                            );
                        }
                        return UserManagement ? h(UserManagement, {
                            dataService: APP_STATE.dataService,
                            currentUser,
                            brands: dynamicBrands,
                            channels
                        }) : h('div', null, 'User Management component not found');
                        
                    case 'audit':
                        // Only Admin can access audit logs
                        if (currentUser?.role !== 'Admin') {
                            return h('div', { className: 'access-denied' },
                                h('h2', null, 'Access Denied'),
                                h('p', null, 'Only administrators can view audit logs.')
                            );
                        }
                        return AuditLogs ? h(AuditLogs, {
                            currentUser
                        }) : h('div', null, 'Audit Logs component not found');
                        
                    case 'profile':
                        // All authenticated users can access profile settings
                        return ProfileSettings ? h(ProfileSettings, {
                            currentUser,
                            onUpdate: (updatedUser) => {
                                // Update the current user in the app state
                                APP_STATE.currentUser = updatedUser;
                                // Force a re-render
                                setCurrentUser(updatedUser);
                            }
                        }) : h('div', null, 'Profile Settings component not found');
                        
                    case 'preferences':
                        // All authenticated users can access preferences
                        return Preferences ? h(Preferences, {
                            currentUser,
                            onUpdate: (updatedPreferences) => {
                                // Update the global preferences
                                APP_STATE.preferences = updatedPreferences;
                                // Update local state if needed
                                if (updatedPreferences.last_selected_view) setView(updatedPreferences.last_selected_view);
                                if (updatedPreferences.last_selected_period) setSelectedPeriod(updatedPreferences.last_selected_period);
                                if (updatedPreferences.last_selected_year) setSelectedYear(updatedPreferences.last_selected_year);
                                if (updatedPreferences.last_selected_brand) setSelectedBrand(updatedPreferences.last_selected_brand);
                            }
                        }) : h('div', null, 'Preferences component not found');
                        
                    default:
                        return h('div', null, 'Section not found');
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

    // Export functions and state
    window.APP_STATE = APP_STATE;
    window.initializeApp = initializeApp;
    window.handleSignOut = handleSignOut;
    window.saveUserPreferences = saveUserPreferences;
    window.loadUserPreferences = loadUserPreferences;
    window.applyUserPreferences = applyUserPreferences;
    window.applyTheme = applyTheme;
    window.applyCompactMode = applyCompactMode;
    window.applyNotifications = applyNotifications;
    window.applyRefreshInterval = applyRefreshInterval;
    window.applyTutorials = applyTutorials;
    
    // Global refresh function for preferences
    window.refreshDashboardData = function() {
        if (window.APP_STATE && window.APP_STATE.dataService) {
            // Refreshing dashboard data
            // This would trigger a data refresh in the dashboard
            // The actual implementation would depend on how the dashboard handles data updates
        }
    };
    
    // Also add to ChaiVision namespace
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.APP_STATE = APP_STATE;
    window.ChaiVision.initializeApp = initializeApp;
})();
