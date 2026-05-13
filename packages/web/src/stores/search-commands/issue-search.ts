import { CircleDot, AlertCircle } from 'lucide-react';
import type { SearchCommandProvider } from './types';
import { useIssueStore } from '../issue';

export const issueSearch: SearchCommandProvider = {
  prefix: 'issue',
  aliases: ['i', 'bug'],
  label: 'Issue',
  icon: CircleDot,
  search: (keyword) => {
    const { issues, setActiveIssue } = useIssueStore.getState();
    const lower = keyword.toLowerCase();
    return issues
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
  },
};
