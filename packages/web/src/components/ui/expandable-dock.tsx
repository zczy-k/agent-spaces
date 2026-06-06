'use client';

import React, {
  useState,
  ReactNode,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface ExpandableDockProps {
  headerContent: ReactNode;
  children: ReactNode;
  className?: string;
}

const ExpandableDock = ({
  headerContent,
  children,
  className,
}: ExpandableDockProps) => {
  const [animationStage, setAnimationStage] = useState<
    | 'collapsed'
    | 'widthExpanding'
    | 'heightExpanding'
    | 'fullyExpanded'
    | 'contentFadingOut'
    | 'heightCollapsing'
    | 'widthCollapsing'
  >('collapsed');

  const containerRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const handleExpand = useCallback(() => {
    clearTimers();
    setAnimationStage('widthExpanding');
    timersRef.current.push(
      setTimeout(() => setAnimationStage('heightExpanding'), 400),
      setTimeout(() => setAnimationStage('fullyExpanded'), 850),
    );
  }, [clearTimers]);

  const handleCollapse = useCallback(() => {
    clearTimers();
    setAnimationStage('contentFadingOut');
    timersRef.current.push(
      setTimeout(() => setAnimationStage('heightCollapsing'), 250),
      setTimeout(() => setAnimationStage('widthCollapsing'), 650),
      setTimeout(() => setAnimationStage('collapsed'), 1050),
    );
  }, [clearTimers]);

  // 热加载后重置到 collapsed
  useEffect(() => {
    setAnimationStage('collapsed');
    return clearTimers;
  }, [clearTimers]);

  const isCollapsed = animationStage === 'collapsed';
  const isExpanded = animationStage === 'fullyExpanded';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        isExpanded
      ) {
        handleCollapse();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded, handleCollapse]);

  return (
    <div className='fixed bottom-13 left-1/2 -translate-x-1/2 z-50 w-full px-4 sm:px-0 flex justify-center'>
      <motion.div
        ref={containerRef}
        animate={{
          width:
            animationStage === 'collapsed' ||
            animationStage === 'widthCollapsing'
              ? 'min(90vw, 360px)'
              : 'min(90vw, 720px)',
          height:
            animationStage === 'collapsed' ||
            animationStage === 'widthExpanding' ||
            animationStage === 'widthCollapsing'
              ? 68
              : 'min(80vh, 500px)',
          borderRadius: isCollapsed ? 999 : 20,
        }}
        transition={{
          width: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
          height: { duration: 0.45, ease: [0.25, 1, 0.5, 1] },
          borderRadius: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
        }}
        className={cn(
          'bg-white dark:bg-black backdrop-blur-md shadow-2xl overflow-hidden flex flex-col mx-auto border border-border',
          className,
        )}
      >
        <motion.div
          animate={{
            opacity: isExpanded ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
          className='flex-1 min-h-0 overflow-hidden'
          aria-hidden={!isExpanded}
        >
          <div className='h-full min-h-0 p-4 sm:p-6 flex flex-col overflow-auto'>
            {children}
          </div>
        </motion.div>
        <div
          onClick={isCollapsed ? handleExpand : handleCollapse}
          className={cn(
            'flex items-center gap-4 px-4 sm:px-6 py-4 text-white w-full h-17 whitespace-nowrap cursor-pointer shrink-0',
            isExpanded && 'border-t border-border',
          )}
        >
          {headerContent}
        </div>
      </motion.div>
    </div>
  );
};

export default ExpandableDock;
