#!/usr/bin/env node

/**
 * Build Script for Vercel Deployment
 * 
 * This script injects environment variables into the HTML file
 * for client-side access during Vercel deployment.
 */

const fs = require('fs');
const path = require('path');

// Environment variables to inject (only client-safe ones)
const CLIENT_ENV_VARS = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
    // Note: SUPABASE_SERVICE_KEY is intentionally excluded for security
];

function injectEnvironmentVariables() {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    
    if (!fs.existsSync(htmlPath)) {
        console.error('❌ index.html not found');
        process.exit(1);
    }
    
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Create environment variables object
    const envObject = {};
    CLIENT_ENV_VARS.forEach(key => {
        const value = process.env[key];
        if (value) {
            envObject[key] = value;
            console.log(`✅ Injected ${key}`);
        } else {
            console.warn(`⚠️  ${key} not found in environment variables`);
        }
    });
    
    // Create the script tag to inject
    const envScript = `
    <script>
        // Environment variables injected at build time
        window.__ENV__ = ${JSON.stringify(envObject)};
        console.log('🔧 Environment variables loaded:', Object.keys(window.__ENV__));
    </script>`;
    
    // Check if environment variables are already injected
    if (htmlContent.includes('window.__ENV__')) {
        console.log('🔄 Updating existing environment variables');
        // Replace existing injection
        htmlContent = htmlContent.replace(
            /<script>\s*\/\/ Environment variables injected at build time[\s\S]*?<\/script>/,
            envScript
        );
    } else {
        console.log('➕ Injecting new environment variables');
        // Find the head tag and inject the script
        const headRegex = /<head[^>]*>/i;
        if (headRegex.test(htmlContent)) {
            htmlContent = htmlContent.replace(headRegex, `$&${envScript}`);
        } else {
            console.warn('⚠️  No <head> tag found, appending to beginning of file');
            htmlContent = envScript + htmlContent;
        }
    }
    
    // Write the modified HTML
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log('📄 HTML file updated with environment variables');
    
    // Verify injection
    if (htmlContent.includes('window.__ENV__')) {
        console.log('✅ Environment variables successfully injected');
    } else {
        console.error('❌ Failed to inject environment variables');
        process.exit(1);
    }
}

// Run the injection
if (require.main === module) {
    console.log('🚀 Starting environment variable injection...');
    injectEnvironmentVariables();
    console.log('✅ Build process completed');
}

module.exports = { injectEnvironmentVariables };
