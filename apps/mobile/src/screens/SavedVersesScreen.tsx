import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { HeaderIconButton, ScreenHeader } from '@/components/ScreenHeader';
import type { ProfileStackParamList } from '@/navigation/RootTabs';
import { useBookmarksStore } from '@/store/bookmarksStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import type { SavedVerse } from '@/types/api';

type Filter = 'all' | 'highlighted' | 'notes';

type Props = NativeStackScreenProps<ProfileStackParamList, 'SavedVerses'>;

export function SavedVersesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const { verses, loading, load, remove } = useBookmarksStore();

  const [filter, setFilter] = useState<Filter>('all');

  const reload = useCallback(() => load(filter), [filter, load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = verses.filter((v) => {
    if (filter === 'highlighted') return !!v.highlight_color;
    if (filter === 'notes') return !!v.note;
    return true;
  });

  const filters: { key: Filter; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
    { key: 'all', label: t('bookmarks.all'), icon: 'bookmark-outline' },
    { key: 'highlighted', label: t('bookmarks.highlighted'), icon: 'format-color-fill' },
    { key: 'notes', label: t('bookmarks.withNotes'), icon: 'note-text-outline' },
  ];

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader
        title={t('bookmarks.title')}
        onBack={() => navigation.goBack()}
      />

      <XStack px="$4" py="$3" gap="$2">
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <XStack
              key={f.key}
              px="$3"
              py="$2"
              rounded={18}
              bg={active ? c.accent : 'transparent'}
              borderWidth={1}
              borderColor={active ? c.accent : c.border}
              items="center"
              gap="$1"
              onPress={() => setFilter(f.key)}
              pressStyle={{ opacity: 0.7 }}
            >
              <MaterialCommunityIcons
                name={f.icon}
                size={14}
                color={active ? (c.bg as any) : (c.muted as any)}
              />
              <Text color={active ? (c.bg as any) : (c.strong as any)} fontSize={12}>
                {f.label}
              </Text>
            </XStack>
          );
        })}
      </XStack>

      <Separator borderColor={c.border} mx="$4" />

      {loading && verses.length === 0 ? (
        <YStack flex={1} items="center" justify="center">
          <Spinner size="large" color={c.accent} />
        </YStack>
      ) : filtered.length === 0 ? (
        <YStack flex={1} items="center" justify="center" px="$6" gap="$3">
          <MaterialCommunityIcons name="bookmark-off-outline" size={48} color={c.muted} />
          <Text color={c.muted} text="center" fontSize={15}>
            {t('bookmarks.empty')}
          </Text>
        </YStack>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />
          }
        >
          {filtered.map((verse) => (
            <SavedVerseRow
              key={verse.id}
              verse={verse}
              onDelete={remove}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SavedVerseRow({
  verse,
  onDelete,
}: {
  verse: SavedVerse;
  onDelete: (entityId: string) => Promise<void>;
}) {
  const c = useAppTheme();

  return (
    <YStack
      py="$3"
      px="$2"
      borderBottomWidth={1}
      borderBottomColor={c.border}
      gap="$2"
    >
      <XStack items="center" gap="$2">
        {verse.highlight_color && (
          <View
            width={10}
            height={10}
            rounded={5}
            style={{ backgroundColor: verse.highlight_color }}
          />
        )}
        <Text color={c.accent} fontSize={12} fontWeight="600" flex={1} numberOfLines={1}>
          {verse.reference || verse.entity_id}
        </Text>
        <HeaderIconButton
          icon="delete-outline"
          onPress={() => onDelete(verse.entity_id)}
        />
      </XStack>
      <Text color={c.text} fontFamily={serif} fontSize={15} lineHeight={22} numberOfLines={3}>
        {verse.verse_text}
      </Text>
      {verse.note && (
        <XStack gap="$1" items="center" mt="$1">
          <MaterialCommunityIcons name="note-text-outline" size={12} color={c.accentDim} />
          <Text color={c.accentDim} fontSize={12} fontStyle="italic" flex={1} numberOfLines={2}>
            {verse.note}
          </Text>
        </XStack>
      )}
    </YStack>
  );
}
