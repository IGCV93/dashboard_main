/**
 * Settings Component - KPI Settings and Brand Management
 */

import { formatCurrency } from '../utils/formatters.js';
import { ALL_CHANNELS } from '../../data/initialData.js';

export function Settings(props) {
    const { useState, useEffect, createElement: h } = React;
    
    const { brands, targets, channels, onUpdate } = props;
    
    // State
    const [settingsYear, setSettingsYear] = useState('2025');
    const [editingBrand, setEditingBrand] = useState(null);
    const [editingValues, setEditingValues] = useState({});
    const [showAddBrand, setShowAddBrand] = useState(false);
    const [dynamicBrands, setDynamicBrands] = useState(brands || []);
    const [dynamicTargets, setDynamicTargets] = useState(targets || {});
    const [newBrand, setNewBrand] = useState({
        name: '',
        annual: {},
        Q1: {},
        Q2: {},
        Q3: {},
        Q4: {}
    });
    
    // Initialize channel values for new brand
    useEffect(() => {
        const channelDefaults = {};
        ALL_CHANNELS.forEach(channel => {
            channelDefaults[channel] = 0;
        });
        setNewBrand({
            name: '',
            annual: { ...channelDefaults },
            Q1: { ...channelDefaults },
            Q2: { ...channelDefaults },
            Q3: { ...channelDefaults },
            Q4: { ...channelDefaults }
        });
    }, []);
    
    // Handle adding a new brand
    const handleAddBrand = () => {
        if (!newBrand.name) {
            alert('Please enter a brand name');
            return;
        }
        
        // Add to brands list
        const updatedBrands = [...dynamicBrands, newBrand.name];
        setDynamicBrands(updatedBrands);
        
        // Add to targets
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
        
        // Reset form
        const channelDefaults = {};
        ALL_CHANNELS.forEach(channel => {
            channelDefaults[channel] = 0;
        });
        setNewBrand({
            name: '',
            annual: { ...channelDefaults },
            Q1: { ...channelDefaults },
            Q2: { ...channelDefaults },
            Q3: { ...channelDefaults },
            Q4: { ...channelDefaults }
        });
        setShowAddBrand(false);
        
        // Notify parent
        if (onUpdate) {
            onUpdate({ brands: updatedBrands, targets: updatedTargets });
        }
    };
    
    // Handle editing a brand
    const handleEditBrand = (brand) => {
        const brandData = dynamicTargets[settingsYear]?.brands?.[brand];
        if (brandData) {
            setEditingBrand(brand);
            setEditingValues({
                annual: { ...brandData.annual },
                Q1: { ...brandData.Q1 },
                Q2: { ...brandData.Q2 },
                Q3: { ...brandData.Q3 },
                Q4: { ...brandData.Q4 }
            });
        }
    };
    
    // Handle saving edited brand
    const handleSaveEdit = () => {
        const updatedTargets = { ...dynamicTargets };
        if (!updatedTargets[settingsYear]) {
            updatedTargets[settingsYear] = { brands: {} };
        }
        
        updatedTargets[settingsYear].brands[editingBrand] = { ...editingValues };
        setDynamicTargets(updatedTargets);
        setEditingBrand(null);
        setEditingValues({});
        
        // Notify parent
        if (onUpdate) {
            onUpdate({ brands: dynamicBrands, targets: updatedTargets });
        }
    };
    
    // Handle deleting a brand
    const handleDeleteBrand = (brand) => {
        if (!confirm(`Are you sure you want to delete ${brand}?`)) return;
        
        const updatedBrands = dynamicBrands.filter(b => b !== brand);
        const updatedTargets = { ...dynamicTargets };
        
        Object.keys(updatedTargets).forEach(year => {
            if (updatedTargets[year]?.brands?.[brand]) {
                delete updatedTargets[year].brands[brand];
            }
        });
        
        setDynamicBrands(updatedBrands);
        setDynamicTargets(updatedTargets);
        
        // Notify parent
        if (onUpdate) {
            onUpdate({ brands: updatedBrands, targets: updatedTargets });
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
                        h('div', { key: quarter, style: { marginBottom: '16px' } },
                            h('h5', { style: { marginBottom: '8px', fontWeight: '600' } }, quarter),
                            h('div', { className: 'channel-inputs' },
                                ALL_CHANNELS.slice(0, 4).map(channel =>
                                    h('input', {
                                        key: `${quarter}-${channel}`,
                                        type: 'number',
                                        className: 'input-field',
                                        value: newBrand[quarter][channel] || 0,
                                        onChange: (e) => setNewBrand({
                                            ...newBrand,
                                            [quarter]: { ...newBrand[quarter], [channel]: parseFloat(e.target.value) || 0 }
                                        }),
                                        placeholder: channel.substring(0, 3)
                                    })
                                )
                            ),
                            h('div', { className: 'channel-inputs', style: { marginTop: '8px' } },
                                ALL_CHANNELS.slice(4).map(channel =>
                                    h('input', {
                                        key: `${quarter}-${channel}`,
                                        type: 'number',
                                        className: 'input-field',
                                        value: newBrand[quarter][channel] || 0,
                                        onChange: (e) => setNewBrand({
                                            ...newBrand,
                                            [quarter]: { ...newBrand[quarter], [channel]: parseFloat(e.target.value) || 0 }
                                        }),
                                        placeholder: channel.substring(0, 3)
                                    })
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
                            const isEditing = editingBrand === brand;
                            const brandData = isEditing ? editingValues : 
                                             dynamicTargets[settingsYear]?.brands?.[brand] || {};
                            const annualData = brandData.annual || {};
                            const total = ALL_CHANNELS.reduce((sum, ch) => sum + (annualData[ch] || 0), 0);
                            
                            if (isEditing) {
                                return h('tr', { key: brand },
                                    h('td', { className: 'brand-name-cell' }, brand),
                                    ...ALL_CHANNELS.map(channel =>
                                        h('td', { key: channel },
                                            h('input', {
                                                type: 'number',
                                                className: 'input-field',
                                                value: editingValues.annual[channel] || 0,
                                                onChange: (e) => setEditingValues({
                                                    ...editingValues,
                                                    annual: {
                                                        ...editingValues.annual,
                                                        [channel]: parseFloat(e.target.value) || 0
                                                    }
                                                }),
                                                style: { width: '100px' }
                                            })
                                        )
                                    ),
                                    h('td', { style: { fontWeight: '700' } }, formatCurrency(total)),
                                    h('td', null,
                                        h('div', { className: 'action-buttons' },
                                            h('button', {
                                                className: 'btn btn-success',
                                                onClick: handleSaveEdit,
                                                style: { padding: '6px 12px', fontSize: '12px' }
                                            }, 'Save'),
                                            h('button', {
                                                className: 'btn btn-secondary',
                                                onClick: () => {
                                                    setEditingBrand(null);
                                                    setEditingValues({});
                                                },
                                                style: { padding: '6px 12px', fontSize: '12px' }
                                            }, 'Cancel')
                                        )
                                    )
                                );
                            }
                            
                            return h('tr', { key: brand },
                                h('td', { className: 'brand-name-cell' }, brand),
                                ...ALL_CHANNELS.map(channel =>
                                    h('td', { key: channel }, formatCurrency(annualData[channel] || 0))
                                ),
                                h('td', { style: { fontWeight: '700' } }, formatCurrency(total)),
                                h('td', null,
                                    h('div', { className: 'action-buttons' },
                                        h('button', {
                                            className: 'btn btn-primary',
                                            onClick: () => handleEditBrand(brand),
                                            style: { padding: '6px 12px', fontSize: '12px' }
                                        }, 'Edit'),
                                        brand !== 'LifePro' && brand !== 'PetCove' && h('button', {
                                            className: 'btn btn-danger',
                                            onClick: () => handleDeleteBrand(brand),
                                            style: { padding: '6px 12px', fontSize: '12px' }
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
// At the end of the file, add:
window.Dashboard = Dashboard;  // or window.Settings = Settings, etc.
