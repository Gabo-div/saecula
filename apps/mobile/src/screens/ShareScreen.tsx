import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, BackHandler, Image as RNImage, PixelRatio, Platform, ScrollView, Share, Text as RNText, useWindowDimensions, View as RNView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import { superscript } from '@/components/ReaderChrome';
import { navigationRef } from '@/navigation/ref';
import { selectionRangeLabel, useSelectionStore } from '@/store/selectionUiStore';
import { useAppTheme, useThemeStore } from '@/store/themeStore';
import { ACCENTS, ACCENT_KEYS, buildTheme, serif, type AccentKey, type ThemeMode } from '@/theme/colors';

const RATIOS = [
  { key: '1:1', ar: 1, icon: 'crop-square' },
  { key: '3:4', ar: 3 / 4, icon: 'crop-portrait' },
  { key: '4:5', ar: 4 / 5, icon: 'image-outline' },
  { key: '9:16', ar: 9 / 16, icon: 'cellphone' },
] as const satisfies readonly {
  key: string;
  ar: number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}[];

// Bundled placeholder hero, used as the share card's background art.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- no *.jpg module typings in this project
const DEFAULT_HERO = require('../../assets/default-hero.jpg');

export function ShareScreen() {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [ratio, setRatio] = useState<number>(3 / 4);
  // Card theme + accent, independent of the app's — default to the app's.
  const appMode = useThemeStore((s) => s.mode);
  const appAccent = useThemeStore((s) => s.accent);
  const [cardMode, setCardMode] = useState<ThemeMode>(appMode);
  const [cardAccent, setCardAccent] = useState<AccentKey>(appAccent);
  const cardTheme = useMemo(() => buildTheme(cardMode, cardAccent), [cardMode, cardAccent]);
  const [bgOn, setBgOn] = useState(false);
  const [overlay, setOverlay] = useState(0.4); // scrim opacity over the image

  const items = useSelectionStore((s) => s.items);
  const headerPrefix = useSelectionStore((s) => s.headerPrefix);
  const share = useSelectionStore((s) => s.share);
  const setSharing = useSelectionStore((s) => s.setSharing);
  const clearSelection = useSelectionStore((s) => s.clear);
  const cardRef = useRef<any>(null);

  // Hidden tab → no back stack; go straight to the reader we came from.
  const goBack = () => navigationRef.navigate(share ? 'Bible' : 'Catechism');

  // Hide the global selection sheet while this page is up; on leave, end the
  // sharing session and drop the selection.
  useFocusEffect(
    useCallback(() => {
      setSharing(true);
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => {
        sub.remove();
        setSharing(false);
        clearSelection();
      };
    }, [setSharing, clearSelection]),
  );

  // Nothing to share (e.g. selection cleared) — leave.
  useEffect(() => {
    if (items.length === 0) goBack();
  }, [items.length]);
  if (items.length === 0) return null;

  const label = selectionRangeLabel(items, headerPrefix);
  // All selected passages run together as one quote with a single reference.
  // The image shows small inline verse numerals (like the reader); the text
  // share stays clean (no numerals).
  const plainQuote = items.map((i) => i.text).join(' ');
  const shareText = `“${plainQuote}” — ${label}`;

  const shareTextOut = async () => {
    await Share.share({ message: shareText });
  };

  const shareImage = async () => {
    if (!cardRef.current) return;
    try {
      // Native TurboModule, absent in Expo Go — load on demand.
      const { captureRef } = await import('react-native-view-shot');
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t('bookmarks.imageSaveError'));
        return;
      }
      // Give the shared file a readable name (e.g. "Saecula-John-3-16.png").
      const name = `Saecula ${label}`.replace(/[\s:,–]+/g, '-').replace(/-+$/g, '');
      const dest = new File(Paths.cache, `${name}.png`);
      try {
        dest.delete();
      } catch {
        // no prior file
      }
      await new File(uri).copy(dest);
      await Sharing.shareAsync(dest.uri, { mimeType: 'image/png', dialogTitle: t('bookmarks.share') });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t('bookmarks.imageSaveError'));
    }
  };

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('bookmarks.share')} onBack={goBack} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16, gap: 16 }}>
        {/* On-screen preview (scaled down). */}
        <View items="center">
          <ShareCard width={Math.min(width - 40, height * 0.45 * ratio)} ratio={ratio} items={items} label={label} c={cardTheme} bgOn={bgOn} overlay={overlay} />
        </View>

        {/* Real card rendered off-screen. view-shot captures at
            (dp × pixelRatio) px, so we render at 1080/pixelRatio dp to export
            an exactly 1080-wide PNG on any screen density. */}
        <RNView style={{ position: 'absolute', left: -100000, top: 0 }} pointerEvents="none">
          <ShareCard
            width={1080 / PixelRatio.get()}
            ratio={ratio}
            items={items}
            label={label}
            c={cardTheme}
            cardRef={cardRef}
            bgOn={bgOn}
            overlay={overlay}
          />
        </RNView>

        {/* Aspect-ratio selector — full-width pills with icon + ratio. */}
        <YStack gap="$2">
          <Text color={c.muted} fontSize={11} letterSpacing={2} fontWeight="700">
            {t('bookmarks.format').toUpperCase()}
          </Text>
          <XStack gap="$2">
            {RATIOS.map((r) => {
              const active = Math.abs(r.ar - ratio) < 0.001;
              return (
                <YStack
                  key={r.key}
                  flex={1}
                  items="center"
                  gap="$1"
                  py="$2"
                  rounded={12}
                  bg={active ? c.accent : 'transparent'}
                  borderWidth={1}
                  borderColor={active ? c.accent : c.border}
                  onPress={() => setRatio(r.ar)}
                  pressStyle={{ opacity: 0.7 }}
                >
                  <MaterialCommunityIcons name={r.icon} size={20} color={active ? c.bg : c.strong} />
                  <Text color={active ? c.bg : c.strong} fontSize={12} fontWeight="600">
                    {r.key}
                  </Text>
                </YStack>
              );
            })}
          </XStack>
        </YStack>

        {/* Card theme */}
        <YStack gap="$2">
          <Text color={c.muted} fontSize={11} letterSpacing={2} fontWeight="700">
            {t('settings.theme').toUpperCase()}
          </Text>
          <XStack gap="$2">
            {(['light', 'dark', 'amoled'] as ThemeMode[]).map((m) => {
              const active = cardMode === m;
              return (
                <View
                  key={m}
                  flex={1}
                  items="center"
                  py="$2"
                  rounded={12}
                  bg={active ? c.accent : 'transparent'}
                  borderWidth={1}
                  borderColor={active ? c.accent : c.border}
                  onPress={() => setCardMode(m)}
                  pressStyle={{ opacity: 0.7 }}
                >
                  <Text color={active ? c.bg : c.strong} fontSize={12} fontWeight="600">
                    {t(`settings.${m}`)}
                  </Text>
                </View>
              );
            })}
          </XStack>
        </YStack>

        {/* Card accent */}
        <YStack gap="$2">
          <Text color={c.muted} fontSize={11} letterSpacing={2} fontWeight="700">
            {t('settings.accent').toUpperCase()}
          </Text>
          <XStack gap="$3" items="center">
            {ACCENT_KEYS.map((k) => {
              const color = ACCENTS[k][cardMode === 'light' ? 'light' : 'dark'].base;
              const active = cardAccent === k;
              return (
                <View
                  key={k}
                  width={34}
                  height={34}
                  rounded={17}
                  style={{ backgroundColor: color }}
                  borderWidth={active ? 3 : 0}
                  borderColor={c.strong}
                  onPress={() => setCardAccent(k)}
                  pressStyle={{ opacity: 0.7 }}
                />
              );
            })}
          </XStack>
        </YStack>

        {/* Background image + opacity */}
        <YStack gap="$2">
          <Text color={c.muted} fontSize={11} letterSpacing={2} fontWeight="700">
            {t('bookmarks.background').toUpperCase()}
          </Text>
          <XStack gap="$2">
            {[false, true].map((on) => {
              const active = bgOn === on;
              return (
                <View
                  key={String(on)}
                  flex={1}
                  items="center"
                  py="$2"
                  rounded={12}
                  bg={active ? c.accent : 'transparent'}
                  borderWidth={1}
                  borderColor={active ? c.accent : c.border}
                  onPress={() => setBgOn(on)}
                  pressStyle={{ opacity: 0.7 }}
                >
                  <Text color={active ? c.bg : c.strong} fontSize={12} fontWeight="600">
                    {on ? t('bookmarks.bgImage') : t('bookmarks.bgNone')}
                  </Text>
                </View>
              );
            })}
          </XStack>
          {bgOn && (
            <XStack items="center" gap="$3">
              <MaterialCommunityIcons name="opacity" size={18} color={c.muted} />
              <View flex={1}>
                <Slider value={overlay} onChange={setOverlay} c={c} />
              </View>
            </XStack>
          )}
        </YStack>

        <YStack gap="$2" pb={insets.bottom + 8}>
          <ShareButton icon="image-outline" label={t('bookmarks.shareImage')} onPress={shareImage} accent />
          <ShareButton icon="text-box-outline" label={t('bookmarks.shareText')} onPress={shareTextOut} />
        </YStack>
      </ScrollView>
    </View>
  );
}

