import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Keyboard, KeyboardAvoidingView, Modal, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { ChatError, getConversation, streamChat, type ToolCall } from '@/api/chat';
import type { AskStackParamList } from '@/navigation/RootTabs';
import { useCatechismStore } from '@/store/catechismStore';
import { useLanguageStore } from '@/store/languageStore';
import { useReaderStore } from '@/store/readerStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import MarkdownIt from 'markdown-it';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  model?: string;
  toolCalls?: ToolCall[];
  rating?: 'up' | 'down' | null;
}

// Matches a Catechism (CCC.2077) or Scripture (JHN.3.16, 1CO.13.4) citation.
const CITE = /\b(?:CCC\.\d{1,4}|[1-3]?[A-Z]{2,4}\.\d{1,3}\.\d{1,3})\b/g;

type Props = NativeStackScreenProps<AskStackParamList, 'Chat'>;

// markdown-it is a stateless parser; a module-level singleton is fine (and
// avoids calling hooks outside a component).
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

// --- Markdown token types (subset of markdown-it output we render) ----------

interface MdText { type: 'text'; content: string }
interface MdStrong { type: 'strong_open' | 'strong_close'; nesting: 1 | -1 }
interface MdEm { type: 'em_open' | 'em_close'; nesting: 1 | -1 }
interface MdParagraph { type: 'paragraph_open' | 'paragraph_close'; nesting: 1 | -1 }
interface MdHeading { type: 'heading_open' | 'heading_close'; nesting: 1 | -1; tag: string }
interface MdList { type: 'bullet_list_open' | 'bullet_list_close' | 'ordered_list_open' | 'ordered_list_close'; nesting: 1 | -1 }
interface MdListItem { type: 'list_item_open' | 'list_item_close'; nesting: 1 | -1 }
interface MdCode { type: 'code_block' | 'code_inline'; content: string; info?: string }
interface MdBreak { type: 'softbreak' | 'hardbreak' }
interface MdLink { type: 'link_open' | 'link_close'; nesting: 1 | -1; href: string }
interface MdInline { type: 'inline'; content: string; children?: MarkdownToken[] }

type MarkdownToken =
  | MdText
  | MdStrong
  | MdEm
  | MdParagraph
  | MdHeading
  | MdList
  | MdListItem
  | MdCode
  | MdBreak
  | MdLink
  | MdInline;

// renderInline walks the inline token stream (markdown-it's token.children) and
// emits nested <Text> for strong/em so emphasis actually renders.
function renderInline(
  tokens: MarkdownToken[],
  c: any,
  goToCitation: (id: string) => void,
  keyPrefix: string,
): React.ReactNode[] {
  let i = 0;

  const walk = (until: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    while (i < tokens.length && tokens[i].type !== until) {
      const tok = tokens[i];
      const k = `${keyPrefix}-${i}`;
      if (tok.type === 'text') {
        const parts = citationParts((tok as MdText).content);
        nodes.push(
          ...parts.map((p, idx) =>
            p.cite ? (
              <Text
                key={`${k}-cite-${idx}`}
                color={c.accent}
                fontWeight="700"
                onPress={() => goToCitation(p.text)}
              >
                {p.text}
              </Text>
            ) : (
              p.text
            ),
          ),
        );
      } else if (tok.type === 'strong_open') {
        i++;
        nodes.push(
          <Text key={k} fontWeight="700">
            {walk('strong_close')}
          </Text>,
        );
      } else if (tok.type === 'em_open') {
        i++;
        nodes.push(
          <Text key={k} fontStyle="italic">
            {walk('em_close')}
          </Text>,
        );
      } else if (tok.type === 'code_inline') {
        nodes.push(
          <Text key={k} bg={c.chip} px={4} py={1} rounded={4} fontSize={13} color={c.text}>
            {(tok as MdCode).content}
          </Text>,
        );
      } else if (tok.type === 'softbreak' || tok.type === 'hardbreak') {
        nodes.push('\n');
      }
      i++;
    }
    return nodes;
  };

  return walk('');
}

