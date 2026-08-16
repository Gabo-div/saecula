import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { deleteConversation, listConversations } from '@/api/chat';
import type { AskStackParamList } from '@/navigation/RootTabs';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import type { ChatConversation } from '@/types/api';

type Props = NativeStackScreenProps<AskStackParamList, 'Conversations'>;

export function ConversationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();

  const [items, setItems] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listConversations()
      .then((res) => setItems(res.conversations))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const remove = (id: string) => {
    Alert.alert(t('chat.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setItems((prev) => prev.filter((x) => x.id !== id));
          void deleteConversation(id).catch(load);
        },
      },
    ]);
  };

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 6}>
      <XStack items="center" px="$3" py="$2" gap="$2">
        <MaterialCommunityIcons
          name="chevron-left"
          size={28}
          color={c.strong}
          testID="chat-history-back"
          onPress={() => navigation.goBack()}
        />
        <Text color={c.strong} fontFamily={serif} fontSize={18} fontWeight="700" flex={1}>
          {t('chat.history')}
        </Text>
        <MaterialCommunityIcons
          name="plus"
          size={24}
          color={c.accent}
          onPress={() => navigation.navigate('Chat', {})}
        />
      </XStack>
      <Separator borderColor={c.border} />

      {loading ? (
        <YStack flex={1} items="center" justify="center">
          <Spinner size="large" color={c.accent} />
        </YStack>
      ) : items.length === 0 ? (
        <YStack flex={1} items="center" justify="center" px="$6" gap="$3">
          <MaterialCommunityIcons name="chat-outline" size={40} color={c.muted} />
          <Text color={c.muted} text="center">
            {t('chat.emptyHistory')}
          </Text>
        </YStack>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          ItemSeparatorComponent={() => <Separator borderColor={c.border} opacity={0.5} />}
          renderItem={({ item }) => (
            <XStack
              items="center"
              px="$4"
              py="$3"
              gap="$3"
              onPress={() => navigation.navigate('Chat', { conversationId: item.id })}
              pressStyle={{ bg: c.bgElevated }}
            >
              <Text color={c.strong} fontSize={15} flex={1} numberOfLines={1}>
                {item.title || t('chat.newChat')}
              </Text>
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={20}
                color={c.muted}
                onPress={() => remove(item.id)}
              />
            </XStack>
          )}
        />
      )}
    </View>
  );
}
