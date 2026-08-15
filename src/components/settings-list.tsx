import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export type SettingsListProps = { children: ReactNode };

export const SettingsList = ({ children }: SettingsListProps) => (
  <View style={styles.container}>{children}</View>
);

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
});
