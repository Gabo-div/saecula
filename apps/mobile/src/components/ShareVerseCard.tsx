import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Share, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import type { Verse } from '@/types/api';

type Props = {
  visible: boolean;
  verse?: Verse;
  verses?: Verse[];
  bookName: string;
  chapter: number;
  onClose: () => void;
};

export function ShareVerseCard({ visible, verse, verses, bookName, chapter, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardRef = useRef<any>(null);

  const items = verses ?? (verse ? [verse] : []);
  const isMulti = items.length > 1;
  const firstRef = items[0] ? `${bookName} ${chapter}:${items[0].number}` : '';
  const lastRef = items.length > 1 && items[items.length - 1]
    ? `${bookName} ${chapter}:${items[items.length - 1]!.number}`
    : firstRef;
  const referenceLabel = isMulti ? `${firstRef}–${lastRef}` : firstRef;

  if (!visible || items.length === 0) return null;

  const handleCopyLink = async () => {
    if (items.length === 1) {
      const webLink = `https://saecula.app/bible/${encodeURIComponent(items[0]!.entity_id)}`;
      await Clipboard.setStringAsync(webLink);
    } else {
      const links = items
        .map((v) => `https://saecula.app/bible/${encodeURIComponent(v.entity_id)}`)
        .join('\n');
      await Clipboard.setStringAsync(links);
    }
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleShareImage = async () => {
    if (!cardRef.current) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('bookmarks.imageSaveError'));
        return;
      }
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: 1080,
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('bookmarks.imageSaved'));
    } catch {
      Alert.alert(t('bookmarks.imageSaveError'));
    }
  };

  const verseCount = items.length;
  const vFontSize = verseCount <= 1 ? 18 : verseCount === 2 ? 16 : 14;
  const vLineHeight = Math.round(vFontSize * 1.55);
  const refFontSize = verseCount <= 1 ? 15 : verseCount === 2 ? 13 : 12;

  const buildShareText = () => {
    if (items.length === 1) {
      const v = items[0]!;
      const ref = `${bookName} ${chapter}:${v.number}`;
      return `"${v.text}" — ${ref}`;
    }
    const lines = items.map((v) => {
      const ref = `${bookName} ${chapter}:${v.number}`;
      return `"${v.text}" — ${ref}`;
    });
    return lines.join('\n\n');
  };

  const handleShareText = async () => {
    await Share.share({ message: buildShareText() });
  };

  return (
    <View
      flex={1}
      style={{ ...StyleSheet.absoluteFillObject, zIndex: 200 } as any}
      bg="rgba(0,0,0,0.7)"
      items="center"
      justify="center"
      onPress={onClose}
      pressStyle={{ opacity: 1 }}
      px="$6"
    >
      <YStack
        gap="$4"
        width="100%"
        maxW={360}
        onPress={(e: any) => e.stopPropagation()}
      >
        <View
          ref={cardRef}
          bg={c.bg}
          rounded={16}
          borderWidth={1}
          borderColor={c.border}
          p="$6"
          items="center"
          gap="$4"
        >
          <View width={48} height={2} rounded={1} bg={c.accent} opacity={0.4} />
          {items.map((v, i) => {
            const ref = `${bookName} ${chapter}:${v.number}`;
            return (
              <YStack key={v.entity_id} gap={verseCount <= 1 ? 12 : 8} items="center">
                {i > 0 && <View width={32} height={1} rounded={1} bg={c.border} my="$1" />}
                <Text
                  color={c.text}
                  fontFamily={serif}
                  fontSize={vFontSize}
                  lineHeight={vLineHeight}
                  text="center"
                  fontStyle="italic"
                  numberOfLines={verseCount >= 3 ? 4 : undefined}
                >
                  &ldquo;{v.text}&rdquo;
                </Text>
                <Text color={c.accent} fontFamily={serif} fontSize={refFontSize} fontWeight="600">
                  — {ref}
                </Text>
              </YStack>
            );
          })}
          <XStack items="center" gap="$1" mt="$1">
            <MaterialCommunityIcons name="book-cross" size={14} color={c.muted} />
            <Text color={c.muted} fontSize={11} letterSpacing={1}>
              SAECULA
            </Text>
          </XStack>
        </View>

        <YStack gap="$2">
          <ShareButton
            icon="image-outline"
            label={t('bookmarks.shareImage')}
            onPress={handleShareImage}
            accent
          />
          <ShareButton
            icon="link-variant"
            label={t('bookmarks.copyLink')}
            onPress={handleCopyLink}
          />
          <ShareButton
            icon="text-box-outline"
            label={isMulti ? t('bookmarks.shareMulti') : t('bookmarks.shareText')}
            onPress={handleShareText}
          />
        </YStack>

        <XStack
          items="center"
          justify="center"
          py="$3"
          rounded={12}
          borderWidth={1}
          borderColor={c.border}
          onPress={onClose}
          pressStyle={{ opacity: 0.7 }}
        >
          <Text color={c.muted} fontSize={15}>
            {t('common.cancel')}
          </Text>
        </XStack>
      </YStack>
    </View>
  );
}

function ShareButton({
  icon,
  label,
  onPress,
  accent,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const c = useAppTheme();
  return (
    <XStack
      items="center"
      gap="$3"
      px="$4"
      py="$3"
      rounded={12}
      bg={accent ? c.accent : 'transparent'}
      borderWidth={accent ? 0 : 1}
      borderColor={c.border}
      onPress={onPress}
      pressStyle={{ opacity: 0.7 }}
    >
      <MaterialCommunityIcons name={icon} size={20} color={accent ? c.bg : c.strong} />
      <Text color={accent ? c.bg : c.strong} fontSize={15} fontWeight={accent ? '600' : '400'}>
        {label}
      </Text>
    </XStack>
  );
}