// renderTokens renders the block-level token stream (from md.parse); inline
// content is taken from token.children so **bold** / *italics* work.
function renderTokens(tokens: MarkdownToken[], c: any, goToCitation: (id: string) => void, keyPrefix: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  let i = 0;
  let listDepth = 0;

  while (i < tokens.length) {
    const tok = tokens[i];
    const key = `${keyPrefix}-${i}`;

    if (tok.type === 'paragraph_open') {
      i++;
      const children: React.ReactNode[] = [];
      while (i < tokens.length && tokens[i].type !== 'paragraph_close') {
        const ti = tokens[i];
        if (ti.type === 'inline') {
          children.push(...renderInline(ti.children ?? [], c, goToCitation, `${key}-inline`));
        } else if (ti.type === 'softbreak' || ti.type === 'hardbreak') {
          children.push('\n');
        }
        i++;
      }
      out.push(<Text key={key} color={c.text} fontFamily={serif} fontSize={16} lineHeight={25}>{children}</Text>);
    } else if (tok.type === 'heading_open') {
      const level = parseInt(tok.tag.slice(1), 10);
      i++;
      const children: React.ReactNode[] = [];
      while (i < tokens.length && tokens[i].type !== 'heading_close') {
        const ti = tokens[i];
        if (ti.type === 'inline') {
          children.push(...renderInline(ti.children ?? [], c, goToCitation, `${key}-heading`));
        }
        i++;
      }
      const sizes = { 1: 28, 2: 24, 3: 20, 4: 18, 5: 16, 6: 15 };
      out.push(
        <Text
          key={key}
          color={c.strong}
          fontFamily={serif}
          fontSize={sizes[level as keyof typeof sizes] ?? 16}
          fontWeight="700"
          py={2}
        >
          {children}
        </Text>,
      );
    } else if (tok.type === 'bullet_list_open' || tok.type === 'ordered_list_open') {
      listDepth++;
      i++;
    } else if (tok.type === 'bullet_list_close' || tok.type === 'ordered_list_close') {
      listDepth--;
      i++;
    } else if (tok.type === 'list_item_open') {
      i++;
      const children: React.ReactNode[] = [];
      while (i < tokens.length && tokens[i].type !== 'list_item_close') {
        const ti = tokens[i];
        if (ti.type === 'inline') {
          children.push(...renderInline(ti.children ?? [], c, goToCitation, `${key}-li`));
        } else if (ti.type === 'paragraph_open') {
          const pi = i; // unique per paragraph token, so inline keys never collide across paragraphs
          i++;
          while (i < tokens.length && tokens[i].type !== 'paragraph_close') {
            const tpi = tokens[i];
            if (tpi.type === 'inline') {
              children.push(...renderInline(tpi.children ?? [], c, goToCitation, `${key}-para-${pi}`));
            }
            i++;
          }
        }
        i++;
      }
      out.push(
        <XStack key={key} gap="$2" ml={listDepth * 16}>
          <Text color={c.accent} fontSize={16} fontWeight="700">•</Text>
          <Text flex={1} color={c.text} fontFamily={serif} fontSize={16} lineHeight={25}>
            {children}
          </Text>
        </XStack>,
      );
    } else if (tok.type === 'code_block') {
      const ct = tok as MdCode;
      out.push(
        <View key={key} bg={c.chip} rounded={8} p="$3" mx="$2" my={4} borderWidth={1} borderColor={c.border}>
          <Text fontFamily={serif} fontSize={13} lineHeight={20} color={c.text}>
            {ct.content}
          </Text>
        </View>,
      );
      i++;
    } else {
      i++;
    }
  }
  return out;
}

function renderMarkdown(content: string, c: any, goToCitation: (id: string) => void, keyPrefix: string): React.ReactNode {
  const tokens = md.parse(content, {}) as MarkdownToken[];
  return renderTokens(tokens, c, goToCitation, keyPrefix);
}

// ChatKey is the union of the chat block's i18n keys; typing toolLabel against
// it keeps the friendly labels type-checked at the call site.
type ChatKey = keyof import('@/i18n/locales/en').Translations['chat'];

// toolKey maps a backend tool name to its (typed) i18n key so the UI never
// shows raw tool names or JSON to the user.
const TOOL_KEYS: Record<string, ChatKey> = {
  search_scripture: 'toolSearchScripture',
  get_verses: 'toolGetVerses',
  search_catechism: 'toolSearchCatechism',
  get_catechism: 'toolGetCatechism',
  graph_related: 'toolGraphRelated',
};

