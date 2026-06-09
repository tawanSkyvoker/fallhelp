/**
 * Elder Info Screen
 *
 * หน้านี้ใช้แสดงข้อมูลผู้สูงอายุ
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลผู้สูงอายุปัจจุบัน
 * - แสดงข้อมูลพื้นฐาน เช่น ชื่อ เพศ วันเกิด ส่วนสูง น้ำหนัก
 * - แสดงโรคประจำตัวและที่อยู่
 * - ดึงข้อมูลใหม่อัตโนมัติทุกครั้งที่เปิดหน้า
 * - มีปุ่มไปหน้าแก้ไขข้อมูลผู้สูงอายุ
 */

import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIconSolid } from '../../../components/MaterialIconSolid';

import KanitText from '../../../components/KanitText';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { PrimaryButton } from '../../../components/PrimaryButton';

import { useFocusEffect } from 'expo-router';

import { safeRouter as router } from '../../../utils/safeRouter';
import { parseBirthDate } from '../../../utils/date';

import { useNavBarInset } from '../../../hooks/useNavBarInset';
import { useCurrentElder } from '../../../hooks/useCurrentElder';

// คำนวณอายุจากวันเกิด
// รองรับข้อมูลวันที่ทั้ง ค.ศ. และ พ.ศ. ผ่าน parseBirthDate()
const calculateAge = (dateOfBirth: string | null | undefined): number => {
  if (!dateOfBirth) return 0;

  const today = new Date();
  const birthDate = parseBirthDate(dateOfBirth);
  const birthYear = birthDate.getFullYear();
  const currentYear = today.getFullYear();

  let age = currentYear - birthYear;

  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age < 0 ? 0 : age;
};

// แปลงวันที่เป็นรูปแบบภาษาไทยสำหรับแสดงผล
const formatThaiDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'ไม่ระบุ';

  const date = parseBirthDate(dateString);

  const thaiMonths = [
    'มกราคม',
    'กุมภาพันธ์',
    'มีนาคม',
    'เมษายน',
    'พฤษภาคม',
    'มิถุนายน',
    'กรกฎาคม',
    'สิงหาคม',
    'กันยายน',
    'ตุลาคม',
    'พฤศจิกายน',
    'ธันวาคม',
  ];

  const day = date.getDate().toString().padStart(2, '0');
  const month = thaiMonths[date.getMonth()];

  let year = date.getFullYear();

  // ถ้าเป็นปี ค.ศ. ให้แปลงเป็น พ.ศ. ตอนแสดงผล
  if (year <= 2400) {
    year += 543;
  }

  return `${day} ${month} ${year}`;
};

// แปลงค่า gender จาก Backend ให้เป็นข้อความภาษาไทย
const getGenderText = (gender: string | null | undefined): string => {
  if (!gender) return 'ไม่ระบุ';

  switch (gender) {
    case 'MALE':
      return 'ชาย';
    case 'FEMALE':
      return 'หญิง';
    case 'OTHER':
      return 'อื่นๆ';
    default:
      return 'ไม่ระบุ';
  }
};

