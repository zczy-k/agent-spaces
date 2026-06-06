'use client';

import type { NodeProperty } from '@agent-spaces/shared';
import { Braces, ChevronRight, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTriggerAsChild } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getPropertyValue } from './workflow-properties-utils';
import { PropertyField } from './workflow-properties-fields';
import type { WorkflowVariableContext } from './workflow-variable-picker';

interface PropertiesListProps {
  properties: NodeProperty[];
  data: Record<string, unknown>;
  collapsedKeys: Set<string>;
  onCollapsedChange: (keys: Set<string>) => void;
  variableContext: WorkflowVariableContext | undefined;
  isVariableModeActive: (key: string, value: unknown) => boolean;
  onToggleVariableMode: (key: string, value: unknown) => void;
  toVariableInputValue: (value: unknown) => string | number;
  onInsertVariable: (key: string, path: string) => void;
  onDataChange: (key: string, value: unknown) => void;
}

export function PropertiesList({
  properties,
  data,
  collapsedKeys,
  onCollapsedChange,
  variableContext,
  isVariableModeActive,
  onToggleVariableMode,
  toVariableInputValue,
  onInsertVariable,
  onDataChange,
}: PropertiesListProps) {
  return (
    <section className="space-y-3">
      {properties.map(prop => (
        <Collapsible
          key={prop.key}
          open={!collapsedKeys.has(prop.key)}
          onOpenChange={(open) => {
            const next = new Set(collapsedKeys);
            if (open) next.delete(prop.key);
            else next.add(prop.key);
            onCollapsedChange(next);
          }}
          className="space-y-1"
        >
          <div className="flex items-center gap-1 text-xs font-medium">
            <CollapsibleTriggerAsChild>
              <button
                type="button"
                className="flex flex-1 items-center gap-1 rounded px-0.5 text-left transition-colors hover:bg-accent/50"
              >
                <ChevronRight
                  className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${!collapsedKeys.has(prop.key) ? 'rotate-90' : ''}`}
                />
                <span className="flex min-w-0 items-center gap-1">
                  <span className="truncate">{prop.label}</span>
                  {prop.required && <span className="text-destructive">*</span>}
                  {prop.tooltip && (
                    <TooltipProvider delay={300}>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 cursor-help text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[240px]">
                          <p>{prop.tooltip}</p>
                          <p className="mt-0.5 text-[10px] opacity-60">类型: {prop.type}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </span>
              </button>
            </CollapsibleTriggerAsChild>
            <button
              type="button"
              className={`rounded p-0.5 transition-colors hover:bg-accent ${isVariableModeActive(prop.key, getPropertyValue(prop, data)) ? 'text-primary' : 'text-muted-foreground'}`}
              title="切换变量模式"
              onClick={() => onToggleVariableMode(prop.key, getPropertyValue(prop, data))}
            >
              <Braces className="h-3.5 w-3.5" />
            </button>
          </div>
          <CollapsibleContent>
            <PropertyField
              prop={prop}
              value={getPropertyValue(prop, data)}
              onChange={(value) => onDataChange(prop.key, value)}
              variableContext={variableContext}
              variableMode={isVariableModeActive(prop.key, getPropertyValue(prop, data))}
              variableValue={toVariableInputValue(getPropertyValue(prop, data))}
              onInsertVariable={(path) => onInsertVariable(prop.key, path)}
            />
          </CollapsibleContent>
        </Collapsible>
      ))}
    </section>
  );
}
