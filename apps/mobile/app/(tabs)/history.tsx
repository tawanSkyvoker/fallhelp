/**
 * History Screen
 *
 * หน้านี้ใช้แสดงประวัติเหตุการณ์หกล้มและเหตุการณ์เสียการทรงตัว
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลผู้สูงอายุปัจจุบัน
 * - โหลดรายการเหตุการณ์จาก Backend
 * - กรองให้แสดงเฉพาะเหตุการณ์ที่ยืนยัน (ล้ม) และกดยกเลิก (เสียการทรงตัว)
 * - ถ้ามีเหตุการณ์ใหม่จาก realtime store จะ refetch รายการใหม่
 * - ไฮไลท์รายการล่าสุดชั่วคราวเมื่อมีเหตุการณ์ใหม่
 * - มีปุ่มไปดูรายงานสรุปประจำเดือน
 */

import React from 'react';
import { View, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { MaterialSymbol } from '../../components/MaterialSymbol';
import { MaterialIconSolid } from '../../components/MaterialIconSolid';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import KanitText from '../../components/KanitText';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../components/AppScreenHeader';
import { Bounceable } from '../../components/Bounceable';
import { ModernSpinner } from '../../components/ModernSpinner';

import { useFocusEffect } from 'expo-router';

import { safeRouter as router } from '../../utils/safeRouter';
import { getHrStatus } from '../../utils/heartRate';
import { formatThaiBuddhistDateTime } from '../../utils/date';
import Logger from '../../utils/logger';
import { listEvents, getMonthlySummary } from '../../services/eventService';

import { useFallAlertStore } from '../../store/useFallAlertStore';
import { useDeviceSetupStore } from '../../store/useDeviceSetupStore';
import { useCurrentElder } from '../../hooks/useCurrentElder';
import { queryKeys } from '../../hooks/queryKeys';

import type { Event } from '../../services/types';

const DEFAULT_DISPLAY_LIMIT = 25;
const HIGHLIGHT_DURATION_MS = 5000;
const API_PAGE_SIZE = 100;

const formatDate = (dateString: string): string => formatThaiBuddhistDateTime(dateString);

// แสดงเฉพาะเหตุการณ์ที่ยืนยัน (ล้มจริง) และที่กดยกเลิก (เสียการทรงตัว)
// PENDING_CONFIRMATION ถูกกรองออกเพราะยังไม่ได้ข้อสรุปและไม่เกี่ยวกับประวัติ
export const filterVisibleHistoryEvents = (events: Event[]): Event[] =>
  events.filter((event) => event.fallStage === 'CONFIRMED' || event.fallStage === 'CANCELLED');

export default function HistoryScreen() {
  const queryClient = useQueryClient();

  // อ่านเวลาล่าสุดของเหตุการณ์ล้มจาก realtime store
  // ใช้เป็นสัญญาณให้หน้านี้ refetch รายการใหม่
  const lastFallUpdate = useFallAlertStore((s) => s.lastFallUpdate);

  // กันกดการ์ดดูรายงานซ้ำ รีเซ็ตเมื่อ tab focus กลับมา
  const [isViewingReport, setIsViewingReport] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      setIsViewingReport(false);
    }, []),
  );

  // ใช้ไฮไลท์รายการล่าสุดเมื่อมี event ใหม่เข้ามา
  const [highlightLatest, setHighlightLatest] = React.useState(false);
  const highlightTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventIdRef = React.useRef<string | null>(null);

  // จำนวนรายการที่แสดงบนหน้า
  // null = แสดงทั้งหมด
  const [displayLimit, setDisplayLimit] = React.useState<number | null>(DEFAULT_DISPLAY_LIMIT);

  // โหลดข้อมูลผู้สูงอายุปัจจุบัน
  // ใช้ elderId สำหรับดึงประวัติเหตุการณ์
  const { data: elder, isLoading: isLoadingElder } = useCurrentElder();

  React.useEffect(() => {
    if (!elder?.id || !elder?.device?.id) return;

    // ตั้งค่า store เพื่อให้ realtime/socket รู้ว่าต้องติดตาม elder/device ตัวไหน
    useDeviceSetupStore.getState().setElderConfig(elder.id, elder.device.id);
  }, [elder?.device?.id, elder?.id]);

  // โหลดประวัติเหตุการณ์จาก Backend
  const {
    data: events,
    isLoading,
    refetch,
    isError,
  } = useQuery({
    queryKey: queryKeys.historyEvents(elder?.id),
    queryFn: async () => {
      if (!elder?.id) return [];

      // เรียก service สำหรับดึงรายการเหตุการณ์
      // ไฟล์ถัดไป: services/eventService.ts
      const response = await listEvents({
        elderId: elder.id,
        page: 1,
        limit: API_PAGE_SIZE,
      });

      const eventData = Array.isArray(response.data) ? response.data : [];

      // แสดง CONFIRMED (ล้มจริง) และ CANCELLED (เสียการทรงตัว) กรอง PENDING_CONFIRMATION ออก
      return filterVisibleHistoryEvents(eventData);
    },
    enabled: Boolean(elder?.id),
  });

  // โหลดข้อมูลสรุปประจำเดือนปัจจุบันดักไว้ล่วงหน้า (Prefetch)
  // เพื่อให้เวลากดปุ่ม "ดูรายงานสรุปประจำเดือน" แล้วข้อมูลจะแสดงทันทีไม่ต้องรอโหลดใหม่
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear() + 543;

  useQuery({
    queryKey: queryKeys.monthlySummary(elder?.id, currentMonth, currentYear),
    queryFn: async () => {
      if (!elder?.id) return null;
      const yearAD = currentYear - 543;
      return getMonthlySummary(elder.id, yearAD, currentMonth + 1);
    },
    enabled: Boolean(elder?.id),
    // ตั้ง staleTime เพื่อไม่ให้มัน refetch ซ้ำซ้อนตอนกดเข้าไปหน้า Report ทันที
    staleTime: 60000,
  });

  const isLoadingEvents = isLoadingElder || isLoading;
  const hasNoElder = !isLoadingElder && !elder?.id;

  React.useEffect(() => {
    if (!lastFallUpdate || !elder?.id) return;

    // เมื่อ realtime store มีเหตุการณ์ใหม่ ให้โหลดประวัติใหม่
    Logger.debug('[HistoryScreen] New event received via store, refreshing history...');
    refetch();

    // เคลียร์แคชรายงานประจำเดือน เพื่อให้ดึงใหม่ตอนผู้ใช้กดเข้าไปดู
    queryClient.invalidateQueries({ queryKey: ['monthlySummary', elder.id] });
  }, [lastFallUpdate, refetch, elder?.id, queryClient]);

  const triggerHighlight = React.useCallback(() => {
    // เปิด highlight รายการล่าสุดเป็นเวลาสั้น ๆ
    setHighlightLatest(true);

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = setTimeout(() => {
      setHighlightLatest(false);
    }, HIGHLIGHT_DURATION_MS);
  }, []);

  React.useEffect(() => {
    return () => {
      // ออกจากหน้าแล้วล้าง timer ของ highlight
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const displayEvents = events || [];

  // จำกัดจำนวนรายการตามตัวเลือกที่ผู้ใช้เลือก
  const limitedEvents = displayLimit ? displayEvents.slice(0, displayLimit) : displayEvents;
  const totalEvents = limitedEvents.length;
  const latestEventId = displayEvents[0]?.id ?? null;

  React.useEffect(() => {
    if (!latestEventId) return;

    if (lastEventIdRef.current === null) {
      // รอบแรกให้จำ id ไว้ก่อน ยังไม่ต้อง highlight
      lastEventIdRef.current = latestEventId;
      return;
    }

    if (latestEventId !== lastEventIdRef.current) {
      // มี event ใหม่ขึ้นมาเป็นรายการบนสุด
      lastEventIdRef.current = latestEventId;
      triggerHighlight();
    }
  }, [latestEventId, triggerHighlight]);

  const getEventDisplayInfo = (item: Event) => {
    if (item.fallStage === 'CANCELLED') {
      return {
        icon: 'elderly' as const,
        iconColor: '#D97706',
        bgColor: '#FEF3C7',
        titleStatus: 'เสียการทรงตัว',
        description: '',
      };
    }

    return {
      icon: 'warning' as const,
      iconColor: '#EF4444',
      bgColor: '#FEE2E2',
      titleStatus: 'ตรวจพบเหตุหกล้ม',
      description: 'ชีพจรขณะล้ม',
    };
  };

  const renderItem = ({ item, index }: { item: Event; index: number }) => {
    const { icon, iconColor, bgColor, titleStatus, description } = getEventDisplayInfo(item);
    const displayIndex = totalEvents - index;
    const isLatestItem = index === 0;
    const shouldHighlightLatest = highlightLatest && isLatestItem;

    return (
      <View
        className={`mb-4 bg-white rounded-[24px] border ${
          shouldHighlightLatest ? 'border-emerald-200 shadow-sm' : 'border-gray-100'
        }`}
      >
        <View className="rounded-[24px] overflow-hidden">
          {/* เลขลำดับของรายการ */}
          <View className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 items-center justify-center z-10">
            <KanitText className="text-sm text-gray-600">{displayIndex}</KanitText>
          </View>

          <View className="flex-row items-center p-4">
            {/* ไอคอนประเภทเหตุการณ์ */}
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: bgColor }}
            >
              <MaterialSymbol name={icon} size={24} color={iconColor} />
            </View>

            <View className="flex-1 ml-3 pr-10">
              {/* ชื่อประเภทเหตุการณ์ + badge ล่าสุด */}
              <View className="flex-row items-center gap-2">
                <KanitText className="text-lg text-gray-900">{titleStatus}</KanitText>

                {isLatestItem && (
                  <View className="flex-row items-center bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: '#10B981',
                        marginRight: 4,
                      }}
                    />
                    <KanitText className="text-xs text-emerald-700">ล่าสุด</KanitText>
                  </View>
                )}
              </View>

              {/* เวลาที่เกิดเหตุการณ์ */}
              <KanitText className="text-[13px] text-gray-600 mt-1">
                {formatDate(item.timestamp)}
              </KanitText>
            </View>
          </View>

          <View className="px-4 py-3 border-t border-gray-100">
            {item.fallStage === 'CANCELLED' ? (
              <KanitText className="text-sm text-gray-400" style={{ lineHeight: 20 }}>
                ผู้สวมใส่กดยกเลิกการแจ้งเตือนทันเวลา
              </KanitText>
            ) : item.bpm ? (
              <View className="flex-row items-center gap-3">
                <View>
                  <KanitText className="text-xs text-gray-400 mb-0.5">{description}</KanitText>

                  <KanitText weight="medium" className="text-2xl" style={{ color: '#1F2937' }}>
                    {Math.round(item.bpm)}{' '}
                    <KanitText className="text-sm text-gray-400">BPM</KanitText>
                  </KanitText>
                </View>

                <View
                  className="px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: getHrStatus(item.bpm).bg }}
                >
                  <KanitText
                    weight="medium"
                    style={{ color: getHrStatus(item.bpm).color, fontSize: 11 }}
                  >
                    {getHrStatus(item.bpm).label}
                  </KanitText>
                </View>
              </View>
            ) : (
              <KanitText className="text-sm text-gray-400" style={{ lineHeight: 20 }}>
                ไม่มีข้อมูลชีพจร
              </KanitText>
            )}
          </View>
        </View>
      </View>
    );
  };

  const listHeader = hasNoElder ? null : (
    <View className="bg-white rounded-[24px] shadow-sm border border-gray-100 mb-4">
      <View className="rounded-[24px] overflow-hidden">
        {/* ไปหน้ารายงานสรุปประจำเดือน */}
        <Bounceable
          onPress={() => {
            if (isViewingReport) return;
            setIsViewingReport(true);
            router.push('/(features)/(report)/report-summary');
          }}
          disabled={isViewingReport}
          scale={1}
          className="bg-white border-b border-gray-100"
        >
          <View className="flex-row items-center py-5 px-6">
            <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-3">
              <MaterialIconSolid name="assessment" size={22} color="#898989" />
            </View>

            <View className="flex-1">
              <KanitText weight="regular" className="text-gray-900 text-lg">
                ดูรายงานสรุปประจำเดือน
              </KanitText>
              <KanitText weight="regular" className="text-gray-400 text-sm mt-0.5">
                สรุปเหตุการณ์แต่ละเดือน
              </KanitText>
            </View>

            <MaterialSymbol name="chevron_right" size={24} color="#D1D5DB" />
          </View>
        </Bounceable>

        {!isLoadingEvents && (
          <View className="p-5">
            <View className="flex-row items-center justify-between mb-4">
              <KanitText className="text-sm text-gray-500">
                {`แสดง ${totalEvents} จาก ${displayEvents.length} เหตุการณ์`}
              </KanitText>
            </View>

            {/* ตัวเลือกจำนวนรายการที่แสดง */}
            <View className="flex-row items-center">
              <KanitText className="text-sm text-gray-600 mr-3">แสดง:</KanitText>

              <View className="flex-row gap-2">
                {[25, 50, null].map((limit) => {
                  const isSelected = displayLimit === limit;
                  const label = limit === null ? 'ทั้งหมด' : `${limit}`;

                  return (
                    <Bounceable
                      key={limit?.toString() || 'all'}
                      onPress={() => setDisplayLimit(limit)}
                      className={`px-4 py-2 rounded-full ${
                        isSelected ? 'bg-[#16AD78]' : 'bg-gray-100'
                      }`}
                      scale={0.97}
                    >
                      <KanitText
                        className={`text-sm ${isSelected ? 'text-white' : 'text-gray-700'}`}
                      >
                        {label}
                      </KanitText>
                    </Bounceable>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  if (isError) {
    return (
      <ScreenWrapper
        edges={['top']}
        useScrollView={false}
        keyboardAvoiding={false}
        className="flex-1 bg-white"
        header={<ScreenHeader title="ประวัติเหตุการณ์" />}
      >
        <View className="flex-1 justify-center items-center px-6">
          <MaterialIconSolid name="error" size={64} color="#D1D5DB" />

          <KanitText className="text-lg text-gray-700 mt-4 text-center">
            เกิดข้อผิดพลาดในการโหลดข้อมูล
          </KanitText>

          {/* โหลดประวัติใหม่อีกครั้ง */}
          <TouchableOpacity
            onPress={() => refetch()}
            className="mt-4 bg-gray-200 px-6 py-3 rounded-xl"
          >
            <KanitText className="text-gray-700">ลองใหม่</KanitText>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper
      edges={['top']}
      useScrollView={false}
      keyboardAvoiding={false}
      className="flex-1 bg-white"
      header={<ScreenHeader title="ประวัติเหตุการณ์" />}
    >
      <View className="flex-1">
        <View className="px-6 pt-4">
          {listHeader}

          {!isLoadingEvents && !hasNoElder && (
            <View className="flex-row items-center mb-3">
              <KanitText weight="medium" className="text-base text-gray-700">
                รายการเหตุการณ์
              </KanitText>
            </View>
          )}
        </View>

        {isLoadingEvents ? (
          <View className="flex-1 items-center justify-center">
            <ModernSpinner size={48} color="#16AD78" />
            <KanitText className="text-sm text-gray-600 mt-4">กำลังโหลดข้อมูล...</KanitText>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: 24,
              paddingBottom: 20,
            }}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={refetch} colors={['#16AD78']} />
            }
            showsVerticalScrollIndicator
          >
            {hasNoElder ? (
              <View className="items-center justify-center px-6 pb-10" style={{ minHeight: 320 }}>
                <MaterialSymbol name="person_search" size={64} color="#D1D5DB" />

                <KanitText className="text-base text-gray-500 mt-4 text-center">
                  ยังไม่พบข้อมูลผู้สูงอายุสำหรับดูประวัติ
                </KanitText>
              </View>
            ) : limitedEvents.length === 0 ? (
              <View className="items-center justify-center px-6 pb-10" style={{ minHeight: 320 }}>
                <MaterialSymbol name="event_note" size={64} color="#D1D5DB" />

                <KanitText className="text-base text-gray-500 mt-4 text-center">
                  ไม่มีประวัติเหตุการณ์ผิดปกติ
                </KanitText>
              </View>
            ) : (
              limitedEvents.map((item, index) => (
                <View key={item.id}>{renderItem({ item, index })}</View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </ScreenWrapper>
  );
}
