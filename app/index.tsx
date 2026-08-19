import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useTokens } from '@/theme/use-tokens';

export default function IndexRedirect() {
  const router = useRouter();
  const { c } = useTokens();

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(CONSENT_STORAGE_KEY).then((value) => {
      if (!active) return;
      if (value === 'accepted') {
        router.replace('/(tabs)/today');
      } else {
        router.replace('/consent');
      }
    });
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
