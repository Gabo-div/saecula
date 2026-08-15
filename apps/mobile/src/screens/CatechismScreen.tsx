import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, LayoutAnimation, Modal, Platform, ScrollView, UIManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { fetchCatechism, searchCatechism } from '@/api/client';
import {
  ReaderMiniBar,
  ReaderSearchSheet,
  ReaderSettingsSheet,
  ReaderTitle,
  superscript,
  useReaderChrome,
  type SearchItem,
} from '@/components/ReaderChrome';
import { HeaderIconButton, ScreenHeader } from '@/components/ScreenHeader';
import { CATECHISM_PARTS, CATECHISM_PROLOGUE, type CatechismEntry } from '@/data/catechism';
import type { RootTabParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useReaderPrefs } from '@/store/readerPrefsStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import type { CatechismParagraph } from '@/types/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PAGE = 50;
const LANGS = ['en', 'es', 'la'] as const;
type Lang = (typeof LANGS)[number];
const LANG_LABELS: Record<Lang, string> = { en: 'English', es: 'Español', la: 'Latina' };

interface Section {
  from: number;
  to: number;
  label: string;
}

// A chapter/section group: a header followed by its articles (or a headerless
// run of articles before the first header). Range spans its articles.
interface Group {
  header: CatechismEntry | null;
  from: number;
  to: number;
  articles: CatechismEntry[];
}

function groupEntries(entries: CatechismEntry[]): Group[] {
  const groups: Group[] = [];
  let cur: Group | null = null;
  for (const e of entries) {
    if (e.header) {
      cur = { header: e, from: Infinity, to: 0, articles: [] };
      groups.push(cur);
    } else if (e.from != null && e.to != null) {
      if (!cur) {
        cur = { header: null, from: Infinity, to: 0, articles: [] };
        groups.push(cur);
      }
      cur.articles.push(e);
      cur.from = Math.min(cur.from, e.from);
      cur.to = Math.max(cur.to, e.to);
    }
  }
  return groups;
}

const easeNext = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

// ---------------------------------------------------------------------------
// Section + translation picker (modal) — mirrors the Bible's book picker.
// Parts are collapsible so the sheet opens compact instead of listing every
// article at once.
// ---------------------------------------------------------------------------

