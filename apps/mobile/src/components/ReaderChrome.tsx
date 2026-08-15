import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  UIManager,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { FONT_STEPS, useReaderPrefs } from '@/store/readerPrefsStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A gentle fade+resize so the chrome eases in and out instead of snapping.
const ANIM = LayoutAnimation.create(
  240,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

// Unicode superscript digits give an inline, raised verse/paragraph number
// (RN has no vertical-align for nested Text) while the text still wraps to full
// width.
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
export function superscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUP[d] ?? d)
    .join('');
}

// Distance (px) the user must scroll in one direction before the chrome flips.
// Large enough that small nudges don't toggle it.
const THRESHOLD = 72;

// Scrolling down collapses a reader's chrome (top header + the bottom tab bar)
// so the text takes over the screen; scrolling up or reaching the top brings it
// back. Toggling needs sustained movement (see THRESHOLD) so a tiny scroll
// won't flip modes. The tab bar is toggled through the navigator's own options.
export function useReaderChrome(navigation: { setOptions: (o: object) => void }) {
  const [compact, setCompact] = useState(false);
  const compactRef = useRef(false);
  const lastY = useRef(0);
  const acc = useRef(0); // signed distance accumulated since the last flip
  const settling = useRef(false); // true briefly after a flip while layout resettles

  // Show/hide the tab bar and open a settle window as a side effect of the mode
  // change — never during render, which would update the navigator mid-render.
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: compact ? { display: 'none' } : undefined });
    settling.current = true;
    const id = setTimeout(() => {
      settling.current = false;
    }, 400);
    return () => clearTimeout(id);
  }, [compact, navigation]);

  const apply = useCallback((next: boolean) => {
    if (compactRef.current === next) return;
    compactRef.current = next;
    LayoutAnimation.configureNext(ANIM);
    setCompact(next);
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      // Just flipped: swallow the layout-shift scroll event and re-baseline.
      if (settling.current) {
        lastY.current = y;
        acc.current = 0;
        return;
      }
      const dy = y - lastY.current;
      lastY.current = y;

      // Near the top, always show the chrome.
      if (y < 24) {
        acc.current = 0;
        apply(false);
        return;
      }
      // Reset the streak when the scroll direction reverses.
      if ((dy > 0 && acc.current < 0) || (dy < 0 && acc.current > 0)) acc.current = 0;
      acc.current += dy;

      if (acc.current > THRESHOLD) {
        apply(true);
        acc.current = 0;
      } else if (acc.current < -THRESHOLD) {
        apply(false);
        acc.current = 0;
      }
    },
    [apply],
  );

  // Reset to full chrome when leaving the screen.
  useFocusEffect(
    useCallback(
      () => () => {
        compactRef.current = false;
        setCompact(false);
        navigation.setOptions({ tabBarStyle: undefined });
      },
      [navigation],
    ),
  );

  return { compact, onScroll };
}

// The serif book/chapter (or section) title shown at the top of a reading.
export function ReaderTitle({
  overline,
  main,
  giant,
}: {
  overline: string;
  main: string;
  giant?: boolean;
}) {
  const c = useAppTheme();
  return (
    <YStack items="center" pt="$2" pb="$5" px="$6" gap="$1">
      <Text color={c.muted} fontFamily={serif} fontSize={16} letterSpacing={1}>
        {overline}
      </Text>
      <Text
        color={c.strong}
        fontFamily={serif}
        fontWeight="800"
        fontSize={giant ? 56 : 24}
        lineHeight={giant ? 60 : 30}
        text="center"
      >
        {main}
      </Text>
    </YStack>
  );
}

// Accessibility sheet: pick the reader's body-text size.
export function ReaderSettingsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const { fontScale, setFontScale } = useReaderPrefs();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        flex={1}
        bg="rgba(0,0,0,0.6)"
        justify="flex-end"
        onPress={onClose}
        pressStyle={{ opacity: 1 }}
      >
        <YStack
          bg={c.bgElevated}
          borderTopLeftRadius={24}
          borderTopRightRadius={24}
          borderWidth={1}
          borderColor={c.border}
          pb={insets.bottom + 16}
          onPress={(e) => e.stopPropagation()}
        >
          <XStack items="center" px="$4" py="$3" gap="$3">
            <Text color={c.strong} fontFamily={serif} fontSize={18} fontWeight="600">
              {t('reader.accessibility')}
            </Text>
            <View ml="auto">
              <MaterialCommunityIcons name="close" size={24} color={c.muted} onPress={onClose} />
            </View>
          </XStack>
          <Separator borderColor={c.border} />

          <YStack px="$4" py="$4" gap="$3">
            <Text color={c.muted} fontSize={11} letterSpacing={2}>
              {t('reader.fontSize').toUpperCase()}
            </Text>
            <XStack gap="$2" items="center">
              {FONT_STEPS.map((step) => {
                const active = step === fontScale;
                return (
                  <View
                    key={step}
                    flex={1}
                    height={56}
                    rounded="$6"
                    items="center"
                    justify="center"
                    bg={active ? c.accent : 'transparent'}
                    borderWidth={1}
                    borderColor={active ? c.accent : c.border}
                    onPress={() => setFontScale(step)}
                    pressStyle={{ opacity: 0.7 }}
                  >
                    <Text
                      color={active ? c.bg : c.strong}
                      fontFamily={serif}
                      fontSize={Math.round(15 * step)}
                      fontWeight="700"
                    >
                      A
                    </Text>
                  </View>
                );
              })}
            </XStack>
          </YStack>
        </YStack>
      </View>
    </Modal>
  );
}

