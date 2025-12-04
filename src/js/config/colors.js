/**
 * Color Configuration
 * Central source of truth for application colors
 */

export const COLORS = {
    // Brand Colors
    BRAND: {
        PRIMARY: '#667eea',
        SECONDARY: '#764ba2',
        ACCENT: '#10B981',
        WARNING: '#F59E0B',
        DANGER: '#EF4444',
        INFO: '#3B82F6'
    },

    // Chart Colors
    CHARTS: {
        PRIMARY: 'rgba(102, 126, 234, 1)',
        PRIMARY_BG: 'rgba(102, 126, 234, 0.2)',
        SECONDARY: 'rgba(118, 75, 162, 1)',
        SECONDARY_BG: 'rgba(118, 75, 162, 0.2)',
        TARGET: 'rgba(255, 99, 132, 1)',
        TARGET_BG: 'rgba(255, 99, 132, 0.2)',
        GRID: 'rgba(0, 0, 0, 0.05)'
    },

    // Role Colors (Gradients)
    ROLES: {
        ADMIN: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        MANAGER: 'linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)',
        USER: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        DEFAULT: 'linear-gradient(135deg, #6b7280 0%, #374151 100%)'
    },

    // Status Colors
    STATUS: {
        ACTIVE: '#10B981',
        INACTIVE: '#EF4444',
        PENDING: '#F59E0B'
    }
};
