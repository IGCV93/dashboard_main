/**
 * Upload Component - Handle CSV and Excel file uploads
 * ENHANCED WITH PERMISSION VALIDATION
 */

(function() {
    'use strict';
    
    function Upload(props) {
        const { useState, useRef, createElement: h } = React;
        
        const { 
            dataService, 
            onUploadComplete, 
            config,
            userRole,
            userPermissions,
            currentUser
        } = props;
        
        // Permission check - only Admin and Manager can upload
        if (userRole === 'User') {
            return h('div', { className: 'upload-container' },
                h('div', { className: 'alert-banner warning' },
                    h('div', { className: 'alert-content' },
                        h('span', { className: 'alert-icon' }, '🔒'),
                        h('span', { className: 'alert-message' }, 
                            'You do not have permission to upload data. Contact an administrator or manager.'
                        )
                    )
                )
            );
        }
        
        // Get dependencies from window
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
        
        // Get allowed brands and channels based on permissions
        const getAllowedBrands = () => {
            if (userRole === 'Admin' || userPermissions?.brands?.includes('All Brands')) {
                return window.DEFAULT_BRANDS || ['LifePro', 'PetCove', 'Joyberri', 'Oaktiv', 'Loft & Ivy', 'New Brands'];
            }
            return userPermissions?.brands || [];
        };
        
        const getAllowedChannels = () => {
            if (userRole === 'Admin' || userPermissions?.channels?.includes('All Channels')) {
                return window.ALL_CHANNELS || ['Amazon', 'TikTok', 'DTC-Shopify', 'Retail', 
                                              'CA International', 'UK International', 'Wholesale', 'Omnichannel'];
            }
            return userPermissions?.channels || [];
        };
        
        const allowedBrands = getAllowedBrands();
        const allowedChannels = getAllowedChannels();
        
        // State
        const [uploadedFile, setUploadedFile] = useState(null);
        const [uploadedData, setUploadedData] = useState([]);
        const [filteredData, setFilteredData] = useState([]);
        const [rejectedData, setRejectedData] = useState([]);
        const [uploadProgress, setUploadProgress] = useState(0);
        const [uploadStatus, setUploadStatus] = useState(null);
        const [validationErrors, setValidationErrors] = useState([]);
        const [isDragging, setIsDragging] = useState(false);
        const [batchProgress, setBatchProgress] = useState(null); // New state for batch progress
        
        const fileInputRef = useRef(null);
        const supabaseEnabled = config?.FEATURES?.ENABLE_SUPABASE || false;
        
        // UUID helper (uses crypto.randomUUID if available, otherwise fallback)
        const generateUUID = () => {
            try {
                if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                    return window.crypto.randomUUID();
                }
            } catch (e) {}
            // Fallback RFC4122 v4 generator
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        // Deterministic source_id helper for deduplication (date|channel|brand)
        const normalizeKey = (value) => {
            const str = String(value || '')
                .trim()
                .toLowerCase()
                .replace(/&/g, 'and')
                .replace(/[^a-z0-9]+/g, '');
            return str;
        };
        const buildSourceIdFromCanon = (dateVal, channelName, brandName, index = null) => {
            const timestamp = Date.now();
            const uniqueSuffix = index !== null ? `_${index}_${timestamp}` : `_${timestamp}`;
            return `${normalizeKey(dateVal)}|${normalizeKey(channelName)}|${normalizeKey(brandName)}${uniqueSuffix}`;
        };

        // Fetch canonical brand/channel maps from Supabase
        const getCanonicalMaps = async () => {
            const supabase = getSupabaseClient();
            const brandMap = new Map();
            const channelMap = new Map();
            if (!supabase) return { brandMap, channelMap };
            try {
                const [{ data: brands }, { data: channels }] = await Promise.all([
                    supabase.from('brands').select('id, name, is_active'),
                    supabase.from('channels').select('id, name, is_active')
                ]);
                (brands || []).forEach(b => {
                    if (b?.name) brandMap.set(normalizeKey(b.name), { id: b.id, name: b.name });
                });
                (channels || []).forEach(c => {
                    if (c?.name) channelMap.set(normalizeKey(c.name), { id: c.id, name: c.name });
                });
            } catch (e) {
                // Failed to load canonical brand/channel maps
            }
            return { brandMap, channelMap };
        };

        // Audit log helper
        const logUpload = async (recordCount, acceptedCount, rejectedCount, fileName) => {
            const supabase = getSupabaseClient();
            if (!supabase) return;
            
            const uploadBatchId = generateUUID();
            
            try {
                await supabase
                    .from('audit_logs')
                    .insert({
                        user_id: currentUser?.id,
                        user_email: currentUser?.email,
                        user_role: userRole,
                        action: 'data_upload',
                        action_details: {
                            file_name: fileName,
                            total_records: recordCount,
                            accepted_records: acceptedCount,
                            rejected_records: rejectedCount,
                            allowed_brands: allowedBrands,
                            allowed_channels: allowedChannels,
                            timestamp: new Date().toISOString()
                        },
                        reference_id: uploadBatchId
                    });
                    
                return uploadBatchId;
            } catch (error) {
                // Failed to log upload
                return null;
            }
        };
        
        // Download template
        const downloadTemplate = () => {
            const templateData = [
                ['Date', 'Channel', 'Brand', 'Revenue'],
                ['2025-01-01', allowedChannels[0] || 'Amazon', allowedBrands[0] || 'LifePro', '250000'],
                ['2025-01-01', allowedChannels[1] || 'TikTok', allowedBrands[0] || 'LifePro', '30000'],
                ['2025-01-02', allowedChannels[0] || 'Amazon', allowedBrands[0] || 'LifePro', '275000'],
                ['', '', '', ''],
                ['Instructions:', '', '', ''],
                ['1. Date format: YYYY-MM-DD', '', '', ''],
                [`2. Your allowed channels: ${allowedChannels.join(', ')}`, '', '', ''],
                [`3. Your allowed brands: ${allowedBrands.join(', ')}`, '', '', ''],
                ['4. Revenue should be numeric value (no currency symbols)', '', '', ''],
                ['5. Data outside your permissions will be rejected', '', '', '']
            ];
            
            const csvContent = templateData.map(row => row.join(',')).join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sales_data_template_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        };
        
        // Validate data with permissions
        const validateDataWithPermissions = (data) => {
            const errors = [];
            const accepted = [];
            const rejected = [];
            
            data.forEach((row, index) => {
                const brand = row.Brand || row.brand;
                const channel = row.Channel || row.channel;
                const rowNum = index + 2;
                
                // Check brand permission
                const brandAllowed = userRole === 'Admin' || 
                                    allowedBrands.includes(brand) ||
                                    userPermissions?.brands?.includes('All Brands');
                
                // Check channel permission
                const channelAllowed = userRole === 'Admin' || 
                                      allowedChannels.includes(channel) ||
                                      userPermissions?.channels?.includes('All Channels');
                
                if (!brandAllowed || !channelAllowed) {
                    const reason = [];
                    if (!brandAllowed) reason.push(`brand "${brand}" not in your permissions`);
                    if (!channelAllowed) reason.push(`channel "${channel}" not in your permissions`);
                    
                    rejected.push({
                        ...row,
                        _rowNumber: rowNum,
                        _rejectionReason: reason.join(' and ')
                    });
                    
                    errors.push(`Row ${rowNum}: ${reason.join(' and ')}`);
                } else {
                    accepted.push(row);
                }
            });
            
            return { accepted, rejected, errors };
        };
        
        // Handle file upload with size validation
        const handleFileUpload = (file) => {
            // Check file size (warn for files > 50MB)
            const maxSize = 100 * 1024 * 1024; // 100MB
            const warningSize = 50 * 1024 * 1024; // 50MB
            
            if (file.size > maxSize) {
                setUploadStatus('error');
                setValidationErrors([`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size is ${maxSize / 1024 / 1024}MB.`]);
                setUploadProgress(0);
                return;
            }
            
            if (file.size > warningSize) {
                setValidationErrors([`Large file detected: ${(file.size / 1024 / 1024).toFixed(1)}MB. This may take several minutes to process.`]);
            }
            
            setUploadedFile(file);
            setUploadStatus('processing');
            setValidationErrors([]);
            setUploadProgress(10);
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
                setUploadProgress(30);
                const content = e.target.result;
                
                if (file.name.endsWith('.csv')) {
                    // Parse CSV
                    Papa.parse(content, {
                        header: true,
                        dynamicTyping: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            setUploadProgress(60);
                            setUploadedData(results.data);
                            setUploadStatus('parsed');
                            setUploadProgress(80);
                        }
                    });
                } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    // Parse Excel
                    const workbook = XLSX.read(content, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const rawData = XLSX.utils.sheet_to_json(sheet);
                    
                    // Filter out empty rows (rows where any required field is missing)
                    const data = rawData.filter(row => {
                        const hasDate = row.Date || row.date;
                        const hasChannel = row.Channel || row.channel;
                        const hasBrand = row.Brand || row.brand;
                        const hasRevenue = row.Revenue !== undefined && row.Revenue !== null && row.Revenue !== '' || 
                                          row.revenue !== undefined && row.revenue !== null && row.revenue !== '';
                        
                        // All four fields must be present and not empty
                        const isValid = hasDate && hasChannel && hasBrand && hasRevenue;
                        
                        if (!isValid) {
                            // Filtering out invalid row
                            const filterReason = {
                                hasDate: !!hasDate,
                                hasChannel: !!hasChannel,
                                hasBrand: !!hasBrand,
                                hasRevenue: !!hasRevenue,
                                revenueValue: row.Revenue || row.revenue,
                                row: row
                            };
                        }
                        
                        return isValid;
                    });
                    
                    // Excel parsing: ${rawData.length} total rows, ${data.length} valid rows after filtering
                    
                    // Debug: Log the first row to see column headers
                    if (data.length > 0) {
                        // Excel column headers found and first row data processed
                    }
                    
                    setUploadProgress(60);
                    setUploadedData(data);
                    setUploadStatus('parsed');
                    setUploadProgress(80);
                } else {
                    setUploadStatus('error');
                    setValidationErrors(['Invalid file format. Please upload CSV or Excel file.']);
                    setUploadProgress(0);
                }
            };
            
            if (file.name.endsWith('.csv')) {
                reader.readAsText(file);
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                reader.readAsBinaryString(file);
            }
        };
        
        // Upload to database/storage with chunked processing for large files
        const uploadToDatabase = async () => {
            if (!uploadedData || uploadedData.length === 0) return;
            
            setUploadStatus('validating');
            setUploadProgress(85);
            
            // Validate permissions
            const { accepted, rejected, errors } = validateDataWithPermissions(uploadedData);
            
            setFilteredData(accepted);
            setRejectedData(rejected);
            
            if (accepted.length === 0) {
                setUploadStatus('error');
                setValidationErrors(['All records were rejected due to permission restrictions']);
                setUploadProgress(0);
                return;
            }
            
            // Show validation results
            if (rejected.length > 0) {
                setValidationErrors([
                    `${rejected.length} records will be rejected (outside your permissions)`,
                    `${accepted.length} records will be uploaded`
                ]);
                setUploadStatus('validated');
                setUploadProgress(90);
                return;
            }
            
            // Proceed with upload
            setUploadStatus('uploading');
            setUploadProgress(95);
            
            try {
                // Log the upload
                const batchId = (await logUpload(
                    uploadedData.length,
                    accepted.length,
                    rejected.length,
                    uploadedFile.name
                )) || generateUUID();
                
                // Load canonical maps
                const { brandMap, channelMap } = await getCanonicalMaps();

                // Format data for storage
                const formattedData = accepted.map((row, index) => {
                    const dateVal = row.Date || row.date;
                    const rawBrand = row.Brand || row.brand;
                    const rawChannel = row.Channel || row.channel;
                    const brandKey = normalizeKey(rawBrand);
                    const channelKey = normalizeKey(rawChannel);
                    const brandEntry = brandMap.get(brandKey);
                    const channelEntry = channelMap.get(channelKey);

                    const brandName = brandEntry?.name || (rawBrand || '').trim();
                    const channelName = channelEntry?.name || (rawChannel || '').trim();

                    // Convert date to string if it's a Date object or number
                    let finalDate = dateVal;
                    if (dateVal instanceof Date) {
                        finalDate = dateVal.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
                    } else if (typeof dateVal === 'number' && dateVal > 25569) { // Excel date number (days since 1900-01-01)
                        // Convert Excel date number to YYYY-MM-DD
                        const excelDate = new Date((dateVal - 25569) * 86400 * 1000);
                        finalDate = excelDate.toISOString().split('T')[0];
                    } else if (typeof dateVal === 'string') {
                        finalDate = dateVal.trim();
                    } else if (!dateVal) {
                        finalDate = null; // This will cause the error we're seeing
                    }

                    return {
                        // canonical linkage
                        brand_id: brandEntry?.id || null,
                        channel_id: channelEntry?.id || null,
                        brand_name: brandName,
                        channel_name: channelName,
                        // legacy fields for backward compatibility
                        brand: brandName,
                        channel: channelName,
                        // core metrics
                        date: finalDate,
                        revenue: parseFloat(row.Revenue || row.revenue) || 0,
                        // provenance
                        source: 'manual',
                        source_id: buildSourceIdFromCanon(finalDate, channelName, brandName, index),
                        uploaded_by: currentUser?.id,
                        upload_batch_id: batchId,
                        is_valid_sale: true,
                        updated_at: new Date().toISOString()
                    };
                });
                
                if (dataService) {
                    // Use batch processing for large files with progress tracking
                    const configBatchSize = config?.SUPABASE?.PERFORMANCE?.BATCH_SIZE || 1000;
                    const largeFileBatchSize = config?.SUPABASE?.PERFORMANCE?.LARGE_FILE_BATCH_SIZE || 2000;
                    const batchSize = accepted.length > 10000 ? largeFileBatchSize : configBatchSize;
                    
                    const result = await dataService.batchSaveSalesData(
                        formattedData, 
                        batchSize,
                        (progressData) => {
                            // Update progress with real-time data
                            const uploadProgress = Math.round(90 + (progressData.progress * 0.1)); // 90-100%
                            setUploadProgress(uploadProgress);
                            setBatchProgress(progressData); // Store batch progress details
                            
                            // Update status message
                            if (progressData.error) {
                                console.warn(`Batch ${progressData.processedBatches} failed:`, progressData.error);
                                setValidationErrors(prev => [...prev, `Batch ${progressData.processedBatches} had errors (continuing...)`]);
                            }
                        }
                    );
                    
                    if (!result.allSuccessful) {
                        console.warn(`Upload completed with ${result.failed} failed batches out of ${result.total}`);
                        setValidationErrors(prev => [...prev, `Upload completed: ${result.successfulRows} rows saved, ${result.failedRows} rows failed`]);
                    } else {
                        console.log(`Upload completed successfully: ${result.successfulRows} rows saved`);
                    }
                } else {
                    // Fallback: Store in localStorage
                    const existingData = JSON.parse(localStorage.getItem('chai_vision_sales_data') || '[]');
                    const updatedData = [...existingData, ...formattedData];
                    localStorage.setItem('chai_vision_sales_data', JSON.stringify(updatedData));
                    
                    // Simulate upload delay
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                setUploadProgress(100);
                setUploadStatus('success');
                
                // Notify parent component with actual results
                if (onUploadComplete) {
                    onUploadComplete({
                        originalData: formattedData,
                        actualSaved: result?.successfulRows || formattedData.length,
                        failedRows: result?.failedRows || 0,
                        totalBatches: result?.total || 1,
                        successfulBatches: result?.success || 1
                    });
                }
                
                // Reset after 3 seconds
                setTimeout(() => {
                    setUploadedFile(null);
                    setUploadedData([]);
                    setFilteredData([]);
                    setRejectedData([]);
                    setUploadProgress(0);
                    setUploadStatus(null);
                    setValidationErrors([]);
                    setBatchProgress(null); // Clear batch progress
                }, 3000);
            } catch (error) {
                // Error uploading data
                setUploadStatus('error');
                setValidationErrors([`Upload failed: ${error.message || 'Unknown error occurred'}`]);
                setUploadProgress(0);
            }
        };
        
        // Continue upload after validation
        const continueUpload = () => {
            uploadToDatabase();
        };
        
        // File handlers
        const handleDragOver = (e) => {
            e.preventDefault();
            setIsDragging(true);
        };
        
        const handleDragLeave = (e) => {
            e.preventDefault();
            setIsDragging(false);
        };
        
        const handleDrop = (e) => {
            e.preventDefault();
            setIsDragging(false);
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileUpload(files[0]);
            }
        };
        
        const handleFileSelect = (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file);
            }
        };
        
        return h('div', { className: 'upload-container' },
            h('div', { className: 'upload-header' },
                h('h1', { className: 'upload-title' }, '📊 Upload Sales Data'),
                h('p', { className: 'upload-subtitle' }, 'Import your sales data from CSV or Excel files to update the dashboard'),
                
                // Permission notice
                userRole === 'Manager' && h('div', {
                    className: 'alert-banner warning',
                    style: { marginTop: '16px' }
                },
                    h('div', { className: 'alert-content' },
                        h('span', { className: 'alert-icon' }, '🔒'),
                        h('span', { className: 'alert-message' }, 
                            `You can upload data for: ${allowedBrands.join(', ')} (${allowedChannels.join(', ')})`
                        )
                    )
                ),
                
                !supabaseEnabled && h('div', {
                    className: 'validation-message warning',
                    style: { marginTop: '16px' }
                },
                    '⚠️ Demo Mode: Data will be saved locally for this session.'
                )
            ),
            
            h('div', { className: 'upload-cards' },
                // Template Download Card
                h('div', { className: 'upload-card' },
                    h('div', { className: 'upload-card-icon' }, '📄'),
                    h('h3', { className: 'upload-card-title' }, 'Download Template'),
                    h('p', { className: 'upload-card-description' }, 
                        'Download a pre-formatted template with your allowed brands and channels.'
                    ),
                    h('button', {
                        className: 'btn btn-primary',
                        onClick: downloadTemplate,
                        style: { width: '100%' }
                    }, '⬇️ Download Custom Template')
                ),
                
                // File Upload Card
                h('div', { className: 'upload-card' },
                    h('div', { className: 'upload-card-icon' }, '📤'),
                    h('h3', { className: 'upload-card-title' }, 'Upload Data File'),
                    h('p', { className: 'upload-card-description' }, 
                        'Upload your sales data file. Records outside your permissions will be rejected.'
                    ),
                    h('div', {
                        className: `upload-zone ${isDragging ? 'dragging' : ''}`,
                        onDragOver: handleDragOver,
                        onDragLeave: handleDragLeave,
                        onDrop: handleDrop,
                        onClick: () => fileInputRef.current?.click()
                    },
                        h('div', { className: 'upload-icon' }, '☁️'),
                        h('div', { className: 'upload-text' }, 'Drag & drop your file here'),
                        h('div', { className: 'upload-hint' }, 'or click to browse'),
                        h('div', { className: 'upload-hint' }, 'Supports: CSV, XLSX, XLS'),
                        h('input', {
                            ref: fileInputRef,
                            type: 'file',
                            className: 'file-input',
                            accept: '.csv,.xlsx,.xls',
                            onChange: handleFileSelect
                        })
                    ),
                    
                    // Upload status messages
                    uploadStatus === 'processing' && h('div', { className: 'upload-progress' },
                        h('div', { className: 'progress-header' },
                            h('span', { className: 'progress-label' }, 'Processing file...'),
                            h('span', { className: 'progress-percentage' }, `${uploadProgress}%`)
                        ),
                        h('div', { className: 'progress-bar' },
                            h('div', {
                                className: 'progress-fill',
                                style: { width: `${uploadProgress}%` }
                            })
                        )
                    ),
                    
                    uploadStatus === 'parsed' && h('div', null,
                        h('div', { className: 'validation-message success' },
                            `✅ File parsed: ${uploadedData.length} records found`
                        ),
                        h('button', {
                            className: 'btn btn-success',
                            onClick: uploadToDatabase,
                            style: { width: '100%', marginTop: '16px' }
                        }, '🔍 Validate & Upload')
                    ),
                    
                    uploadStatus === 'validated' && rejectedData.length > 0 && h('div', null,
                        h('div', { className: 'validation-message warning' },
                            `⚠️ ${rejectedData.length} records outside your permissions will be rejected`
                        ),
                        h('div', { style: { marginTop: '12px' } },
                            h('p', { style: { fontSize: '14px', marginBottom: '8px' } }, 
                                `✅ ${filteredData.length} records will be accepted`
                            ),
                            h('p', { style: { fontSize: '14px', color: '#DC2626' } }, 
                                `❌ ${rejectedData.length} records will be rejected`
                            )
                        ),
                        h('button', {
                            className: 'btn btn-primary',
                            onClick: continueUpload,
                            style: { width: '100%', marginTop: '16px' }
                        }, `📤 Upload ${filteredData.length} Valid Records`)
                    ),
                    
                    uploadStatus === 'uploading' && h('div', { className: 'upload-progress' },
                        h('div', { className: 'progress-header' },
                            h('span', { className: 'progress-label' }, 
                                supabaseEnabled ? 'Uploading to database...' : 'Saving to local storage...'
                            ),
                            h('span', { className: 'progress-percentage' }, `${uploadProgress}%`)
                        ),
                        h('div', { className: 'progress-bar' },
                            h('div', {
                                className: 'progress-fill',
                                style: { width: `${uploadProgress}%` }
                            })
                        ),
                        // Show detailed batch progress for large files
                        batchProgress && batchProgress.totalBatches > 1 && h('div', { 
                            className: 'batch-progress',
                            style: { 
                                marginTop: '8px', 
                                fontSize: '12px', 
                                color: '#6B7280',
                                textAlign: 'center'
                            }
                        },
                            h('div', null, 
                                `Batch ${batchProgress.processedBatches} of ${batchProgress.totalBatches} completed`
                            ),
                            h('div', null, 
                                `${batchProgress.processedRows.toLocaleString()} of ${batchProgress.totalRows.toLocaleString()} rows processed`
                            ),
                            batchProgress.error && h('div', { 
                                style: { color: '#DC2626', marginTop: '4px' }
                            }, 
                                `⚠️ Batch ${batchProgress.processedBatches} had errors (continuing...)`
                            )
                        )
                    ),
                    
                    uploadStatus === 'success' && h('div', { className: 'validation-message success' },
                        '🎉 Data uploaded successfully!'
                    ),
                    
                    uploadStatus === 'error' && h('div', null,
                        h('div', { className: 'validation-message error' },
                            '❌ Upload failed:'
                        ),
                        validationErrors.length > 0 && h('ul', { style: { marginTop: '12px', paddingLeft: '20px' } },
                            validationErrors.slice(0, 5).map((error, index) =>
                                h('li', { key: index, style: { color: '#991B1B', fontSize: '13px', marginBottom: '4px' } }, error)
                            ),
                            validationErrors.length > 5 && h('li', { style: { color: '#991B1B', fontSize: '13px', fontStyle: 'italic' } },
                                `...and ${validationErrors.length - 5} more errors`
                            )
                        )
                    )
                )
            ),
            
            // Rejected Records Preview
            rejectedData.length > 0 && uploadStatus === 'validated' && h('div', { className: 'data-preview' },
                h('div', { className: 'preview-header' },
                    h('h3', { className: 'preview-title', style: { color: '#DC2626' } }, 
                        '❌ Rejected Records (Outside Permissions)'
                    )
                ),
                h('div', { className: 'preview-table' },
                    h('table', null,
                        h('thead', null,
                            h('tr', null,
                                h('th', null, 'Row'),
                                h('th', null, 'Date'),
                                h('th', null, 'Channel'),
                                h('th', null, 'Brand'),
                                h('th', null, 'Revenue'),
                                h('th', null, 'Reason')
                            )
                        ),
                        h('tbody', null,
                            rejectedData.slice(0, 10).map((row, index) =>
                                h('tr', { key: index, style: { background: '#FEE2E2' } },
                                    h('td', null, row._rowNumber),
                                    h('td', null, row.Date || row.date),
                                    h('td', null, row.Channel || row.channel),
                                    h('td', null, row.Brand || row.brand),
                                    h('td', null, formatCurrency ? formatCurrency(parseFloat(row.Revenue || row.revenue)) : 
                                        '$' + (row.Revenue || row.revenue)),
                                    h('td', { style: { fontSize: '12px', color: '#991B1B' } }, 
                                        row._rejectionReason)
                                )
                            ),
                            rejectedData.length > 10 && h('tr', null,
                                h('td', { colSpan: 6, style: { textAlign: 'center', fontStyle: 'italic', color: '#6B7280' } },
                                    `...and ${rejectedData.length - 10} more rejected records`
                                )
                            )
                        )
                    )
                )
            )
        );
    }
    
    // Make Upload available globally
    window.Upload = Upload;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.Upload = Upload;
})();
