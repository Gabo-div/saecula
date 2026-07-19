import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text, View, XStack } from 'tamagui';

import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import { useAuthStore } from '@/store/authStore';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function HeaderIconButton({
  icon,
  onPress,
}: {
  icon: IconName;
  onPress?: () => void;
}) {
  const c = useAppTheme();
  return (
    <View
      width={40}
      height={40}
      rounded={20}
      bg={c.chip}
      borderWidth={1}
      borderColor={c.border}
      items="center"
      justify="center"
      onPress={onPress}
      pressStyle={{ opacity: 0.7 }}
    >
      <MaterialCommunityIcons name={icon} size={18} color={c.accent} />
    </View>
  );
}

// Avatar circle + small-caps serif title, matching the reference layout.
export function ScreenHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  const email = useAuthStore((s) => s.user?.email ?? 'S');
  const c = useAppTheme();
  const initial = email.charAt(0).toUpperCase();

  return (
    <XStack items="center" gap="$3" px="$4" py="$2">
      <View
        width={44}
        height={44}
        rounded={22}
        bg={c.bgElevated}
        borderWidth={2}
        borderColor={c.accent}
        items="center"
        justify="center"
      >
        <Text color={c.accent} fontWeight="700" fontSize={18}>
          {initial}
        </Text>
      </View>
      <Text
        color={c.accent}
        fontFamily={serif}
        fontSize={17}
        letterSpacing={3}
        fontWeight="600"
      >
        {title.toUpperCase()}
      </Text>
      <XStack ml="auto" gap="$2">
        {right}
      </XStack>
    </XStack>
  );
}
