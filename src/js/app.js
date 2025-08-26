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
        userPermissions: {
            brands: [],
            channels: []
        },
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
                
                // Set up auth listener
                if (APP_STATE.supabaseClient) {
                    APP_STATE.supabaseClient.auth.onAuthStateChange((event, session) => {
                        if (event === 'SIGNED_OUT') {
                            handleSignOut();
                        }
                    });
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
            
            // Initialize React components
            initializeReactApp(config);
            
            // Set up event listeners
            setupEventListeners();
            
            // Mark as initialized
            APP_STATE.initialized = true;
            
            console.log('✅ Chai Vision Dashboard initialized successfully!');
            
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            showErrorMessage('Failed to initialize dashboard. Please refresh the page.');
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
            // Authentication state
            const [isAuthenticated, setIsAuthenticated] = useState(false);
            const [currentUser, setCurrentUser] = useState(null);
            const [userPermissions, setUserPermissions] = useState({ brands: [], channels: [] });
            const [showProfileMenu, setShowProfileMenu] = useState(false);
            
            // Dashboard state
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
            
            // Brand and target state
            const [dynamicBrands, setDynamicBrands] = useState(INITIAL_DATA.brands || ['LifePro', 'PetCove']);
            const [dynamicTargets, setDynamicTargets] = useState(INITIAL_DATA.targets || {});
            
            // Check for saved session
            useEffect(() => {
                const checkAuth = async () => {
                    if (APP_STATE.supabaseClient && config.FEATURES.ENABLE_SUPABASE) {
                        const { data: { session } } = await APP_STATE.supabaseClient.auth.getSession();
                        if (session) {
                            // Get user profile
                            const { data: profile } = await APP_STATE.supabaseClient
                                .from('profiles')
                                .select('*')
                                .eq('id', session.user.id)
                                .single();
                            
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
                            
                            setCurrentUser(user);
                            setUserPermissions(permissions);
                            setIsAuthenticated(true);
                            APP_STATE.currentUser = user;
                            APP_STATE.userPermissions = permissions;
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
                    setLoading(false);
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
            
            // Handle login
            const handleLogin = async (user) => {
                // Set permissions based on role or fetch from database
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
                    } else if (user.email === 'john@chaivision.com') {
                        permissions = { brands: ['LifePro', 'PetCove'], channels: ['Amazon', 'TikTok', 'DTC-Shopify'] };
                    } else if (user.email === 'sarah@chaivision.com') {
                        permissions = { brands: ['Joyberri', 'Oaktiv'], channels: ['Retail', 'Wholesale'] };
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
                
                // Set default brand if user only has access to one
                if (permissions.brands.length === 1 && !permissions.brands.includes('All Brands')) {
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
            
            // Regenerate sample data when brands change
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
                    
                    showSuccessMessage('Settings updated successfully');
                } catch (err) {
                    console.error('Failed to update settings:', err);
                    showErrorMessage('Failed to update settings');
                }
            };
            
            // Handle upload complete
            const handleUploadComplete = async (uploadedData) => {
                try {
                    const mergedData = [...salesData, ...uploadedData];
                    setSalesData(mergedData);
                    showSuccessMessage(`Successfully uploaded ${uploadedData.length} records`);
                } catch (err) {
                    console.error('Failed to process upload:', err);
                    showErrorMessage('Failed to process uploaded data');
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
            
            // If not authenticated, show login
            if (!isAuthenticated) {
                return Login ? h(Login, { onLogin: handleLogin }) : h('div', null, 'Loading...');
            }
            
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
                userRole: currentUser?.role
            }) : null;
            
            // Render sidebar based on user role
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
                            userRole: currentUser?.role
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
                            userRole: currentUser?.role
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
                            userRole: currentUser?.role
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

    // ... rest of helper functions (showSuccessMessage, etc.) remain the same ...
    
    // Export functions and state
    window.APP_STATE = APP_STATE;
    window.initializeApp = initializeApp;
    window.handleSignOut = handleSignOut;
    
    // Also add to ChaiVision namespace
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.APP_STATE = APP_STATE;
    window.ChaiVision.initializeApp = initializeApp;
})();
