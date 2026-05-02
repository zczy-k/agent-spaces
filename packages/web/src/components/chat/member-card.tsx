'use client';

import { User } from 'lucide-react';

interface MemberCardProps {
  name: string;
  description?: string;
  onClick?: () => void;
}

export function MemberCard({ name, description, onClick }: MemberCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-left transition-colors"
    >
      <div className="flex items-center justify-center size-7 rounded-full bg-muted text-xs font-medium">
        {name[0]?.toUpperCase() || <User className="size-3.5 text-muted-foreground" />}
      </div>
      <span className="min-w-0">
        <span className="block text-sm truncate">{name}</span>
        {description && <span className="block text-xs text-muted-foreground truncate">{description}</span>}
      </span>
    </button>
  );
}
