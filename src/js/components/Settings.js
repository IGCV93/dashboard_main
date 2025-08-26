/**
 * Settings Component - KPI and Brand Management
 */

(function() {
    'use strict';
    
    function Settings(props) {
        const { useState, useEffect, createElement: h } = React;
        
        const {
            brands: initialBrands,
            targets: initialTargets,
            channels,
            onUpdate
        } = props;
        
        // Get initial data from window
        const INITIAL_DATA = window.ChaiVision?.INITIAL_DATA || {};
        const ALL_CHANNELS = channels || INITIAL_DATA.channels || [];
        
        // Get formatters from window
        const { formatCurrency } = window.formatters || {};
        
        // State - Initialize with props
        const [settingsYear, setSettingsYear] = useState('2025');
        const [editingBrand, setEditingBrand] = useState(null);
        const [editingValues, setEditingValues] = useState({});
        const [showAddBrand, setShowAddBrand] = useState(false);
        const [dynamicBrands, setDynamicBrands] = useState(initialBrands || INITIAL_DATA.brands || []);
        const [dynamicTargets, setDynamicTargets] = useState(initialTargets || INITIAL_DATA.targets || {});
        
        // Update local state when props change
        useEffect(() => {
            if (initialBrands) {
                setDynamicBrands(initialBrands);
            }
            if (initialTargets) {
                setDynamicTargets(initialTargets);
            }
        }, [initialBrands, initialTargets]);
        
        // Initialize new brand with channel defaults
        const getEmptyBrandData = () => {
            const channelDefaults = {};
            ALL_CHANNELS.forEach(channel => {
                channelDefaults[channel] = 0;
            });
            return {
                name: '',
                annual: { ...channelDefaults },
                Q1: { ...channelDefaults },
                Q2: { ...channelDefaults },
                Q3: { ...channelDefaults },
                Q4: { ...channelDefaults }
            };
        };
        
        const [newBrand, setNewBrand] = useState(getEmptyBrandData());
        
        // Handle adding new brand
        const handleAddBrand = () => {
            if (!newBrand.name) {
                alert('Please enter a brand name');
                return;
            }
            
            const updatedBrands = [...dynamicBrands, newBrand.name];
            setDynamicBrands(updatedBrands);
            
            const updatedTargets = { ...dynamicTargets };
            if (!updatedTargets[settingsYear]) {
                updatedTargets[settingsYear] = { brands: {} };
            }
            
            updatedTargets[settingsYear].brands[newBrand.name] = {
                annual: { ...newBrand.annual },
                Q1: { ...newBrand.Q1 },
                Q2: { ...newBrand.Q2 },
                Q3: { ...newBrand.Q3 },
                Q4: { ...newBrand.Q4 }
            };
            
            setDynamicTargets(updatedTargets);
            
            // IMPORTANT: Notify parent component to update global state
            if (onUpdate) {
                onUpdate({
                    brands: updatedBrands,
                    targets: updatedTargets
                });
            }
            
            // Reset form
            setNewBrand(getEmptyBrandData());
            setShowAddBrand(false);
        };
        
        // Handle editing existing brand
        const handleEditBrand = (brand) => {
            const brandData = dynamicTargets[settingsYear]?.brands?.[brand];
            if (brandData) {
                setEditingBrand(brand);
                setEditingValues(JSON.parse(JSON.stringify(brandData)));
            }
        };
        
        // Handle saving edited brand
        const handleSaveEdit = () => {
            if (!editingBrand) return;
            
            const updatedTargets = { ...dynamicTargets };
            if (!updatedTargets[settingsYear]) {
                updatedTargets[settingsYear] = { brands: {} };
            }
            
            updatedTargets[settingsYear].brands[editingBrand] = editingValues;
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
        };
        
        // Handle deleting brand
        const handleDeleteBrand = (brand) => {
            if (!confirm(`Are you sure you want to delete ${brand}?`)) return;
            
            const updatedBrands = dynamicBrands.filter(b => b !== brand);
            const updatedTargets = { ...dynamicTargets };
            
            // Remove brand from all years
            Object.keys(updatedTargets).forEach(year => {
                if (updatedTargets[year]?.brands?.[brand]) {
                    delete updatedTargets[year].brands[brand];
                }
            });
            
            setDynamicBrands(updatedBrands);
            setDynamicTargets(updatedTargets);
            
            // Notify parent component
            if (onUpdate) {
                onUpdate({
                    brands: updatedBrands,
                    targets: updatedTargets
                });
            }
        };
        
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
            
            // Add Brand Section
            h('div', { className: 'add-brand-section' },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' } },
                    h('h3', { style: { fontSize: '20px', fontWeight: '700' } }, 'Add New Brand'),
                    h('button', {
                        className: 'btn btn-primary',
                        onClick: () => setShowAddBrand(!showAddBrand)
                    }, showAddBrand ? 'Cancel' : '+ Add Brand')
                ),
                
                showAddBrand && h('div', null,
                    h('div', { className: 'add-brand-form' },
                        h('div', { className: 'form-group' },
                            h('label', null, 'Brand Name'),
                            h('input', {
                                type: 'text',
                                className: 'input-field',
                                value: newBrand.name,
                                onChange: (e) => setNewBrand({ ...newBrand, name: e.target.value }),
                                placeholder: 'Enter brand name'
                            })
                        ),
                        ...ALL_CHANNELS.map(channel => 
                            h('div', { key: channel, className: 'form-group' },
                                h('label', null, channel),
                                h('input', {
                                    type: 'number',
                                    className: 'input-field',
                                    value: newBrand.annual[channel] || 0,
                                    onChange: (e) => setNewBrand({
                                        ...newBrand,
                                        annual: { ...newBrand.annual, [channel]: parseFloat(e.target.value) || 0 }
                                    }),
                                    placeholder: 'Annual target'
                                })
                            )
                        )
                    ),
                    h('div', { style: { marginTop: '20px' } },
                        h('h4', { style: { marginBottom: '12px' } }, 'Quarterly Breakdown'),
                        ['Q1', 'Q2', 'Q3', 'Q4'].map(quarter =>
                            h('div', { key: quarter, style: { marginBottom: '24px' } },
                                h('h5', { style: { marginBottom: '12px', fontWeight: '600', fontSize: '16px' } }, quarter),
                                h('div', { style: { marginBottom: '12px' } },
                                    h('div', { className: 'channel-inputs' },
                                        ALL_CHANNELS.slice(0, 4).map(channel =>
                                            h('div', { key: `${quarter}-${channel}`, style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
                                                h('input', {
                                                    type: 'number',
                                                    className: 'input-field',
                                                    value: newBrand[quarter][channel] || 0,
                                                    onChange: (e) => setNewBrand({
                                                        ...newBrand,
                                                        [quarter]: { ...newBrand[quarter], [channel]: parseFloat(e.target.value) || 0 }
                                                    }),
                                                    placeholder: '0'
                                                }),
                                                h('label', { 
                                                    style: { 
                                                        fontSize: '10px',
                                                        fontWeight: '600',
                                                        color: '#6B7280',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.3px',
                                                        textAlign: 'center'
                                                    }
                                                }, channel)
                                            )
                                        )
                                    )
                                ),
                                h('div', null,
                                    h('div', { className: 'channel-inputs' },
                                        ALL_CHANNELS.slice(4).map(channel =>
                                            h('div', { key: `${quarter}-${channel}`, style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
                                                h('input', {
                                                    type: 'number',
                                                    className: 'input-field',
                                                    value: newBrand[quarter][channel] || 0,
                                                    onChange: (e) => setNewBrand({
                                                        ...newBrand,
                                                        [quarter]: { ...newBrand[quarter], [channel]: parseFloat(e.target.value) || 0 }
                                                    }),
                                                    placeholder: '0'
                                                }),
                                                h('label', { 
                                                    style: { 
                                                        fontSize: '10px',
                                                        fontWeight: '600',
                                                        color: '#6B7280',
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
                        )
                    ),
                    h('button', {
                        className: 'btn btn-success',
                        onClick: handleAddBrand,
                        style: { marginTop: '20px' }
                    }, 'Save Brand')
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
                    h('h3', { style: { marginBottom: '24px' } }, `Edit ${editingBrand} Targets`),
                    h('div', { className: 'add-brand-form' },
                        ...ALL_CHANNELS.map(channel =>
                            h('div', { key: channel, className: 'form-group' },
                                h('label', null, `${channel} (Annual)`),
                                h('input', {
                                    type: 'number',
                                    className: 'input-field',
                                    value: editingValues.annual?.[channel] || 0,
                                    onChange: (e) => setEditingValues({
                                        ...editingValues,
                                        annual: { ...editingValues.annual, [channel]: parseFloat(e.target.value) || 0 }
                                    })
                                })
                            )
                        )
                    ),
                    h('div', { style: { marginTop: '24px' } },
                        h('h4', { style: { marginBottom: '16px' } }, 'Quarterly Breakdown'),
                        ['Q1', 'Q2', 'Q3', 'Q4'].map(quarter =>
                            h('div', { key: quarter, style: { marginBottom: '24px' } },
                                h('h5', { style: { marginBottom: '12px', fontWeight: '600' } }, quarter),
                                h('div', { className: 'channel-inputs' },
                                    ALL_CHANNELS.slice(0, 4).map(channel =>
                                        h('div', { key: `${quarter}-${channel}`, style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
                                            h('input', {
                                                type: 'number',
                                                className: 'input-field',
                                                value: editingValues[quarter]?.[channel] || 0,
                                                onChange: (e) => setEditingValues({
                                                    ...editingValues,
                                                    [quarter]: { ...editingValues[quarter], [channel]: parseFloat(e.target.value) || 0 }
                                                })
                                            }),
                                            h('label', { 
                                                style: { 
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    color: '#6B7280',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.3px',
                                                    textAlign: 'center'
                                                }
                                            }, channel)
                                        )
                                    )
                                ),
                                h('div', { className: 'channel-inputs', style: { marginTop: '12px' } },
                                    ALL_CHANNELS.slice(4).map(channel =>
                                        h('div', { key: `${quarter}-${channel}`, style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
                                            h('input', {
                                                type: 'number',
                                                className: 'input-field',
                                                value: editingValues[quarter]?.[channel] || 0,
                                                onChange: (e) => setEditingValues({
                                                    ...editingValues,
                                                    [quarter]: { ...editingValues[quarter], [channel]: parseFloat(e.target.value) || 0 }
                                                })
                                            }),
                                            h('label', { 
                                                style: { 
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    color: '#6B7280',
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
            ),
            
            // Brand Table
            h('div', { className: 'brand-table' },
                h('div', { className: 'table-wrapper' },
                    h('table', null,
                        h('thead', null,
                            h('tr', null,
                                h('th', null, 'Brand'),
                                ...ALL_CHANNELS.map(channel =>
                                    h('th', { key: channel }, channel)
                                ),
                                h('th', null, 'Total'),
                                h('th', null, 'Actions')
                            )
                        ),
                        h('tbody', null,
                            dynamicBrands.map(brand => {
                                const brandData = dynamicTargets[settingsYear]?.brands?.[brand] || {};
                                const annualData = brandData.annual || {};
                                const total = ALL_CHANNELS.reduce((sum, ch) => sum + (annualData[ch] || 0), 0);
                                
                                return h('tr', { key: brand },
                                    h('td', { className: 'brand-name-cell' }, brand),
                                    ...ALL_CHANNELS.map(channel =>
                                        h('td', { key: channel }, formatCurrency ? formatCurrency(annualData[channel] || 0) : '$' + (annualData[channel] || 0))
                                    ),
                                    h('td', { style: { fontWeight: '700' } }, formatCurrency ? formatCurrency(total) : '$' + total),
                                    h('td', null,
                                        h('div', { className: 'action-buttons' },
                                            h('button', {
                                                className: 'btn btn-primary',
                                                onClick: () => handleEditBrand(brand),
                                                style: { padding: '6px 12px', fontSize: '12px' }
                                            }, 'Edit'),
                                            h('button', {
                                                className: 'btn btn-danger',
                                                onClick: () => handleDeleteBrand(brand),
                                                style: { padding: '6px 12px', fontSize: '12px', marginLeft: '8px' }
                                            }, 'Delete')
                                        )
                                    )
                                );
                            })
                        )
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
