'use client'

import { TamaguiProvider } from 'tamagui'
import { tamaguiConfig } from '../../tamagui.config'

export default function TamaguiProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      {children}
    </TamaguiProvider>
  )
}
