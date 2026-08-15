import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type SettingsRowProps = {
  label: string;
  description?: string;
  action?: ReactNode;
};

export const SettingsRow = ({
  label,
  description,
  action,
}: SettingsRowProps) => (
  <View style={styles.row}>
    <View style={styles.text}>
      <Text style={styles.label}>{label}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
    {action ? <View style={styles.action}>{action}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 15, fontWeight: '500', color: '#0f172a' },
  description: { fontSize: 12, color: '#64748b' },
  action: { flexShrink: 0 },
});
