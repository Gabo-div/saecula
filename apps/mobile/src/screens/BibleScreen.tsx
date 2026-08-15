import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { fetchBooks, fetchChapter, fetchTranslations, searchBible } from '@/api/client';
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
import type { RootTabParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useReaderPrefs } from '@/store/readerPrefsStore';
import { useReaderStore } from '@/store/readerStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import type { Book, ChapterResponse, Translation } from '@/types/api';

// ---------------------------------------------------------------------------
// Book + chapter + translation picker (modal)
// ---------------------------------------------------------------------------

type PickerStep = 'book' | 'chapter';

function BookPicker({
  visible,
  books,
  translations,
  onClose,
}: {
  visible: boolean;
  books: Book[];
  translations: Translation[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { translationId, setLocation, setTranslation } = useReaderStore();
  const c = useAppTheme();

  const [step, setStep] = useState<PickerStep>('book');
  const [pickedBook, setPickedBook] = useState<Book | null>(null);

  // The list interleaves testament section headers with books.
  const rows = useMemo(() => {
    const out: Array<{ type: 'header'; title: string } | { type: 'book'; book: Book }> = [];
    let lastTestament = '';
    for (const book of books) {
      if (book.testament !== lastTestament) {
        lastTestament = book.testament;
        out.push({
          type: 'header',
          title: book.testament === 'OT' ? t('bible.oldTestament') : t('bible.newTestament'),
        });
      }
      out.push({ type: 'book', book });
    }
    return out;
  }, [books, t]);

  const close = () => {
    setStep('book');
    setPickedBook(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View
        flex={1}
        bg="rgba(0,0,0,0.6)"
        justify="flex-end"
        onPress={close}
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
            {step === 'chapter' && (
              <MaterialCommunityIcons
                name="chevron-left"
                size={26}
                color={c.accent}
                onPress={() => setStep('book')}
              />
            )}
            <Text color={c.strong} fontFamily={serif} fontSize={18} fontWeight="600">
              {step === 'book'
                ? t('bible.bookAndVersion')
                : (pickedBook ? `${pickedBook.name} — ` : '') + t('bible.chapter')}
            </Text>
            <View ml="auto">
              <MaterialCommunityIcons name="close" size={24} color={c.muted} onPress={close} />
            </View>
          </XStack>
          <Separator borderColor={c.border} />

          {step === 'book' ? (
            <>
              {/* Version selector */}
              {translations.length > 0 && (
                <YStack px="$4" py="$3" gap="$2">
                  <Text color={c.muted} fontSize={11} letterSpacing={2}>
                    {t('bible.version').toUpperCase()}
                  </Text>
                  <XStack gap="$2" flexWrap="wrap">
                    {translations.map((t) => {
                      const active =
                        translationId === t.id || (translationId === '' && translations.length === 1);
                      return (
                        <XStack
                          key={`${t.id}-${t.language_code}`}
                          px="$3"
                          py="$2"
                          rounded={18}
                          bg={active ? c.accent : 'transparent'}
                          borderWidth={1}
                          borderColor={active ? c.accent : c.border}
                          onPress={() => setTranslation(t.id)}
                          pressStyle={{ opacity: 0.7 }}
                        >
                          <Text color={active ? c.bg : c.strong} fontSize={12}>
                            {t.id.replace(/_/g, ' ').toUpperCase()} · {t.language_code.toUpperCase()}
                          </Text>
                        </XStack>
                      );
                    })}
                  </XStack>
                </YStack>
              )}
              <Separator borderColor={c.border} />

              <FlatList
                data={rows}
                keyExtractor={(row, i) => (row.type === 'book' ? row.book.code : `h-${i}`)}
                renderItem={({ item }) =>
                  item.type === 'header' ? (
                    <Text
                      px="$4"
                      pt="$4"
                      pb="$2"
                      color={c.accent}
                      fontSize={11}
                      letterSpacing={2}
                      fontWeight="700"
                    >
                      {item.title.toUpperCase()}
                    </Text>
                  ) : (
                    <XStack
                      px="$4"
                      py="$3"
                      items="center"
                      onPress={() => {
                        setPickedBook(item.book);
                        setStep('chapter');
                      }}
                      pressStyle={{ bg: c.bg }}
                    >
                      <Text color={c.strong} fontSize={15}>
                        {item.book.name}
                      </Text>
                      <Text ml="auto" color={c.muted} fontSize={12}>
                        {item.book.chapters} {t('bible.chaptersAbbr')}
                      </Text>
                    </XStack>
                  )
                }
              />
            </>
          ) : (
            pickedBook && (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <XStack flexWrap="wrap" gap="$2">
                  {Array.from({ length: pickedBook.chapters }, (_, i) => i + 1).map((n) => (
                    <View
                      key={n}
                      width={52}
                      height={52}
                      rounded={10}
                      bg={c.bg}
                      borderWidth={1}
                      borderColor={c.border}
                      items="center"
                      justify="center"
                      onPress={() => {
                        setLocation(pickedBook.code, n);
                        close();
                      }}
                      pressStyle={{ borderColor: c.accent }}
                    >
                      <Text color={c.strong} fontSize={15}>
                        {n}
                      </Text>
                    </View>
                  ))}
                </XStack>
              </ScrollView>
            )
          )}
        </YStack>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

type Props = BottomTabScreenProps<RootTabParamList, 'Bible'>;

export function BibleScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const { bookCode, chapter, translationId, setLocation } = useReaderStore();
  const { compact, onScroll } = useReaderChrome(navigation);
  const fontScale = useReaderPrefs((s) => s.fontScale);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const runSearch = useCallback(
    async (q: string): Promise<SearchItem[]> => {
      const res = await searchBible(q, language);
      return res.results.map((v) => ({
        key: `${v.book_code}.${v.chapter}.${v.verse}`,
        title: v.reference,
        snippet: v.text,
      }));
    },
    [language],
  );

  const pickResult = (item: SearchItem) => {
    const [code, ch] = item.key.split('.');
    setLocation(code, Number(ch));
    setSearchOpen(false);
  };

  const vFont = Math.round(17 * fontScale);
  const vLine = Math.round(vFont * 1.6);

  const [books, setBooks] = useState<Book[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [content, setContent] = useState<ChapterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Catalog + editions load once per language.
  useEffect(() => {
    void (async () => {
      try {
        const [b, t] = await Promise.all([fetchBooks(), fetchTranslations()]);
        setBooks(b.books);
        setTranslations(t.translations);
      } catch {
        setError('catalog');
      }
    })();
  }, [language]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContent(await fetchChapter(bookCode, chapter));
    } catch {
      setError(t('bible.loadError'));
    } finally {
      setLoading(false);
    }
  }, [bookCode, chapter, translationId, language]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentBook = books.find((b) => b.code === bookCode);
  const bookName = content?.book_name ?? currentBook?.name ?? '';
  const chapterNo = content?.chapter ?? chapter;
  const title = bookName ? `${bookName} ${chapterNo}` : '…';

  return (
    <View flex={1} bg={c.bg} pt={compact ? insets.top : insets.top + 8}>
      {!compact && (
        <>
          <ScreenHeader title={t('bible.title')} />

          {/* Location chip + tools */}
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
                {title}
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

      {/* Verse text */}
      {loading && !content ? (
        <YStack flex={1} items="center" justify="center">
          <Spinner size="large" color={c.accent} />
        </YStack>
      ) : error ? (
        <YStack flex={1} items="center" justify="center" px="$6" gap="$3">
          <MaterialCommunityIcons name="book-alert-outline" size={40} color={c.muted} />
          <Text color={c.muted} text="center">
            {error}
          </Text>
        </YStack>
      ) : (
        <ScrollView
          key={`${bookCode}.${chapter}.${translationId}`}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}
        >
          <ReaderTitle overline={bookName} main={String(chapterNo)} giant />
          {content?.verses.map((verse) => (
            <Text
              key={verse.entity_id}
              color={c.text}
              fontFamily={serif}
              fontSize={vFont}
              lineHeight={vLine}
              mb="$3"
            >
              <Text color={c.accent} fontWeight="700">
                {superscript(verse.number)}{' '}
              </Text>
              {verse.text}
            </Text>
          ))}
        </ScrollView>
      )}

      {compact && <ReaderMiniBar title={title} />}

      <ReaderSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <ReaderSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSearch={runSearch}
        onPick={pickResult}
      />

      <BookPicker
        visible={pickerOpen}
        books={books}
        translations={translations}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}
