'use client'

import { useTranslations } from 'next-intl'
import RotatingText from './rotating-text'

export default function LoginHero() {
  const t = useTranslations('login')

  const keywords = [t('keyword.plan'), t('keyword.think'), t('keyword.build'), t('keyword.debug'), t('keyword.ship')]

  return (
    <div className="relative z-20 flex h-full flex-col items-center justify-center px-8">
      <div className="flex items-center gap-2 text-3xl font-bold sm:text-5xl">
        <span className="bg-gradient-to-r from-neutral-600 to-neutral-400 bg-clip-text text-transparent dark:from-neutral-300 dark:to-neutral-500">
          {t('heroPrefix')}
        </span>
        <RotatingText
          texts={keywords}
          mainClassName="text-primary"
          staggerFrom="last"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-120%', opacity: 0 }}
          staggerDuration={0.025}
          splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1"
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          rotationInterval={2000}
          splitBy="characters"
          auto
          loop
        />
      </div>
    </div>
  )
}
