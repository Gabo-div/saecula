import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  UIManager,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Scrolling down collapses a reader's chrome (top header + the bottom tab bar)
// so the text takes over the screen; scrolling up or reaching the top brings it
// back. The tab bar is toggled through the navigator's own options.
export function useReaderChrome(navigation: { setOptions: (o: object) => void }) {
  const [compact, setCompact] = useState(false);
  const lastY = useRef(0);

  const apply = useCallback(
    (next: boolean) => {
      setCompact((cur) => {
        if (cur === next) return cur;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        navigation.setOptions({ tabBarStyle: next ? { display: 'none' } : undefined });
        return next;
      });
    },
    [navigation],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastY.current;
      lastY.current = y;
      if (y < 48) apply(false);
      else if (dy > 8) apply(true);
      else if (dy < -8) apply(false);
    },
    [apply],
  );

  // Always restore the tab bar when leaving the screen.
  useFocusEffect(
    useCallback(
      () => () => navigation.setOptions({ tabBarStyle: undefined }),
      [navigation],
    ),
  );

  return { compact, onScroll };
}

// The book/chapter (or section) title shown at the top of a reading, echoing a
// small overline over a large display line.
export function ReaderTitle({
  overline,
  main,
  giant,
}: {
  overline: string;
  main: string;
  giant?: boolean;
}) {
  const c = useAppTheme();
  return (
    <YStack items="center" pt="$3" pb="$5" px="$6" gap="$1">
      <Text color={c.muted} fontFamily={serif} fontSize={16} letterSpacing={1}>
        {overline}
      </Text>
      <Text
        color={c.strong}
        fontFamily={serif}
        fontWeight="800"
        fontSize={giant ? 60 : 24}
        lineHeight={giant ? 64 : 30}
        text="center"
      >
        {main}
      </Text>
    </YStack>
  );
}

// The slim bar that stands in for the chrome while compact, naming what's read.
export function ReaderMiniBar({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  return (
    <View
      bg={c.bg}
      borderTopWidth={1}
      borderTopColor={c.border}
      pt="$2"
      pb={insets.bottom + 6}
      items="center"
    >
      <Text color={c.muted} fontSize={13} fontWeight="600">
        {title}
      </Text>
    </View>
  );
}
