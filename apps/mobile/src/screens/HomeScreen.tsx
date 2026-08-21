import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Image, NativeScrollEvent, NativeSyntheticEvent, RefreshControl, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';

import { fetchBackground, fetchCalendarDay, fetchDailyVerse } from '@/api/client';
import { HeaderIconButton, ScreenHeader } from '@/components/ScreenHeader';
import { LinearGradient } from 'expo-linear-gradient';

import { StreakSheet } from '@/components/StreakSheet';
import type { RootTabParamList } from '@/navigation/RootTabs';
import { useCatechismStore } from '@/store/catechismStore';
import { useLanguageStore } from '@/store/languageStore';
import { useReaderStore } from '@/store/readerStore';
import { useStreakStore } from '@/store/streakStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import { liturgicalColor } from '@/theme/liturgical';
import type { BackgroundResponse, CalendarDayResponse, DailyVerseResponse } from '@/types/api';

// Bundled placeholder hero, shown when neither the day's curated art nor the
// fetched background loads.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- no *.jpg module typings in this project
const DEFAULT_HERO = require('../../assets/default-hero.jpg');

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Quick actions: equal-width vertical tiles, icon over label.
function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
}) {
  const c = useAppTheme();
  return (
    <YStack
      flex={1}
      items="center"
      gap="$2"
      py="$3"
      rounded="$6"
      bg={c.chip}
      borderWidth={1}
      borderColor={c.border}
      onPress={onPress}
      pressStyle={{ opacity: 0.7 }}
    >
      <MaterialCommunityIcons name={icon} size={22} color={c.accent} />
      <Text color={c.strong} fontSize={12}>
        {label}
      </Text>
    </YStack>
  );
}

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

