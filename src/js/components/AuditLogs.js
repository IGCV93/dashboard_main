/**
 * AuditLogs Component - View system audit logs (Admin only)
 */

(function() {
    'use strict';
    
    function AuditLogs({ currentUser }) {
        const { useState, useEffect, createElement: h } = React;
        
        const [logs, setLogs] = useState([]);
        const [loading, setLoading] = useState(true);
        const [filter, setFilter] = useState({
            action: 'all',
            user: 'all',
            dateRange: 'today'
        });
        
        // Get Supabase client
        const getSupabaseClient = () => {
            const config = window.CONFIG || window.ChaiVision?.CONFIG;
            if (config?.SUPABASE?.URL && window.supabase) {
                return window.supabase.createClient(
                    config.SUPABASE.URL,
                    config.SUPABASE.ANON_KEY
                );
            }
            return null;
        };
        
        // Load audit logs
        const loadLogs = async () => {
            setLoading(true);
            const supabase = getSupabaseClient();
            
            if (!supabase) {
                // Demo data
                setLogs([
                    {
                        id: 1,
                        user_email: 'admin@chaivision.com',
                        user_role: 'Admin',
                        action: 'login',
                        action_details: { timestamp: new Date().toISOString() },
                        created_at: new Date().toISOString()
                    }
                ]);
                setLoading(false);
                return;
            }
            
            try {
                let query = supabase
                    .from('audit_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100);
                
                // Apply filters
                if (filter.action !== 'all') {
                    query = query.eq('action', filter.action);
                }
                
                // Date range filter
                const now = new Date();
                let startDate;
                switch (filter.dateRange) {
                    case 'today':
                        startDate = new Date(now.setHours(0, 0, 0, 0));
                        break;
                    case 'week':
                        startDate = new Date(now.setDate(now.getDate() - 7));
                        break;
                    case 'month':
                        startDate = new Date(now.setMonth(now.getMonth() - 1));
                        break;
                    default:
                        startDate = null;
                }
                
                if (startDate) {
                    query = query.gte('created_at', startDate.toISOString());
                }
                
                const { data, error } = await query;
                
                if (error) throw error;
                setLogs(data || []);
            } catch (error) {
                console.error('Error loading audit logs:', error);
                if (window.showErrorMessage) {
                    window.showErrorMessage('Failed to load audit logs');
                }
            } finally {
                setLoading(false);
            }
        };
        
        // Load logs on mount and filter change
        useEffect(() => {
            loadLogs();
        }, [filter]);
        
        // Format action for display
        const formatAction = (action) => {
            const actionMap = {
                'login': '🔐 Login',
                'logout': '🚪 Logout',
                'kpi_target_update': '📊 KPI Update',
                'data_upload': '📤 Data Upload',
                'user_permissions_updated': '👤 User Updated',
                'password_reset_request': '🔑 Password Reset'
            };
            return actionMap[action] || action;
        };
        
        // Format timestamp
        const formatTime = (timestamp) => {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            
            if (minutes < 1) return 'Just now';
            if (minutes < 60) return `${minutes}m ago`;
            if (hours < 24) return `${hours}h ago`;
            if (days < 7) return `${days}d ago`;
            
            return date.toLocaleDateString();
        };
        
        return h('div', { className: 'audit-logs-container', style: { padding: '20px' } },
            // Header
            h('div', { style: { marginBottom: '30px' } },
                h('h2', { style: { fontSize: '28px', marginBottom: '8px' } }, '📋 Audit Logs'),
                h('p', { style: { color: '#6B7280' } }, 'Track all system activities and changes')
            ),
            
            // Filters
            h('div', { style: { 
                display: 'flex', 
                gap: '16px', 
                marginBottom: '24px',
                padding: '20px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            } },
                h('select', {
                    value: filter.action,
                    onChange: (e) => setFilter({ ...filter, action: e.target.value }),
                    style: { 
                        padding: '10px',
                        border: '2px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '14px'
                    }
                },
                    h('option', { value: 'all' }, 'All Actions'),
                    h('option', { value: 'login' }, 'Logins'),
                    h('option', { value: 'kpi_target_update' }, 'KPI Updates'),
                    h('option', { value: 'data_upload' }, 'Data Uploads')
                ),
                
                h('select', {
                    value: filter.dateRange,
                    onChange: (e) => setFilter({ ...filter, dateRange: e.target.value }),
                    style: { 
                        padding: '10px',
                        border: '2px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '14px'
                    }
                },
                    h('option', { value: 'today' }, 'Today'),
                    h('option', { value: 'week' }, 'Last 7 Days'),
                    h('option', { value: 'month' }, 'Last 30 Days'),
                    h('option', { value: 'all' }, 'All Time')
                ),
                
                h('button', {
                    className: 'btn btn-primary',
                    onClick: loadLogs
                }, '🔄 Refresh')
            ),
            
            // Logs Table
            loading ? h('div', { style: { padding: '40px', textAlign: 'center' } }, 'Loading logs...') :
            logs.length === 0 ? h('div', { style: { padding: '40px', textAlign: 'center' } }, 'No audit logs found') :
            h('div', { style: {
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            } },
                h('table', { style: { width: '100%', borderCollapse: 'collapse' } },
                    h('thead', null,
                        h('tr', null,
                            h('th', { style: { 
                                background: '#F9FAFB',
                                padding: '12px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: '#6B7280',
                                borderBottom: '2px solid #E5E7EB'
                            } }, 'Time'),
                            h('th', { style: { 
                                background: '#F9FAFB',
                                padding: '12px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: '#6B7280',
                                borderBottom: '2px solid #E5E7EB'
                            } }, 'User'),
                            h('th', { style: { 
                                background: '#F9FAFB',
                                padding: '12px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: '#6B7280',
                                borderBottom: '2px solid #E5E7EB'
                            } }, 'Action'),
                            h('th', { style: { 
                                background: '#F9FAFB',
                                padding: '12px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: '#6B7280',
                                borderBottom: '2px solid #E5E7EB'
                            } }, 'Details')
                        )
                    ),
                    h('tbody', null,
                        logs.map(log =>
                            h('tr', { 
                                key: log.id,
                                style: { borderBottom: '1px solid #E5E7EB' }
                            },
                                h('td', { style: { padding: '12px', fontSize: '14px' } }, 
                                    formatTime(log.created_at)
                                ),
                                h('td', { style: { padding: '12px', fontSize: '14px' } },
                                    h('div', null,
                                        h('div', { style: { fontWeight: '500' } }, log.user_email),
                                        h('span', { 
                                            className: `role-badge role-${(log.user_role || 'user').toLowerCase()}`,
                                            style: {
                                                fontSize: '11px',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                display: 'inline-block',
                                                marginTop: '4px'
                                            }
                                        }, log.user_role)
                                    )
                                ),
                                h('td', { style: { padding: '12px', fontSize: '14px' } }, 
                                    formatAction(log.action)
                                ),
                                h('td', { style: { padding: '12px', fontSize: '14px' } },
                                    log.action_details && h('details', null,
                                        h('summary', { style: { cursor: 'pointer', color: '#667eea' } }, 
                                            'View Details'
                                        ),
                                        h('pre', { style: {
                                            marginTop: '8px',
                                            padding: '8px',
                                            background: '#F3F4F6',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            maxWidth: '300px',
                                            overflow: 'auto'
                                        } }, JSON.stringify(log.action_details, null, 2))
                                    )
                                )
                            )
                        )
                    )
                )
            )
        );
    }
    
    // Make AuditLogs available globally
    window.AuditLogs = AuditLogs;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.AuditLogs = AuditLogs;
})();