// Past-tense variants, used in the details panel (the action already happened).
const TOOL_KEYS_PAST: Record<string, ChatKey> = {
  search_scripture: 'toolSearchScripturePast',
  get_verses: 'toolGetVersesPast',
  search_catechism: 'toolSearchCatechismPast',
  get_catechism: 'toolGetCatechismPast',
  graph_related: 'toolGraphRelatedPast',
};

// SUGGESTION_KEYS are the chat-block i18n keys shown on a fresh conversation.
const SUGGESTION_KEYS: ChatKey[] = [
  'suggestWhatDoesChurchTeach',
  'suggestCatechismOnFaith',
  'suggestDailyGospel',
  'suggestExplainBaptism',
];

// toolLabel returns the friendly, non-technical label for a tool; falls back
// to the raw name for tools the app does not know yet.
function toolLabel(name: string, t: TFunction): string {
  const k = TOOL_KEYS[name];
  return k ? t(`chat.${k}` as never) : name;
}

// toolLabelPast is toolLabel's past-tense form for already-finished turns.
function toolLabelPast(name: string, t: TFunction): string {
  const k = TOOL_KEYS_PAST[name];
  return k ? t(`chat.${k}` as never) : name;
}

// toolInputLabel renders a tool call's parameters as a short, user-readable
// string (e.g. the search query or the passage/paragraph range), or null when
// the call carried no usable input.
function toolInputLabel(tool: ToolCall, t: TFunction): string | null {
  const input = tool.input && typeof tool.input === 'object' ? (tool.input as any) : null;
  if (!input) return null;
  switch (tool.name) {
    case 'search_scripture':
    case 'search_catechism': {
      const q = typeof input.query === 'string' ? input.query.trim() : '';
      return q ? `“${q}”` : null;
    }
    case 'get_verses': {
      const book = typeof input.book === 'string' ? input.book.trim().toUpperCase() : '';
      const ch = typeof input.chapter === 'number' ? input.chapter : 0;
      if (!book || ch < 1) return null;
      let s = `${book} ${ch}`;
      const from = typeof input.verse_from === 'number' ? input.verse_from : 0;
      const to = typeof input.verse_to === 'number' ? input.verse_to : 0;
      if (from > 0) s += `:${from}`;
      if (to > 0 && to !== from) s += `–${to}`;
      return s;
    }
    case 'get_catechism': {
      const from = typeof input.from === 'number' ? input.from : 0;
      if (from < 1) return null;
      const to = typeof input.to === 'number' ? input.to : 0;
      return to > 0 && to !== from ? `CCC ${from}–${to}` : `CCC ${from}`;
    }
    case 'graph_related': {
      const id = typeof input.entity_id === 'string' ? input.entity_id.trim() : '';
      return id || null;
    }
    default:
      return null;
  }
}

// toolIcon picks an icon per tool kind.
function toolIcon(name: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  switch (name) {
    case 'search_scripture':
    case 'search_catechism':
      return 'book-search-outline';
    case 'get_verses':
    case 'get_catechism':
      return 'book-open-variant';
    case 'graph_related':
      return 'link-variant';
    default:
      return 'cog-outline';
  }
}

// extractRefs pulls the entity ids/paragraph numbers a tool returned so the
// details panel can show readable references (JHN.3.16, CCC.2077, ...).
function extractRefs(output: any): string[] {
  if (!output) return [];
  const refs: string[] = [];
  const arr = Array.isArray(output) ? output : [output];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const id = item.entity_id;
    if (typeof id === 'string' && id && !refs.includes(id)) refs.push(id);
    else if (typeof item.number === 'number' && item.number > 0) {
      const ccc = `CCC.${item.number}`;
      if (!refs.includes(ccc)) refs.push(ccc);
    }
  }
  return refs.slice(0, 6);
}

