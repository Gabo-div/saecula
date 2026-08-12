import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import { CATECHISM_PARTS } from '@/data/catechism';
import type { CatechismStackParamList } from '@/navigation/RootTabs';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

type Props = NativeStackScreenProps<CatechismStackParamList, 'CatechismPart'>;

// One part's index: chapter headers and tappable article rows, each scoped to
// its paragraph range.
export function CatechismPartScreen({ navigation, route }: Props) {
  const { partKey, title } = route.params;
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const part = CATECHISM_PARTS.find((p) => p.key === partKey);

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 32 }}>
        {part?.entries.map((e, i) =>
          e.header ? (
            <Text
              key={`h-${i}`}
              color={c.accent}
              fontSize={11}
              fontWeight="700"
              letterSpacing={1.2}
              mt={i === 0 ? 0 : '$3'}
              mb="$1"
            >
              {e.label.toUpperCase()}
            </Text>
          ) : (
            <XStack
              key={`a-${i}`}
              items="center"
              gap="$3"
              px="$3"
              py="$3"
              rounded="$5"
              bg={c.chip}
              borderWidth={1}
              borderColor={c.border}
              onPress={() =>
                navigation.navigate('CatechismReader', {
                  from: e.from!,
                  to: e.to!,
                  title: e.label,
                })
              }
              pressStyle={{ opacity: 0.7 }}
            >
              <YStack flex={1}>
                <Text color={c.strong} fontFamily={serif} fontSize={15}>
                  {e.label}
                </Text>
                <Text color={c.muted} fontSize={11}>
                  {e.from}–{e.to}
                </Text>
              </YStack>
              <MaterialCommunityIcons name="chevron-right" size={20} color={c.muted} />
            </XStack>
          ),
        )}
      </ScrollView>
    </View>
  );
}
