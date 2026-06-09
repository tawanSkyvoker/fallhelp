/**
 * Edit User Info Screen
 *
 * หน้านี้ใช้แก้ไขข้อมูลส่วนตัวของผู้ใช้
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลโปรไฟล์ปัจจุบัน
 * - เติมชื่อ นามสกุล และเพศเดิมลงฟอร์ม
 * - ตรวจว่าผู้ใช้แก้ไขข้อมูลแล้วหรือยัง
 * - เตือนผู้ใช้ถ้ากดย้อนกลับโดยยังไม่บันทึก
 * - ตรวจข้อมูลก่อนบันทึก
 * - ส่งข้อมูลที่แก้ไขไปอัปเดตที่ Backend
 */

import React, { useState, useEffect } from 'react';
import { View, Keyboard } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import KanitText from '../../../components/KanitText';
import { FloatingLabelInput } from '../../../components/FloatingLabelInput';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { GenderSelect } from '../../../components/GenderSelect';
import { ConfirmModal } from '../../../components/ConfirmModal';

import { safeRouter as router } from '../../../utils/safeRouter';
import { getProfile, updateProfile } from '../../../services/userService';
import Logger from '../../../utils/logger';
import { showErrorMessage } from '../../../utils/errorHelper';
import { showDialog } from '../../../utils/dialogService';
import { showSuccessToast } from '../../../utils/toast';
import { getRequiredTextValidationError } from '../../../utils/formValidation';

import { queryKeys } from '../../../hooks/queryKeys';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';

import type { Gender, UserProfile } from '../../../services/types';