export default function ElderInfoScreen() {
  // เพิ่มระยะด้านล่าง ไม่ให้ปุ่มหรือ content ชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // กันกดปุ่มแก้ไขข้อมูลซ้ำ รีเซ็ตเมื่อ screen focus กลับมา
  const [isEditing, setIsEditing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsEditing(false);
    }, []),
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    // ถ้าย้อนกลับไม่ได้ ให้กลับ Dashboard
    router.replace('/(tabs)/dashboard');
  }, []);

  // โหลดข้อมูลผู้สูงอายุปัจจุบัน — ดึงอัตโนมัติทุกครั้งที่เปิดหน้า ไม่ต้องดึงเอง
  const {
    data: elder,
    isLoading,
    isError,
    refetch,
  } = useCurrentElder({
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const isInitialLoading = isLoading && !elder;

  if (isInitialLoading) {
    return <LoadingScreen useScreenWrapper message="กำลังโหลดข้อมูล..." />;
  }

  if (isError) {
    return (
      <ScreenWrapper
        edges={['top']}
        useScrollView={false}
        header={<ScreenHeader title="ข้อมูลผู้สูงอายุ" onBack={handleBack} />}
      >
        <View className="flex-1 justify-center items-center">
          <KanitText className="text-red-500 mb-4">เกิดข้อผิดพลาดในการโหลดข้อมูล</KanitText>

          {/* โหลดข้อมูลใหม่อีกครั้ง */}
          <TouchableOpacity onPress={() => refetch()} className="bg-gray-200 p-3 rounded-lg">
            <KanitText>ลองใหม่</KanitText>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  if (!elder) {
    return (
      <ScreenWrapper
        edges={['top']}
        useScrollView={false}
        header={<ScreenHeader title="ข้อมูลผู้สูงอายุ" onBack={handleBack} />}
      >
        <View className="flex-1 justify-center items-center px-6">
          <MaterialIconSolid name="person" size={64} color="#D1D5DB" />

          <KanitText className="text-lg text-gray-700 mt-4 text-center">
            ไม่พบข้อมูลผู้สูงอายุ
          </KanitText>

          <KanitText className="text-gray-500 mt-2 text-center">
            กรุณาเพิ่มข้อมูลผู้สูงอายุในระบบเพื่อเริ่มต้นการใช้งาน
          </KanitText>
        </View>
      </ScreenWrapper>
    );
  }

  const age = calculateAge(elder.dateOfBirth);

  return (
    <ScreenWrapper
      edges={['top']}
      useScrollView={false}
      style={{ backgroundColor: '#FFFFFF' }}
      header={<ScreenHeader title="ข้อมูลผู้สูงอายุ" onBack={handleBack} />}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 + navBarInset }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-4">
          <View className="bg-white rounded-[24px] shadow-sm border border-gray-100 mb-6">
            <View className="rounded-[24px] overflow-hidden">
              {/* ชื่อและนามสกุลของผู้สูงอายุ */}
              <View className="p-4 border-b border-gray-100">
                <KanitText className="text-sm text-gray-500 mb-1">ชื่อ-นามสกุล</KanitText>
                <KanitText className="text-lg text-gray-900">
                  {elder.firstName} {elder.lastName}
                </KanitText>
              </View>

              {/* เบอร์โทรผู้สูงอายุ */}
              <View className="p-4 border-b border-gray-100">
                <KanitText className="text-sm text-gray-500 mb-1">เบอร์โทรผู้สูงอายุ</KanitText>
                {elder.phone ? (
                  <KanitText className="text-lg text-gray-900">{elder.phone}</KanitText>
                ) : (
                  <KanitText className="text-lg text-gray-400">
                    ยังไม่ได้ระบุเบอร์โทรศัพท์
                  </KanitText>
                )}
                <KanitText className="text-xs text-gray-400 mt-1">
                  * สำหรับโทรตรวจสอบเหตุหกล้มก่อนแจ้งญาติหรือกู้ชีพ
                </KanitText>
              </View>

              {/* เพศและวันเกิด */}
              <View className="flex-row border-b border-gray-100">
                <View className="flex-1 p-4 border-r border-gray-100">
                  <KanitText className="text-sm text-gray-500 mb-1">เพศ</KanitText>
                  <KanitText className="text-lg text-gray-900">
                    {getGenderText(elder.gender)}
                  </KanitText>
                </View>

                <View className="flex-1 p-4">
                  <KanitText className="text-sm text-gray-500 mb-1">วัน/เดือน/ปีเกิด</KanitText>
                  <KanitText className="text-lg text-gray-900">
                    {formatThaiDate(elder.dateOfBirth)}
                  </KanitText>

                  {age > 0 && (
                    <KanitText className="text-sm text-gray-500 mt-1">({age} ปี)</KanitText>
                  )}
                </View>
              </View>

              {/* ส่วนสูงและน้ำหนัก */}
              <View className="flex-row border-b border-gray-100">
                <View className="flex-1 p-4 border-r border-gray-100">
                  <KanitText className="text-sm text-gray-500 mb-1">ส่วนสูง</KanitText>
                  <KanitText className="text-lg text-gray-900">
                    {elder.height ? `${elder.height} cm` : 'ไม่ระบุ'}
                  </KanitText>
                </View>

                <View className="flex-1 p-4">
                  <KanitText className="text-sm text-gray-500 mb-1">น้ำหนัก</KanitText>
                  <KanitText className="text-lg text-gray-900">
                    {elder.weight ? `${elder.weight} kg` : 'ไม่ระบุ'}
                  </KanitText>
                </View>
              </View>

              {/* โรคประจำตัว */}
              <View className="p-4 border-b border-gray-100">
                <KanitText className="text-sm text-gray-500 mb-1">โรคประจำตัว</KanitText>
                <KanitText className="text-lg text-gray-900">{elder.diseases || 'ไม่มี'}</KanitText>
              </View>

              {/* ที่อยู่ */}
              <View className="p-4">
                <KanitText className="text-sm text-gray-500 mb-1">ที่อยู่</KanitText>
                <KanitText className="text-lg text-gray-900">
                  {(() => {
                    const addressParts = [];

                    if (elder.houseNumber) addressParts.push(elder.houseNumber);
                    if (elder.villageNumber) addressParts.push(`หมู่ที่ ${elder.villageNumber}`);
                    if (elder.villageName) addressParts.push(`หมู่บ้าน${elder.villageName}`);
                    if (elder.subdistrict) addressParts.push(`ตำบล${elder.subdistrict}`);
                    if (elder.district) addressParts.push(`อำเภอ${elder.district}`);
                    if (elder.province) addressParts.push(`จังหวัด${elder.province}`);
                    if (elder.zipcode) addressParts.push(elder.zipcode);

                    return addressParts.length > 0 ? addressParts.join(' ') : 'ไม่ระบุ';
                  })()}
                </KanitText>
              </View>
            </View>
          </View>

          {/* ไปหน้าแก้ไขข้อมูลผู้สูงอายุ */}
          <PrimaryButton
            title="แก้ไขข้อมูล"
            variant="outline"
            disabled={isEditing}
            onPress={() => {
              if (isEditing) return;
              setIsEditing(true);
              router.push('/(features)/(elder)/edit');
            }}
          />
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
