'use client';

import { useState, useMemo, useCallback } from 'react';
import { getNodeDefinitionsByCategory, searchNodeDefinitions } from '@/lib/workflow-nodes';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Search, ChevronDown } from 'lucide-react';

export const WORKFLOW_NODE_DRAG_MIME = 'application/vueflow';

function stringToHsl(str: string, s: number, l: number): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = hash % 360;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// Simple icon renderer
function NodeIcon({ name, className }: { name?: string; className?: string }) {
  const ICONS: Record<string, string> = {
    LogIn: '▶', LogOut: '⏹', Terminal: '⌨', Bell: '🔔', GitBranch: '⎇',
    Combine: '⊞', RotateCw: '↻', Container: '☐', Bot: '🤖', MessageSquare: '💬',
    TextCursorInput: '📝', ClipboardList: '📋', StickyNote: '📌', Circle: '○',
  };
  return <span className={className}>{ICONS[name || 'Circle'] || '○'}</span>;
}

export function WorkflowNodeSidebar({ onOpenPluginPicker }: { onOpenPluginPicker?: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => {
    if (searchQuery.trim()) {
      const results = searchNodeDefinitions(searchQuery);
      const grouped: Record<string, typeof results> = {};
      for (const def of results) {
        if (def.manualCreate === false) continue;
        if (!grouped[def.category]) grouped[def.category] = [];
        grouped[def.category].push(def);
      }
      return grouped;
    }
    return getNodeDefinitionsByCategory();
  }, [searchQuery]);

  const toggleCategory = useCallback((cat: string) => {
    setOpenCategories(prev => ({ ...prev, [cat]: prev[cat] === undefined ? false : !prev[cat] }));
  }, []);

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData(WORKFLOW_NODE_DRAG_MIME, nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  return (
    <div className="border-r border-border bg-background flex flex-col h-full w-full shrink-0">
      <div className="p-2 border-b border-border">
        <div className="relative flex items-center gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索节点..."
              className="pl-7 h-7 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-1">
            {Object.entries(categories).map(([category, nodes]) => (
              <Collapsible
                key={category}
                open={openCategories[category] !== false}
                onOpenChange={() => toggleCategory(category)}
              >
                <CollapsibleTrigger className="flex items-center w-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded hover:bg-muted/50">
                  <span className="truncate">{category}</span>
                  <span className="ml-auto text-[10px]">{nodes.length}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-0.5 mt-0.5">
                    {nodes.map((node) => (
                      <HoverCard key={node.type} openDelay={400} closeDelay={100}>
                        <HoverCardTrigger>
                          <div
                            draggable
                            className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-grab hover:bg-muted/50 active:cursor-grabbing"
                            onDragStart={(e) => onDragStart(e, node.type)}
                          >
                            <NodeIcon name={node.icon} className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <div className="truncate">{node.label}</div>
                              {node.description && (
                                <div className="text-[10px] text-muted-foreground truncate">{node.description}</div>
                              )}
                            </div>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-72 p-3" side="right">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <NodeIcon name={node.icon} className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-sm font-semibold">{node.label}</span>
                              <span className="text-[10px] text-muted-foreground font-mono ml-auto">{node.type}</span>
                            </div>
                            {node.description && (
                              <p className="text-xs text-muted-foreground">{node.description}</p>
                            )}
                            {node.properties?.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">参数</div>
                                {node.properties.map(prop => (
                                  <div key={prop.key} className="flex items-center gap-1.5 text-xs">
                                    <span className="font-mono text-muted-foreground">{prop.key}</span>
                                    <span
                                      className="text-[10px] px-1 rounded font-medium"
                                      style={{ backgroundColor: stringToHsl(prop.type, 45, 90), color: stringToHsl(prop.type, 55, 35) }}
                                    >{prop.type}</span>
                                    {prop.required && <span className="text-[10px] text-destructive">*</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {node.outputs && node.outputs.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">输出</div>
                                <div className="flex flex-wrap gap-1">
                                  {node.outputs!.map(output => (
                                    <span
                                      key={output.key}
                                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                                      style={{ backgroundColor: stringToHsl(output.key, 45, 90), color: stringToHsl(output.key, 55, 35) }}
                                    >
                                      {output.key}{output.type !== 'any' && <span className="opacity-60">: {output.type}</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
