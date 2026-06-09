/**
 * Register Screen
 *
 * หน้านี้ใช้สำหรับสมัครบัญชีผู้ใช้ใหม่
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - ผู้ใช้กรอกข้อมูลส่วนตัว
 * - ระบบตรวจสอบข้อมูลในหน้านี้ก่อน
 * - ถ้าข้อมูลถูกต้อง จะเริ่มขั้นตอนลงทะเบียน
 * - เมื่อลงทะเบียนสำเร็จ จะพาไปหน้า Success
 */

import React, { useState } from 'react';
import { TouchableOpacity, View, Keyboard } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import KanitText from '../../components/KanitText';
import { FloatingLabelInput } from '../../components/FloatingLabelInput';
import { FormLayout } from '../../components/FormLayout';
import { AppScreenHeader as ScreenHeader } from '../../components/AppScreenHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { GenderSelect } from '../../components/GenderSelect';
import { PasswordStrengthIndicator } from '../../components/PasswordStrengthIndicator';

import { register } from '../../services/authService';
import { showErrorMessage } from '../../utils/errorHelper';
import { showDialog } from '../../utils/dialogService';
import Logger from '../../utils/logger';
import { safeRouter as router } from '../../utils/safeRouter';
import { validatePasswordPolicy } from '../../utils/passwordPolicy';
import { getThaiPhoneValidationError, sanitizePhoneInput } from '../../utils/phoneValidation';
import { getEmailValidationError, sanitizeEmailInput } from '../../utils/formValidation';

export default function RegisterScreen() {
  // เก็บข้อมูลที่ผู้ใช้กรอกในฟอร์มสมัครสมาชิก
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // เก็บ error ของช่องอีเมล
  const [emailError, setEmailError] = useState('');

  // เก็บรหัสผ่านและ error ของรหัสผ่าน
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // จัดการขั้นตอนลงทะเบียนของหน้านี้
  const registerMutation = useMutation({
    mutationFn: async (data: unknown) => {
      return await register(data as Parameters<typeof register>[0]);
    },
    onSuccess: async (data) => {
      router.replace({
        pathname: '/(auth)/success',
        params: {
          type: 'register',
          token: data.token,
        },
      });
    },
    onError: (error: unknown) => {
      showErrorMessage('ลงทะเบียนล้มเหลว', error);
    },
  });

  const handleRegister = async () => {
    Keyboard.dismiss();

    if (!firstName || !lastName || !email || !password || !gender) {
      showDialog('กรุณากรอกข้อมูล', 'โปรดกรอกข้อมูลให้ครบถ้วน รวมถึงเพศ');
      return;
    }

    const emailValidationError = emailError || getEmailValidationError(email, { required: true });
    if (emailValidationError) {
      showDialog('อีเมลไม่ถูกต้อง', emailValidationError);
      return;
    }

    const passwordValidation = validatePasswordPolicy(password);
    if (!passwordValidation.valid) {
      showDialog('รหัสผ่านไม่ถูกต้อง', passwordValidation.message || '');
      return;
    }

    const cleanedPhone = sanitizePhoneInput(phone);
    const phoneError = getThaiPhoneValidationError(cleanedPhone);
    if (phoneError) {
      showDialog('เบอร์โทรศัพท์ไม่ถูกต้อง', phoneError);
      return;
    }

    const payload = {
      email,
      password,
      firstName,
      lastName,
      gender,
      phone: cleanedPhone || undefined,
    };

    Logger.info('Submitting registration');
    registerMutation.mutate(payload);
  };

  return (
    <FormLayout header={<ScreenHeader title="" onBack={router.back} />}>
      <View className="flex-1">
        <KanitText weight="medium" className="text-[28px] text-gray-900 mb-2">
          ลงทะเบียน
        </KanitText>
        <KanitText className="text-[15px] text-gray-500 mb-6">
          กรุณากรอกรายละเอียดของคุณเพื่อเข้าใช้งาน
        </KanitText>

        <View className="mb-6">
          {/* ช่องกรอกชื่อและนามสกุล */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FloatingLabelInput
                testID="firstName-input"
                label="ชื่อ"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View className="flex-1">
              <FloatingLabelInput
                testID="lastName-input"
                label="นามสกุล"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          {/* เลือกเพศของผู้ใช้ */}
          <View>
            <GenderSelect value={gender} onChange={setGender} />
          </View>

          {/* ช่องกรอกเบอร์โทรศัพท์ */}
          <View>
            <FloatingLabelInput
              testID="phone-input"
              label="เบอร์โทรศัพท์"
              value={phone}
              onChangeText={(text) => {
                setPhone(sanitizePhoneInput(text));
              }}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>

          {/* ช่องกรอกอีเมล */}
          <View>
            <FloatingLabelInput
              testID="email-input"
              label="อีเมล"
              value={email}
              onChangeText={(text) => {
                const filtered = sanitizeEmailInput(text);
                setEmail(filtered);
                setEmailError('');
              }}
              error={emailError}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              keyboardType="email-address"
            />
          </View>

          {/* ช่องกรอกรหัสผ่าน */}
          <View>
            <FloatingLabelInput
              testID="password-input"
              label="รหัสผ่าน"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (/[ก-๙]/.test(text)) {
                  setPasswordError('กรุณากรอกรหัสผ่านเป็นภาษาอังกฤษ');
                } else {
                  setPasswordError('');
                }
              }}
              error={passwordError}
              isPassword
              autoCapitalize="none"
              textContentType="password"
            />
          </View>

          {/* แสดงความแข็งแรงของรหัสผ่าน */}
          <View>
            <PasswordStrengthIndicator password={password} />
          </View>
        </View>

        {/* ปุ่มเริ่มขั้นตอนลงทะเบียน */}
        <PrimaryButton
          testID="register-button"
          title="ลงทะเบียน"
          onPress={handleRegister}
          loading={registerMutation.isPending}
        />

        <View className="flex-row justify-center items-center mt-6">
          <KanitText className="text-[15px] text-gray-500">มีบัญชีอยู่แล้ว ? </KanitText>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
            <KanitText weight="medium" className="text-[15px]" style={{ color: '#EB6A6A' }}>
              เข้าสู่ระบบ
            </KanitText>
          </TouchableOpacity>
        </View>
      </View>
    </FormLayout>
  );
}
