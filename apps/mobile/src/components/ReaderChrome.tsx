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
import { Text, View } from 'tamagui';

import { useAppTheme } from '@/store/themeStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A gentle fade+resize so the chrome eases in and out instead of snapping.
const ANIM = LayoutAnimation.create(
  240,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

// Distance (px) the user must scroll in one direction before the chrome flips.
// Large enough that small nudges don't toggle it.
const THRESHOLD = 72;

// Scrolling down collapses a reader's chrome (top header + the bottom tab bar)
// so the text takes over the screen; scrolling up or reaching the top brings it
// back. Toggling needs sustained movement (see THRESHOLD) so a tiny scroll
// won't flip modes. The tab bar is toggled through the navigator's own options.
export function useReaderChrome(navigation: { setOptions: (o: object) => void }) {
  const [compact, setCompact] = useState(false);
  const lastY = useRef(0);
  const acc = useRef(0); // signed distance accumulated since the last flip

  const apply = useCallback(
    (next: boolean) => {
      setCompact((cur) => {
        if (cur === next) return cur;
        LayoutAnimation.configureNext(ANIM);
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

      // Near the top, always show the chrome.
      if (y < 24) {
        acc.current = 0;
        apply(false);
        return;
      }
      // Reset the streak when the scroll direction reverses.
      if ((dy > 0 && acc.current < 0) || (dy < 0 && acc.current > 0)) acc.current = 0;
      acc.current += dy;

      if (acc.current > THRESHOLD) {
        apply(true);
        acc.current = 0;
      } else if (acc.current < -THRESHOLD) {
        apply(false);
        acc.current = 0;
      }
    },
    [apply],
  );

  // Always restore the tab bar when leaving the screen.
  useFocusEffect(
    useCallback(() => () => navigation.setOptions({ tabBarStyle: undefined }), [navigation]),
  );

  return { compact, onScroll };
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
      pt="$3"
      pb={insets.bottom + 10}
      items="center"
    >
      <Text color={c.strong} fontSize={15} fontWeight="600">
        {title}
      </Text>
    </View>
  );
}
