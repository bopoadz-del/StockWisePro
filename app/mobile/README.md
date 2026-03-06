# StockWise Pro Mobile App

React Native mobile application for StockWise Pro - AI-powered stock analysis and investment platform.

## Features

- **Market Overview**: Real-time market indices and trending stocks
- **Stock Screener**: Search and filter stocks with AI-powered scores
- **Watchlist**: Track your favorite stocks with price alerts
- **Portfolio**: View your holdings and portfolio performance
- **User Profile**: Manage settings and preferences
- **Real-time Data**: Live stock prices via WebSocket
- **Authentication**: Secure login/signup with JWT

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: React Navigation (Stack + Bottom Tabs)
- **State Management**: React Context + AsyncStorage
- **Charts**: react-native-chart-kit
- **Icons**: @expo/vector-icons
- **Backend**: StockWise Pro API (Node.js/Express)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Emulator

### Installation

1. Install dependencies:
```bash
cd mobile
npm install
```

2. Start the development server:
```bash
npm start
# or
expo start
```

3. Press `i` for iOS simulator or `a` for Android emulator

### Environment Configuration

The app connects to the production API by default:
- API URL: `https://stockwise-pro-api.onrender.com/api`
- WebSocket: `wss://stockwise-pro-api.onrender.com`

To use a local backend, update the `API_URL` in:
- `screens/HomeScreen.tsx`
- `screens/ScreenerScreen.tsx`
- `screens/WatchlistScreen.tsx`
- `screens/PortfolioScreen.tsx`
- `contexts/AuthContext.tsx`

## Project Structure

```
mobile/
├── App.tsx                 # Main app component with navigation
├── package.json            # Dependencies and scripts
├── contexts/
│   └── AuthContext.tsx     # Authentication state management
├── screens/
│   ├── index.ts            # Screen exports
│   ├── HomeScreen.tsx      # Market overview and trending
│   ├── AuthScreen.tsx      # Login/Signup screen
│   ├── ScreenerScreen.tsx  # Stock search and filtering
│   ├── WatchlistScreen.tsx # User's watchlist
│   ├── PortfolioScreen.tsx # Portfolio tracking
│   ├── ProfileScreen.tsx   # User profile and settings
│   └── StockDetailScreen.tsx # Stock details and charts
└── README.md
```

## Building for Production

### Android

```bash
eas build --platform android
```

### iOS

```bash
eas build --platform ios
```

### Configure EAS

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Login to Expo:
```bash
eas login
```

3. Configure project:
```bash
eas configure
```

## Features in Detail

### Home Screen
- Market indices (S&P 500, NASDAQ, DOW)
- Trending stocks
- Quick action buttons

### Stock Screener
- Search by symbol or name
- Filter by gainers/losers/scored
- AI-powered stock scores
- Buy/Hold/Sell recommendations

### Watchlist
- Add/remove stocks
- Price alerts
- Real-time price updates
- Sync across devices (when logged in)

### Portfolio
- Total portfolio value
- Performance metrics
- Holdings breakdown
- Allocation visualization

### Profile
- User information
- Subscription plan
- Notification settings
- App preferences

## API Integration

The mobile app uses the same backend API as the web app:

- **Auth**: `/api/auth/*`
- **Stocks**: `/api/stocks/*`
- **Watchlist**: `/api/watchlist/*`
- **Portfolio**: `/api/portfolio/*`
- **Alerts**: `/api/alerts/*`

## Authentication Flow

1. User signs up/logs in via AuthScreen
2. JWT token stored in AsyncStorage
3. Token sent with all authenticated requests
4. Auto-logout on token expiration

## Offline Support

- Guest watchlist stored locally
- Cached stock data
- Sync when connection restored

## License

MIT License - See main project LICENSE
