# Chai Vision Sales Dashboard

A modern, production-ready sales performance dashboard with multi-channel tracking, KPI monitoring, and data visualization capabilities.

## 🚀 Features

- **Multi-Channel Sales Tracking**: Monitor performance across Amazon, TikTok, Shopify, Retail, International, Wholesale, and Omnichannel
- **Real-time KPI Monitoring**: Track achievement against 85% and 100% targets
- **Dynamic Period Selection**: View data by Annual, Quarterly, or Monthly periods
- **Brand Management**: Support for multiple brands with individual targets
- **Data Import**: Upload sales data via CSV or Excel files
- **Interactive Visualizations**: Charts powered by Chart.js
- **Supabase Integration**: Optional cloud database storage
- **Responsive Design**: Works on desktop and mobile devices

## 📁 Project Structure

```
chai-vision-dashboard/
├── index.html                 # Main HTML entry point
├── src/
│   ├── styles/               # CSS styles
│   │   ├── main.css         # Global styles
│   │   └── components/      # Component-specific styles
│   ├── js/
│   │   ├── app.js           # Main application entry
│   │   ├── config.js        # Configuration settings
│   │   ├── components/      # React components
│   │   ├── services/        # API and data services
│   │   └── utils/           # Utility functions
│   └── data/
│       └── initialData.js   # Initial configuration data
```

## 🛠️ Installation

### Quick Start (No Build Required)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/chai-vision-dashboard.git
cd chai-vision-dashboard
```

2. Configure your settings:
```bash
cp .env.example .env
# Edit .env with your Supabase credentials (optional)
```

3. Add your company logo:
   - Option 1: Upload to [Imgur](https://imgur.com) and add URL to `src/js/config.js`
   - Option 2: Place logo in `public/` folder and reference locally

4. Open `index.html` in a web browser or serve with any static server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve

# Using VS Code Live Server extension
# Right-click index.html > Open with Live Server
```

### Production Deployment

For production deployment, consider:

1. **GitHub Pages** (Free):
```bash
git add .
git commit -m "Initial deployment"
git push origin main
# Enable GitHub Pages in repository settings
```

2. **Netlify** (Free tier available):
   - Drag and drop the folder to [Netlify](https://netlify.com)

3. **Vercel** (Free tier available):
```bash
npx vercel
```

## ⚙️ Configuration

### Logo Setup

Edit `src/js/config.js`:
```javascript
export const LOGO_URL = 'https://your-logo-url.com/logo.png';
```

### Supabase Setup (Optional)

1. Create a Supabase project at [supabase.com](https://supabase.com)

2. Create a table with this schema:
```sql
CREATE TABLE sales_data (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  channel VARCHAR(50) NOT NULL,
  brand VARCHAR(50) NOT NULL,
  revenue DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

3. Add credentials to `.env`:
```
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
```

### Brand & Target Configuration

Edit `src/data/initialData.js` to customize:
- Brand names
- Sales channels
- Target values
- Quarterly/Annual goals

## 📊 Usage

### Dashboard View
- Select time period (Annual/Quarterly/Monthly)
- Filter by brand or view company total
- Monitor KPI achievement and projections
- View channel-wise performance

### Upload Data
1. Download the CSV template
2. Fill in your sales data:
   - Date (YYYY-MM-DD)
   - Channel name
   - Brand name
   - Revenue amount
3. Upload via drag-and-drop or file selector
4. Review validation and confirm upload

### KPI Settings
- Add/Edit brands
- Set annual and quarterly targets
- Configure channel-specific goals
- Manage multiple years

## 🔧 Development

### Adding New Channels

1. Edit `src/data/initialData.js`:
```javascript
export const ALL_CHANNELS = [
  // ... existing channels
  'New Channel Name'
];

export const CHANNEL_COLORS = {
  // ... existing colors
  'New Channel Name': '#HEX_COLOR'
};
```

2. Update targets in the Settings section

### Customizing Styles

- Global styles: `src/styles/main.css`
- Component styles: `src/styles/components/[component].css`
- Color scheme: Edit CSS variables in `main.css`

### Adding Features

Components are modular - add new features by:
1. Creating new component in `src/js/components/`
2. Importing in `src/js/app.js`
3. Adding corresponding styles in `src/styles/components/`

## 📝 Data Format

### CSV/Excel Upload Format

| Date       | Channel | Brand   | Revenue |
|------------|---------|---------|---------|
| 2025-01-01 | Amazon  | example | 250000  |
| 2025-01-01 | TikTok  | example | 30000   |

### Supported Channels
- Amazon
- TikTok
- DTC-Shopify
- Retail
- CA International
- UK International
- Wholesale
- Omnichannel

## 🐛 Troubleshooting

### Logo Not Loading
- Ensure URL is publicly accessible
- Check browser console for CORS errors
- Use HTTPS URLs only
- Try uploading to Imgur as fallback

### Data Not Saving
- Check Supabase credentials
- Verify table schema matches
- Check browser console for errors
- In demo mode, data saves to localStorage

### Charts Not Displaying
- Ensure Chart.js CDN is accessible
- Check browser console for errors
- Verify data format is correct


## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 💬 Support

For issues or questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section

## 🙏 Acknowledgments

- Chart.js for visualizations
- Supabase for database
- React for UI framework
- Papa Parse for CSV parsing
