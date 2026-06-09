/**
 * Notifications Screen
 *
 * หน้านี้ใช้แสดงประวัติการแจ้งเตือนย้อนหลัง
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดรายการแจ้งเตือนจาก Backend
 * - แสดงรายการแจ้งเตือนล่าสุด
 * - แตะรายการที่ยังไม่ได้อ่าน เพื่อเปลี่ยนเป็นอ่านแล้ว
 * - กดอ่านทั้งหมด เพื่อเปลี่ยนแจ้งเตือนทั้งหมดเป็นอ่านแล้ว
 * - รองรับ pull to refresh เพื่อโหลดข้อมูลใหม่
 */

import React, { memo, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialSymbol } from '../../../components/MaterialSymbol';
import { ModernSpinner } from '../../../components/ModernSpinner';

import KanitText from '../../../components/KanitText';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';

import { safeRouter as router } from '../../../utils/safeRouter';
import { formatThaiBuddhistDateTime } from '../../../utils/date';
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
} from '../../../services/notificationService';
import type { Notification } from '../../../services/types';
import Logger from '../../../utils/logger';

import { queryKeys } from '../../../hooks/queryKeys';
import { useFocusEffect } from 'expo-router';

// แปลงวันที่แจ้งเตือนให้เป็นรูปแบบอ่านง่ายแบบไทย
const formatDateTime = (dateString: string) => {
  return formatThaiBuddhistDateTime(dateString, { useTodayLabel: true, year: '2-digit' });
};

// config กลางของ notification card
// ตอนนี้ใช้รูปแบบเดียว คือแจ้งเตือนการหกล้ม
const getNotificationConfig = () => ({
  icon: 'warning',
  color: '#EF4444',
  bg: 'bg-red-50',
  title: 'ตรวจพบการหกล้ม',
  desc: 'ระบบตรวจพบการหกล้ม',
});

interface NotificationCardProps {
  item: Notification;
  onPress: (item: Notification) => void;
}

// การ์ดแจ้งเตือน 1 รายการ
// ใช้ memo เพื่อลดการ re-render ของ list
const NotificationCard = memo(function NotificationCard({ item, onPress }: NotificationCardProps) {
  const config = getNotificationConfig();

  return (
    <Pressable
      // ถ้าอ่านแล้ว ไม่ต้องกดซ้ำเพื่อ mark read
      onPress={item.isRead ? undefined : () => onPress(item)}
      android_ripple={item.isRead ? null : { color: 'rgba(0,0,0,0.05)', borderless: false }}
      style={({ pressed }) => ({
        opacity: !item.isRead && pressed ? 0.75 : 1,
      })}
      className={`flex-row items-start p-4 mb-3 rounded-[24px] border ${
        item.isRead ? 'bg-white border-gray-100' : 'bg-blue-50/50 border-blue-100'
      }`}
    >
      {/* ไอคอนแจ้งเตือน */}
      <View className={`w-10 h-10 rounded-full ${config.bg} items-center justify-center mr-4`}>
        <MaterialSymbol name={config.icon} size={20} color={config.color} />
      </View>

      <View className="flex-1 min-w-0">
        {/* หัวข้อแจ้งเตือน */}
        <KanitText
          numberOfLines={1}
          ellipsizeMode="tail"
          weight={item.isRead ? 'regular' : 'medium'}
          className="text-gray-800 text-[16px] leading-6"
        >
          {item.title || config.title}
        </KanitText>

        {/* รายละเอียดแจ้งเตือน */}
        <KanitText className={`text-sm mt-0.5 ${item.isRead ? 'text-gray-500' : 'text-gray-700'}`}>
          {item.message || config.desc}
        </KanitText>

        <View className="mt-2 flex-row items-center justify-between">
          {/* แสดง badge ใหม่ เฉพาะรายการที่ยังไม่ได้อ่าน */}
          {!item.isRead ? (
            <View className="bg-red-100 px-2 py-0.5 rounded-md">
              <KanitText weight="medium" className="text-[10px] text-red-600">
                ใหม่
              </KanitText>
            </View>
          ) : (
            <View />
          )}

          {/* วันเวลาที่เกิดแจ้งเตือน */}
          <KanitText numberOfLines={1} className="text-[11px] text-gray-400">
            {formatDateTime(item.createdAt)}
          </KanitText>
        </View>
      </View>
    </Pressable>
  );
});

