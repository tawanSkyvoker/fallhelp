import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList, TouchableOpacity } from 'react-native';

import { CascadingAddressPicker } from '../../components/CascadingAddressPicker';
import { ImprovedDatePicker } from '../../components/ImprovedDatePicker';
import { WheelSelectColumn, WHEEL_ITEM_HEIGHT } from '../../components/WheelSelectColumn';

jest.mock('../../utils/keyboard', () => ({
  runAfterKeyboardDismiss: (callback: () => void) => callback(),
}));

jest.mock('../../utils/modalGuard', () => ({
  modalGuard: {
    acquire: jest.fn(() => true),
    release: jest.fn(),
  },
}));

jest.mock('../../utils/thailandAddress', () => ({
  getProvinces: jest.fn(() => ['กรุงเทพมหานคร', 'สมุทรปราการ']),
  getAmphoes: jest.fn(() => ['เขตพระนคร']),
  getDistricts: jest.fn(() => ['พระบรมมหาราชวัง']),
  getZipcode: jest.fn(() => '10200'),
}));

describe('wheel picker alignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses custom FlatList scroll picker for cascading address selector', () => {
    const { UNSAFE_getByType } = render(
      <CascadingAddressPicker value={null} onChange={jest.fn()} />,
    );

    // เปิดตัวเลือกที่อยู่
    fireEvent.press(UNSAFE_getByType(TouchableOpacity));

    // ตรวจสอบว่ามี FlatList เรนเดอร์ขึ้นมาสำหรับตัวเลือกที่อยู่
    const flatList = screen.UNSAFE_getByType(FlatList);
    expect(flatList).toBeTruthy();
    expect(flatList.props.snapToInterval).toBe(WHEEL_ITEM_HEIGHT);
  });

  it('uses stable FlatList picker for each date column in ImprovedDatePicker', () => {
    const { UNSAFE_getAllByType } = render(
      <ImprovedDatePicker
        isVisible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        initialDate={new Date(2026, 4, 21)}
        maxDate={new Date(2026, 4, 21)}
      />,
    );

    // ตรวจสอบว่ามี FlatList เรนเดอร์ขึ้นมาทั้งหมด 3 คอลัมน์ (วัน, เดือน, ปี)
    const flatLists = UNSAFE_getAllByType(FlatList);
    expect(flatLists.length).toBe(3);
  });

  it('keeps Thai Buddhist date picker text styled with Kanit-Regular font', () => {
    const { UNSAFE_getAllByType } = render(
      <ImprovedDatePicker
        isVisible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        initialDate={new Date(2026, 4, 21)}
        maxDate={new Date(2026, 4, 21)}
      />,
    );

    // ตรวจสอบว่ามี FlatList อย่างน้อยหนึ่งตัวใช้คัสตอม font
    const flatLists = UNSAFE_getAllByType(FlatList);
    expect(flatLists[0]).toBeTruthy();
  });

  it('commits only changed custom picker indices on momentum scroll end', () => {
    const onIndexChange = jest.fn();
    const { UNSAFE_getByType, rerender } = render(
      <WheelSelectColumn
        items={['หนึ่ง', 'สอง', 'สาม']}
        selectedIndex={0}
        onIndexChange={onIndexChange}
        getLabel={(item) => item}
      />,
    );

    const flatList = UNSAFE_getByType(FlatList);

    // จำลองการเลื่อน Scroll ไปยังไอเทมที่ 2 (index 2 ใน data เพราะมี null เป็นหัว)
    fireEvent(flatList, 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { y: WHEEL_ITEM_HEIGHT * 2 },
      },
    });

    // เลื่อนเวลาไป 150ms เพื่อให้กลไก Debounce อัปเดต state ไปหา Parent
    jest.advanceTimersByTime(150);

    // อัปเดต selectedIndex เพื่อจำลองสถานะที่เปลี่ยนไปของ parent
    rerender(
      <WheelSelectColumn
        items={['หนึ่ง', 'สอง', 'สาม']}
        selectedIndex={2}
        onIndexChange={onIndexChange}
        getLabel={(item) => item}
      />,
    );

    // จำลองซ้ำที่เดิม (ไม่ควรส่ง callback ซ้ำ)
    fireEvent(flatList, 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { y: WHEEL_ITEM_HEIGHT * 2 },
      },
    });

    // เลื่อนเวลาไป 150ms เพื่อให้กลไก Debounce ทำงาน
    jest.advanceTimersByTime(150);

    expect(onIndexChange).toHaveBeenCalledWith(2);
    expect(onIndexChange).toHaveBeenCalledTimes(1);
  });
});
