import type { LucideIcon } from 'lucide-react';

export interface SearchResult {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  action: () => void;
}

export interface SearchCommandProvider {
  prefix: string;
  aliases: string[];
  label: string;
  icon: LucideIcon;
  search: (keyword: string) => SearchResult[] | Promise<SearchResult[]>;
}
