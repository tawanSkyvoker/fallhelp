/**
 * Forgot Password Screen
 *
 * หน้านี้ใช้สำหรับขอรหัส OTP เมื่อลืมรหัสผ่าน
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - ผู้ใช้กรอกอีเมล
 * - ระบบตรวจสอบอีเมลเบื้องต้น
 * - ถ้าข้อมูลถูกต้อง จะเริ่มขั้นตอนขอ OTP
 * - เมื่อขอ OTP สำเร็จ จะไปหน้า Verify OTP
 */

import React, { useState } from 'react';
import { View, Keyboard } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import KanitText from '../../components/KanitText';
import { FloatingLabelInput } from '../../components/FloatingLabelInput';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../components/AppScreenHeader';
import { PrimaryButton } from '../../components/PrimaryButton';

import { safeRouter as router } from '../../utils/safeRouter';
import { requestOtp } from '../../services/authService';
import Logger from '../../utils/logger';
import { showErrorMessage } from '../../utils/errorHelper';
import { showDialog } from '../../utils/dialogService';
import {
  getEmailValidationError,
  sanitizeEmailInput,
  containsThaiText,
} from '../../utils/formValidation';

import { useNavBarInset } from '../../hooks/useNavBarInset';
import { useAppSearchParams } from '../../utils/searchParams';

export default function ForgotPasswordScreen() {
  // อ่าน email จาก params
  // ใช้กรณีที่หน้าอื่นส่งผู้ใช้กลับมาหน้านี้
  const searchParams = useAppSearchParams();
  const initialEmail = searchParams.getStringOrEmpty('email');

  // เก็บอีเมลที่ผู้ใช้กรอก
  const [email, setEmail] = useState(initialEmail);

  // เก็บ error ของช่องอีเมล เช่น มีตัวอักษรภาษาไทย
  const [emailError, setEmailError] = useState('');

  // เพิ่มระยะด้านล่าง ไม่ให้ปุ่มชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // จัดการขั้นตอนขอ OTP ของหน้านี้
  // เมื่อเรียก mutate() ระบบจะเข้ามาทำงานที่ mutationFn
  const requestOtpMutation = useMutation({
    mutationFn: async () => {
      // เรียก service สำหรับขอ OTP
      // ไฟล์ถัดไป: services/authService.ts
      return await requestOtp({ email });
    },
    onSuccess: (data) => {
      // ขอ OTP สำเร็จ แล้วแจ้งผู้ใช้ก่อนเปลี่ยนหน้า
      showDialog('ส่งรหัสสำเร็จ', `รหัส OTP ถูกส่งไปยัง\n${email}\nแล้ว`, [
        {
          text: 'ตกลง',
          onPress: () => {
            // ไปหน้า Verify OTP
            // ส่งข้อมูลที่หน้านั้นต้องใช้ต่อไปด้วย
            router.push({
              pathname: '/(auth)/verify-otp',
              params: {
                email,
                referenceCode: data.referenceCode,
                expiresInMinutes: String(data.expiresInMinutes),
              },
            });
          },
        },
      ]);
    },
    onError: (error: unknown) => {
      // ขอ OTP ไม่สำเร็จ ให้แสดงข้อความ error
      Logger.error('Forgot password error:', error);
      showErrorMessage('เกิดข้อผิดพลาด', error);
    },
  });

  const handleSendOtp = async () => {
    Keyboard.dismiss();
    // เริ่มจากตรวจข้อมูลในหน้านี้ก่อน

    const cleanedEmail = email.trim();

    if (!cleanedEmail) {
      showDialog('กรุณากรอกข้อมูล', 'โปรดกรอกอีเมลของคุณ');
      return;
    }

    // ถ้ามี error จากช่องอีเมล ให้หยุดไว้ก่อน
    const emailValidationError =
      emailError || getEmailValidationError(cleanedEmail, { required: true });
    if (emailValidationError) {
      showDialog(
        emailValidationError === 'กรุณากรอกอีเมลเป็นภาษาอังกฤษ'
          ? 'อีเมลไม่ถูกต้อง'
          : 'รูปแบบไม่ถูกต้อง',
        emailValidationError,
      );
      return;
    }

    // เริ่มขอ OTP
    // ถัดไปไปที่ requestOtpMutation ด้านบน
    requestOtpMutation.mutate();
  };

  return (
    <ScreenWrapper
      useScrollView={false}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingBottom: 40 + navBarInset,
        flexGrow: 1,
      }}
      header={<ScreenHeader title="" onBack={router.back} />}
    >
      <View className="flex-1">
        <KanitText weight="medium" className="text-[28px] text-gray-900 mb-2">
          ลืมรหัสผ่าน
        </KanitText>
        <KanitText className="text-[15px] text-gray-500 mb-6">
          กรุณากรอกอีเมลที่คุณใช้ลงทะเบียน{'\n'}
          ระบบจะส่งรหัส OTP 6 หลักไปยังอีเมลคุณ
        </KanitText>

        <View className="mb-6">
          <FloatingLabelInput
            testID="email-input"
            label="อีเมล"
            value={email}
            onChangeText={(text) => {
              // เก็บอีเมลที่ผู้ใช้พิมพ์
              const filteredEmail = sanitizeEmailInput(text);
              setEmail(filteredEmail);

              // ตรวจว่ามีตัวอักษรภาษาไทยหรือไม่
              // ถ้ามี จะไม่ให้ไปขั้นตอนขอ OTP
              if (containsThaiText(text)) {
                setEmailError('กรุณากรอกอีเมลเป็นภาษาอังกฤษ');
              } else {
                setEmailError('');
              }
            }}
            error={emailError}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="email-address"
          />
        </View>

        {/* ปุ่มเริ่มขั้นตอนขอ OTP */}
        <PrimaryButton
          testID="send-otp-button"
          title="ส่งรหัส OTP"
          onPress={handleSendOtp}
          loading={requestOtpMutation.isPending}
        />
      </View>
    </ScreenWrapper>
  );
}
