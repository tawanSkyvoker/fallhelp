/**
 * NotificationModal.tsx
 *
 * Modal สำหรับแสดงรายการแจ้งเตือนและจัดการสถานะอ่านแล้ว
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - โหลดรายการแจ้งเตือนเมื่อ modal ถูกเปิด
 * - แสดงรายการแจ้งเตือนพร้อมสถานะใหม่/อ่านแล้ว
 * - sync จำนวน unread จากรายการที่โหลดมา เพื่อให้จุดแดงบนกระดิ่งตรงกับรายการจริง
 * - รองรับ pull to refresh เพื่อดึงข้อมูลล่าสุด
 * - ทำเครื่องหมายว่าอ่านแล้วได้ทั้งทีละรายการและอ่านทั้งหมด
 * - อัปเดต cache ก่อนยิง API เพื่อให้จุดแดงและป้าย "ใหม่" หายทันที
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, FlatList, RefreshControl, Dimensions } from 'react-native';

import KanitText from './KanitText';
import { Bounceable } from './Bounceable';
import { AppModalCard } from './AppModalCard';
import { ModernSpinner } from './ModernSpinner';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listNotifications, markAsRead, markAllAsRead } from '../services/notificationService';
import { MaterialSymbol } from './MaterialSymbol';
import { Notification } from '../services/types';
import Logger from '../utils/logger';
import { formatThaiBuddhistDateTime } from '../utils/date';

import { queryKeys } from '../hooks/queryKeys';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = Math.min(Math.max(SCREEN_HEIGHT * 0.72, 560), 640);

const formatDateTime = (dateString: string) => {
  return formatThaiBuddhistDateTime(dateString, { useTodayLabel: true });
};

const getNotificationConfig = () => ({
  icon: 'warning',
  color: '#EF4444',
  bg: 'bg-red-50',
  title: 'ตรวจพบการหกล้ม',
  desc: 'ผู้สูงอายุต้องการความช่วยเหลือด่วน',
});

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationModal = ({ visible, onClose }: NotificationModalProps) => {
  const queryClient = useQueryClient();

  // refreshing ใช้กับ pull to refresh ส่วน isMarkingAllRead ใช้ล็อกปุ่มอ่านทั้งหมด
  const [refreshing, setRefreshing] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  // กันผู้ใช้แตะรายการเดิมซ้ำระหว่าง request ยังไม่จบ
  const markingReadIdsRef = useRef<Set<string>>(new Set());

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
    enabled: visible,
  });

  useEffect(() => {
    if (!notifications) return;

    // เมื่อรายการแจ้งเตือนโหลดมาแล้ว ให้ sync unreadCount จากรายการจริงทันที
    // ช่วยให้จุดแดงบนกระดิ่งแสดงตรงกับป้าย "ใหม่" ใน modal
    const nextUnreadCount = notifications.filter((item) => !item.isRead).length;

    queryClient.setQueryData(queryKeys.unreadCount(), nextUnreadCount);
  }, [notifications, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);

    // โหลดรายการแจ้งเตือนและจำนวน unread ใหม่พร้อมกัน เพื่อให้ badge ตรงกับรายการ
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() }),
      refetch(),
    ]);

    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    const previousNotifications = queryClient.getQueryData<Notification[]>(
      queryKeys.notifications(),
    );
    const previousUnreadCount = queryClient.getQueryData<number>(queryKeys.unreadCount());

    try {
      setIsMarkingAllRead(true);

      // อัปเดต cache ก่อนเพื่อให้ UI เปลี่ยนทันที ไม่ต้องรอ server ตอบกลับ
      queryClient.setQueryData(queryKeys.notifications(), (oldData: Notification[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map((notif) => ({ ...notif, isRead: true }));
      });

      // อัปเดต badge ไปพร้อมกัน เพื่อลดจังหวะที่ตัวเลขค้าง
      queryClient.setQueryData(queryKeys.unreadCount(), 0);

      // เรียก service สำหรับทำเครื่องหมายว่าอ่านแจ้งเตือนทั้งหมดแล้ว
      // ไฟล์ถัดไป: services/notificationService.ts
      await markAllAsRead();

      // ดึงข้อมูลจริงกลับมาอีกครั้งเพื่อให้ state ตรงกับ server เสมอ
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
    } catch (error) {
      Logger.error('Failed to mark all as read', error);

      // ถ้า server fail ให้คืน cache ชุดเดิมก่อน แล้วค่อย refetch ข้อมูลจริง
      queryClient.setQueryData(queryKeys.notifications(), previousNotifications);
      queryClient.setQueryData(queryKeys.unreadCount(), previousUnreadCount);

      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleItemPress = async (item: Notification) => {
    if (item.isRead) return;

    // กันการแตะซ้ำเร็ว ๆ ก่อน React render รอบใหม่
    if (markingReadIdsRef.current.has(item.id)) return;
    markingReadIdsRef.current.add(item.id);

    const previousNotifications = queryClient.getQueryData<Notification[]>(
      queryKeys.notifications(),
    );
    const previousUnreadCount = queryClient.getQueryData<number>(queryKeys.unreadCount());

    // อัปเดต cache ก่อนยิง API เพื่อให้รายการเปลี่ยนเป็นอ่านแล้วทันที
    queryClient.setQueryData(queryKeys.notifications(), (oldData: Notification[] | undefined) => {
      if (!oldData) return oldData;

      return oldData.map((notif) => (notif.id === item.id ? { ...notif, isRead: true } : notif));
    });

    // ลด badge unread ทันที ไม่ต้องรอ refetch
    queryClient.setQueryData(queryKeys.unreadCount(), (oldCount: number | undefined) => {
      return Math.max((oldCount ?? 1) - 1, 0);
    });

    try {
      // เรียก service สำหรับทำเครื่องหมายว่าอ่านแจ้งเตือนรายการนี้แล้ว
      // ไฟล์ถัดไป: services/notificationService.ts
      await markAsRead(item.id);

      // sync ข้อมูลจริงกับ server แบบ background
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
    } catch (error) {
      Logger.error('Failed to mark as read', error);

      // ถ้า server fail ให้คืนค่าเดิมก่อน แล้วค่อยดึงข้อมูลจริงจาก server
      queryClient.setQueryData(queryKeys.notifications(), previousNotifications);
      queryClient.setQueryData(queryKeys.unreadCount(), previousUnreadCount);

      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
    } finally {
      markingReadIdsRef.current.delete(item.id);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const config = getNotificationConfig();

    const resolvedColor = config.color;
    const resolvedBg = config.bg;

    return (
      <Bounceable
        onPress={item.isRead ? undefined : () => handleItemPress(item)}
        disabled={item.isRead}
        className={`flex-row items-start px-6 py-4 border-b border-gray-100 ${
          item.isRead ? 'bg-white' : 'bg-gray-50'
        }`}
      >
        <View className={`w-10 h-10 rounded-full ${resolvedBg} items-center justify-center mr-4`}>
          <MaterialSymbol name={config.icon} size={20} color={resolvedColor} />
        </View>

        <View className="flex-1 min-w-0">
          <KanitText
            numberOfLines={1}
            ellipsizeMode="tail"
            className="text-gray-800 text-[16px] leading-6"
            weight={item.isRead ? 'regular' : 'medium'}
          >
            {/* ตัด emoji และคำแจ้งเตือนซ้ำออกจาก title เพื่อให้รายการอ่านง่ายขึ้น */}
            {(item.title || config.title)
              .replace(/^[⚠️🚨\s]*แจ้งเตือนฉุกเฉิน!\s*/g, '')
              .replace(/^[⚠️🚨\s]+/g, '')}
          </KanitText>

          <KanitText
            className={`text-sm mt-0.5 ${item.isRead ? 'text-gray-500' : 'text-gray-700'}`}
          >
            {item.message || config.desc}
          </KanitText>

          <View className="mt-2 flex-row items-center justify-between">
            {!item.isRead ? (
              <View className="bg-red-100 px-2 py-0.5 rounded-md">
                <KanitText weight="medium" className="text-[10px] text-red-600">
                  ใหม่
                </KanitText>
              </View>
            ) : (
              <View />
            )}
            <KanitText numberOfLines={1} className="text-[11px] text-gray-400">
              {formatDateTime(item.event?.timestamp ?? item.createdAt)}
            </KanitText>
          </View>
        </View>
      </Bounceable>
    );
  };

  return (
    <AppModalCard
      visible={visible}
      onClose={onClose}
      dialogStyle={styles.dialog}
      contentStyle={styles.content}
    >
      <View className="flex-row items-center justify-between px-6 pt-1 pb-4 border-b border-gray-100 bg-white">
        <KanitText weight="medium" className="text-xl text-gray-900">
          การแจ้งเตือน
        </KanitText>
        <Bounceable onPress={onClose} className="p-2" hitSlop={15}>
          <MaterialSymbol name="close" size={24} color="#4B5563" />
        </Bounceable>
      </View>

      {notifications && notifications.length > 0 && (
        <View className="px-6 py-2 flex-row justify-end bg-white">
          <Bounceable
            onPress={handleMarkAllRead}
            disabled={isMarkingAllRead}
            className="bg-gray-100 px-4 py-2 rounded-full flex-row items-center"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isMarkingAllRead ? (
              <View style={{ marginRight: 6 }}>
                <ModernSpinner size={16} color="#4B5563" />
              </View>
            ) : (
              <MaterialSymbol
                name="done_all"
                size={16}
                color="#4B5563"
                style={{ marginRight: 6 }}
              />
            )}
            <KanitText className="text-sm text-gray-700 font-medium">อ่านทั้งหมด</KanitText>
          </Bounceable>
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingBottom: 16,
          paddingTop: 0,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16AD78']} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center justify-center py-10 px-6">
              <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-4">
                <MaterialSymbol name="notifications_off" size={32} color="#9CA3AF" />
              </View>
              <KanitText className="text-gray-500 text-lg font-medium">ไม่มีการแจ้งเตือน</KanitText>
              <KanitText className="text-gray-400 text-sm mt-1 text-center">
                เหตุการณ์ต่างๆ จะปรากฏที่นี่
              </KanitText>
            </View>
          ) : (
            <View className="py-14 items-center justify-center">
              <ModernSpinner size={48} color="#16AD78" />
            </View>
          )
        }
      />
    </AppModalCard>
  );
};

const styles = {
  dialog: {
    maxWidth: 340,
  },
  content: {
    height: MODAL_HEIGHT,
    paddingTop: 0,
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
};
