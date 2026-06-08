'use client';

import type { WorkflowUiProject } from '@agent-spaces/sdk';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pencil, Copy, Trash2, MoreVertical, Puzzle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { nativeNavigate } from '@/lib/navigate';
import { useRouter } from 'next/navigation';

interface WorkflowsUiCardProps {
  project: WorkflowUiProject;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export function WorkflowsUiCard({ project, onDelete, onDuplicate }: WorkflowsUiCardProps) {
  const router = useRouter();

  const pluginCount = project.enabledPlugins?.length ?? 0;

  return (
    <Card
      className="group overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative"
      onClick={() => nativeNavigate(router, `/workflows-ui/${project.id}`)}
    >
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-7 w-7 cursor-pointer">
            <MoreVertical className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => nativeNavigate(router, `/workflows-ui/${project.id}`)}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
            </DropdownMenuItem>
            {onDuplicate && (
              <DropdownMenuItem onClick={() => onDuplicate(project.id)}>
                <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(project.id)}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-primary/10 text-xs font-bold flex items-center justify-center text-primary shrink-0">
            {(project.name || 'U').charAt(0).toUpperCase()}
          </span>
          <CardTitle className="text-sm truncate">{project.name}</CardTitle>
          <Badge variant={project.type === 'react' ? 'default' : 'secondary'} className="text-[10px] ml-auto shrink-0">
            {project.type === 'react' ? 'React' : 'HTML'}
          </Badge>
        </div>
        {project.description && (
          <CardDescription className="text-xs line-clamp-2">{project.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 flex-wrap">
          {project.tags && project.tags.length > 0 && (
            <div className="flex gap-1">
              {project.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
              ))}
              {project.tags.length > 2 && (
                <span className="text-[10px] text-muted-foreground">+{project.tags.length - 2}</span>
              )}
            </div>
          )}
          {pluginCount > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Puzzle className="h-3 w-3" /> {pluginCount}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
