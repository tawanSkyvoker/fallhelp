/**
 * Edit Emergency Contact Screen
 *
 * หน้านี้ใช้แก้ไขข้อมูลผู้ติดต่อฉุกเฉิน
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - รับ id ของผู้ติดต่อจาก params
 * - โหลดรายชื่อผู้ติดต่อฉุกเฉินของผู้สูงอายุ
 * - หา contact ที่ตรงกับ id แล้วเติมข้อมูลเดิมลงฟอร์ม
 * - ตรวจว่าผู้ใช้แก้ไขข้อมูลแล้วหรือยัง
 * - ตรวจข้อมูลก่อนบันทึก
 * - ส่งข้อมูลที่แก้ไขไปอัปเดตที่ Backend
 * - กดบันทึกแล้วกลับหน้าก่อนทันที จากนั้นค่อย sync cache ด้านหลัง
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Keyboard } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import KanitText from '../../../components/KanitText';
import { FloatingLabelInput } from '../../../components/FloatingLabelInput';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { RelationshipSelect } from '../../../components/RelationshipSelect';

import { safeRouter as router } from '../../../utils/safeRouter';
import { updateContact, listContacts } from '../../../services/emergencyContactService';
import Logger from '../../../utils/logger';
import { showErrorMessage } from '../../../utils/errorHelper';
import { showDialog } from '../../../utils/dialogService';
import { showSuccessToast } from '../../../utils/toast';
import { getThaiPhoneValidationError, sanitizePhoneInput } from '../../../utils/phoneValidation';
import { getRequiredTextValidationError } from '../../../utils/formValidation';
import {
  EMERGENCY_RELATIONSHIP_OTHER,
  buildEmergencyRelationshipValue,
  getEmergencyRelationshipCustomValue,
  getEmergencyRelationshipSelectValue,
} from '../../../utils/emergencyRelationship';

import { useCurrentElder } from '../../../hooks/useCurrentElder';
import { queryKeys } from '../../../hooks/queryKeys';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { useNavBarInset } from '../../../hooks/useNavBarInset';
import { useAppSearchParams } from '../../../utils/searchParams';

import type { EmergencyContact } from '../../../services/types';

// Hook ย่อยสำหรับจัดการเบอร์โทร
// รับเฉพาะตัวเลข และจำกัดความยาวไม่เกิน 10 หลัก
const usePhoneInput = (initialValue: string = '') => {
  const [phone, setPhone] = useState(initialValue);
  const phoneRef = useRef(initialValue);

  const handlePhoneChange = useCallback((text: string) => {
    const cleaned = sanitizePhoneInput(text);
    phoneRef.current = cleaned;
    setPhone(cleaned);
  }, []);

  const setPhoneValue = useCallback((value: string) => {
    phoneRef.current = value;
    setPhone(value);
  }, []);

  return { phone, phoneRef, handlePhoneChange, setPhone: setPhoneValue };
};

export default function EditEmergencyContactScreen() {
  const [isNavigating, setIsNavigating] = useState(false);

  // ใช้จัดการ cache ของ React Query หลังอัปเดตผู้ติดต่อสำเร็จ
  const queryClient = useQueryClient();

  // เพิ่มระยะด้านล่าง ไม่ให้ปุ่มชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // อ่าน id ของผู้ติดต่อจาก params
  const searchParams = useAppSearchParams<{ id?: string }>();
  const id = searchParams.getString('id');

  // โหลดข้อมูลผู้สูงอายุปัจจุบัน
  // ใช้ elderId ไปดึงรายชื่อผู้ติดต่อฉุกเฉิน
  const { data: currentElder, isLoading: isEldersLoading } = useCurrentElder({
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
  });

  const cachedContacts = queryClient.getQueryData<EmergencyContact[]>(
    queryKeys.emergencyContacts(currentElder?.id),
  );

  // โหลดรายชื่อผู้ติดต่อฉุกเฉิน แล้วหา contact ที่ตรงกับ id
  const {
    data: contacts,
    isLoading: isContactLoading,
    isFetched: isContactFetched,
  } = useQuery({
    queryKey: queryKeys.emergencyContacts(currentElder?.id),
    queryFn: async () => {
      if (!currentElder) return [];

      // เรียก service สำหรับดึงรายชื่อผู้ติดต่อฉุกเฉิน
      // ไฟล์ถัดไป: services/emergencyContactService.ts
      const contactList = await listContacts(currentElder.id);

      if (Array.isArray(contactList)) {
        // เรียงตาม priority เพื่อให้ลำดับตรงกับหน้ารายชื่อ
        return contactList.sort((a, b) => a.priority - b.priority);
      }

      return [];
    },
    enabled: !!currentElder && !!id,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
    ...(cachedContacts !== undefined ? { placeholderData: cachedContacts } : {}),
  });

  const contact = contacts?.find((c) => c.id === id) || null;

  // State ของฟอร์มแก้ไขผู้ติดต่อ (ดึงค่าเริ่มต้นจาก contact ทันทีถ้ามี)
  const [name, setName] = useState(() => contact?.name || '');
  const [relationship, setRelationship] = useState(() =>
    getEmergencyRelationshipSelectValue(contact?.relationship || ''),
  );
  const [customRelationship, setCustomRelationship] = useState(() =>
    getEmergencyRelationshipCustomValue(contact?.relationship || ''),
  );
  const nameRef = useRef(name);
  const relationshipRef = useRef(relationship);
  const customRelationshipRef = useRef(customRelationship);

  // State เบอร์โทร แยกออกมาเพื่อจัด format ตอนกรอก
  const { phone, phoneRef, handlePhoneChange, setPhone } = usePhoneInput(contact?.phone || '');

  const handleNameChange = useCallback((text: string) => {
    nameRef.current = text;
    setName(text);
  }, []);

  const handleRelationshipChange = useCallback((value: string) => {
    relationshipRef.current = value;
    setRelationship(value);
  }, []);

  const handleCustomRelationshipChange = useCallback((value: string) => {
    customRelationshipRef.current = value;
    setCustomRelationship(value);
  }, []);

  // เก็บข้อมูลเดิมไว้เทียบว่าผู้ใช้แก้ไขอะไรหรือไม่
  const [initialValues, setInitialValues] = useState<{
    name: string;
    phone: string;
    relationship: string;
  } | null>(() => {
    if (!contact) return null;
    return {
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship || '',
    };
  });

  // ใช้บอกว่ากำลังรอการเติมข้อมูลอยู่หรือไม่
  const [isHydrationFailed, setIsHydrationFailed] = useState(false);
  const isAwaitingHydration = Boolean(id && initialValues === null && !isHydrationFailed);

  // ใช้เตือนผู้ใช้ ถ้าแก้ไขข้อมูลแล้วกดย้อนกลับโดยยังไม่บันทึก
  const { setHasChanges, resetChanges, modalProps } = useUnsavedChanges({
    title: 'ยังไม่ได้บันทึกข้อมูล',
    message: 'คุณมีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?',
  });

  // ใช้กันการ hydrate ฟอร์มซ้ำกับ contact เดิม โดยไม่เพิ่ม render ระหว่างพิมพ์
  const hydratedContactKeyRef = useRef<string | null>(contact?.id ? `contact:${contact.id}` : null);

  useEffect(() => {
    if (contact) {
      const contactKey = `contact:${contact.id}`;

      if (hydratedContactKeyRef.current === contactKey) return;
      hydratedContactKeyRef.current = contactKey;

      queueMicrotask(() => {
        const contactRelationship = contact.relationship || '';
        const relationshipValue = getEmergencyRelationshipSelectValue(contactRelationship);
        const customRelationshipValue = getEmergencyRelationshipCustomValue(contactRelationship);

        // เติมข้อมูลเดิมของ contact ลงฟอร์มหลัง render เพื่อไม่ให้ frame แรกของหน้าฟอร์มหนัก
        setName(contact.name);
        setPhone(contact.phone);
        setRelationship(relationshipValue);
        setCustomRelationship(customRelationshipValue);

        // เก็บข้อมูลเดิมไว้ใช้ตรวจว่าผู้ใช้แก้ไขหรือไม่
        setInitialValues({
          name: contact.name,
          phone: contact.phone,
          relationship: contactRelationship,
        });
      });

      return;
    }

    if ((isContactFetched || !id || !currentElder?.id) && initialValues === null) {
      // โหลดจบแล้วแต่ไม่เจอ contact หรือข้อมูลไม่พอ ให้จบ loading state เพื่อให้แสดง error ตอนบันทึกได้
      setIsHydrationFailed(true);
    }
  }, [contact, currentElder?.id, id, isContactFetched, setPhone, initialValues]);

  // sync refs หลัง hydration เสร็จ — ทำใน effect เพราะ lint ไม่อนุญาต ref.current ใน render
  useEffect(() => {
    if (!initialValues) return;
    nameRef.current = initialValues.name;
    relationshipRef.current = getEmergencyRelationshipSelectValue(initialValues.relationship);
    customRelationshipRef.current = getEmergencyRelationshipCustomValue(initialValues.relationship);
  }, [initialValues]);

  useEffect(() => {
    if (!initialValues) return;

    // รวม relationship ปกติและกรณีเลือก "อื่นๆ"
    const currentValues = {
      name,
      phone,
      relationship: buildEmergencyRelationshipValue(relationship, customRelationship),
    };

    // เช็กว่าค่าในฟอร์มต่างจากค่าเริ่มต้นหรือไม่
    const hasChanged =
      currentValues.name !== initialValues.name ||
      currentValues.phone !== initialValues.phone ||
      currentValues.relationship !== initialValues.relationship;

    // ส่งสถานะไปให้ hook ใช้เตือนตอนออกจากหน้า
    setHasChanges(hasChanged);
  }, [name, phone, relationship, customRelationship, initialValues, setHasChanges]);

  // จัดการขั้นตอนอัปเดตผู้ติดต่อฉุกเฉิน
  // เมื่อเรียก mutate() ระบบจะเข้ามาทำงานที่ mutationFn
  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string; relationship?: string }) => {
      if (!contact?.id || !currentElder?.id) throw new Error('ไม่พบข้อมูลผู้ติดต่อ');

      // เรียก service สำหรับอัปเดตผู้ติดต่อฉุกเฉิน
      // ไฟล์ถัดไป: services/emergencyContactService.ts
      return await updateContact(currentElder.id, contact.id, data);
    },
    onMutate: (data) => {
      if (!currentElder?.id || !contact?.id) return { previousContacts: undefined };

      const queryKey = queryKeys.emergencyContacts(currentElder.id);
      const previousContacts = queryClient.getQueryData<EmergencyContact[]>(queryKey);

      // อัปเดต cache ก่อนรอ server เพื่อให้หน้ารายชื่อแสดงข้อมูลใหม่ทันทีหลัง back
      queryClient.setQueryData<EmergencyContact[]>(queryKey, (old) => {
        if (!old) return old;

        return old.map((item) => (item.id === contact.id ? { ...item, ...data } : item));
      });

      return { previousContacts };
    },
    onSuccess: (data: EmergencyContact) => {
      // อัปเดต cache ทันที เพื่อลดอาการกระพริบตอนย้อนกลับ
      queryClient.setQueryData(
        queryKeys.emergencyContacts(currentElder?.id),
        (old: EmergencyContact[] | undefined) => {
          if (!old) return old;

          return old.map((contact) => (contact.id === data.id ? { ...contact, ...data } : contact));
        },
      );

      // sync ข้อมูลจริงจาก server อีกครั้ง
      void queryClient.invalidateQueries({
        queryKey: queryKeys.emergencyContacts(currentElder?.id),
      });

      showSuccessToast('อัปเดตผู้ติดต่อแล้ว');
    },
    onError: (error: unknown, _variables, context) => {
      setIsNavigating(false);
      if (currentElder?.id && context?.previousContacts) {
        queryClient.setQueryData(
          queryKeys.emergencyContacts(currentElder.id),
          context.previousContacts,
        );
      }

      Logger.error('Error updating contact:', error);
      showErrorMessage('ข้อผิดพลาด', error);
    },
  });

  const handleSave = () => {
    if (isNavigating) return;
    setIsNavigating(true);

    // ปิด keyboard ทันทีที่กดปุ่ม ก่อน navigation เริ่มทำงาน
    Keyboard.dismiss();

    const latestName = nameRef.current;
    const latestPhone = phoneRef.current;
    const latestRelationship = relationshipRef.current;
    const latestCustomRelationship = customRelationshipRef.current;

    // ตรวจข้อมูลก่อนบันทึก
    const nameError = getRequiredTextValidationError(latestName, 'กรุณากรอกชื่อและเบอร์โทรศัพท์');
    const missingPhoneError = getRequiredTextValidationError(
      latestPhone,
      'กรุณากรอกชื่อและเบอร์โทรศัพท์',
    );
    if (nameError || missingPhoneError) {
      showDialog('กรุณากรอกข้อมูล', nameError || missingPhoneError || '');
      setIsNavigating(false);
      return;
    }

    const phoneError = getThaiPhoneValidationError(latestPhone, { required: true });
    if (phoneError) {
      showDialog('เบอร์โทรไม่ถูกต้อง', phoneError);
      setIsNavigating(false);
      return;
    }

    if (!contact) {
      showDialog('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ติดต่อ');
      setIsNavigating(false);
      return;
    }

    const nextRelationship = buildEmergencyRelationshipValue(
      latestRelationship,
      latestCustomRelationship,
    );

    // บันทึกแล้ว ไม่ต้องเตือน unsaved changes ระหว่างกลับหน้ารายชื่อ
    resetChanges();

    // กลับหน้าก่อนเพื่อให้ UX ตอบสนองทันที ส่วน mutation/cache ทำงานต่อด้านหลัง
    router.back();

    // เริ่มอัปเดตผู้ติดต่อฉุกเฉิน
    // ถัดไปไปที่ updateMutation ด้านบน
    updateMutation.mutate({
      name: latestName.trim(),
      phone: sanitizePhoneInput(latestPhone),
      ...(nextRelationship ? { relationship: nextRelationship } : {}),
    });
  };

  if (
    (isEldersLoading && !currentElder) ||
    (isContactLoading && !contacts) ||
    isAwaitingHydration
  ) {
    return <LoadingScreen useScreenWrapper message="กำลังโหลดข้อมูล..." />;
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
          แก้ไขเบอร์ติดต่อฉุกเฉิน
        </KanitText>

        <KanitText className="text-[15px] text-gray-500 mb-6">
          กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง เพื่อให้คุณสามารถกดโทรออกได้ทันทีเมื่อเกิดเหตุฉุกเฉิน
        </KanitText>

        {contact &&
          (() => {
            const contactIndex = contacts ? contacts.findIndex((c) => c.id === contact.id) : -1;
            return (
              <View className="items-center mb-6">
                {/* แสดงลำดับ priority ปัจจุบันของผู้ติดต่อ */}
                <View className="w-16 h-16 rounded-full bg-[#FFF5F5] items-center justify-center shadow-sm border-2 border-[#FFEAEA]">
                  <KanitText weight="medium" className="text-2xl text-[#EF4444]">
                    {contactIndex !== -1 ? contactIndex + 1 : contact.priority}
                  </KanitText>
                </View>

                <KanitText className="text-[13px] text-gray-500 mt-2">ลำดับความสำคัญ</KanitText>
              </View>
            );
          })()}

        <View>
          {/* ชื่อผู้ติดต่อฉุกเฉิน */}
          <View>
            <FloatingLabelInput
              label="ชื่อผู้ติดต่อ"
              value={name}
              onChangeText={handleNameChange}
              isRequired={true}
            />
          </View>

          {/* เบอร์โทรศัพท์ของผู้ติดต่อ */}
          <View>
            <FloatingLabelInput
              label="เบอร์ติดต่อ"
              value={phone}
              onChangeText={handlePhoneChange}
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
              onChange={handleRelationshipChange}
            />
          </View>

          {/* ถ้าเลือก "อื่นๆ" ให้กรอกความสัมพันธ์เอง */}
          {relationship === EMERGENCY_RELATIONSHIP_OTHER && (
            <View>
              <FloatingLabelInput
                label="โปรดระบุความสัมพันธ์"
                value={customRelationship}
                onChangeText={handleCustomRelationshipChange}
                placeholder="เช่น อสม."
              />
            </View>
          )}
        </View>

        {/* ปุ่มบันทึกการแก้ไขผู้ติดต่อฉุกเฉิน */}
        <View className="mt-2">
          <PrimaryButton
            title="บันทึกการแก้ไข"
            onPress={handleSave}
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending || isNavigating}
          />
        </View>
      </View>

      {/* Modal เตือนเมื่อมีข้อมูลที่แก้ไขแล้วแต่ยังไม่บันทึก */}
      <ConfirmModal {...modalProps} />
    </ScreenWrapper>
  );
}
