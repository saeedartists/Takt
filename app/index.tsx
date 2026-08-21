import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { resolveSessionGate } from '@/lib/auth-session';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useTokens } from '@/theme/use-tokens';

export default function IndexRedirect() {
  const router = useRouter();
  const { c } = useTokens();

  useEffect(() => {
    let active = true;

    const run = async () => {
      const consent = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
      const gate = await resolveSessionGate();
      if (!active) return;

      if (gate.kind === 'needs-config' || gate.kind === 'backend-unreachable') {
        router.replace('/setup' as never);
        return;
      }

      if (gate.kind === 'unauthenticated') {
        router.replace('/auth/sign-in' as never);
        return;
      }

      if (consent === 'accepted') {
        router.replace('/(tabs)/today');
      } else {
        router.replace('/consent');
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.background,
      }}
    >
      <ActivityIndicator />
    </View>
  );
}
