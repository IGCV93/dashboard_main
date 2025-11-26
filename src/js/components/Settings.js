/**
 * Settings Component - KPI and Brand Management
 * ENHANCED WITH PERMISSION-BASED EDITING
 */

(function () {
    'use strict';

    function Settings(props) {
        const { useState, useEffect, createElement: h } = React;

        const {
            brands: initialBrands,
            targets: initialTargets,
            channels,
            onUpdate,
            onDeleteBrand,
            userRole,
            userPermissions,
            currentUser,
            salesData = [] // Add sales data for year detection
        } = props;

        // Get initial data from window
        const INITIAL_DATA = window.ChaiVision?.INITIAL_DATA || {};
        const ALL_CHANNELS = channels || INITIAL_DATA.channels || [];

        // Get formatters and services from window
        const { formatCurrency } = window.formatters || {};

        // Get year options dynamically based on actual data
        const { getYearOptions, getLatestYearFromData } = window.dateUtils || {};
        const yearOptions = getYearOptions ? getYearOptions(salesData) : [
            { value: '2024', label: '2024' },
            { value: '2025', label: '2025' }
        ];

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
        // Helper function to create empty targets structure
        const createEmptyTargets = () => {
            const emptyTargets = {
                annual: {},
                Q1: {},
                Q2: {},
                Q3: {},
                Q4: {}
            };

            availableChannels.forEach(channel => {
                emptyTargets.annual[channel] = 0;
                emptyTargets.Q1[channel] = 0;
                emptyTargets.Q2[channel] = 0;
                emptyTargets.Q3[channel] = 0;
                emptyTargets.Q4[channel] = 0;
            });

            return emptyTargets;
        };

        const [settingsYear, setSettingsYear] = useState(new Date().getFullYear().toString());
        const [editingBrand, setEditingBrand] = useState(null);
        const [editingValues, setEditingValues] = useState({});
        const [showAddBrand, setShowAddBrand] = useState(false);
        const [newBrandName, setNewBrandName] = useState('');
        const [newBrandTargets, setNewBrandTargets] = useState(createEmptyTargets());
        const [dynamicBrands, setDynamicBrands] = useState(availableBrands);
        const [dynamicTargets, setDynamicTargets] = useState(initialTargets || {});
        const [error, setError] = useState('');
        const [success, setSuccess] = useState('');
        const [isProcessing, setIsProcessing] = useState(false);
        const [showDeleteModal, setShowDeleteModal] = useState(false);
        const [brandToDelete, setBrandToDelete] = useState(null);
        const [deleteAction, setDeleteAction] = useState('delete'); // 'delete' or 'reassign'
        const [reassignToBrand, setReassignToBrand] = useState('');

        // Update local state when props change
        useEffect(() => {
            setDynamicBrands(availableBrands);
        }, [initialBrands, userPermissions]);

        // Handle ESC key to close modal and body scroll locking
        useEffect(() => {
            const handleKeyDown = (event) => {
                if (event.key === 'Escape' && editingBrand) {
                    setEditingBrand(null);
                    setEditingValues({});
                }
            };

            if (editingBrand) {
                // Lock body scroll when modal is open
                document.body.classList.add('modal-open');
                document.addEventListener('keydown', handleKeyDown);

                return () => {
                    document.body.classList.remove('modal-open');
                    document.removeEventListener('keydown', handleKeyDown);
                };
            }
        }, [editingBrand]);

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

        // Helper function to auto-calculate quarterly targets from annual
        const autoCalculateQuarterly = (annualTargets, brandName = '') => {
            const quarterlyTargets = {
                Q1: {},
                Q2: {},
                Q3: {},
                Q4: {}
            };

            // Use different quarterly distributions based on brand
            const isLifePro = brandName.toLowerCase() === 'lifepro';

            // LifePro quarterly distribution: Q1: 27.8%, Q2: 17.6%, Q3: 17.6%, Q4: 37.0%
            // Other brands: Q1: 18.2%, Q2: 18.2%, Q3: 27.3%, Q4: 36.3%
            const quarterlyPercentages = isLifePro
                ? { Q1: 0.278, Q2: 0.176, Q3: 0.176, Q4: 0.370 }
                : { Q1: 0.182, Q2: 0.182, Q3: 0.273, Q4: 0.363 };

            availableChannels.forEach(channel => {
                const annualValue = parseFloat(annualTargets[channel]) || 0;

                quarterlyTargets.Q1[channel] = annualValue * quarterlyPercentages.Q1;
                quarterlyTargets.Q2[channel] = annualValue * quarterlyPercentages.Q2;
                quarterlyTargets.Q3[channel] = annualValue * quarterlyPercentages.Q3;
                quarterlyTargets.Q4[channel] = annualValue * quarterlyPercentages.Q4;
            });

            return quarterlyTargets;
        };

        // Helper function to validate targets (using the validator from utils)
        const validateTargets = (targets) => {
            const { validateTargets: validateTargetsUtil } = window.validators || {};
            if (validateTargetsUtil) {
                return validateTargetsUtil(targets);
            }

            // Fallback validation
            const errors = [];
            if (!targets || typeof targets !== 'object') {
                errors.push('Invalid target configuration');
                return { isValid: false, errors };
            }

            if (!targets.annual || typeof targets.annual !== 'object') {
                errors.push('Annual targets are required');
            }

            ['Q1', 'Q2', 'Q3', 'Q4'].forEach(quarter => {
                if (!targets[quarter] || typeof targets[quarter] !== 'object') {
                    errors.push(`${quarter} targets are required`);
                }
            });

            return {
                isValid: errors.length === 0,
                errors
            };
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

            // Initialize empty targets if no data exists (allows setting targets for new brands)
            let editingData = brandData || createEmptyTargets();

            // Filter channels to only those the user can edit
            const filteredData = { ...editingData };
            if (userRole === 'Manager') {
                ['annual', 'Q1', 'Q2', 'Q3', 'Q4'].forEach(period => {
                    if (filteredData[period]) {
                        const filtered = {};
                        availableChannels.forEach(channel => {
                            if (filteredData[period][channel] !== undefined) {
                                filtered[channel] = filteredData[period][channel];
                            } else {
                                filtered[channel] = 0; // Initialize to 0 if missing
                            }
                        });
                        filteredData[period] = filtered;
                    } else {
                        // Initialize empty period if missing
                        filteredData[period] = {};
                        availableChannels.forEach(channel => {
                            filteredData[period][channel] = 0;
                        });
                    }
                });
            } else {
                // Admin: ensure all channels are initialized
                ['annual', 'Q1', 'Q2', 'Q3', 'Q4'].forEach(period => {
                    if (!filteredData[period]) {
                        filteredData[period] = {};
                    }
                    availableChannels.forEach(channel => {
                        if (filteredData[period][channel] === undefined) {
                            filteredData[period][channel] = 0;
                        }
                    });
                });
            }

            setEditingBrand(brand);
            setEditingValues(filteredData);
            setError('');
        };

        const removeBrandFromTargets = (targets, brandToRemove) => {
            if (!targets) return {};

            const updatedTargets = {};

            Object.entries(targets).forEach(([year, yearData]) => {
                if (!yearData) return;

                const updatedYear = { ...yearData };
                if (yearData.brands) {
                    const brandsCopy = { ...yearData.brands };
                    if (brandsCopy[brandToRemove]) {
                        delete brandsCopy[brandToRemove];
                    }
                    updatedYear.brands = brandsCopy;
                }

                updatedTargets[year] = updatedYear;
            });

            return updatedTargets;
        };

        // Handle add new brand
        const handleAddBrand = async () => {
            if (!newBrandName.trim()) {
                setError('Please enter a brand name');
                return;
            }

            if (dynamicBrands.includes(newBrandName.trim())) {
                setError('Brand already exists');
                return;
            }

            const brandName = newBrandName.trim();

            // Validate targets
            const targetValidation = validateTargets(newBrandTargets);
            if (!targetValidation.isValid) {
                setError('Invalid target configuration: ' + targetValidation.errors.join(', '));
                return;
            }

            try {
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

                updatedTargets[settingsYear].brands[brandName] = newBrandTargets;
                setDynamicTargets(updatedTargets);

                // Save to database if Supabase is enabled
                const supabase = getSupabaseClient();
                if (supabase && window.CONFIG?.FEATURES?.ENABLE_SUPABASE) {
                    try {
                        // Save brand to brands table
                        await supabase
                            .from('brands')
                            .insert({
                                name: brandName,
                                created_by: currentUser?.id,
                                created_at: new Date().toISOString()
                            });

                        // Save KPI targets
                        const targetsToSave = [];
                        availableChannels.forEach(channel => {
                            // Annual target
                            if (newBrandTargets.annual[channel]) {
                                targetsToSave.push({
                                    year: parseInt(settingsYear),
                                    period: 'annual',
                                    brand: brandName,
                                    channel: channel,
                                    target_value: newBrandTargets.annual[channel],
                                    created_by: currentUser?.id,
                                    created_at: new Date().toISOString()
                                });
                            }

                            // Quarterly targets
                            ['Q1', 'Q2', 'Q3', 'Q4'].forEach(quarter => {
                                if (newBrandTargets[quarter]?.[channel]) {
                                    targetsToSave.push({
                                        year: parseInt(settingsYear),
                                        period: quarter,
                                        brand: brandName,
                                        channel: channel,
                                        target_value: newBrandTargets[quarter][channel],
                                        created_by: currentUser?.id,
                                        created_at: new Date().toISOString()
                                    });
                                }
                            });
                        });

                        if (targetsToSave.length > 0) {
                            await supabase
                                .from('kpi_targets')
                                .insert(targetsToSave);
                        }

                        // Log to audit
                        await supabase
                            .from('audit_logs')
                            .insert({
                                user_id: currentUser?.id,
                                user_email: currentUser?.email,
                                user_role: userRole,
                                action: 'brand_created',
                                action_details: {
                                    brand_name: brandName,
                                    year: settingsYear,
                                    targets: newBrandTargets
                                },
                                reference_id: `BRAND_${Date.now()}_${brandName}`
                            });

                    } catch (dbError) {
                        console.error('Failed to save to database:', dbError);
                        // Continue with local update even if DB fails
                    }
                }

                // Notify parent component
                if (onUpdate) {
                    onUpdate({
                        brands: updatedBrands,
                        targets: updatedTargets
                    });
                }

                // Reset form
                setNewBrandName('');
                setNewBrandTargets(createEmptyTargets());
                setShowAddBrand(false);
                setSuccess(`Brand "${brandName}" added successfully`);
                setTimeout(() => setSuccess(''), 3000);

            } catch (error) {
                console.error('Failed to add brand:', error);
                setError('Failed to add brand. Please try again.');
            }
        };

        const handleDeleteBrand = (brand) => {
            if (!brand) return;

            if (!canManageBrands) {
                setError('Only administrators can delete brands.');
                return;
            }

            // Get available brands to reassign to (exclude the brand being deleted)
            const availableReassignBrands = dynamicBrands.filter(b => b !== brand);

            if (availableReassignBrands.length === 0) {
                // No other brands to reassign to, just delete
                setDeleteAction('delete');
                setReassignToBrand('');
            } else {
                // Set default reassign target to first available brand
                setReassignToBrand(availableReassignBrands[0]);
            }

            setBrandToDelete(brand);
            setShowDeleteModal(true);
            setError('');
        };

        const confirmDeleteBrand = async () => {
            if (!brandToDelete) return;

            if (deleteAction === 'reassign' && !reassignToBrand) {
                setError('Please select a brand to reassign data to.');
                return;
            }

            setShowDeleteModal(false);
            setError('');
            setSuccess('');
            setIsProcessing(true);

            const updatedBrands = dynamicBrands.filter(b => b !== brandToDelete);
            const updatedTargets = removeBrandFromTargets(dynamicTargets, brandToDelete);

            try {
                if (onDeleteBrand) {
                    await onDeleteBrand({
                        brand: brandToDelete,
                        brands: updatedBrands,
                        targets: updatedTargets,
                        reassignTo: deleteAction === 'reassign' ? reassignToBrand : null
                    });
                }

                setDynamicBrands(updatedBrands);
                setDynamicTargets(updatedTargets);

                if (editingBrand === brandToDelete) {
                    setEditingBrand(null);
                    setEditingValues({});
                }

                if (onUpdate) {
                    await Promise.resolve(onUpdate({
                        brands: updatedBrands,
                        targets: updatedTargets
                    }));
                }

                const actionText = deleteAction === 'reassign'
                    ? `reassigned to "${reassignToBrand}"`
                    : 'deleted';
                setSuccess(`Brand "${brandToDelete}" ${actionText} successfully`);
                setTimeout(() => setSuccess(''), 3000);
            } catch (err) {
                console.error('Failed to delete brand:', err);
                const errorMessage = err?.message || err?.toString() || '';
                if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
                    setError(`Operation timed out. The brand "${brandToDelete}" has a large amount of sales data. This may take several minutes. Please try again or contact support if the issue persists.`);
                } else {
                    setError(`Failed to ${deleteAction === 'reassign' ? 'reassign' : 'delete'} brand: ${errorMessage || 'Please try again.'}`);
                }
            } finally {
                setIsProcessing(false);
                setBrandToDelete(null);
                setDeleteAction('delete');
                setReassignToBrand('');
            }
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
                        ),
                        canManageBrands && h('button', {
                            className: 'kpi-btn-danger',
                            onClick: () => handleDeleteBrand(editingBrand),
                            disabled: isProcessing,
                            style: {
                                marginLeft: 'auto',
                                backgroundColor: '#DC2626',
                                color: 'white'
                            }
                        }, isProcessing ? 'Deleting…' : '🗑️ Delete Brand')
                    )
                )
            );
        }

        return h('div', { className: 'settings-wrapper' },
            // Main Settings Content
            h('div', { className: 'settings-container' },
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
                            ...yearOptions.map(year =>
                                h('option', { key: year.value, value: year.value }, year.label)
                            )
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

                    showAddBrand && h('div', {
                        className: 'add-brand-form',
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '32px',
                            padding: '32px',
                            background: 'white',
                            borderRadius: '16px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                            marginTop: '20px'
                        }
                    },
                        // Top Section: Brand Name
                        h('div', {
                            style: {
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px'
                            }
                        },
                            h('div', { className: 'form-group' },
                                h('label', {
                                    style: {
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: '#374151',
                                        marginBottom: '8px'
                                    }
                                }, 'BRAND NAME:'),
                                h('input', {
                                    type: 'text',
                                    className: 'input-field',
                                    placeholder: 'Enter brand name...',
                                    value: newBrandName || '',
                                    onChange: (e) => setNewBrandName(e.target.value),
                                    style: {
                                        padding: '12px 16px',
                                        fontSize: '16px',
                                        border: '2px solid #E5E7EB',
                                        borderRadius: '8px',
                                        width: '100%'
                                    }
                                })
                            )
                        ),

                        // Middle Section: Annual Targets (Horizontal Layout)
                        h('div', {
                            style: {
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px'
                            }
                        },
                            h('h4', {
                                style: {
                                    marginBottom: '16px',
                                    color: '#374151',
                                    fontSize: '18px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }
                            }, '📊 Annual Targets'),
                            h('div', {
                                style: {
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${availableChannels.length}, 1fr)`,
                                    gap: '16px'
                                }
                            },
                                availableChannels.map(channel =>
                                    h('div', {
                                        key: `annual-${channel}`,
                                        style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                            background: '#F9FAFB',
                                            padding: '16px',
                                            borderRadius: '8px',
                                            border: '1px solid #E5E7EB'
                                        }
                                    },
                                        h('label', {
                                            style: {
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                color: '#6B7280',
                                                textTransform: 'uppercase',
                                                textAlign: 'center'
                                            }
                                        }, `${channel} (ANNUAL)`),
                                        h('input', {
                                            type: 'number',
                                            className: 'input-field',
                                            placeholder: '0',
                                            value: newBrandTargets.annual[channel] || '',
                                            onChange: (e) => {
                                                const value = parseFloat(e.target.value) || 0;
                                                const updatedTargets = { ...newBrandTargets };
                                                updatedTargets.annual[channel] = value;
                                                setNewBrandTargets(updatedTargets);
                                            },
                                            style: {
                                                padding: '12px',
                                                fontSize: '14px',
                                                border: '1px solid #D1D5DB',
                                                borderRadius: '6px',
                                                width: '100%',
                                                textAlign: 'center'
                                            }
                                        })
                                    )
                                )
                            )
                        ),

                        // Bottom Section: Quarterly Targets (Horizontal Cards)
                        h('div', {
                            style: {
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px'
                            }
                        },
                            h('div', {
                                style: {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '16px'
                                }
                            },
                                h('h4', {
                                    style: {
                                        color: '#374151',
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        margin: 0
                                    }
                                }, '📅 Quarterly Targets'),
                                h('button', {
                                    className: 'btn btn-outline',
                                    onClick: () => {
                                        const updatedTargets = { ...newBrandTargets };
                                        const quarterlyTargets = autoCalculateQuarterly(newBrandTargets.annual, newBrandName);
                                        updatedTargets.Q1 = quarterlyTargets.Q1;
                                        updatedTargets.Q2 = quarterlyTargets.Q2;
                                        updatedTargets.Q3 = quarterlyTargets.Q3;
                                        updatedTargets.Q4 = quarterlyTargets.Q4;
                                        setNewBrandTargets(updatedTargets);
                                    },
                                    style: {
                                        padding: '8px 16px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        background: '#F3F4F6',
                                        border: '1px solid #D1D5DB',
                                        borderRadius: '6px',
                                        color: '#374151'
                                    }
                                }, 'Auto-Calculate Quarterly')
                            ),
                            h('p', {
                                style: {
                                    fontSize: '14px',
                                    color: '#6B7280',
                                    marginBottom: '16px',
                                    lineHeight: '1.4'
                                }
                            }, 'Quarterly targets are auto-calculated using brand-specific distributions. LifePro: Q1(27.8%), Q2(17.6%), Q3(17.6%), Q4(37.0%). Other brands: Q1(18.2%), Q2(18.2%), Q3(27.3%), Q4(36.3%).'),

                            // Horizontal Layout for Quarterly Cards
                            h('div', {
                                style: {
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: '16px'
                                }
                            },
                                ['Q1', 'Q2', 'Q3', 'Q4'].map(quarter =>
                                    h('div', {
                                        key: quarter,
                                        style: {
                                            background: '#F9FAFB',
                                            padding: '16px',
                                            borderRadius: '12px',
                                            border: '2px solid #E5E7EB',
                                            minHeight: '300px'
                                        }
                                    },
                                        h('h5', {
                                            style: {
                                                marginBottom: '16px',
                                                fontWeight: '700',
                                                color: '#374151',
                                                fontSize: '16px',
                                                textAlign: 'center',
                                                background: '#E5E7EB',
                                                padding: '8px 12px',
                                                borderRadius: '6px'
                                            }
                                        }, quarter),
                                        h('div', {
                                            style: {
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '8px'
                                            }
                                        },
                                            availableChannels.map(channel =>
                                                h('div', {
                                                    key: `${quarter}-${channel}`,
                                                    style: {
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '4px'
                                                    }
                                                },
                                                    h('label', {
                                                        style: {
                                                            fontSize: '11px',
                                                            color: '#6B7280',
                                                            fontWeight: '600',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.5px'
                                                        }
                                                    }, channel),
                                                    h('input', {
                                                        type: 'number',
                                                        className: 'input-field',
                                                        placeholder: '0',
                                                        value: newBrandTargets[quarter]?.[channel] || '',
                                                        onChange: (e) => {
                                                            const value = parseFloat(e.target.value) || 0;
                                                            const updatedTargets = { ...newBrandTargets };
                                                            if (!updatedTargets[quarter]) updatedTargets[quarter] = {};
                                                            updatedTargets[quarter][channel] = value;
                                                            setNewBrandTargets(updatedTargets);
                                                        },
                                                        style: {
                                                            padding: '6px 8px',
                                                            fontSize: '12px',
                                                            border: '1px solid #D1D5DB',
                                                            borderRadius: '4px',
                                                            width: '100%',
                                                            minHeight: '32px'
                                                        }
                                                    })
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    ),

                    // Action Buttons - Outside the form grid
                    showAddBrand && h('div', {
                        style: {
                            display: 'flex',
                            gap: '12px',
                            marginTop: '24px',
                            justifyContent: 'center',
                            padding: '20px',
                            background: '#F9FAFB',
                            borderRadius: '12px',
                            border: '1px solid #E5E7EB'
                        }
                    },
                        h('button', {
                            className: 'btn btn-success',
                            onClick: handleAddBrand,
                            disabled: !newBrandName,
                            style: {
                                padding: '12px 24px',
                                fontSize: '16px',
                                fontWeight: '600'
                            }
                        }, 'Add Brand'),
                        h('button', {
                            className: 'btn btn-secondary',
                            onClick: () => {
                                setShowAddBrand(false);
                                setNewBrandName('');
                                setNewBrandTargets(createEmptyTargets());
                            },
                            style: {
                                padding: '12px 24px',
                                fontSize: '16px',
                                fontWeight: '600'
                            }
                        }, 'Cancel'),

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
                                        h('td', { className: 'brand-name-cell' },
                                            h('span', { className: 'brand-pill' }, brand)
                                        ),
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
                )
            ),

            // KPI Edit Modal - Clean Implementation with Portal
            editingBrand && ReactDOM.createPortal(
                h('div', {
                    className: 'kpi-modal-overlay',
                    onClick: (e) => {
                        // Close if clicking on overlay (not modal content)
                        if (e.target.className === 'kpi-modal-overlay') {
                            setEditingBrand(null);
                            setEditingValues({});
                        }
                    }
                },
                    h('div', { className: 'kpi-modal' },
                        // Modal Header
                        h('div', { className: 'kpi-modal-header' },
                            h('h2', null, `Edit ${editingBrand} Targets (${settingsYear})`),
                            h('button', {
                                className: 'kpi-modal-close',
                                onClick: () => {
                                    setEditingBrand(null);
                                    setEditingValues({});
                                },
                                'aria-label': 'Close modal'
                            }, '×')
                        ),

                        // Modal Body
                        h('div', { className: 'kpi-modal-body' },
                            // Permission Warning for Managers
                            userRole === 'Manager' && h('div', { className: 'kpi-modal-alert' },
                                h('span', null, '⚠️'),
                                h('span', null, 'You can only edit targets for brands and channels you have permission to manage')
                            ),

                            // Annual Targets Section
                            h('div', { className: 'kpi-target-section' },
                                h('div', { className: 'kpi-section-header' },
                                    h('h3', null, 'Annual Targets')
                                ),
                                h('div', { className: 'kpi-annual-grid' },
                                    availableChannels.map(channel =>
                                        h('div', { key: channel, className: 'kpi-channel-input' },
                                            h('label', { className: 'kpi-channel-label' }, channel),
                                            h('div', { className: 'kpi-input-wrapper' },
                                                h('span', { className: 'kpi-input-prefix' }, '$'),
                                                h('input', {
                                                    className: 'kpi-input',
                                                    type: 'number',
                                                    value: editingValues.annual?.[channel] || 0,
                                                    onChange: (e) => setEditingValues({
                                                        ...editingValues,
                                                        annual: { ...editingValues.annual, [channel]: parseFloat(e.target.value) || 0 }
                                                    }),
                                                    disabled: !canEditTarget(editingBrand, channel)
                                                })
                                            )
                                        )
                                    )
                                )
                            ),

                            // Quarterly Targets Section
                            h('div', { className: 'kpi-target-section' },
                                h('div', { className: 'kpi-section-header' },
                                    h('h3', null, 'Quarterly Targets'),
                                    h('button', {
                                        className: 'kpi-btn-auto',
                                        onClick: () => {
                                            const autoCalculated = autoCalculateQuarterly(editingValues.annual || {}, editingBrand);
                                            setEditingValues({
                                                ...editingValues,
                                                ...autoCalculated
                                            });
                                        }
                                    }, '⚡ Auto-calculate from Annual')
                                ),
                                h('div', { className: 'kpi-quarterly-grid' },
                                    ['Q1', 'Q2', 'Q3', 'Q4'].map(quarter =>
                                        h('div', { key: quarter, className: 'kpi-quarter-section' },
                                            h('h4', { className: 'kpi-quarter-title' }, quarter),
                                            availableChannels.map(channel =>
                                                h('div', { key: `${quarter}-${channel}`, className: 'kpi-channel-input' },
                                                    h('label', { className: 'kpi-channel-label' }, channel),
                                                    h('div', { className: 'kpi-input-wrapper' },
                                                        h('span', { className: 'kpi-input-prefix' }, '$'),
                                                        h('input', {
                                                            className: 'kpi-input',
                                                            type: 'number',
                                                            value: editingValues[quarter]?.[channel] || 0,
                                                            onChange: (e) => setEditingValues({
                                                                ...editingValues,
                                                                [quarter]: { ...editingValues[quarter], [channel]: parseFloat(e.target.value) || 0 }
                                                            }),
                                                            disabled: !canEditTarget(editingBrand, channel)
                                                        })
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        ),

                        // Modal Footer
                        h('div', { className: 'kpi-modal-footer' },
                            h('button', {
                                className: 'kpi-btn-secondary',
                                onClick: () => {
                                    setEditingBrand(null);
                                    setEditingValues({});
                                },
                                disabled: isProcessing
                            }, 'Cancel'),
                            h('button', {
                                className: 'kpi-btn-primary',
                                onClick: handleSaveEdit,
                                disabled: isProcessing
                            }, '💾 Save Changes'),
                            canManageBrands && h('button', {
                                onClick: () => handleDeleteBrand(editingBrand),
                                disabled: isProcessing,
                                style: {
                                    marginLeft: 'auto',
                                    backgroundColor: '#DC2626',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '10px 16px',
                                    fontWeight: '600',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer'
                                }
                            }, isProcessing ? 'Deleting…' : '🗑️ Delete Brand')
                        )
                    )
                ),
                document.body // Portal to body
            ),

            // Delete Confirmation Modal
            showDeleteModal && ReactDOM.createPortal(
                h('div', {
                    className: 'kpi-modal-overlay',
                    onClick: (e) => {
                        if (e.target.className === 'kpi-modal-overlay' && !isProcessing) {
                            setShowDeleteModal(false);
                            setBrandToDelete(null);
                        }
                    }
                },
                    h('div', { className: 'kpi-modal', style: { maxWidth: '500px' } },
                        // Modal Header
                        h('div', { className: 'kpi-modal-header' },
                            h('h2', null, `Delete Brand: ${brandToDelete}`),
                            h('button', {
                                className: 'kpi-modal-close',
                                onClick: () => {
                                    if (!isProcessing) {
                                        setShowDeleteModal(false);
                                        setBrandToDelete(null);
                                    }
                                },
                                disabled: isProcessing,
                                'aria-label': 'Close modal'
                            }, '×')
                        ),

                        // Modal Body
                        h('div', { className: 'kpi-modal-body' },
                            h('p', { style: { marginBottom: '20px', color: '#6B7280' } },
                                `What would you like to do with the sales data for "${brandToDelete}"?`
                            ),

                            h('div', { style: { marginBottom: '20px' } },
                                h('label', {
                                    style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: deleteAction === 'reassign' ? '2px solid #667eea' : '2px solid #E5E7EB',
                                        backgroundColor: deleteAction === 'reassign' ? '#F3F4F6' : 'white',
                                        cursor: 'pointer',
                                        marginBottom: '12px'
                                    },
                                    onClick: () => !isProcessing && setDeleteAction('reassign')
                                },
                                    h('input', {
                                        type: 'radio',
                                        checked: deleteAction === 'reassign',
                                        onChange: () => setDeleteAction('reassign'),
                                        disabled: isProcessing,
                                        style: { marginRight: '12px' }
                                    }),
                                    h('div', { style: { flex: 1 } },
                                        h('div', { style: { fontWeight: '600', marginBottom: '4px' } }, 'Move data to another brand'),
                                        h('div', { style: { fontSize: '14px', color: '#6B7280' } },
                                            'Reassign all sales data, KPI targets, and permissions to another brand'
                                        )
                                    )
                                ),

                                deleteAction === 'reassign' && dynamicBrands.filter(b => b !== brandToDelete).length > 0 && h('div', {
                                    style: {
                                        marginLeft: '40px',
                                        marginTop: '12px',
                                        marginBottom: '12px'
                                    }
                                },
                                    h('label', {
                                        style: {
                                            display: 'block',
                                            marginBottom: '8px',
                                            fontWeight: '600',
                                            fontSize: '14px'
                                        }
                                    }, 'Select brand:'),
                                    h('select', {
                                        value: reassignToBrand,
                                        onChange: (e) => setReassignToBrand(e.target.value),
                                        disabled: isProcessing,
                                        style: {
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '2px solid #E5E7EB',
                                            fontSize: '14px'
                                        }
                                    },
                                        dynamicBrands.filter(b => b !== brandToDelete).map(brand =>
                                            h('option', { key: brand, value: brand }, brand)
                                        )
                                    )
                                ),

                                h('label', {
                                    style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: deleteAction === 'delete' ? '2px solid #DC2626' : '2px solid #E5E7EB',
                                        backgroundColor: deleteAction === 'delete' ? '#FEF2F2' : 'white',
                                        cursor: 'pointer'
                                    },
                                    onClick: () => !isProcessing && setDeleteAction('delete')
                                },
                                    h('input', {
                                        type: 'radio',
                                        checked: deleteAction === 'delete',
                                        onChange: () => setDeleteAction('delete'),
                                        disabled: isProcessing,
                                        style: { marginRight: '12px' }
                                    }),
                                    h('div', { style: { flex: 1 } },
                                        h('div', { style: { fontWeight: '600', marginBottom: '4px', color: '#DC2626' } }, 'Delete all data permanently'),
                                        h('div', { style: { fontSize: '14px', color: '#6B7280' } },
                                            'Permanently delete all sales data, KPI targets, and permissions. This cannot be undone.'
                                        )
                                    )
                                )
                            ),

                            h('div', {
                                style: {
                                    padding: '12px',
                                    backgroundColor: '#FEF3C7',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    color: '#92400E'
                                }
                            },
                                '⚠️ This action cannot be undone. For brands with large amounts of data, this may take several minutes.'
                            )
                        ),

                        // Modal Footer
                        h('div', { className: 'kpi-modal-footer' },
                            h('button', {
                                className: 'kpi-btn-secondary',
                                onClick: () => {
                                    if (!isProcessing) {
                                        setShowDeleteModal(false);
                                        setBrandToDelete(null);
                                    }
                                },
                                disabled: isProcessing
                            }, 'Cancel'),
                            h('button', {
                                className: deleteAction === 'delete' ? 'kpi-btn-danger' : 'kpi-btn-primary',
                                onClick: confirmDeleteBrand,
                                disabled: isProcessing || (deleteAction === 'reassign' && !reassignToBrand),
                                style: {
                                    backgroundColor: deleteAction === 'delete' ? '#DC2626' : '#667eea',
                                    color: 'white'
                                }
                            }, isProcessing
                                ? (deleteAction === 'reassign' ? 'Reassigning…' : 'Deleting…')
                                : (deleteAction === 'reassign' ? `Move to ${reassignToBrand}` : '🗑️ Delete Permanently')
                            )
                        )
                    )
                ),
                document.body
            )
        );
    }

    // Make Settings available globally
    window.Settings = Settings;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.Settings = Settings;
})();
