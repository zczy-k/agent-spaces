import { CircleDot, AlertCircle, Plus } from 'lucide-react';
import type { SearchCommandProvider } from './types';
import { useIssueStore } from '../issue';

export const issueSearch: SearchCommandProvider = {
  prefix: 'issue',
  aliases: ['i', 'bug'],
  label: 'Issue',
  icon: CircleDot,
  search: (keyword) => {
    const { issues, setActiveIssue, setCreateDialogOpen } = useIssueStore.getState();
    const lower = keyword.toLowerCase();

    const createItem = {
      id: '__create_issue__',
      label: '新建议题',
      icon: Plus,
      action: () => setTimeout(() => setCreateDialogOpen(true), 300),
    };

    const filtered = issues
      .filter((issue) =>
        issue.title.toLowerCase().includes(lower) ||
        issue.description?.toLowerCase().includes(lower),
      )
      .map((issue) => ({
        id: issue.id,
        label: issue.title,
        description: issue.status,
        icon: AlertCircle,
        action: () => setActiveIssue(issue.id),
      }));

    return [createItem, ...filtered];
  },
};
