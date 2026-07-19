import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageBackground, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';

import { fetchDailyVerse } from '@/api/client';
import { HeaderIconButton, ScreenHeader } from '@/components/ScreenHeader';
import type { RootTabParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useReaderStore } from '@/store/readerStore';
import { colors, serif } from '@/theme/colors';
import type { DailyVerseResponse } from '@/types/api';
import { Image } from 'expo-image';

// Public-domain sacred art from Wikimedia Commons; the day of the year
// picks the background, so it changes daily and repeats weekly-ish.
const wikimedia = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`;

const BACKGROUNDS = [
  wikimedia('Michelangelo - Creation of Adam (cropped).jpg'),
  wikimedia('Caravaggio - La vocazione di San Matteo.jpg'),
  wikimedia('The Incredulity of Saint Thomas-Caravaggio (1601-2).jpg'),
  wikimedia('Fra Angelico - The Annunciation - WGA00555.jpg'),
  wikimedia('Rembrandt - The Return of the Prodigal Son.jpg'),
  wikimedia('Bloch-SermonOnTheMount.jpg'),
  wikimedia('Cathédrale Notre-Dame de Paris - 20.jpg'),
  wikimedia('Murillo - Inmaculada Concepción de los Venerables o de Soult (Museo del Prado, 1678).jpg'),
];

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
}) {
  return (
    <YStack
      flex={1}
      items="center"
      gap="$2"
      py="$3"
      rounded="$6"
      bg="rgba(0,0,0,0.45)"
      borderWidth={1}
      borderColor={colors.border}
      onPress={onPress}
      pressStyle={{ opacity: 0.7 }}
    >
      <MaterialCommunityIcons name={icon} size={22} color={colors.gold} />
      <Text color={colors.cream} fontSize={12}>
        {label}
      </Text>
    </YStack>
  );
}

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const setLocation = useReaderStore((s) => s.setLocation);

  const [daily, setDaily] = useState<DailyVerseResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDaily(await fetchDailyVerse());
    } catch {
      setDaily(null);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void load();
  }, [load]);

  const background = BACKGROUNDS[dayOfYear(new Date()) % BACKGROUNDS.length];

  const openDailyInBible = () => {
    if (daily) {
      setLocation(daily.book_code, daily.chapter);
    }
    navigation.navigate('Bible');
  };

  return (
    <View flex={1} bg={colors.bg}>
      <Image
        source={{
          uri: background,
          headers: {
            'User-Agent': 'SaeculaMobileApp/1.0'
          }
        }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        onLoad={() => console.log('Background image loaded')}
        onError={(event) => console.error('Error loading background image:', event.error)}
      />
      <LinearGradient
        colors={['rgba(18,16,10,0.35)', 'rgba(18,16,10,0.9)', 'rgba(18,16,10,1)']}
        locations={[0, 0.5, 1]}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.gold} />
          }
        >
          <ScreenHeader
            title={t('home.title')}
            right={
              <>
                <HeaderIconButton icon="broadcast" />
                <HeaderIconButton icon="hands-pray" />
                <HeaderIconButton icon="candle" />
              </>
            }
          />

          {/* Daily verse hero */}
          <YStack px="$4" pt="$8" gap="$4" grow={1} justify="center">
            <XStack
              self="flex-start"
              items="center"
              gap="$2"
              px="$3"
              py="$2"
              rounded={20}
              bg="rgba(0,0,0,0.5)"
              borderWidth={1}
              borderColor={colors.goldDim}
            >
              <MaterialCommunityIcons name="weather-sunny" size={14} color={colors.gold} />
              <Text color={colors.gold} fontSize={11} letterSpacing={2} fontWeight="600">
                {t('home.dailyVerse').toUpperCase()}
              </Text>
            </XStack>

            {loading && !daily ? (
              <Spinner size="large" color={colors.gold} />
            ) : (
              <>
                <Text
                  color={colors.cream}
                  fontFamily={serif}
                  fontSize={20}
                  lineHeight={40}
                  onPress={openDailyInBible}
                >
                  {daily?.text?.text ?? '—'}
                </Text>
                <Text color={colors.gold} fontFamily={serif} fontSize={16}>
                  — {daily?.reference ?? ''}
                </Text>
              </>
            )}
          </YStack>

          {/* Quick actions */}
          <XStack px="$4" pt="$6" gap="$2">
            <QuickAction icon="hands-pray" label={t('home.prayers')} />
            <QuickAction icon="star-four-points-outline" label={t('home.ask')} />
            <QuickAction
              icon="account-heart-outline"
              label={t('tabs.saints')}
              onPress={() => navigation.navigate('Saints')}
            />
            <QuickAction
              icon="book-cross"
              label={t('home.bible')}
              onPress={() => navigation.navigate('Bible')}
            />
          </XStack>

          {/* Today's word card */}
          <YStack
            mx="$4"
            mt="$4"
            p="$4"
            rounded="$8"
            bg={colors.burgundy}
            gap="$2"
            onPress={openDailyInBible}
            pressStyle={{ opacity: 0.85 }}
          >
            <XStack items="center" gap="$2">
              <Text color={colors.cream} fontSize={11} letterSpacing={2} fontWeight="700">
                {t('home.todaysWord').toUpperCase()}
              </Text>
              <XStack
                ml="auto"
                items="center"
                gap="$1"
                px="$2"
                py="$1"
                rounded={12}
                bg="rgba(0,0,0,0.3)"
              >
                <MaterialCommunityIcons name="book-open-variant" size={12} color={colors.cream} />
                <Text color={colors.cream} fontSize={11}>
                  {daily?.date ?? ''}
                </Text>
              </XStack>
            </XStack>

            <Text color={colors.cream} fontFamily={serif} fontSize={20} fontWeight="600">
              {daily ? `${daily.book_name} ${daily.chapter}` : t('home.dailyReading')}
            </Text>

            <XStack items="center" gap="$3">
              <View
                width={36}
                height={36}
                rounded={18}
                bg={colors.gold}
                items="center"
                justify="center"
              >
                <MaterialCommunityIcons name="play" size={20} color={colors.burgundy} />
              </View>
              <View flex={1} height={3} rounded={2} bg="rgba(0,0,0,0.35)">
                <View width="18%" height={3} rounded={2} bg={colors.gold} />
              </View>
              <Text color={colors.cream} fontSize={11}>
                {t('home.readChapter')}
              </Text>
            </XStack>
          </YStack>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}
