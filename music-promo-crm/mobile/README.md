# Music Promo CRM Mobile

Mobile application for the Music Promo CRM built with React Native.

## Features

- Cross-platform support (iOS & Android)
- User authentication
- Push notifications
- Offline support
- Mobile-optimized UI
- Dark/Light theme

## Prerequisites

- Node.js (v14 or later)
- npm or yarn
- React Native CLI
- Xcode (for iOS development)
- Android Studio (for Android development)
- Watchman (for iOS development)
- CocoaPods (for iOS development)

## Getting Started

1. **Install dependencies**
   ```bash
   cd mobile
   npm install
   # or
   yarn install
   ```

2. **iOS Setup**
   ```bash
   cd ios
   pod install
   cd ..
   ```

3. **Start the development server**
   ```bash
   # Start Metro bundler
   npx react-native start
   
   # Run on iOS (in a new terminal)
   npx react-native run-ios
   
   # Run on Android (in a new terminal)
   npx react-native run-android
   ```

## Environment Setup

Create a `.env` file in the mobile directory with the following variables:

```
API_BASE_URL=your_api_url_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
ONESIGNAL_APP_ID=your_onesignal_app_id
SENTRY_DSN=your_sentry_dsn
```

## Project Structure

```
mobile/
├── android/               # Android native code
├── ios/                   # iOS native code
├── src/
│   ├── assets/            # Images, fonts, etc.
│   ├── components/        # Reusable components
│   ├── config/            # App configuration
│   ├── context/           # React context providers
│   ├── hooks/             # Custom React hooks
│   ├── navigation/        # Navigation configuration
│   ├── screens/           # App screens
│   ├── services/          # API services
│   ├── store/             # State management
│   ├── theme/             # Styling and theming
│   └── utils/             # Utility functions
├── App.tsx                # Main application component
└── index.js               # Entry point
```

## Available Scripts

- `start`: Start Metro bundler
- `ios`: Run on iOS simulator
- `android`: Run on Android emulator
- `test`: Run tests
- `lint`: Run ESLint
- `build:ios`: Build iOS app
- `build:android`: Build Android app

## Contributing

1. Create a new branch: `git checkout -b feature/your-feature-name`
2. Make your changes and commit them
3. Push to the branch: `git push origin feature/your-feature-name`
4. Create a pull request

## License

This project is licensed under the MIT License.
