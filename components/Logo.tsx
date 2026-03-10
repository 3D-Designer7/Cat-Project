'use client'

import React from 'react'
import Image from 'next/image'
import { useTheme } from './ThemeProvider'

interface LogoProps {
  className?: string
}

export const CatChatLogo = ({ className }: LogoProps) => {
  const { theme } = useTheme()

  // CatChatLogo2 for light mode, CatChatLogo1 for dark mode
  const logoSrc =
    theme === 'light'
      ? '/CatChatLogo2.png'
      : '/CatChatLogo1.png'

  return (
    <div className={`relative w-10 h-10 ${className ?? ''}`}>
      <Image
        src={logoSrc}
        alt="CatChat Logo"
        fill
        priority
        sizes="40px"
        className="object-contain"
      />
    </div>
  )
}

export const CatChatLogoCompact = ({ className }: LogoProps) => {
  const { theme } = useTheme()

  const logoSrc =
    theme === 'light'
      ? '/CatChatLogo2.png'
      : '/CatChatLogo1.png'

  return (
    <div className={`relative w-8 h-8 ${className ?? ''}`}>
      <Image
        src={logoSrc}
        alt="CatChat Logo"
        fill
        priority
        sizes="32px"
        className="object-contain"
      />
    </div>
  )
}