// Verse card. All sizes derive from `width` so the on-screen preview and the
// off-screen 1080px capture are visually identical (just scaled).
function ShareCard({
  width,
  ratio,
  items,
  label,
  c,
  cardRef,
  bgOn,
  bgUri,
  overlay,
}: {
  width: number;
  ratio: number;
  items: { number: number; text: string }[];
  label: string;
  c: any;
  cardRef?: React.RefObject<any>;
  bgOn?: boolean;
  bgUri?: string;
  overlay: number;
}) {
  const pad = width * 0.066;
  return (
    <RNView
      ref={cardRef}
      collapsable={false}
      style={{
        width,
        aspectRatio: ratio,
        backgroundColor: c.bg,
        borderWidth: 1,
        borderColor: c.border,
        padding: pad,
        overflow: 'hidden',
      }}
    >
      {bgOn && (
        <>
          <RNImage
            source={bgUri ? { uri: bgUri } : DEFAULT_HERO}
            resizeMode="cover"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <RNView
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg, opacity: overlay }}
          />
        </>
      )}
      <RNView style={{ width: width * 0.12, height: width * 0.006, borderRadius: 1, backgroundColor: c.accent, opacity: 0.5, alignSelf: 'center' }} />
      <RNText
        adjustsFontSizeToFit
        numberOfLines={24}
        minimumFontScale={0.15}
        style={{
          flex: 1,
          color: c.text,
          fontFamily: serif,
          fontSize: width * 0.078,
          textAlign: 'center',
          textAlignVertical: 'center',
          fontStyle: 'italic',
          marginVertical: width * 0.033,
        }}
      >
        “
        {items.map((it, idx) => (
          <RNText key={idx}>
            <RNText style={{ color: c.accent, fontWeight: '700', fontStyle: 'normal' }}>
              {superscript(it.number)}{' '}
            </RNText>
            {it.text}
            {idx < items.length - 1 ? '  ' : ''}
          </RNText>
        ))}
        ”
      </RNText>
      <RNText
        adjustsFontSizeToFit
        numberOfLines={1}
        style={{ color: c.accent, fontFamily: serif, fontSize: width * 0.042, fontWeight: '600', textAlign: 'center' }}
      >
        — {label}
      </RNText>
      <RNText style={{ color: c.muted, fontSize: width * 0.028, letterSpacing: 1, textAlign: 'center', marginTop: width * 0.033 }}>
        SAECULA
      </RNText>
    </RNView>
  );
}

