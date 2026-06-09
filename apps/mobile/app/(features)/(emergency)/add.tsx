/**
 * Add Emergency Contact Screen
 *
 * หน้านี้ใช้เพิ่มผู้ติดต่อฉุกเฉินใหม่
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลผู้สูงอายุปัจจุบัน เพื่อเอา elderId
 * - รับชื่อ เบอร์โทร และความสัมพันธ์
 * - ตรวจข้อมูลก่อนบันทึก
 * - ส่งข้อมูลไปสร้างผู้ติดต่อฉุกเฉิน
 * - กดบันทึกแล้วกลับหน้าก่อนทันที จากนั้นค่อย sync รายชื่อด้านหลัง
 */

import React, { useState, useEffect } from 'react';
import { View, Keyboard } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import KanitText from '../../../components/KanitText';
import { FloatingLabelInput } from '../../../components/FloatingLabelInput';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { RelationshipSelect } from '../../../components/RelationshipSelect';

import { safeRouter as router } from '../../../utils/safeRouter';
import { createContact } from '../../../services/emergencyContactService';
import { showErrorMessage } from '../../../utils/errorHelper';
import Logger from '../../../utils/logger';
import { showDialog } from '../../../utils/dialogService';
import { showSuccessToast } from '../../../utils/toast';
import { getThaiPhoneValidationError, sanitizePhoneInput } from '../../../utils/phoneValidation';
import { getRequiredTextValidationError } from '../../../utils/formValidation';
import {
  EMERGENCY_RELATIONSHIP_OTHER,
  buildEmergencyRelationshipValue,
} from '../../../utils/emergencyRelationship';

import { useCurrentElder } from '../../../hooks/useCurrentElder';
import { queryKeys } from '../../../hooks/queryKeys';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { useNavBarInset } from '../../../hooks/useNavBarInset';

import type { EmergencyContact } from '../../../services/types';

