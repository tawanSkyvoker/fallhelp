/**
 * Emergency Call Screen
 *
 * หน้านี้ใช้สำหรับโทรหาผู้ติดต่อฉุกเฉิน
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลผู้สูงอายุปัจจุบัน
 * - โหลดรายชื่อผู้ติดต่อฉุกเฉินของผู้สูงอายุ
 * - แสดงผู้ติดต่อ 3 อันดับแรกตามลำดับ priority
 * - แตะรายชื่อเพื่อเปิดแอปโทรศัพท์ของเครื่อง
 * - มีปุ่มโทรเบอร์ฉุกเฉินสาธารณะ 1669
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Linking,
  Dimensions,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { MaterialSymbol } from '../../../components/MaterialSymbol';
import { MaterialIconSolid } from '../../../components/MaterialIconSolid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';

import KanitText from '../../../components/KanitText';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { Bounceable } from '../../../components/Bounceable';
import { ListItemSkeleton } from '../../../components/skeletons';

import { safeRouter as router } from '../../../utils/safeRouter';
import { listContacts } from '../../../services/emergencyContactService';
import Logger from '../../../utils/logger';
import { showDialog } from '../../../utils/dialogService';

import { useCurrentElder } from '../../../hooks/useCurrentElder';
import { queryKeys } from '../../../hooks/queryKeys';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EmergencyContact } from '../../../services/types';

export default function EmergencyCallScreen() {
  // ใช้จัดการ cache ของ React Query
  const queryClient = useQueryClient();

  // กันการนำทางซ้อนเมื่อกดปุ่มเร็วๆ
  const [isNavigating, setIsNavigating] = useState(false);

  // คำนวณระยะด้านล่างให้ปุ่ม 1669 ไม่ชน Navigation Bar ของเครื่อง
  const { bottom } = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  const androidNavBarHeight =
    Platform.OS === 'android' ? Math.max(0, screenHeight - windowHeight - statusBarHeight) : 0;
  const navBarInset = bottom > 0 ? bottom : androidNavBarHeight;
  const footerPaddingBottom = 32 + navBarInset;

  // โหลดข้อมูลผู้สูงอายุปัจจุบัน
  // ใช้ elderId ไปดึงรายชื่อผู้ติดต่อฉุกเฉิน
  const { data: currentElder, isLoading: isEldersLoading } = useCurrentElder();

  const currentElderId = currentElder?.id;

  // ถ้ามี currentElder แปลว่าผู้ใช้มีสิทธิ์จัดการรายชื่อผู้ติดต่อ
  const isOwner = !!currentElder;

  // อ่าน cache รายชื่อผู้ติดต่อเดิมมาใช้ก่อน
  // ช่วยลดอาการหน้ากระพริบตอนกลับเข้าหน้านี้
  const cachedContacts = queryClient.getQueryData<EmergencyContact[]>(
    queryKeys.emergencyContacts(currentElderId),
  );

  // โหลดรายชื่อผู้ติดต่อฉุกเฉินของผู้สูงอายุ
  const { data: contacts, isLoading: isContactsLoading } = useQuery<EmergencyContact[]>({
    queryKey: queryKeys.emergencyContacts(currentElderId),

    // เรียก service สำหรับดึงรายชื่อผู้ติดต่อฉุกเฉิน
    // ไฟล์ถัดไป: services/emergencyContactService.ts
    queryFn: () => listContacts(currentElderId!),

    // มี elderId แล้วถึงค่อยยิง query
    enabled: !!currentElderId,

    ...(cachedContacts !== undefined ? { placeholderData: cachedContacts } : {}),

    // ข้อมูลผู้ติดต่อฉุกเฉินให้สดพอสมควร แต่ไม่ต้อง refetch ถี่เกินไป
    staleTime: 30_000,
  });

  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);

      // รีเฟรชข้อมูลผู้สูงอายุ เพื่อให้สถานะสิทธิ์และข้อมูลล่าสุดตรงกับ server
      queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });
    }, [queryClient]),
  );

  // แสดงเฉพาะ 3 รายชื่อแรก
  // ลำดับนี้มาจาก priority ที่ backend/service คืนมา
  const topContacts = contacts ? contacts.slice(0, 3) : [];

  // รอให้ elder และ contacts พร้อมก่อน
  // กันไม่ให้ empty state กระพริบตอนเปิดหน้า
  const isDataLoading = isEldersLoading || isContactsLoading;

  const handleCall = async (phoneNumber: string) => {
    const url = `tel:${phoneNumber}`;

    try {
      // ตรวจว่าเครื่องนี้เปิด dialer ได้หรือไม่
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        // เปิดแอปโทรศัพท์ของเครื่อง
        await Linking.openURL(url);
      } else {
        showDialog('ไม่สามารถโทรออกได้', 'อุปกรณ์นี้ไม่รองรับการโทรออก');
      }
    } catch (error) {
      Logger.error('Call error:', error);
      showDialog('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโทรออก');
    }
  };

  return (
    <ScreenWrapper
      edges={['top']}
      useScrollView={false}
      style={{ backgroundColor: '#FFFFFF' }}
      header={
        <ScreenHeader
          title="โทรฉุกเฉิน"
          onBack={() => router.back()}
          rightElement={<View style={{ width: 40 }} />}
        />
      }
    >
      <View className="flex-1 px-6 pt-4 pb-2">
        {isOwner && topContacts && topContacts.length > 0 && (
          <View className="bg-white rounded-[24px] shadow-sm border border-gray-100 mb-4">
            <View className="rounded-[24px] overflow-hidden">
              <Bounceable
                onPress={() => {
                  if (isNavigating) return;
                  setIsNavigating(true);
                  // ไปหน้าจัดการรายชื่อผู้ติดต่อฉุกเฉิน
                  // ถัดไปไปที่ contacts.tsx
                  router.push('/(features)/(emergency)/contacts');
                }}
                disabled={isNavigating}
                scale={1}
                className="bg-white p-5 active:bg-gray-50"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-3">
                      <MaterialIconSolid name="contact_phone" size={22} color="#898989" />
                    </View>

                    <View className="flex-1">
                      <KanitText className="text-lg text-gray-900">จัดการเบอร์ฉุกเฉิน</KanitText>
                      <KanitText className="text-base text-gray-400">
                        เพิ่ม/แก้ไข/จัดลำดับผู้ติดต่อ
                      </KanitText>
                    </View>
                  </View>

                  <MaterialSymbol name="chevron_right" size={24} color="#9CA3AF" />
                </View>
              </Bounceable>
            </View>
          </View>
        )}

        {/* Zone 1: เบอร์ผู้สูงอายุ — แสดงเสมอเมื่อมีผู้สูงอายุในระบบ */}
        {currentElder && (
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <KanitText className="text-base text-gray-800">โทรหาผู้สูงอายุ</KanitText>

              {currentElder.phone ? (
                <TouchableOpacity
                  onPress={() => {
                    if (isNavigating) return;
                    setIsNavigating(true);
                    router.push({
                      pathname: '/(features)/(elder)/edit',
                      params: { focus: 'phone' },
                    });
                  }}
                  disabled={isNavigating}
                  className="flex-row items-center"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <KanitText className="text-sm text-gray-400">แก้ไขเบอร์</KanitText>
                  <MaterialSymbol name="chevron_right" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    if (isNavigating) return;
                    setIsNavigating(true);
                    router.push({
                      pathname: '/(features)/(elder)/edit',
                      params: { focus: 'phone' },
                    });
                  }}
                  disabled={isNavigating}
                  className="flex-row items-center bg-green-50 px-2.5 py-1 rounded-full active:bg-green-100"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <KanitText className="text-xs text-green-700 font-kanit">เพิ่มเบอร์</KanitText>
                  <MaterialSymbol name="add" size={14} color="#15803D" style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              )}
            </View>

            {currentElder.phone ? (
              <Bounceable
                onPress={() => handleCall(currentElder.phone!)}
                className="bg-white px-4 py-4 rounded-3xl border border-gray-100 shadow-sm flex-row items-center justify-between"
                scale={0.97}
              >
                <View className="flex-row items-center gap-4 flex-1 pr-2">
                  <View className="w-11 h-11 rounded-full bg-green-50 items-center justify-center flex-shrink-0">
                    <MaterialIconSolid name="elderly" size={22} color="#16AD78" />
                  </View>
                  <View className="flex-1 flex-shrink justify-center">
                    <KanitText className="text-lg text-gray-900" numberOfLines={1}>
                      {currentElder.firstName} {currentElder.lastName}
                    </KanitText>
                    <KanitText className="text-base text-gray-700" numberOfLines={1}>
                      {currentElder.phone}
                    </KanitText>
                  </View>
                </View>
                <View className="w-10 h-10 rounded-full bg-green-500 items-center justify-center shadow-sm">
                  <MaterialIconSolid name="phone" size={20} color="white" />
                </View>
              </Bounceable>
            ) : (
              <View className="bg-gray-50/60 px-4 py-4 rounded-3xl border border-gray-100 flex-row items-center gap-3">
                <MaterialIconSolid name="info" size={20} color="#9CA3AF" />
                <KanitText className="text-sm text-gray-500 font-kanit flex-1 leading-5">
                  ยังไม่ได้ระบุเบอร์โทรศัพท์สำหรับโทรหาผู้สูงอายุ
                </KanitText>
              </View>
            )}
          </View>
        )}

        <View className="flex-row items-center justify-between mb-2">
          <KanitText className="text-base text-gray-800">รายการผู้ติดต่อฉุกเฉิน</KanitText>
          <KanitText className="text-xs text-gray-400 font-kanit">แตะชื่อเพื่อโทรทันที</KanitText>
        </View>

        <View className="flex-1 justify-start gap-3">
          {isDataLoading ? (
            // ระหว่างโหลด แสดง skeleton แทน list จริง
            <View className="flex-1">
              <ListItemSkeleton count={3} />
            </View>
          ) : topContacts && topContacts.length > 0 ? (
            <>
              {topContacts.map((item, index) => (
                <View key={item.id} className="mb-1">
                  <Bounceable
                    onPress={() => {
                      // แตะรายชื่อแล้วโทรทันที
                      handleCall(item.phone);
                    }}
                    className="bg-white px-4 py-4 rounded-3xl border border-gray-100 shadow-sm flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-4 flex-1 pr-2">
                      {/* เลขลำดับการโทรฉุกเฉิน */}
                      <View className="w-11 h-11 rounded-full bg-red-50 items-center justify-center border border-red-100 flex-shrink-0">
                        <KanitText className="text-lg text-red-500">{index + 1}</KanitText>
                      </View>

                      {/* ข้อมูลผู้ติดต่อ */}
                      <View className="flex-1 flex-shrink justify-center">
                        <KanitText className="text-lg text-gray-900" numberOfLines={1}>
                          {item.name}
                        </KanitText>
                        <KanitText className="text-base text-gray-700" numberOfLines={1}>
                          {item.phone}
                          {item.relationship ? ` • ${item.relationship}` : ''}
                        </KanitText>
                      </View>
                    </View>

                    {/* ปุ่มโทร */}
                    <View className="w-10 h-10 rounded-full bg-green-500 items-center justify-center shadow-sm">
                      <MaterialIconSolid name="phone" size={20} color="white" />
                    </View>
                  </Bounceable>
                </View>
              ))}
            </>
          ) : (
            <View className="items-center py-8">
              <MaterialIconSolid name="contact_phone" size={56} color="#E5E7EB" />

              <KanitText className="text-gray-500 mt-3 text-center text-base">
                ไม่มีผู้ติดต่อฉุกเฉิน
              </KanitText>

              {isOwner && (
                <Bounceable
                  onPress={() => {
                    if (isNavigating) return;
                    setIsNavigating(true);
                    // ไปหน้าเพิ่มผู้ติดต่อฉุกเฉิน
                    // ถัดไปไปที่ add.tsx
                    router.push({
                      pathname: '/(features)/(emergency)/add',
                      params: { redirect: 'call' },
                    });
                  }}
                  disabled={isNavigating}
                  className="mt-4 bg-blue-500 px-6 py-3 rounded-full"
                >
                  <KanitText className="text-white text-base">เพิ่มผู้ติดต่อ</KanitText>
                </Bounceable>
              )}
            </View>
          )}
        </View>
      </View>

      {/* เบอร์สาธารณะวางแยกไว้นอก list เพื่อให้กดได้ตลอด */}
      <View className="bg-white p-5" style={{ paddingBottom: footerPaddingBottom }}>
        <KanitText className="text-base text-gray-800 mb-3">เบอร์โทรฉุกเฉินสาธารณะ</KanitText>

        <Bounceable
          onPress={() => {
            // โทรเบอร์ฉุกเฉินสาธารณะ 1669
            handleCall('1669');
          }}
          className="bg-white p-4 rounded-3xl border border-red-100 shadow-sm flex-row items-center justify-between active:bg-red-50"
        >
          <View className="flex-row items-center gap-4">
            <View className="w-10 h-10 rounded-full bg-red-50 items-center justify-center">
              <MaterialIconSolid name="local_hospital" size={22} color="#EF4444" />
            </View>

            <View>
              <KanitText className="text-lg text-gray-900">1669</KanitText>
              <KanitText className="text-gray-500 text-xs">เจ็บป่วยฉุกเฉิน</KanitText>
            </View>
          </View>

          <MaterialIconSolid name="phone_in_talk" size={22} color="#EF4444" />
        </Bounceable>
      </View>
    </ScreenWrapper>
  );
}
