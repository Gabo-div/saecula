import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import { CATECHISM_PARTS, CATECHISM_PROLOGUE } from '@/data/catechism';
import type { CatechismStackParamList } from '@/navigation/RootTabs';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

type Props = NativeStackScreenProps<CatechismStackParamList, 'CatechismHome'>;

export function CatechismHubScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('catechism.title')} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* Prologue → straight to the reader */}
        <XStack
          items="center"
          gap="$3"
          p="$4"
          rounded="$6"
          bg={c.chip}
          borderWidth={1}
          borderColor={c.border}
          onPress={() =>
            navigation.navigate('CatechismReader', {
              from: CATECHISM_PROLOGUE.from,
              to: CATECHISM_PROLOGUE.to,
              title: t('catechism.prologue'),
            })
          }
          pressStyle={{ opacity: 0.7 }}
        >
          <MaterialCommunityIcons name="bookmark-outline" size={22} color={c.accent} />
          <YStack flex={1}>
            <Text color={c.strong} fontFamily={serif} fontSize={16}>
              {t('catechism.prologue')}
            </Text>
            <Text color={c.muted} fontSize={12}>
              {CATECHISM_PROLOGUE.from}–{CATECHISM_PROLOGUE.to}
            </Text>
          </YStack>
          <MaterialCommunityIcons name="chevron-right" size={22} color={c.muted} />
        </XStack>

        {/* The four pillars → part index */}
        {CATECHISM_PARTS.map((p) => {
          const title = t(`catechism.parts.${p.key}`);
          return (
            <XStack
              key={p.key}
              items="center"
              gap="$3"
              p="$4"
              rounded="$6"
              bg={c.chip}
              borderWidth={1}
              borderColor={c.border}
              onPress={() => navigation.navigate('CatechismPart', { partKey: p.key, title })}
              pressStyle={{ opacity: 0.7 }}
            >
              <Text color={c.accent} fontFamily={serif} fontSize={22} width={36}>
                {p.roman}
              </Text>
              <YStack flex={1}>
                <Text color={c.strong} fontFamily={serif} fontSize={16}>
                  {title}
                </Text>
                <Text color={c.muted} fontSize={12}>
                  {p.from}–{p.to}
                </Text>
              </YStack>
              <MaterialCommunityIcons name="chevron-right" size={22} color={c.muted} />
            </XStack>
          );
        })}
      </ScrollView>
    </View>
  );
}
