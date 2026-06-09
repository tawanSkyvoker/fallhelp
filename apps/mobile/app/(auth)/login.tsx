/**
 * Login Screen
 *
 * หน้านี้ใช้สำหรับเข้าสู่ระบบ
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - ผู้ใช้กรอกอีเมล/เบอร์โทรศัพท์ และรหัสผ่าน
 * - ระบบตรวจสอบข้อมูลในหน้านี้ก่อน
 * - ถ้าข้อมูลครบ จะเริ่มขั้นตอน Login
 * - เมื่อ Login สำเร็จ จะบันทึกสถานะผู้ใช้ผ่าน AuthContext
 */

import React, { useState, useRef } from 'react';
import { TouchableOpacity, View, Image, Keyboard } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import KanitText from '../../components/KanitText';
import { FloatingLabelInput } from '../../components/FloatingLabelInput';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { PrimaryButton } from '../../components/PrimaryButton';

import { safeRouter as router } from '../../utils/safeRouter';
import { login } from '../../services/authService';
import Logger from '../../utils/logger';
import { showErrorMessage } from '../../utils/errorHelper';
import { showDialog } from '../../utils/dialogService';
import {
  getLoginIdentifierValidationError,
  sanitizeLoginIdentifierInput,
} from '../../utils/formValidation';

import { useAuth } from '../../context/AuthContext';
import { useNavBarInset } from '../../hooks/useNavBarInset';

