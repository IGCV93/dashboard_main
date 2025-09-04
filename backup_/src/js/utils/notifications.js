/**
 * Notification System - Toast notifications for success/error messages
 */

(function() {
    'use strict';
    
    // Create notification container if it doesn't exist
    function ensureNotificationContainer() {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-width: 400px;
            `;
            document.body.appendChild(container);
        }
        return container;
    }
    
    // Create a notification
    function createNotification(message, type = 'info', duration = 5000) {
        const container = ensureNotificationContainer();
        const notification = document.createElement('div');
        
        // Set styles based on type
        const styles = {
            success: {
                bg: 'linear-gradient(135deg, #10B981, #059669)',
                icon: '✅'
            },
            error: {
                bg: 'linear-gradient(135deg, #EF4444, #DC2626)',
                icon: '❌'
            },
            warning: {
                bg: 'linear-gradient(135deg, #F59E0B, #D97706)',
                icon: '⚠️'
            },
            info: {
                bg: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                icon: 'ℹ️'
            }
        };
        
        const style = styles[type] || styles.info;
        
        notification.className = 'notification';
        notification.style.cssText = `
            background: ${style.bg};
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideIn 0.3s ease-out;
            cursor: pointer;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            min-width: 300px;
        `;
        
        notification.innerHTML = `
            <span style="font-size: 20px;">${style.icon}</span>
            <span style="flex: 1;">${message}</span>
            <span style="opacity: 0.8; cursor: pointer;" onclick="this.parentElement.remove()">✕</span>
        `;
        
        container.appendChild(notification);
        
        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }
        
        // Click to dismiss
        notification.addEventListener('click', () => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        });
    }
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Global notification functions
    window.showSuccessMessage = function(message) {
        createNotification(message, 'success');
        console.log('✅', message);
    };
    
    window.showErrorMessage = function(message) {
        createNotification(message, 'error');
        console.error('❌', message);
    };
    
    window.showWarningMessage = function(message) {
        createNotification(message, 'warning');
        console.warn('⚠️', message);
    };
    
    window.showInfoMessage = function(message) {
        createNotification(message, 'info');
        console.info('ℹ️', message);
    };
    
    // Also add to ChaiVision namespace
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.notifications = {
        success: window.showSuccessMessage,
        error: window.showErrorMessage,
        warning: window.showWarningMessage,
        info: window.showInfoMessage
    };
})();
