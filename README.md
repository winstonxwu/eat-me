# Eat Me - React Native App

A React Native application built with Expo.

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development) or Android Studio (for Android development)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

- **Start the development server:**
  ```bash
  npm start
  ```

- **Run on iOS:**
  ```bash
  npm run ios
  ```

- **Run on Android:**
  ```bash
  npm run android
  ```

- **Run on Web:**
  ```bash
  npm run web
  ```

### Project Structure

```
src/
├── components/     # Reusable UI components
├── screens/        # Screen components
├── navigation/     # Navigation configuration
├── utils/          # Utility functions
└── constants/      # App constants and configuration
```

## Development

This project uses:
- React Native with Expo
- Modern React (Hooks, Functional Components)
- TypeScript support (can be added)
- Expo SDK for native functionality

## Building for Production

- **iOS:** Use Expo Application Services (EAS) or eject to bare React Native
- **Android:** Use EAS Build or eject to bare React Native

For more information, visit the [Expo documentation](https://docs.expo.dev/).
