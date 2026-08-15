import {
  DeleteAccountButton,
  LogoutButton,
  ProfileForm,
  SettingList,
} from '@ovok/native';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { env } from '@/lib/env';
import { ovokClient } from '@/lib/ovok-client';

/*
 * Settings screen — powered by @ovok/native primitives (M2.b).
 *
 * <ProfileForm> handles the profile display + edit flow, including the
 * FHIR JSON-Patch dance for name/birthDate/etc updates.
 * <LogoutButton> clears the session token and navigates to login.
 * <DeleteAccountButton> gates on a confirmation modal + calls the
 * delete-account endpoint.
 * <SettingList> renders arbitrary rows for tenant/API metadata.
 *
 * All three read the OvokClient from <OvokProvider> at the app root.
 */
export default function SettingsScreen() {
  /*
   * `ProfileForm` requires a `fields` array — it does not fetch the
   * patient itself. Each `name` is a JSON-Patch path fragment into the
   * FHIR Patient, and `value` seeds the initial form state; on submit
   * the SDK diffs initial-vs-current per field and PATCHes only what
   * changed. So we have to read the active profile first.
   */
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ovok', 'profile'],
    queryFn: () => ovokClient.getProfileAsync(),
  });

  const patient = profile as
    | {
        name?: Array<{ given?: string[]; family?: string }>;
        telecom?: Array<{ value?: string }>;
        birthDate?: string;
        gender?: string;
      }
    | undefined;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Profile</Text>
      {/*
       * Three distinct states, deliberately not collapsed into two.
       * `getProfileAsync()` is typed `Promise<ProfileResource |
       * undefined>` — undefined is the documented signed-out result —
       * but it still REJECTS on a network/server failure. Folding the
       * rejection into the signed-out branch would tell a signed-in
       * user with a flaky connection to "sign in", and would hide a
       * real outage behind an empty state.
       */}
      {isLoading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={styles.error}>
          Couldn&apos;t load your profile. Pull down to retry.
        </Text>
      ) : patient ? (
        <ProfileForm
          fields={[
            {
              name: 'name[0].given[0]',
              label: 'First name',
              type: 'text',
              value: patient.name?.[0]?.given?.[0] ?? '',
            },
            {
              name: 'name[0].family',
              label: 'Last name',
              type: 'text',
              value: patient.name?.[0]?.family ?? '',
            },
            {
              name: 'telecom[0].value',
              label: 'Email',
              type: 'text',
              value: patient.telecom?.[0]?.value ?? '',
            },
            {
              name: 'birthDate',
              label: 'Date of birth',
              type: 'date',
              value: patient.birthDate ?? '',
            },
          ]}
        />
      ) : (
        <Text style={styles.empty}>Sign in to view your profile.</Text>
      )}

      <Text style={styles.heading}>Workspace</Text>
      <SettingList
        data={[
          {
            title: 'Tenant',
            subtitle: env.ovokTenantCode || 'Not configured',
          },
          {
            title: 'API URL',
            subtitle: env.ovokApiUrl,
          },
        ]}
      />

      <Text style={styles.heading}>Account</Text>
      <View style={styles.stack}>
        <LogoutButton />
        <DeleteAccountButton />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  heading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  stack: { gap: 12 },
  empty: { fontSize: 14, color: '#667085' },
  error: { fontSize: 14, color: '#AF261D' },
});
