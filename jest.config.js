module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/web/'],
  preset: '@react-native/jest-preset',
  setupFiles: ['react-native-gesture-handler/jestSetup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  resolver: 'react-native-worklets/jest/resolver.js',
  transformIgnorePatterns: [
    'node_modules/(?!((@)?react-native|@react-native|@react-native-async-storage|@react-navigation|react-native-safe-area-context|react-native-drawer-layout|react-native-reanimated|react-native-worklets|react-native-url-polyfill|react-native-vector-icons)/)',
  ],
};
