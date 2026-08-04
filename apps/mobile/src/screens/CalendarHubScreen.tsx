import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import type { CalendarStackParamList, RootTabParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// The Calendar hub is nested in a stack inside the Calendar tab, so its
// navigation prop composes both.
type Props = CompositeScreenProps<
  NativeStackScreenProps<CalendarStackParamList, 'CalendarHome'>,
  BottomTabScreenProps<RootTabParamList>
>;

const LOCALES: Record<string, string> = { en: 'en-US', es: 'es-ES', la: 'la' };

function SectionCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const c = useAppTheme();
  return (
    <XStack
      items="center"
      gap="$3"
      p="$4"
      rounded="$8"
      bg={c.bgElevated}
      borderWidth={1}
      borderColor={c.border}
      onPress={onPress}
      pressStyle={{ opacity: 0.75 }}
    >
      <View
        width={44}
        height={44}
        rounded={22}
        bg={c.chip}
        items="center"
        justify="center"
      >
        <MaterialCommunityIcons name={icon} size={22} color={c.accent} />
      </View>
      <YStack flex={1} gap="$1">
        <Text color={c.strong} fontFamily={serif} fontSize={17}>
          {title}
        </Text>
        <Text color={c.muted} fontSize={13}>
          {description}
        </Text>
      </YStack>
      <MaterialCommunityIcons name="chevron-right" size={22} color={c.muted} />
    </XStack>
  );
}

export function CalendarHubScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);

  const today = new Date();
  const locale = LOCALES[language] ?? 'en-US';
  let dateLabel: string;
  try {
    dateLabel = today.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    dateLabel = today.toISOString().slice(0, 10);
  }

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('calendar.title')} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text color={c.accent} fontFamily={serif} fontSize={15} mb="$2">
          {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
        </Text>

        <SectionCard
          icon="book-open-page-variant-outline"
          title={t('calendar.readings')}
          description={t('calendar.readingsDesc')}
          onPress={() => navigation.navigate('DailyReadings')}
        />
        <SectionCard
          icon="account-heart-outline"
          title={t('calendar.saints')}
          description={t('calendar.saintsDesc')}
          onPress={() => navigation.navigate('SaintsCalendar')}
        />
        <SectionCard
          icon="candle"
          title={t('calendar.celebrations')}
          description={t('calendar.celebrationsDesc')}
          onPress={() => navigation.navigate('Celebrations')}
        />
      </ScrollView>
    </View>
  );
}
