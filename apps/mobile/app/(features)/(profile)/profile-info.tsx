/**
 * Profile Info Screen
 *
 * หน้านี้ใช้แสดงข้อมูลส่วนตัวของผู้ใช้
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลโปรไฟล์ของ caregiver
 * - โหลดข้อมูลผู้สูงอายุที่เกี่ยวข้องไว้เป็น context
 * - แสดงรูปโปรไฟล์ ชื่อ เพศ เบอร์โทร อีเมล และรหัสผ่านแบบซ่อน
 * - เปลี่ยนรูปโปรไฟล์ได้ด้วย Image Picker
 * - มีทางลัดไปหน้าแก้ไขข้อมูลแต่ละส่วน
 * - ออกจากระบบผ่าน dialog ยืนยัน
 */

import React, { useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl, LayoutChangeEvent } from 'react-native';
import { MaterialSymbol } from '../../../components/MaterialSymbol';
import { MaterialIconSolid } from '../../../components/MaterialIconSolid';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import KanitText from '../../../components/KanitText';
import { ProfileSkeleton } from '../../../components/skeletons';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { Bounceable } from '../../../components/Bounceable';
import { ModernSpinner } from '../../../components/ModernSpinner';

import { safeRouter as router } from '../../../utils/safeRouter';
import { getProfile, updateProfile } from '../../../services/userService';
import Logger from '../../../utils/logger';
import { showErrorMessage } from '../../../utils/errorHelper';
import { showDialog } from '../../../utils/dialogService';

import { useCurrentElder } from '../../../hooks/useCurrentElder';
import { queryKeys } from '../../../hooks/queryKeys';
import { useAuth } from '../../../context/AuthContext';

