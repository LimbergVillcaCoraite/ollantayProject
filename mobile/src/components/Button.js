import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function Button({ 
  title, 
  onPress, 
  loading = false, 
  disabled = false,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  icon,
  style,
  textStyle,
}) {
  const { colors } = useTheme();

  const variants = {
    primary: { bg: colors.primary, text: '#ffffff' },
    secondary: { bg: colors.secondary, text: '#ffffff' },
    outline: { bg: 'transparent', text: colors.primary, border: colors.primary },
    danger: { bg: colors.error, text: '#ffffff' },
    success: { bg: colors.success, text: '#ffffff' },
  };

  const sizes = {
    small: { height: 36, fontSize: 14, paddingH: 12 },
    medium: { height: 48, fontSize: 16, paddingH: 16 },
    large: { height: 56, fontSize: 18, paddingH: 20 },
  };

  const variantStyle = variants[variant];
  const sizeStyle = sizes[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: variantStyle.bg,
          height: sizeStyle.height,
          paddingHorizontal: sizeStyle.paddingH,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: variantStyle.border,
          opacity: isDisabled ? 0.5 : 1,
          width: fullWidth ? '100%' : 'auto',
        },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text
            style={[
              styles.text,
              {
                color: variantStyle.text,
                fontSize: sizeStyle.fontSize,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontWeight: '600',
  },
});
