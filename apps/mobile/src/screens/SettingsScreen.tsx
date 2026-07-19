import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Text, View, XStack, YStack } from 'tamagui';

import { fetchTranslations } from '@/api/client';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import type { ProfileStackParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useReaderStore } from '@/store/readerStore';
import { colors, serif } from '@/theme/colors';
import type { Translation } from '@/types/api';

// Native language names never get translated — you should always be able
// to find your own language.
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Español',
  la: 'Latina',
};

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const translationId = useReaderStore((s) => s.translationId);
  const setTranslation = useReaderStore((s) => s.setTranslation);

  const [translations, setTranslations] = useState<Translation[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        setTranslations((await fetchTranslations()).translations);
      } catch {
        setTranslations([]);
      }
    })();
  }, []);

  return (
    <View flex={1} bg={colors.bg} pt={insets.top + 8}>
      <XStack items="center" gap="$3" px="$4" py="$2">
        <MaterialCommunityIcons
          name="chevron-left"
          size={28}
          color={colors.gold}
          onPress={() => navigation.goBack()}
        />
        <Text
          color={colors.gold}
          fontFamily={serif}
          fontSize={17}
          letterSpacing={3}
          fontWeight="600"
        >
          {t('settings.title').toUpperCase()}
        </Text>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <YStack px="$4" pt="$6" gap="$3">
          <Text color={colors.textMuted} fontSize={11} letterSpacing={2}>
            {t('settings.language').toUpperCase()}
          </Text>
          <Separator borderColor={colors.border} />

          {SUPPORTED_LANGUAGES.map((code) => {
            const active = language === code;
            return (
              <XStack
                key={code}
                items="center"
                gap="$3"
                py="$3"
                onPress={() => setLanguage(code)}
                pressStyle={{ opacity: 0.7 }}
              >
                <Text color={active ? colors.gold : colors.cream} fontSize={15}>
                  {LANGUAGE_NAMES[code] ?? code}
                </Text>
                <Text color={colors.textMuted} fontSize={12}>
                  {code.toUpperCase()}
                </Text>
                {active && (
                  <View ml="auto">
                    <MaterialCommunityIcons name="check" size={20} color={colors.gold} />
                  </View>
                )}
              </XStack>
            );
          })}
        </YStack>

        {/* App-wide Bible edition (readerStore.translationId → every ?translation=) */}
        <YStack px="$4" pt="$8" gap="$3">
          <Text color={colors.textMuted} fontSize={11} letterSpacing={2}>
            {t('settings.translation').toUpperCase()}
          </Text>
          <Separator borderColor={colors.border} />

          <XStack
            items="center"
            gap="$3"
            py="$3"
            onPress={() => setTranslation('')}
            pressStyle={{ opacity: 0.7 }}
          >
            <Text color={translationId === '' ? colors.gold : colors.cream} fontSize={15}>
              {t('settings.defaultTranslation')}
            </Text>
            {translationId === '' && (
              <View ml="auto">
                <MaterialCommunityIcons name="check" size={20} color={colors.gold} />
              </View>
            )}
          </XStack>

          {translations.map((tr) => {
            const active = translationId === tr.id;
            return (
              <XStack
                key={`${tr.id}-${tr.language_code}`}
                items="center"
                gap="$3"
                py="$3"
                onPress={() => setTranslation(tr.id)}
                pressStyle={{ opacity: 0.7 }}
              >
                <Text color={active ? colors.gold : colors.cream} fontSize={15}>
                  {tr.id.replace(/_/g, ' ').toUpperCase()}
                </Text>
                <Text color={colors.textMuted} fontSize={12}>
                  {tr.language_code.toUpperCase()}
                </Text>
                {active && (
                  <View ml="auto">
                    <MaterialCommunityIcons name="check" size={20} color={colors.gold} />
                  </View>
                )}
              </XStack>
            );
          })}
        </YStack>
      </ScrollView>
    </View>
  );
}