export default function AddEmergencyContactScreen() {
  const [isNavigating, setIsNavigating] = useState(false);

  // รับ params เพื่อดูว่าต้อง redirect ไปไหนหลังบันทึกเสร็จ
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  // ใช้จัดการ cache ของ React Query หลังเพิ่มผู้ติดต่อสำเร็จ
  const queryClient = useQueryClient();

  // เพิ่มระยะด้านล่าง ไม่ให้ปุ่มชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // โหลดข้อมูลผู้สูงอายุปัจจุบัน
  // ใช้ elderId สำหรับสร้างผู้ติดต่อฉุกเฉิน
  const { data: currentElder, isLoading: isElderLoading } = useCurrentElder({
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
  });
  const elderId = currentElder?.id;

  // State ของฟอร์มเพิ่มผู้ติดต่อ
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [customRelationship, setCustomRelationship] = useState('');

  // ใช้เตือนผู้ใช้ ถ้ากรอกข้อมูลแล้วกดย้อนกลับโดยยังไม่บันทึก
  const { setHasChanges, resetChanges, modalProps } = useUnsavedChanges({
    title: 'ยังไม่ได้บันทึกข้อมูล',
    message: 'คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?',
  });

  useEffect(() => {
    // รวม relationship ปกติและกรณีเลือก "อื่นๆ"
    const effectiveRelationship = buildEmergencyRelationshipValue(relationship, customRelationship);

    // ถ้ามีข้อมูลในฟอร์มอย่างน้อย 1 ช่อง ให้เปิดการเตือน unsaved changes
    const hasInput =
      name.trim().length > 0 || phone.trim().length > 0 || effectiveRelationship.trim().length > 0;

    setHasChanges(hasInput);
  }, [name, phone, relationship, customRelationship, setHasChanges]);

  // จัดการขั้นตอนสร้างผู้ติดต่อฉุกเฉิน
  // เมื่อเรียก mutate() ระบบจะเข้ามาทำงานที่ mutationFn
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string; relationship?: string }) => {
      if (!elderId) throw new Error('ไม่พบข้อมูลผู้สูงอายุ');

      // เรียก service สำหรับสร้างผู้ติดต่อฉุกเฉิน
      // ไฟล์ถัดไป: services/emergencyContactService.ts
      return await createContact(elderId, data);
    },
    onMutate: (data) => {
      if (!elderId) return { previousContacts: undefined, optimisticId: undefined };

      const queryKey = queryKeys.emergencyContacts(elderId);
      const previousContacts = queryClient.getQueryData<EmergencyContact[]>(queryKey);
      const optimisticId = `optimistic-contact-${Date.now()}`;

      // ใส่รายการชั่วคราวทันที เพื่อให้หน้ารายชื่อที่กลับไปเห็นผลไวเหมือนฟอร์ม profile
      queryClient.setQueryData<EmergencyContact[]>(queryKey, (old) => {
        const current = old ?? [];

        return [
          ...current,
          {
            id: optimisticId,
            elderId,
            name: data.name,
            phone: data.phone,
            relationship: data.relationship ?? null,
            priority: current.length + 1,
          },
        ];
      });

      return { previousContacts, optimisticId };
    },
    onSuccess: (createdContact, _variables, context) => {
      if (!elderId) return;

      queryClient.setQueryData<EmergencyContact[]>(queryKeys.emergencyContacts(elderId), (old) => {
        const current = old ?? [];

        if (context?.optimisticId) {
          return current.map((contact) =>
            contact.id === context.optimisticId ? createdContact : contact,
          );
        }

        return current.some((contact) => contact.id === createdContact.id)
          ? current.map((contact) => (contact.id === createdContact.id ? createdContact : contact))
          : [...current, createdContact];
      });

      // sync จาก server แบบ background ไม่บล็อก navigation หรือ toast
      void queryClient.invalidateQueries({
        queryKey: queryKeys.emergencyContacts(elderId),
      });

      showSuccessToast('เพิ่มผู้ติดต่อแล้ว');
    },
    onError: (error: unknown, _variables, context) => {
      setIsNavigating(false);
      if (elderId && context?.previousContacts) {
        queryClient.setQueryData(queryKeys.emergencyContacts(elderId), context.previousContacts);
      }

      Logger.error('Error adding contact:', error);
      showErrorMessage('ข้อผิดพลาด', error);
    },
  });

  const handleSave = () => {
    if (isNavigating) return;
    setIsNavigating(true);

    // ปิด keyboard ทันทีที่กดปุ่ม ก่อน navigation เริ่มทำงาน
    Keyboard.dismiss();

    const cleanedName = name.trim();
    const cleanedPhone = sanitizePhoneInput(phone);

    // ตรวจข้อมูลก่อนบันทึก
    if (!elderId) {
      showDialog('ไม่พบข้อมูลผู้สูงอายุ', 'กรุณาลองใหม่อีกครั้ง');
      setIsNavigating(false);
      return;
    }

    const nameError = getRequiredTextValidationError(cleanedName, 'กรุณากรอกชื่อและเบอร์โทรศัพท์');
    const missingPhoneError = getRequiredTextValidationError(
      cleanedPhone,
      'กรุณากรอกชื่อและเบอร์โทรศัพท์',
    );
    if (nameError || missingPhoneError) {
      showDialog('กรุณากรอกข้อมูล', nameError || missingPhoneError || '');
      setIsNavigating(false);
      return;
    }

    const phoneError = getThaiPhoneValidationError(cleanedPhone, { required: true });
    if (phoneError) {
      showDialog('เบอร์โทรไม่ถูกต้อง', phoneError);
      setIsNavigating(false);
      return;
    }

    const nextRelationship = buildEmergencyRelationshipValue(relationship, customRelationship);

    // บันทึกสำเร็จในเชิง UX แล้ว ไม่ต้องเตือน unsaved changes ระหว่างกลับหน้ารายชื่อ
    resetChanges();

    // กลับหน้าก่อนเพื่อให้ฟอร์มตอบสนองไว ส่วน mutation/cache ทำงานต่อด้านหลัง
    // แสดง Toast และส่ง Navigation Toast ทันทีเพื่อให้ขึ้นพร้อมกับการเปลี่ยนหน้าจออย่างรวดเร็ว
    if (redirect === 'call') {
      router.replace('/(features)/(emergency)/call');
    } else {
      router.replace('/(features)/(emergency)/contacts');
    }

    // เริ่มสร้างผู้ติดต่อฉุกเฉิน
    // ถัดไปไปที่ createMutation ด้านบน
    createMutation.mutate({
      name: cleanedName,
      phone: cleanedPhone,
      ...(nextRelationship ? { relationship: nextRelationship } : {}),
    });
  };

  if (isElderLoading) {
    return <LoadingScreen useScreenWrapper />;
  }

  return (
    <ScreenWrapper
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingBottom: 40 + navBarInset,
      }}
      scrollViewProps={{
        bounces: false,
        overScrollMode: 'never',
        showsVerticalScrollIndicator: true,
      }}
      header={
        <ScreenHeader
          title=""
          onBack={() => {
            if (isNavigating) return;
            setIsNavigating(true);
            router.back();
          }}
        />
      }
    >
      <View>
        <KanitText weight="medium" className="text-[28px] text-gray-900 mb-2">
          เพิ่มเบอร์ติดต่อฉุกเฉิน
        </KanitText>
        <KanitText className="text-[15px] text-gray-500 mb-6">
          กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง เพื่อให้คุณสามารถกดโทรออกได้ทันทีเมื่อเกิดเหตุฉุกเฉิน
        </KanitText>

        <View>
          {/* ชื่อผู้ติดต่อฉุกเฉิน */}
          <View>
            <FloatingLabelInput
              label="ชื่อผู้ติดต่อ"
              value={name}
              onChangeText={setName}
              isRequired={true}
            />
          </View>

          {/* เบอร์โทรศัพท์ของผู้ติดต่อ */}
          <View>
            <FloatingLabelInput
              label="เบอร์ติดต่อ"
              value={phone}
              onChangeText={(text) => setPhone(sanitizePhoneInput(text))}
              keyboardType="phone-pad"
              maxLength={10}
              isRequired={true}
              textContentType="telephoneNumber"
            />
          </View>

          {/* เลือกความสัมพันธ์กับผู้สูงอายุ */}
          <View>
            <RelationshipSelect
              label="ความสัมพันธ์กับผู้สูงอายุ (ถ้ามี)"
              value={relationship}
              onChange={setRelationship}
            />
          </View>

          {/* ถ้าเลือก "อื่นๆ" ให้กรอกความสัมพันธ์เอง */}
          {relationship === EMERGENCY_RELATIONSHIP_OTHER && (
            <View>
              <FloatingLabelInput
                label="โปรดระบุความสัมพันธ์"
                value={customRelationship}
                onChangeText={setCustomRelationship}
                placeholder="เช่น อสม."
              />
            </View>
          )}
        </View>

        {/* ปุ่มบันทึกผู้ติดต่อฉุกเฉิน */}
        <View className="mt-2">
          <PrimaryButton
            title="บันทึกข้อมูล"
            onPress={handleSave}
            loading={createMutation.isPending}
            disabled={createMutation.isPending || isNavigating}
          />
        </View>
      </View>

      {/* Modal เตือนเมื่อมีข้อมูลที่กรอกแล้วแต่ยังไม่บันทึก */}
      <ConfirmModal {...modalProps} />
    </ScreenWrapper>
  );
}
