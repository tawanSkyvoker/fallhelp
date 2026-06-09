/**
 * Change Password Screen
 *
 * หน้านี้ใช้เปลี่ยนรหัสผ่านของผู้ใช้
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - รับรหัสผ่านปัจจุบัน รหัสผ่านใหม่ และยืนยันรหัสผ่านใหม่
 * - เตือนผู้ใช้ถ้ากรอกข้อมูลแล้วกดย้อนกลับโดยยังไม่บันทึก
 * - ตรวจข้อมูลก่อนบันทึก เช่น ช่องว่าง รหัสผ่านไม่ตรงกัน และ policy รหัสผ่าน
 * - ส่งข้อมูลไปเปลี่ยนรหัสผ่านที่ Backend
 * - เมื่อสำเร็จ จะกลับหน้าก่อนหน้าและแสดง toast
 */

import React, { useState, useEffect } from 'react';
import { View, Keyboard } from 'react-native';

import KanitText from '../../../components/KanitText';
import { FloatingLabelInput } from '../../../components/FloatingLabelInput';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { PasswordStrengthIndicator } from '../../../components/PasswordStrengthIndicator';
import { ConfirmModal } from '../../../components/ConfirmModal';

import { safeRouter as router } from '../../../utils/safeRouter';
import { changePassword } from '../../../services/userService';
import { showErrorMessage } from '../../../utils/errorHelper';
import { showDialog } from '../../../utils/dialogService';
import { showSuccessToast } from '../../../utils/toast';
import { getPasswordPairValidationError } from '../../../utils/formValidation';

import { useNavBarInset } from '../../../hooks/useNavBarInset';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';

export default function ProfileChangePasswordScreen() {
  // เพิ่มระยะด้านล่าง ไม่ให้ปุ่มชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // State ของฟอร์มเปลี่ยนรหัสผ่าน
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ใช้เตือนผู้ใช้ ถ้ากรอกข้อมูลแล้วกดย้อนกลับโดยยังไม่บันทึก
  const { setHasChanges, resetChanges, modalProps } = useUnsavedChanges({
    title: 'ยังไม่ได้บันทึกข้อมูล',
    message: 'คุณมีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?',
  });

  useEffect(() => {
    // ถ้ามีข้อมูลในฟอร์มอย่างน้อย 1 ช่อง ให้เปิดการเตือน unsaved changes
    const hasInput =
      currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;

    setHasChanges(hasInput);
  }, [currentPassword, newPassword, confirmPassword, setHasChanges]);

  const handleSave = async () => {
    // ปิด keyboard ทันทีที่กดปุ่ม ก่อน navigation เริ่มทำงาน
    Keyboard.dismiss();

    const passwordError = getPasswordPairValidationError({
      currentPassword,
      newPassword,
      confirmPassword,
      requireCurrentPassword: true,
      missingMessage: 'กรุณากรอกข้อมูลให้ครบทุกช่อง',
    });
    if (passwordError) {
      const title =
        passwordError === 'กรุณากรอกข้อมูลให้ครบทุกช่อง'
          ? 'กรุณากรอกข้อมูล'
          : passwordError === 'กรุณากรอกรหัสผ่านยืนยันให้ตรงกัน'
            ? 'รหัสผ่านไม่ตรงกัน'
            : 'รหัสผ่านไม่ถูกต้อง';

      showDialog(title, passwordError);
      return;
    }

    try {
      // เรียก service สำหรับเปลี่ยนรหัสผ่าน
      // ไฟล์ถัดไป: services/userService.ts
      await changePassword({
        currentPassword,
        newPassword,
      });

      // บันทึกสำเร็จแล้ว ไม่ต้องเตือน unsaved changes
      resetChanges();

      router.back();
      showSuccessToast('รหัสผ่านอัปเดตแล้ว');
    } catch (error: unknown) {
      // ถ้ารหัสผ่านปัจจุบันผิด หรือ Backend ปฏิเสธ request ให้แสดง error
      showErrorMessage('ข้อผิดพลาด', error);
    }
  };

  return (
    <ScreenWrapper
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingBottom: 24 + navBarInset,
        flexGrow: 1,
      }}
      useScrollView={true}
      scrollViewProps={{
        bounces: false,
        overScrollMode: 'never',
      }}
      header={<ScreenHeader title="" onBack={() => router.back()} />}
    >
      <View className="flex-1">
        <KanitText weight="medium" className="text-[28px] text-gray-900 mb-2">
          เปลี่ยนรหัสผ่าน
        </KanitText>

        <KanitText className="text-[15px] text-gray-500 mb-6">
          กรุณากรอกรหัสผ่านปัจจุบันและใหม่
        </KanitText>

        {/* รหัสผ่านปัจจุบัน ใช้ยืนยันตัวตนก่อนเปลี่ยน */}
        <View>
          <FloatingLabelInput
            label="รหัสผ่านปัจจุบัน"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            isPassword
            autoCapitalize="none"
            textContentType="password"
          />
        </View>

        {/* รหัสผ่านใหม่ */}
        <View>
          <FloatingLabelInput
            label="รหัสผ่านใหม่"
            value={newPassword}
            onChangeText={setNewPassword}
            isPassword
            autoCapitalize="none"
            textContentType="password"
          />
        </View>

        {/* ยืนยันรหัสผ่านใหม่ ต้องตรงกับช่องรหัสผ่านใหม่ */}
        <View>
          <FloatingLabelInput
            label="ยืนยันรหัสผ่านใหม่"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            autoCapitalize="none"
            textContentType="password"
          />
        </View>

        {/* แสดงความแข็งแรงของรหัสผ่านตามค่าที่ผู้ใช้กรอก */}
        <View className="mb-8">
          <PasswordStrengthIndicator password={newPassword} />
        </View>

        {/* ปุ่มบันทึกรหัสผ่านใหม่ */}
        <PrimaryButton title="บันทึกข้อมูล" onPress={handleSave} />
      </View>

      {/* Modal เตือนเมื่อมีข้อมูลที่แก้ไขแล้วแต่ยังไม่บันทึก */}
      <ConfirmModal {...modalProps} />
    </ScreenWrapper>
  );
}
