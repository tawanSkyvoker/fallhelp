import React from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';

interface MaterialSymbolProps {
  name: string;
  size?: number;
  color?: string;
  style?: TextStyle;
}

export function MaterialSymbol({ name, size = 24, color = '#000000', style }: MaterialSymbolProps) {
  return (
    <Text
      style={[
        styles.icon,
        {
          fontSize: size,
          color: color,
        },
        style,
      ]}
      allowFontScaling={false}
    >
      {name}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontFamily: 'MaterialSymbolsOutlined',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
});
