import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  LoadingState,
  MIN_TOUCH_TARGET,
  MetricTile,
  PageHeader,
  PageShell,
  SectionHeader,
  Sparkline,
  Stack,
  radius,
  spacing,
  typography,
  useTokens,
  categoryColors,
} from '@/components/ui';
import { ovokFetch } from '@/lib/ovok-fetch';

/*
 * Summary screen — the reference implementation of this scaffold's
 * conventions, and the mobile mirror of the web scaffold's app/page.tsx.
 * Read this before writing a new screen.
 *
 * Demonstrates:
 *   - PageShell + PageHeader for chrome
 *   - MetricTile for a headline number, category-coloured
 *   - Sparkline for trend (react-native-svg, no charting dep)
 *   - ListGroup / ListRow for the browse pattern
 *   - The four render states: loading -> error -> empty -> content
 *
 * That last point matters most. A screen that only renders content is
 * how an app ends up blank when a fetch fails.
 *
 * Data comes from the in-memory FHIR store while EXPO_PUBLIC_OVOK_MOCK=1
 * (src/lib/mock-server.ts). The same queries hit a live tenant unchanged
 * once the flag is unset.
 */

type Bundle<T> = { total: number; entry?: Array<{ resource: T }> };

type Patient = {
  id: string;
  name?: Array<{ given?: string[]; family?: string }>;
  birthDate?: string;
  gender?: string;
};

type Observation = {
  id: string;
  effectiveDateTime?: string;
  component?: Array<{
    code?: { coding?: Array<{ code?: string }> };
    valueQuantity?: { value?: number };
  }>;
};

const fullName = (p: Patient): string => {
  const n = p.name?.[0];
  return [n?.given?.join(' '), n?.family].filter(Boolean).join(' ') || 'Unnamed';
};

const initials = (name: string): string =>
  name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('');

const componentValue = (o: Observation, loinc: string): number | undefined =>
  o.component?.find((c) => c.code?.coding?.some((x) => x.code === loinc))
    ?.valueQuantity?.value;

const formatFhirDate = (value: string): string => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString();
};

export default function SummaryScreen() {
  const { c } = useTokens();

  const patients = useQuery<Bundle<Patient>>({
    queryKey: ['Patient', 'roster'],
    queryFn: () =>
      ovokFetch<Bundle<Patient>>('/fhir/R4/Patient?_count=10&_sort=name'),
  });

  const bloodPressure = useQuery<Bundle<Observation>>({
    queryKey: ['Observation', 'bp', 'pat-001'],
    queryFn: () =>
      ovokFetch<Bundle<Observation>>(
        '/fhir/R4/Observation?patient=pat-001&code=85354-9&_sort=date',
      ),
  });

  // `entry` is ABSENT (not empty) on a zero-result Bundle — real FHIR
  // behaviour, so always default it.
  const roster = patients.data?.entry ?? [];
  const readings = bloodPressure.data?.entry ?? [];
  const systolic = readings
    .map((e) => componentValue(e.resource, '8480-6'))
    .filter((v): v is number => typeof v === 'number');
  const latest = readings[readings.length - 1]?.resource;
  const latestSys = latest ? componentValue(latest, '8480-6') : undefined;
  const latestDia = latest ? componentValue(latest, '8462-4') : undefined;
  const firstSys = systolic[0];
  const lastSys = systolic[systolic.length - 1];

  return (
    <PageShell>
      <PageHeader
        title="Summary"
        subtitle="Today"
        action={
          <Link href="/settings" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => ({
                minHeight: MIN_TOUCH_TARGET,
                justifyContent: 'center',
                paddingHorizontal: spacing(2),
                opacity: pressed ? 0.55 : 1,
              })}
            >
              <Text style={{ color: c.accent, ...typography.subhead }}>Settings</Text>
            </Pressable>
          </Link>
        }
      />

      <Stack>
        <View>
          <SectionHeader title="Vitals" />
          {bloodPressure.isLoading ? (
            <LoadingState label="Loading vitals…" />
          ) : bloodPressure.error ? (
            <ErrorState
              description="Couldn’t load vitals for this patient."
              onRetry={() => void bloodPressure.refetch()}
            />
          ) : readings.length === 0 ? (
            <EmptyState
              title="No vitals recorded"
              description="Blood-pressure readings will appear here once they’re recorded against this patient."
            />
          ) : (
            <MetricTile
              category="heart"
              label="Blood Pressure"
              value={
                latestSys !== undefined && latestDia !== undefined
                  ? `${latestSys.toString()}/${latestDia.toString()}`
                  : '—'
              }
              unit="mmHg"
              timestamp={
                latest?.effectiveDateTime
                  ? new Date(latest.effectiveDateTime).toLocaleDateString()
                  : undefined
              }
              icon={<Text style={{ color: categoryColors.heart }}>♥</Text>}
              trend={
                firstSys !== undefined && lastSys !== undefined
                  ? {
                      direction:
                        lastSys < firstSys ? 'down' : lastSys > firstSys ? 'up' : 'flat',
                      text: `${Math.abs(firstSys - lastSys).toString()} mmHg over ${systolic.length.toString()} readings`,
                    }
                  : undefined
              }
              footer={<Sparkline values={systolic} category="heart" />}
            />
          )}
        </View>

        <View>
          <SectionHeader title="Patients" />
          {patients.isLoading ? (
            <LoadingState label="Loading patients…" />
          ) : patients.error ? (
            <ErrorState
              description="Couldn’t load the patient roster."
              onRetry={() => void patients.refetch()}
            />
          ) : roster.length === 0 ? (
            <EmptyState
              title="No patients yet"
              description="Patients added to this project will appear here."
            />
          ) : (
            <ListGroup>
              {roster.map(({ resource }, i) => {
                const name = fullName(resource);
                return (
                  <ListRow
                    key={resource.id}
                    isFirst={i === 0}
                    title={name}
                    subtitle={
                      resource.birthDate
                        ? `Born ${formatFhirDate(resource.birthDate)}`
                        : undefined
                    }
                    value={resource.gender}
                    leading={
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radius.full,
                          backgroundColor: `${categoryColors.body}1F`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={[
                            typography.footnote,
                            { color: categoryColors.body, fontWeight: '600' },
                          ]}
                        >
                          {initials(name)}
                        </Text>
                      </View>
                    }
                  />
                );
              })}
            </ListGroup>
          )}
          <View style={{ height: spacing(1) }} />
        </View>
      </Stack>
    </PageShell>
  );
}
