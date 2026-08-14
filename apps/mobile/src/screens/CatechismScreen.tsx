import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { fetchCatechism } from '@/api/client';
import { HeaderIconButton, ScreenHeader } from '@/components/ScreenHeader';
import { CATECHISM_PARTS, CATECHISM_PROLOGUE } from '@/data/catechism';
import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import type { CatechismParagraph } from '@/types/api';

const PAGE = 50;
const LANGS = ['en', 'es', 'la'] as const;
type Lang = (typeof LANGS)[number];
const LANG_LABELS: Record<Lang, string> = { en: 'English', es: 'Español', la: 'Latina' };

interface Section {
  from: number;
  to: number;
  label: string;
}

type PickRow =
  | { kind: 'part'; label: string }
  | { kind: 'header'; label: string }
  | { kind: 'article'; label: string; from: number; to: number };

// ---------------------------------------------------------------------------
// Section + translation picker (modal) — mirrors the Bible's book picker.
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

  const rows = useMemo<PickRow[]>(() => {
    const out: PickRow[] = [
      { kind: 'article', label: t('catechism.prologue'), from: CATECHISM_PROLOGUE.from, to: CATECHISM_PROLOGUE.to },
    ];
    for (const part of CATECHISM_PARTS) {
      out.push({ kind: 'part', label: `${part.roman}. ${t(`catechism.parts.${part.key}`)}` });
      for (const e of part.entries) {
        if (e.header) out.push({ kind: 'header', label: e.label });
        else if (e.from != null && e.to != null)
          out.push({ kind: 'article', label: e.label, from: e.from, to: e.to });
      }
    }
    return out;
  }, [t]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View flex={1} bg="rgba(0,0,0,0.6)" justify="flex-end">
        <YStack
          bg={c.bgElevated}
          borderTopLeftRadius={24}
          borderTopRightRadius={24}
          borderWidth={1}
          borderColor={c.border}
          maxH="85%"
          pb={insets.bottom + 8}
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

          <FlatList
            data={rows}
            keyExtractor={(row, i) => `${row.kind}-${i}`}
            renderItem={({ item }) => {
              if (item.kind === 'part')
                return (
                  <Text px="$4" pt="$4" pb="$1" color={c.accent} fontSize={11} letterSpacing={2} fontWeight="700">
                    {item.label.toUpperCase()}
                  </Text>
                );
              if (item.kind === 'header')
                return (
                  <Text px="$4" pt="$2" pb="$1" color={c.muted} fontSize={12} fontStyle="italic">
                    {item.label}
                  </Text>
                );
              return (
                <XStack
                  px="$4"
                  py="$3"
                  items="center"
                  gap="$2"
                  onPress={() => onPickSection({ from: item.from, to: item.to, label: item.label })}
                  pressStyle={{ bg: c.bg }}
                >
                  <Text color={c.strong} fontSize={15} flex={1}>
                    {item.label}
                  </Text>
                  <Text color={c.muted} fontSize={11}>
                    {item.from}–{item.to}
                  </Text>
                </XStack>
              );
            }}
          />
        </YStack>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

export function CatechismScreen() {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const appLang = useLanguageStore((s) => s.language);

  const [lang, setLang] = useState<Lang>(
    (LANGS as readonly string[]).includes(appLang) ? (appLang as Lang) : 'en',
  );
  const [section, setSection] = useState<Section>({
    from: CATECHISM_PROLOGUE.from,
    to: CATECHISM_PROLOGUE.to,
    label: t('catechism.prologue'),
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const [items, setItems] = useState<CatechismParagraph[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasMore = useRef(true);
  const nextFrom = useRef(section.from);

  const load = useCallback(
    async (fresh: boolean) => {
      if (!fresh && (loading || !hasMore.current)) return;
      setLoading(true);
      setError(null);
      try {
        const start = fresh ? section.from : nextFrom.current;
        const res = await fetchCatechism(start, section.to, PAGE, lang);
        setItems((prev) => (fresh ? res.paragraphs : [...prev, ...res.paragraphs]));
        hasMore.current = res.has_more;
        if (res.paragraphs.length > 0) {
          nextFrom.current = res.paragraphs[res.paragraphs.length - 1].number + 1;
        }
      } catch {
        setError(t('catechism.loadError'));
      } finally {
        setLoading(false);
      }
    },
    // `loading` intentionally omitted: only pagination guards on it, read fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section, lang, t],
  );

  // Re-scope whenever the section or translation changes.
  useEffect(() => {
    hasMore.current = true;
    nextFrom.current = section.from;
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, lang]);

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('catechism.title')} />

      {/* Section chip + tools */}
      <XStack px="$4" py="$2" items="center" gap="$2">
        <XStack
          items="center"
          gap="$2"
          px="$3"
          py="$2"
          rounded={20}
          bg={c.bgElevated}
          borderWidth={1}
          borderColor={c.border}
          flex={1}
          onPress={() => setPickerOpen(true)}
          pressStyle={{ borderColor: c.accent }}
        >
          <Text color={c.strong} fontSize={14} fontWeight="600" flex={1} numberOfLines={1}>
            {section.label}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={c.accent} />
        </XStack>
        <View
          px="$3"
          py="$2"
          rounded={20}
          bg={c.chip}
          borderWidth={1}
          borderColor={c.border}
          onPress={() => setPickerOpen(true)}
          pressStyle={{ opacity: 0.7 }}
        >
          <Text color={c.accent} fontSize={12} fontWeight="700">
            {lang.toUpperCase()}
          </Text>
        </View>
        <HeaderIconButton icon="book-education-outline" onPress={() => setPickerOpen(true)} />
      </XStack>

      <Separator borderColor={c.border} mx="$4" />

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
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }}
          onEndReached={() => load(false)}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
            <XStack gap="$3" items="flex-start">
              <Text color={c.accent} fontFamily={serif} fontSize={13} width={36}>
                {item.number}
              </Text>
              <Text color={c.text} fontFamily={serif} fontSize={16} lineHeight={24} flex={1}>
                {item.text}
              </Text>
            </XStack>
          )}
          ListFooterComponent={
            loading ? <Spinner mt="$4" size="large" color={c.accent} /> : <YStack height={8} />
          }
        />
      )}

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
