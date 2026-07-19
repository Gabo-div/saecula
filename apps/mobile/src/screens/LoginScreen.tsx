import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Input, Spinner, Text, YStack } from 'tamagui';

import { login, register } from '@/api/client';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

export function LoginScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isRegistering) {
        await register(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      // Success: authStore now holds the session and App.tsx re-renders.
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        t('login.connectionFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <YStack flex={1} justify="center" gap="$3" p="$5" bg={c.bg}>
        <Text
          self="center"
          color={c.accent}
          fontFamily={serif}
          fontSize={40}
          letterSpacing={6}
        >
          SAECULA
        </Text>
        <Text self="center" color={c.muted} mb="$4">
          {t('common.tagline')}
        </Text>

        <Input
          placeholder={t('login.email')}
          placeholderTextColor={c.muted as never}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          size="$4"
          bg={c.bgElevated}
          borderColor={c.border}
          color={c.strong}
          focusStyle={{ borderColor: c.accent }}
        />
        <Input
          placeholder={t('login.password')}
          placeholderTextColor={c.muted as never}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          size="$4"
          bg={c.bgElevated}
          borderColor={c.border}
          color={c.strong}
          focusStyle={{ borderColor: c.accent }}
        />

        {error && (
          <Text color={c.error} self="center">
            {error}
          </Text>
        )}

        <Button
          size="$4"
          bg={c.accent}
          color={c.bg}
          fontWeight="700"
          onPress={submit}
          disabled={loading}
          icon={loading ? <Spinner color={c.bg} /> : undefined}
          pressStyle={{ bg: c.accentDim }}
        >
          {isRegistering ? t('login.createAccount') : t('login.signIn')}
        </Button>

        <Button chromeless size="$3" onPress={() => setIsRegistering((v) => !v)}>
          <Text color={c.muted}>
            {isRegistering ? t('login.haveAccount') : t('login.noAccount')}
          </Text>
        </Button>
      </YStack>
    </KeyboardAvoidingView>
  );
}
