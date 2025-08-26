/**
 * Upload Component - Handle CSV and Excel file uploads
 */

(function() {
    'use strict';
    
    function Upload(props) {
        const { useState, useRef, createElement: h } = React;
        
        const { dataService, onUploadComplete, config } = props;
        
        // Get dependencies from window
        const { formatCurrency } = window.formatters || {};
        const ALL_CHANNELS = window.ALL_CHANNELS || ['Amazon', 'TikTok', 'DTC-Shopify', 'Retail', 'CA International', 'UK International', 'Wholesale', 'Omnichannel'];
        const DEFAULT_BRANDS = window.DEFAULT_BRANDS || ['LifePro', 'PetCove', 'Joyberri', 'Oaktiv', 'Loft & Ivy', 'New Brands'];
        
        // State
        const [uploadedFile, setUploadedFile] = useState(null);
        const [uploadedData, setUploadedData] = useState([]);
        const [uploadProgress, setUploadProgress] = useState(0);
        const [uploadStatus, setUploadStatus] = useState(null);
        const [validationErrors, setValidationErrors] = useState([]);
        const [isDragging, setIsDragging] = useState(false);
        
        const fileInputRef = useRef(null);
        const supabaseEnabled = config?.FEATURES?.ENABLE_SUPABASE || false;
        
        // Download template
        const downloadTemplate = () => {
            const templateData = [
                ['Date', 'Channel', 'Brand', 'Revenue'],
                ['2025-01-01', 'Amazon', 'LifePro', '250000'],
                ['2025-01-01', 'TikTok', 'LifePro', '30000'],
                ['2025-01-01', 'DTC-Shopify', 'PetCove', '6500'],
                ['2025-01-02', 'Amazon', 'LifePro', '275000'],
                ['', '', '', ''],
                ['Instructions:', '', '', ''],
                ['1. Date format: YYYY-MM-DD', '', '', ''],
                ['2. Channel must be one of: ' + ALL_CHANNELS.join(', '), '', '', ''],
                ['3. Brand must match existing brands in system', '', '', ''],
                ['4. Revenue should be numeric value (no currency symbols)', '', '', '']
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
        
        // File upload handlers
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
        
        // Validate data
        const validateData = (data) => {
            const errors = [];
            const validChannels = ALL_CHANNELS;
            const validBrands = DEFAULT_BRANDS;
            
            data.forEach((row, index) => {
                // Check for required fields
                if (!row.Date && !row.date) {
                    errors.push(`Row ${index + 2}: Missing date`);
                }
                if (!row.Channel && !row.channel) {
                    errors.push(`Row ${index + 2}: Missing channel`);
                }
                if (!row.Brand && !row.brand) {
                    errors.push(`Row ${index + 2}: Missing brand`);
                }
                if (!row.Revenue && !row.revenue) {
                    errors.push(`Row ${index + 2}: Missing revenue`);
                }
                
                // Validate channel
                const channel = row.Channel || row.channel;
                if (channel && !validChannels.includes(channel)) {
                    errors.push(`Row ${index + 2}: Invalid channel "${channel}"`);
                }
                
                // Validate brand
                const brand = row.Brand || row.brand;
                if (brand && !validBrands.includes(brand)) {
                    errors.push(`Row ${index + 2}: Invalid brand "${brand}"`);
                }
                
                // Validate revenue is numeric
                const revenue = row.Revenue || row.revenue;
                if (revenue && isNaN(parseFloat(revenue))) {
                    errors.push(`Row ${index + 2}: Revenue must be a number`);
                }
            });
            
            return errors;
        };
        
        // Handle file upload
        const handleFileUpload = (file) => {
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
                            const errors = validateData(results.data);
                            
                            if (errors.length > 0) {
                                setValidationErrors(errors);
                                setUploadStatus('error');
                                setUploadProgress(0);
                            } else {
                                setUploadedData(results.data);
                                setUploadStatus('validated');
                                setUploadProgress(80);
                            }
                        }
                    });
                } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    // Parse Excel
                    const workbook = XLSX.read(content, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const data = XLSX.utils.sheet_to_json(sheet);
                    
                    setUploadProgress(60);
                    const errors = validateData(data);
                    
                    if (errors.length > 0) {
                        setValidationErrors(errors);
                        setUploadStatus('error');
                        setUploadProgress(0);
                    } else {
                        setUploadedData(data);
                        setUploadStatus('validated');
                        setUploadProgress(80);
                    }
                }
            };
            
            if (file.name.endsWith('.csv')) {
                reader.readAsText(file);
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                reader.readAsBinaryString(file);
            } else {
                setUploadStatus('error');
                setValidationErrors(['Invalid file format. Please upload CSV or Excel file.']);
                setUploadProgress(0);
            }
        };
        
        // Upload to database/storage
        const uploadToDatabase = async () => {
            if (!uploadedData || uploadedData.length === 0) return;
            
            setUploadStatus('uploading');
            setUploadProgress(90);
            
            try {
                // Format data for storage
                const formattedData = uploadedData.map(row => ({
                    date: row.Date || row.date,
                    channel: row.Channel || row.channel,
                    brand: row.Brand || row.brand,
                    revenue: parseFloat(row.Revenue || row.revenue),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }));
                
                if (dataService) {
                    await dataService.saveSalesData(formattedData);
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
                
                // Notify parent component
                if (onUploadComplete) {
                    onUploadComplete(formattedData);
                }
                
                // Reset after 3 seconds
                setTimeout(() => {
                    setUploadedFile(null);
                    setUploadedData([]);
                    setUploadProgress(0);
                    setUploadStatus(null);
                    setValidationErrors([]);
                }, 3000);
            } catch (error) {
                console.error('Error uploading data:', error);
                setUploadStatus('error');
                setValidationErrors([`Upload failed: ${error.message || 'Unknown error occurred'}`]);
                setUploadProgress(0);
            }
        };
        
        return h('div', { className: 'upload-container' },
            h('div', { className: 'upload-header' },
                h('h1', { className: 'upload-title' }, '📊 Upload Sales Data'),
                h('p', { className: 'upload-subtitle' }, 'Import your sales data from CSV or Excel files to update the dashboard'),
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
                        'Download a pre-formatted template with the correct headers for your sales data.'
                    ),
                    h('div', { className: 'template-section' },
                        h('div', { className: 'template-info' },
                            h('div', { className: 'template-icon' }, '✨'),
                            h('div', { className: 'template-text' },
                                h('div', { className: 'template-title' }, 'Sales Data Template'),
                                h('div', { className: 'template-description' }, 'CSV format with Date, Channel, Brand, Revenue columns')
                            )
                        ),
                        h('button', {
                            className: 'btn btn-primary',
                            onClick: downloadTemplate,
                            style: { width: '100%' }
                        }, '⬇️ Download Template')
                    )
                ),
                
                // File Upload Card
                h('div', { className: 'upload-card' },
                    h('div', { className: 'upload-card-icon' }, '📤'),
                    h('h3', { className: 'upload-card-title' }, 'Upload Data File'),
                    h('p', { className: 'upload-card-description' }, 
                        'Upload your sales data file in CSV or Excel format.'
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
                    
                    uploadStatus === 'validated' && h('div', null,
                        h('div', { className: 'validation-message success' },
                            '✅ File validated successfully!'
                        ),
                        h('button', {
                            className: 'btn btn-success',
                            onClick: uploadToDatabase,
                            style: { width: '100%', marginTop: '16px' }
                        }, supabaseEnabled ? 
                            `📤 Upload ${uploadedData.length} Records to Database` :
                            `💾 Save ${uploadedData.length} Records Locally`
                        )
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
                        )
                    ),
                    
                    uploadStatus === 'success' && h('div', { className: 'validation-message success' },
                        '🎉 Data uploaded successfully!'
                    ),
                    
                    uploadStatus === 'error' && h('div', null,
                        h('div', { className: 'validation-message error' },
                            '❌ Validation errors found:'
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
            
            // Data Preview
            uploadedData.length > 0 && uploadStatus === 'validated' && h('div', { className: 'data-preview' },
                h('div', { className: 'preview-header' },
                    h('h3', { className: 'preview-title' }, 'Data Preview'),
                    h('div', { className: 'preview-stats' },
                        h('div', { className: 'preview-stat' },
                            h('div', { className: 'preview-stat-value' }, uploadedData.length),
                            h('div', { className: 'preview-stat-label' }, 'Records')
                        ),
                        h('div', { className: 'preview-stat' },
                            h('div', { className: 'preview-stat-value' }, 
                                [...new Set(uploadedData.map(d => d.Channel || d.channel))].length
                            ),
                            h('div', { className: 'preview-stat-label' }, 'Channels')
                        ),
                        h('div', { className: 'preview-stat' },
                            h('div', { className: 'preview-stat-value' }, 
                                [...new Set(uploadedData.map(d => d.Brand || d.brand))].length
                            ),
                            h('div', { className: 'preview-stat-label' }, 'Brands')
                        )
                    )
                ),
                h('div', { className: 'preview-table' },
                    h('table', null,
                        h('thead', null,
                            h('tr', null,
                                h('th', null, 'Date'),
                                h('th', null, 'Channel'),
                                h('th', null, 'Brand'),
                                h('th', null, 'Revenue')
                            )
                        ),
                        h('tbody', null,
                            uploadedData.slice(0, 10).map((row, index) =>
                                h('tr', { key: index },
                                    h('td', null, row.Date || row.date),
                                    h('td', null, row.Channel || row.channel),
                                    h('td', null, row.Brand || row.brand),
                                    h('td', null, formatCurrency ? formatCurrency(parseFloat(row.Revenue || row.revenue)) : '$' + (row.Revenue || row.revenue))
                                )
                            ),
                            uploadedData.length > 10 && h('tr', null,
                                h('td', { colSpan: 4, style: { textAlign: 'center', fontStyle: 'italic', color: '#6B7280' } },
                                    `...and ${uploadedData.length - 10} more records`
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
