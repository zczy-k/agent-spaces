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
    >
      <Terminal size={18} />
    </FloatingBall>
  );
}
