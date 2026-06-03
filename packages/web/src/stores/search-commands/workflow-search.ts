import { GitBranch, Plus, Play, History } from 'lucide-react';
import type { SearchCommandProvider } from './types';
import { useWorkflowStore } from '../workflow';
import { toStaticHref } from '@/lib/navigate';

export const workflowSearch: SearchCommandProvider = {
  prefix: 'workflow',
  aliases: ['wf'],
  label: 'Workflow',
  icon: GitBranch,
  search: (keyword) => {
    const { workflows } = useWorkflowStore.getState();
    const lower = keyword.toLowerCase();

    const globalItems = [
      {
        id: '__create_workflow__',
        label: 'New Workflow',
        icon: Plus,
        action: () => { window.location.href = toStaticHref('/workflows'); },
      },
      {
        id: '__workflow_history__',
        label: 'View Execution History',
        icon: History,
        action: () => { window.location.href = toStaticHref('/'); },
      },
    ];

    const filtered = workflows
      .filter((wf) => wf.name.toLowerCase().includes(lower))
      .map((wf) => ({
        id: wf.id,
        label: wf.name,
        description: `${wf.nodes.length} nodes`,
        icon: GitBranch,
        action: () => { window.location.href = toStaticHref('/workflows'); },
      }));

    return [...globalItems, ...filtered];
  },
};
