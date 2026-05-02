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
  IconCode,
  IconHistory,
  IconPaperclip,
  IconPlug,
  IconPlus,
  IconPuzzle,
  IconTools,
  IconWand,
  IconWorld,
} from "@tabler/icons-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { Editor, JSONContent } from "@tiptap/core";
import type { Range } from "@tiptap/core";
import { useDropzone } from "react-dropzone";

import { ComposerShell } from "@/components/composer/composer-shell";
import { createSuggestionRenderer } from "@/components/composer/create-suggestion-renderer";
import { createSlashExtension } from "@/components/composer/create-slash-extension";
import type { AgentConfig } from "@agent-spaces/shared";

type MentionedAgent = Pick<AgentConfig, "id" | "name" | "role" | "description" | "enabled" | "mcps" | "skills" | "modelProvider" | "modelId" | "workingDir" | "sandboxDirs">;

interface ChatInputProps {
  channelName: string;
  agents: MentionedAgent[];
  onSend: (message: string, mentions: string[]) => void;
  isProcessing?: boolean;
  onStop?: () => void;
}

export interface ChatInputHandle {
  setContent: (html: string) => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput({ channelName, agents, onSend, isProcessing = false, onStop }, ref) {
  const [mentionedAgentIds, setMentionedAgentIds] = useState<string[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const isProcessingRef = useRef(isProcessing);
  const onSendRef = useRef(onSend);
  const editorRef = useRef<Editor | null>(null);

  const mentionedAgents = useMemo(() => {
    if (mentionedAgentIds.length === 0) return [];
    const byId = new Map(agents.map((agent) => [agent.id, agent]));
    return mentionedAgentIds
      .map((id) => byId.get(id))
      .filter((agent): agent is MentionedAgent => Boolean(agent));
  }, [agents, mentionedAgentIds]);

  const activeAgent = mentionedAgents[0];
  const activeMcps = activeAgent?.mcps ?? [];
  const activeSkills = activeAgent?.skills ?? [];
  const activeTools = useMemo(() => getAgentTools(activeAgent), [activeAgent]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  const submitCurrentMessage = useCallback(() => {
    const currentEditor = editorRef.current;
    if (!currentEditor || isProcessingRef.current) return;
    const text = currentEditor.getText().trim();
    if (!text) return;
    const mentions = collectMentionIds(currentEditor.getJSON());
    onSendRef.current(currentEditor.getHTML(), mentions);
    currentEditor.commands.clearContent();
    setMentionedAgentIds([]);
  }, []);

  const { getRootProps, getInputProps, open: openFilePicker } = useDropzone({
    noClick: true,
    noKeyboard: true,
    multiple: true,
    onDrop: () => {},
  });

  const mentionExtension = useMemo(
    () =>
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        suggestion: {
          char: "@",
          items: ({ query }: { query: string }) => {
            const keyword = query.toLowerCase();
            return agents.filter((agent) =>
              agent.enabled !== false &&
              `${agent.name} ${agent.role} ${agent.description || ""}`.toLowerCase().includes(keyword)
            )
              .slice(0, 6)
              .map((agent) => ({
                id: agent.id,
                label: agent.name || agent.role,
                description: `${agent.role}${agent.description ? ` · ${agent.description}` : ""}`,
              }));
          },
          command: ({
            editor,
            range,
            props,
          }: {
            editor: Editor;
            range: Range;
            props: MentionNodeAttrs;
          }) => {
            editor
              .chain()
              .focus()
              .insertContentAt(range, [{ type: "mention", attrs: props }])
              .run();
          },
          render: () => createSuggestionRenderer(),
        },
      }),
    [agents]
  );

  const slashExtension = useMemo(
    () => createSlashExtension(() => {
      document.querySelector<HTMLInputElement>("[data-chat-file-input]")?.click();
    }),
    []
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: `Message #${channelName}...  支持 @mention，输入 / 打开命令`,
        }),
        mentionExtension,
        slashExtension,
      ],
      editorProps: {
        attributes: {
          class: "tiptap tiptap-chat",
        },
        handleKeyDown: (_view, event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            const hasPopup = document.querySelector('.suggestion-menu');
            if (hasPopup) return false;
            event.preventDefault();
            submitCurrentMessage();
            return true;
          }
          return false;
        },
      },
      content: "",
      onUpdate: ({ editor }) => {
        setMentionedAgentIds(collectMentionIds(editor.getJSON()));
      },
      onCreate: ({ editor }) => {
        setMentionedAgentIds(collectMentionIds(editor.getJSON()));
      },
    },
    [mentionExtension, slashExtension, channelName, submitCurrentMessage],
  );

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useImperativeHandle(ref, () => ({
    setContent: (html: string) => {
      editor?.commands.setContent(html);
      editor?.commands.focus('end');
    },
  }), [editor]);

  const handleSubmit = useCallback(() => {
    submitCurrentMessage();
  }, [submitCurrentMessage]);

  const canSubmit = useEditorState({
    editor,
    selector: (ctx) => !!ctx.editor?.getText().trim(),
  });

  const agentConfig = activeAgent ? (
    <div className="rounded-lg border border-border/70 bg-muted/35 px-2.5 py-2 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">
            {activeAgent.name || activeAgent.role}
          </div>
          <div className="truncate text-muted-foreground">
            {activeAgent.description || activeAgent.role}
          </div>
        </div>
        {mentionedAgents.length > 1 ? (
          <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
            +{mentionedAgents.length - 1}
          </span>
        ) : null}
      </div>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
        <AgentConfigRow icon={<IconPlug size={14} />} label="MCP" values={activeMcps} empty="None" />
        <AgentConfigRow icon={<IconPuzzle size={14} />} label="Skill" values={activeSkills} empty="None" />
        <AgentConfigRow icon={<IconTools size={14} />} label="Tools" values={activeTools} empty="Default" />
      </div>
    </div>
  ) : null;

  const chatActions = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full border border-border hover:bg-accent" />}><IconPlus className="size-3" /></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5">
          <DropdownMenuGroup className="space-y-1">
            <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs" onClick={openFilePicker}>
              <IconPaperclip size={16} className="opacity-60" />
              Attach Files
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs" onClick={() => {}}>
              <IconCode size={16} className="opacity-60" />
              Code Interpreter
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs" onClick={() => {}}>
              <IconWorld size={16} className="opacity-60" />
              Web Search
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs" onClick={() => {}}>
              <IconHistory size={16} className="opacity-60" />
              Chat History
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setAutoMode(!autoMode)}
        className={cn("h-7 px-2 rounded-full border border-border hover:bg-accent", {
          "bg-primary/10 text-primary border-primary/30": autoMode,
          "text-muted-foreground": !autoMode,
        })}
      >
        <IconWand className="size-3" />
        <span className="text-xs">Auto</span>
      </Button>
    </>
  );

  return (
    <div className="border-t px-4 py-2">
      <ComposerShell
        editor={editor}
        canSubmit={canSubmit}
        onSubmit={handleSubmit}
        onStop={onStop}
        isProcessing={isProcessing}
        actions={chatActions}
        agentConfig={agentConfig}
        dropzoneProps={getRootProps()}
        hiddenInput={<input {...getInputProps()} data-chat-file-input="" />}
      />

      <div className="flex items-center gap-0 pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-6 px-2 rounded-full border border-transparent hover:bg-accent text-muted-foreground text-xs" />}><IconPlug className="size-3" /><span>MCP{activeMcps.length ? ` ${activeMcps.length}` : ""}</span><IconChevronDown className="size-3" /></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5 bg-popover border-border">
            <DropdownMenuGroup className="space-y-1">
              {activeMcps.length ? activeMcps.map((mcp) => (
                <DropdownMenuItem key={mcp} className="rounded-[calc(1rem-6px)] text-xs">
                  <IconPlug size={16} className="opacity-60" />{mcp}
                </DropdownMenuItem>
              )) : (
                <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs text-muted-foreground">
                  <IconPlug size={16} className="opacity-60" />No MCP configured
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-6 px-2 rounded-full border border-transparent hover:bg-accent text-muted-foreground text-xs" />}><IconPuzzle className="size-3" /><span>Skill{activeSkills.length ? ` ${activeSkills.length}` : ""}</span><IconChevronDown className="size-3" /></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5 bg-popover border-border">
            <DropdownMenuGroup className="space-y-1">
              {activeSkills.length ? activeSkills.map((skill) => (
                <DropdownMenuItem key={skill} className="rounded-[calc(1rem-6px)] text-xs">
                  <IconPuzzle size={16} className="opacity-60" />{skill}
                </DropdownMenuItem>
              )) : (
                <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs text-muted-foreground">
                  <IconPuzzle size={16} className="opacity-60" />No skills configured
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-6 px-2 rounded-full border border-transparent hover:bg-accent text-muted-foreground text-xs" />}><IconTools className="size-3" /><span>Tools{activeTools.length ? ` ${activeTools.length}` : ""}</span><IconChevronDown className="size-3" /></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5 bg-popover border-border">
            <DropdownMenuGroup className="space-y-1">
              {activeTools.length ? activeTools.map((tool) => (
                <DropdownMenuItem key={tool} className="rounded-[calc(1rem-6px)] text-xs">
                  <IconTools size={16} className="opacity-60" />{tool}
                </DropdownMenuItem>
              )) : (
                <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs text-muted-foreground">
                  <IconTools size={16} className="opacity-60" />Default tools
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />
      </div>
    </div>
  );
});

function AgentConfigRow({ icon, label, values, empty }: { icon: ReactNode; label: string; values: string[]; empty: string }) {
  return (
    <div className="min-w-0 rounded-md bg-background/70 px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 truncate text-foreground">
        {values.length ? values.join(", ") : empty}
      </div>
    </div>
  );
}

function getAgentTools(agent?: MentionedAgent): string[] {
  if (!agent) return [];
  return [
    agent.modelId ? `Model: ${agent.modelId}` : null,
    agent.modelProvider ? `Provider: ${agent.modelProvider}` : null,
    agent.workingDir ? `Dir: ${agent.workingDir}` : null,
    agent.sandboxDirs?.length ? `Sandbox: ${agent.sandboxDirs.length}` : null,
  ].filter((value): value is string => Boolean(value));
}

function collectMentionIds(node: JSONContent): string[] {
  const ids = new Set<string>();
  const walk = (current: JSONContent) => {
    if (!current) return;
    if (current.type === "mention" && typeof current.attrs?.id === "string") {
      ids.add(current.attrs.id);
    }
    if (Array.isArray(current.content)) {
      for (const child of current.content) walk(child);
    }
  };
  walk(node);
  return [...ids];
}
