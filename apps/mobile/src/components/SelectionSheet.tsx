import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, BackHandler, ScrollView, StyleSheet, TextInput, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { groupLabel } from '@/lib/verseRange';
import { navigationRef } from '@/navigation/ref';
import { useBookmarksStore } from '@/store/bookmarksStore';
import { selectionRangeLabel, useSelectionStore } from '@/store/selectionUiStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import type { SavedVerse } from '@/types/api';

const HIGHLIGHT_COLORS = ['#F5D063', '#E88B8B', '#7BAFD4', '#8BC68B', '#B39DDB'];
const MINI_HEIGHT = 176;

export function SelectionSheet() {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const { toggleHighlight, updateNote, createGroup, verses } = useBookmarksStore();
  const items = useSelectionStore((s) => s.items);
  const headerPrefix = useSelectionStore((s) => s.headerPrefix);
  const sharing = useSelectionStore((s) => s.sharing);
  const setSharing = useSelectionStore((s) => s.setSharing);
  const onCancel = useSelectionStore((s) => s.clear);

  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'saved' | 'related'>('saved');
  const [noteMode, setNoteMode] = useState(false);
  const [noteText, setNoteText] = useState('');

  const expandedHeight = height - insets.top - 24;
  const progress = useSharedValue(0);

  const snapTo = (toExpanded: boolean) => {
    progress.value = withTiming(toExpanded ? 1 : 0, { duration: 220 });
    setExpanded(toExpanded);
    if (!toExpanded) setNoteMode(false);
  };

  // Drag anywhere on the sheet to grow/shrink it.
  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationY < -40 || e.velocityY < -400) runOnJS(snapTo)(true);
      else if (e.translationY > 40 || e.velocityY > 400) runOnJS(snapTo)(false);
    });

  const panelStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [MINI_HEIGHT + insets.bottom, expandedHeight]),
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [0, 0.55]) }));

  // Reset to the mini state whenever the selection empties (cancel / back /
  // after sharing), so a fresh selection always opens minimized.
  useEffect(() => {
    if (items.length === 0) {
      setExpanded(false);
      setNoteMode(false);
      progress.value = 0;
    }
  }, [items.length, progress]);

  // Android hardware back cancels the selection (rather than switching tabs)
  // while the sheet is open.
  useEffect(() => {
    const active = items.length > 0 && !sharing;
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [items.length, sharing, onCancel]);

  if (items.length === 0 || sharing) return null;

  const label = selectionRangeLabel(items, headerPrefix);
  const selectedIds = new Set(items.map((i) => i.entityId));
  const savedForSelection = verses.filter((v) => selectedIds.has(v.entity_id));
  // Collapse group rows into one entry, standalone rows stay individual.
  const savedEntries: { key: string; rows: SavedVerse[] }[] = [];
  const groupSlot: Record<string, number> = {};
  for (const v of savedForSelection) {
    if (v.group_id == null) {
      savedEntries.push({ key: v.id, rows: [v] });
    } else if (groupSlot[v.group_id] === undefined) {
      groupSlot[v.group_id] = savedEntries.length;
      savedEntries.push({ key: v.group_id, rows: [v] });
    } else {
      savedEntries[groupSlot[v.group_id]].rows.push(v);
    }
  }

  const groupVerses = () =>
    items.map((i) => ({ entity_id: i.entityId, reference: i.reference, verse_text: i.text }));

  const applyHighlight = async (color: string) => {
    try {
      if (items.length === 1) {
        const i = items[0];
        await toggleHighlight(i.entityId, i.reference, i.text, color);
      } else {
        await createGroup(groupVerses(), { highlight_color: color });
      }
    } catch {
      Alert.alert(t('bookmarks.highlightError'));
    }
  };

  const applyNote = async () => {
    try {
      if (items.length === 1) {
        const i = items[0];
        await updateNote(i.entityId, i.reference, i.text, noteText);
      } else {
        await createGroup(groupVerses(), { note: noteText });
      }
      setNoteMode(false);
      setNoteText('');
    } catch {
      Alert.alert(t('bookmarks.noteError'));
    }
  };

  return (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, scrimStyle]}
          pointerEvents={expanded ? 'auto' : 'none'}
          onTouchEnd={expanded ? () => snapTo(false) : undefined}
        />

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: c.bgElevated,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderWidth: 1,
                borderColor: c.border,
              },
              panelStyle,
            ]}
          >
            {/* Header: range · cancel */}
            <XStack items="center" px="$4" pt="$3" pb="$2" gap="$2">
              <Text color={c.strong} fontSize={15} fontWeight="700" flex={1} numberOfLines={1}>
                {label}
              </Text>
              <XStack
                px="$3"
                py="$1.5"
                rounded={10}
                bg={c.chip}
                onPress={onCancel}
                pressStyle={{ opacity: 0.7 }}
              >
                <Text color={c.muted} fontSize={13} fontWeight="600">
                  {t('common.cancel')}
                </Text>
              </XStack>
            </XStack>

            {expanded ? (
              <YStack flex={1}>
                <XStack px="$4" pt="$2" gap="$5">
                  {(['saved', 'related'] as const).map((k) => (
                    <YStack key={k} onPress={() => setTab(k)} pb="$2" gap="$1">
                      <Text
                        color={tab === k ? c.strong : c.muted}
                        fontSize={15}
                        fontWeight={tab === k ? '700' : '400'}
                      >
                        {k === 'saved' ? t('bookmarks.title') : t('bookmarks.related')}
                      </Text>
                      <View height={2} rounded={1} bg={tab === k ? c.accent : 'transparent'} />
                    </YStack>
                  ))}
                </XStack>
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
                  {tab === 'related' ? (
                    <Text color={c.muted} fontSize={14} text="center" mt="$6">
                      {t('bookmarks.relatedEmpty')}
                    </Text>
                  ) : savedEntries.length === 0 ? (
                    <Text color={c.muted} fontSize={14} text="center" mt="$6">
                      {t('bookmarks.empty')}
                    </Text>
                  ) : (
                    savedEntries.map((e) => <SavedRow key={e.key} rows={e.rows} />)
                  )}
                </ScrollView>
              </YStack>
            ) : noteMode ? (
              <YStack px="$4" pt="$1" gap="$3">
                <TextInput
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder={t('bookmarks.noteForSelectedPlaceholder')}
                  placeholderTextColor={c.muted}
                  multiline
                  autoFocus
                  style={{
                    color: c.text,
                    backgroundColor: c.bg,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: c.border,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 15,
                    minHeight: 60,
                    textAlignVertical: 'top',
                  }}
                />
                <XStack gap="$2" justify="flex-end">
                  <XStack px="$4" py="$2" rounded={10} bg={c.chip} onPress={() => setNoteMode(false)} pressStyle={{ opacity: 0.7 }}>
                    <Text color={c.strong} fontSize={14}>{t('common.cancel')}</Text>
                  </XStack>
                  <XStack px="$4" py="$2" rounded={10} bg={c.accent} onPress={applyNote} pressStyle={{ opacity: 0.7 }}>
                    <Text color={c.bg} fontSize={14} fontWeight="600">{t('bookmarks.saveNote')}</Text>
                  </XStack>
                </XStack>
              </YStack>
            ) : (
              <YStack flex={1}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 10, alignItems: 'center' }}
                >
                  {/* Highlight: colours speak for themselves. */}
                  <XStack items="center" gap="$2.5" px="$3" height={72} rounded={16} bg={c.bg} borderWidth={1} borderColor={c.border}>
                    {HIGHLIGHT_COLORS.map((hc) => (
                      <View
                        key={hc}
                        width={30}
                        height={30}
                        rounded={15}
                        style={{ backgroundColor: hc }}
                        onPress={() => applyHighlight(hc)}
                        pressStyle={{ opacity: 0.7 }}
                      />
                    ))}
                  </XStack>

                  <VButton icon="note-text-outline" label={t('bookmarks.note')} onPress={() => { setNoteText(''); setNoteMode(true); }} />
                  <VButton
                    icon="share-variant-outline"
                    label={t('bookmarks.share')}
                    onPress={() => {
                      // Set before navigating so the reader's blur handler
                      // doesn't clear the selection out from under the page.
                      setSharing(true);
                      navigationRef.navigate('Share');
                    }}
                  />
                </ScrollView>

                {/* Drag-up hint (kept above the Android nav bar). */}
                <XStack items="center" justify="center" gap="$1" pt="$2" pb={insets.bottom + 4}>
                  <MaterialCommunityIcons name="chevron-up" size={16} color={c.muted} />
                  <Text color={c.muted} fontSize={12}>
                    {t('bookmarks.dragMore')}
                  </Text>
                </XStack>
              </YStack>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </>
  );
}

function VButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
}) {
  const c = useAppTheme();
  return (
    <YStack
      items="center"
      justify="center"
      gap="$1.5"
      width={84}
      height={72}
      rounded={16}
      bg={c.bg}
      borderWidth={1}
      borderColor={c.border}
      onPress={onPress}
      pressStyle={{ opacity: 0.7 }}
    >
      <MaterialCommunityIcons name={icon} size={24} color={c.accent} />
      <Text color={c.strong} fontSize={12}>{label}</Text>
    </YStack>
  );
}

function SavedRow({ rows }: { rows: SavedVerse[] }) {
  const c = useAppTheme();
  const isGroup = rows.length > 1;
  const color = rows.find((r) => r.highlight_color)?.highlight_color ?? null;
  const note = rows.find((r) => r.note)?.note ?? null;
  const label = isGroup ? groupLabel(rows) : rows[0].reference || rows[0].entity_id;
  const text = rows.map((r) => r.verse_text).join(' ');
  return (
    <YStack py="$2" gap="$1">
      <XStack items="center" gap="$2">
        {color && <View width={9} height={9} rounded={5} style={{ backgroundColor: color }} />}
        <Text color={c.accent} fontSize={12} fontWeight="600" flex={1} numberOfLines={1}>
          {label}
        </Text>
        {isGroup && <MaterialCommunityIcons name="bookmark-multiple-outline" size={13} color={c.muted} />}
      </XStack>
      <Text color={c.text} fontFamily={serif} fontSize={14} numberOfLines={3}>
        {text}
      </Text>
      {note && (
        <Text color={c.accentDim} fontSize={12} fontStyle="italic" numberOfLines={2}>
          {note}
        </Text>
      )}
    </YStack>
  );
}