export default function ProfileInfoScreen() {
  // ใช้จัดการ cache ของ React Query
  const queryClient = useQueryClient();

  // ใช้สำหรับออกจากระบบ
  const { signOut } = useAuth();

  // uploading ใช้แสดง spinner ตอนกำลังอัปโหลดรูปโปรไฟล์
  const [uploading, setUploading] = useState(false);

  // imageError ใช้ fallback ถ้ารูปโปรไฟล์โหลดไม่สำเร็จ
  const [imageError, setImageError] = useState(false);

  // ใช้ปรับตำแหน่ง pull-to-refresh ไม่ให้ spinner ทับ header
  const [headerHeight, setHeaderHeight] = useState(0);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    // ถ้าเปิดหน้านี้โดยไม่มี back stack ให้กลับ Dashboard
    router.replace('/(tabs)/dashboard');
  }, []);

  // โหลดข้อมูลโปรไฟล์ผู้ใช้
  const {
    data: profile,
    isLoading,
    isError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: queryKeys.userProfile(),

    // ไฟล์ถัดไป: services/userService.ts
    queryFn: getProfile,

    // ข้อมูลโปรไฟล์เปลี่ยนไม่บ่อย จึง cache ไว้ 5 นาที
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });

  // โหลดข้อมูลผู้สูงอายุไว้เป็น context ในหน้าโปรไฟล์
  const { refetch: refetchElder } = useCurrentElder({
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });

  useFocusEffect(
    useCallback(() => {
      // รอ animation เปลี่ยนหน้าจบก่อนค่อย refetch
      // ช่วยลดอาการ scroll กระตุกตอนเข้าหน้านี้
      const id = requestIdleCallback(() => {
        void queryClient.refetchQueries({ queryKey: queryKeys.userProfile(), stale: true });
        void queryClient.refetchQueries({ queryKey: queryKeys.currentElder(), stale: true });
      });

      return () => cancelIdleCallback(id);
    }, [queryClient]),
  );

  React.useEffect(() => {
    // ถ้า URL รูปเปลี่ยน ให้ลองโหลดรูปใหม่อีกครั้ง
    setImageError(false);
  }, [profile?.profileImage]);

  // จัดการขั้นตอนอัปเดตรูปโปรไฟล์
  const updateProfileMutation = useMutation({
    // ไฟล์ถัดไป: services/userService.ts
    mutationFn: updateProfile,
    onSuccess: () => {
      // อัปโหลดสำเร็จแล้ว refresh profile เพื่อให้รูปใหม่แสดงผล
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() });
    },
    onError: (error: unknown) => {
      Logger.error('Error updating profile image:', error);
      showErrorMessage('ผิดพลาด', error);
    },
  });

  const handleLogoutConfirmed = useCallback(() => {
    // หน่วงการ signOut เล็กน้อยเพื่อให้ Dialog animation จบก่อน
    // และลดความเสี่ยง crash บน Android Fabric จาก stack ที่ซ้อนลึก
    setTimeout(() => {
      signOut().catch((error: unknown) => {
        showErrorMessage('ผิดพลาด', error);
      });
    }, 150);
  }, [signOut]);

  const handleChangeProfileImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showDialog('ต้องอนุญาตสิทธิ์ก่อน', 'กรุณาอนุญาตสิทธิ์รูปภาพเพื่อเปลี่ยนรูปโปรไฟล์');
        return;
      }

      // เปิด Image Picker ให้ผู้ใช้เลือกรูป
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        shape: 'oval',
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled) {
        const image = result.assets[0];

        if (!image?.base64) {
          showDialog('ผิดพลาด', 'ไม่สามารถอ่านข้อมูลรูปภาพได้');
          return;
        }

        // ได้รูปแล้วค่อยเปิด spinner
        // ถ้าเปิดก่อน แล้วผู้ใช้กดยกเลิก picker อาจทำให้ loading ค้าง
        setUploading(true);

        try {
          // Backend รับรูปเป็น data URL
          const mimeType = image.mimeType || 'image/jpeg';
          const base64Image = `data:${mimeType};base64,${image.base64}`;

          Logger.info('Uploading profile image (Base64)...');

          // เริ่มอัปเดตรูปโปรไฟล์
          // ถัดไปไปที่ updateProfileMutation ด้านบน
          await updateProfileMutation.mutateAsync({ profileImage: base64Image });
        } catch (error) {
          Logger.error('Error uploading image:', error);
          showDialog('ผิดพลาด', 'ไม่สามารถอัปโหลดรูปภาพได้');
        } finally {
          setUploading(false);
        }
      }
    } catch (error: unknown) {
      Logger.error('Error picking image:', error);
      showDialog('ผิดพลาด', 'ไม่สามารถเลือกรูปภาพได้');
    }
  };

  const handleLogout = () => {
    showDialog('ออกจากระบบ', 'ยืนยันการออกจากระบบของคุณหรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ',
        style: 'destructive',
        onPress: () => void handleLogoutConfirmed(),
      },
    ]);
  };

  if (isLoading) {
    return (
      <ScreenWrapper
        edges={['top', 'left', 'right']}
        useScrollView={false}
        className="flex-1 bg-white"
        keyboardAvoiding={false}
        header={<ScreenHeader title="ข้อมูลส่วนตัว" onBack={handleBack} />}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator
        >
          <ProfileSkeleton />
        </ScrollView>
      </ScreenWrapper>
    );
  }

  if (isError || !profile) {
    return (
      <ScreenWrapper className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View className="flex-1 justify-center items-center px-6">
          <MaterialIconSolid name="account_circle" size={64} color="#D1D5DB" />

          <KanitText className="text-lg text-gray-700 mt-4 text-center">
            ไม่พบข้อมูลโปรไฟล์
          </KanitText>

          {/* โหลดข้อมูลโปรไฟล์และข้อมูลผู้สูงอายุใหม่อีกครั้ง */}
          <Bounceable
            onPress={() => {
              refetchProfile();
              refetchElder();
            }}
            className="mt-4 p-3 rounded-lg bg-gray-200"
            scale={1}
          >
            <KanitText className="font-kanit">ลองใหม่</KanitText>
          </Bounceable>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right']}
      useScrollView={false}
      className="flex-1 bg-white"
      keyboardAvoiding={false}
      header={
        <View
          onLayout={(event: LayoutChangeEvent) => {
            // วัดความสูง header เพื่อใช้กับ pull-to-refresh
            const nextHeight = Math.round(event.nativeEvent.layout.height);

            // อัปเดตเฉพาะตอนค่าเปลี่ยนจริง เพื่อกัน re-render loop
            setHeaderHeight((prev) => (prev === nextHeight ? prev : nextHeight));
          }}
        >
          <ScreenHeader title="ข้อมูลส่วนตัว" onBack={handleBack} />
        </View>
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              // ผู้ใช้ pull-to-refresh เพื่อโหลดข้อมูลใหม่
              refetchProfile();
              refetchElder();
            }}
            colors={['#16AD78']}
            progressViewOffset={headerHeight > 0 ? headerHeight + 8 : 0}
          />
        }
        showsVerticalScrollIndicator
      >
        {/* รูปโปรไฟล์ กดเพื่อเปลี่ยนรูป */}
        <View className="items-center mb-8 mt-4">
          <Bounceable
            onPress={handleChangeProfileImage}
            disabled={uploading}
            testID="profile-image-button"
            className="relative w-28 h-28"
            scale={0.9}
          >
            <View className="w-full h-full rounded-full bg-gray-100 items-center justify-center overflow-hidden">
              {uploading ? (
                <ModernSpinner size={48} color="#16AD78" />
              ) : profile.profileImage && !imageError ? (
                <Image
                  key={profile.profileImage}
                  source={{ uri: profile.profileImage }}
                  className="w-full h-full"
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={200}
                  onError={(e: unknown) => {
                    Logger.error('Image Load Error:', e);
                    setImageError(true);
                  }}
                />
              ) : (
                <MaterialIconSolid name="person" size={56} color="#9CA3AF" />
              )}
            </View>

            {/* ไอคอนกล้องบอกว่ารูปนี้แก้ไขได้ */}
            <View className="absolute bottom-0 right-0 bg-[#16AD78] w-8 h-8 rounded-full items-center justify-center border-2 border-white">
              <MaterialSymbol name="photo_camera" size={18} color="white" />
            </View>
          </Bounceable>
        </View>

        {/* การ์ดข้อมูลส่วนตัว */}
        <View className="bg-white rounded-[24px] shadow-sm border border-gray-100 mb-4">
          <View className="rounded-[24px] overflow-hidden">
            {/* ไปหน้าแก้ไขชื่อ นามสกุล และเพศ */}
            <Bounceable
              onPress={() => router.push('/(features)/(profile)/edit-info')}
              className="border-b border-gray-100 active:bg-gray-50"
              scale={1}
              style={{ backgroundColor: 'white' }}
            >
              <View className="flex-row items-center justify-between p-5">
                <View className="flex-1">
                  <View className="mb-3">
                    <KanitText className="text-sm text-gray-500 mb-1">ชื่อ-นามสกุล</KanitText>
                    <KanitText className="text-lg text-gray-900">
                      {profile.firstName} {profile.lastName}
                    </KanitText>
                  </View>

                  <View>
                    <KanitText className="text-sm text-gray-500 mb-1">เพศ</KanitText>
                    <KanitText className="text-lg text-gray-900">
                      {profile.gender === 'MALE'
                        ? 'ชาย'
                        : profile.gender === 'FEMALE'
                          ? 'หญิง'
                          : profile.gender === 'OTHER'
                            ? 'อื่นๆ'
                            : 'ไม่ระบุ'}
                    </KanitText>
                  </View>
                </View>

                <KanitText weight="medium" className="text-sm text-gray-400">
                  แก้ไข
                </KanitText>
              </View>
            </Bounceable>

            {/* ไปหน้าแก้ไขเบอร์โทรศัพท์ */}
            <Bounceable
              onPress={() => router.push('/(features)/(profile)/edit-phone')}
              className="border-b border-gray-100 active:bg-gray-50"
              scale={1}
              style={{ backgroundColor: 'white' }}
            >
              <View className="flex-row items-center justify-between p-5">
                <View className="flex-1">
                  <KanitText className="text-sm text-gray-500 mb-1">เบอร์โทรศัพท์</KanitText>
                  <KanitText className="text-lg text-gray-900">
                    {profile.phone || 'ไม่ระบุ'}
                  </KanitText>
                </View>

                <KanitText weight="medium" className="text-sm text-gray-400">
                  แก้ไข
                </KanitText>
              </View>
            </Bounceable>

            {/* ไปหน้าเปลี่ยนอีเมล */}
            <Bounceable
              onPress={() => router.push('/(features)/(profile)/change-email')}
              className="border-b border-gray-100 active:bg-gray-50"
              scale={1}
              style={{ backgroundColor: 'white' }}
            >
              <View className="flex-row items-center justify-between p-5">
                <View className="flex-1">
                  <KanitText className="text-sm text-gray-500 mb-1">อีเมล</KanitText>
                  <KanitText className="text-lg text-gray-900">{profile.email}</KanitText>
                </View>

                <KanitText weight="medium" className="text-sm text-gray-400">
                  แก้ไข
                </KanitText>
              </View>
            </Bounceable>

            {/* ไปหน้าเปลี่ยนรหัสผ่าน */}
            <Bounceable
              onPress={() => router.push('/(features)/(profile)/change-password')}
              className="active:bg-gray-50"
              scale={1}
              style={{ backgroundColor: 'white' }}
            >
              <View className="flex-row items-center justify-between p-5">
                <View className="flex-1">
                  <KanitText className="text-sm text-gray-500 mb-1">รหัสผ่าน</KanitText>
                  <KanitText className="text-lg text-gray-900">••••••••</KanitText>
                </View>

                <KanitText weight="medium" className="text-sm text-gray-400">
                  เปลี่ยน
                </KanitText>
              </View>
            </Bounceable>
          </View>
        </View>

        {/* ปุ่มออกจากระบบ */}
        <View className="bg-white rounded-[24px] shadow-sm border border-gray-100 mb-6">
          <View className="rounded-[24px] overflow-hidden">
            <Bounceable
              testID="logout-button"
              onPress={handleLogout}
              className="active:bg-red-50"
              scale={1}
              style={{ backgroundColor: 'white' }}
            >
              <View className="flex-row items-center justify-between p-5">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full items-center justify-center bg-red-50">
                    <MaterialIconSolid name="logout" size={22} color="#EF4444" />
                  </View>

                  <KanitText className="ml-3 text-lg text-red-500">ออกจากระบบ</KanitText>
                </View>

                <MaterialSymbol name="chevron_right" size={24} color="#9CA3AF" />
              </View>
            </Bounceable>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
