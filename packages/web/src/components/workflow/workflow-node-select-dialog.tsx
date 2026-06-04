'use client';

import { useMemo, useState } from 'react';
import type { NodeTypeDefinition, Workflow } from '@agent-spaces/shared';
import { getNodeDefinitionsByCategory, searchNodeDefinitions } from '@/lib/workflow-nodes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';

type WorkflowNodeSelectDialogProps = {
  open: boolean;
  workflow: Workflow;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: string) => void;
};

function canCreateNode(workflow: Workflow, definition: NodeTypeDefinition): boolean {
  if (definition.manualCreate === false) return false;
  if (!definition.singleton) return true;
  return !workflow.nodes.some(node => node.type === definition.type);
}

function getCreatableNodes(workflow: Workflow, nodes: NodeTypeDefinition[]): NodeTypeDefinition[] {
  return nodes.filter(node => node.manualCreate !== false && canCreateNode(workflow, node));
}

function NodeIcon({ name, className }: { name?: string; className?: string }) {
  const icons: Record<string, string> = {
    LogIn: '>',
    LogOut: '<',
    Terminal: '$',
    Bell: '!',
    GitBranch: '?',
    Combine: '+',
    RotateCw: '*',
    Container: '[]',
    Bot: 'AI',
    MessageSquare: '"',
    TextCursorInput: 'T',
    ClipboardList: '#',
    StickyNote: 'N',
    Circle: 'o',
  };
  return <span className={className}>{icons[name || 'Circle'] || 'o'}</span>;
}

export function WorkflowNodeSelectDialog({
  open,
  workflow,
  onOpenChange,
  onSelect,
}: WorkflowNodeSelectDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => Object.keys(getNodeDefinitionsByCategory()), [open]);

  const filteredNodes = useMemo(() => {
    const query = searchQuery.trim();
    if (query) {
      return getCreatableNodes(workflow, searchNodeDefinitions(query));
    }

    const grouped = getNodeDefinitionsByCategory();
    if (selectedCategory) {
      return getCreatableNodes(workflow, grouped[selectedCategory] || []);
    }

    return getCreatableNodes(workflow, Object.values(grouped).flat());
  }, [open, workflow, searchQuery, selectedCategory]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearchQuery('');
      setSelectedCategory(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSelect = (type: string) => {
    onSelect(type);
    setSearchQuery('');
    setSelectedCategory(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[640px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle className="text-sm">选择节点</DialogTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索节点..."
              className="h-7 pl-8 text-xs"
            />
          </div>
        </DialogHeader>

        <div className="flex h-[380px] border-t border-border">
          <div className="w-36 shrink-0 border-r border-border bg-muted/30">
            <ScrollArea className="h-full">
              <div className="space-y-0.5 p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`h-7 w-full justify-start px-2.5 text-xs ${selectedCategory === null ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                  onClick={() => setSelectedCategory(null)}
                >
                  全部节点
                </Button>
                {categories.map(category => (
                  <Button
                    key={category}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`h-7 w-full justify-start truncate px-2.5 text-xs ${selectedCategory === category ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    <span className="truncate">{category}</span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="min-w-0 flex-1">
            <ScrollArea className="h-full">
              {filteredNodes.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 p-3">
                  {filteredNodes.map(node => (
                    <Button
                      key={node.type}
                      type="button"
                      variant="outline"
                      className="group h-auto min-h-24 flex-col gap-1.5 p-3 text-center hover:border-primary/50 hover:bg-primary/5"
                      onClick={() => handleSelect(node.type)}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <NodeIcon name={node.icon} className="text-xs font-medium" />
                      </span>
                      <span className="line-clamp-2 w-full text-[11px] leading-tight">{node.label}</span>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                  暂无匹配节点
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
