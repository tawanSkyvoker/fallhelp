/**
 * Edit Phone Screen
 *
 * หน้านี้ใช้แก้ไขเบอร์โทรศัพท์ของผู้ใช้
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลโปรไฟล์ปัจจุบัน
 * - เติมเบอร์โทรเดิมลงฟอร์ม
 * - รับเฉพาะตัวเลขและจำกัดไม่เกิน 10 หลัก
 * - ตรวจว่าผู้ใช้แก้ไขข้อมูลแล้วหรือยัง
 * - เตือนผู้ใช้ถ้ากดย้อนกลับโดยยังไม่บันทึก
 * - ตรวจรูปแบบเบอร์ก่อนบันทึก
 * - ส่งเบอร์ใหม่ไปอัปเดตที่ Backend
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Keyboard } from 'react-native';
import { MaterialIconSolid } from '../../../components/MaterialIconSolid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import KanitText from '../../../components/KanitText';
import { FloatingLabelInput } from '../../../components/FloatingLabelInput';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ConfirmModal } from '../../../components/ConfirmModal';

import { getProfile, updateProfile } from '../../../services/userService';
import { safeRouter as router } from '../../../utils/safeRouter';
import Logger from '../../../utils/logger';
import { showErrorMessage } from '../../../utils/errorHelper';
import { showDialog } from '../../../utils/dialogService';
import { showSuccessToast } from '../../../utils/toast';
import { getThaiPhoneValidationError, sanitizePhoneInput } from '../../../utils/phoneValidation';

import { queryKeys } from '../../../hooks/queryKeys';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';

export default function ProfileEditPhoneScreen() {
  // ใช้จัดการ cache ของ React Query หลังอัปเดตเบอร์สำเร็จ
  const queryClient = useQueryClient();

  // State ของฟอร์มแก้ไขเบอร์โทรศัพท์
  const [phone, setPhone] = useState('');
  const [initialPhone, setInitialPhone] = useState('');

  // ใช้บอกว่าเติมข้อมูลเดิมลงฟอร์มแล้วหรือยัง
  const [hasHydratedForm, setHasHydratedForm] = useState(false);

  // เก็บเบอร์ล่าสุดไว้ใน ref
  // ใช้ตอนกดบันทึก เพื่อกันกรณี state ยังอัปเดตไม่ทัน
  const latestPhoneRef = useRef('');

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
      // ล้าง dash, space หรืออักขระอื่นออกจากเบอร์ที่ได้จาก API
      const cleanedPhone = sanitizePhoneInput(profile.phone || '');

      setHydratedProfileKey(profileKey);
      setPhone(cleanedPhone);
      setInitialPhone(cleanedPhone);
      setHasHydratedForm(true);
    }
  } else if (!isLoading && !hasHydratedForm) {
    // โหลดเสร็จแล้วแต่ไม่มี profile ให้จบ loading state
    setHasHydratedForm(true);
  }

  useEffect(() => {
    // เช็กว่าเบอร์ในฟอร์มต่างจากเบอร์เดิมหรือไม่
    setHasChanges(phone !== initialPhone);
  }, [phone, initialPhone, setHasChanges]);

  useEffect(() => {
    // sync ค่า phone ล่าสุดเข้า ref ให้ handleSave อ่านค่าใหม่เสมอ
    latestPhoneRef.current = phone;
  }, [phone]);

  // จัดการขั้นตอนอัปเดตเบอร์โทรศัพท์
  const updateMutation = useMutation({
    mutationFn: async (data: { phone?: string | null }) => {
      // เรียก service สำหรับอัปเดตโปรไฟล์
      // ไฟล์ถัดไป: services/userService.ts
      await updateProfile(data);

      return data;
    },
    onSuccess: (data) => {
      // อัปเดต cache ทันที เพื่อให้หน้า profile info เห็นเบอร์ใหม่เมื่อกลับไป
      queryClient.setQueryData(
        queryKeys.userProfile(),
        (old: import('../../../services/types').UserProfile | undefined) => ({
          ...old,
          phone: data.phone,
        }),
      );

      // sync ข้อมูลจริงจาก server อีกครั้ง
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });

      showSuccessToast('บันทึกสำเร็จ');
    },
    onError: (error: unknown) => {
      Logger.error('Error updating phone:', error);
      showErrorMessage('ข้อผิดพลาด', error);
    },
  });

  const handleSave = () => {
    // ปิด keyboard ทันทีที่กดปุ่ม ก่อน navigation เริ่มทำงาน
    Keyboard.dismiss();

    // อ่านจาก ref เพื่อให้ได้ค่าล่าสุด แม้ผู้ใช้พิมพ์แล้วกดบันทึกทันที
    const cleanedPhone = sanitizePhoneInput(latestPhoneRef.current);

    // ถ้าเว้นว่างไว้ จะถือว่าไม่ส่งเบอร์ไปอัปเดต
    // ถ้ามีค่า ต้องเป็นเบอร์ 10 หลักและขึ้นต้นด้วย 0
    const phoneError = getThaiPhoneValidationError(cleanedPhone);
    if (phoneError) {
      showDialog('เบอร์โทรไม่ถูกต้อง', phoneError);
      return;
    }

    // บันทึกแล้ว ไม่ต้องเตือน unsaved changes
    resetChanges();

    // กลับหน้าก่อนหน้าเพื่อให้ UX ตอบสนองทันที
    // mutation จะทำงานต่อด้านหลัง
    router.back();

    // เริ่มอัปเดตเบอร์โทรศัพท์
    // ถัดไปไปที่ updateMutation ด้านบน
    updateMutation.mutate(cleanedPhone ? { phone: cleanedPhone } : {});
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
          แก้ไขเบอร์โทรศัพท์
        </KanitText>

        <KanitText className="text-[15px] text-gray-500 mb-6">
          กรุณากรอกเบอร์โทรศัพท์ของคุณ (10 หลัก)
        </KanitText>

        <View>
          <FloatingLabelInput
            label="เบอร์โทรศัพท์"
            value={phone}
            onChangeText={(text) => {
              // รับเฉพาะตัวเลข และจำกัดความยาวไม่เกิน 10 หลัก
              const cleaned = sanitizePhoneInput(text);
              latestPhoneRef.current = cleaned;
              setPhone(cleaned);
            }}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>

        {/* แจ้งให้ผู้ใช้รู้ว่าเบอร์นี้เชื่อมกับบัญชี */}
        <View className="bg-blue-50 rounded-2xl p-4 flex-row mb-8">
          <MaterialIconSolid name="info" size={20} color="#3B82F6" style={{ marginTop: 2 }} />
          <KanitText className="text-[13px] text-blue-700 flex-1 ml-2" style={{ lineHeight: 20 }}>
            คุณจะต้องใช้เบอร์โทรศัพท์ใหม่ในการเข้าสู่ระบบครั้งถัดไป
          </KanitText>
        </View>

        {/* ปุ่มบันทึกเบอร์โทรศัพท์ */}
        <View>
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