function Slider({
  value,
  onChange,
  c,
}: {
  value: number;
  onChange: (v: number) => void;
  c: any;
}) {
  const [w, setW] = useState(1);
  const set = (x: number) => onChange(Math.max(0, Math.min(1, x / w)));
  const pan = Gesture.Pan()
    .onBegin((e) => runOnJS(set)(e.x))
    .onChange((e) => runOnJS(set)(e.x));
  return (
    <GestureDetector gesture={pan}>
      <RNView
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{ height: 36, justifyContent: 'center' }}
        hitSlop={{ top: 12, bottom: 12 }}
      >
        <RNView style={{ height: 4, borderRadius: 2, backgroundColor: c.border }} />
        <RNView style={{ position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: c.accent, width: `${value * 100}%` }} />
        <RNView style={{ position: 'absolute', left: `${value * 100}%`, marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: c.accent }} />
      </RNView>
    </GestureDetector>
  );
}

function ShareButton({
  icon,
  label,
  onPress,
  accent,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const c = useAppTheme();
  return (
    <XStack
      items="center"
      gap="$3"
      px="$4"
      py="$3.5"
      rounded={12}
      bg={accent ? c.accent : 'transparent'}
      borderWidth={accent ? 0 : 1}
      borderColor={c.border}
      onPress={onPress}
      pressStyle={{ opacity: 0.7 }}
    >
      <MaterialCommunityIcons name={icon} size={20} color={accent ? c.bg : c.strong} />
      <Text color={accent ? c.bg : c.strong} fontSize={15} fontWeight={accent ? '600' : '400'}>
        {label}
      </Text>
    </XStack>
  );
}
