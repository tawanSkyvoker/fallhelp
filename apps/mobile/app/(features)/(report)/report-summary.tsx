/**
 * Report Summary Screen
 *
 * หน้านี้ใช้แสดงรายงานสรุปประจำเดือน
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลผู้สูงอายุปัจจุบัน
 * - โหลดสรุปเหตุการณ์ของเดือนที่เลือก
 * - เปลี่ยนเดือนด้วยปุ่มซ้าย/ขวา หรือเลือกจาก Month Picker
 * - แสดงสถิติเหตุล้ม จำนวนเสียการทรงตัว ชีพจรขณะล้ม และช่วงเวลาที่เกิดเหตุบ่อยสุด
 * - รีเฟรชข้อมูลอัตโนมัติทุก 60 วินาทีเมื่ออยู่ในหน้านี้
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, TouchableOpacity, TouchableHighlight, FlatList, ScrollView } from 'react-native';
import { MaterialSymbol } from '../../../components/MaterialSymbol';
import { MaterialIconSolid } from '../../../components/MaterialIconSolid';
import { useIsFocused } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import KanitText from '../../../components/KanitText';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { ModernSpinner } from '../../../components/ModernSpinner';
import { AppModalCard } from '../../../components/AppModalCard';

import { safeRouter as router } from '../../../utils/safeRouter';
import { getMonthlySummary } from '../../../services/eventService';

import { useCurrentElder } from '../../../hooks/useCurrentElder';
import { queryKeys } from '../../../hooks/queryKeys';

// ชื่อเดือนภาษาไทย ใช้ทั้งส่วนแสดงผลและ Month Picker
const THAI_MONTHS = [
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

export default function ReportSummaryScreen() {
  // ใช้จัดการ cache ของ React Query
  const queryClient = useQueryClient();

  // ใช้เช็กว่าหน้านี้กำลังอยู่บนจอหรือไม่
  const isFocused = useIsFocused();

  // currentMonth ใช้รูปแบบ JavaScript month: 0 = มกราคม, 11 = ธันวาคม
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  // currentYear เก็บเป็น พ.ศ. เพื่อใช้แสดงผลบนหน้าได้ทันที
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear() + 543);

  // เปิด/ปิด modal เลือกเดือน
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // ใช้ควบคุม padding ของ Month Picker
  // ถ้าเคยเลือกเดือนแล้ว จะจัด item ที่เลือกให้อยู่กลาง list
  const [hasSelectedMonth, setHasSelectedMonth] = useState(false);

  // โหลดข้อมูลผู้สูงอายุปัจจุบัน
  // ใช้ elderId สำหรับดึงรายงานรายเดือน
  const { data: currentElder, isLoading: isLoadingElder } = useCurrentElder();

  useEffect(() => {
    if (!isFocused) return;

    // เมื่ออยู่ในหน้านี้ ให้ refresh รายงานเดือนปัจจุบันทุก 60 วินาที
    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.monthlySummary(currentElder?.id, currentMonth, currentYear),
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [isFocused, queryClient, currentElder?.id, currentMonth, currentYear]);

  // โหลดสรุปรายงานของเดือนที่เลือก
  const {
    data: summary,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.monthlySummary(currentElder?.id, currentMonth, currentYear),
    queryFn: async () => {
      if (!currentElder?.id) return null;

      // Backend ใช้ปี ค.ศ. จึงต้องแปลงจาก พ.ศ. กลับก่อนส่ง
      const yearAD = currentYear - 543;

      // API รับเดือนแบบ 1-based แต่ JavaScript ใช้ 0-based
      // ไฟล์ถัดไป: services/eventService.ts
      return getMonthlySummary(currentElder.id, yearAD, currentMonth + 1);
    },
    enabled: !!currentElder?.id,
  });

  const displaySummary = summary;

  // แปลง peakHour เป็นช่วงเวลา เช่น 08:00 - 09:00 น.
  const peakTimeRange =
    displaySummary?.peakHour !== null && displaySummary?.peakHour !== undefined
      ? `${String(displaySummary.peakHour).padStart(2, '0')}:00 - ${String((displaySummary.peakHour + 1) % 24).padStart(2, '0')}:00 น.`
      : '-';

  // สร้างรายการเดือนให้เลือก: เดือนปัจจุบัน + ย้อนหลัง 12 เดือน
  const monthOptions = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    return Array.from({ length: 13 }).map((_, index) => {
      const targetDate = new Date(currentYear, currentMonth - index, 1);

      return {
        month: targetDate.getMonth(),
        year: targetDate.getFullYear() + 543,
      };
    });
  }, []);

  // หา index ของเดือนที่เลือกอยู่ เพื่อใช้คำนวณตำแหน่ง scroll ของ Month Picker
  const selectedMonthIndex = useMemo(() => {
    const index = monthOptions.findIndex(
      (option) => option.month === currentMonth && option.year === currentYear,
    );

    return index >= 0 ? index : 0;
  }, [currentMonth, currentYear, monthOptions]);

  // ค่าคำนวณสำหรับจัดตำแหน่ง Month Picker
  const monthListHeight = 260;
  const monthItemHeight = 52;
  const monthSeparatorHeight = 1;
  const monthRowHeight = monthItemHeight + monthSeparatorHeight;
  const monthContentPadding = 8;

  // ถ้าเคยเลือกเดือนแล้ว ให้ padding มากพอสำหรับจัด item ที่เลือกไว้กลาง list
  const monthListPadding = hasSelectedMonth
    ? Math.floor((monthListHeight - monthItemHeight) / 2)
    : monthContentPadding;

  const monthListContentHeight = monthListPadding * 2 + monthOptions.length * monthRowHeight;
  const monthMaxOffset = Math.max(0, monthListContentHeight - monthListHeight);

  // offset ที่ทำให้เดือนที่เลือกอยู่กลาง FlatList
  const monthCenteredOffset =
    monthListPadding +
    selectedMonthIndex * monthRowHeight -
    (monthListHeight - monthItemHeight) / 2;

  // clamp offset เพื่อกัน scroll เกินช่วงที่ list มีข้อมูล
  const monthInitialOffset = hasSelectedMonth
    ? Math.min(Math.max(0, monthCenteredOffset), monthMaxOffset)
    : 0;

  const handlePreviousMonth = () => {
    const today = new Date();
    const minYear = today.getFullYear() + 543 - 1;
    const minMonth = today.getMonth();

    // ย้อนหลังได้ไม่เกิน 12 เดือน
    if (currentYear === minYear && currentMonth === minMonth) {
      return;
    }

    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }

    setHasSelectedMonth(true);
  };

  const handleNextMonth = () => {
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear() + 543;

    // ห้ามเลือกเดือนในอนาคต
    if (currentYear === todayYear && currentMonth === todayMonth) {
      return;
    }

    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }

    setHasSelectedMonth(true);
  };

  const isCurrentMonth = () => {
    const today = new Date();

    return currentMonth === today.getMonth() && currentYear === today.getFullYear() + 543;
  };

  const isPreviousMonthDisabled = () => {
    const today = new Date();
    const minYear = today.getFullYear() + 543 - 1;
    const minMonth = today.getMonth();

    return currentYear === minYear && currentMonth === minMonth;
  };

  if (isError) {
    return (
      <ScreenWrapper
        edges={['top']}
        useScrollView={false}
        className="flex-1 bg-white"
        header={<ScreenHeader title="รายงานสรุปประจำเดือน" onBack={() => router.back()} />}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 0, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 justify-center items-center">
            <MaterialIconSolid name="error" size={64} color="#D1D5DB" />

            <KanitText className="text-lg text-gray-700 mt-4 text-center">
              เกิดข้อผิดพลาดในการโหลดข้อมูล
            </KanitText>

            {/* โหลดรายงานเดือนเดิมอีกครั้ง */}
            <TouchableHighlight
              onPress={() => refetch()}
              className="mt-4 px-6 py-3 rounded-xl bg-gray-200"
              underlayColor="#E5E7EB"
            >
              <KanitText className="text-gray-700">ลองใหม่</KanitText>
            </TouchableHighlight>
          </View>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper
      edges={['top']}
      useScrollView={false}
      className="flex-1 bg-white"
      header={<ScreenHeader title="รายงานสรุปประจำเดือน" onBack={() => router.back()} />}
    >
      {/* แถบเลือกเดือนคงที่ใต้ header ส่วนการ์ดรายงานเลื่อนแยกด้านล่าง */}
      <View className="px-6 pt-4 pb-2 bg-white">
        <View className="flex-row items-center justify-between">
          <TouchableHighlight
            testID="previous-month"
            onPress={handlePreviousMonth}
            disabled={isPreviousMonthDisabled()}
            className="rounded-xl overflow-hidden"
            underlayColor="#F3F4F6"
            style={{ borderRadius: 12, opacity: isPreviousMonthDisabled() ? 0.4 : 1 }}
          >
            <View className="w-10 h-10 items-center justify-center">
              <MaterialSymbol name="chevron_left" size={30} color="#374151" />
            </View>
          </TouchableHighlight>

          {/* เปิด Month Picker */}
          <TouchableHighlight
            testID="month-selector"
            className="flex-1 mx-4 rounded-[24px] overflow-hidden border border-gray-100 bg-white"
            onPress={() => setShowMonthPicker(true)}
            underlayColor="#F3F4F6"
          >
            <View className="flex-row items-center justify-center px-6 py-3.5 w-full">
              <KanitText weight="regular" className="text-xl text-gray-900">
                {THAI_MONTHS[currentMonth]} {currentYear}
              </KanitText>
              <MaterialSymbol name="arrow_drop_down" size={28} color="#6B7280" />
            </View>
          </TouchableHighlight>

          <TouchableHighlight
            testID="next-month"
            onPress={handleNextMonth}
            disabled={isCurrentMonth()}
            className="rounded-xl overflow-hidden"
            underlayColor="#F3F4F6"
            style={{ borderRadius: 12, opacity: isCurrentMonth() ? 0.4 : 1 }}
          >
            <View className="w-10 h-10 items-center justify-center">
              <MaterialSymbol name="chevron_right" size={30} color="#374151" />
            </View>
          </TouchableHighlight>
        </View>
      </View>

      <View className="flex-1" style={{ paddingHorizontal: 24, paddingBottom: 60 }}>
        <View className="flex-1 pt-2">
          {isLoadingElder || isLoading ? (
            <View className="items-center justify-center py-12">
              <ModernSpinner size={48} color="#16AD78" />
              <KanitText className="text-sm text-gray-600 mt-4">กำลังโหลดข้อมูล...</KanitText>
            </View>
          ) : displaySummary ? (
            <>
              {/* ช่วงเวลาเกิดเหตุบ่อยที่สุด */}
              <View className="bg-white rounded-[24px] border border-gray-100 mb-3">
                <View className="rounded-[24px] overflow-hidden p-5 flex-row items-center">
                  <View className="w-14 h-14 rounded-2xl bg-teal-100 items-center justify-center mr-4">
                    <MaterialSymbol name="schedule" size={28} color="#16AD78" />
                  </View>

                  <View className="flex-1">
                    <KanitText className="text-base text-gray-500 mb-1">
                      ช่วงเวลาเกิดเหตุบ่อยที่สุด
                    </KanitText>
                    <KanitText weight="medium" className="text-2xl text-teal-600">
                      {peakTimeRange}
                    </KanitText>
                  </View>
                </View>
              </View>

              {/* จำนวนครั้งที่ยืนยันว่าเป็นเหตุการณ์หกล้มจริงในเดือนนี้ */}
              <View className="bg-white rounded-[24px] border border-gray-100 mb-3">
                <View className="rounded-[24px] overflow-hidden p-5 flex-row items-center">
                  <View className="w-14 h-14 rounded-2xl bg-red-100 items-center justify-center mr-4">
                    <MaterialSymbol name="warning" size={28} color="#EF4444" />
                  </View>

                  <View className="flex-1">
                    <KanitText className="text-base text-gray-500 mb-0.5">
                      จำนวนครั้งที่หกล้มจริง
                    </KanitText>
                    <KanitText className="text-sm text-gray-400 mb-1">
                      เหตุการณ์ที่ยืนยันเป็นการล้มในเดือนนี้
                    </KanitText>

                    <View className="flex-row items-baseline">
                      <KanitText weight="medium" className="text-4xl text-red-500">
                        {displaySummary.fallCount === 0 ? '-' : displaySummary.fallCount}
                      </KanitText>

                      {displaySummary.fallCount > 0 && (
                        <KanitText className="text-lg text-gray-500 ml-2">ครั้ง</KanitText>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {/* จำนวนการกดยกเลิกจากอุปกรณ์ในเดือนนี้ */}
              <View className="bg-white rounded-[24px] border border-gray-100 mb-3">
                <View className="rounded-[24px] overflow-hidden p-5 flex-row items-center">
                  <View className="w-14 h-14 rounded-2xl bg-amber-100 items-center justify-center mr-4">
                    <MaterialSymbol name="elderly" size={28} color="#D97706" />
                  </View>

                  <View className="flex-1">
                    <KanitText className="text-base text-gray-500 mb-0.5">เสียการทรงตัว</KanitText>
                    <KanitText className="text-sm text-gray-400 mb-1">
                      ผู้สวมใส่กดยกเลิกการแจ้งเตือนทันเวลา
                    </KanitText>

                    <View className="flex-row items-baseline">
                      <KanitText weight="medium" className="text-4xl text-amber-500">
                        {displaySummary.cancelledCount === 0 ? '-' : displaySummary.cancelledCount}
                      </KanitText>

                      {displaySummary.cancelledCount > 0 && (
                        <KanitText className="text-lg text-gray-500 ml-2">ครั้ง</KanitText>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {/* สรุปชีพจรที่บันทึกพร้อมเหตุการณ์หกล้มจริง */}
              <View className="bg-white rounded-[24px] border border-gray-100 mb-3">
                <View className="rounded-[24px] overflow-hidden p-5 pb-8">
                  <View className="flex-row items-center mb-3">
                    <View className="w-14 h-14 rounded-2xl bg-rose-100 items-center justify-center mr-4">
                      <MaterialIconSolid name="favorite" size={28} color="#E11D48" />
                    </View>

                    <View className="flex-1">
                      <KanitText className="text-lg text-gray-500">สรุปชีพจรขณะหกล้ม</KanitText>
                      <KanitText className="text-sm text-gray-400 mt-0.5">
                        จัดกลุ่มจากเหตุการณ์หกล้มจริง {displaySummary.fallCount} ครั้ง
                      </KanitText>
                    </View>
                  </View>

                  <View className="flex-row gap-2">
                    <View className="flex-1 bg-red-50 rounded-2xl p-4 items-center">
                      <View className="flex-row items-baseline">
                        <KanitText
                          weight="medium"
                          className="text-3xl text-red-500"
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {displaySummary.fallCount === 0
                            ? '-'
                            : displaySummary.heartRateAtFallHigh}
                        </KanitText>
                        <KanitText className="text-[10px] text-red-400 ml-0.5">ครั้ง</KanitText>
                      </View>
                      <KanitText weight="regular" className="text-sm text-red-500 mt-1">
                        ชีพจรสูง
                      </KanitText>
                    </View>

                    <View className="flex-1 bg-[#D1FAE5] rounded-2xl p-4 items-center">
                      <View className="flex-row items-baseline">
                        <KanitText
                          weight="medium"
                          className="text-3xl text-[#065F46]"
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {displaySummary.fallCount === 0
                            ? '-'
                            : displaySummary.heartRateAtFallNormal}
                        </KanitText>
                        <KanitText className="text-[10px] text-[#065F46] ml-0.5">ครั้ง</KanitText>
                      </View>
                      <KanitText weight="regular" className="text-sm text-[#065F46] mt-1">
                        ชีพจรปกติ
                      </KanitText>
                    </View>

                    <View className="flex-1 bg-blue-50 rounded-2xl p-4 items-center">
                      <View className="flex-row items-baseline">
                        <KanitText
                          weight="medium"
                          className="text-3xl text-blue-500"
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {displaySummary.fallCount === 0 ? '-' : displaySummary.heartRateAtFallLow}
                        </KanitText>
                        <KanitText className="text-[10px] text-blue-400 ml-0.5">ครั้ง</KanitText>
                      </View>
                      <KanitText weight="regular" className="text-sm text-blue-500 mt-1">
                        ชีพจรต่ำ
                      </KanitText>
                    </View>
                  </View>
                  {displaySummary.heartRateAtFallUnknown > 0 && (
                    <KanitText className="text-sm text-gray-400 mt-5 text-center">
                      ไม่มีข้อมูลชีพจร {displaySummary.heartRateAtFallUnknown} ครั้ง
                    </KanitText>
                  )}
                </View>
              </View>
            </>
          ) : (
            <View className="items-center justify-center py-12">
              <MaterialSymbol name="description" size={80} color="#D1D5DB" />

              <KanitText weight="medium" className="text-lg text-gray-900 mt-4">
                ไม่มีข้อมูลในเดือนนี้
              </KanitText>

              <KanitText className="text-sm text-gray-500 mt-2 text-center px-6">
                ยังไม่มีเหตุการณ์ที่บันทึกไว้ในเดือน{THAI_MONTHS[currentMonth]} {currentYear}
              </KanitText>
            </View>
          )}
        </View>
      </View>

      {/* Modal เลือกเดือน */}
      <AppModalCard
        visible={showMonthPicker}
        title="เลือกเดือน/ปี"
        onClose={() => setShowMonthPicker(false)}
        dismissible={true}
      >
        <View className="overflow-hidden mt-3">
          <View className="max-h-[260px]">
            {showMonthPicker ? (
              <FlatList
                data={monthOptions}
                keyExtractor={(item) => `${item.month}-${item.year}`}
                showsVerticalScrollIndicator
                contentContainerStyle={{ paddingVertical: monthListPadding }}
                contentOffset={{ x: 0, y: monthInitialOffset }}
                style={{ flexGrow: 0 }}
                ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-4" />}
                initialNumToRender={12}
                getItemLayout={(_, index) => ({
                  length: monthRowHeight,
                  offset: monthListPadding + monthRowHeight * index,
                  index,
                })}
                renderItem={({ item }) => {
                  const isSelected = item.month === currentMonth && item.year === currentYear;

                  return (
                    <TouchableOpacity
                      testID="month-option"
                      onPress={() => {
                        // เลือกเดือนใหม่
                        // ถัดไป query key จะเปลี่ยน แล้ว React Query จะโหลดข้อมูลเดือนนั้นใหม่
                        setCurrentMonth(item.month);
                        setCurrentYear(item.year);
                        setHasSelectedMonth(true);
                        setShowMonthPicker(false);
                      }}
                      className="h-[52px] px-4 justify-center"
                      activeOpacity={0.6}
                    >
                      <KanitText
                        weight={isSelected ? 'medium' : 'regular'}
                        className={`text-base text-center ${isSelected ? 'text-green-600' : 'text-gray-700'}`}
                      >
                        {THAI_MONTHS[item.month]} {item.year}
                      </KanitText>
                    </TouchableOpacity>
                  );
                }}
              />
            ) : null}
          </View>

          <View className="h-[14px]" />
          <View className="h-0.5 bg-gray-300 mx-4" />

          <TouchableOpacity
            onPress={() => setShowMonthPicker(false)}
            className="bg-white pt-4 pb-5"
            activeOpacity={0.6}
          >
            <KanitText weight="medium" className="text-base text-gray-700 text-center">
              ยกเลิก
            </KanitText>
          </TouchableOpacity>
        </View>
      </AppModalCard>
    </ScreenWrapper>
  );
}
