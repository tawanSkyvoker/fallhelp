import React from 'react';
import { View } from 'react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { fireEvent, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import ProfileInfoScreen from '../../../app/(features)/(profile)/profile-info';
import ProfileChangeEmailScreen from '../../../app/(features)/(profile)/change-email';
import ProfileChangePasswordScreen from '../../../app/(features)/(profile)/change-password';
import ProfileEditInfoScreen from '../../../app/(features)/(profile)/edit-info';
import ProfileEditPhoneScreen from '../../../app/(features)/(profile)/edit-phone';

const mockQueryClient = {
  invalidateQueries: jest.fn(),
  refetchQueries: jest.fn(),
  clear: jest.fn(),
};
const mockSignOut = jest.fn(async () => undefined);
const mockReact = React;
const mockView = View;

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  // Stable references — useEffect([profile]) would loop if data is a new object each render
  const stableProfileData = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    gender: 'MALE',
    profileImage: null,
  };
  return {
    ...actual,
    useQuery: jest.fn(() => ({
      data: stableProfileData,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    })),
    useMutation: jest.fn(() => ({
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
    })),
    useQueryClient: jest.fn(() => mockQueryClient),
  };
});

jest.mock('../../../hooks/useCurrentElder', () => ({
  useCurrentElder: () => ({
    data: { id: 'elder-1', accessLevel: 'OWNER' },
    refetch: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useNavBarInset', () => ({
  useNavBarInset: () => 0,
}));

jest.mock('../../../hooks/useUnsavedChanges', () => {
  // Stable references so setHasChanges in useEffect deps doesn't trigger infinite re-render
  const setHasChanges = jest.fn();
  const resetChanges = jest.fn();
  return {
    useUnsavedChanges: () => ({
      setHasChanges,
      resetChanges,
      modalProps: { visible: false },
    }),
  };
});

jest.mock('../../../components/ConfirmModal', () => ({
  ConfirmModal: () => mockReact.createElement(mockView, { testID: 'confirm-modal' }),
}));

jest.mock('../../../components/GenderSelect', () => ({
  GenderSelect: () => mockReact.createElement(mockView, { testID: 'gender-select' }),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('../../../components/ScreenWrapper', () => ({
  ScreenWrapper: ({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) =>
    mockReact.createElement(mockView, null, header, children),
}));

jest.mock('../../../components/AppScreenHeader', () => ({
  AppScreenHeader: ({ title }: { title?: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return title ? mockReact.createElement(Text, null, title) : null;
  },
}));

jest.mock('../../../components/FloatingLabelInput', () => ({
  FloatingLabelInput: () => mockReact.createElement(mockView, { testID: 'input' }),
}));

jest.mock('../../../components/PrimaryButton', () => ({
  PrimaryButton: () => null,
}));

jest.mock('../../../components/LoadingScreen', () => ({
  LoadingScreen: () => null,
}));

jest.mock('../../../components/skeletons', () => ({
  ProfileSkeleton: () => null,
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('../../../components/Bounceable', () => ({
  Bounceable: ({
    children,
    onPress,
    testID,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TouchableOpacity } = require('react-native');
    return mockReact.createElement(TouchableOpacity, { onPress, testID }, children);
  },
}));

jest.mock('../../../components/PasswordStrengthIndicator', () => ({
  PasswordStrengthIndicator: () => null,
}));

jest.mock('../../../utils/safeRouter', () => ({
  safeRouter: {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('../../../utils/dialogService', () => ({
  showDialog: jest.fn(),
}));

jest.mock('../../../utils/errorHelper', () => ({
  showErrorMessage: jest.fn(),
  getErrorMessage: jest.fn(() => 'error'),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

jest.mock('../../../services/userService', () => ({
  getProfile: jest.fn(async () => ({
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    gender: 'MALE',
  })),
  updateProfile: jest.fn(async () => ({})),
}));

jest.mock('../../../services/api', () => ({
  apiClient: {
    put: jest.fn(async () => ({})),
  },
}));

describe('Profile screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders profile index screen', () => {
    const { getByText } = renderWithProviders(<ProfileInfoScreen />);

    expect(getByText('ข้อมูลส่วนตัว')).toBeTruthy();
  });

  it('เปิด cropper แบบสี่เหลี่ยมจัตุรัสเมื่อเปลี่ยนรูปโปรไฟล์', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          base64: 'base64-profile-image',
          mimeType: 'image/jpeg',
          uri: 'file://profile.jpg',
          width: 512,
          height: 512,
        },
      ],
    });

    const { getByTestId } = renderWithProviders(<ProfileInfoScreen />);

    fireEvent.press(getByTestId('profile-image-button'));

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          shape: 'oval',
          quality: 0.8,
          base64: true,
        }),
      );
    });
  });

  it('renders change email screen after load', async () => {
    const { findByText } = renderWithProviders(<ProfileChangeEmailScreen />);

    expect(await findByText('แก้ไขอีเมล')).toBeTruthy();
  });

  it('renders change password screen', () => {
    const { getByText } = renderWithProviders(<ProfileChangePasswordScreen />);

    expect(getByText('เปลี่ยนรหัสผ่าน')).toBeTruthy();
  });

  it('renders edit user info screen', async () => {
    const { findByText } = renderWithProviders(<ProfileEditInfoScreen />);

    expect(await findByText('แก้ไขข้อมูลส่วนตัว')).toBeTruthy();
  });

  it('renders edit phone screen', async () => {
    const { findByText } = renderWithProviders(<ProfileEditPhoneScreen />);

    expect(await findByText('แก้ไขเบอร์โทรศัพท์')).toBeTruthy();
  });
});

// ─── Logout flow tests ───────────────────────────────────────────────────────
// ครอบคลุม bug fix: signOut ต้องถูกเรียกผ่าน requestAnimationFrame + setTimeout(0)
// เพื่อให้ react-native-paper Dialog/Portal animation จบก่อน navigation เริ่ม
// และห้ามผูก logout กับ component lifecycle (useMutation) ซึ่งจะ crash หลัง unmount
describe('Profile — logout flow', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { showDialog } = require('../../../utils/dialogService') as {
    showDialog: jest.Mock;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { showErrorMessage } = require('../../../utils/errorHelper') as {
    showErrorMessage: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // ใช้ fake timers เพื่อควบคุม requestAnimationFrame และ setTimeout(0)
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('เรียก showDialog พร้อม title ออกจากระบบ เมื่อกดปุ่มออกจากระบบ', () => {
    const { getByTestId } = renderWithProviders(<ProfileInfoScreen />);

    // กดปุ่ม logout card ผ่าน testID
    fireEvent.press(getByTestId('logout-button'));

    expect(showDialog).toHaveBeenCalledTimes(1);
    expect(showDialog).toHaveBeenCalledWith(
      'ออกจากระบบ',
      'ยืนยันการออกจากระบบของคุณหรือไม่?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'ยกเลิก', style: 'cancel' }),
        expect.objectContaining({ text: 'ออกจากระบบ', style: 'destructive' }),
      ]),
    );
  });

  it('ไม่เรียก signOut เมื่อกด ยกเลิก ใน dialog', () => {
    const { getByTestId } = renderWithProviders(<ProfileInfoScreen />);

    fireEvent.press(getByTestId('logout-button'));

    // cancel action ไม่มี onPress ดังนั้น signOut ต้องไม่ถูกเรียก
    const [cancelAction] = showDialog.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    cancelAction!.onPress?.();

    // flush timers ทั้งหมด
    jest.runAllTimers();

    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('เรียก signOut ทันที เมื่อ confirm ออกจากระบบ', async () => {
    const { getByTestId } = renderWithProviders(<ProfileInfoScreen />);

    fireEvent.press(getByTestId('logout-button'));

    const actions = showDialog.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const confirmAction = actions.find((a) => a.text === 'ออกจากระบบ');
    expect(confirmAction).toBeDefined();

    // กด confirm — handleLogoutConfirmed: router.replace → signOut()
    confirmAction!.onPress?.();

    // DialogContext ชะลอ pendingAction 50ms (ตามที่เราทำไว้ใน handleHidden)
    // ดังนั้นต้อง flush timer ที่เกิดจาก DialogContext (แต่ ProfileInfoScreen ไม่ได้หน่วงแล้ว)
    jest.runAllTimers();

    // รอ microtask (Promise จาก signOut) resolve
    await Promise.resolve();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('เรียก showErrorMessage เมื่อ signOut throw error', async () => {
    const testError = new Error('logout failed');
    mockSignOut.mockRejectedValueOnce(testError);

    const { getByTestId } = renderWithProviders(<ProfileInfoScreen />);

    fireEvent.press(getByTestId('logout-button'));

    const actions = showDialog.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const confirmAction = actions.find((a) => a.text === 'ออกจากระบบ');
    confirmAction!.onPress?.();

    jest.runAllTimers();

    // รอ Promise reject + catch ใน handleLogoutConfirmed
    await Promise.resolve();
    await Promise.resolve();

    expect(showErrorMessage).toHaveBeenCalledWith('ผิดพลาด', testError);
  });
});
