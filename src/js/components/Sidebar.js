/**
 * Sidebar Component
 */

export function Sidebar(props) {
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
                onClick: () => setActiveSection(item.id)
            },
                h('span', null, item.icon),
                h('span', null, item.label)
            )
        )
    );
}
