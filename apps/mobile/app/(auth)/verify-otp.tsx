/**
 * Verify OTP Screen
 *
 * หน้านี้ใช้สำหรับยืนยันรหัส OTP
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - รับ email และข้อมูล OTP จากหน้า Forgot Password
 * - ผู้ใช้กรอกรหัส OTP 6 หลัก
 * - ระบบตรวจรหัส OTP
 * - ถ้ารหัสถูกต้อง จะไปหน้า Reset Password
 * - ถ้าต้องการรหัสใหม่ จะใช้ปุ่ม Resend OTP
 */

import React, { useState, useRef, useEffect } from 'react';
import { TextInput, TouchableOpacity, View, Keyboard } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import KanitText from '../../components/KanitText';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../components/AppScreenHeader';
import { PrimaryButton } from '../../components/PrimaryButton';

import { safeRouter as router } from '../../utils/safeRouter';
import { verifyOtp, requestOtp } from '../../services/authService';
import { showErrorMessage } from '../../utils/errorHelper';
import { showDialog } from '../../utils/dialogService';
import { getOtpValidationError, sanitizeOtpInput } from '../../utils/formValidation';

import { useAppSearchParams } from '../../utils/searchParams';

const THEME_COLOR = '#16AD78';
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyOtpScreen() {
  // อ่านข้อมูลที่ถูกส่งมาจากหน้า Forgot Password
  const searchParams = useAppSearchParams();

  // email ใช้สำหรับตรวจ OTP และขอ OTP ใหม่
  const email = searchParams.getStringOrEmpty('email');

  // referenceCode ใช้แสดงให้ผู้ใช้เทียบกับอีเมล
  const initialReferenceCode = searchParams.getStringOrEmpty('referenceCode');

  // เวลาเริ่มต้นของ OTP ถ้าไม่ได้ส่งมา จะใช้ 5 นาที
  const initialExpiresInMinutes = searchParams.getNumberWithFallback('expiresInMinutes', 5);

  // เก็บรหัส OTP ที่ผู้ใช้กรอก
  const [code, setCode] = useState('');

  // เวลารอ ก่อนขอ OTP ใหม่ได้
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN_SECONDS);

  // เวลาที่ OTP ยังใช้งานได้
  const [expiryTimer, setExpiryTimer] = useState(initialExpiresInMinutes * 60);

  // รหัสอ้างอิงของ OTP
  const [referenceCode, setReferenceCode] = useState(initialReferenceCode || '');

  // ใช้แสดง Loading ตอนกำลังตรวจ OTP
  const [isVerifying, setIsVerifying] = useState(false);

  // อ้างอิงถึง TextInput ที่ซ่อนไว้ เพื่อสั่ง focus ได้
  const inputRef = useRef<TextInput>(null);

  const focusOtpInput = () => {
    // รอให้ animation ของหน้าจอจบก่อน แล้วค่อย focus ช่อง OTP
    requestIdleCallback(() => {
      inputRef.current?.focus();
    });
  };

  useEffect(() => {
    // โฟกัสช่องกรอก OTP อัตโนมัติเมื่อเข้ามาที่หน้านี้
    focusOtpInput();

    // เริ่มนับเวลาถอยหลังของ Resend และ Expiry
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      setExpiryTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    // เมื่อออกจากหน้านี้ ให้หยุด interval
    return () => clearInterval(interval);
  }, []);

  const handleCodeChange = (text: string) => {
    // ถ้าค่าเดิมกับค่าใหม่เหมือนกัน ไม่ต้องทำอะไร
    if (text === code) return;

    // รับเฉพาะตัวเลข และจำกัดความยาว OTP ไม่ให้เกิน 6 หลัก
    setCode(sanitizeOtpInput(text, OTP_LENGTH));
  };

  const handleVerify = async () => {
    Keyboard.dismiss();
    // ถ้ากรอก OTP ไม่ครบ ให้หยุดอยู่ที่หน้านี้
    const otpError = getOtpValidationError(code, OTP_LENGTH);
    if (otpError) {
      showDialog('ข้อมูลไม่ครบ', otpError);
      return;
    }

    setIsVerifying(true);

    try {
      // เรียก service สำหรับตรวจ OTP
      // ไฟล์ถัดไป: services/authService.ts
      await verifyOtp({ email, code });

      // ตรวจ OTP สำเร็จแล้วไปหน้า Reset Password
      // ส่ง email และ code ไปให้หน้าถัดไปใช้ต่อ
      router.push({
        pathname: '/(auth)/reset-password',
        params: { email, code },
      });
    } catch (_error: unknown) {
      // ถ้า OTP ไม่ถูกต้อง ให้ล้างรหัสและให้ผู้ใช้กรอกใหม่
      showDialog('รหัสไม่ถูกต้อง', 'รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง', [
        {
          text: 'ลองใหม่',
          onPress: () => {
            setCode('');
            focusOtpInput();
          },
        },
      ]);
    } finally {
      // จบการตรวจ OTP แล้ว ให้หยุด Loading
      setIsVerifying(false);
    }
  };

  // จัดการขั้นตอนขอ OTP ใหม่ของหน้านี้
  // เมื่อเรียก mutate() ระบบจะเข้ามาทำงานที่ mutationFn
  const resendOtpMutation = useMutation({
    mutationFn: async () => {
      // เรียก service สำหรับขอ OTP ใหม่
      // ไฟล์ถัดไป: services/authService.ts
      return await requestOtp({ email });
    },
    onSuccess: (data) => {
      // ขอ OTP ใหม่สำเร็จแล้ว อัปเดตเวลานับถอยหลังและรหัสอ้างอิง
      setResendTimer(RESEND_COOLDOWN_SECONDS);
      setExpiryTimer(data.expiresInMinutes * 60);
      setReferenceCode(data.referenceCode);
      showDialog('ส่งรหัสใหม่แล้ว', 'กรุณาตรวจสอบอีเมล');
    },
    onError: (error: unknown) => {
      // ขอ OTP ใหม่ไม่สำเร็จ ให้แสดง error
      showErrorMessage('ผิดพลาด', error);
    },
  });

  const handleResendOtp = async () => {
    // ถ้ายังอยู่ในช่วงรอ ให้หยุดอยู่ที่หน้านี้
    if (resendTimer > 0) return;

    // เริ่มขอ OTP ใหม่
    // ถัดไปไปที่ resendOtpMutation ด้านบน
    resendOtpMutation.mutate();
  };

  const formatTime = (seconds: number) => {
    // แปลงวินาทีให้เป็นรูปแบบ mm:ss
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <ScreenWrapper
      useScrollView={true}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingBottom: 40,
        flex: 1,
      }}
      scrollViewProps={{
        bounces: false,
        overScrollMode: 'never',
      }}
      header={<ScreenHeader title="" onBack={router.back} />}
    >
      <View>
        <KanitText weight="medium" className="text-gray-900 text-[28px] mb-4">
          ยืนยันรหัส OTP
        </KanitText>

        <KanitText className="text-gray-600 text-[15px]">
          กรอกรหัส OTP ที่ระบบส่งไปที่ {email}
        </KanitText>
        <KanitText className="text-gray-500 text-sm mb-8">รหัส OTP มีอายุ 5 นาที</KanitText>

        {/* กล่องแสดง OTP 6 หลักบนหน้าจอ */}
        <View className="items-center mb-6">
          <View className="relative">
            <View className="flex-row justify-center gap-3" testID="otp-boxes">
              {[...Array(OTP_LENGTH)].map((_, index) => {
                const hasValue = index < code.length;
                const isActive = index === code.length;
                return (
                  <View key={index} className="w-10 h-[50px] items-center justify-end">
                    {/* แสดงตัวเลข OTP ตามตำแหน่ง */}
                    <KanitText className="text-gray-900 text-2xl mb-1">
                      {hasValue ? code[index] : ''}
                    </KanitText>

                    {/* เส้นใต้ของแต่ละช่อง OTP */}
                    <View
                      style={{
                        height: 3,
                        width: '100%',
                        backgroundColor: hasValue ? THEME_COLOR : isActive ? '#9CA3AF' : '#E5E7EB',
                        borderRadius: 2,
                      }}
                    />
                  </View>
                );
              })}
            </View>

            {/* TextInput จริงถูกซ่อนไว้ เพื่อรับค่าจากคีย์บอร์ด */}
            <TextInput
              ref={inputRef}
              testID="otp-input"
              value={code}
              onChangeText={handleCodeChange}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              cursorColor={THEME_COLOR}
              selectionColor={THEME_COLOR}
              blurOnSubmit={false}
              returnKeyType="done"
              caretHidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0.02,
              }}
            />
          </View>
        </View>

        {/* แสดงรหัสอ้างอิงและเวลาของ OTP */}
        <View className="items-center mb-6">
          {referenceCode && (
            <KanitText weight="medium" className="text-gray-700 text-[15px] mb-1">
              รหัสอ้างอิง: {referenceCode}
            </KanitText>
          )}
          <KanitText className="text-gray-500 text-[13px]">
            รหัส OTP มีผล {Math.ceil(expiryTimer / 60)} นาทีก่อนหมดอายุ
          </KanitText>

          <View className="flex-row items-center mt-4">
            {resendTimer > 0 ? (
              <KanitText className="text-gray-400 text-sm">
                ส่งรหัสใหม่อีกครั้งใน {formatTime(resendTimer)} นาที
              </KanitText>
            ) : (
              // เมื่อหมดเวลารอแล้ว จะแสดงปุ่มขอ OTP ใหม่
              <TouchableOpacity onPress={handleResendOtp} testID="resend-button">
                <KanitText weight="medium" className="text-[#16AD78] text-sm">
                  ส่งรหัสอีกครั้ง
                </KanitText>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ปุ่มเริ่มขั้นตอนตรวจ OTP */}
        <PrimaryButton
          testID="verify-button"
          title="ยืนยัน"
          onPress={handleVerify}
          disabled={code.length !== OTP_LENGTH}
          loading={isVerifying}
        />
      </View>
    </ScreenWrapper>
  );
}
