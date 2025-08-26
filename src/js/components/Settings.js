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
        
        // Seasonal distribution percentages
        const SEASONAL_DISTRIBUTIONS = {
            'LifePro': {
                Q1: 0.278,  // 27.8% - New Year fitness surge
                Q2: 0.176,  // 17.6%
                Q3: 0.176,  // 17.6%
                Q4: 0.370   // 37.0% - Holiday season
            },
            'default': {
                Q1: 0.182,  // 18.2%
                Q2: 0.182,  // 18.2%
                Q3: 0.273,  // 27.3% - Back to school/fall
                Q4: 0.363   // 36.3% - Holiday season
            }
        };
        
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
        
        // Smart auto-distribute based on brand and seasonal patterns
        const autoDistributeToQuarters = (brandName = null) => {
            const brand = brandName || newBrand.name;
            const distribution = SEASONAL_DISTRIBUTIONS[brand] || SEASONAL_DISTRIBUTIONS['default'];
            
            const updatedBrand = { ...newBrand };
            ALL_CHANNELS.forEach(channel => {
                const annualValue = updatedBrand.annual[channel] || 0;
                // Distribute based on seasonal percentages and round to 2 decimal places
                updatedBrand.Q1[channel] = Math.round(annualValue * distribution.Q1 * 100) / 100;
                updatedBrand.Q2[channel] = Math.round(annualValue * distribution.Q2 * 100) / 100;
                updatedBrand.Q3[channel] = Math.round(annualValue * distribution.Q3 * 100) / 100;
                updatedBrand.Q4[channel] = Math.round(annualValue * distribution.Q4 * 100) / 100;
            });
            setNewBrand(updatedBrand);
        };
        
        // Smart auto-distribute for editing
        const autoDistributeEditingToQuarters = () => {
            const distribution = SEASONAL_DISTRIBUTIONS[editingBrand] || SEASONAL_DISTRIBUTIONS['default'];
            
            const updatedValues = { ...editingValues };
            ALL_CHANNELS.forEach(channel => {
                const annualValue = updatedValues.annual?.[channel] || 0;
                // Distribute based on seasonal percentages and round to 2 decimal places
                if (!updatedValues.Q1) updatedValues.Q1 = {};
                if (!updatedValues.Q2) updatedValues.Q2 = {};
                if (!updatedValues.Q3) updatedValues.Q3 = {};
                if (!updatedValues.Q4) updatedValues.Q4 = {};
                
                updatedValues.Q1[channel] = Math.round(annualValue * distribution.Q1 * 100) / 100;
                updatedValues.Q2[channel] = Math.round(annualValue * distribution.Q2 * 100) / 100;
                updatedValues.Q3[channel] = Math.round(annualValue * distribution.Q3 * 100) / 100;
                updatedValues.Q4[channel] = Math.round(annualValue * distribution.Q4 * 100) / 100;
            });
            setEditingValues(updatedValues);
            
            // IMPORTANT: Save immediately after auto-distributing in edit mode
            setTimeout(() => {
                const updatedTargets = { ...dynamicTargets };
                if (!updatedTargets[settingsYear]) {
                    updatedTargets[settingsYear] = { brands: {} };
                }
                
                updatedTargets[settingsYear].brands[editingBrand] = updatedValues;
                setDynamicTargets(updatedTargets);
                
                // Notify parent component immediately
                if (onUpdate) {
                    onUpdate({
                        brands: dynamicBrands,
                        targets: updatedTargets
                    });
                }
                
                window.showSuccessMessage && window.showSuccessMessage('Quarterly targets auto-distributed and saved');
            }, 100);
        };
        
        // Get distribution display text
        const getDistributionText = (brandName) => {
            const dist = SEASONAL_DISTRIBUTIONS[brandName] || SEASONAL_DISTRIBUTIONS['default'];
            return `Q1: ${(dist.Q1 * 100).toFixed(1)}% | Q2: ${(dist.Q2 * 100).toFixed(1)}% | Q3: ${(dist.Q3 * 100).toFixed(1)}% | Q4: ${(dist.Q4 * 100).toFixed(1)}%`;
        };
        
        // Handle adding new brand
        const handleAddBrand = () => {
            if (!newBrand.name) {
                alert('Please enter a brand name');
                return;
            }
            
            // Check if quarterly values are set
            const hasQuarterlyValues = ['Q1', 'Q2', 'Q3', 'Q4'].some(quarter => 
                ALL_CHANNELS.some(channel => (newBrand[quarter][channel] || 0) > 0)
            );
            
            // If no quarterly values and annual values exist, auto-distribute
            const hasAnnualValues = ALL_CHANNELS.some(channel => (newBrand.annual[channel] || 0) > 0);
            
            let finalBrandData = { ...newBrand };
            
            if (!hasQuarterlyValues && hasAnnualValues) {
                // Automatically distribute based on brand patterns
                const distribution = SEASONAL_DISTRIBUTIONS[newBrand.name] || SEASONAL_DISTRIBUTIONS['default'];
                
                ALL_CHANNELS.forEach(channel => {
                    const annualValue = finalBrandData.annual[channel] || 0;
                    // Round to avoid floating point errors
                    finalBrandData.Q1[channel] = Math.round(annualValue * distribution.Q1 * 100) / 100;
                    finalBrandData.Q2[channel] = Math.round(annualValue * distribution.Q2 * 100) / 100;
                    finalBrandData.Q3[channel] = Math.round(annualValue * distribution.Q3 * 100) / 100;
                    finalBrandData.Q4[channel] = Math.round(annualValue * distribution.Q4 * 100) / 100;
                });
                
                const distType = SEASONAL_DISTRIBUTIONS[newBrand.name] ? 'custom' : 'default';
                console.log(`Auto-distributed using ${distType} seasonal pattern for ${newBrand.name}`);
            }
            
            const updatedBrands = [...dynamicBrands, newBrand.name];
            setDynamicBrands(updatedBrands);
            
            const updatedTargets = { ...dynamicTargets };
            if (!updatedTargets[settingsYear]) {
                updatedTargets[settingsYear] = { brands: {} };
            }
            
            // Use the properly distributed values
            updatedTargets[settingsYear].brands[newBrand.name] = {
                annual: { ...finalBrandData.annual },
                Q1: { ...finalBrandData.Q1 },
                Q2: { ...finalBrandData.Q2 },
                Q3: { ...finalBrandData.Q3 },
                Q4: { ...finalBrandData.Q4 }
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
                // Clean up any floating point errors in existing data
                const cleanedData = JSON.parse(JSON.stringify(brandData));
                ['Q1', 'Q2', 'Q3', 'Q4'].forEach(quarter => {
                    if (cleanedData[quarter]) {
                        ALL_CHANNELS.forEach(channel => {
                            if (cleanedData[quarter][channel]) {
                                cleanedData[quarter][channel] = Math.round(cleanedData[quarter][channel] * 100) / 100;
                            }
                        });
                    }
                });
                setEditingBrand(brand);
                setEditingValues(cleanedData);
            }
        };
        
        // Handle saving edited brand
        const handleSaveEdit = () => {
            if (!editingBrand) return;
            
            // Check if quarterly values are set
            const hasQuarterlyValues = ['Q1', 'Q2', 'Q3', 'Q4'].some(quarter => 
                ALL_CHANNELS.some(channel => (editingValues[quarter]?.[channel] || 0) > 0)
            );
            
            // If no quarterly values and annual values exist, auto-distribute
            const hasAnnualValues = ALL_CHANNELS.some(channel => (editingValues.annual?.[channel] || 0) > 0);
            
            if (!hasQuarterlyValues && hasAnnualValues) {
                if (!confirm(`No quarterly targets are set. Would you like to auto-distribute using ${editingBrand === 'LifePro' ? 'LifePro seasonal' : 'standard seasonal'} patterns?\n\n${getDistributionText(editingBrand)}`)) {
                    alert('Please set quarterly targets or use auto-distribute before saving.');
                    return;
                }
                autoDistributeEditingToQuarters();
                return;
            }
            
            // Round all values before saving to avoid floating point errors
            const cleanedValues = { ...editingValues };
            ['annual', 'Q1', 'Q2', 'Q3', 'Q4'].forEach(period => {
                if (cleanedValues[period]) {
                    ALL_CHANNELS.forEach(channel => {
                        if (cleanedValues[period][channel]) {
                            cleanedValues[period][channel] = Math.round(cleanedValues[period][channel] * 100) / 100;
                        }
                    });
                }
            });
            
            const updatedTargets = { ...dynamicTargets };
            if (!updatedTargets[settingsYear]) {
                updatedTargets[settingsYear] = { brands: {} };
            }
            
            updatedTargets[settingsYear].brands[editingBrand] = cleanedValues;
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
                        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } },
                            h('h4', { style: { margin: 0 } }, 'Quarterly Breakdown'),
                            h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' } },
                                h('button', {
                                    className: 'btn btn-secondary',
                                    onClick: () => autoDistributeToQuarters(newBrand.name),
                                    style: { padding: '6px 12px', fontSize: '12px' }
                                }, '⚡ Auto-distribute (Seasonal)'),
                                h('small', { 
                                    style: { 
                                        fontSize: '11px', 
                                        color: '#6B7280',
                                        fontStyle: 'italic'
                                    }
                                }, 
                                    newBrand.name ? getDistributionText(newBrand.name) : 'Enter brand name to see distribution'
                                )
                            )
                        ),
                        ['Q1', 'Q2', 'Q3', 'Q4'].map(quarter =>
                            h('div', { key: quarter, style: { marginBottom: '24px' } },
                                h('h5', { 
                                    style: { 
                                        marginBottom: '12px', 
                                        fontWeight: '600', 
                                        fontSize: '16px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }
                                }, 
                                    h('span', null, quarter),
                                    newBrand.name && h('span', { 
                                        style: { 
                                            fontSize: '12px', 
                                            color: '#6B7280',
                                            fontWeight: '400'
                                        }
                                    }, 
                                        `(${((SEASONAL_DISTRIBUTIONS[newBrand.name] || SEASONAL_DISTRIBUTIONS['default'])[quarter] * 100).toFixed(1)}% of annual)`
                                    )
                                ),
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
                        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } },
                            h('h4', { style: { margin: 0 } }, 'Quarterly Breakdown'),
                            h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' } },
                                h('button', {
                                    className: 'btn btn-secondary',
                                    onClick: autoDistributeEditingToQuarters,
                                    style: { padding: '6px 12px', fontSize: '12px' }
                                }, '⚡ Auto-distribute (Seasonal)'),
                                h('small', { 
                                    style: { 
                                        fontSize: '11px', 
                                        color: '#6B7280',
                                        fontStyle: 'italic'
                                    }
                                }, getDistributionText(editingBrand))
                            )
                        ),
                        ['Q1', 'Q2', 'Q3', 'Q4'].map(quarter =>
                            h('div', { key: quarter, style: { marginBottom: '24px' } },
                                h('h5', { 
                                    style: { 
                                        marginBottom: '12px', 
                                        fontWeight: '600',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }
                                }, 
                                    h('span', null, quarter),
                                    h('span', { 
                                        style: { 
                                            fontSize: '12px', 
                                            color: '#6B7280',
                                            fontWeight: '400'
                                        }
                                    }, 
                                        `(${((SEASONAL_DISTRIBUTIONS[editingBrand] || SEASONAL_DISTRIBUTIONS['default'])[quarter] * 100).toFixed(1)}% of annual)`
                                    )
                                ),
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
