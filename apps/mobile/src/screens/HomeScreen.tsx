import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';

import { fetchCalendarDay, fetchDailyVerse } from '@/api/client';
import { HeaderIconButton, ScreenHeader } from '@/components/ScreenHeader';
import type { RootTabParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useReaderStore } from '@/store/readerStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import { liturgicalColor } from '@/theme/liturgical';
import type { CalendarDayResponse, DailyVerseResponse } from '@/types/api';

// Public-domain sacred art from Wikimedia Commons; the day of the year
// picks the background, so it changes daily and repeats weekly-ish.
const wikimedia = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`;

const BACKGROUNDS = [wikimedia('Diego_Velázquez_-_Coronation_of_the_Virgin_-_Prado.jpg')];

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

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

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const setLocation = useReaderStore((s) => s.setLocation);

  const [daily, setDaily] = useState<DailyVerseResponse | null>(null);
  const [calDay, setCalDay] = useState<CalendarDayResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Load the verse and today's liturgical day together; one failing source
  // must not blank the other.
  const load = useCallback(async () => {
    setLoading(true);
    const [verse, cal] = await Promise.allSettled([fetchDailyVerse(), fetchCalendarDay()]);
    setDaily(verse.status === 'fulfilled' ? verse.value : null);
    setCalDay(cal.status === 'fulfilled' ? cal.value : null);
    setLoading(false);
  }, [language]);

  useEffect(() => {
    void load();
  }, [load]);

  // A curated feature image wins; otherwise the day-of-year default rotation.
  const background =
    daily?.image_url ?? BACKGROUNDS[dayOfYear(new Date()) % BACKGROUNDS.length];
  const verseText = daily?.verses.map((v) => v.text).join(' ') ?? '—';

  const openDailyInBible = () => {
    if (daily) {
      setLocation(daily.book_code, daily.chapter);
    }
    navigation.navigate('Bible');
  };

  // The day's main celebration (precedence-ordered) and any distinct saints.
  const cels = calDay?.celebrations ?? [];
  const celebration = cels[0];
  const saints = cels.filter((x) => x.sanctoral && x.id !== celebration?.id);

  return (
    <View flex={1} bg={c.bg}>
      <Image
        source={{ uri: background, headers: { 'User-Agent': 'SaeculaMobileApp/1.0' } }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
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
                <HeaderIconButton icon="hands-pray" />
                <HeaderIconButton icon="candle" />
                <HeaderIconButton
                  icon="account-circle-outline"
                  onPress={() => navigation.navigate('Profile')}
                />
              </>
            }
          />

          {/* Spacer: lets the artwork breathe, pushing content to the bottom. */}
          <View flex={1} />

          {/* Daily verse — compact, low on the screen. */}
          <YStack px="$4" gap="$2">
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

            {loading && !daily ? (
              <Spinner size="large" color={c.accent} self="flex-start" />
            ) : (
              <>
                <Text
                  color={c.strong}
                  fontFamily={serif}
                  fontSize={19}
                  lineHeight={29}
                  numberOfLines={4}
                  onPress={openDailyInBible}
                >
                  {verseText}
                </Text>
                <Text color={c.accent} fontFamily={serif} fontSize={15}>
                  — {daily?.reference ?? ''}
                </Text>
              </>
            )}
          </YStack>

          {/* Quick actions */}
          <XStack px="$4" pt="$7" gap="$2">
            <QuickAction icon="hands-pray" label={t('home.prayers')} />
            <QuickAction icon="star-four-points-outline" label={t('home.ask')} />
            <QuickAction
              icon="calendar-month-outline"
              label={t('tabs.calendar')}
              onPress={() => navigation.navigate('Calendar')}
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
    </View>
  );
}
