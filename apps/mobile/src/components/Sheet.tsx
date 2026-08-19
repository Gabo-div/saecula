import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { useAppTheme } from '@/store/themeStore';

// Bottom sheet: a dimmed scrim with a rounded panel sliding up from the bottom.
// Tapping the scrim closes it; taps inside the panel do not. `statusBarTranslucent`
// makes the scrim cover the status-bar area on Android too (otherwise the
// notification bar stays bright above the dim overlay).
export function Sheet({
  visible,
  onClose,
  children,
  grabber = true,
  maxHeight,
  scrimOpacity = 0.6,
  radius = 24,
  padBottom = 12,
  avoidKeyboard = false,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  grabber?: boolean;
  maxHeight?: number | string;
  scrimOpacity?: number;
  radius?: number;
  padBottom?: number;
  avoidKeyboard?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();

  const panel = (
    <YStack
      bg={c.bgElevated}
      borderTopLeftRadius={radius}
      borderTopRightRadius={radius}
      borderWidth={1}
      borderColor={c.border}
      maxH={maxHeight as never}
      pb={insets.bottom + padBottom}
      onPress={(e) => e.stopPropagation()}
    >
      {grabber && (
        <View items="center" pt="$3" pb="$1">
          <View width={40} height={5} rounded={3} bg={c.border} />
        </View>
      )}
      {children}
    </YStack>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View flex={1} bg={`rgba(0,0,0,${scrimOpacity})`} justify="flex-end" onPress={onClose}>
        {avoidKeyboard ? <KeyboardAvoidingView behavior="padding">{panel}</KeyboardAvoidingView> : panel}
      </View>
    </Modal>
  );
}
