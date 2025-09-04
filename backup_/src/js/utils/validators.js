/**
 * Chai Vision Dashboard - Validation Utilities
 * Functions for validating data, forms, and uploads
 */

(function() {
    'use strict';
    
    // Get dependencies from window
    const ALL_CHANNELS = window.ALL_CHANNELS || ['Amazon', 'TikTok', 'DTC-Shopify', 'Retail', 'CA International', 'UK International', 'Wholesale', 'Omnichannel'];
    const DEFAULT_BRANDS = window.DEFAULT_BRANDS || ['LifePro', 'PetCove', 'Joyberri', 'Oaktiv', 'Loft & Ivy', 'New Brands'];

    // ============================================
    // DATA VALIDATION
    // ============================================

    function validateSalesRecord(record) {
        const errors = [];
        
        // Check required fields
        if (!record.date) {
            errors.push('Date is required');
        } else if (!isValidDate(record.date)) {
            errors.push('Invalid date format. Use YYYY-MM-DD');
        }
        
        if (!record.channel) {
            errors.push('Channel is required');
        } else if (!isValidChannel(record.channel)) {
            errors.push(`Invalid channel: ${record.channel}`);
        }
        
        if (!record.brand) {
            errors.push('Brand is required');
        } else if (!isValidBrand(record.brand)) {
            errors.push(`Invalid brand: ${record.brand}`);
        }
        
        if (record.revenue === undefined || record.revenue === null) {
            errors.push('Revenue is required');
        } else if (!isValidRevenue(record.revenue)) {
            errors.push('Revenue must be a positive number');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    function validateSalesData(records) {
        const errors = [];
        const validRecords = [];
        const invalidRecords = [];
        
        if (!Array.isArray(records)) {
            return {
                isValid: false,
                errors: ['Data must be an array'],
                validRecords: [],
                invalidRecords: []
            };
        }
        
        records.forEach((record, index) => {
            const validation = validateSalesRecord(record);
            
            if (validation.isValid) {
                validRecords.push(record);
            } else {
                invalidRecords.push({ record, index, errors: validation.errors });
                validation.errors.forEach(error => {
                    errors.push(`Row ${index + 2}: ${error}`);
                });
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors,
            validRecords,
            invalidRecords,
            summary: {
                total: records.length,
                valid: validRecords.length,
                invalid: invalidRecords.length
            }
        };
    }

    // ============================================
    // FIELD VALIDATORS
    // ============================================

    function isValidDate(dateString) {
        if (!dateString) return false;
        
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateString)) return false;
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return false;
        
        // Check if date is within reasonable range (2020-2030)
        const minDate = new Date('2020-01-01');
        const maxDate = new Date('2030-12-31');
        
        return date >= minDate && date <= maxDate;
    }

    function isValidChannel(channel) {
        if (!channel) return false;
        return ALL_CHANNELS.includes(channel);
    }

    function isValidBrand(brand, customBrands = []) {
        if (!brand) return false;
        const allBrands = [...DEFAULT_BRANDS, ...customBrands];
        return allBrands.includes(brand);
    }

    function isValidRevenue(revenue) {
        const value = parseFloat(revenue);
        if (isNaN(value)) return false;
        
        // Revenue should be between 0 and 10 billion
        return value >= 0 && value <= 10000000000;
    }

    function isValidEmail(email) {
        if (!email) return false;
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    function isValidYear(year) {
        const yearNum = parseInt(year);
        if (isNaN(yearNum)) return false;
        return yearNum >= 2020 && yearNum <= 2030;
    }

    function isValidQuarter(quarter) {
        return ['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter);
    }

    function isValidMonth(month) {
        const monthNum = parseInt(month);
        if (isNaN(monthNum)) return false;
        return monthNum >= 1 && monthNum <= 12;
    }

    // ============================================
    // FILE VALIDATION
    // ============================================

    function validateFile(file, options = {}) {
        const errors = [];
        
        const {
            maxSize = 10 * 1024 * 1024, // 10MB default
            allowedTypes = ['.csv', '.xlsx', '.xls'],
            allowedMimeTypes = [
                'text/csv',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ]
        } = options;
        
        if (!file) {
            errors.push('No file provided');
            return { isValid: false, errors };
        }
        
        // Check file size
        if (file.size > maxSize) {
            const sizeMB = (maxSize / (1024 * 1024)).toFixed(1);
            errors.push(`File size exceeds ${sizeMB}MB limit`);
        }
        
        // Check file extension
        const fileName = file.name.toLowerCase();
        const hasValidExtension = allowedTypes.some(type => fileName.endsWith(type));
        
        if (!hasValidExtension) {
            errors.push(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
        }
        
        // Check MIME type if available
        if (file.type && allowedMimeTypes.length > 0) {
            if (!allowedMimeTypes.includes(file.type)) {
                errors.push(`Invalid file format`);
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // ============================================
    // CSV VALIDATION
    // ============================================

    function validateCSVHeaders(headers, requiredHeaders = ['Date', 'Channel', 'Brand', 'Revenue']) {
        const errors = [];
        const normalizedHeaders = headers.map(h => h.trim());
        
        requiredHeaders.forEach(required => {
            if (!normalizedHeaders.includes(required)) {
                errors.push(`Missing required column: ${required}`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors,
            headers: normalizedHeaders
        };
    }

    function validateCSVStructure(data) {
        const errors = [];
        
        if (!Array.isArray(data)) {
            errors.push('Invalid data format');
            return { isValid: false, errors };
        }
        
        if (data.length === 0) {
            errors.push('File is empty');
            return { isValid: false, errors };
        }
        
        // Check if all rows have the same number of columns
        const firstRowKeys = Object.keys(data[0]);
        const inconsistentRows = [];
        
        data.forEach((row, index) => {
            const rowKeys = Object.keys(row);
            if (rowKeys.length !== firstRowKeys.length) {
                inconsistentRows.push(index + 2);
            }
        });
        
        if (inconsistentRows.length > 0) {
            errors.push(`Inconsistent columns in rows: ${inconsistentRows.slice(0, 5).join(', ')}${inconsistentRows.length > 5 ? '...' : ''}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            rowCount: data.length,
            columnCount: firstRowKeys.length
        };
    }

    // ============================================
    // TARGET VALIDATION
    // ============================================

    function validateTargets(targets) {
        const errors = [];
        
        if (!targets || typeof targets !== 'object') {
            errors.push('Invalid target configuration');
            return { isValid: false, errors };
        }
        
        // Check annual targets
        if (!targets.annual || typeof targets.annual !== 'object') {
            errors.push('Annual targets are required');
        } else {
            // Validate each channel has a target
            ALL_CHANNELS.forEach(channel => {
                if (targets.annual[channel] === undefined) {
                    errors.push(`Missing annual target for ${channel}`);
                } else if (!isValidRevenue(targets.annual[channel])) {
                    errors.push(`Invalid annual target for ${channel}`);
                }
            });
        }
        
        // Check quarterly targets
        ['Q1', 'Q2', 'Q3', 'Q4'].forEach(quarter => {
            if (!targets[quarter] || typeof targets[quarter] !== 'object') {
                errors.push(`${quarter} targets are required`);
            } else {
                ALL_CHANNELS.forEach(channel => {
                    if (targets[quarter][channel] === undefined) {
                        errors.push(`Missing ${quarter} target for ${channel}`);
                    } else if (!isValidRevenue(targets[quarter][channel])) {
                        errors.push(`Invalid ${quarter} target for ${channel}`);
                    }
                });
            }
        });
        
        // Validate quarterly totals match annual
        if (errors.length === 0) {
            ALL_CHANNELS.forEach(channel => {
                const quarterlySum = ['Q1', 'Q2', 'Q3', 'Q4'].reduce((sum, quarter) => {
                    return sum + (parseFloat(targets[quarter][channel]) || 0);
                }, 0);
                
                const annual = parseFloat(targets.annual[channel]) || 0;
                const difference = Math.abs(annual - quarterlySum);
                
                // Allow small rounding differences
                if (difference > 1) {
                    errors.push(`Quarterly totals for ${channel} (${quarterlySum.toFixed(2)}) don't match annual target (${annual.toFixed(2)})`);
                }
            });
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // ============================================
    // FORM VALIDATION
    // ============================================

    function validateBrandForm(formData) {
        const errors = {};
        
        // Validate brand name
        if (!formData.name) {
            errors.name = 'Brand name is required';
        } else if (formData.name.length < 2) {
            errors.name = 'Brand name must be at least 2 characters';
        } else if (formData.name.length > 50) {
            errors.name = 'Brand name must be less than 50 characters';
        } else if (!/^[a-zA-Z0-9\s&-]+$/.test(formData.name)) {
            errors.name = 'Brand name contains invalid characters';
        }
        
        // Validate targets if provided
        if (formData.annual || formData.Q1 || formData.Q2 || formData.Q3 || formData.Q4) {
            const targetValidation = validateTargets({
                annual: formData.annual || {},
                Q1: formData.Q1 || {},
                Q2: formData.Q2 || {},
                Q3: formData.Q3 || {},
                Q4: formData.Q4 || {}
            });
            
            if (!targetValidation.isValid) {
                errors.targets = targetValidation.errors;
            }
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    // ============================================
    // RANGE VALIDATION
    // ============================================

    function validateDateRange(startDate, endDate) {
        const errors = [];
        
        if (!startDate) {
            errors.push('Start date is required');
        } else if (!isValidDate(startDate)) {
            errors.push('Invalid start date format');
        }
        
        if (!endDate) {
            errors.push('End date is required');
        } else if (!isValidDate(endDate)) {
            errors.push('Invalid end date format');
        }
        
        if (errors.length === 0) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            if (start > end) {
                errors.push('Start date must be before end date');
            }
            
            // Check if range is reasonable (not more than 5 years)
            const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
            if (daysDiff > 1825) {
                errors.push('Date range cannot exceed 5 years');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // ============================================
    // SANITIZATION
    // ============================================

    function sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        // Remove any HTML tags
        let sanitized = input.replace(/<[^>]*>/g, '');
        
        // Trim whitespace
        sanitized = sanitized.trim();
        
        // Remove any script tags or javascript: protocols
        sanitized = sanitized.replace(/javascript:/gi, '');
        sanitized = sanitized.replace(/on\w+\s*=/gi, '');
        
        return sanitized;
    }

    function sanitizeFileName(fileName) {
        if (!fileName) return 'file';
        
        // Remove path components
        fileName = fileName.split('/').pop().split('\\').pop();
        
        // Remove special characters except dots and hyphens
        fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        // Limit length
        if (fileName.length > 255) {
            const extension = fileName.split('.').pop();
            const name = fileName.substring(0, 250 - extension.length);
            fileName = `${name}.${extension}`;
        }
        
        return fileName;
    }

    // Make validators available globally
    window.validators = {
        validateSalesRecord,
        validateSalesData,
        isValidDate,
        isValidChannel,
        isValidBrand,
        isValidRevenue,
        isValidEmail,
        isValidYear,
        isValidQuarter,
        isValidMonth,
        validateFile,
        validateCSVHeaders,
        validateCSVStructure,
        validateTargets,
        validateBrandForm,
        validateDateRange,
        sanitizeInput,
        sanitizeFileName
    };
    
    // Also add to ChaiVision namespace
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.validators = window.validators;
})();
