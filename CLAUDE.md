# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Serving the Application
```bash
# Development server (recommended)
npm run dev

# Alternative serving methods
npm start
npm run serve
npx serve

# Build for production (Vercel)
npm run build
```

### Testing
```bash
# Currently no tests configured
npm test  # Will echo "No tests configured yet"
```

### File Structure
The application uses a vanilla JavaScript architecture with React via CDN:
- `index.html` - Main HTML entry point
- `src/js/app.js` - Main application module with React components
- `src/js/config.js` - Central configuration with feature flags
- `src/js/components/` - Individual React component modules
- `src/data/initialData.js` - Default data configuration
- `src/styles/` - CSS stylesheets

## Architecture Overview

### Core Architecture
This is a **vanilla JavaScript sales dashboard** that loads React and other libraries via CDN. It supports both **Supabase-backed authentication** and **demo mode**.

### Key Components
- **App Module (`src/js/app.js`)**: Main React app with authentication, routing, and state management
- **Configuration (`src/js/config.js`)**: Centralized config with feature flags, Supabase settings, and performance optimizations
- **Initial Data (`src/data/initialData.js`)**: Brand/channel definitions, sample data generation, and target configurations

### Authentication System
- Dual mode: Supabase authentication OR demo mode
- Role-based permissions (Admin, Manager, Analyst, Viewer)
- User preferences persistence
- Multi-tab session synchronization

### State Management
- Uses React hooks for local state
- Global `APP_STATE` object for shared state
- User preferences auto-save every 30 seconds
- LocalStorage fallback when Supabase is disabled

### Data Flow
1. **Authentication** → User login/demo mode selection
2. **Data Loading** → Sales data from Supabase or localStorage
3. **Permission Filtering** → Data filtered by user's brand/channel permissions
4. **Dashboard Rendering** → Charts and KPIs calculated from filtered data
5. **User Actions** → Settings updates, data uploads, preference changes

### Component Structure
- `Navigation` - Top navigation with user controls
- `Sidebar` - Section navigation
- `Dashboard` - Main analytics view with charts
- `Settings` - Brand/target management
- `Upload` - CSV/Excel data import
- `UserManagement` - Admin user controls
- `Login` - Authentication interface

### Key Configuration
The app uses feature flags in `config.js`:
- `ENABLE_SUPABASE` - Toggle between Supabase and demo mode
- `ENABLE_AUTH` - Enable authentication system
- `ENABLE_DEMO_MODE` - Allow demo user accounts
- Performance settings for charts, caching, and UI optimizations

### Data Structure
Sales data format:
```javascript
{
  date: 'YYYY-MM-DD',
  channel: 'Amazon|TikTok|DTC-Shopify|Retail|etc',
  brand: 'LifePro|PetCove|Joyberri|etc',
  revenue: number,
  timestamp: ISO8601
}
```

### Development Notes
- No build step required for development
- Components are loaded via module bridge system
- Charts use Chart.js with performance optimizations
- Responsive design with mobile support
- Uses CSS custom properties for theming

### Database Schema (when Supabase enabled)
- `sales_data` - Main sales records
- `profiles` - User accounts
- `user_brand_permissions` - Brand access control
- `user_channel_permissions` - Channel access control
- `user_preferences` - User settings
- `audit_logs` - Activity tracking

### Performance Optimizations
- Lazy loading for large datasets
- Chart data point limits (365 max)
- Debounced user input
- Memory usage monitoring
- Request caching and batching