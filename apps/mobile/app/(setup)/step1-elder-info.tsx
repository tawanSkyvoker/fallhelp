/**
 * Step 1 - Elder Info Screen
 *
 * หน้านี้ใช้กรอกข้อมูลผู้สูงอายุใน Setup Flow
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลด draft หรือข้อมูลเดิมของผู้สูงอายุ ถ้ามี
 * - บันทึก draft อัตโนมัติระหว่างกรอกข้อมูล
 * - ตรวจข้อมูลก่อนกดถัดไป
 * - ถ้าข้อมูลถูกต้อง จะสร้างหรืออัปเดตข้อมูลผู้สูงอายุ
 * - เมื่อสำเร็จ จะไปหน้า Step 2: Device Pairing
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Platform, Keyboard } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useMutation } from '@tanstack/react-query';

import KanitText from '../../components/KanitText';
import { GenderSelect } from '../../components/GenderSelect';
import { FloatingLabelInput } from '../../components/FloatingLabelInput';
import { WizardLayout } from '../../components/WizardLayout';
import { PrimaryButton } from '../../components/PrimaryButton';
import { FloatingLabelDatePicker } from '../../components/FloatingLabelDatePicker';
import { CascadingAddressPicker } from '../../components/CascadingAddressPicker';

import { createElder, updateElder, getElder, getCurrentElder } from '../../services/elderService';
import Logger from '../../utils/logger';
import { showErrorMessage } from '../../utils/errorHelper';
import { showDialog } from '../../utils/dialogService';
import {
  getSetupElderId,
  clearSetupElderId,
  setSetupElderId,
  setSetupStep,
  getSetupStep1FormData,
  setSetupStep1FormData,
} from '../../utils/setupStorage';
import { safeRouter as router } from '../../utils/safeRouter';
import { formatDateOnly, parseBirthDate, parseDateOnly } from '../../utils/date';
import { getThaiPhoneValidationError, sanitizePhoneInput } from '../../utils/phoneValidation';
import {
  getPositiveNumberValidationError,
  getRequiredTextValidationError,
} from '../../utils/formValidation';

import type { AddressData } from '../../components/CascadingAddressPicker';
import type { CreateElderPayload } from '../../services/elderService';

// ใช้เทียบว่าข้อมูลใหม่ต่างจากข้อมูลเดิมหรือไม่
// ถ้าไม่ต่าง จะข้ามการ update แล้วไป Step 2 ได้เลย
const isDataEqual = (obj1: Record<string, unknown>, obj2: Record<string, unknown>): boolean => {
  if (!obj1 || !obj2) return obj1 === obj2;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  return keys1.every((key) => {
    const val1 = obj1[key];
    const val2 = obj2[key];

    // ถ้า field เป็น array ให้เทียบทีละตำแหน่ง
    if (Array.isArray(val1) && Array.isArray(val2)) {
      return val1.length === val2.length && val1.every((item, index) => item === val2[index]);
    }

    return val1 === val2;
  });
};

export default function Step1ElderInfoScreen() {
  // เก็บข้อมูลผู้สูงอายุที่ผู้ใช้กรอกในฟอร์ม
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [, setShowDatePicker] = useState(false);

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [medicalCondition, setMedicalCondition] = useState('');
  const [phone, setPhone] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [villageNumber, setVillageNumber] = useState('');
  const [villageName, setVillageName] = useState('');
  const [address, setAddress] = useState<AddressData | null>(null);

  // ใช้บอกว่าโหลด draft เสร็จแล้วหรือยัง
  // ถ้ายังโหลดไม่เสร็จ จะยังไม่ auto-save เพื่อกันเขียนทับ draft เดิมด้วยค่าว่าง
  const [isLoaded, setIsLoaded] = useState(false);

  // ใช้สั่ง scroll ตอนเลือกที่อยู่ครบแล้ว
  const scrollViewRef = useRef<KeyboardAwareScrollView | null>(null);

  // ป้องกันการ scroll ไปท้ายฟอร์มเมื่อโหลด draft ที่มีที่อยู่ครบอยู่แล้ว
  // ควร scroll เฉพาะเมื่อผู้ใช้เลือกที่อยู่ใหม่เท่านั้น ไม่ใช่ตอน mount
  const hasZipScrolledRef = useRef<boolean>(false);

  interface ElderInitialData {
    firstName?: string;
    lastName?: string;
    name?: string;
    gender?: string;
    dateOfBirth?: string;
    height?: number | string;
    weight?: number | string;
    medicalCondition?: string;
    phone?: string;
    houseNumber?: string;
    villageNumber?: string;
    villageName?: string;
    address?: {
      district?: string;
      amphoe?: string;
      province?: string;
      zipcode?: string;
    };
  }

  // เก็บข้อมูลเดิมไว้เทียบกับข้อมูลที่ผู้ใช้แก้ใหม่
  const [initialData, setInitialData] = useState<ElderInitialData | null>(null);

  useEffect(() => {
    const loadFormData = async () => {
      try {
        // โหลด AsyncStorage ทั้งสองค่าพร้อมกัน ไม่ต้องรอทีละตัว
        const [rawElderId, savedData] = await Promise.all([
          getSetupElderId(),
          getSetupStep1FormData(),
        ]);

        // กันค่าค้างที่เคยถูกบันทึกผิดเป็น string
        let existingElderId = rawElderId;
        if (existingElderId === 'undefined' || existingElderId === 'null') {
          existingElderId = null;
        }

        Logger.debug('Step 1 loadFormData: existingElderId =', existingElderId);

        if (savedData) {
          const parsed = JSON.parse(savedData);

          // คืนค่าข้อมูลจาก draft กลับเข้า form
          setFirstName(parsed.firstName || (parsed.name ? parsed.name.split(' ')[0] : ''));
          setLastName(
            parsed.lastName || (parsed.name ? parsed.name.split(' ').slice(1).join(' ') : ''),
          );
          setGender(parsed.gender || '');

          if (parsed.dateOfBirth) {
            setDateOfBirth(parseBirthDate(parsed.dateOfBirth));
          } else {
            setDateOfBirth(null);
          }

          setHeight(parsed.height || '');
          setWeight(parsed.weight || '');
          setMedicalCondition(parsed.medicalCondition || '');
          setPhone(parsed.phone || '');
          setHouseNumber(parsed.houseNumber || '');
          setVillageNumber(parsed.villageNumber || '');
          setVillageName(parsed.villageName || '');

          // ถ้า draft ที่อยู่ครบทุก field ค่อยนำกลับมาใช้
          const addr = parsed.address;
          if (addr && addr.district && addr.amphoe && addr.province && addr.zipcode) {
            setAddress(addr);
          } else {
            setAddress(null);
          }

          if (existingElderId) {
            // มี elder เดิมอยู่แล้ว จึงเก็บ draft ไว้เทียบตอนกดถัดไป
            setInitialData(parsed);
            Logger.debug('Step 1: Set initialData for existing elder');
          } else {
            Logger.debug('Step 1: No elderId, will create new elder');
          }
        }
      } catch (error) {
        Logger.error('Failed to load form data:', error);
      } finally {
        // โหลดข้อมูล local เสร็จแล้ว ฟอร์มแสดงผลได้ทันที
        setIsLoaded(true);
      }

      // ตรวจสอบความถูกต้องของ Elder ID กับ Server ใน background
      // ทำหลัง setIsLoaded(true) เพื่อไม่บล็อกการแสดงฟอร์ม
      // ผลลัพธ์มีผลตอนกด handleNext เท่านั้น ไม่กระทบ UI ระหว่างกรอก
      try {
        const rawId = await getSetupElderId();
        const idToCheck = rawId === 'undefined' || rawId === 'null' || !rawId ? null : rawId;

        if (idToCheck) {
          try {
            await getElder(idToCheck);
            Logger.debug('Step 1 bg-check: Elder ID valid on server', idToCheck);
          } catch {
            Logger.warn('Step 1 bg-check: Elder ID invalid, clearing');
            await clearSetupElderId();
          }
        }
      } catch (bgError) {
        Logger.warn('Step 1 bg-check error (non-blocking)', bgError);
      }
    };

    loadFormData();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const saveFormData = async () => {
      try {
        // รวมข้อมูลปัจจุบันของฟอร์มไว้เป็น draft
        const currentFormData = {
          firstName,
          lastName,
          gender,
          dateOfBirth: dateOfBirth ? formatDateOnly(dateOfBirth) : null,
          height,
          weight,
          medicalCondition,
          phone,
          houseNumber,
          villageNumber,
          villageName,
          address,
        };

        // บันทึก draft ของ Step 1 ลง setup storage
        await setSetupStep1FormData(JSON.stringify(currentFormData));
      } catch (error) {
        Logger.error('Failed to save form data:', error);
      }
    };

    // รอ 500ms หลังผู้ใช้หยุดพิมพ์ แล้วค่อย save draft
    const timeoutId = setTimeout(saveFormData, 500);

    return () => clearTimeout(timeoutId);
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
    isLoaded,
  ]);

  useEffect(() => {
    if (!address?.zipcode) return;

    // ครั้งแรกที่ effect นี้ทำงานหลัง mount คือตอนโหลด draft ที่มีที่อยู่ครบอยู่แล้ว
    // ให้ mark ว่าเคยเห็น zipcode แล้ว แต่ยังไม่ต้อง scroll ลงล่าง
    // ครั้งถัดไปที่ zipcode เปลี่ยน แสดงว่าผู้ใช้เลือกที่อยู่ใหม่จริงๆ ค่อย scroll
    if (!hasZipScrolledRef.current) {
      hasZipScrolledRef.current = true;
      return;
    }

    // เมื่อผู้ใช้เลือกที่อยู่ใหม่ครบแล้ว ให้เลื่อนลงไปท้ายฟอร์มเพื่อเห็น zipcode
    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd(true);
    }, 150);

    return () => clearTimeout(timeout);
  }, [address?.zipcode]);

  // จัดการขั้นตอนสร้างหรืออัปเดตข้อมูลผู้สูงอายุ
  // เมื่อเรียก mutate() ระบบจะเข้ามาทำงานที่ mutationFn
  const saveElderMutation = useMutation({
    mutationFn: async (data: CreateElderPayload) => {
      // อ่าน elderId ที่เคยบันทึกไว้ในเครื่อง
      let existingElderId = await getSetupElderId();

      // กันค่าค้างที่เคยถูกบันทึกผิดเป็น string
      if (existingElderId === 'undefined' || existingElderId === 'null') {
        existingElderId = null;
        await clearSetupElderId();
      }

      // ถ้าในเครื่องไม่มี elderId ให้ลองถาม Server ว่ามี elder อยู่แล้วหรือไม่
      if (!existingElderId) {
        try {
          // ดึง elder ปัจจุบันจาก service
          // ไฟล์ถัดไป: services/elderService.ts
          const currentElder = await getCurrentElder();

          if (currentElder) {
            existingElderId = currentElder.id;
            Logger.info(
              'Found existing elder on server (was lost locally). Resuming with ID:',
              existingElderId,
            );

            // บันทึก elderId กลับเข้า setup storage เพื่อใช้ใน step ถัดไป
            await setSetupElderId(existingElderId);
          }
        } catch (err) {
          Logger.warn('Could not check current elder on server before creation', err);
        }
      }

      if (existingElderId) {
        Logger.info('Updating existing elder:', existingElderId);

        // มี elderId แล้ว จึงอัปเดตข้อมูลผู้สูงอายุ
        // ไฟล์ถัดไป: services/elderService.ts
        return await updateElder(existingElderId, data);
      } else {
        Logger.info('Creating new elder');

        // ยังไม่มี elderId จึงสร้างข้อมูลผู้สูงอายุใหม่
        // ไฟล์ถัดไป: services/elderService.ts
        return await createElder(data);
      }
    },
    onSuccess: async (elder) => {
      // บันทึก elderId เพื่อให้ Step 2 และ Step 3 ใช้ต่อ
      await setSetupElderId(String(elder.id));
      await setSetupStep('2');

      // ไป Step 2: Device Pairing
      router.push('/(setup)/step2-device-pairing');
    },
    onError: (error: unknown) => {
      // บันทึกข้อมูลผู้สูงอายุไม่สำเร็จ ให้แสดง error
      Logger.error('Save elder error:', error);
      showErrorMessage('ข้อผิดพลาด', error);
    },
  });

  const handleNext = async () => {
    // ปิด keyboard ทันทีที่กดปุ่ม ก่อน navigation เริ่มทำงาน
    Keyboard.dismiss();

    // เริ่มจากตรวจข้อมูลในหน้านี้ก่อน

    const firstNameError = getRequiredTextValidationError(firstName, 'กรุณากรอกชื่อผู้สูงอายุ');
    if (firstNameError) {
      showDialog('กรุณากรอกข้อมูล', firstNameError);
      return;
    }

    const lastNameError = getRequiredTextValidationError(lastName, 'กรุณากรอกนามสกุลผู้สูงอายุ');
    if (lastNameError) {
      showDialog('กรุณากรอกข้อมูล', lastNameError);
      return;
    }

    if (!gender) {
      showDialog('กรุณาเลือกข้อมูล', 'กรุณาเลือกเพศ');
      return;
    }

    if (!dateOfBirth) {
      showDialog('กรุณาเลือกข้อมูล', 'กรุณาระบุวันเกิด');
      return;
    }

    const heightError = getPositiveNumberValidationError(height, 'กรุณากรอกส่วนสูงให้ถูกต้อง', {
      integer: true,
    });
    if (heightError) {
      showDialog('กรุณากรอกข้อมูล', heightError);
      return;
    }

    const weightError = getPositiveNumberValidationError(weight, 'กรุณากรอกน้ำหนักให้ถูกต้อง');
    if (weightError) {
      showDialog('กรุณากรอกข้อมูล', weightError);
      return;
    }

    const houseNumberError = getRequiredTextValidationError(houseNumber, 'กรุณากรอกบ้านเลขที่');
    if (houseNumberError) {
      showDialog('กรุณากรอกข้อมูล', houseNumberError);
      return;
    }

    const villageNumberError = getRequiredTextValidationError(villageNumber, 'กรุณากรอกหมู่ที่');
    if (villageNumberError) {
      showDialog('กรุณากรอกข้อมูล', villageNumberError);
      return;
    }

    if (!address || !address.district || !address.province) {
      showDialog('กรุณากรอกข้อมูล', 'กรุณาเลือกที่อยู่');
      return;
    }

    const cleanedPhone = sanitizePhoneInput(phone);
    const phoneError = getThaiPhoneValidationError(cleanedPhone);
    if (phoneError) {
      showDialog('เบอร์โทรไม่ถูกต้อง', phoneError);
      return;
    }

    // รวมข้อมูลที่ผ่าน validation แล้ว เพื่อส่งให้ mutation
    const currentData = {
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

    // ถ้ามี elder เดิม ให้เช็กว่าข้อมูลเปลี่ยนจริงหรือไม่
    const existingElderId = await getSetupElderId();

    if (existingElderId && existingElderId !== 'undefined' && existingElderId !== 'null') {
      if (initialData) {
        // แปลงข้อมูลเดิมให้อยู่รูปแบบเดียวกับ currentData ก่อนเทียบ
        const initialDataFormatted = {
          firstName:
            initialData.firstName || (initialData.name ? initialData.name.split(' ')[0] : ''),
          lastName:
            initialData.lastName ||
            (initialData.name ? initialData.name.split(' ').slice(1).join(' ') : ''),
          gender: initialData.gender,
          dateOfBirth: initialData.dateOfBirth
            ? formatDateOnly(parseDateOnly(initialData.dateOfBirth))
            : null,
          height: Number(initialData.height),
          weight: Number(initialData.weight),
          diseases: initialData.medicalCondition?.trim() || null,
          phone: sanitizePhoneInput(initialData.phone || '') || null,
          houseNumber: initialData.houseNumber || '',
          villageNumber: initialData.villageNumber || '',
          villageName: initialData.villageName || null,
          subdistrict: initialData.address?.district || '',
          district: initialData.address?.amphoe || '',
          province: initialData.address?.province || '',
          zipcode: initialData.address?.zipcode || '',
        };

        if (isDataEqual(currentData, initialDataFormatted)) {
          Logger.info('Data unchanged, skipping update and going to Step 2');

          // ข้อมูลไม่เปลี่ยน จึงไม่ต้อง update
          // ถัดไปไปหน้า Step 2
          await setSetupStep('2');
          router.push('/(setup)/step2-device-pairing');
          return;
        }
      } else {
        // มี elderId แล้ว แต่ไม่มีข้อมูลเดิมไว้เทียบ
        // ถัดไปไปหน้า Step 2 โดยไม่ update
        Logger.info('Elder exists but no initialData, proceeding to Step 2');
        await setSetupStep('2');
        router.push('/(setup)/step2-device-pairing');
        return;
      }
    }

    // เริ่มสร้างหรืออัปเดตข้อมูลผู้สูงอายุ
    // ถัดไปไปที่ saveElderMutation ด้านบน
    saveElderMutation.mutate(currentData);
  };

  const handleBack = () => {
    // ถ้าย้อนกลับได้ ให้ย้อนกลับหน้าก่อนหน้า
    if (router.canGoBack()) {
      router.back();
    } else {
      // ถ้าย้อนกลับไม่ได้ ให้กลับไปหน้าเริ่ม Setup
      router.replace('/(setup)/empty-state');
    }
  };

  const _onDateChange = (event: unknown, selectedDate?: Date) => {
    const currentDate = selectedDate || dateOfBirth || new Date();

    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    setDateOfBirth(currentDate);
  };

  return (
    <WizardLayout
      currentStep={1}
      title="ข้อมูลผู้สูงอายุ"
      onBack={handleBack}
      scrollViewRef={scrollViewRef}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingBottom: 80,
      }}
      scrollViewProps={{
        bounces: false,
        overScrollMode: 'never',
        showsVerticalScrollIndicator: true,
        keyboardShouldPersistTaps: 'always',
        extraHeight: 160,
      }}
    >
      <View>
        {/* แถบแจ้งเรื่องความเป็นส่วนตัวของข้อมูล */}
        <View className="bg-blue-50 rounded-2xl p-4 mb-6 mt-4">
          <KanitText className="text-sm text-blue-700">
            กรอกข้อมูลผู้สูงอายุเพื่อการดูแลที่เหมาะสม ข้อมูลทั้งหมดจะถูกเก็บรักษาเป็นความลับ
          </KanitText>
        </View>

        <View className="mb-2">
          {/* ช่องกรอกชื่อและนามสกุล */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FloatingLabelInput
                label="ชื่อ"
                value={firstName}
                onChangeText={setFirstName}
                isRequired={true}
              />
            </View>
            <View className="flex-1">
              <FloatingLabelInput
                label="นามสกุล"
                value={lastName}
                onChangeText={setLastName}
                isRequired={true}
              />
            </View>
          </View>

          {/* เลือกเพศของผู้สูงอายุ */}
          <View>
            <GenderSelect value={gender} onChange={setGender} isRequired={true} />
          </View>

          {/* เลือกวันเกิดของผู้สูงอายุ */}
          <View>
            <FloatingLabelDatePicker
              value={dateOfBirth}
              onChange={(date) => {
                Keyboard.dismiss();
                setDateOfBirth(date);
              }}
              isRequired={true}
            />
          </View>

          {/* เบอร์โทรผู้สูงอายุ — ใช้แสดงเป็นลำดับที่ 1 ในหน้าโทรฉุกเฉิน */}
          <View className="mb-2">
            <FloatingLabelInput
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
                isRequired={true}
              />
            </View>
            <View className="flex-1">
              <FloatingLabelInput
                label="น้ำหนัก (kg)"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                isRequired={true}
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
                isRequired={true}
              />
            </View>
            <View className="flex-1">
              <FloatingLabelInput
                label="หมู่ที่"
                value={villageNumber}
                onChangeText={setVillageNumber}
                keyboardType="number-pad"
                isRequired={true}
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
            {address?.zipcode ? (
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
            ) : null}
          </View>
        </View>

        {/* ปุ่มไป Step 2 */}
        <View className="mt-0 mb-4">
          <PrimaryButton title="ถัดไป" onPress={handleNext} loading={saveElderMutation.isPending} />
        </View>
      </View>
    </WizardLayout>
  );
}
