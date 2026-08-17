import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Share, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import type { Verse } from '@/types/api';

type Props = {
  visible: boolean;
  verse: Verse;
  bookName: string;
  chapter: number;
  onClose: () => void;
};

export function ShareVerseCard({ visible, verse, bookName, chapter, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardRef = useRef<any>(null);

  const reference = `${bookName} ${chapter}:${verse.number}`;

  if (!visible) return null;

  const handleCopyLink = async () => {
    const webLink = `https://saecula.app/bible/${encodeURIComponent(verse.entity_id)}`;
    await Clipboard.setStringAsync(webLink);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleShareImage = async () => {
    if (!cardRef.current || Platform.OS === 'web') return;
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Share.share({
        url: uri,
        message: `"${verse.text}" — ${reference}\n\n${t('bookmarks.shareVia')}`,
      });
    } catch {
      await Share.share({
        message: `"${verse.text}" — ${reference}`,
      });
    }
  };

  const handleShareText = async () => {
    await Share.share({
      message: `"${verse.text}" — ${reference}`,
    });
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
          <Text
            color={c.text}
            fontFamily={serif}
            fontSize={18}
            lineHeight={28}
            text="center"
            fontStyle="italic"
          >
            &ldquo;{verse.text}&rdquo;
          </Text>
          <Text color={c.accent} fontFamily={serif} fontSize={15} fontWeight="600">
            — {reference}
          </Text>
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
            label={t('bookmarks.shareText')}
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
