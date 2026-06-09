/** @jsxImportSource react */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable react/display-name */
import 'react-native-gesture-handler/jestSetup';
import { Animated } from 'react-native';
import { cleanup } from '@testing-library/react-native';

globalThis.requestIdleCallback = (callback: IdleRequestCallback): number => {
  callback({ didTimeout: false, timeRemaining: () => 50 });
  return 0;
};

globalThis.cancelIdleCallback = jest.fn();

const originalConsoleError = console.error;
jest.spyOn(console, 'error').mockImplementation((message?: unknown, ...args: unknown[]) => {
  const text = typeof message === 'string' ? message : '';
  if (text.includes('not wrapped in act(...)')) {
    return;
  }
  originalConsoleError(message, ...args);
});

afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.clearAllMocks();
  jest.useRealTimers();
});

jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
  const toValue = config?.toValue;
  return {
    start: (callback?: Animated.EndCallback) => {
      if (typeof toValue === 'number' && value && 'setValue' in value) {
        (value as Animated.Value).setValue(toValue);
      }
      callback?.({ finished: true });
    },
    stop: jest.fn(),
    reset: jest.fn(),
  } as unknown as Animated.CompositeAnimation;
});

jest.spyOn(Animated, 'loop').mockImplementation((animation) => {
  return {
    start: (callback?: Animated.EndCallback) => {
      animation.start(callback);
    },
    stop: () => {
      animation.stop();
    },
    reset: () => {
      animation.reset();
    },
  } as unknown as Animated.CompositeAnimation;
});

jest.mock('react-native-reanimated', () => {
  const mockReact = require('react');
  const { View: mockView, Text: mockText } = require('react-native');

  const AnimatedView = (props: unknown) => mockReact.createElement(mockView, props);
  const AnimatedText = (props: unknown) => mockReact.createElement(mockText, props);
  const makeFade = () => ({
    delay: () => makeFade(),
    duration: () => makeFade(),
  });

  return {
    __esModule: true,
    default: {
      View: AnimatedView,
      Text: AnimatedText,
      createAnimatedComponent: (Component: unknown) => Component,
    },
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => (typeof factory === 'function' ? factory() : {}),
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown) => value,
    withRepeat: (value: unknown) => value,
    withSequence: (...values: unknown[]) => values[values.length - 1],
    FadeInDown: makeFade(),
    Easing: {
      linear: jest.fn(),
      inOut: jest.fn(),
      out: jest.fn(),
      in: jest.fn(),
      ease: jest.fn(),
    },
    cancelAnimation: jest.fn(),
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

jest.mock('expo-camera', () => {
  const mockReact = require('react');
  const { View: mockView } = require('react-native');
  return {
    CameraView: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockView, null, children),
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-ble-manager', () => ({
  __esModule: true,
  default: {
    start: jest.fn(async () => undefined),
    checkState: jest.fn(async () => 'on'),
    stopScan: jest.fn(async () => undefined),
    scan: jest.fn(async () => undefined),
    connect: jest.fn(async () => undefined),
    disconnect: jest.fn(async () => undefined),
    retrieveServices: jest.fn(async (id: string) => ({ id, rssi: 0, advertising: {} })),
    isPeripheralConnected: jest.fn(async () => true),
    write: jest.fn(async () => undefined),
    read: jest.fn(async () => [2]),
    startNotification: jest.fn(async () => undefined),
    onDiscoverPeripheral: jest.fn(() => ({ remove: jest.fn() })),
    onDidUpdateState: jest.fn(() => ({ remove: jest.fn() })),
    onDidUpdateValueForCharacteristic: jest.fn(() => ({ remove: jest.fn() })),
  },
  BleState: {
    On: 'on',
    Off: 'off',
    Unsupported: 'unsupported',
    Unauthorized: 'unauthorized',
  },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {},
    manifest: {},
    manifest2: {},
    platform: {},
    deviceName: 'test-device',
  },
}));

jest.mock('expo-image', () => {
  const mockReact = require('react');
  const { Image: mockImage } = require('react-native');
  return {
    Image: (props: unknown) => mockReact.createElement(mockImage, props),
  };
});

