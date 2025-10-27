#!/usr/bin/env node

/**
 * Secure Large File Import Script
 * 
 * This script uses the SERVICE_KEY (not anon key) for large file imports
 * to avoid timeout issues and permission restrictions.
 * 
 * IMPORTANT: This script must be run server-side or locally with environment variables
 * NEVER expose the SERVICE_KEY in client-side code!
 * 
 * Usage:
 *   node scripts/secure-large-import.js <csv-file-path>
 * 
 * Setup:
 *   1. Create .env file with SUPABASE_SERVICE_KEY
 *   2. Run: npm install dotenv @supabase/supabase-js csv-parser
 *   3. Execute the script
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const CONFIG = {
    // Get credentials from environment variables
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://ebardgekhelbaoiwzwmu.supabase.co',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    
    // Table configuration
    TABLE_NAME: 'sales_data',
    
    // Batch processing
    BATCH_SIZE: 2000, // Larger batches for service key
    
    // CSV column mapping
    CSV_COLUMNS: {
        date: 'date',
        brand: 'brand',
        channel: 'channel', 
        revenue: 'revenue'
    }
};

class SecureLargeFileImporter {
    constructor() {
        this.supabase = null;
        this.stats = {
            totalRows: 0,
            processedRows: 0,
            errorRows: 0,
            startTime: null,
            endTime: null
        };
    }

    /**
     * Initialize Supabase client with SERVICE_KEY
     */
    async initializeSupabase() {
        try {
            if (!CONFIG.SUPABASE_SERVICE_KEY) {
                throw new Error('SUPABASE_SERVICE_KEY not found in environment variables. Please add it to your .env file.');
            }

            // Use SERVICE_KEY for admin operations
            this.supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_KEY);
            
            // Test connection
            const { data, error } = await this.supabase
                .from(CONFIG.TABLE_NAME)
                .select('count')
                .limit(1);
            
            if (error) {
                throw new Error(`Failed to connect to Supabase: ${error.message}`);
            }
            
            console.log('✅ Successfully connected to Supabase with SERVICE_KEY');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Supabase:', error.message);
            return false;
        }
    }

    /**
     * Clear all data from sales_data table
     */
    async clearSalesData() {
        try {
            console.log('🗑️  Clearing existing sales data...');
            
            const { error } = await this.supabase
                .from(CONFIG.TABLE_NAME)
                .delete()
                .neq('id', 0); // Delete all rows
            
            if (error) {
                throw new Error(`Failed to clear table: ${error.message}`);
            }
            
            console.log('✅ Successfully cleared sales_data table');
            return true;
        } catch (error) {
            console.error('❌ Failed to clear sales data:', error.message);
            return false;
        }
    }

    /**
     * Parse CSV file and return data
     */
    async parseCSV(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            const errors = [];
            
            if (!fs.existsSync(filePath)) {
                reject(new Error(`CSV file not found: ${filePath}`));
                return;
            }

            console.log(`📄 Reading CSV file: ${filePath}`);
            
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    try {
                        const processedRow = this.processCSVRow(row);
                        if (processedRow) {
                            results.push(processedRow);
                        }
                    } catch (error) {
                        errors.push({ row, error: error.message });
                    }
                })
                .on('end', () => {
                    console.log(`📊 Parsed ${results.length} valid rows from CSV`);
                    if (errors.length > 0) {
                        console.log(`⚠️  ${errors.length} rows had errors and were skipped`);
                    }
                    resolve({ data: results, errors });
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    /**
     * Process and validate a single CSV row
     */
    processCSVRow(row) {
        const processedRow = {};
        
        // Map CSV columns to database columns
        for (const [dbColumn, csvColumn] of Object.entries(CONFIG.CSV_COLUMNS)) {
            if (row[csvColumn] !== undefined) {
                processedRow[dbColumn] = row[csvColumn];
            }
        }

        // Data validation
        if (!processedRow.date) {
            throw new Error('Missing required field: date');
        }
        
        if (!processedRow.brand) {
            throw new Error('Missing required field: brand');
        }
        
        if (!processedRow.channel) {
            throw new Error('Missing required field: channel');
        }
        
        if (!processedRow.revenue) {
            throw new Error('Missing required field: revenue');
        }

        // Convert revenue to number
        const revenue = parseFloat(processedRow.revenue);
        if (isNaN(revenue)) {
            throw new Error(`Invalid revenue value: ${processedRow.revenue}`);
        }
        processedRow.revenue = revenue;

        // Format date to YYYY-MM-DD
        const date = new Date(processedRow.date);
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date format: ${processedRow.date}`);
        }
        processedRow.date = date.toISOString().split('T')[0];

        // Add metadata
        processedRow.created_at = new Date().toISOString();
        processedRow.updated_at = new Date().toISOString();
        
        return processedRow;
    }

    /**
     * Import data to Supabase in batches with progress tracking
     */
    async importData(data) {
        try {
            console.log(`📤 Importing ${data.length} rows to Supabase...`);
            
            const batches = [];
            for (let i = 0; i < data.length; i += CONFIG.BATCH_SIZE) {
                batches.push(data.slice(i, i + CONFIG.BATCH_SIZE));
            }

            let totalImported = 0;
            
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                const progress = Math.round(((i + 1) / batches.length) * 100);
                
                console.log(`   Processing batch ${i + 1}/${batches.length} (${progress}%)...`);
                
                const { error } = await this.supabase
                    .from(CONFIG.TABLE_NAME)
                    .insert(batch);
                
                if (error) {
                    throw new Error(`Batch ${i + 1} failed: ${error.message}`);
                }
                
                totalImported += batch.length;
                this.stats.processedRows = totalImported;
                
                console.log(`   ✅ Batch ${i + 1} completed (${totalImported.toLocaleString()} rows imported)`);
            }
            
            console.log(`✅ Successfully imported ${totalImported} rows`);
            return true;
        } catch (error) {
            console.error('❌ Failed to import data:', error.message);
            return false;
        }
    }

    /**
     * Verify the import by counting rows
     */
    async verifyImport() {
        try {
            console.log('🔍 Verifying import...');
            
            const { count, error } = await this.supabase
                .from(CONFIG.TABLE_NAME)
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                throw new Error(`Verification failed: ${error.message}`);
            }
            
            console.log(`✅ Verification complete: ${count} rows in sales_data table`);
            return count;
        } catch (error) {
            console.error('❌ Verification failed:', error.message);
            return null;
        }
    }

    /**
     * Main execution method
     */
    async run(csvFilePath) {
        this.stats.startTime = new Date();
        
        console.log('🚀 Starting Secure Large File Import Process');
        console.log('==========================================');
        
        try {
            // Step 1: Initialize Supabase with SERVICE_KEY
            if (!(await this.initializeSupabase())) {
                process.exit(1);
            }

            // Step 2: Confirm before clearing data
            const confirmed = await this.confirmClearData();
            if (!confirmed) {
                console.log('❌ Operation cancelled by user');
                process.exit(0);
            }

            // Step 3: Clear existing data
            if (!(await this.clearSalesData())) {
                process.exit(1);
            }

            // Step 4: Parse CSV file
            const { data, errors } = await this.parseCSV(csvFilePath);
            this.stats.totalRows = data.length;
            this.stats.errorRows = errors.length;

            if (data.length === 0) {
                console.log('❌ No valid data found in CSV file');
                process.exit(1);
            }

            // Step 5: Import data
            if (!(await this.importData(data))) {
                process.exit(1);
            }

            // Step 6: Verify import
            const rowCount = await this.verifyImport();
            
            // Step 7: Show final statistics
            this.stats.endTime = new Date();
            this.showFinalStats(rowCount);

            console.log('🎉 Import process completed successfully!');
            
        } catch (error) {
            console.error('❌ Import process failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Confirm with user before clearing data
     */
    async confirmClearData() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question('⚠️  This will DELETE ALL existing sales data. Are you sure? (yes/no): ', (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
            });
        });
    }

    /**
     * Show final statistics
     */
    showFinalStats(rowCount) {
        const duration = this.stats.endTime - this.stats.startTime;
        const durationSeconds = Math.round(duration / 1000);
        
        console.log('\n📊 Import Statistics');
        console.log('===================');
        console.log(`Total rows processed: ${this.stats.totalRows.toLocaleString()}`);
        console.log(`Rows imported: ${this.stats.processedRows.toLocaleString()}`);
        console.log(`Rows with errors: ${this.stats.errorRows.toLocaleString()}`);
        console.log(`Final table count: ${rowCount?.toLocaleString() || 'Unknown'}`);
        console.log(`Duration: ${durationSeconds} seconds`);
        console.log(`Average speed: ${Math.round(this.stats.processedRows / durationSeconds).toLocaleString()} rows/second`);
    }
}

// Main execution
async function main() {
    const csvFilePath = process.argv[2];
    
    if (!csvFilePath) {
        console.error('❌ Please provide a CSV file path');
        console.log('Usage: node scripts/secure-large-import.js <csv-file-path>');
        console.log('Example: node scripts/secure-large-import.js data/large-sales-data.csv');
        process.exit(1);
    }

    const importer = new SecureLargeFileImporter();
    await importer.run(csvFilePath);
}

// Run the script
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    });
}

module.exports = SecureLargeFileImporter;
