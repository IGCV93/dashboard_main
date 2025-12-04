/**
 * Channel Configuration
 * Central source of truth for channel names and mappings
 */

export const CHANNELS = [
    'Amazon',
    'TikTok',
    'DTC-Shopify',
    'Retail',
    'CA International',
    'UK International',
    'Wholesale',
    'Omnichannel'
];

export const CHANNEL_MAPPINGS = {
    // Database name -> Dashboard name
    'shopify': 'DTC-Shopify',
    'retailsale': 'Retail',
    'retail sale': 'Retail',
    'amazon seller central': 'Amazon',
    'amazon vendor central': 'Amazon',
    'tiktok shop': 'TikTok'
};

export const DEFAULT_CHANNELS = CHANNELS;