export function ChatScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const isDark = c.mode !== 'light';

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState('');
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const [error, setError] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detailsFor, setDetailsFor] = useState<Turn | null>(null);
  const [moreFor, setMoreFor] = useState<{ turn: Turn; key: string } | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  const convId = useRef<string | undefined>(route.params?.conversationId);
  const abort = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const lastFailed = useRef<string | null>(null);
  const streamTools = useRef<ToolCall[]>([]);
  const pendingInitialScroll = useRef(false);

  // Track the keyboard so the absolutely-positioned input floats above it on
  // iOS (Android resizes the window itself via adjustResize).
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKbHeight(Platform.OS === 'ios' ? e.endCoordinates.height : 0),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    const id = route.params?.conversationId;
    if (!id) return;
    convId.current = id;
    void getConversation(id)
      .then((res) => {
        setTurns(
          res.messages.map((m) => ({
            role: m.role,
            content: m.content,
            id: m.id,
            model: m.metadata?.model,
            toolCalls: m.metadata?.toolCalls,
          })),
        );
        pendingInitialScroll.current = true;
      })
      .catch(() => setError(true));
  }, [route.params?.conversationId]);

  // Once the loaded history is rendered, jump to the latest message. Long chats
  // need a beat for the whole list to lay out, so retry briefly until the
  // content size stops growing.
  useEffect(() => {
    if (!pendingInitialScroll.current) return;
    let tries = 0;
    let prevSize = 0;
    const timer = setInterval(() => {
      const size = scrollRef.current?.getInnerViewNode?.() as unknown;
      const contentSize = (size as { scrollHeight?: number } | null)?.scrollHeight ?? 0;
      const settled = contentSize > 0 && contentSize === prevSize;
      prevSize = contentSize;
      tries++;
      if (settled || tries >= 20) {
        clearInterval(timer);
        pendingInitialScroll.current = false;
        scrollRef.current?.scrollToEnd({ animated: false });
      }
    }, 80);
    return () => clearInterval(timer);
  }, [turns.length]);

  useEffect(() => () => abort.current?.abort(), []);

  const goToCitation = useCallback(
    (id: string) => {
      if (id.startsWith('CCC.')) {
        const n = Number(id.slice(4));
        if (n > 0) {
          useCatechismStore.getState().focus(n);
          navigation.navigate('Catechism');
        }
        return;
      }
      const [book, ch, v] = id.split('.');
      if (book && ch && v) {
        useReaderStore.getState().setLocation(book, Number(ch), Number(v));
        navigation.navigate('Bible');
      }
    },
    [navigation],
  );

  // runStream performs the actual streaming request for a message. It does not
  // append a user turn; the caller decides whether that turn already exists
  // (send) or must be re-sent (retry).
  const runStream = useCallback(
    async (message: string) => {
      if (streaming) return;
      setError(false);
      setPartial('');
      setCurrentToolCalls([]);
      streamTools.current = [];
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
            onToolStart: (tool) => {
              streamTools.current = [...streamTools.current, tool];
              setCurrentToolCalls(streamTools.current);
            },
            onToolEnd: (tool) => {
              streamTools.current = streamTools.current.map((x) =>
                x.ref === tool.ref ? { ...x, ...tool, status: 'completed' } : x,
              );
              setCurrentToolCalls(streamTools.current);
            },
          },
        );
        convId.current = res.conversation_id;
        setTurns((prev) => [
          ...prev,
          { role: 'assistant', content: acc, id: res.message_id, model: res.model, toolCalls: res.toolCalls ?? streamTools.current },
        ]);
      } catch (e) {
        if (e instanceof ChatError && e.status === 503) setDisabled(true);
        else if (!ctrl.signal.aborted) {
          setError(true);
          lastFailed.current = message;
        }
      } finally {
        setStreaming(false);
        setPartial('');
        setCurrentToolCalls([]);
        streamTools.current = [];
        abort.current = null;
      }
    },
    [streaming, language],
  );

  const send = useCallback(() => {
    const message = input.trim();
    if (!message || streaming) return;
    setInput('');
    setTurns((prev) => [...prev, { role: 'user', content: message, id: `user-${Date.now()}` }]);
    void runStream(message);
  }, [input, streaming, runStream]);

  const retry = useCallback(() => {
    const msg = lastFailed.current;
    if (msg && !streaming) void runStream(msg);
  }, [streaming, runStream]);

  // Show the floating "jump to bottom" button once the user scrolls more than a
  // screen-ish amount away from the latest message.
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceFromEnd = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      setShowScrollToBottom(distanceFromEnd > 120);
    },
    [setShowScrollToBottom],
  );

  const scrollToEnd = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  const sendSuggestion = useCallback(
    (text: string) => {
      if (streaming) return;
      setInput('');
      setTurns((prev) => [...prev, { role: 'user', content: text, id: `user-${Date.now()}` }]);
      void runStream(text);
    },
    [streaming, runStream],
  );

  const copyTurn = useCallback(async (turn: Turn, key: string) => {
    await Clipboard.setStringAsync(turn.content);
    setCopiedId(key);
    setTimeout(() => setCopiedId((cur) => (cur === key ? null : cur)), 1500);
  }, []);

  const rate = useCallback((turn: Turn, val: 'up' | 'down') => {
    setTurns((prev) =>
      prev.map((x) => (x === turn ? { ...x, rating: x.rating === val ? null : val } : x)),
    );
  }, []);

  // Render the action row inside the assistant bubble: rate, copy, then a
  // "more" menu that holds the tool-call details view.
  const renderActions = (turn: Turn, key: string) => {
    if (turn.role !== 'assistant') return null;
    return (
      <XStack gap="$3" mt="$2" pt="$2" borderTopWidth={1} borderTopColor={c.border} items="center">
        <MaterialCommunityIcons
          name={turn.rating === 'up' ? 'thumb-up' : 'thumb-up-outline'}
          size={16}
          color={turn.rating === 'up' ? c.accent : c.muted}
          onPress={() => rate(turn, 'up')}
        />
        <MaterialCommunityIcons
          name={turn.rating === 'down' ? 'thumb-down' : 'thumb-down-outline'}
          size={16}
          color={turn.rating === 'down' ? c.accent : c.muted}
          onPress={() => rate(turn, 'down')}
        />
        <MaterialCommunityIcons
          name={copiedId === key ? 'check' : 'content-copy'}
          size={16}
          color={copiedId === key ? c.accent : c.muted}
          onPress={() => copyTurn(turn, key)}
        />
        <MaterialCommunityIcons
          name="dots-horizontal"
          size={18}
          color={c.muted}
          onPress={() => setMoreFor({ turn, key })}
        />
      </XStack>
    );
  };

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
      <YStack key={key} px="$4" py="$2">
        <XStack justify="flex-start">
          <View bg={c.bgElevated} rounded={16} px="$4" py="$3" maxW="90%" borderWidth={1} borderColor={c.border}>
            {renderMarkdown(turn.content, c, goToCitation, `msg-${key}`)}
            {renderActions(turn, key)}
          </View>
        </XStack>
      </YStack>
    );
  };

  return (
    <View flex={1} bg={c.bg}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 48}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingTop: insets.top + 6 + 48, paddingBottom: insets.bottom + 120 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            if (streaming || !showScrollToBottom) scrollRef.current?.scrollToEnd({ animated: true });
          }}
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
            <YStack px="$5" py="$4" gap="$3" items="stretch">
              <YStack items="center" gap="$2" py="$3">
                <MaterialCommunityIcons name="star-four-points-outline" size={40} color={c.muted} />
                <Text color={c.muted} text="center" fontSize={14}>
                  {t('chat.empty')}
                </Text>
              </YStack>
              <Text color={c.muted} fontSize={12} fontWeight="700" text="center" opacity={0.6}>
                {t('chat.suggestions')}
              </Text>
              {SUGGESTION_KEYS.map((k) => (
                <View
                  key={k}
                  bg={c.bgElevated}
                  rounded={14}
                  borderWidth={1}
                  borderColor={c.border}
                  p="$3"
                  onPress={() => sendSuggestion(t(`chat.${k}` as never))}
                  pressStyle={{ opacity: 0.7 }}
                >
                  <XStack gap="$2" items="center">
                    <MaterialCommunityIcons name="comment-question-outline" size={18} color={c.accent} />
                    <Text flex={1} fontSize={14} color={c.strong}>
                      {t(`chat.${k}` as never)}
                    </Text>
                  </XStack>
                </View>
              ))}
            </YStack>
          ) : (
            turns.map((turn, i) => renderContent(turn, String(i)))
          )}

          {/* Streaming assistant response: tools / thinking live in a plain row
              outside the card; the card itself only ever holds markdown. */}
          {streaming && (
            <>
              {currentToolCalls.length > 0 && (
                <XStack justify="flex-start" px="$5" py={2} gap="$2" items="center">
                  <Spinner size="small" color={c.accent} />
                  <MaterialCommunityIcons
                    name={toolIcon(currentToolCalls[currentToolCalls.length - 1].name)}
                    size={16}
                    color={c.muted}
                  />
                  <YStack gap={2}>
                    <Text color={c.muted} fontSize={13}>
                      {toolLabel(currentToolCalls[currentToolCalls.length - 1].name, t)}
                    </Text>
                    {toolInputLabel(currentToolCalls[currentToolCalls.length - 1], t) && (
                      <Text color={c.muted} fontSize={12}>
                        {toolInputLabel(currentToolCalls[currentToolCalls.length - 1], t)}
                      </Text>
                    )}
                  </YStack>
                </XStack>
              )}
              {currentToolCalls.length === 0 && !partial && (
                <XStack justify="flex-start" px="$5" py={2} gap="$2" items="center">
                  <Spinner size="small" color={c.accent} />
                  <Text color={c.muted} fontSize={13}>
                    {t('chat.thinking')}
                  </Text>
                </XStack>
              )}
              {partial ? (
                <XStack justify="flex-start" px="$4" py="$2">
                  <View bg={c.bgElevated} rounded={16} px="$4" py="$3" maxW="90%" borderWidth={1} borderColor={c.border}>
                    {renderMarkdown(partial, c, goToCitation, 'streaming')}
                  </View>
                </XStack>
              ) : null}
            </>
          )}

          {error && (
            <XStack items="center" justify="center" gap="$2" py="$3">
              <Text color={c.muted} fontSize={13}>
                {t('chat.error')}
              </Text>
              <Text color={c.accent} fontSize={13} fontWeight="700" onPress={retry}>
                {t('chat.retry')}
              </Text>
            </XStack>
          )}
        </ScrollView>

        {/* Floating "jump to latest" button */}
        {showScrollToBottom && !disabled && (
          <View
            style={{ position: 'absolute', left: 0, right: 0, bottom: kbHeight + insets.bottom + 110 }}
            items="center"
          >
            <View
              width={40}
              height={40}
              rounded={20}
              items="center"
              justify="center"
              bg={c.bgElevated}
              borderWidth={1}
              borderColor={c.border}
              onPress={scrollToEnd}
              pressStyle={{ opacity: 0.7 }}
            >
              <MaterialCommunityIcons name="chevron-down" size={22} color={c.accent} />
            </View>
          </View>
        )}

        {/* Floating input bar: a rounded pill that sits over the chat, with a
            gradient fading the messages behind it. */}
        {/* Bottom fade: the chat content softly fades into the background at the
            very bottom of the screen, behind the floating input pill. */}
        {!disabled && (
          <LinearGradient
            colors={['transparent', c.bg]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }}
            pointerEvents="none"
          />
        )}

        {/* Floating input: absolutely positioned over the chat so messages
            scroll underneath it. */}
        {!disabled && (
          <View
            style={{ position: 'absolute', left: 0, right: 0, bottom: kbHeight }}
            pt="$2"
            pb={insets.bottom + 20}
          >
            <View
              flexDirection="row"
              items="flex-end"
              ml="$3"
              mr="$3"
              bg={c.bgElevated}
              rounded={26}
              borderWidth={1}
              borderColor={c.border}
              pl="$4"
              pr="$2"
              py="$1"
              style={{ shadowColor: '#000', shadowOpacity: isDark ? 0.4 : 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
            >
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t('chat.placeholder')}
                placeholderTextColor={c.muted}
                multiline
                editable={!streaming}
                style={{ flex: 1, color: c.strong, fontSize: 15, maxHeight: 120, minHeight: 40, paddingVertical: 10 }}
              />
              <View
                width={40}
                height={40}
                rounded={20}
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
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Floating header over a fade, so the chat scrolls under it. */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={[c.bg, 'transparent']}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: insets.top + 6 + 70,
          }}
          pointerEvents="none"
        />
        <XStack items="center" px="$3" py="$2" gap="$2" pt={insets.top + 6} pointerEvents="box-none">
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
              lastFailed.current = null;
              setDetailsFor(null);
              setMoreFor(null);
              setCopiedId(null);
            }}
          />
          <MaterialCommunityIcons
            name="history"
            size={24}
            color={c.accent}
            onPress={() => navigation.navigate('Conversations')}
          />
        </XStack>
      </View>

      {/* Tool-call details */}
      <Modal
        visible={detailsFor !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailsFor(null)}
      >
        <View flex={1} bg="rgba(0,0,0,0.6)" justify="flex-end" onPress={() => setDetailsFor(null)}>
          <YStack
            bg={c.bgElevated}
            borderTopLeftRadius={24}
            borderTopRightRadius={24}
            borderWidth={1}
            borderColor={c.border}
            maxH="85%"
            pb={insets.bottom + 20}
            onPress={(e) => e.stopPropagation()}
          >
            <XStack items="center" justify="space-between" px="$4" py="$3">
              <Text fontFamily={serif} fontSize={18} fontWeight="700" color={c.strong}>
                {t('chat.details')}
              </Text>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={c.muted}
                onPress={() => setDetailsFor(null)}
              />
            </XStack>
            <Separator borderColor={c.border} />
            {detailsFor && (
              <YStack p="$4" gap="$3">
                {detailsFor.model ? (
                  <XStack items="center" gap="$2">
                    <MaterialCommunityIcons name="robot-outline" size={16} color={c.accent} />
                    <Text fontSize={13} color={c.muted}>
                      {t('chat.model')}:{' '}
                      <Text fontWeight="700" color={c.strong}>
                        {detailsFor.model}
                      </Text>
                    </Text>
                  </XStack>
                ) : null}
                <YStack gap="$2">
                  <Text fontSize={13} fontWeight="700" color={c.strong}>
                    {t('chat.tools')}
                  </Text>
                  {detailsFor.toolCalls && detailsFor.toolCalls.length > 0 ? (
                    detailsFor.toolCalls.map((tool, i) => {
                      const refs = extractRefs(tool.output);
                      const inputLabel = toolInputLabel(tool, t);
                      return (
                        <View
                          key={i}
                          bg={c.chip}
                          rounded={10}
                          p="$3"
                          borderWidth={1}
                          borderColor={c.border}
                        >
                          <XStack items="center" gap="$2" mb={2}>
                            <MaterialCommunityIcons name={toolIcon(tool.name)} size={18} color={c.accent} />
                            <Text flex={1} fontSize={14} fontWeight="700" color={c.strong}>
                              {toolLabelPast(tool.name, t)}
                            </Text>
                            <MaterialCommunityIcons
                              name={tool.status === 'completed' ? 'check-circle' : 'progress-clock'}
                              size={16}
                              color={tool.status === 'completed' ? c.accent : c.muted}
                            />
                          </XStack>
                          {inputLabel && (
                            <Text fontSize={12} color={c.muted}>
                              {inputLabel}
                            </Text>
                          )}
                          {refs.length > 0 && (
                            <Text fontSize={12} color={c.muted} mt={2}>
                              {t('chat.references')}: {refs.join(', ')}
                            </Text>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <Text fontSize={13} color={c.muted}>
                      {t('chat.noTools')}
                    </Text>
                  )}
                </YStack>
              </YStack>
            )}
          </YStack>
        </View>
      </Modal>

      {/* Per-message "more" menu */}
      <Modal
        visible={moreFor !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setMoreFor(null)}
      >
        <View flex={1} bg="rgba(0,0,0,0.6)" justify="flex-end" onPress={() => setMoreFor(null)}>
          <YStack
            bg={c.bgElevated}
            borderTopLeftRadius={24}
            borderTopRightRadius={24}
            borderWidth={1}
            borderColor={c.border}
            pb={insets.bottom + 16}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              m="$2"
              rounded={10}
              onPress={() => {
                if (moreFor) {
                  setDetailsFor(moreFor.turn);
                  setMoreFor(null);
                }
              }}
              pressStyle={{ bg: c.chip }}
            >
              <XStack items="center" gap="$2" p="$3">
                <MaterialCommunityIcons name="text-box-search-outline" size={20} color={c.accent} />
                <Text color={c.strong} fontSize={15}>
                  {t('chat.details')}
                </Text>
              </XStack>
            </View>
          </YStack>
        </View>
      </Modal>
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
