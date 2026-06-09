/**
 * Change Email Screen
 *
 * หน้านี้ใช้เปลี่ยนอีเมลเข้าสู่ระบบ
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดอีเมลปัจจุบันจากโปรไฟล์ผู้ใช้
 * - รับอีเมลใหม่จากผู้ใช้
 * - ตรวจภาษาไทยและรูปแบบอีเมลก่อนบันทึก
 * - เตือนผู้ใช้ถ้ากรอกข้อมูลแล้วกดย้อนกลับโดยยังไม่บันทึก
 * - ส่งอีเมลใหม่ไปอัปเดตที่ Backend
 * - เมื่อสำเร็จ จะ refresh cache และแสดง toast
 */

import React, { useState, useEffect } from 'react';
import { View, Keyboard } from 'react-native';
import { MaterialIconSolid } from '../../../components/MaterialIconSolid';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import KanitText from '../../../components/KanitText';
import { FloatingLabelInput } from '../../../components/FloatingLabelInput';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ConfirmModal } from '../../../components/ConfirmModal';

import { safeRouter as router } from '../../../utils/safeRouter';
import { getProfile, updateProfile } from '../../../services/userService';
import { showDialog } from '../../../utils/dialogService';
import { showSuccessToast } from '../../../utils/toast';
import Logger from '../../../utils/logger';
import {
  containsThaiText,
  getEmailValidationError,
  sanitizeEmailInput,
} from '../../../utils/formValidation';

import { useNavBarInset } from '../../../hooks/useNavBarInset';
import { queryKeys } from '../../../hooks/queryKeys';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';

