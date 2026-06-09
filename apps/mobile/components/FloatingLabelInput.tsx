/**
 * FloatingLabelInput.tsx
 *
 * ช่องกรอกข้อมูลแบบ floating label สำหรับฟอร์มหลักของแอป
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดง input พร้อม label ที่ลอยขึ้นเมื่อ focus หรือมีค่า
 * - รองรับ error, required, password และ multiline
 * - ใช้ TextInput ของ react-native-paper แต่ render label เองเพื่อคุมฟอนต์ไทย
 * - เปิดให้หน้าที่เรียกใช้ปรับสี focus และสถานะ active ได้
 */

import React from 'react';
import {
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
  Animated,
  TextInput as NativeTextInput,
} from 'react-native';
import { TextInput, useTheme } from 'react-native-paper';

import KanitText from './KanitText';
import { MaterialSymbol } from './MaterialSymbol';

interface FloatingLabelInputProps extends Omit<
  React.ComponentProps<typeof TextInput>,
  'error' | 'label'
> {
  label: string | React.ReactNode;
  error?: string | undefined;
  containerStyle?: StyleProp<ViewStyle>;
  isPassword?: boolean;
  isRequired?: boolean;
  accentColor?: string;
  forceFocus?: boolean;
  forceActive?: boolean;
  requiredIndicatorPosition?: 'prefix' | 'suffix';
  testID?: string;
  labelBackgroundColor?: string;
  showPasswordToggle?: boolean;
  inputRef?: React.RefObject<NativeTextInput | null>;
}

export const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label,
  error,
  containerStyle,
  isPassword = false,
  isRequired = false,
  accentColor,
  forceFocus = false,
  forceActive = false,
  requiredIndicatorPosition = 'suffix',
  value,
  style,
  multiline,
  labelBackgroundColor = '#FFFFFF',
  showPasswordToggle = true,
  placeholder,
  ...props
}) => {
  const theme = useTheme();

  // ใช้ควบคุมการแสดงหรือซ่อนรหัสผ่าน
  const [showPassword, setShowPassword] = React.useState(false);

  // เก็บสถานะ focus ภายใน component แล้วรวมกับ forceFocus จากภายนอก
  const [isFocusedInternal, setIsFocusedInternal] = React.useState(false);

  // animatedValue ใช้เลื่อน label ขึ้นลงตาม focus และ value
  const [animatedValue] = React.useState(() => new Animated.Value(value ? 1 : 0));

  const isFocused = forceFocus || isFocusedInternal;
  const isActive = forceActive || isFocused;
  const focusColor = accentColor || theme.colors.primary;
  const inputAccentColor = error ? theme.colors.error : focusColor;
  const inputHeight = multiline ? 120 : 56;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused || value ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value, animatedValue]);

  const labelStyle: Animated.AnimatedProps<StyleProp<TextStyle>> = {
    position: 'absolute',
    left: 12,
    top: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [16, -10],
    }),
    fontSize: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [16, 12],
    }),
    backgroundColor: labelBackgroundColor,
    paddingHorizontal: 4,
    // lineHeight สูงไว้เพื่อกันสระลอยของภาษาไทยโดนตัด
    lineHeight: 24,
    zIndex: 10,
  };

  // สี label เปลี่ยนตาม error, active และการมีค่าของ input
  const labelColor = error
    ? theme.colors.error
    : isActive
      ? focusColor
      : value
        ? '#a3a6af'
        : theme.colors.onSurfaceVariant;

  const displayLabel = typeof label === 'string' ? label : '';

  // ใช้ ref เพื่อให้กด label แล้ว focus กลับไปที่ input ได้
  const internalRef = React.useRef<NativeTextInput>(null);
  const resolvedRef = props.inputRef || internalRef;

  const multilineProps =
    multiline !== undefined
      ? { multiline, numberOfLines: multiline ? 4 : 1 }
      : { numberOfLines: 1 };

  return (
    <View style={[{ marginBottom: 16, marginTop: 4 }, containerStyle]}>
      {/* แยก label ออกมาด้านนอกเพื่อคุมตำแหน่งและฟอนต์ไทยได้เสถียรกว่า label ของ Paper */}
      <Animated.Text
        style={[
          labelStyle,
          {
            fontFamily: 'Kanit-Regular',
            color: labelColor,
          },
        ]}
        numberOfLines={1}
        onPress={() => resolvedRef.current?.focus()}
        suppressHighlighting={true}
      >
        {isRequired && requiredIndicatorPosition === 'prefix' ? (
          <KanitText style={{ color: '#EF4444' }}>*</KanitText>
        ) : null}
        {displayLabel}
        {isRequired && requiredIndicatorPosition === 'suffix' ? (
          <KanitText style={{ color: '#EF4444' }}> *</KanitText>
        ) : null}
      </Animated.Text>

      <TextInput
        ref={resolvedRef as unknown as React.ComponentProps<typeof TextInput>['ref']}
        testID={props.testID || 'floating-label-input'}
        mode="outlined"
        // ซ่อน label ของ React Native Paper เพราะเรา render label เองอยู่ด้านนอก
        label=""
        error={!!error}
        secureTextEntry={isPassword && !showPassword}
        onFocus={(e) => {
          setIsFocusedInternal(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocusedInternal(false);
          props.onBlur?.(e);
        }}
        theme={{
          ...theme,
          colors: {
            ...theme.colors,
            primary: inputAccentColor,
            error: theme.colors.error,
          },
        }}
        activeOutlineColor={inputAccentColor}
        outlineColor={error ? theme.colors.error : isActive ? focusColor : '#E5E7EB'}
        cursorColor={inputAccentColor}
        selectionColor={inputAccentColor}
        textColor={theme.colors.onSurface}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        outlineStyle={{
          borderRadius: 12,
        }}
        style={[
          {
            backgroundColor: '#FFFFFF',
            fontSize: 16,
            lineHeight: 24,
            paddingVertical: 0,
            height: multiline ? undefined : inputHeight,
            minHeight: inputHeight,
            includeFontPadding: false,
          },
          style,
        ]}
        contentStyle={
          [
            multiline
              ? {
                  paddingTop: 16,
                  paddingBottom: 16,
                  textAlignVertical: 'top',
                }
              : {
                  textAlignVertical: 'center',
                },
          ] as StyleProp<TextStyle>
        }
        {...multilineProps}
        {...(value !== undefined ? { value } : {})}
        right={
          isPassword && showPasswordToggle ? (
            <TextInput.Icon
              testID="password-toggle-icon"
              icon={({ size, color }) => (
                <MaterialSymbol
                  name={showPassword ? 'visibility_off' : 'visibility'}
                  size={size}
                  color={color}
                />
              )}
              color={theme.colors.onSurfaceVariant}
              onPress={() => setShowPassword(!showPassword)}
              forceTextInputFocus={false}
            />
          ) : null
        }
        autoCapitalize={props.autoCapitalize}
        autoCorrect={props.autoCorrect ?? !isPassword}
        placeholder={isFocused ? placeholder || '' : ''}
        {...props}
      />

      {error && (
        <KanitText className="font-kanit text-red-500 text-xs mt-1 ml-1">{error}</KanitText>
      )}
    </View>
  );
};
