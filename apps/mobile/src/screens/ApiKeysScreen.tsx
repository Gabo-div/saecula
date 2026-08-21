import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, Separator, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { createApiKey, fetchApiKeys, revokeApiKey } from '@/api/client';
import type { ProfileStackParamList } from '@/navigation/RootTabs';
import { useAppTheme } from '@/store/themeStore';
import { mono } from '@/theme/colors';
import type { ApiKey, CreatedApiKey } from '@/types/api';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ApiKeys'>;

export function ApiKeysScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  // The plaintext secret, held only until the user dismisses it — the backend
  // cannot return it again.
  const [fresh, setFresh] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchApiKeys()
      .then((r) => {
        setKeys(r.keys);
        setError(null);
      })
      .catch(() => setError(t('apiKeys.loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  useFocusEffect(load);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const created = await createApiKey(trimmed);
      setFresh(created);
      setCopied(false);
      setName('');
      setNaming(false);
      load();
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setError(status === 409 ? t('apiKeys.tooMany') : t('apiKeys.createError'));
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!fresh) return;
    await Clipboard.setStringAsync(fresh.key);
    setCopied(true);
  };

  const revoke = (key: ApiKey) => {
    Alert.alert(key.name, t('apiKeys.revokeConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('apiKeys.revoke'),
        style: 'destructive',
        onPress: () => {
          setKeys((prev) => prev.filter((k) => k.id !== key.id));
          void revokeApiKey(key.id).catch(() => {
            setError(t('apiKeys.revokeError'));
            load();
          });
        },
      },
    ]);
  };

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <XStack items="center" gap="$3" px="$4" py="$2">
        <MaterialCommunityIcons
          testID="apikeys-back"
          name="chevron-left"
          size={28}
          color={c.strong}
          onPress={() => navigation.goBack()}
        />
        <Text color={c.strong} fontSize={20}>
          {t('apiKeys.title')}
        </Text>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <YStack px="$4" pt="$2" gap="$3">
          <Text color={c.muted} fontSize={13}>
            {t('apiKeys.subtitle')}
          </Text>

          {error ? (
            <Text color="$red10" fontSize={13}>
              {error}
            </Text>
          ) : null}

          {fresh ? (
            <YStack
              gap="$2"
              p="$3"
              borderWidth={1}
              borderColor={c.accent}
              rounded={10}
              testID="apikeys-fresh"
            >
              <Text color={c.strong} fontSize={13}>
                {t('apiKeys.copyOnce')}
              </Text>
              <Text color={c.strong} fontSize={12} fontFamily={mono} selectable>
                {fresh.key}
              </Text>
              <XStack gap="$2">
                <Button size="$3" onPress={copy} flex={1}>
                  {copied ? t('apiKeys.copied') : t('apiKeys.copy')}
                </Button>
                <Button size="$3" chromeless onPress={() => setFresh(null)}>
                  {t('apiKeys.done')}
                </Button>
              </XStack>
            </YStack>
          ) : null}

          {naming ? (
            <XStack gap="$2">
              <Input
                testID="apikeys-name"
                flex={1}
                size="$3"
                value={name}
                onChangeText={setName}
                placeholder={t('apiKeys.namePlaceholder')}
                maxLength={64}
                autoFocus
                onSubmitEditing={() => void create()}
              />
              <Button size="$3" onPress={() => void create()} disabled={creating}>
                {creating ? <Spinner /> : t('apiKeys.create')}
              </Button>
            </XStack>
          ) : (
            <Button
              testID="apikeys-new"
              size="$3"
              self="flex-start"
              onPress={() => setNaming(true)}
            >
              {t('apiKeys.newKey')}
            </Button>
          )}

          <Separator borderColor={c.border} />

          {loading ? (
            <Spinner />
          ) : keys.length === 0 ? (
            <Text color={c.muted} fontSize={13}>
              {t('apiKeys.empty')}
            </Text>
          ) : (
            keys.map((k) => (
              <XStack key={k.id} items="center" gap="$3" py="$2">
                <YStack flex={1} gap="$1">
                  <Text color={c.strong} fontSize={15}>
                    {k.name}
                  </Text>
                  <Text color={c.muted} fontSize={12} fontFamily={mono}>
                    {k.prefix}…
                  </Text>
                  <Text color={c.muted} fontSize={11}>
                    {k.total_calls} {t('apiKeys.calls')}
                    {k.total_errors > 0 ? ` · ${k.total_errors} ${t('apiKeys.errors')}` : ''}
                  </Text>
                </YStack>
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={22}
                  color={c.muted}
                  onPress={() => revoke(k)}
                />
              </XStack>
            ))
          )}
        </YStack>
      </ScrollView>
    </View>
  );
}
