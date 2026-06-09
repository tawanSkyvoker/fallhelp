/**
 * Tab Layout
 *
 * ไฟล์นี้ใช้กำหนดแถบเมนูล่างของแอป
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนดแท็บหลักของแอปหลังเข้าสู่ระบบ
 * - มีแท็บ Dashboard และ History
 * - ซ่อน Header มาตรฐาน เพื่อให้แต่ละหน้าจอใช้ Header/UI ของตัวเอง
 * - กำหนดสี ฟอนต์ และขนาดของ Tab Bar
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialSymbol } from '../../components/MaterialSymbol';
import { MaterialIconSolid } from '../../components/MaterialIconSolid';

// สีหลักของ Tab Bar
const TAB_ACTIVE_COLOR = '#16AD78';
const TAB_INACTIVE_COLOR = '#9CA3AF';
const TAB_BAR_BG_COLOR = '#FFFFFF';
const TAB_BAR_BORDER_COLOR = '#E5E7EB';

export default function TabLayout() {
  return (
    <Tabs
      // หน้าแรกของกลุ่ม tabs หลังผู้ใช้เข้าสู่ระบบ
      initialRouteName="dashboard"
      screenOptions={{
        // ไม่ใช้ Header ของ Tabs
        // แต่ละหน้าจะจัดการ Header หรือ UI ของตัวเอง
        headerShown: false,

        // สีของแท็บที่เลือกอยู่และยังไม่ได้เลือก
        tabBarActiveTintColor: TAB_ACTIVE_COLOR,
        tabBarInactiveTintColor: TAB_INACTIVE_COLOR,

        // ฟอนต์ของชื่อแท็บ
        tabBarLabelStyle: {
          fontFamily: 'Kanit-Regular',
          fontSize: 11,
        },

        // รูปแบบแถบเมนูล่าง
        tabBarStyle: {
          backgroundColor: TAB_BAR_BG_COLOR,
          borderTopColor: TAB_BAR_BORDER_COLOR,
          height: 68,
          paddingTop: 8,
          paddingBottom: 8,
        },
      }}
    >
      {/* แท็บหน้าหลัก */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'หน้าหลัก',
          tabBarLabel: 'หน้าหลัก',
          tabBarIcon: ({ color, focused }) =>
            focused ? (
              <MaterialIconSolid name="home" size={28} color={color} />
            ) : (
              <MaterialSymbol name="home" size={28} color={color} />
            ),
        }}
      />

      {/* แท็บประวัติเหตุการณ์ */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'ประวัติ',
          tabBarLabel: 'ประวัติ',
          tabBarIcon: ({ color, focused }) =>
            focused ? (
              <MaterialIconSolid name="history" size={28} color={color} />
            ) : (
              <MaterialSymbol name="history" size={28} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}
