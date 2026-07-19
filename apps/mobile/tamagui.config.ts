import { defaultConfig } from '@tamagui/config/v5';
import { createTamagui } from 'tamagui';

// Tamagui v2: root-level createTamagui options live inside `settings`.
export const tamaguiConfig = createTamagui({
  ...defaultConfig,
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
