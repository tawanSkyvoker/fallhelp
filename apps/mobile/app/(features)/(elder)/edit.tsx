/**
 * Edit Elder Info Screen
 *
 * หน้านี้ใช้แก้ไขข้อมูลผู้สูงอายุ
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลผู้สูงอายุปัจจุบันมาใส่ในฟอร์ม
 * - ตรวจว่าผู้ใช้แก้ไขข้อมูลแล้วหรือยัง
 * - ถ้ามีข้อมูลค้างบันทึก จะเตือนก่อนออกจากหน้า
 * - ตรวจข้อมูลก่อนบันทึก
 * - ส่งข้อมูลที่แก้ไขไปอัปเดตที่ Backend
 * - เมื่อบันทึกสำเร็จ จะอัปเดต cache และกลับหน้าก่อนหน้า
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput as NativeTextInput, Keyboard } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import KanitText from '../../../components/KanitText';
import { FloatingLabelInput } from '../../../components/FloatingLabelInput';
import { FormLayout } from '../../../components/FormLayout';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { GenderSelect } from '../../../components/GenderSelect';
import { FloatingLabelDatePicker } from '../../../components/FloatingLabelDatePicker';
import { CascadingAddressPicker } from '../../../components/CascadingAddressPicker';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ConfirmModal } from '../../../components/ConfirmModal';

import { useLocalSearchParams } from 'expo-router';
import { updateElder } from '../../../services/elderService';
import { safeRouter as router } from '../../../utils/safeRouter';
import { showErrorMessage } from '../../../utils/errorHelper';
import { showDialog } from '../../../utils/dialogService';
import { showSuccessToast } from '../../../utils/toast';
import Logger from '../../../utils/logger';
import { formatDateOnly, parseBirthDate, parseDateOnly } from '../../../utils/date';
import { getThaiPhoneValidationError, sanitizePhoneInput } from '../../../utils/phoneValidation';
import {
  getPositiveNumberValidationError,
  getRequiredTextValidationError,
} from '../../../utils/formValidation';

import { useCurrentElder } from '../../../hooks/useCurrentElder';
import { queryKeys } from '../../../hooks/queryKeys';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { useNavBarInset } from '../../../hooks/useNavBarInset';

import type { AddressData } from '../../../components/CascadingAddressPicker';
import type { Elder } from '../../../services/types';

export default function EditElderInfoScreen() {
  // อ่าน query parameters สำหรับโฟกัสฟิลด์ที่ต้องการ
  const { focus } = useLocalSearchParams<{ focus?: string }>();

  // ใช้ควบคุมการโฟกัสช่องกรอกเบอร์โทรผู้สูงอายุ
  const phoneInputRef = useRef<NativeTextInput>(null);
  const phoneFocusedRef = useRef(false);

  // ใช้สั่ง scroll ตอนสลับฟิลด์ในฟอร์มแก้ไข
  const scrollViewRef = useRef<KeyboardAwareScrollView | null>(null);

  // ใช้จัดการ cache ของ React Query หลังอัปเดตข้อมูลสำเร็จ
  const queryClient = useQueryClient();

  // เพิ่มระยะด้านล่าง ไม่ให้ปุ่มชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // โหลดข้อมูลผู้สูงอายุปัจจุบัน
  const { data: elder, isLoading: isEldersLoading } = useCurrentElder({
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
  });

  // ใช้เตือนผู้ใช้ ถ้าแก้ไขข้อมูลแล้วกดย้อนกลับโดยยังไม่บันทึก
  const { setHasChanges, resetChanges, modalProps } = useUnsavedChanges({
    title: 'ยังไม่ได้บันทึกข้อมูล',
    message: 'คุณมีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?',
  });

  // State ของฟอร์มที่ผู้ใช้แก้ไข
  const [firstName, setFirstName] = useState(() => elder?.firstName || '');
  const [lastName, setLastName] = useState(() => elder?.lastName || '');
  const [gender, setGender] = useState(() => elder?.gender || '');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(() =>
    elder?.dateOfBirth ? parseBirthDate(elder.dateOfBirth) : null,
  );
  const [height, setHeight] = useState(() => (elder?.height ? elder.height.toString() : ''));
  const [weight, setWeight] = useState(() => (elder?.weight ? elder.weight.toString() : ''));
  const [medicalCondition, setMedicalCondition] = useState(() => elder?.diseases ?? '');
  const [phone, setPhone] = useState(() => elder?.phone ?? '');
  const [houseNumber, setHouseNumber] = useState(() => elder?.houseNumber || '');
  const [villageNumber, setVillageNumber] = useState(() => elder?.villageNumber || '');
  const [villageName, setVillageName] = useState(() => elder?.villageName || '');
  const [address, setAddress] = useState<AddressData | null>(() =>
    elder?.subdistrict && elder?.district && elder?.province && elder?.zipcode
      ? {
          district: elder.subdistrict,
          amphoe: elder.district,
          province: elder.province,
          zipcode: elder.zipcode,
        }
      : null,
  );

  // เก็บข้อมูลตั้งต้นไว้เทียบว่าผู้ใช้แก้ไขอะไรหรือไม่
  const [initialValues, setInitialValues] = useState<{
    firstName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    height: string;
    weight: string;
    medicalCondition: string;
    phone: string;
    houseNumber: string;
    villageNumber: string;
    villageName: string;
    address: AddressData | null;
  } | null>(() => {
    if (!elder) return null;
    return {
      firstName: elder.firstName || '',
      lastName: elder.lastName || '',
      gender: elder.gender || '',
      dateOfBirth: elder.dateOfBirth || '',
      height: elder.height ? elder.height.toString() : '',
      weight: elder.weight ? elder.weight.toString() : '',
      medicalCondition: elder.diseases ?? '',
      phone: elder.phone ?? '',
      houseNumber: elder.houseNumber || '',
      villageNumber: elder.villageNumber || '',
      villageName: elder.villageName || '',
      address:
        elder.subdistrict && elder.district && elder.province && elder.zipcode
          ? {
              district: elder.subdistrict,
              amphoe: elder.district,
              province: elder.province,
              zipcode: elder.zipcode,
            }
          : null,
    };
  });

  // ใช้กันการ hydrate ฟอร์มซ้ำจาก elder คนเดิม
  const hydratedElderIdRef = useRef<string | null>(elder?.id || null);

  const isAwaitingHydration = Boolean(elder?.id && initialValues === null);

  useEffect(() => {
    const elderKey = elder?.id ?? '';

    if (!elderKey || !elder) {
      // ถ้ายังไม่มี elder ให้ล้างสถานะ hydrate รอข้อมูลรอบถัดไป
      hydratedElderIdRef.current = null;
      queueMicrotask(() => setInitialValues(null));
      return;
    }

    if (hydratedElderIdRef.current === elderKey) return;

    hydratedElderIdRef.current = elderKey;

    queueMicrotask(() => {
      // นำข้อมูลจาก server มาใส่ในฟอร์ม
      setFirstName(elder.firstName || '');
      setLastName(elder.lastName || '');
      setGender(elder.gender || '');

      if (elder.dateOfBirth) {
        setDateOfBirth(parseBirthDate(elder.dateOfBirth));
      } else {
        setDateOfBirth(null);
      }

      setHeight(elder.height ? elder.height.toString() : '');
      setWeight(elder.weight ? elder.weight.toString() : '');
      setMedicalCondition(elder.diseases ?? '');
      setPhone(elder.phone ?? '');
      setHouseNumber(elder.houseNumber || '');
      setVillageNumber(elder.villageNumber || '');
      setVillageName(elder.villageName || '');

      let initialAddr: AddressData | null = null;

      if (elder.subdistrict && elder.district && elder.province && elder.zipcode) {
        initialAddr = {
          district: elder.subdistrict,
          amphoe: elder.district,
          province: elder.province,
          zipcode: elder.zipcode,
        };

        setAddress(initialAddr);
      } else {
        setAddress(null);
      }

      // เก็บข้อมูลตั้งต้นไว้ใช้ตรวจว่ามีการแก้ไขหรือไม่
      setInitialValues({
        firstName: elder.firstName || '',
        lastName: elder.lastName || '',
        gender: elder.gender || '',
        dateOfBirth: elder.dateOfBirth ? formatDateOnly(parseDateOnly(elder.dateOfBirth)) : '',
        height: elder.height?.toString() || '',
        weight: elder.weight?.toString() || '',
        medicalCondition: elder.diseases || '',
        phone: elder.phone ?? '',
        houseNumber: elder.houseNumber || '',
        villageNumber: elder.villageNumber || '',
        villageName: elder.villageName || '',
        address: initialAddr,
      });
    });
  }, [elder]);

  // คอยตรวจสอบเพื่อโฟกัสช่องกรอกเบอร์โทรศัพท์เมื่อเข้ามาจากหน้า call
  useEffect(() => {
    if (focus === 'phone' && !isAwaitingHydration && !phoneFocusedRef.current) {
      phoneFocusedRef.current = true;
      const timer = setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [focus, isAwaitingHydration]);

  useEffect(() => {
    if (!initialValues) return;

    // เทียบ address ด้วย JSON เพราะเป็น object
    const addressChanged = JSON.stringify(address) !== JSON.stringify(initialValues.address);

    // เช็กว่าค่าในฟอร์มต่างจากค่าเริ่มต้นหรือไม่
    const hasChanged =
      firstName !== initialValues.firstName ||
      lastName !== initialValues.lastName ||
      gender !== initialValues.gender ||
      (dateOfBirth ? formatDateOnly(dateOfBirth) : '') !== initialValues.dateOfBirth ||
      height !== initialValues.height ||
      weight !== initialValues.weight ||
      medicalCondition !== initialValues.medicalCondition ||
      phone !== initialValues.phone ||
      houseNumber !== initialValues.houseNumber ||
      villageNumber !== initialValues.villageNumber ||
      villageName !== initialValues.villageName ||
      addressChanged;

    // ส่งสถานะไปให้ hook ใช้เตือนตอนออกจากหน้า
    setHasChanges(hasChanged);
  }, [
    firstName,
    lastName,
    gender,
    dateOfBirth,
    height,
    weight,
    medicalCondition,
    phone,
    houseNumber,
    villageNumber,
    villageName,
    address,
    initialValues,
    setHasChanges,
  ]);

  // จัดการขั้นตอนบันทึกข้อมูลผู้สูงอายุ
  // เมื่อเรียก mutate() ระบบจะเข้ามาทำงานที่ mutationFn
  const updateMutation = useMutation({
    mutationFn: async (data: unknown) => {
      if (!elder?.id) throw new Error('ไม่พบรหัสผู้สูงอายุ');

      // เรียก service สำหรับอัปเดตข้อมูลผู้สูงอายุ
      // ไฟล์ถัดไป: services/elderService.ts
      return await updateElder(elder.id, data as Parameters<typeof updateElder>[1]);
    },
    onSuccess: (data: Elder) => {
      // อัปเดต cache ทันที เพื่อให้หน้าก่อนหน้าเห็นข้อมูลล่าสุด
      queryClient.setQueryData(queryKeys.currentElder(), data);

      // แสดง Toast สำเร็จทันที (เนื่องจากหน้าจอถูก pop ย้อนกลับเรียบร้อยแล้ว)
      showSuccessToast('บันทึกสำเร็จ');
    },
    onError: (error) => {
      Logger.error('การอัปเดตล้มเหลว:', error);
      showErrorMessage('ข้อผิดพลาด', error);
      // รีเฟรช cache เพื่อดึงข้อมูลจริงจาก Server กลับคืนมา
      queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });
    },
  });

  const handleSave = () => {
    // ปิด keyboard ทันทีที่กดปุ่ม ก่อน navigation เริ่มทำงาน
    Keyboard.dismiss();

    // ตรวจข้อมูลก่อนส่งไปบันทึก
    const firstNameError = getRequiredTextValidationError(firstName, 'กรุณากรอกชื่อผู้สูงอายุ');
    if (firstNameError) return showDialog('กรุณากรอกข้อมูล', firstNameError);

    const lastNameError = getRequiredTextValidationError(lastName, 'กรุณากรอกนามสกุลผู้สูงอายุ');
    if (lastNameError) return showDialog('กรุณากรอกข้อมูล', lastNameError);

    if (!gender) return showDialog('กรุณาเลือกข้อมูล', 'กรุณาเลือกเพศ');
    if (!dateOfBirth) return showDialog('กรุณาเลือกข้อมูล', 'กรุณาระบุวันเกิด');

    const heightError = getPositiveNumberValidationError(height, 'กรุณากรอกส่วนสูงให้ถูกต้อง', {
      integer: true,
    });
    if (heightError) return showDialog('กรุณากรอกข้อมูล', heightError);

    const weightError = getPositiveNumberValidationError(weight, 'กรุณากรอกน้ำหนักให้ถูกต้อง');
    if (weightError) return showDialog('กรุณากรอกข้อมูล', weightError);

    const houseNumberError = getRequiredTextValidationError(houseNumber, 'กรุณากรอกบ้านเลขที่');
    if (houseNumberError) return showDialog('กรุณากรอกข้อมูล', houseNumberError);

    const villageNumberError = getRequiredTextValidationError(villageNumber, 'กรุณากรอกหมู่ที่');
    if (villageNumberError) return showDialog('กรุณากรอกข้อมูล', villageNumberError);

    if (!address || !address.district || !address.province) {
      return showDialog('กรุณากรอกข้อมูล', 'กรุณาเลือกที่อยู่');
    }

    const cleanedPhone = sanitizePhoneInput(phone);
    const phoneError = getThaiPhoneValidationError(cleanedPhone);
    if (phoneError) {
      return showDialog('เบอร์โทรไม่ถูกต้อง', phoneError);
    }

    // รวมข้อมูลที่ผ่าน validation แล้ว เพื่อส่งไป update
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender: gender as 'MALE' | 'FEMALE' | 'OTHER',
      dateOfBirth: formatDateOnly(dateOfBirth),
      height: Number(height),
      weight: Number(weight),
      diseases: medicalCondition.trim() || null,
      phone: cleanedPhone || null,
      houseNumber: houseNumber.trim(),
      villageNumber: villageNumber.trim(),
      villageName: villageName.trim() || null,
      subdistrict: address.district,
      district: address.amphoe,
      province: address.province,
      zipcode: address.zipcode,
    };

    // กดบันทึกแล้ว ไม่ต้องเตือน unsaved changes
    resetChanges();

    // กลับหน้าก่อนหน้าทันทีเพื่อให้ UX ตอบสนองเร็วที่สุดแบบไร้รอยต่อ (Background Mutation)
    router.back();

    // เริ่มอัปเดตข้อมูลผู้สูงอายุ
    // ถัดไปไปที่ updateMutation ด้านบน
    updateMutation.mutate(payload);
  };

  if ((isEldersLoading && !elder) || isAwaitingHydration) {
    return <LoadingScreen useScreenWrapper message="กำลังโหลดข้อมูล..." />;
  }

  return (
    <FormLayout
      paddingBottom={40 + navBarInset}
      header={<ScreenHeader title="" onBack={() => router.back()} />}
      scrollViewRef={scrollViewRef}
    >
      <View className="flex-1">
        <KanitText weight="medium" className="text-[28px] text-gray-900 mb-2">
          แก้ไขข้อมูลผู้สูงอายุ
        </KanitText>
        <KanitText className="text-[15px] text-gray-500 mb-4">
          กรุณากรอกข้อมูลผู้สูงอายุที่ต้องการแก้ไข
        </KanitText>

        <>
          {/* ช่องกรอกชื่อและนามสกุล */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FloatingLabelInput
                label="ชื่อ"
                value={firstName}
                onChangeText={setFirstName}
                isRequired
              />
            </View>
            <View className="flex-1">
              <FloatingLabelInput
                label="นามสกุล"
                value={lastName}
                onChangeText={setLastName}
                isRequired
              />
            </View>
          </View>

          {/* เลือกเพศ */}
          <GenderSelect value={gender} onChange={setGender} isRequired />

          {/* เลือกวันเกิด */}
          <FloatingLabelDatePicker value={dateOfBirth} onChange={setDateOfBirth} isRequired />

          {/* เบอร์โทรผู้สูงอายุ ไม่บังคับกรอก */}
          <View className="mb-2">
            <FloatingLabelInput
              inputRef={phoneInputRef}
              label="เบอร์โทรผู้สูงอายุ (ถ้ามี)"
              value={phone}
              onChangeText={(text) => setPhone(sanitizePhoneInput(text))}
              keyboardType="phone-pad"
              maxLength={10}
              textContentType="telephoneNumber"
              placeholder="เช่น 0812345678"
              containerStyle={{ marginBottom: 4 }}
            />
            <KanitText className="text-xs text-gray-400 px-1">
              * สำหรับโทรตรวจสอบเหตุหกล้มก่อนแจ้งญาติหรือกู้ชีพ
            </KanitText>
          </View>

          {/* ช่องกรอกส่วนสูงและน้ำหนัก */}
          <View className="flex-row gap-3 mt-4">
            <View className="flex-1">
              <FloatingLabelInput
                label="ส่วนสูง (cm)"
                value={height}
                onChangeText={setHeight}
                keyboardType="numeric"
                isRequired
              />
            </View>
            <View className="flex-1">
              <FloatingLabelInput
                label="น้ำหนัก (kg)"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                isRequired
              />
            </View>
          </View>

          {/* โรคประจำตัว ไม่บังคับกรอก */}
          <View>
            <FloatingLabelInput
              label="โรคประจำตัว หรือ เคยป่วย (ถ้ามี)"
              value={medicalCondition}
              onChangeText={setMedicalCondition}
              placeholder="เช่น เบาหวาน, ความดันโลหิตสูง"
            />
          </View>

          {/* ช่องกรอกบ้านเลขที่และหมู่ที่ */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FloatingLabelInput
                label="บ้านเลขที่"
                value={houseNumber}
                onChangeText={setHouseNumber}
                keyboardType="number-pad"
                isRequired
              />
            </View>
            <View className="flex-1">
              <FloatingLabelInput
                label="หมู่ที่"
                value={villageNumber}
                onChangeText={setVillageNumber}
                keyboardType="number-pad"
                isRequired
              />
            </View>
          </View>

          {/* ชื่อหมู่บ้าน ไม่บังคับกรอก */}
          <View>
            <FloatingLabelInput
              label="หมู่บ้าน (ถ้ามี)"
              value={villageName}
              onChangeText={setVillageName}
              placeholder="เช่น หมู่บ้านสุขสันต์"
            />
          </View>

          {/* เลือกตำบล อำเภอ จังหวัด และแสดงรหัสไปรษณีย์ */}
          <View>
            <CascadingAddressPicker value={address} onChange={setAddress} isRequired />
            {address?.zipcode && (
              <View className="mb-4">
                <FloatingLabelInput
                  label="รหัสไปรษณีย์"
                  value={address.zipcode}
                  onChangeText={() => {}}
                  editable={false}
                  keyboardType="number-pad"
                  isRequired
                />
              </View>
            )}
          </View>
        </>

        {/* ปุ่มบันทึกข้อมูลผู้สูงอายุ */}
        <View className="mt-0 mb-8">
          <PrimaryButton
            title="บันทึกข้อมูล"
            onPress={handleSave}
            loading={updateMutation.isPending}
          />
        </View>
      </View>

      {/* Modal เตือนเมื่อมีข้อมูลที่แก้ไขแล้วแต่ยังไม่บันทึก */}
      <ConfirmModal {...modalProps} />
    </FormLayout>
  );
}
