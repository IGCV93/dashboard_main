#!/usr/bin/env node

/**
 * Environment Variable Injector for Vercel
 * 
 * This script injects environment variables into the HTML file
 * so they can be accessed by the client-side JavaScript.
 * 
 * Usage: node scripts/inject-env.js
 */

const fs = require('fs');
const path = require('path');

// Environment variables to inject
const ENV_VARS = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'DEBUG_MODE' // Controls debug logging in production
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
    ENV_VARS.forEach(key => {
        const value = process.env[key];
        if (value) {
            envObject[key] = value;
        }
    });

    // Create the script tag to inject
    const envScript = `
    <script>
        // Environment variables injected at build time
        window.__ENV__ = ${JSON.stringify(envObject)};
    </script>`;

    // Find the head tag and inject the script
    const headRegex = /<head[^>]*>/i;
    if (headRegex.test(htmlContent)) {
        htmlContent = htmlContent.replace(headRegex, `$&${envScript}`);
        console.log('✅ Environment variables injected into HTML');
    } else {
        console.warn('⚠️  No <head> tag found, appending to beginning of file');
        htmlContent = envScript + htmlContent;
    }

    // Write the modified HTML
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log('📄 HTML file updated with environment variables');
}

// Run the injection
if (require.main === module) {
    injectEnvironmentVariables();
}

module.exports = { injectEnvironmentVariables };
