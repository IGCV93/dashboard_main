/**
 * Chai Vision Dashboard - Formatter Utilities
 * Functions for formatting numbers, currencies, dates, etc.
 */

/**
 * Format number as currency
 * @param {number} value - The value to format
 * @param {string} currency - Currency code (default: USD)
 * @param {boolean} compact - Use compact notation for large numbers
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value, currency = 'USD', compact = true) {
    if (value === null || value === undefined || isNaN(value)) {
        return '$0';
    }
    
    // For large numbers, use compact notation
    if (compact && Math.abs(value) >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
    } else if (compact && Math.abs(value) >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
    }
    
    // Standard currency formatting
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

/**
 * Format number as percentage
 * @param {number} value - The value to format (0-1 or 0-100)
 * @param {number} decimals - Number of decimal places
 * @param {boolean} isAlreadyPercentage - If true, value is already 0-100
 * @returns {string} Formatted percentage string
 */
export function formatPercent(value, decimals = 1, isAlreadyPercentage = false) {
    if (value === null || value === undefined || isNaN(value)) {
        return '0%';
    }
    
    const percentage = isAlreadyPercentage ? value : value * 100;
    return `${percentage.toFixed(decimals)}%`;
}

/**
 * Format large numbers with abbreviations
 * @param {number} value - The value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
export function formatNumber(value, decimals = 0) {
    if (value === null || value === undefined || isNaN(value)) {
        return '0';
    }
    
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    
    if (absValue >= 1e9) {
        return `${sign}${(absValue / 1e9).toFixed(decimals)}B`;
    } else if (absValue >= 1e6) {
        return `${sign}${(absValue / 1e6).toFixed(decimals)}M`;
    } else if (absValue >= 1e3) {
        return `${sign}${(absValue / 1e3).toFixed(decimals)}K`;
    }
    
    return value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Format date to display string
 * @param {Date|string} date - The date to format
 * @param {string} format - Format type: 'short', 'long', 'iso', 'display'
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'display') {
    if (!date) return '';
    
    const d = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(d.getTime())) {
        return 'Invalid Date';
    }
    
    switch (format) {
        case 'short':
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
            
        case 'long':
            return d.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
        case 'iso':
            return d.toISOString().split('T')[0];
            
        case 'display':
        default:
            return d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
    }
}

/**
 * Format time to display string
 * @param {Date|string} date - The date/time to format
 * @param {boolean} includeSeconds - Include seconds in output
 * @returns {string} Formatted time string
 */
export function formatTime(date, includeSeconds = false) {
    if (!date) return '';
    
    const d = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(d.getTime())) {
        return 'Invalid Time';
    }
    
    return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: includeSeconds ? '2-digit' : undefined
    });
}

/**
 * Format date and time together
 * @param {Date|string} date - The date/time to format
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date) {
    return `${formatDate(date)} at ${formatTime(date)}`;
}

/**
 * Format duration in human-readable format
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(milliseconds) {
    if (!milliseconds || milliseconds < 0) return '0s';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted file size string
 */
export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {Date|string} date - The date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
    if (!date) return '';
    
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now - d;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (years > 0) {
        return `${years} year${years > 1 ? 's' : ''} ago`;
    } else if (months > 0) {
        return `${months} month${months > 1 ? 's' : ''} ago`;
    } else if (weeks > 0) {
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        return 'just now';
    }
}

/**
 * Format channel name for display
 * @param {string} channel - Channel name
 * @returns {string} Formatted channel name
 */
export function formatChannelName(channel) {
    const channelMap = {
        'DTC-Shopify': 'DTC (Shopify)',
        'CA International': 'Canada Int\'l',
        'UK International': 'UK Int\'l',
        'Omnichannel': 'Omni-Channel'
    };
    
    return channelMap[channel] || channel;
}

/**
 * Format quarter display
 * @param {string} quarter - Quarter (Q1, Q2, Q3, Q4)
 * @param {string|number} year - Year
 * @returns {string} Formatted quarter string
 */
export function formatQuarter(quarter, year) {
    const quarterNames = {
        'Q1': 'First Quarter',
        'Q2': 'Second Quarter',
        'Q3': 'Third Quarter',
        'Q4': 'Fourth Quarter'
    };
    
    const name = quarterNames[quarter] || quarter;
    return year ? `${name} ${year}` : name;
}

/**
 * Format month name
 * @param {number} month - Month number (1-12)
 * @param {string} format - 'short' or 'long'
 * @returns {string} Month name
 */
export function formatMonth(month, format = 'long') {
    const date = new Date(2000, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: format });
}

/**
 * Format growth rate with arrow indicator
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {object} Object with formatted text and status
 */
export function formatGrowth(current, previous) {
    if (!previous || previous === 0) {
        return {
            text: 'N/A',
            status: 'neutral',
            arrow: ''
        };
    }
    
    const growth = ((current - previous) / previous) * 100;
    const arrow = growth > 0 ? '↑' : growth < 0 ? '↓' : '→';
    const status = growth > 0 ? 'positive' : growth < 0 ? 'negative' : 'neutral';
    
    return {
        text: `${arrow} ${Math.abs(growth).toFixed(1)}%`,
        status,
        arrow,
        value: growth
    };
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format plural text
 * @param {number} count - Count
 * @param {string} singular - Singular form
 * @param {string} plural - Plural form (optional)
 * @returns {string} Formatted plural text
 */
export function formatPlural(count, singular, plural = null) {
    const pluralForm = plural || `${singular}s`;
    return count === 1 ? `${count} ${singular}` : `${count} ${pluralForm}`;
}

// Export all formatters as default object too
export default {
    formatCurrency,
    formatPercent,
    formatNumber,
    formatDate,
    formatTime,
    formatDateTime,
    formatDuration,
    formatFileSize,
    formatRelativeTime,
    formatChannelName,
    formatQuarter,
    formatMonth,
    formatGrowth,
    truncateText,
    formatPlural
};