export default function NotificationsScreen() {
  // ใช้จัดการ cache ของ React Query
  const queryClient = useQueryClient();

  // ใช้กับ pull to refresh
  const [refreshing, setRefreshing] = useState(false);

  // เก็บความสูง header เพื่อปรับตำแหน่ง refresh indicator
  const [headerHeight, setHeaderHeight] = useState(0);

  // โหลดรายการแจ้งเตือน
  const {
    data: notifications,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: async () => {
      // เรียก service สำหรับโหลดรายการแจ้งเตือน
      // ไฟล์ถัดไป: services/notificationService.ts
      const response = await listNotifications({
        pageSize: 50,
        page: 1,
      });

      return response.data || [];
    },
  });

  const refreshNotifications = useCallback(async () => {
    // โหลดรายการแจ้งเตือนใหม่ และ refresh unread badge พร้อมกัน
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() }),
    ]);
  }, [queryClient, refetch]);

  useFocusEffect(
    useCallback(() => {
      // เมื่อกลับเข้าหน้านี้ ให้ refresh ข้อมูลแจ้งเตือน
      void refreshNotifications();
    }, [refreshNotifications]),
  );

  const onRefresh = async () => {
    // ผู้ใช้ pull to refresh
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    const previousNotifications = notifications ?? [];

    // ถ้าไม่มีรายการที่ยังไม่ได้อ่าน ไม่ต้องทำอะไร
    const hasUnread = previousNotifications.some((item) => !item.isRead);
    if (!hasUnread) return;

    // อัปเดต UI ก่อน เพื่อให้รู้สึกว่าตอบสนองทันที
    queryClient.setQueryData(queryKeys.notifications(), (old: Notification[] | undefined) =>
      old?.map((item) => ({ ...item, isRead: true })),
    );
    queryClient.setQueryData(queryKeys.unreadCount(), 0);

    try {
      // เรียก service สำหรับ mark all as read
      // ไฟล์ถัดไป: services/notificationService.ts
      await markAllAsRead();

      await refreshNotifications();
    } catch (error) {
      // ถ้า API ล้มเหลว ให้คืนค่า notification เดิม
      queryClient.setQueryData(queryKeys.notifications(), previousNotifications);
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
      Logger.error('Failed to mark all as read', error);
    }
  };

  const handleItemPress = useCallback(
    async (item: Notification) => {
      if (!item.isRead) {
        // อัปเดต UI ก่อน เพื่อให้รายการเปลี่ยนเป็นอ่านแล้วทันที
        queryClient.setQueryData(queryKeys.notifications(), (old: Notification[] | undefined) =>
          old?.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
        );

        try {
          // เรียก service สำหรับ mark notification รายการเดียวเป็นอ่านแล้ว
          // ไฟล์ถัดไป: services/notificationService.ts
          await markAsRead(item.id);

          queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
        } catch (error) {
          // ถ้า API ล้มเหลว ให้ rollback รายการนี้กลับเป็นยังไม่ได้อ่าน
          queryClient.setQueryData(queryKeys.notifications(), (old: Notification[] | undefined) =>
            old?.map((n) => (n.id === item.id ? { ...n, isRead: false } : n)),
          );

          Logger.error('Failed to mark as read', error);
        }
      }
    },
    [queryClient],
  );

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationCard item={item} onPress={handleItemPress} />
    ),
    [handleItemPress],
  );

  return (
    <ScreenWrapper
      edges={['top']}
      useScrollView={false}
      keyboardAvoiding={false}
      header={
        <View
          onLayout={(event: LayoutChangeEvent) => {
            // วัดความสูง header เพื่อให้ pull-to-refresh อยู่ตำแหน่งถูกต้อง
            const nextHeight = Math.round(event.nativeEvent.layout.height);
            setHeaderHeight((prev) => (prev === nextHeight ? prev : nextHeight));
          }}
        >
          <ScreenHeader title="ประวัติการแจ้งเตือน" onBack={() => router.back()} />
        </View>
      }
    >
      {notifications && notifications.length > 0 && (
        <View className="px-5 pb-3 flex-row justify-between items-center border-b border-gray-100 mb-2">
          {/* ปุ่มอ่านทั้งหมด */}
          <TouchableOpacity
            onPress={handleMarkAllRead}
            className="flex-row items-center bg-gray-50 border border-gray-200 px-4 py-2 rounded-full active:bg-gray-100"
          >
            <MaterialSymbol name="done_all" size={18} color="#4B5563" style={{ marginRight: 6 }} />
            <KanitText weight="regular" className="text-sm text-gray-700">
              อ่านทั้งหมด
            </KanitText>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 100,
          paddingTop: 8,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#16AD78']}
            progressViewOffset={headerHeight > 0 ? headerHeight + 8 : 0}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center justify-center py-20">
              <MaterialSymbol name="notifications_off" size={64} color="#D1D5DB" />

              <KanitText className="text-gray-500 mt-4 text-lg">ไม่มีการแจ้งเตือน</KanitText>

              <KanitText className="text-gray-400 text-sm mt-1">
                เหตุการณ์ต่างๆ จะปรากฏที่นี่
              </KanitText>
            </View>
          ) : (
            <View className="py-20 items-center justify-center">
              <ModernSpinner size={48} color="#16AD78" />
            </View>
          )
        }
      />
    </ScreenWrapper>
  );
}
