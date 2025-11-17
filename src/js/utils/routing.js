/**
 * Routing Utility for Chai Vision Dashboard
 * Handles URL routing and browser history management
 */

(function() {
    'use strict';
    
    // Valid sections that can be routed to
    const VALID_SECTIONS = ['dashboard', 'upload', 'settings', 'sku-performance'];
    
    /**
     * Initialize routing
     * @param {Function} setActiveSection - Function to update active section
     * @param {string} defaultSection - Default section to show if no route
     */
    function initializeRouting(setActiveSection, defaultSection = 'dashboard') {
        // Validate parameters
        if (typeof setActiveSection !== 'function') {
            console.error('setActiveSection must be a function');
            return;
        }
        
        if (!VALID_SECTIONS.includes(defaultSection)) {
            console.warn(`Invalid default section: ${defaultSection}, using 'dashboard'`);
            defaultSection = 'dashboard';
        }
        
        // Handle initial route
        const initialSection = getSectionFromURL() || defaultSection;
        if (VALID_SECTIONS.includes(initialSection)) {
            setActiveSection(initialSection);
        } else {
            console.warn(`Invalid section in URL: ${initialSection}, using default: ${defaultSection}`);
            setActiveSection(defaultSection);
        }
        
        // Listen for browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            const section = getSectionFromURL() || defaultSection;
            if (VALID_SECTIONS.includes(section)) {
                setActiveSection(section);
            } else {
                console.warn(`Invalid section in popstate: ${section}, using default: ${defaultSection}`);
                setActiveSection(defaultSection);
            }
        });
        
        console.log('✅ Routing initialized successfully');
    }
    
    /**
     * Navigate to a section and update URL
     * @param {string} section - Section to navigate to
     */
    function navigateToSection(section) {
        if (!VALID_SECTIONS.includes(section)) {
            console.warn(`Invalid section: ${section}`);
            return;
        }
        
        // Update URL without page reload
        const url = new URL(window.location);
        if (section === 'dashboard') {
            url.searchParams.delete('section');
        } else {
            url.searchParams.set('section', section);
        }
        
        // Update browser history
        window.history.pushState({ section }, '', url);
    }
    
    /**
     * Get section from current URL
     * @returns {string|null} Section name or null if not found
     */
    function getSectionFromURL() {
        const url = new URL(window.location);
        const section = url.searchParams.get('section');
        return VALID_SECTIONS.includes(section) ? section : null;
    }
    
    /**
     * Update URL when section changes (called from component)
     * @param {string} section - Current active section
     */
    function updateURL(section) {
        if (!VALID_SECTIONS.includes(section)) {
            console.warn(`Invalid section for URL update: ${section}`);
            return;
        }
        
        const url = new URL(window.location);
        if (section === 'dashboard') {
            url.searchParams.delete('section');
        } else {
            url.searchParams.set('section', section);
        }
        
        // Only update if URL is different to avoid unnecessary history entries
        if (url.toString() !== window.location.href) {
            window.history.replaceState({ section }, '', url);
        }
    }
    
    /**
     * Get current active section from URL
     * @returns {string} Current active section
     */
    function getCurrentSection() {
        return getSectionFromURL() || 'dashboard';
    }
    
    /**
     * Build SKU performance route URL
     * @param {Object} params - Route parameters
     * @param {string} params.channel - Channel name (required)
     * @param {string} params.brand - Brand name (optional)
     * @param {string} params.view - 'annual'|'quarterly'|'monthly'
     * @param {string} params.period - 'Q1'|'Q2'|'Q3'|'Q4' (for quarterly)
     * @param {string} params.year - Year (YYYY)
     * @param {number} params.month - Month (1-12, for monthly)
     * @returns {string} Route URL
     */
    function buildSKUPerformanceRoute(params) {
        const { channel, brand, view, period, year, month } = params;
        
        if (!channel) {
            console.error('Channel is required for SKU performance route');
            return '/';
        }
        
        const url = new URL(window.location.origin);
        url.pathname = '/';
        url.searchParams.set('section', 'sku-performance');
        url.searchParams.set('channel', channel);
        
        if (brand) url.searchParams.set('brand', brand);
        if (view) url.searchParams.set('view', view);
        if (period) url.searchParams.set('period', period);
        if (year) url.searchParams.set('year', year);
        if (month) url.searchParams.set('month', month.toString());
        
        return url.toString();
    }
    
    /**
     * Parse SKU performance route parameters from URL
     * @returns {Object} Parsed parameters
     */
    function parseSKUPerformanceRoute() {
        const url = new URL(window.location);
        return {
            channel: url.searchParams.get('channel'),
            brand: url.searchParams.get('brand') || null,
            view: url.searchParams.get('view') || 'quarterly',
            period: url.searchParams.get('period') || null,
            year: url.searchParams.get('year') || new Date().getFullYear().toString(),
            month: url.searchParams.get('month') ? parseInt(url.searchParams.get('month')) : null
        };
    }
    
    // Make routing functions available globally
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.routing = {
        initializeRouting,
        navigateToSection,
        getSectionFromURL,
        updateURL,
        getCurrentSection,
        buildSKUPerformanceRoute,
        parseSKUPerformanceRoute,
        VALID_SECTIONS
    };
})();