// CarouselDot springs between a small dot and an elongated pill so the active
// page transition feels smooth instead of snapping.
function CarouselDot({ active }: { active: boolean }) {
  const c = useAppTheme();
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: active ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 60,
    }).start();
  }, [active, anim]);

  return (
    <Animated.View
      style={{
        width: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 22] }),
        height: 7,
        borderRadius: 4,
        backgroundColor: active ? c.accent : c.muted,
      }}
    />
  );
}

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const setLocation = useReaderStore((s) => s.setLocation);
  const streakCurrent = useStreakStore((s) => s.current);
  const [streakOpen, setStreakOpen] = useState(false);

  useEffect(() => {
    void useStreakStore.getState().refresh();
  }, []);

  const [daily, setDaily] = useState<DailyVerseResponse | null>(null);
  const [calDay, setCalDay] = useState<CalendarDayResponse | null>(null);
  const [bg, setBg] = useState<BackgroundResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const { width: winWidth } = useWindowDimensions();
  // Pages are narrower than the screen so the next card's edge peeks in,
  // hinting the carousel is swipeable.
  const cardW = winWidth - 48;
  // Fixed page height so the nested horizontal ScrollView never stretches
  // taller than the card content (3 lines + chip + reference).
  const cardH = 152;

  const onCarouselEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setCarouselIndex(Math.round(e.nativeEvent.contentOffset.x / cardW));
    },
    [cardW],
  );

  // Load the verse and today's liturgical day together; one failing source
  // must not blank the other.
  const load = useCallback(async () => {
    setLoading(true);
    const [verse, cal, background] = await Promise.allSettled([
      fetchDailyVerse(),
      fetchCalendarDay(),
      fetchBackground(),
    ]);
    setDaily(verse.status === 'fulfilled' ? verse.value : null);
    setCalDay(cal.status === 'fulfilled' ? cal.value : null);
    setBg(background.status === 'fulfilled' ? background.value : null);
    setLoading(false);
  }, [language]);

  useEffect(() => {
    void load();
  }, [load]);

  // The day's curated art wins; otherwise the fetched background; otherwise
  // the bundled placeholder never leaves the hero blank.
  const backgroundUri = daily?.image_url ?? bg?.url;
  const backgroundAttribution = daily?.image_url ? daily?.attribution : bg?.attribution;
  const verseText = daily?.verses.map((v) => v.text).join(' ') ?? '—';

  // Retry a new day's image instead of staying stuck on the fallback.
  useEffect(() => {
    setBgFailed(false);
  }, [backgroundUri]);

  const openDailyInBible = () => {
    if (daily) {
      setLocation(daily.book_code, daily.chapter, daily.verses[0]?.number);
    }
    navigation.navigate('Bible');
  };

  // Opens the Catechism reader on today's paragraph (if any).
  const dailyParagraph = daily?.catechism_paragraphs?.[0];
  const openDailyInCatechism = () => {
    if (dailyParagraph) {
      useCatechismStore.getState().focus(dailyParagraph.number);
      navigation.navigate('Catechism');
    }
  };

  // The day's main celebration (precedence-ordered) and any distinct saints.
  const cels = calDay?.celebrations ?? [];
  const celebration = cels[0];
  const saints = cels.filter((x) => x.sanctoral && x.id !== celebration?.id);

  return (
    <View flex={1} bg={c.bg}>
      <Image
        source={backgroundUri && !bgFailed ? { uri: backgroundUri } : DEFAULT_HERO}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
        onError={() => setBgFailed(true)}
      />
      {backgroundAttribution && (
        <Text
          position="absolute"
          b={8}
          r={12}
          color="white"
          fontSize={9}
          opacity={0.7}
        >
          {backgroundAttribution}
        </Text>
      )}
      <LinearGradient colors={c.overlay} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />
          }
        >
          <ScreenHeader
            title={t('home.title')}
            right={
              <>
                <XStack
                  testID="home-streak"
                  items="center"
                  gap="$1.5"
                  height={40}
                  px="$3"
                  rounded={20}
                  bg={c.chip}
                  borderWidth={1}
                  borderColor={c.border}
                  onPress={() => setStreakOpen(true)}
                  pressStyle={{ opacity: 0.7 }}
                >
                  <MaterialCommunityIcons name="fire" size={17} color={c.accent} />
                  <Text color={c.strong} fontSize={14} fontWeight="700">
                    {streakCurrent}
                  </Text>
                </XStack>
                <HeaderIconButton
                  icon="account-circle-outline"
                  testID="home-profile"
                  onPress={() => navigation.navigate('Profile')}
                />
              </>
            }
          />

          {/* Spacer: lets the artwork breathe, pushing content to the bottom. */}
          <View flex={1} />

          {/* Daily cards — a paging carousel of verse + catechism, with dots. */}
          {loading && !daily ? (
            <Spinner size="large" color={c.accent} self="center" />
          ) : (
            <>
              <ScrollView
                horizontal
                snapToInterval={cardW}
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                style={{ height: 0 }}
                onMomentumScrollEnd={onCarouselEnd}
              >
                {/* Daily verse page */}
                <YStack width={cardW} height={cardH} px="$4" gap="$2">
                  <XStack
                    self="flex-start"
                    items="center"
                    gap="$2"
                    px="$3"
                    py="$1"
                    rounded={20}
                    bg={c.chip}
                    borderWidth={1}
                    borderColor={c.accentDim}
                  >
                    <MaterialCommunityIcons name="weather-sunny" size={13} color={c.accent} />
                    <Text color={c.accent} fontSize={10} letterSpacing={2} fontWeight="600">
                      {t('home.dailyVerse').toUpperCase()}
                    </Text>
                  </XStack>
                  <Text
                    color={c.strong}
                    fontFamily={serif}
                    fontSize={17}
                    lineHeight={27}
                    numberOfLines={4}
                    onPress={openDailyInBible}
                  >
                    {verseText}
                  </Text>
                  <Text color={c.accent} fontFamily={serif} fontSize={15}>
                    — {daily?.reference ?? ''}
                  </Text>
                </YStack>

                {/* Daily catechism page */}
                {dailyParagraph && (
                  <YStack width={cardW} height={cardH} px="$4" gap="$2">
                    <XStack
                      self="flex-start"
                      items="center"
                      gap="$2"
                      px="$3"
                      py="$1"
                      rounded={20}
                      bg={c.chip}
                      borderWidth={1}
                      borderColor={c.accentDim}
                    >
                      <MaterialCommunityIcons name="book-open-page-variant" size={13} color={c.accent} />
                      <Text color={c.accent} fontSize={10} letterSpacing={2} fontWeight="600">
                        {t('home.dailyCatechism').toUpperCase()}
                      </Text>
                    </XStack>
                    <Text
                      color={c.strong}
                      fontFamily={serif}
                      fontSize={17}
                      lineHeight={27}
                      numberOfLines={4}
                      onPress={openDailyInCatechism}
                    >
                      {dailyParagraph.text}
                    </Text>
                    <Text color={c.accent} fontFamily={serif} fontSize={15}>
                      — CCC {dailyParagraph.number}
                    </Text>
                  </YStack>
                )}
              </ScrollView>

              {/* Carousel dots — active page springs into an elongated pill */}
              <XStack items="center" justify="center" gap="$2" mt="$2">
                <CarouselDot active={carouselIndex === 0} />
                {dailyParagraph && <CarouselDot active={carouselIndex === 1} />}
              </XStack>
            </>
          )}

          {/* Quick actions */}
          <XStack px="$4" pt="$5" gap="$2">
            <QuickAction
              icon="hands-pray"
              label={t('home.prayers')}
              onPress={() => navigation.navigate('Prayers')}
            />
            <QuickAction
              icon="star-four-points-outline"
              label={t('home.ask')}
              onPress={() => navigation.navigate('Ask')}
            />
            <QuickAction
              icon="bookmark-multiple-outline"
              label={t('bookmarks.title')}
              onPress={() => navigation.navigate('Profile')}
            />
            <QuickAction
              icon="book-cross"
              label={t('home.bible')}
              onPress={() => navigation.navigate('Bible')}
            />
          </XStack>

          {/* Today's celebration — highlighted card */}
          {celebration && (
            <YStack mx="$4" mt="$3" p="$4" rounded="$8" bg={c.card} gap="$2">
              <Text color={c.onCard} fontSize={11} letterSpacing={2} fontWeight="700">
                {t('home.celebrationOfDay').toUpperCase()}
              </Text>

              <XStack items="center" gap="$2">
                <View width={9} height={9} rounded={5} bg={liturgicalColor(celebration.colors[0])} />
                <YStack flex={1}>
                  <Text color={c.onCard} fontFamily={serif} fontSize={18} fontWeight="600" numberOfLines={2}>
                    {celebration.name}
                  </Text>
                  <Text color={c.onCard} fontSize={11} opacity={0.75}>
                    {celebration.rank_name}
                    {celebration.season_name ? ` · ${celebration.season_name}` : ''}
                  </Text>
                </YStack>
              </XStack>

              {saints.map((s, i) => (
                <XStack key={`${s.id}-${i}`} items="center" gap="$2" pl="$5">
                  <View width={6} height={6} rounded={3} bg={liturgicalColor(s.colors[0])} />
                  <Text color={c.onCard} fontSize={13} flex={1} numberOfLines={1} opacity={0.9}>
                    {s.name}
                  </Text>
                </XStack>
              ))}
            </YStack>
          )}
        </ScrollView>
      </LinearGradient>

      <StreakSheet
        visible={streakOpen}
        onClose={() => setStreakOpen(false)}
        onOpenHistory={() => {
          setStreakOpen(false);
          navigation.navigate('Streak');
        }}
      />
    </View>
  );
}
