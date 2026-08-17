import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Text, View, XStack, YStack } from 'tamagui';

import { useBookmarksStore } from '@/store/bookmarksStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import type { Verse } from '@/types/api';
import { ShareVerseCard } from '@/components/ShareVerseCard';

const HIGHLIGHT_COLORS = [
  { label: 'Gold', value: '#F5D063' },
  { label: 'Rose', value: '#E88B8B' },
  { label: 'Blue', value: '#7BAFD4' },
  { label: 'Green', value: '#8BC68B' },
  { label: 'Violet', value: '#B39DDB' },
];

type Props = {
  visible: boolean;
  verse: Verse | null;
  bookName: string;
  chapter: number;
  onClose: () => void;
};

export function VerseContextMenu({ visible, verse, bookName, chapter, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const { save, remove, toggleHighlight, updateNote, byEntity } = useBookmarksStore();

  const [noteInput, setNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [shareVisible, setShareVisible] = useState(false);

  if (!verse) return null;

  const saved = byEntity[verse.entity_id];
  const reference = `${bookName} ${chapter}:${verse.number}`;
  const isSaved = !!saved;

  const handleSave = async () => {
    try {
      await save({
        entity_id: verse.entity_id,
        reference,
        verse_text: verse.text,
      });
      onClose();
    } catch {
      Alert.alert(t('bookmarks.saveError'));
    }
  };

  const handleRemove = async () => {
    try {
      await remove(verse.entity_id);
      onClose();
    } catch {
      Alert.alert(t('bookmarks.removeError'));
    }
  };

  const handleHighlight = async (color: string) => {
    try {
      await toggleHighlight(verse.entity_id, reference, verse.text, color);
      onClose();
    } catch {
      Alert.alert(t('bookmarks.highlightError'));
    }
  };

  const handleSaveNote = async () => {
    try {
      await updateNote(verse.entity_id, reference, verse.text, noteText);
      setNoteInput(false);
      onClose();
    } catch {
      Alert.alert(t('bookmarks.noteError'));
    }
  };

  const openNoteInput = () => {
    setNoteText(saved?.note ?? '');
    setNoteInput(true);
  };

  return (
    <>
      <View
        flex={1}
        bg="rgba(0,0,0,0.5)"
        style={{ ...StyleSheet.absoluteFillObject, zIndex: 100 } as any}
        onPress={onClose}
        pressStyle={{ opacity: 1 }}
        display={visible ? 'flex' : 'none'}
      >
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          }}
          bg={c.bgElevated}
          borderTopLeftRadius={24}
          borderTopRightRadius={24}
          borderWidth={1}
          borderColor={c.border}
          pb={insets.bottom + 8}
          pt="$4"
          px="$4"
          gap="$1"
          onPress={(e: any) => e.stopPropagation()}
        >
          <XStack items="center" gap="$2" px="$2" pb="$2">
            <MaterialCommunityIcons name="book-open-variant" size={18} color={c.accent} />
            <Text color={c.strong} fontSize={14} fontWeight="600" flex={1} numberOfLines={1}>
              {reference}
            </Text>
          </XStack>
          <Text
            color={c.text}
            fontFamily={serif}
            fontSize={14}
            lineHeight={21}
            px="$2"
            pb="$3"
            numberOfLines={3}
          >
            {verse.text}
          </Text>
          <Separator borderColor={c.border} />

          {noteInput ? (
            <YStack gap="$3" pt="$3">
              <Text color={c.strong} fontSize={13} fontWeight="600" px="$2">
                {t('bookmarks.addNote')}
              </Text>
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder={t('bookmarks.notePlaceholder')}
                placeholderTextColor={c.muted}
                multiline
                numberOfLines={3}
                style={{
                  color: c.text,
                  backgroundColor: c.bg,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: c.border,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 15,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />
              <XStack gap="$2" justify="flex-end">
                <XStack
                  px="$4"
                  py="$2"
                  rounded={10}
                  borderWidth={1}
                  borderColor={c.border}
                  onPress={() => setNoteInput(false)}
                  pressStyle={{ opacity: 0.7 }}
                >
                  <Text color={c.strong} fontSize={14}>
                    {t('common.cancel')}
                  </Text>
                </XStack>
                <XStack
                  px="$4"
                  py="$2"
                  rounded={10}
                  bg={c.accent}
                  onPress={handleSaveNote}
                  pressStyle={{ opacity: 0.7 }}
                >
                  <Text color={c.bg} fontSize={14} fontWeight="600">
                    {t('bookmarks.saveNote')}
                  </Text>
                </XStack>
              </XStack>
            </YStack>
          ) : (
            <YStack gap="$1" pt="$2">
              <ActionRow
                icon={isSaved ? 'bookmark-check' : 'bookmark-outline'}
                label={isSaved ? t('bookmarks.saved') : t('bookmarks.save')}
                color={isSaved ? c.accent : c.strong}
                onPress={isSaved ? handleRemove : handleSave}
              />

              <YStack>
                <ActionRow
                  icon="format-color-fill"
                  label={t('bookmarks.highlight')}
                  color={c.strong}
                  onPress={() => {}}
                />
                <XStack px="$8" pb="$2" gap="$3" items="center">
                  {HIGHLIGHT_COLORS.map((hc) => (
                    <View
                      key={hc.value}
                      width={28}
                      height={28}
                      rounded={14}
                      style={{ backgroundColor: hc.value }}
                      borderWidth={2}
                      borderColor={
                        saved?.highlight_color === hc.value ? c.strong : 'transparent'
                      }
                      onPress={() => handleHighlight(hc.value)}
                      pressStyle={{ opacity: 0.7 }}
                    />
                  ))}
                </XStack>
              </YStack>

              <ActionRow
                icon="note-text-outline"
                label={saved?.note ? t('bookmarks.editNote') : t('bookmarks.addNote')}
                color={c.strong}
                onPress={openNoteInput}
              />

              <Separator borderColor={c.border} my="$1" />

              <ActionRow
                icon="share-variant-outline"
                label={t('bookmarks.share')}
                color={c.strong}
                onPress={() => {
                  setShareVisible(true);
                }}
              />
            </YStack>
          )}
        </View>
      </View>

      <ShareVerseCard
        visible={shareVisible}
        verse={verse}
        bookName={bookName}
        chapter={chapter}
        onClose={() => {
          setShareVisible(false);
          onClose();
        }}
      />
    </>
  );
}

function ActionRow({
  icon,
  label,
  color,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  color: string;
  onPress: () => void;
}) {
  const c = useAppTheme();
  return (
    <XStack
      items="center"
      gap="$3"
      px="$3"
      py="$3"
      rounded={10}
      onPress={onPress}
      pressStyle={{ bg: c.bg }}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <MaterialCommunityIcons name={icon} size={22} color={color as any} />
      <Text color={color as any} fontSize={15}>
        {label}
      </Text>
    </XStack>
  );
}
