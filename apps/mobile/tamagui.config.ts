import { defaultConfig } from '@tamagui/config/v5';
import { animations } from '@tamagui/config/v5-rn';
import { createTamagui } from 'tamagui';

// RN Animated driver (no reanimated); enables the Sheet's snap/animate helpers.
export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  animations,
  settings: {
    ...defaultConfig.settings,
  },
});

export type AppConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  // Makes every tamagui import (themes, tokens, shorthands) fully typed.
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;
