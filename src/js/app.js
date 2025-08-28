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
            console.log('🚀 Starting Chai Vision Dashboard initialization...');
            
            // Validate configuration
            const validateConfig = window.validateConfig || window.ChaiVision?.validateConfig;
            if (validateConfig) {
                const configErrors = validateConfig();
                if (configErrors.length > 0) {
                    console.warn('Configuration warnings:', configErrors);
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
                        console.log('Auth state changed:', event);
                        
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
                    
                    // Listen for auth changes from other tabs
                    if (window.BroadcastChannel) {
                        const channel = new BroadcastChannel('chai_vision_auth');
                        channel.onmessage = (e) => {
                            if (e.data.event === 'SIGNED_OUT') {
                                window.location.reload();
                            } else if (e.data.event === 'SIGNED_IN') {
                                window.location.reload();
                            }
                        };
                    }
                }
            }
            
            // Get DataService class
            const DataService = window.DataService || window.ChaiVision?.services?.DataService;
            if (DataService) {
                APP_STATE.dataService = new DataService(APP_STATE.supabaseClient, config);
            } else {
                console.warn('DataService not found, using fallback');
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
            
            console.log('✅ Chai Vision Dashboard initialized successfully!');
            
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
                .select('last_selected_brand, last_selected_period, last_selected_year, last_selected_view')
                .eq('user_id', userId)
                .single();
            
            return data || {};
        } catch (error) {
            console.error('Failed to load preferences:', error);
            return {};
        }
    }
    
    /**
     * Handle sign out
     */
    function handleSignOut() {
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
        
        // Notify other tabs
        if (window.BroadcastChannel) {
            const channel = new BroadcastChannel('chai_vision_auth');
            channel.postMessage({ event: 'SIGNED_OUT' });
        }
        
        // Reload to login page
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
        console.log('✅', message);
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
                    setCheckingAuth(true);
                    
                    // Add timeout to prevent infinite loading
                    const authTimeout = setTimeout(() => {
                        console.warn('Auth check timeout - proceeding without authentication');
                        setCheckingAuth(false);
                        setLoading(false);
                    }, 10000); // 10 second timeout
                    
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
                                }
                                
                                setCurrentUser(user);
                                setUserPermissions(permissions);
                                setIsAuthenticated(true);
                                APP_STATE.currentUser = user;
                                APP_STATE.userPermissions = permissions;
                                
                                if (window.showSuccessMessage) {
                                    window.showSuccessMessage(`Welcome back, ${user.full_name || user.email}!`);
                                }
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
                            // Check demo mode session
                            const savedUser = localStorage.getItem('chai_vision_user_session');
                            if (savedUser) {
                                const user = JSON.parse(savedUser);
                                setCurrentUser(user);
                                setUserPermissions(user.permissions || { brands: ['All Brands'], channels: ['All Channels'] });
                                setIsAuthenticated(true);
                                APP_STATE.currentUser = user;
                                APP_STATE.userPermissions = user.permissions;
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
                if (availableBrands.length > 0 && !availableBrands.includes(selectedBrand)) {
                    if (availableBrands.includes('All Brands')) {
                        setSelectedBrand('All Brands');
                    } else {
                        setSelectedBrand(availableBrands[0]);
                    }
                }
            }, [availableBrands]);
            
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
                    setLoading(true);
                    if (APP_STATE.dataService) {
                        const data = await APP_STATE.dataService.loadSalesData();
                        // Filter data based on user permissions
                        const filteredData = data.filter(d => {
                            const brandAllowed = userPermissions.brands.includes('All Brands') || 
                                                userPermissions.brands.includes(d.brand);
                            const channelAllowed = userPermissions.channels.includes('All Channels') || 
                                                  userPermissions.channels.includes(d.channel);
                            return brandAllowed && channelAllowed;
                        });
                        setSalesData(filteredData);
                    }
                    setLoading(false);
                } catch (err) {
                    console.error('Failed to load data:', err);
                    setError('Failed to load sales data');
                    setLoading(false);
                }
            }
            
            // Regenerate sample data when brands/permissions change
            useEffect(() => {
                if (isAuthenticated && availableBrands.length > 0) {
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
            const handleUploadComplete = async (uploadedData) => {
                try {
                    const mergedData = [...salesData, ...uploadedData];
                    setSalesData(mergedData);
                    if (window.showSuccessMessage) {
                        window.showSuccessMessage(`Successfully uploaded ${uploadedData.length} records`);
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
            
            // If checking auth, show loading
            if (checkingAuth) {
                return h('div', { className: 'loading-container' },
                    h('div', { className: 'loading-spinner' }),
                    h('div', { className: 'loading-text' }, 'Checking authentication...')
                );
            }
            
            // If not authenticated, show login
            if (!isAuthenticated) {
                return Login ? h(Login, { 
                    onLogin: handleLogin,
                    rememberMe: APP_STATE.rememberMe,
                    setRememberMe: (value) => { APP_STATE.rememberMe = value; }
                }) : h('div', null, 'Loading...');
            }
            
            // Debug currentUser state
            console.log('🔍 Debug - currentUser:', currentUser);
            console.log('🔍 Debug - isAuthenticated:', isAuthenticated);
            console.log('🔍 Debug - Navigation component:', Navigation);
            console.log('🔍 Debug - ProfileMenu component:', ProfileMenu);
            console.log('🔍 Debug - UserManagement component:', UserManagement);
            console.log('🔍 Debug - activeSection:', activeSection);
            
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
                            selectedPeriod,
                            selectedMonth,
                            selectedYear,
                            selectedBrand,
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
    
    // Also add to ChaiVision namespace
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.APP_STATE = APP_STATE;
    window.ChaiVision.initializeApp = initializeApp;
})();