jest.mock('@expo/vector-icons', () => {
  const mockReact = require('react');
  const { Text: mockText } = require('react-native');
  const MockIcon = (props: { name: string; testID?: string }) =>
    mockReact.createElement(mockText, props, props.name);

  return {
    Ionicons: Object.assign(MockIcon, { glyphMap: {} }),
    MaterialIcons: Object.assign(MockIcon, { glyphMap: {} }),
    MaterialCommunityIcons: Object.assign(MockIcon, {
      glyphMap: {
        'wifi-strength-1': 1,
        'wifi-strength-2': 2,
        'wifi-strength-3': 3,
        'wifi-strength-4': 4,
      },
    }),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const { View: mockView } = require('react-native');
  const inset = { top: 0, bottom: 0, left: 0, right: 0 };
  const frame = { x: 0, y: 0, width: 0, height: 0 };
  const SafeAreaInsetsContext = mockReact.createContext(inset);
  const SafeAreaFrameContext = mockReact.createContext(frame);
  return {
    SafeAreaProvider: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockView, null, children),
    SafeAreaView: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockView, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => frame,
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    initialWindowMetrics: {
      frame,
      insets: inset,
    },
  };
});

jest.mock('react-native-keyboard-aware-scroll-view', () => {
  const mockReact = require('react');
  const { ScrollView: mockScrollView } = require('react-native');
  return {
    KeyboardAwareScrollView: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockScrollView, null, children),
  };
});

jest.mock('expo-router', () => {
  const mockReact = require('react');
  const { Text: mockText, View: mockView } = require('react-native');
  const mockUseLocalSearchParams = jest.fn(() => ({}));

  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      setParams: jest.fn(),
      canGoBack: jest.fn(() => true),
    },
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      setParams: jest.fn(),
      canGoBack: jest.fn(() => true),
    }),
    useSegments: () => [],
    useFocusEffect: (cb: () => void | (() => void)) => {
      mockReact.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, [cb]);
    },
    useLocalSearchParams: mockUseLocalSearchParams,
    useRootNavigationState: () => ({ key: 'root' }),
    Link: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockText, null, children),
    Stack: {
      Screen: () => mockReact.createElement(mockView, null),
    },
    Tabs: {
      Screen: () => mockReact.createElement(mockView, null),
    },
  };
});

jest.mock('react-native-draggable-flatlist', () => {
  const mockReact = require('react');
  const { View: mockView } = require('react-native');
  return {
    __esModule: true,
    default: ({
      data = [],
      renderItem,
    }: {
      data?: unknown[];
      renderItem: (params: {
        item: unknown;
        index: number;
        drag: () => void;
        isActive: boolean;
        getIndex: () => number;
      }) => unknown;
    }) =>
      mockReact.createElement(
        mockView,
        null,
        data.map((item, index) =>
          mockReact.createElement(
            mockView,
            { key: index },
            renderItem({ item, index, drag: jest.fn(), isActive: false, getIndex: () => index }),
          ),
        ),
      ),
    ScaleDecorator: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockView, null, children),
  };
});

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: {
    show: jest.fn(),
    hide: jest.fn(),
  },
}));

jest.mock('react-native-gesture-handler', () => {
  const mockReact = require('react');
  const { View: mockView } = require('react-native');
  return {
    GestureHandlerRootView: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockView, null, children),
    Swipeable: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockView, null, children),
  };
});

jest.mock('@react-navigation/native', () => {
  const mockReact = require('react');
  return {
    NavigationContainer: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
    useIsFocused: () => true,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      dispatch: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      key: 'test-route',
      name: 'test-route',
      params: {},
    }),
  };
});

jest.mock('react-native-paper', () => {
  const mockReact = require('react');
  const { TextInput: NativeTextInput } = require('react-native');

  const MockTextInput = (props: Record<string, unknown>) =>
    mockReact.createElement(NativeTextInput, props);

  MockTextInput.Icon = () => null;

  return {
    PaperProvider: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
    Portal: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
    Dialog: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
    TextInput: MockTextInput,
    useTheme: () => ({
      colors: {
        primary: '#16AD78',
        onSurface: '#111827',
        onSurfaceVariant: '#6B7280',
        outline: '#D1D5DB',
        error: '#DC2626',
      },
    }),
    MD3LightTheme: {
      colors: {
        primary: '#16AD78',
      },
    },
    configureFonts: () => ({}),
  };
});

jest.mock('expo-linear-gradient', () => {
  const mockReact = require('react');
  const { View: mockView } = require('react-native');
  return {
    LinearGradient: ({ children, style }: { children?: unknown; style?: unknown }) =>
      mockReact.createElement(mockView, { style }, children),
  };
});
