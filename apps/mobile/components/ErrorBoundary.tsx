/**
 * ErrorBoundary.tsx
 *
 * Boundary สำหรับดัก error ที่เกิดระหว่าง render แล้วแสดง UI สำรองแทนหน้าที่พัง
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ครอบ children เพื่อดัก render error ใน React tree ด้านใน
 * - บันทึก error ลง logger เพื่อช่วยตรวจสอบปัญหา
 * - แสดง fallback UI หรือหน้าข้อผิดพลาดมาตรฐาน
 * - เปิดให้ผู้ใช้กดลองใหม่เพื่อ reset boundary
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialSymbol } from './MaterialSymbol';
import { SafeAreaView } from 'react-native-safe-area-context';

import Logger from '../utils/logger';

import KanitText from './KanitText';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  // React เรียก method นี้ทันทีเมื่อ children ด้านในเกิด render error
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // เก็บ error ไว้ตรวจสอบต่อใน logger
    // ไฟล์ถัดไป: utils/logger.ts
    Logger.error('Uncaught error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReset = () => {
    // ล้างสถานะ error เพื่อให้ ErrorBoundary ลอง render children ใหม่
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      // ถ้าหน้าหรือ component ส่ง fallback มาเอง ให้ใช้ fallback นั้นแทน UI กลาง
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <SafeAreaView className="flex-1 bg-white">
          <ScrollView contentContainerClassName="flex-grow justify-center items-center p-6">
            <View className="w-24 h-24 bg-red-100 rounded-full items-center justify-center mb-6">
              <MaterialSymbol name="error" size={64} color="#EF4444" />
            </View>

            <KanitText weight="medium" className="text-2xl text-gray-900 mb-2">
              เกิดข้อผิดพลาด
            </KanitText>

            <KanitText className="text-base text-gray-600 text-center mb-8">
              ขออภัย ระบบเกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง
            </KanitText>

            {/* แสดงรายละเอียด error เฉพาะตอน dev เพื่อไม่ให้ผู้ใช้จริงเห็นข้อความระบบ */}
            {__DEV__ && this.state.error && (
              <View className="w-full bg-gray-100 p-4 rounded-xl mb-6">
                <KanitText className="text-xs text-red-600 font-mono mb-2">
                  {this.state.error.toString()}
                </KanitText>
              </View>
            )}

            <TouchableOpacity
              onPress={this.handleReset}
              className="bg-red-500 py-3 px-8 rounded-xl shadow-lg active:bg-red-600"
            >
              <KanitText weight="medium" className="text-white text-lg">
                ลองใหม่อีกครั้ง
              </KanitText>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}
