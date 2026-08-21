import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function MedicationEditAliasScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (!id) return;
    router.replace({ pathname: '/medications/[id]', params: { id } });
  }, [id, router]);

  return null;
}
