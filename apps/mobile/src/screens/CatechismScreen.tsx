import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';

import { fetchCatechism } from '@/api/client';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import type { CatechismParagraph } from '@/types/api';

const PAGE = 50;

// The Catechism reader: an infinite-scroll list of numbered paragraphs. The
// backend serves 50 at a time; reaching the end loads the next page.
export function CatechismScreen() {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();

  const [items, setItems] = useState<CatechismParagraph[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasMore = useRef(true);
  const nextFrom = useRef(1);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore.current) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCatechism(nextFrom.current, PAGE);
      setItems((prev) => [...prev, ...res.paragraphs]);
      hasMore.current = res.has_more;
      if (res.paragraphs.length > 0) {
        nextFrom.current = res.paragraphs[res.paragraphs.length - 1].number + 1;
      }
    } catch {
      setError(t('catechism.loadError'));
    } finally {
      setLoading(false);
    }
  }, [loading, t]);

  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('catechism.title')} />
      {error && items.length === 0 ? (
        <Text color={c.muted} self="center" mt="$8" px="$8" text="center">
          {error}
        </Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => String(p.number)}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
            <XStack gap="$3" items="flex-start">
              <Text color={c.accent} fontFamily={serif} fontSize={13} width={36}>
                {item.number}
              </Text>
              <Text color={c.text} fontFamily={serif} fontSize={15} lineHeight={24} flex={1}>
                {item.text}
              </Text>
            </XStack>
          )}
          ListFooterComponent={
            loading ? (
              <Spinner mt="$4" size="large" color={c.accent} />
            ) : (
              <YStack height={8} />
            )
          }
        />
      )}
    </View>
  );
}
