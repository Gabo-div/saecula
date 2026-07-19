import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';

import { fetchTimeline } from '@/api/client';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useLanguageStore } from '@/store/languageStore';
import { colors, serif } from '@/theme/colors';
import type { TimelineNode } from '@/types/api';

// Demo window: Apostolic era through the modern Catechism.
const START_YEAR = -100;
const END_YEAR = 2026;

function formatYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BC` : `AD ${year}`;
}

// Explore = the master chronological timeline over the concept graph.
export function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);

  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTimeline(START_YEAR, END_YEAR);
      setNodes(data.nodes);
    } catch {
      setError(t('explore.loadError'));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View flex={1} bg={colors.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('explore.title')} />

      {loading && <Spinner mt="$4" size="large" color={colors.gold} />}
      {error && (
        <Text color={colors.error} self="center" mt="$4">
          {error}
        </Text>
      )}

      <FlatList
        data={nodes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <YStack
            p="$4"
            rounded="$6"
            bg={colors.bgElevated}
            borderWidth={1}
            borderColor={colors.border}
            gap="$1"
          >
            <XStack justify="space-between">
              <Text fontSize={11} fontWeight="700" color={colors.gold} letterSpacing={1}>
                {item.labels.join(', ').toUpperCase()}
              </Text>
              <Text fontSize={11} color={colors.textMuted}>
                {formatYear(item.start_year)}
                {item.end_year != null && item.end_year !== item.start_year
                  ? ` – ${formatYear(item.end_year)}`
                  : ''}
              </Text>
            </XStack>

            <Text fontSize={16} fontWeight="600" color={colors.cream} fontFamily={serif}>
              {item.id}
            </Text>
            {item.era ? (
              <Text fontSize={11} color={colors.textMuted}>
                {item.era}
              </Text>
            ) : null}

            {item.text ? (
              <Text color={colors.text} mt="$2" fontFamily={serif} fontSize={15} lineHeight={24}>
                {item.text.raw_content}
              </Text>
            ) : (
              <Text color={colors.textMuted} fontStyle="italic" mt="$2" fontSize={13}>
                {t('explore.noText')}
              </Text>
            )}
          </YStack>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text color={colors.textMuted} self="center" mt="$8">
              {t('explore.empty')}
            </Text>
          ) : null
        }
      />
    </View>
  );
}
