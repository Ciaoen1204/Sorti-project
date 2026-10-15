/* eslint-env jest */
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  CommonResolutions: { HD_4_3: { width: 1280, height: 960 } },
  useCameraDevice: () => ({ id: 'mock-camera' }),
  useCameraPermission: () => ({
    hasPermission: true,
    requestPermission: jest.fn(async () => true),
  }),
  usePhotoOutput: () => ({ capturePhotoToFile: jest.fn() }),
}));
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
jest.mock('react-native-markdown-display', () => () => null);

jest.mock('./src/services/nativePush',()=>({nativePushConfigured:()=>false,listenNativePush:()=>()=>{},enableNativePush:jest.fn(),disableNativePush:jest.fn(async()=>{})}));

jest.mock('@react-native-clipboard/clipboard',()=>({__esModule:true,default:{setString:jest.fn()}}));
