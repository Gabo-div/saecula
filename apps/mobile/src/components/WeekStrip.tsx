import { Text, View, XStack, YStack } from 'tamagui';

import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';

const LOCALES: Record<string, string> = { en: 'en-US', es: 'es-ES', la: 'es-ES' };

export function localISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Monday of the given local date's week (weeks start Monday, matching the app's
// liturgical week and the reference layout).
export function mondayOf(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - offset);
  return copy;
}

// The current week, Monday → Sunday: a done day is a filled accent circle,
// today gets a ring, future days are muted.
export function WeekStrip({ done }: { done: Set<string> }) {
  const c = useAppTheme();
  const language = useLanguageStore((s) => s.language);
  const locale = LOCALES[language] ?? 'en-US';

  const today = new Date();
  const todayISO = localISO(today);
  const monday = mondayOf(today);

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = localISO(d);
    let label = ['L', 'M', 'X', 'J', 'V', 'S', 'D'][i];
    try {
      label = d.toLocaleDateString(locale, { weekday: 'narrow' }).toUpperCase();
    } catch {
      // keep fallback
    }
    return {
      iso,
      label,
      dayNum: d.getDate(),
      done: done.has(iso),
      isToday: iso === todayISO,
      future: iso > todayISO,
    };
  });

  return (
    <XStack justify="space-between" width="100%">
      {week.map((d) => (
        <YStack key={d.iso} items="center" gap="$2" flex={1}>
          <Text color={c.muted} fontSize={11} fontWeight="700">
            {d.label}
          </Text>
          <View
            width={34}
            height={34}
            rounded={17}
            items="center"
            justify="center"
            bg={d.done ? c.accent : 'transparent'}
            borderWidth={d.isToday && !d.done ? 2 : 0}
            borderColor={c.accent}
          >
            <Text
              color={d.done ? c.bg : d.future ? c.muted : c.text}
              fontSize={14}
              fontWeight={d.done || d.isToday ? '700' : '400'}
            >
              {d.dayNum}
            </Text>
          </View>
        </YStack>
      ))}
    </XStack>
  );
}