export default function ProfileChangeEmailScreen() {
  // เพิ่มระยะด้านล่าง ไม่ให้ปุ่มชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // ใช้จัดการ cache ของ React Query หลังอัปเดตอีเมลสำเร็จ
  const queryClient = useQueryClient();

  // State ของฟอร์มเปลี่ยนอีเมล
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // โหลดโปรไฟล์ผู้ใช้ เพื่อแสดงอีเมลปัจจุบัน
  const { data: profile, isLoading: loading } = useQuery({
    queryKey: queryKeys.userProfile(),

    // ไฟล์ถัดไป: services/userService.ts
    queryFn: getProfile,
  });

  const currentEmail = profile?.email ?? '';

  // ใช้เตือนผู้ใช้ ถ้ากรอกอีเมลใหม่แล้วกดย้อนกลับโดยยังไม่บันทึก
  const { setHasChanges, resetChanges, modalProps } = useUnsavedChanges({
    title: 'ยังไม่ได้บันทึกข้อมูล',
    message: 'คุณมีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?',
  });

  useEffect(() => {
    // ถ้าเริ่มกรอกอีเมลใหม่ ให้ถือว่ามีข้อมูลค้างบันทึก
    setHasChanges(newEmail.trim().length > 0);
  }, [newEmail, setHasChanges]);

  const handleSave = async () => {
    // ปิด keyboard ทันทีที่กดปุ่ม ก่อน navigation เริ่มทำงาน
    Keyboard.dismiss();

    const cleanedEmail = newEmail.trim();

    // ตรวจข้อมูลก่อนอัปเดตอีเมล
    if (!cleanedEmail) {
      showDialog('กรุณากรอกข้อมูล', 'กรุณากรอกอีเมลใหม่');
      return;
    }

    const emailValidationError =
      emailError ||
      getEmailValidationError(cleanedEmail, {
        required: true,
        invalidMessage: 'กรุณากรอกอีเมลที่ถูกต้อง',
      });
    if (emailValidationError) {
      showDialog(
        emailValidationError === 'กรุณากรอกอีเมลเป็นภาษาอังกฤษ'
          ? 'อีเมลไม่ถูกต้อง'
          : 'รูปแบบอีเมลไม่ถูกต้อง',
        emailValidationError,
      );
      return;
    }

    if (cleanedEmail === currentEmail) {
      showDialog('แจ้งเตือน', 'อีเมลใหม่เหมือนกับอีเมลเดิม');
      return;
    }

    // บันทึกแล้ว ไม่ต้องเตือน unsaved changes
    resetChanges();

    // กลับหน้าก่อนหน้าเพื่อให้ UX ตอบสนองทันที
    // API จะทำงานต่อด้านหลัง
    router.back();

    try {
      // เรียก service สำหรับอัปเดตอีเมล
      // ไฟล์ถัดไป: services/userService.ts
      await updateProfile({ email: cleanedEmail });

      // refresh profile เพื่อให้หน้าที่เกี่ยวข้องเห็นอีเมลใหม่
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });

      showSuccessToast('อีเมลอัปเดตแล้ว');
    } catch (error: unknown) {
      Logger.error('Error updating email:', error);

      const message = error instanceof Error ? error.message : 'ไม่สามารถเปลี่ยนอีเมลได้';
      showDialog('ข้อผิดพลาด', message);
    }
  };

  if (loading) {
    return <LoadingScreen useScreenWrapper message="กำลังโหลดข้อมูล..." />;
  }

  return (
    <ScreenWrapper
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingBottom: 24 + navBarInset,
        flexGrow: 1,
      }}
      keyboardAvoiding
      useScrollView={false}
      header={<ScreenHeader title="" onBack={() => router.back()} />}
    >
      <View className="flex-1">
        <KanitText weight="medium" className="text-[28px] text-gray-900 mb-2">
          แก้ไขอีเมล
        </KanitText>

        <KanitText className="text-[15px] text-gray-500 mb-6">กรุณากรอกอีเมลใหม่ของคุณ</KanitText>

        {/* แสดงอีเมลปัจจุบันแบบอ่านอย่างเดียว */}
        <View className="mb-4">
          <KanitText className="text-sm text-gray-500 mb-2 ml-1">อีเมลปัจจุบัน</KanitText>
          <View
            className="rounded-xl border border-gray-200 justify-center px-4"
            style={{ height: 56, backgroundColor: '#F9FAFB' }}
          >
            <KanitText
              className="font-kanit text-base text-gray-600"
              style={{ lineHeight: 24 }}
              numberOfLines={1}
            >
              {currentEmail}
            </KanitText>
          </View>
        </View>

        <View>
          <FloatingLabelInput
            label="อีเมลใหม่"
            value={newEmail}
            onChangeText={(text) => {
              const filteredEmail = sanitizeEmailInput(text);
              setNewEmail(filteredEmail);

              // ตรวจภาษาไทยทันที เพราะอีเมลควรใช้ตัวอักษรอังกฤษ
              if (containsThaiText(text)) {
                setEmailError('กรุณากรอกอีเมลเป็นภาษาอังกฤษ');
              } else {
                setEmailError('');
              }
            }}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>

        {/* แจ้งให้ผู้ใช้รู้ว่าอีเมลใหม่นี้จะใช้ login ครั้งถัดไป */}
        <View className="bg-blue-50 rounded-2xl p-4 flex-row mb-8">
          <MaterialIconSolid name="info" size={20} color="#3B82F6" style={{ marginTop: 2 }} />
          <KanitText className="text-[13px] text-blue-700 flex-1 ml-2" style={{ lineHeight: 20 }}>
            คุณจะต้องใช้อีเมลใหม่ในการเข้าสู่ระบบครั้งถัดไป
          </KanitText>
        </View>

        {/* ปุ่มบันทึกอีเมลใหม่ */}
        <View>
          <PrimaryButton title="บันทึกข้อมูล" onPress={handleSave} />
        </View>
      </View>

      {/* Modal เตือนเมื่อมีข้อมูลที่แก้ไขแล้วแต่ยังไม่บันทึก */}
      <ConfirmModal {...modalProps} />
    </ScreenWrapper>
  );
}
