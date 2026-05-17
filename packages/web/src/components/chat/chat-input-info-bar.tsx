"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  IconChevronDown,
  IconCircleCheck,
  IconCircleDashed,
  IconFileText,
  IconLoader2,
  IconMessageCirclePlus,
  IconPlug,
  IconPlus,
  IconPuzzle,
  IconTools,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import type { Icon } from "@tabler/icons-react";
import type { Channel, TodoItem } from "@agent-spaces/shared";

type DisplayTodoItem = TodoItem & { title?: string; content?: string };

function getTodoTitle(todo: DisplayTodoItem, fallback: string) {
  return todo.subject || todo.title || todo.activeForm || todo.content || fallback;
}

interface ToolEntry {
  name: string;
  label: string;
  icon: Icon;
}

interface ChatInputInfoBarProps {
  mcps: string[];
  skills: string[];
  tools: ToolEntry[];
  todos: Channel["todos"];
}

export function ChatInputInfoBar({ mcps, skills, tools, todos }: ChatInputInfoBarProps) {
  const t = useTranslations("chat");

  return (
    <div className="flex items-center gap-0 pt-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 rounded-full border border-transparent hover:bg-accent text-muted-foreground text-xs"
            />
          }
        >
          <IconPlug className="size-3" />
          <span>{t("input.mcp")}{mcps.length ? ` ${mcps.length}` : ""}</span>
          <IconChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5 bg-popover border-border">
          <DropdownMenuGroup className="space-y-1">
            {mcps.length ? (
              mcps.map((mcp) => (
                <DropdownMenuItem key={mcp} className="rounded-[calc(1rem-6px)] text-xs">
                  <IconPlug size={16} className="opacity-60" />
                  {mcp}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs text-muted-foreground">
                <IconPlug size={16} className="opacity-60" />
                {t("input.noMcp")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 rounded-full border border-transparent hover:bg-accent text-muted-foreground text-xs"
            />
          }
        >
          <IconPuzzle className="size-3" />
          <span>{t("input.skill")}{skills.length ? ` ${skills.length}` : ""}</span>
          <IconChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5 bg-popover border-border">
          <DropdownMenuGroup className="space-y-1">
            {skills.length ? (
              skills.map((skill) => (
                <DropdownMenuItem key={skill} className="rounded-[calc(1rem-6px)] text-xs">
                  <IconPuzzle size={16} className="opacity-60" />
                  {skill}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs text-muted-foreground">
                <IconPuzzle size={16} className="opacity-60" />
                {t("input.noSkills")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 rounded-full border border-transparent hover:bg-accent text-muted-foreground text-xs"
            />
          }
        >
          <IconTools className="size-3" />
          <span>{t("input.tools")}{tools.length ? ` ${tools.length}` : ""}</span>
          <IconChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5 bg-popover border-border">
          <DropdownMenuGroup className="space-y-1">
            {tools.length ? (
              tools.map(({ name, label, icon: Icon }) => (
                <DropdownMenuItem key={name} className="rounded-[calc(1rem-6px)] text-xs">
                  <Icon size={16} className="opacity-60" />
                  {label}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs text-muted-foreground">
                <IconTools size={16} className="opacity-60" />
                {t("input.noTools")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {todos && todos.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 rounded-full border border-transparent hover:bg-accent text-muted-foreground text-xs"
              />
            }
          >
            <IconCircleCheck className="size-3" />
            <span>{t("input.todos")} {todos.length}</span>
            <IconChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5 bg-popover border-border">
            <DropdownMenuGroup className="space-y-0.5">
              {todos.map((todo, index) => (
                <DropdownMenuItem
                  key={todo.id || `${getTodoTitle(todo, t("untitledTodo"))}-${index}`}
                  className="rounded-[calc(1rem-6px)] text-xs gap-2"
                  onSelect={(e) => e.preventDefault()}
                >
                  {todo.status === "completed" ? (
                    <IconCircleCheck size={14} className="text-green-500 shrink-0" />
                  ) : todo.status === "in_progress" ? (
                    <IconLoader2
                      size={14}
                      className="text-blue-500 shrink-0 animate-spin"
                      style={{ animationDuration: "3s" }}
                    />
                  ) : (
                    <IconCircleDashed size={14} className="text-muted-foreground shrink-0" />
                  )}
                  <span className={cn("truncate", todo.status === "completed" && "line-through text-muted-foreground")}>
                    {getTodoTitle(todo, t("untitledTodo"))}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="flex-1" />
    </div>
  );
}