function SectionPicker({
  visible,
  lang,
  onPickLang,
  onPickSection,
  onClose,
}: {
  visible: boolean;
  lang: Lang;
  onPickLang: (l: Lang) => void;
  onPickSection: (s: Section) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const c = useAppTheme();
  const [openPart, setOpenPart] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const togglePart = (key: string) => {
    easeNext();
    setOpenPart((cur) => (cur === key ? null : key));
  };
  const toggleGroup = (key: string) => {
    easeNext();
    setOpenGroups((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const articleRow = (e: CatechismEntry, key: string, pl: '$6' | '$8') => (
    <XStack
      key={key}
      pl={pl}
      pr="$4"
      py="$2"
      items="center"
      gap="$2"
      onPress={() =>
        e.from != null &&
        e.to != null &&
        onPickSection({ from: e.from, to: e.to, label: e.label[lang] })
      }
      pressStyle={{ bg: c.bg }}
    >
      <Text color={c.strong} fontSize={14} flex={1}>
        {e.label[lang]}
      </Text>
      <Text color={c.muted} fontSize={11}>
        {e.from}–{e.to}
      </Text>
    </XStack>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        flex={1}
        bg="rgba(0,0,0,0.6)"
        justify="flex-end"
        onPress={onClose}
        pressStyle={{ opacity: 1 }}
      >
        <YStack
          bg={c.bgElevated}
          borderTopLeftRadius={24}
          borderTopRightRadius={24}
          borderWidth={1}
          borderColor={c.border}
          maxH="85%"
          pb={insets.bottom + 8}
          onPress={(e) => e.stopPropagation()}
        >
          <XStack items="center" px="$4" py="$3" gap="$3">
            <Text color={c.strong} fontFamily={serif} fontSize={18} fontWeight="600">
              {t('catechism.title')}
            </Text>
            <View ml="auto">
              <MaterialCommunityIcons name="close" size={24} color={c.muted} onPress={onClose} />
            </View>
          </XStack>
          <Separator borderColor={c.border} />

          {/* Translation selector */}
          <YStack px="$4" py="$3" gap="$2">
            <Text color={c.muted} fontSize={11} letterSpacing={2}>
              {t('catechism.translation').toUpperCase()}
            </Text>
            <XStack gap="$2">
              {LANGS.map((l) => {
                const active = l === lang;
                return (
                  <View
                    key={l}
                    px="$3"
                    py="$2"
                    rounded={18}
                    bg={active ? c.accent : 'transparent'}
                    borderWidth={1}
                    borderColor={active ? c.accent : c.border}
                    onPress={() => onPickLang(l)}
                    pressStyle={{ opacity: 0.7 }}
                  >
                    <Text color={active ? c.bg : c.strong} fontSize={12}>
                      {LANG_LABELS[l]}
                    </Text>
                  </View>
                );
              })}
            </XStack>
          </YStack>
          <Separator borderColor={c.border} />

          <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Prologue — a leaf section */}
            <XStack
              px="$4"
              py="$3"
              items="center"
              gap="$2"
              onPress={() =>
                onPickSection({
                  from: CATECHISM_PROLOGUE.from,
                  to: CATECHISM_PROLOGUE.to,
                  label: CATECHISM_PROLOGUE.label[lang],
                })
              }
              pressStyle={{ bg: c.bg }}
            >
              <Text color={c.strong} fontSize={15} flex={1}>
                {CATECHISM_PROLOGUE.label[lang]}
              </Text>
              <Text color={c.muted} fontSize={11}>
                {CATECHISM_PROLOGUE.from}–{CATECHISM_PROLOGUE.to}
              </Text>
            </XStack>

            {/* The four pillars — collapsible, then collapsible chapters. */}
            {CATECHISM_PARTS.map((part) => {
              const expanded = openPart === part.key;
              return (
                <YStack key={part.key}>
                  <XStack
                    px="$4"
                    py="$3"
                    items="center"
                    gap="$2"
                    bg={expanded ? c.bg : 'transparent'}
                    onPress={() => togglePart(part.key)}
                    pressStyle={{ bg: c.bg }}
                  >
                    <Text color={c.accent} fontFamily={serif} fontSize={13} width={22}>
                      {part.roman}
                    </Text>
                    <Text color={c.strong} fontSize={15} fontWeight="600" flex={1}>
                      {part.name[lang]}
                    </Text>
                    <Text color={c.muted} fontSize={11}>
                      {part.from}–{part.to}
                    </Text>
                    <MaterialCommunityIcons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={c.muted}
                    />
                  </XStack>

                  {expanded &&
                    groupEntries(part.entries).map((g, gi) => {
                      if (!g.header) {
                        return g.articles.map((e, ai) =>
                          articleRow(e, `${part.key}-b-${gi}-${ai}`, '$6'),
                        );
                      }
                      const gkey = `${part.key}-${gi}`;
                      const gopen = openGroups.has(gkey);
                      return (
                        <YStack key={gkey}>
                          <XStack
                            pl="$6"
                            pr="$4"
                            py="$2.5"
                            items="center"
                            gap="$2"
                            onPress={() => toggleGroup(gkey)}
                            pressStyle={{ bg: c.bg }}
                          >
                            <Text color={c.muted} fontSize={13} fontStyle="italic" flex={1}>
                              {g.header.label[lang]}
                            </Text>
                            <Text color={c.muted} fontSize={11}>
                              {g.from}–{g.to}
                            </Text>
                            <MaterialCommunityIcons
                              name={gopen ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color={c.muted}
                            />
                          </XStack>
                          {gopen && g.articles.map((e, ai) => articleRow(e, `${gkey}-${ai}`, '$8'))}
                        </YStack>
                      );
                    })}
                  <Separator borderColor={c.border} opacity={0.5} />
                </YStack>
              );
            })}
          </ScrollView>
        </YStack>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

type Props = BottomTabScreenProps<RootTabParamList, 'Catechism'>;

export function CatechismScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const { compact, onScroll } = useReaderChrome(navigation);
  const fontScale = useReaderPrefs((s) => s.fontScale);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pFont = Math.round(16 * fontScale);
  const pLine = Math.round(pFont * 1.6);
  const appLang = useLanguageStore((s) => s.language);

  const [lang, setLang] = useState<Lang>(
    (LANGS as readonly string[]).includes(appLang) ? (appLang as Lang) : 'en',
  );
  const [section, setSection] = useState<Section>({
    from: CATECHISM_PROLOGUE.from,
    to: CATECHISM_PROLOGUE.to,
    label: CATECHISM_PROLOGUE.label[lang],
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const [items, setItems] = useState<CatechismParagraph[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasMore = useRef(true);
  const nextFrom = useRef(section.from);
  const inFlight = useRef(false);
  const gen = useRef(0); // bumped on every fresh load; stale results are ignored

  const load = useCallback(
    async (fresh: boolean) => {
      if (!fresh && (inFlight.current || !hasMore.current)) return;
      const myGen = fresh ? ++gen.current : gen.current;
      if (fresh) {
        hasMore.current = true;
        nextFrom.current = section.from;
      }
      inFlight.current = true;
      setLoading(true);
      setError(null);
      try {
        const start = fresh ? section.from : nextFrom.current;
        const res = await fetchCatechism(start, section.to, PAGE, lang);
        if (myGen !== gen.current) return; // superseded by a newer fresh load
        setItems((prev) => {
          const base = fresh ? [] : prev;
          const seen = new Set(base.map((p) => p.number));
          return [...base, ...res.paragraphs.filter((p) => !seen.has(p.number))];
        });
        hasMore.current = res.has_more;
        if (res.paragraphs.length > 0) {
          nextFrom.current = res.paragraphs[res.paragraphs.length - 1].number + 1;
        }
      } catch {
        if (myGen === gen.current) setError(t('catechism.loadError'));
      } finally {
        if (myGen === gen.current) {
          inFlight.current = false;
          setLoading(false);
        }
      }
    },
    [section, lang, t],
  );

  // Re-scope whenever the section or translation changes.
  useEffect(() => {
    void load(true);
  }, [load]);

  const runSearch = useCallback(
    async (q: string): Promise<SearchItem[]> => {
      const res = await searchCatechism(q, lang);
      return res.results.map((p) => ({
        key: String(p.number),
        title: `${t('catechism.title')} ${p.number}`,
        snippet: p.snippet,
      }));
    },
    [lang, t],
  );

  const pickResult = (item: SearchItem) => {
    const n = Number(item.key);
    setSection({ from: n, to: 2865, label: item.title });
    setSearchOpen(false);
  };

  return (
    <View flex={1} bg={c.bg} pt={compact ? insets.top : insets.top + 8}>
      {!compact && (
        <>
          <ScreenHeader title={t('catechism.title')} />

          {/* Section chip + tools */}
          <XStack px="$4" py="$2" items="center" gap="$2">
            <XStack
              flex={1}
              items="center"
              gap="$2"
              px="$3"
              py="$2"
              rounded={20}
              bg={c.bgElevated}
              borderWidth={1}
              borderColor={c.border}
              onPress={() => setPickerOpen(true)}
              pressStyle={{ borderColor: c.accent }}
            >
              <Text color={c.strong} fontSize={14} fontWeight="600" flex={1} numberOfLines={1}>
                {section.label}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color={c.accent} />
            </XStack>
            <HeaderIconButton icon="book-open-variant" onPress={() => setPickerOpen(true)} />
            <HeaderIconButton icon="magnify" onPress={() => setSearchOpen(true)} />
            <HeaderIconButton icon="dots-vertical" onPress={() => setSettingsOpen(true)} />
          </XStack>

          <Separator borderColor={c.border} mx="$4" />
        </>
      )}

      {error && items.length === 0 ? (
        <YStack flex={1} items="center" justify="center" px="$6" gap="$3">
          <MaterialCommunityIcons name="book-alert-outline" size={40} color={c.muted} />
          <Text color={c.muted} text="center">
            {error}
          </Text>
        </YStack>
      ) : (
        <FlatList
          data={items}
          key={`${section.from}.${lang}`}
          keyExtractor={(p) => String(p.number)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <ReaderTitle overline={t('catechism.title')} main={section.label} />
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}
          onEndReached={() => load(false)}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
            <Text color={c.text} fontFamily={serif} fontSize={pFont} lineHeight={pLine} mb="$3">
              <Text color={c.accent} fontWeight="700">
                {superscript(item.number)}{' '}
              </Text>
              {item.text}
            </Text>
          )}
          ListFooterComponent={
            loading ? <Spinner mt="$4" size="large" color={c.accent} /> : <YStack height={8} />
          }
        />
      )}

      {compact && <ReaderMiniBar title={section.label} />}

      <ReaderSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <ReaderSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSearch={runSearch}
        onPick={pickResult}
      />

      <SectionPicker
        visible={pickerOpen}
        lang={lang}
        onPickLang={setLang}
        onPickSection={(s) => {
          setSection(s);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}
