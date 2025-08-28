/**
 * Sidebar Component
 */

(function() {
    'use strict';
    
    function Sidebar(props) {
        const { createElement: h } = React;
        const { activeSection, setActiveSection } = props;
        
        const menuItems = [
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'upload', icon: '📤', label: 'Upload Data' },
            { id: 'settings', icon: '⚙️', label: 'KPI Settings' }
        ];
        
        return h('aside', { className: 'sidebar' },
            menuItems.map(item =>
                h('div', {
                    key: item.id,
                    className: `sidebar-item ${activeSection === item.id ? 'active' : ''}`,
                    onClick: () => {
                        setActiveSection(item.id);
                        // Also use routing navigation if available
                        if (window.ChaiVision?.routing?.navigateToSection) {
                            window.ChaiVision.routing.navigateToSection(item.id);
                        }
                    }
                },
                    h('span', null, item.icon),
                    h('span', null, item.label)
                )
            )
        );
    }
    
    // Make Sidebar available globally
    window.Sidebar = Sidebar;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.Sidebar = Sidebar;
})();
