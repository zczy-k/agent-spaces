'use client';

import { useCommandPalette } from '@/stores/command-palette';
import { Terminal } from 'lucide-react';
import { FloatingBall } from './floating-ball';

export function ConsolePanel() {
  const toggle = useCommandPalette((s) => s.toggle);
  const open = useCommandPalette((s) => s.open);

  return (
    <FloatingBall
      lsKey="console-panel:pos"
      onClick={toggle}
      visible={!open}
      style={{ background: 'var(--primary)', color: 'var(--primary-foreground))', boxShadow: '0 4px 12px var(--primary) / 0.4' }}
    >
      <Terminal size={18} />
    </FloatingBall>
  );
}
