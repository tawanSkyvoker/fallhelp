import React from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';

interface MaterialIconSolidProps {
  name: string;
  size?: number;
  color?: string;
  style?: TextStyle;
  testID?: string;
}

export function MaterialIconSolid({
  name,
  size = 24,
  color = '#000000',
  style,
  testID,
}: MaterialIconSolidProps) {
  return (
    <Text
      testID={testID}
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
    fontFamily: 'MaterialSymbolsFilled',
    fontWeight: 'normal',
    fontStyle: 'normal',
    includeFontPadding: false,
    textAlignVertical: 'center',
    textAlign: 'center',
  },
});
