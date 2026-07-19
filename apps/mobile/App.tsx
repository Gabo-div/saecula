import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';

import i18n from '@/i18n';
import { RootTabs } from '@/navigation/RootTabs';
import { LoginScreen } from '@/screens/LoginScreen';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { colors } from '@/theme/colors';
import { tamaguiConfig } from './tamagui.config';

// The app is always dark: gold on umber, independent of the system scheme.
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    notification: colors.burgundy,
  },
};

export default function App() {
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

  return (
    <SafeAreaProvider>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <StatusBar style="light" />
        {token && isAuthenticated() ? (
          <NavigationContainer theme={navigationTheme}>
            <RootTabs />
          </NavigationContainer>
        ) : (
          <LoginScreen />
        )}
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