// One normalized search hit: a title (reference) over a snippet, keyed for nav.
export interface SearchItem {
  key: string;
  title: string;
  snippet: string;
}

// A debounced full-text search sheet reused by both readers. The caller
// supplies the search (normalizing results) and what to do on a pick.
export function ReaderSearchSheet({
  visible,
  onClose,
  onSearch,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onSearch: (q: string) => Promise<SearchItem[]>;
  onPick: (item: SearchItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const gen = useRef(0);
  const searchRef = useRef(onSearch);
  searchRef.current = onSearch;

  const query = q.trim();
  // A bare number is a valid one-character query (jump to a paragraph); text
  // otherwise needs two letters.
  const active = query.length >= 2 || /^\d+$/.test(query);

  useEffect(() => {
    if (!active) {
      setItems([]);
      setLoading(false);
      return;
    }
    const my = ++gen.current;
    setLoading(true);
    const id = setTimeout(() => {
      searchRef
        .current(query)
        .then((res) => {
          if (my === gen.current) setItems(res);
        })
        .catch(() => {
          if (my === gen.current) setItems([]);
        })
        .finally(() => {
          if (my === gen.current) setLoading(false);
        });
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (!visible) {
      setQ('');
      setItems([]);
      gen.current += 1;
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        flex={1}
        bg="rgba(0,0,0,0.6)"
        justify="flex-end"
        onPress={onClose}
        pressStyle={{ opacity: 1 }}
      >
        <YStack
          bg={c.bgElevated}
          borderTopLeftRadius={24}
          borderTopRightRadius={24}
          borderWidth={1}
          borderColor={c.border}
          maxH="85%"
          pb={insets.bottom + 8}
          onPress={(e) => e.stopPropagation()}
        >
          <XStack items="center" gap="$2" px="$4" py="$3">
            <MaterialCommunityIcons name="magnify" size={22} color={c.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('reader.searchPlaceholder')}
              placeholderTextColor={c.muted}
              autoFocus
              returnKeyType="search"
              style={{ flex: 1, color: c.strong, fontSize: 16, paddingVertical: 6 }}
            />
            {loading ? (
              <Spinner color={c.accent} />
            ) : (
              <MaterialCommunityIcons name="close" size={22} color={c.muted} onPress={onClose} />
            )}
          </XStack>
          <Separator borderColor={c.border} />

          {!active ? (
            <Text color={c.muted} px="$4" py="$4" fontSize={13}>
              {t('reader.searchHint')}
            </Text>
          ) : !loading && items.length === 0 ? (
            <Text color={c.muted} px="$4" py="$4" fontSize={13}>
              {t('reader.noResults')}
            </Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {items.map((it) => (
                <YStack
                  key={it.key}
                  px="$4"
                  py="$3"
                  gap="$1"
                  onPress={() => onPick(it)}
                  pressStyle={{ bg: c.bg }}
                >
                  <Text color={c.accent} fontFamily={serif} fontSize={14} fontWeight="600">
                    {it.title}
                  </Text>
                  <Text color={c.text} fontSize={13} lineHeight={19} numberOfLines={2}>
                    {it.snippet}
                  </Text>
                </YStack>
              ))}
            </ScrollView>
          )}
        </YStack>
      </View>
    </Modal>
  );
}

// The slim bar that stands in for the chrome while compact, naming what's read.
export function ReaderMiniBar({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  return (
    <View
      bg={c.bg}
      borderTopWidth={1}
      borderTopColor={c.border}
      pt="$3"
      pb={insets.bottom + 10}
      items="center"
    >
      <Text color={c.strong} fontSize={15} fontWeight="600">
        {title}
      </Text>
    </View>
  );
}
