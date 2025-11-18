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
        
        // Upload type state
        const [uploadType, setUploadType] = useState('auto'); // 'auto', 'channel', 'sku'
        const [detectedType, setDetectedType] = useState(null); // 'channel' or 'sku'
        
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
        
        const buildSKUSourceId = (dateVal, channelName, brandName, sku, units = null, revenue = null) => {
            // Deterministic source_id for deduplication - same data = same source_id
            // Include units and revenue to differentiate rows with same date/channel/brand/SKU but different values
            // This allows proper deduplication while still handling legitimate duplicate entries
            const baseId = `${normalizeKey(dateVal)}|${normalizeKey(channelName)}|${normalizeKey(brandName)}|${normalizeKey(sku)}`;
            if (units !== null && revenue !== null) {
                // Include units and revenue to create unique ID for each unique transaction
                return `${baseId}|${units}|${revenue}`;
            }
            return baseId;
        };
        
        // Detect upload type based on file headers
        const detectUploadType = (headers) => {
            if (!headers || headers.length === 0) return 'channel';
            
            const normalizedHeaders = headers.map(h => String(h || '').toLowerCase().trim());
            
            // Check for SKU column (case-insensitive)
            const hasSKU = normalizedHeaders.some(h => 
                h === 'sku' || 
                h === 'sku code' || 
                h === 'product sku' ||
                h.includes('sku')
            );
            
            // If SKU column exists, it's SKU data
            if (hasSKU) {
                return 'sku';
            }
            
            // Default to channel data
            return 'channel';
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
        
        // Download channel template
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
        
        // Download SKU template
        const downloadSKUTemplate = () => {
            const templateData = [
                ['Date', 'Channel', 'Brand', 'SKU', 'Product Name', 'Units', 'Revenue'],
                ['2025-01-01', allowedChannels[0] || 'Shopify', allowedBrands[0] || 'LifePro', 'SKU-001', 'Product Name Example', '10', '250.00'],
                ['2025-01-01', allowedChannels[0] || 'Shopify', allowedBrands[0] || 'LifePro', 'SKU-002', 'Another Product', '5', '125.50'],
                ['2025-01-02', allowedChannels[0] || 'Shopify', allowedBrands[0] || 'LifePro', 'SKU-001', 'Product Name Example', '15', '375.00'],
                ['', '', '', '', '', '', ''],
                ['Instructions:', '', '', '', '', '', ''],
                ['1. Date format: YYYY-MM-DD', '', '', '', '', '', ''],
                ['2. SKU: Stock Keeping Unit identifier (required)', '', '', '', '', '', ''],
                ['3. Units: Number of units sold (required, must be non-negative integer)', '', '', '', '', '', ''],
                ['4. Revenue: Total revenue for this SKU (required, must be non-negative number)', '', '', '', '', '', ''],
                ['5. Product Name: Optional human-readable product name', '', '', '', '', '', ''],
                [`6. Your allowed channels: ${allowedChannels.join(', ')}`, '', '', '', '', '', ''],
                [`7. Your allowed brands: ${allowedBrands.join(', ')}`, '', '', '', '', '', ''],
                ['8. Data outside your permissions will be rejected', '', '', '', '', '', '']
            ];
            
            const csvContent = templateData.map(row => row.map(cell => {
                // Escape commas and quotes in CSV
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(',')).join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sku_sales_data_template_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        };
        
        // Validate SKU data
        const validateSKUData = (row, index) => {
            const errors = [];
            const rowNum = index + 2;
            
            // Required fields
            if (!row.SKU && !row.sku && !row['SKU Code'] && !row['sku code']) {
                errors.push('SKU is required');
            }
            
            if (!row.Units && row.Units !== 0 && !row.units && row.units !== 0) {
                errors.push('Units is required');
            }
            
            if (!row.Revenue && row.Revenue !== 0 && !row.revenue && row.revenue !== 0) {
                errors.push('Revenue is required');
            }
            
            // Data type validation
            const units = parseInt(row.Units || row.units || 0);
            if (isNaN(units) || units < 0) {
                errors.push('Units must be a non-negative integer');
            }
            
            const revenue = parseFloat(row.Revenue || row.revenue || 0);
            if (isNaN(revenue) || revenue < 0) {
                errors.push('Revenue must be a non-negative number');
            }
            
            return errors;
        };
        
        // Validate data with permissions
        const validateDataWithPermissions = (data, isSKUData = false) => {
            const errors = [];
            const accepted = [];
            const rejected = [];
            
            data.forEach((row, index) => {
                const brand = row.Brand || row.brand;
                const channel = row.Channel || row.channel;
                const rowNum = index + 2;
                
                // SKU-specific validation
                if (isSKUData) {
                    const skuErrors = validateSKUData(row, index);
                    if (skuErrors.length > 0) {
                        rejected.push({
                            ...row,
                            _rowNumber: rowNum,
                            _rejectionReason: skuErrors.join('; ')
                        });
                        errors.push(`Row ${rowNum}: ${skuErrors.join('; ')}`);
                        return;
                    }
                }
                
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
                            
                            if (results.errors && results.errors.length > 0) {
                                setUploadStatus('error');
                                setValidationErrors(results.errors.map(e => `Row ${e.row}: ${e.message}`));
                                setUploadProgress(0);
                                return;
                            }
                            
                            const data = results.data || [];
                            if (data.length === 0) {
                                setUploadStatus('error');
                                setValidationErrors(['No data found in file']);
                                setUploadProgress(0);
                                return;
                            }
                            
                            // Detect upload type
                            const headers = results.meta.fields || Object.keys(data[0] || {});
                            const detected = uploadType === 'auto' ? detectUploadType(headers) : uploadType;
                            setDetectedType(detected);
                            
                            setUploadedData(data);
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
                    
                    if (rawData.length === 0) {
                        setUploadStatus('error');
                        setValidationErrors(['No data found in file']);
                        setUploadProgress(0);
                        return;
                    }
                    
                    // Detect upload type from headers
                    const headers = Object.keys(rawData[0] || {});
                    const detected = uploadType === 'auto' ? detectUploadType(headers) : uploadType;
                    setDetectedType(detected);
                    
                    // Filter out empty rows (rows where any required field is missing)
                    const data = rawData.filter(row => {
                        const hasDate = row.Date || row.date;
                        const hasChannel = row.Channel || row.channel;
                        const hasBrand = row.Brand || row.brand;
                        
                        // For SKU data, check for SKU and Units
                        // For channel data, check for Revenue
                        if (detected === 'sku') {
                            const hasSKU = row.SKU || row.sku || row['SKU Code'] || row['sku code'];
                            const hasUnits = row.Units !== undefined && row.Units !== null && row.Units !== '' || 
                                           row.units !== undefined && row.units !== null && row.units !== '';
                            const hasRevenue = row.Revenue !== undefined && row.Revenue !== null && row.Revenue !== '' || 
                                            row.revenue !== undefined && row.revenue !== null && row.revenue !== '';
                            return hasDate && hasChannel && hasBrand && hasSKU && hasUnits && hasRevenue;
                        } else {
                            const hasRevenue = row.Revenue !== undefined && row.Revenue !== null && row.Revenue !== '' || 
                                            row.revenue !== undefined && row.revenue !== null && row.revenue !== '';
                            return hasDate && hasChannel && hasBrand && hasRevenue;
                        }
                    });
                    
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
        
        // Determine final upload type (use detected if auto, otherwise use selected)
        const getFinalUploadType = () => {
            if (uploadType === 'auto') {
                return detectedType || 'channel';
            }
            return uploadType;
        };
        
        // Upload to database/storage with chunked processing for large files
        const uploadToDatabase = async () => {
            if (!uploadedData || uploadedData.length === 0) return;
            
            setUploadStatus('validating');
            setUploadProgress(85);
            
            // Determine upload type
            const finalType = getFinalUploadType();
            const isSKUData = finalType === 'sku';
            
            // Validate permissions
            const { accepted, rejected, errors } = validateDataWithPermissions(uploadedData, isSKUData);
            
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
                        finalDate = null;
                    }

                    // Format SKU data
                    if (isSKUData) {
                        const sku = String(row.SKU || row.sku || row['SKU Code'] || row['sku code'] || '').trim();
                        const units = parseInt(row.Units || row.units || 0);
                        const revenue = parseFloat(row.Revenue || row.revenue || 0);
                        const productName = row['Product Name'] || row['product name'] || row.ProductName || row.productName || null;
                        
                        return {
                            date: finalDate,
                            channel: channelName,
                            brand: brandName,
                            sku: sku,
                            units: units,
                            revenue: revenue,
                            product_name: productName ? String(productName).trim() : null,
                            source: 'manual',
                            source_id: buildSKUSourceId(finalDate, channelName, brandName, sku, units, revenue),
                            uploaded_by: currentUser?.id,
                            upload_batch_id: batchId
                        };
                    }
                    
                    // Format channel data (existing logic)
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
                
                let result = null;
                let actualSavedCount = formattedData.length;
                
                if (dataService) {
                    // Use batch processing for large files with progress tracking
                    const configBatchSize = config?.SUPABASE?.PERFORMANCE?.BATCH_SIZE || 1000;
                    const largeFileBatchSize = config?.SUPABASE?.PERFORMANCE?.LARGE_FILE_BATCH_SIZE || 2000;
                    const batchSize = accepted.length > 10000 ? largeFileBatchSize : configBatchSize;
                    
                    // Route to correct batch save method based on upload type
                    if (isSKUData) {
                        result = await dataService.batchSaveSKUData(
                            formattedData, 
                            batchSize,
                            (progressData) => {
                                // Update progress with real-time data
                                const uploadProgress = Math.round(90 + (progressData.progress * 0.1)); // 90-100%
                                setUploadProgress(uploadProgress);
                                setBatchProgress(progressData); // Store batch progress details
                                
                                // Update status message
                                if (progressData.error) {
                                    console.warn(`SKU Batch ${progressData.processedBatches} failed:`, progressData.error);
                                    setValidationErrors(prev => [...prev, `Batch ${progressData.processedBatches} had errors (continuing...)`]);
                                }
                                
                                // If all batches are complete, update status immediately
                                if (progressData.progress >= 100) {
                                    setUploadProgress(100);
                                    setUploadStatus('success');
                                }
                            }
                        );
                        
                        // Ensure status is set to success after batch save completes
                        setUploadProgress(100);
                        setUploadStatus('success');
                        
                        // Verify actual records saved (non-blocking, don't wait if it's slow)
                        actualSavedCount = result.successfulRows;
                        // Run verification asynchronously without blocking
                        (async () => {
                            try {
                                const supabase = getSupabaseClient();
                                if (supabase) {
                                    // Use a timeout to prevent hanging
                                    const verifyPromise = supabase
                                        .from('sku_sales_data')
                                        .select('*', { count: 'exact', head: true });
                                    
                                    const timeoutPromise = new Promise((_, reject) => 
                                        setTimeout(() => reject(new Error('Verification timeout')), 5000)
                                    );
                                    
                                    const response = await Promise.race([verifyPromise, timeoutPromise]).catch(() => null);
                                    
                                    if (response && !response.error && response.count !== null && response.count !== undefined) {
                                        actualSavedCount = response.count;
                                        console.log(`📊 Database verification: ${response.count} total records in sku_sales_data table`);
                                    }
                                }
                            } catch (verifyError) {
                                console.warn('Could not verify SKU database count:', verifyError);
                                // Don't block on verification - continue with success status
                            }
                        })();
                    } else {
                        result = await dataService.batchSaveSalesData(
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
                                
                                // If all batches are complete, update status immediately
                                if (progressData.progress >= 100) {
                                    setUploadProgress(100);
                                    setUploadStatus('success');
                                }
                            }
                        );
                        
                        // Ensure status is set to success after batch save completes
                        setUploadProgress(100);
                        setUploadStatus('success');
                        
                        // Verify actual records saved (non-blocking, don't wait if it's slow)
                        actualSavedCount = result.successfulRows;
                        // Run verification asynchronously without blocking
                        (async () => {
                            try {
                                const supabase = getSupabaseClient();
                                if (supabase) {
                                    // Use a timeout to prevent hanging
                                    const verifyPromise = supabase
                                        .from('sales_data')
                                        .select('*', { count: 'exact', head: true });
                                    
                                    const timeoutPromise = new Promise((_, reject) => 
                                        setTimeout(() => reject(new Error('Verification timeout')), 5000)
                                    );
                                    
                                    const response = await Promise.race([verifyPromise, timeoutPromise]).catch(() => null);
                                    
                                    if (response && !response.error && response.count !== null && response.count !== undefined) {
                                        actualSavedCount = response.count;
                                        console.log(`📊 Database verification: ${response.count} total records in sales_data table`);
                                    }
                                }
                            } catch (verifyError) {
                                console.warn('Could not verify database count:', verifyError);
                                // Don't block on verification - continue with success status
                            }
                        })();
                    }

                    if (!result.allSuccessful) {
                        console.warn(`Upload completed with ${result.failed} failed batches out of ${result.total}`);
                        setValidationErrors(prev => [...prev, `Upload completed: ${actualSavedCount} total records in database, ${result.failedRows} rows failed`]);
                    } else {
                        console.log(`Upload completed successfully: ${actualSavedCount} total records in database`);
                    }
                } else {
                    // Fallback: Store in localStorage
                    if (isSKUData) {
                        const existingData = JSON.parse(localStorage.getItem('chai_vision_sku_data') || '[]');
                        const updatedData = [...existingData, ...formattedData];
                        localStorage.setItem('chai_vision_sku_data', JSON.stringify(updatedData));
                    } else {
                        const existingData = JSON.parse(localStorage.getItem('chai_vision_sales_data') || '[]');
                        const updatedData = [...existingData, ...formattedData];
                        localStorage.setItem('chai_vision_sales_data', JSON.stringify(updatedData));
                    }
                    
                    // Simulate upload delay
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setUploadProgress(100);
                    setUploadStatus('success');
                }
                
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
                    setDetectedType(null); // Reset detected type
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
                
                // Upload Type Selector
                h('div', { className: 'upload-type-selector' },
                    h('label', { className: 'upload-type-label' }, 'Upload Type:'),
                    h('div', { className: 'upload-type-options' },
                        h('label', { className: 'upload-type-option' },
                            h('input', {
                                type: 'radio',
                                name: 'uploadType',
                                value: 'auto',
                                checked: uploadType === 'auto',
                                onChange: (e) => {
                                    setUploadType('auto');
                                    setDetectedType(null);
                                }
                            }),
                            h('span', null, 'Auto-Detect (Recommended)')
                        ),
                        h('label', { className: 'upload-type-option' },
                            h('input', {
                                type: 'radio',
                                name: 'uploadType',
                                value: 'channel',
                                checked: uploadType === 'channel',
                                onChange: (e) => setUploadType('channel')
                            }),
                            h('span', null, 'Channel Sales Data')
                        ),
                        h('label', { className: 'upload-type-option' },
                            h('input', {
                                type: 'radio',
                                name: 'uploadType',
                                value: 'sku',
                                checked: uploadType === 'sku',
                                onChange: (e) => setUploadType('sku')
                            }),
                            h('span', null, 'SKU-Level Data')
                        )
                    ),
                    detectedType && uploadType === 'auto' && h('div', { className: 'detected-type-badge' },
                        h('span', { className: 'badge-icon' }, '🔍'),
                        h('span', null, `Detected: ${detectedType === 'sku' ? 'SKU-Level Data' : 'Channel Sales Data'}`)
                    )
                ),
                
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
                // Channel Template Download Card
                h('div', { className: 'upload-card' },
                    h('div', { className: 'upload-card-icon' }, '📄'),
                    h('h3', { className: 'upload-card-title' }, 'Channel Data Template'),
                    h('p', { className: 'upload-card-description' }, 
                        'Download template for channel-level sales data (Date, Channel, Brand, Revenue).'
                    ),
                    h('button', {
                        className: 'btn btn-primary',
                        onClick: downloadTemplate,
                        style: { width: '100%' }
                    }, '⬇️ Download Channel Template')
                ),
                
                // SKU Template Download Card
                h('div', { className: 'upload-card' },
                    h('div', { className: 'upload-card-icon' }, '📦'),
                    h('h3', { className: 'upload-card-title' }, 'SKU Data Template'),
                    h('p', { className: 'upload-card-description' }, 
                        'Download template for SKU-level sales data (Date, Channel, Brand, SKU, Units, Revenue).'
                    ),
                    h('button', {
                        className: 'btn btn-primary',
                        onClick: downloadSKUTemplate,
                        style: { width: '100%' }
                    }, '⬇️ Download SKU Template')
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
                            h('span', { className: 'progress-label' }, 'Processing file...')
                        )
                    ),
                    
                    uploadStatus === 'parsed' && h('div', null,
                        h('div', { className: 'validation-message success' },
                            `✅ File parsed: ${uploadedData.length} records found`
                        ),
                        detectedType && uploadType === 'auto' && h('div', { 
                            className: 'validation-message info',
                            style: { marginTop: '12px', background: '#EFF6FF', color: '#1E40AF', border: '1px solid #93C5FD' }
                        },
                            `📊 Detected Type: ${detectedType === 'sku' ? 'SKU-Level Data' : 'Channel Sales Data'}`
                        ),
                        uploadType !== 'auto' && h('div', { 
                            className: 'validation-message info',
                            style: { marginTop: '12px', background: '#EFF6FF', color: '#1E40AF', border: '1px solid #93C5FD' }
                        },
                            `📊 Selected Type: ${uploadType === 'sku' ? 'SKU-Level Data' : 'Channel Sales Data'}`
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
                            )
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
