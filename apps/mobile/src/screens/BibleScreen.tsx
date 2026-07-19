import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { fetchBooks, fetchChapter, fetchTranslations } from '@/api/client';
import { HeaderIconButton, ScreenHeader } from '@/components/ScreenHeader';
import { useLanguageStore } from '@/store/languageStore';
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

function FloatingNav({
  icon,
  onPress,
}: {
  icon: 'chevron-left' | 'chevron-right';
  onPress: () => void;
}) {
  const c = useAppTheme();
  return (
    <View
      width={52}
      height={52}
      rounded={26}
      bg={c.chip}
      borderWidth={1}
      borderColor={c.border}
      items="center"
      justify="center"
      onPress={onPress}
      pressStyle={{ opacity: 0.7 }}
    >
      <MaterialCommunityIcons name={icon} size={28} color={c.strong} />
    </View>
  );
}

export function BibleScreen() {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const { bookCode, chapter, translationId, setLocation } = useReaderStore();

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
  const bookIndex = books.findIndex((b) => b.code === bookCode);

  // Prev/next cross book boundaries: Gen 50 → Exo 1, and back.
  const goPrev = () => {
    if (chapter > 1) {
      setLocation(bookCode, chapter - 1);
    } else if (bookIndex > 0) {
      const prev = books[bookIndex - 1];
      setLocation(prev.code, prev.chapters);
    }
  };
  const goNext = () => {
    if (currentBook && chapter < currentBook.chapters) {
      setLocation(bookCode, chapter + 1);
    } else if (bookIndex >= 0 && bookIndex < books.length - 1) {
      setLocation(books[bookIndex + 1].code, 1);
    }
  };

  const title = content
    ? `${content.book_name} ${content.chapter}`
    : currentBook
      ? `${currentBook.name} ${chapter}`
      : '…';

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('bible.title')} />

      {/* Location chip + tools */}
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
          onPress={() => setPickerOpen(true)}
          pressStyle={{ borderColor: c.accent }}
        >
          <Text color={c.strong} fontSize={14} fontWeight="600">
            {title}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={c.accent} />
        </XStack>
        <XStack ml="auto" gap="$2">
          <HeaderIconButton icon="book-open-variant" onPress={() => setPickerOpen(true)} />
          <HeaderIconButton icon="magnify" />
          <HeaderIconButton icon="dots-vertical" />
        </XStack>
      </XStack>

      <Separator borderColor={c.border} mx="$4" />

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
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 96 }}
        >
          {content?.verses.map((verse) => (
            <Text
              key={verse.entity_id}
              color={c.text}
              fontFamily={serif}
              fontSize={19}
              lineHeight={32}
              mb="$3"
            >
              <Text color={c.accent} fontSize={13} lineHeight={32}>
                {verse.number}{' '}
              </Text>
              {verse.text}
            </Text>
          ))}
        </ScrollView>
      )}

      {/* Chapter navigation */}
      <XStack position="absolute" b={16} l={0} r={0} px="$4" justify="space-between">
        <FloatingNav icon="chevron-left" onPress={goPrev} />
        <FloatingNav icon="chevron-right" onPress={goNext} />
      </XStack>

      <BookPicker
        visible={pickerOpen}
        books={books}
        translations={translations}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}
