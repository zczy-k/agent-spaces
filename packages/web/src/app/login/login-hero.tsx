'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import RotatingText from './rotating-text'

export default function LoginHero() {
  const t = useTranslations('login')

  const keywords = [t('keyword.plan'), t('keyword.think'), t('keyword.build'), t('keyword.debug'), t('keyword.ship')]

  return (
    <div className="relative z-20 flex h-full flex-col items-center justify-center px-8">
      <motion.div
        className="flex items-center gap-2 text-3xl font-bold sm:text-5xl"
        layout
        transition={{ type: 'spring', damping: 18, stiffness: 120 }}
      >
        <motion.span
          className="inline-block bg-gradient-to-r from-neutral-600 to-neutral-400 bg-clip-text text-transparent dark:from-neutral-300 dark:to-neutral-500"
          layout
          transition={{ type: 'spring', damping: 18, stiffness: 120 }}
        >
          {t('heroPrefix')}
        </motion.span>
        <RotatingText
          texts={keywords}
          mainClassName="text-primary"
          animatePresenceMode="popLayout"
          staggerFrom="last"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-120%', opacity: 0 }}
          staggerDuration={0.04}
          splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1"
          transition={{ type: 'spring', damping: 20, stiffness: 150 }}
          rotationInterval={3000}
          splitBy="characters"
          auto
          loop
        />
      </motion.div>
    </div>
  )
}
