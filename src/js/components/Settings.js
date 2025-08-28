/**
 * Settings Component - KPI and Brand Management
 * ENHANCED WITH PERMISSION-BASED EDITING
 */

(function() {
    'use strict';
    
    function Settings(props) {
        const { useState, useEffect, createElement: h } = React;
        
        const {
            brands: initialBrands,
            targets: initialTargets,
            channels,
            onUpdate,
            userRole,
            userPermissions,
            currentUser
        } = props;
        
        // Get initial data from window
        const INITIAL_DATA = window.ChaiVision?.INITIAL_DATA || {};
        const ALL_CHANNELS = channels || INITIAL_DATA.channels || [];
        
        // Get formatters and services from window
        const { formatCurrency } = window.formatters || {};
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
        
        // Filter brands and channels based on permissions
        const availableBrands = userRole === 'Admin' || userPermissions?.brands?.includes('All Brands') 
            ? initialBrands 
            : initialBrands.filter(brand => userPermissions?.brands?.includes(brand));
            
        const availableChannels = userRole === 'Admin' || userPermissions?.channels?.includes('All Channels')
            ? ALL_CHANNELS
            : ALL_CHANNELS.filter(channel => userPermissions?.channels?.includes(channel));
        
        // Check if user can edit (Admin or Manager role)
        const canEdit = userRole === 'Admin' || userRole === 'Manager';
        
        // Check if user can manage brands (Admin only)
        const canManageBrands = userRole === 'Admin';
        
        // State
        const [settingsYear, setSettingsYear] = useState('2025');
        const [editingBrand, setEditingBrand] = useState(null);
        const [editingValues, setEditingValues] = useState({});
        const [showAddBrand, setShowAddBrand] = useState(false);
        const [newBrandName, setNewBrandName] = useState('');
        const [newBrandTarget, setNewBrandTarget] = useState(0);
        const [dynamicBrands, setDynamicBrands] = useState(availableBrands);
        const [dynamicTargets, setDynamicTargets] = useState(initialTargets || {});
        const [error, setError] = useState('');
        const [success, setSuccess] = useState('');
        
        // Update local state when props change
        useEffect(() => {
            setDynamicBrands(availableBrands);
        }, [initialBrands, userPermissions]);
        
        // Check if user can edit specific brand/channel combination
        const canEditTarget = (brand, channel) => {
            if (!canEdit) return false;
            if (userRole === 'Admin') return true;
            
            // Manager can only edit their assigned brand+channel combinations
            const hasBrandAccess = userPermissions?.brands?.includes('All Brands') || 
                                  userPermissions?.brands?.includes(brand);
            const hasChannelAccess = userPermissions?.channels?.includes('All Channels') || 
                                    userPermissions?.channels?.includes(channel);
            
            return hasBrandAccess && hasChannelAccess;
        };
        
        // Audit log helper
        const logKPIChange = async (brand, channel, period, oldValue, newValue) => {
            const supabase = getSupabaseClient();
            if (!supabase) return;
            
            try {
                await supabase
                    .from('audit_logs')
                    .insert({
                        user_id: currentUser?.id,
                        user_email: currentUser?.email,
                        user_role: userRole,
                        action: 'kpi_target_update',
                        action_details: {
                            year: settingsYear,
                            brand,
                            channel,
                            period,
                            old_value: oldValue,
                            new_value: newValue,
                            change: `${formatCurrency(oldValue)} → ${formatCurrency(newValue)}`
                        },
                        reference_id: `KPI_${Date.now()}_${brand}_${channel}_${period}`
                    });
                    
                // Also log to kpi_targets_history
                await supabase
                    .from('kpi_targets_history')
                    .insert({
                        year: parseInt(settingsYear),
                        period,
                        brand,
                        channel,
                        old_value: oldValue,
                        new_value: newValue,
                        changed_by: currentUser?.id
                    });
            } catch (error) {
                console.error('Failed to log KPI change:', error);
            }
        };
        
        // Handle editing existing brand
        const handleEditBrand = (brand) => {
            // Check if user can edit this brand
            if (!canEdit) {
                setError('You do not have permission to edit KPI targets');
                return;
            }
            
            if (userRole === 'Manager' && !userPermissions?.brands?.includes(brand) && 
                !userPermissions?.brands?.includes('All Brands')) {
                setError(`You do not have permission to edit ${brand}`);
                return;
            }
            
            const brandData = dynamicTargets[settingsYear]?.brands?.[brand];
            if (brandData) {
                // Filter channels to only those the user can edit
                const filteredData = { ...brandData };
                if (userRole === 'Manager') {
                    ['annual', 'Q1', 'Q2', 'Q3', 'Q4'].forEach(period => {
                        if (filteredData[period]) {
                            const filtered = {};
                            availableChannels.forEach(channel => {
                                if (filteredData[period][channel] !== undefined) {
                                    filtered[channel] = filteredData[period][channel];
                                }
                            });
                            filteredData[period] = filtered;
                        }
                    });
                }
                
                setEditingBrand(brand);
                setEditingValues(filteredData);
                setError('');
            }
        };
        
        // Handle add new brand
        const handleAddBrand = () => {
            if (!newBrandName.trim() || !newBrandTarget) {
                setError('Please enter both brand name and target');
                return;
            }
            
            if (dynamicBrands.includes(newBrandName.trim())) {
                setError('Brand already exists');
                return;
            }
            
            const brandName = newBrandName.trim();
            
            // Add to brands list
            const updatedBrands = [...dynamicBrands, brandName];
            setDynamicBrands(updatedBrands);
            
            // Initialize targets for the new brand
            const updatedTargets = { ...dynamicTargets };
            if (!updatedTargets[settingsYear]) {
                updatedTargets[settingsYear] = { brands: {} };
            }
            if (!updatedTargets[settingsYear].brands) {
                updatedTargets[settingsYear].brands = {};
            }
            
            // Set initial targets for all channels
            const initialTargets = {};
            availableChannels.forEach(channel => {
                initialTargets[channel] = newBrandTarget / availableChannels.length;
            });
            
            updatedTargets[settingsYear].brands[brandName] = {
                annual: initialTargets,
                Q1: { ...initialTargets },
                Q2: { ...initialTargets },
                Q3: { ...initialTargets },
                Q4: { ...initialTargets }
            };
            
            setDynamicTargets(updatedTargets);
            
            // Notify parent component
            if (onUpdate) {
                onUpdate({
                    brands: updatedBrands,
                    targets: updatedTargets
                });
            }
            
            // Reset form
            setNewBrandName('');
            setNewBrandTarget(0);
            setShowAddBrand(false);
            setSuccess(`Brand "${brandName}" added successfully`);
            setTimeout(() => setSuccess(''), 3000);
        };
        
        // Handle saving edited brand
        const handleSaveEdit = async () => {
            if (!editingBrand || !canEdit) return;
            
            const oldValues = dynamicTargets[settingsYear]?.brands?.[editingBrand] || {};
            const updatedTargets = { ...dynamicTargets };
            
            if (!updatedTargets[settingsYear]) {
                updatedTargets[settingsYear] = { brands: {} };
            }
            
            // For Managers, merge with existing values (only update what they can edit)
            if (userRole === 'Manager') {
                const existingData = updatedTargets[settingsYear].brands[editingBrand] || {};
                const mergedData = { ...existingData };
                
                ['annual', 'Q1', 'Q2', 'Q3', 'Q4'].forEach(period => {
                    if (!mergedData[period]) mergedData[period] = {};
                    
                    availableChannels.forEach(channel => {
                        if (editingValues[period] && editingValues[period][channel] !== undefined) {
                            const oldValue = existingData[period]?.[channel] || 0;
                            const newValue = editingValues[period][channel];
                            
                            if (oldValue !== newValue) {
                                // Log the change
                                logKPIChange(editingBrand, channel, period, oldValue, newValue);
                            }
                            
                            mergedData[period][channel] = newValue;
                        }
                    });
                });
                
                updatedTargets[settingsYear].brands[editingBrand] = mergedData;
            } else {
                // Admin can update everything
                ['annual', 'Q1', 'Q2', 'Q3', 'Q4'].forEach(period => {
                    ALL_CHANNELS.forEach(channel => {
                        const oldValue = oldValues[period]?.[channel] || 0;
                        const newValue = editingValues[period]?.[channel] || 0;
                        
                        if (oldValue !== newValue) {
                            logKPIChange(editingBrand, channel, period, oldValue, newValue);
                        }
                    });
                });
                
                updatedTargets[settingsYear].brands[editingBrand] = editingValues;
            }
            
            setDynamicTargets(updatedTargets);
            
            // Notify parent component
            if (onUpdate) {
                onUpdate({
                    brands: dynamicBrands,
                    targets: updatedTargets
                });
            }
            
            setEditingBrand(null);
            setEditingValues({});
            setSuccess('KPI targets updated successfully');
            setTimeout(() => setSuccess(''), 3000);
        };
        
        // If user has no permission, show message
        if (!canEdit && userRole === 'User') {
            return h('div', { className: 'settings-container' },
                h('div', { className: 'alert-banner warning' },
                    h('div', { className: 'alert-content' },
                        h('span', { className: 'alert-icon' }, '🔒'),
                        h('span', { className: 'alert-message' }, 
                            'You have view-only access. Contact an administrator to modify KPI targets.'
                        )
                    )
                )
            );
        }
        
        return h('div', { className: 'settings-container' },
            // Settings Header
            h('div', { className: 'settings-header' },
                h('h2', { className: 'settings-title' }, '⚙️ KPI Settings & Brand Management'),
                h('div', { className: 'year-selector' },
                    h('label', null, 'Year:'),
                    h('select', {
                        value: settingsYear,
                        onChange: (e) => setSettingsYear(e.target.value),
                        className: 'input-field',
                        style: { width: '120px' }
                    },
                        h('option', { value: '2024' }, '2024'),
                        h('option', { value: '2025' }, '2025'),
                        h('option', { value: '2026' }, '2026')
                    )
                )
            ),
            
            // Error/Success Messages
            error && h('div', { className: 'alert-banner danger' },
                h('div', { className: 'alert-content' },
                    h('span', { className: 'alert-icon' }, '❌'),
                    h('span', { className: 'alert-message' }, error),
                    h('button', { 
                        className: 'alert-close',
                        onClick: () => setError('')
                    }, '×')
                )
            ),
            
            success && h('div', { className: 'alert-banner success' },
                h('div', { className: 'alert-content' },
                    h('span', { className: 'alert-icon' }, '✅'),
                    h('span', { className: 'alert-message' }, success)
                )
            ),
            
            // Permission Notice for Managers
            userRole === 'Manager' && h('div', { 
                className: 'alert-banner warning',
                style: { marginBottom: '20px' }
            },
                h('div', { className: 'alert-content' },
                    h('span', { className: 'alert-icon' }, '🔒'),
                    h('span', { className: 'alert-message' }, 
                        `You can edit targets for: ${availableBrands.join(', ')} (${availableChannels.join(', ')})`
                    )
                )
            ),
            
            // Add New Brand Section (Admin only)
            canManageBrands && h('div', { className: 'add-brand-section' },
                h('div', { className: 'section-header' },
                    h('h3', null, '➕ Add New Brand'),
                    h('button', {
                        className: 'btn btn-primary',
                        onClick: () => setShowAddBrand(!showAddBrand)
                    }, showAddBrand ? 'Cancel' : 'Add New Brand')
                ),
                
                showAddBrand && h('div', { className: 'add-brand-form' },
                    h('div', { className: 'form-group' },
                        h('label', null, 'Brand Name:'),
                        h('input', {
                            type: 'text',
                            className: 'input-field',
                            placeholder: 'Enter brand name...',
                            value: newBrandName || '',
                            onChange: (e) => setNewBrandName(e.target.value)
                        })
                    ),
                    h('div', { className: 'form-group' },
                        h('label', null, 'Initial Annual Target:'),
                        h('input', {
                            type: 'number',
                            className: 'input-field',
                            placeholder: 'Enter initial target...',
                            value: newBrandTarget || '',
                            onChange: (e) => setNewBrandTarget(parseFloat(e.target.value) || 0)
                        })
                    ),
                    h('div', { style: { display: 'flex', gap: '12px', marginTop: '16px' } },
                        h('button', {
                            className: 'btn btn-success',
                            onClick: handleAddBrand,
                            disabled: !newBrandName || !newBrandTarget
                        }, 'Add Brand'),
                        h('button', {
                            className: 'btn btn-secondary',
                            onClick: () => {
                                setShowAddBrand(false);
                                setNewBrandName('');
                                setNewBrandTarget(0);
                            }
                        }, 'Cancel')
                    )
                )
            ),
            
            // Brand Table (filtered by permissions)
            h('div', { className: 'brand-table' },
                h('div', { className: 'table-wrapper' },
                    h('table', null,
                        h('thead', null,
                            h('tr', null,
                                h('th', null, 'Brand'),
                                ...availableChannels.map(channel =>
                                    h('th', { key: channel }, channel)
                                ),
                                h('th', null, 'Total'),
                                canEdit && h('th', null, 'Actions')
                            )
                        ),
                        h('tbody', null,
                            dynamicBrands.map(brand => {
                                const brandData = dynamicTargets[settingsYear]?.brands?.[brand] || {};
                                const annualData = brandData.annual || {};
                                
                                // Calculate total only for channels user can see
                                const total = availableChannels.reduce((sum, ch) => 
                                    sum + (annualData[ch] || 0), 0
                                );
                                
                                return h('tr', { key: brand },
                                    h('td', { className: 'brand-name-cell' }, brand),
                                    ...availableChannels.map(channel =>
                                        h('td', { 
                                            key: channel,
                                            style: {
                                                opacity: canEditTarget(brand, channel) ? 1 : 0.6
                                            }
                                        }, 
                                            formatCurrency ? formatCurrency(annualData[channel] || 0) : 
                                            '$' + (annualData[channel] || 0)
                                        )
                                    ),
                                    h('td', { style: { fontWeight: '700' } }, 
                                        formatCurrency ? formatCurrency(total) : '$' + total
                                    ),
                                    canEdit && h('td', null,
                                        h('div', { className: 'action-buttons' },
                                            h('button', {
                                                className: 'btn btn-primary',
                                                onClick: () => handleEditBrand(brand),
                                                style: { padding: '6px 12px', fontSize: '12px' },
                                                disabled: userRole === 'Manager' && 
                                                         !userPermissions?.brands?.includes(brand) &&
                                                         !userPermissions?.brands?.includes('All Brands')
                                            }, 'Edit')
                                        )
                                    )
                                );
                            })
                        )
                    )
                )
            ),
            
            // Edit Brand Modal (if editing)
            editingBrand && h('div', {
                style: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }
            },
                h('div', {
                    style: {
                        background: 'white',
                        borderRadius: '16px',
                        padding: '32px',
                        maxWidth: '1200px',
                        width: '90%',
                        maxHeight: '90vh',
                        overflow: 'auto'
                    }
                },
                    h('h3', { style: { marginBottom: '24px' } }, 
                        `Edit ${editingBrand} Targets (${settingsYear})`
                    ),
                    
                    userRole === 'Manager' && h('div', { 
                        className: 'alert-banner warning',
                        style: { marginBottom: '20px' }
                    },
                        h('div', { className: 'alert-content' },
                            h('span', { className: 'alert-message' }, 
                                'You can only modify channels you have permission for'
                            )
                        )
                    ),
                    
                    h('div', { className: 'add-brand-form' },
                        ...availableChannels.map(channel =>
                            h('div', { key: channel, className: 'form-group' },
                                h('label', null, `${channel} (Annual)`),
                                h('input', {
                                    type: 'number',
                                    className: 'input-field',
                                    value: editingValues.annual?.[channel] || 0,
                                    onChange: (e) => setEditingValues({
                                        ...editingValues,
                                        annual: { ...editingValues.annual, [channel]: parseFloat(e.target.value) || 0 }
                                    }),
                                    disabled: !canEditTarget(editingBrand, channel)
                                })
                            )
                        )
                    ),
                    h('div', { style: { marginTop: '24px' } },
                        h('h4', { style: { margin: '0 0 16px 0' } }, 'Quarterly Breakdown'),
                        ['Q1', 'Q2', 'Q3', 'Q4'].map(quarter =>
                            h('div', { key: quarter, style: { marginBottom: '24px' } },
                                h('h5', { style: { marginBottom: '12px', fontWeight: '600' } }, quarter),
                                h('div', { className: 'channel-inputs' },
                                    availableChannels.map(channel =>
                                        h('div', { key: `${quarter}-${channel}`, style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
                                            h('input', {
                                                type: 'number',
                                                className: 'input-field',
                                                value: editingValues[quarter]?.[channel] || 0,
                                                onChange: (e) => setEditingValues({
                                                    ...editingValues,
                                                    [quarter]: { ...editingValues[quarter], [channel]: parseFloat(e.target.value) || 0 }
                                                }),
                                                disabled: !canEditTarget(editingBrand, channel)
                                            }),
                                            h('label', { 
                                                style: { 
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    color: canEditTarget(editingBrand, channel) ? '#6B7280' : '#D1D5DB',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.3px',
                                                    textAlign: 'center'
                                                }
                                            }, channel)
                                        )
                                    )
                                )
                            )
                        )
                    ),
                    h('div', { style: { display: 'flex', gap: '12px', marginTop: '24px' } },
                        h('button', {
                            className: 'btn btn-success',
                            onClick: handleSaveEdit
                        }, 'Save Changes'),
                        h('button', {
                            className: 'btn btn-secondary',
                            onClick: () => {
                                setEditingBrand(null);
                                setEditingValues({});
                            }
                        }, 'Cancel')
                    )
                )
            )
        );
    }
    
    // Make Settings available globally
    window.Settings = Settings;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.Settings = Settings;
})();