export default function LoginScreen() {
  // ใช้สำหรับบันทึกสถานะว่า Login สำเร็จแล้ว
  // ถัดไปจะทำงานผ่าน AuthContext
  const { signIn } = useAuth();

  // เพิ่มระยะด้านล่าง ไม่ให้เนื้อหาชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // เก็บอีเมล/เบอร์โทรศัพท์ที่ผู้ใช้กรอก
  const [identifier, setIdentifier] = useState('');

  // เก็บ error ของช่องอีเมล/เบอร์โทรศัพท์
  const [identifierError, setIdentifierError] = useState('');

  // เก็บรหัสผ่านที่ผู้ใช้กรอก
  const [password, setPassword] = useState('');

  // ใช้แสดง Loading หลัง Login สำเร็จ แต่แอปยังเปลี่ยนสถานะไม่เสร็จ
  const [isCompletingLogin, setIsCompletingLogin] = useState(false);

  // เก็บค่าล่าสุดของช่องกรอกไว้แยกจาก State
  // ใช้ตอนกด Login เพื่อกันกรณี State อัปเดตไม่ทัน
  const identifierRef = useRef('');
  const passwordRef = useRef('');

  // จัดการขั้นตอน Login ของหน้านี้
  // เมื่อเรียก mutate() ระบบจะเข้ามาทำงานที่ mutationFn
  const loginMutation = useMutation({
    mutationFn: async (creds: { identifier: string; password: string }) => {
      // เรียก service สำหรับ Login
      // ไฟล์ถัดไป: services/authService.ts
      return await login(creds);
    },
    onSuccess: async (response) => {
      Logger.info('Login success, updating context');
      setIsCompletingLogin(true);

      // Login สำเร็จแล้ว นำ token ไปบันทึกสถานะผู้ใช้
      // ถัดไปไปที่ AuthContext ผ่าน signIn()
      try {
        await signIn(response.token);
      } catch (error) {
        setIsCompletingLogin(false);
        throw error;
      }
    },
    onError: (error: unknown) => {
      // Login ไม่สำเร็จ ให้หยุด Loading และแสดง error
      setIsCompletingLogin(false);
      showErrorMessage('เข้าสู่ระบบล้มเหลว', error);
    },
  });

  const handleLogin = async () => {
    // ปิด keyboard ทันทีที่กดปุ่ม ก่อน navigation เริ่มทำงาน
    Keyboard.dismiss();

    // อ่านค่าล่าสุดจากช่องกรอก ก่อนเริ่ม Login
    const currentIdentifier = sanitizeLoginIdentifierInput(identifierRef.current);
    const currentPassword = passwordRef.current;

    // ถ้ากรอกไม่ครบ ให้หยุดอยู่ที่หน้านี้
    if (!currentIdentifier || !currentPassword) {
      showDialog('กรุณากรอกข้อมูล', 'โปรดกรอกอีเมล/เบอร์โทรศัพท์และรหัสผ่าน');
      return;
    }

    // ถ้าช่องอีเมล/เบอร์โทรศัพท์มี error ให้หยุดไว้ก่อน
    const identifierValidationError =
      identifierError || getLoginIdentifierValidationError(currentIdentifier);
    if (identifierValidationError) {
      showDialog('ข้อมูลไม่ถูกต้อง', identifierValidationError);
      return;
    }

    // เริ่ม Login
    // ถัดไปไปที่ loginMutation ด้านบน
    loginMutation.mutate({ identifier: currentIdentifier, password: currentPassword });
  };

  return (
    <ScreenWrapper
      useScrollView={true}
      contentContainerStyle={{
        paddingHorizontal: 32,
        paddingBottom: 40 + navBarInset,
        paddingTop: 0,
        justifyContent: 'center',
        flexGrow: 1,
      }}
      scrollViewProps={{
        bounces: false,
        overScrollMode: 'never',
        showsVerticalScrollIndicator: false,
      }}
    >
      <View>
        {/* แสดง Logo ของแอปด้านบนของหน้า Login */}
        <View className="items-center" style={{ marginBottom: 40 }}>
          <Image
            source={require('../../assets/images/logoicon.png')}
            style={{ width: 150, height: 150 }}
            resizeMode="contain"
            fadeDuration={0}
          />
        </View>

        <View className="w-full max-w-md mx-auto px-2">
          <FloatingLabelInput
            testID="email-input"
            label="อีเมลหรือเบอร์โทรศัพท์"
            value={identifier}
            onChangeText={(text) => {
              // กรองค่าที่ผู้ใช้พิมพ์ ก่อนเก็บไว้ใช้ Login
              const filtered = sanitizeLoginIdentifierInput(text);

              // Ref ใช้เก็บค่าล่าสุด ตอนกดปุ่ม Login
              identifierRef.current = filtered;

              // State ใช้แสดงค่าบนหน้าจอ
              setIdentifier(filtered);
              setIdentifierError('');
            }}
            error={identifierError}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="email-address"
          />

          <FloatingLabelInput
            testID="password-input"
            label="รหัสผ่าน"
            value={password}
            onChangeText={(text) => {
              // Ref ใช้เก็บรหัสผ่านล่าสุด ตอนกด Login
              passwordRef.current = text;

              // State ใช้แสดงค่าในช่องกรอก
              setPassword(text);
            }}
            isPassword
            autoCapitalize="none"
            textContentType="password"
          />

          {/* ไปหน้า Forgot Password เมื่อลืมรหัสผ่าน */}
          <TouchableOpacity
            className="self-end mb-8 mt-2"
            onPress={() => router.push('/(auth)/forgot-password')}
            activeOpacity={0.7}
          >
            <KanitText className="text-[15px] text-gray-500">ลืมรหัสผ่าน ?</KanitText>
          </TouchableOpacity>

          {/* ปุ่มเริ่มขั้นตอน Login */}
          <PrimaryButton
            testID="login-button"
            title="เข้าสู่ระบบ"
            onPress={handleLogin}
            loading={loginMutation.isPending || isCompletingLogin}
            style={{ marginBottom: 28 }}
          />

          <View className="flex-row justify-center items-center mt-3">
            <KanitText className="text-[15px] text-gray-500">ยังไม่มีบัญชี ? </KanitText>

            {/* ไปหน้า Register สำหรับผู้ใช้ที่ยังไม่มีบัญชี */}
            <TouchableOpacity onPress={() => router.push('/(auth)/register')} activeOpacity={0.7}>
              <KanitText
                weight="medium"
                className="text-primary text-[15px]"
                style={{ color: '#EB6A6A' }}
              >
                ลงทะเบียนบัญชีผู้ใช้งาน
              </KanitText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScreenWrapper>
  );
}
