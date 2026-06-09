/**
 * Reset Password Screen
 *
 * หน้านี้ใช้สำหรับตั้งรหัสผ่านใหม่
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - รับ email และ code จากหน้า Verify OTP
 * - ผู้ใช้กรอกรหัสผ่านใหม่และยืนยันรหัสผ่าน
 * - ระบบตรวจข้อมูลในหน้านี้ก่อน
 * - ถ้าข้อมูลถูกต้อง จะเริ่มขั้นตอนบันทึกรหัสผ่านใหม่
 * - เมื่อสำเร็จ จะไปหน้า Success
 */

import React, { useRef, useState } from 'react';
import { Keyboard, TouchableOpacity, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import KanitText from '../../components/KanitText';
import { FloatingLabelInput } from '../../components/FloatingLabelInput';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../components/AppScreenHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { PasswordStrengthIndicator } from '../../components/PasswordStrengthIndicator';

import { safeRouter as router } from '../../utils/safeRouter';
import { resetPassword } from '../../services/authService';
import { showErrorMessage } from '../../utils/errorHelper';
import { showDialog } from '../../utils/dialogService';
import { getPasswordPairValidationError } from '../../utils/formValidation';
import type { ApiError } from '../../services/api';

import { useNavBarInset } from '../../hooks/useNavBarInset';
import { useAppSearchParams } from '../../utils/searchParams';

export default function ResetPasswordScreen() {
  // เพิ่มระยะด้านล่าง ไม่ให้เนื้อหาชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // อ่านข้อมูลที่ถูกส่งมาจากหน้า Verify OTP
  const searchParams = useAppSearchParams();

  // email และ code ใช้สำหรับยืนยันว่าผู้ใช้ผ่าน OTP มาแล้ว
  const email = searchParams.getStringOrEmpty('email');
  const code = searchParams.getStringOrEmpty('code');

  // State ใช้แสดงค่าที่ผู้ใช้พิมพ์บนหน้าจอ
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Ref ใช้เก็บค่าล่าสุด ตอนกดปุ่มบันทึกรหัสผ่าน
  const newPasswordRef = useRef('');
  const confirmPasswordRef = useRef('');

  const handleNewPasswordChange = (value: string) => {
    // Ref ใช้เก็บค่าล่าสุด
    newPasswordRef.current = value;

    // State ใช้แสดงค่าในช่องกรอก
    setNewPassword(value);
  };

  const handleConfirmPasswordChange = (value: string) => {
    // Ref ใช้เก็บค่าล่าสุด
    confirmPasswordRef.current = value;

    // State ใช้แสดงค่าในช่องกรอก
    setConfirmPassword(value);
  };

  const redirectToForgotPassword = () => {
    // กลับไปหน้า Forgot Password พร้อมส่ง email เดิมกลับไปด้วย
    router.replace({
      pathname: '/(auth)/forgot-password',
      params: { email },
    });
  };

  const isOtpResetFlowError = (error: ApiError): boolean => {
    // กลุ่ม error ที่แปลว่า OTP ใช้ไม่ได้แล้ว
    const otpErrorCodes = new Set(['otp_expired', 'otp_invalid', 'otp_not_found']);

    // ตรวจจาก error code ที่ API ส่งกลับมา
    if (error.code && otpErrorCodes.has(error.code)) {
      return true;
    }

    // ตรวจจาก status code กรณี API ส่งเป็น 422
    if (error.status === 422) {
      return true;
    }

    // ตรวจจากข้อความ error กรณี Backend ส่งข้อความภาษาไทยกลับมา
    return (
      error.message.includes('รหัส OTP หมดอายุ') ||
      error.message.includes('รหัส OTP ไม่ถูกต้อง') ||
      error.message.includes('ไม่พบรหัส OTP')
    );
  };

  // จัดการขั้นตอนบันทึกรหัสผ่านใหม่ของหน้านี้
  // เมื่อเรียก mutate() ระบบจะเข้ามาทำงานที่ mutationFn
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      // เรียก service สำหรับตั้งรหัสผ่านใหม่
      // ไฟล์ถัดไป: services/authService.ts
      return await resetPassword({
        email,
        code,
        newPassword: newPasswordRef.current,
      });
    },
    onSuccess: () => {
      // ตั้งรหัสผ่านใหม่สำเร็จแล้วไปหน้า Success
      router.replace({
        pathname: '/(auth)/success',
        params: { type: 'reset_password' },
      });
    },
    onError: (error: unknown) => {
      const apiError = error as ApiError;

      // ถ้า OTP ใช้ไม่ได้แล้ว ให้ผู้ใช้กลับไปขอ OTP ใหม่
      if (isOtpResetFlowError(apiError)) {
        showDialog(
          'รหัส OTP ใช้ไม่ได้แล้ว',
          'รหัส OTP หมดอายุหรือไม่ถูกต้อง กรุณาขอรหัสใหม่อีกครั้ง',
          [{ text: 'ตกลง', onPress: redirectToForgotPassword }],
        );
        return;
      }

      // error อื่น ๆ ให้แสดงข้อความตามปกติ
      showErrorMessage('ผิดพลาด', error);
    },
  });

  const handleResetPassword = async () => {
    // ปิดคีย์บอร์ดก่อนตรวจข้อมูล
    Keyboard.dismiss();

    // อ่านค่าล่าสุดจากช่องกรอก ก่อนเริ่มบันทึกรหัสผ่าน
    const latestNewPassword = newPasswordRef.current;
    const latestConfirmPassword = confirmPasswordRef.current;

    const passwordError = getPasswordPairValidationError({
      newPassword: latestNewPassword,
      confirmPassword: latestConfirmPassword,
      missingMessage: 'กรุณากรอกรหัสผ่านใหม่ให้ครบถ้วน',
    });
    if (passwordError) {
      const title =
        passwordError === 'กรุณากรอกรหัสผ่านใหม่ให้ครบถ้วน'
          ? 'ข้อมูลไม่ครบ'
          : passwordError === 'กรุณากรอกรหัสผ่านยืนยันให้ตรงกัน'
            ? 'รหัสผ่านไม่ตรงกัน'
            : 'รหัสผ่านไม่ถูกต้อง';

      showDialog(title, passwordError);
      return;
    }

    // เริ่มบันทึกรหัสผ่านใหม่
    // ถัดไปไปที่ resetPasswordMutation ด้านบน
    resetPasswordMutation.mutate();
  };

  return (
    <ScreenWrapper
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingBottom: 40 + navBarInset,
        flexGrow: 1,
      }}
      scrollViewProps={{
        bounces: false,
        overScrollMode: 'never',
      }}
      header={<ScreenHeader title="" />}
    >
      <View className="flex-1">
        <KanitText weight="medium" className="text-[28px] text-gray-900 mb-2">
          ตั้งรหัสผ่านใหม่
        </KanitText>
        <KanitText className="text-[15px] text-gray-500 mb-6">
          สร้างรหัสผ่านใหม่ของคุณ เพื่อเข้าสู่ระบบในครั้งถัดไป
        </KanitText>

        <View className="mb-6">
          {/* ช่องกรอกรหัสผ่านใหม่ */}
          <View className="mb-5">
            <FloatingLabelInput
              testID="newPassword-input"
              label="รหัสผ่านใหม่"
              value={newPassword}
              onChangeText={handleNewPasswordChange}
              isPassword
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
            />

            {/* แสดงความแข็งแรงของรหัสผ่านใหม่ */}
            <View className="mt-3">
              <PasswordStrengthIndicator password={newPassword} />
            </View>
          </View>

          {/* ช่องยืนยันรหัสผ่านใหม่ */}
          <View>
            <FloatingLabelInput
              testID="confirmPassword-input"
              label="ยืนยันรหัสผ่าน"
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              isPassword
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
            />
          </View>
        </View>

        {/* ปุ่มเริ่มขั้นตอนบันทึกรหัสผ่านใหม่ */}
        <PrimaryButton
          title="บันทึกรหัสผ่านใหม่"
          onPress={handleResetPassword}
          loading={resetPasswordMutation.isPending}
        />

        <View className="flex-row justify-center items-center mt-6">
          {/* ยกเลิกแล้วกลับไปหน้า Login */}
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.7}>
            <KanitText className="text-[15px] text-gray-500">ยกเลิก</KanitText>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
}
