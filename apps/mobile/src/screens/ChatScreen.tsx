import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { ChatError, getConversation, streamChat } from '@/api/chat';
import type { AskStackParamList } from '@/navigation/RootTabs';
import { useCatechismStore } from '@/store/catechismStore';
import { useLanguageStore } from '@/store/languageStore';
import { useReaderStore } from '@/store/readerStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

// Matches a Catechism (CCC.2077) or Scripture (JHN.3.16, 1CO.13.4) citation.
const CITE = /\b(?:CCC\.\d{1,4}|[1-3]?[A-Z]{2,4}\.\d{1,3}\.\d{1,3})\b/g;

type Props = NativeStackScreenProps<AskStackParamList, 'Chat'>;

export function ChatScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState('');
  const [toolHint, setToolHint] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const convId = useRef<string | undefined>(route.params?.conversationId);
  const abort = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Load an existing conversation's history when opened from the list.
  useEffect(() => {
    const id = route.params?.conversationId;
    if (!id) return;
    convId.current = id;
    void getConversation(id)
      .then((res) => setTurns(res.messages.map((m) => ({ role: m.role, content: m.content }))))
      .catch(() => setError(true));
  }, [route.params?.conversationId]);

  // Abort any in-flight stream when leaving.
  useEffect(() => () => abort.current?.abort(), []);

  const goToCitation = useCallback(
    (id: string) => {
      if (id.startsWith('CCC.')) {
        const n = Number(id.slice(4));
        if (n > 0) {
          useCatechismStore.getState().focus(n);
          navigation.getParent()?.navigate('Catechism' as never);
        }
        return;
      }
      const [book, ch, v] = id.split('.');
      if (book && ch && v) {
        useReaderStore.getState().setLocation(book, Number(ch), Number(v));
        navigation.getParent()?.navigate('Bible' as never);
      }
    },
    [navigation],
  );

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || streaming) return;
    setInput('');
    setError(false);
    setTurns((prev) => [...prev, { role: 'user', content: message }]);
    setPartial('');
    setToolHint(null);
    setStreaming(true);

    const ctrl = new AbortController();
    abort.current = ctrl;
    let acc = '';
    try {
      const res = await streamChat(
        { conversation_id: convId.current, message, lang: language },
        {
          signal: ctrl.signal,
          onToken: (tk) => {
            acc += tk;
            setPartial(acc);
          },
          onTool: (name) => setToolHint(name),
        },
      );
      convId.current = res.conversation_id;
      setTurns((prev) => [...prev, { role: 'assistant', content: acc }]);
    } catch (e) {
      if (e instanceof ChatError && e.status === 503) setDisabled(true);
      else if (!ctrl.signal.aborted) setError(true);
    } finally {
      setStreaming(false);
      setPartial('');
      setToolHint(null);
      abort.current = null;
    }
  }, [input, streaming, language]);

  const renderContent = (turn: Turn, key: string) => {
    if (turn.role === 'user') {
      return (
        <XStack key={key} justify="flex-end" px="$4" py="$2">
          <View bg={c.accent} rounded={16} px="$3" py="$2" maxW="85%">
            <Text color={c.bg} fontSize={15}>
              {turn.content}
            </Text>
          </View>
        </XStack>
      );
    }
    return (
      <XStack key={key} justify="flex-start" px="$4" py="$2">
        <View maxW="90%">
          <Text color={c.text} fontFamily={serif} fontSize={16} lineHeight={25}>
            {citationParts(turn.content).map((p, i) =>
              p.cite ? (
                <Text
                  key={i}
                  color={c.accent}
                  fontWeight="700"
                  onPress={() => goToCitation(p.text)}
                >
                  {p.text}
                </Text>
              ) : (
                p.text
              ),
            )}
          </Text>
        </View>
      </XStack>
    );
  };

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 6}>
      {/* Header */}
      <XStack items="center" px="$3" py="$2" gap="$2">
        <MaterialCommunityIcons
          name="chevron-left"
          size={28}
          color={c.strong}
          onPress={() => navigation.getParent()?.navigate('Home' as never)}
        />
        <Text color={c.strong} fontFamily={serif} fontSize={18} fontWeight="700" flex={1}>
          {t('chat.title')}
        </Text>
        <MaterialCommunityIcons
          name="plus"
          size={24}
          color={c.accent}
          onPress={() => {
            convId.current = undefined;
            setTurns([]);
            setError(false);
          }}
        />
        <MaterialCommunityIcons
          name="history"
          size={24}
          color={c.accent}
          onPress={() => navigation.navigate('Conversations')}
        />
      </XStack>
      <Separator borderColor={c.border} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 48}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 16 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {disabled ? (
            <YStack items="center" justify="center" py="$10" px="$6" gap="$3">
              <MaterialCommunityIcons name="robot-outline" size={40} color={c.muted} />
              <Text color={c.muted} text="center">
                {t('chat.disabled')}
              </Text>
            </YStack>
          ) : turns.length === 0 && !streaming ? (
            <YStack items="center" justify="center" py="$10" px="$6" gap="$3">
              <MaterialCommunityIcons name="star-four-points-outline" size={40} color={c.muted} />
              <Text color={c.muted} text="center">
                {t('chat.empty')}
              </Text>
            </YStack>
          ) : (
            turns.map((turn, i) => renderContent(turn, String(i)))
          )}

          {/* Streaming assistant bubble */}
          {streaming && (
            <XStack justify="flex-start" px="$4" py="$2">
              <View maxW="90%">
                {partial ? (
                  <Text color={c.text} fontFamily={serif} fontSize={16} lineHeight={25}>
                    {partial}
                  </Text>
                ) : (
                  <XStack items="center" gap="$2">
                    <Spinner size="small" color={c.accent} />
                    <Text color={c.muted} fontSize={13}>
                      {toolHint
                        ? t('chat.consulting', { source: toolHint })
                        : t('chat.thinking')}
                    </Text>
                  </XStack>
                )}
              </View>
            </XStack>
          )}

          {error && (
            <XStack items="center" justify="center" gap="$2" py="$3">
              <Text color={c.muted} fontSize={13}>
                {t('chat.error')}
              </Text>
              <Text color={c.accent} fontSize={13} fontWeight="700" onPress={send}>
                {t('chat.retry')}
              </Text>
            </XStack>
          )}
        </ScrollView>

        {/* Input bar */}
        {!disabled && (
          <XStack
            items="flex-end"
            gap="$2"
            px="$3"
            pt="$2"
            pb={insets.bottom + 8}
            borderTopWidth={1}
            borderTopColor={c.border}
            bg={c.bg}
          >
            <View flex={1} bg={c.bgElevated} rounded={20} px="$3" py="$1" borderWidth={1} borderColor={c.border}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t('chat.placeholder')}
                placeholderTextColor={c.muted}
                multiline
                editable={!streaming}
                style={{ color: c.strong, fontSize: 15, maxHeight: 120, paddingVertical: 8 }}
              />
            </View>
            <View
              width={44}
              height={44}
              rounded={22}
              items="center"
              justify="center"
              bg={input.trim() && !streaming ? c.accent : c.chip}
              onPress={send}
              pressStyle={{ opacity: 0.7 }}
            >
              <MaterialCommunityIcons
                name="send"
                size={20}
                color={input.trim() && !streaming ? c.bg : c.muted}
              />
            </View>
          </XStack>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// citationParts splits assistant text into plain and citation segments so the
// latter can be rendered as tappable links.
function citationParts(text: string): Array<{ text: string; cite: boolean }> {
  const parts: Array<{ text: string; cite: boolean }> = [];
  let last = 0;
  for (const m of text.matchAll(CITE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), cite: false });
    parts.push({ text: m[0], cite: true });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), cite: false });
  return parts;
}
