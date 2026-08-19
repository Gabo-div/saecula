import '@tamagui/sheet/setup-gesture-handler';

import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';

import { StreakCelebration } from '@/components/StreakCelebration';
import i18n from '@/i18n';
import { RootTabs } from '@/navigation/RootTabs';
import { LoginScreen } from '@/screens/LoginScreen';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';
import { tamaguiConfig } from './tamagui.config';

export default function App() {
  // Theme (mode + accent) comes from the persisted theme store; every
  // color below follows it live.
  const c = useAppTheme();

  // Subscribing to the token makes the app flip between screens on
  // login/logout (including automatic logout from the 401 interceptor).
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // The language store is the single source of truth (persisted, also
  // drives ?lang= on the API); i18next follows it.
  const language = useLanguageStore((s) => s.language);
  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language]);

  const isDark = c.mode !== 'light';
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: c.accent,
      background: c.bg,
      card: c.bg,
      text: c.text,
      border: c.border,
      notification: c.card,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {token && isAuthenticated() ? (
            <NavigationContainer theme={navigationTheme}>
              <RootTabs />
              <StreakCelebration />
            </NavigationContainer>
          ) : (
            <LoginScreen />
          )}
        </TamaguiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