export default function ProfileEditInfoScreen() {
  // ใช้จัดการ cache ของ React Query หลังอัปเดตข้อมูลสำเร็จ
  const queryClient = useQueryClient();

  // State ของฟอร์มแก้ไขข้อมูลส่วนตัว
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);

  // เก็บข้อมูลเดิมไว้เทียบว่าผู้ใช้แก้ไขอะไรหรือไม่
  const [initialValues, setInitialValues] = useState<{
    firstName: string;
    lastName: string;
    gender: Gender | null;
  } | null>(null);

  // ใช้บอกว่าเติมข้อมูลเดิมลงฟอร์มแล้วหรือยัง
  const [hasHydratedForm, setHasHydratedForm] = useState(false);

  // ใช้เตือนผู้ใช้ ถ้าแก้ไขข้อมูลแล้วกดย้อนกลับโดยยังไม่บันทึก
  const { setHasChanges, resetChanges, modalProps } = useUnsavedChanges({
    title: 'ยังไม่ได้บันทึกข้อมูล',
    message: 'คุณมีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?',
  });

  // โหลดข้อมูลโปรไฟล์ผู้ใช้
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.userProfile(),

    // ไฟล์ถัดไป: services/userService.ts
    queryFn: getProfile,
  });

  // ใช้กันการเติมฟอร์มซ้ำด้วย profile เดิม
  // ไม่อย่างนั้นข้อมูลที่ผู้ใช้กำลังพิมพ์อยู่อาจถูกเขียนทับ
  const [hydratedProfileKey, setHydratedProfileKey] = useState<string | null>(null);
  if (profile) {
    const profileKey = profile.id || 'profile';

    if (hydratedProfileKey !== profileKey) {
      setHydratedProfileKey(profileKey);

      // เติมข้อมูลเดิมจาก profile ลงฟอร์ม
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setGender(profile.gender || null);

      // เก็บค่าเดิมไว้ใช้ตรวจว่าผู้ใช้แก้ไขจริงหรือไม่
      setInitialValues({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        gender: profile.gender || null,
      });

      setHasHydratedForm(true);
    }
  } else if (!isLoading && !hasHydratedForm) {
    // โหลดเสร็จแล้วแต่ไม่มี profile ให้จบ loading state
    setHasHydratedForm(true);
  }

  useEffect(() => {
    if (!initialValues) return;

    const currentValues = { firstName, lastName, gender };

    // เช็กว่าค่าในฟอร์มต่างจากค่าเริ่มต้นหรือไม่
    const hasChanged =
      currentValues.firstName !== initialValues.firstName ||
      currentValues.lastName !== initialValues.lastName ||
      currentValues.gender !== initialValues.gender;

    // ส่งสถานะไปให้ hook ใช้เตือนตอนออกจากหน้า
    setHasChanges(hasChanged);
  }, [firstName, lastName, gender, initialValues, setHasChanges]);

  // จัดการขั้นตอนอัปเดตข้อมูลส่วนตัว
  const updateMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; gender?: Gender | null }) => {
      // เรียก service สำหรับอัปเดตโปรไฟล์
      // ไฟล์ถัดไป: services/userService.ts
      await updateProfile(data);

      return data;
    },
    onSuccess: (data) => {
      // อัปเดต cache ทันที เพื่อให้หน้า profile info เห็นข้อมูลใหม่เมื่อกลับไป
      queryClient.setQueryData(queryKeys.userProfile(), (old: UserProfile | undefined) => ({
        ...old,
        ...data,
      }));

      // refresh ข้อมูลผู้สูงอายุด้วย เผื่อมีส่วนที่เกี่ยวกับข้อมูลผู้ใช้
      queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });

      showSuccessToast('บันทึกสำเร็จ');
    },
    onError: (error: unknown) => {
      Logger.error('Error updating profile:', error);
      showErrorMessage('ข้อผิดพลาด', error);
    },
  });

  const handleSave = () => {
    // ปิด keyboard ทันทีที่กดปุ่ม ก่อน navigation เริ่มทำงาน
    Keyboard.dismiss();

    const firstNameError = getRequiredTextValidationError(firstName, 'กรุณากรอกชื่อและนามสกุล');
    const lastNameError = getRequiredTextValidationError(lastName, 'กรุณากรอกชื่อและนามสกุล');
    if (firstNameError || lastNameError) {
      showDialog('กรุณากรอกข้อมูล', firstNameError || lastNameError || '');
      return;
    }

    // บันทึกแล้ว ไม่ต้องเตือน unsaved changes
    resetChanges();

    // กลับหน้าก่อนหน้าเพื่อให้ UX ตอบสนองทันที
    // mutation จะทำงานต่อด้านหลัง
    router.back();

    // เริ่มอัปเดตข้อมูลส่วนตัว
    // ถัดไปไปที่ updateMutation ด้านบน
    updateMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender: gender,
    });
  };

  if (isLoading || !hasHydratedForm) {
    return <LoadingScreen useScreenWrapper message="กำลังโหลดข้อมูล..." />;
  }

  return (
    <ScreenWrapper
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingBottom: 24,
        flexGrow: 1,
      }}
      scrollViewProps={{
        bounces: false,
        overScrollMode: 'never',
      }}
      header={<ScreenHeader title="" onBack={() => router.back()} />}
    >
      <View className="flex-1">
        <KanitText weight="medium" className="text-[28px] text-gray-900 mb-2">
          แก้ไขข้อมูลส่วนตัว
        </KanitText>

        <KanitText className="text-[15px] text-gray-500 mb-6">
          กรุณากรอกชื่อ นามสกุล และเพศของคุณ
        </KanitText>

        {/* ช่องกรอกชื่อและนามสกุล */}
        <View className="flex-row gap-4">
          <View className="flex-1">
            <FloatingLabelInput label="ชื่อ" value={firstName} onChangeText={setFirstName} />
          </View>

          <View className="flex-1">
            <FloatingLabelInput label="นามสกุล" value={lastName} onChangeText={setLastName} />
          </View>
        </View>

        {/* เลือกเพศของผู้ใช้ */}
        <View>
          <GenderSelect
            value={gender || ''}
            onChange={(val) => setGender((val as Gender) || null)}
            isRequired={false}
          />
        </View>

        {/* ปุ่มบันทึกข้อมูลส่วนตัว */}
        <View className="mt-2">
          <PrimaryButton
            title="บันทึกข้อมูล"
            onPress={handleSave}
            loading={updateMutation.isPending}
          />
        </View>
      </View>

      {/* Modal เตือนเมื่อมีข้อมูลที่แก้ไขแล้วแต่ยังไม่บันทึก */}
      <ConfirmModal {...modalProps} />
    </ScreenWrapper>
  );
}
