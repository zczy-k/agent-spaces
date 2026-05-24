"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useDropzone } from "react-dropzone";
import { useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { Editor, JSONContent, Range } from "@tiptap/core";
import { IconMicrophone, IconPaperclip, IconPlus, IconWand } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ComposerShell } from "@/components/composer/composer-shell";
import { createSuggestionRenderer } from "@/components/composer/create-suggestion-renderer";
import { createSlashExtension } from "@/components/composer/create-slash-extension";
import { createAgentResourceExtension } from "@/components/composer/create-agent-resource-extension";
import { createFileSearchExtension } from "@/components/composer/create-file-search-extension";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { BUILT_IN_AGENT_TOOLS, type Attachment as MessageAttachment } from "@agent-spaces/shared";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "./attachments";
import {
  buildContentWithMentions,
  collectMentionIds,
  getMcpLabels,
  getToolIcon,
  stripSimpleParagraphs,
  type MentionedAgent,
} from "./chat-input-utils";
import { localAttachmentToData, type LocalAttachment, uploadAttachment } from "./chat-input-attachments";

type AgentCommandItem = {
  name: string;
  content?: string;
  group?: string;
};

export interface ChatComposerInputState {
  mentionedAgentIds: string[];
  activeAgent?: MentionedAgent;
  activeMcps: string[];
  activeSkills: string[];
  activeTools: Array<{ name: string; label: string; icon: Icon }>;
}

export interface ChatComposerInputHandle {
  setContent: (html: string, agents?: MentionedAgent[]) => void;
  focus: () => void;
  setMentionAgent: (agent: MentionedAgent) => void;
}

interface ChatComposerInputProps {
  workspaceId: string;
  agents: MentionedAgent[];
  placeholder: string;
  onSubmit: (content: string, mentions: string[], attachments: MessageAttachment[]) => void | Promise<void>;
  className?: string;
  isProcessing?: boolean;
  onStop?: () => void;
  replyLabel?: string;
  onCancelReply?: () => void;
  draftKey?: string;
  draftContent?: string;
  onDraftSave?: (content: string) => void;
  onDraftClear?: () => void;
  initialMentionAgentId?: string;
  disableMentionSuggestions?: boolean;
  enableAttachments?: boolean;
  enableVoice?: boolean;
  enableAutoMode?: boolean;
  enableSlashCommands?: boolean;
  enableAgentResources?: boolean;
  onStateChange?: (state: ChatComposerInputState) => void;
}

export const ChatComposerInput = forwardRef<ChatComposerInputHandle, ChatComposerInputProps>(function ChatComposerInput(
  {
    workspaceId,
    agents,
    placeholder,
    onSubmit,
    className,
    isProcessing = false,
    onStop,
    replyLabel,
    onCancelReply,
    draftKey,
    draftContent,
    onDraftSave,
    onDraftClear,
    initialMentionAgentId,
    disableMentionSuggestions = false,
    enableAttachments = true,
    enableVoice = true,
    enableAutoMode = true,
    enableSlashCommands = true,
    enableAgentResources = true,
    onStateChange,
  },
  ref,
) {
  const t = useTranslations("chat");
  const { isRecording: isVoiceRecording, start: startVoice, stop: stopVoice } = useSpeechRecognition();
  const [mentionedAgentIds, setMentionedAgentIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const agentsRef = useRef(agents);
  const submittingRef = useRef(false);
  const isProcessingRef = useRef(isProcessing);
  const onSubmitRef = useRef(onSubmit);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredDraftKeyRef = useRef<string | null>(null);
  const activeSkillsRef = useRef<string[]>([]);
  const activeCommandsRef = useRef<AgentCommandItem[]>([]);
  const activeResourcesRef = useRef<{ mcps: string[]; tools: { name: string; label: string }[] }>({ mcps: [], tools: [] });

  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);

  const mentionedAgents = useMemo(() => {
    if (mentionedAgentIds.length === 0) return [];
    const byId = new Map(agents.map((agent) => [agent.id, agent]));
    return mentionedAgentIds
      .map((id) => byId.get(id))
      .filter((agent): agent is MentionedAgent => Boolean(agent));
  }, [agents, mentionedAgentIds]);

  const activeAgent = mentionedAgents[0];
  const activeMcps = useMemo(() => getMcpLabels(activeAgent?.mcps), [activeAgent?.mcps]);
  const activeSkills = useMemo(() => activeAgent?.skills ?? [], [activeAgent?.skills]);
  const activeTools = useMemo(() => {
    const enabledNames = new Set(activeAgent?.tools ?? []);
    return (BUILT_IN_AGENT_TOOLS ?? [])
      .filter((tool) => enabledNames.has(tool.name))
      .map((tool) => ({ ...tool, icon: getToolIcon(tool.name) }));
  }, [activeAgent?.tools]);

  useEffect(() => {
    onStateChange?.({ mentionedAgentIds, activeAgent, activeMcps, activeSkills, activeTools });
  }, [mentionedAgentIds, activeAgent, activeMcps, activeSkills, activeTools, onStateChange]);

  useEffect(() => {
    activeSkillsRef.current = activeSkills;
    activeResourcesRef.current = {
      mcps: activeMcps,
      tools: activeTools.map((tool) => ({ name: tool.name, label: tool.label })),
    };
  }, [activeMcps, activeSkills, activeTools]);

  useEffect(() => {
    if (!activeAgent?.id || !enableSlashCommands) {
      activeCommandsRef.current = [];
      return;
    }

    let cancelled = false;
    fetch(`/api/agent-commands/${activeAgent.id}`)
      .then((res) => res.ok ? res.json() : [])
      .then((items: AgentCommandItem[]) => {
        if (!cancelled) activeCommandsRef.current = items;
      })
      .catch(() => {
        if (!cancelled) activeCommandsRef.current = [];
      });
    return () => { cancelled = true; };
  }, [activeAgent?.id, enableSlashCommands]);

  const scheduleDraftSave = useCallback((content: string) => {
    if (!onDraftSave && !onDraftClear) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (content.trim()) {
        onDraftSave?.(content);
      } else {
        onDraftClear?.();
      }
    }, 1000);
  }, [onDraftSave, onDraftClear]);

  const removeExistingMentions = useCallback((editor: Editor, keepId?: string) => {
    const { tr } = editor.state;
    let removed = false;
    const nodesToRemove: { pos: number; nodeSize: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "mention" && node.attrs?.id !== keepId) {
        nodesToRemove.push({ pos, nodeSize: node.nodeSize });
      }
    });
    for (let index = nodesToRemove.length - 1; index >= 0; index -= 1) {
      const item = nodesToRemove[index];
      tr.delete(item.pos, item.pos + item.nodeSize);
      removed = true;
    }
    if (removed) editor.view.dispatch(tr);
  }, []);

  const mentionExtension = useMemo(
    () =>
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        suggestion: {
          char: "@",
          items: ({ query }: { query: string }) => {
            if (disableMentionSuggestions) return [];
            const keyword = query.toLowerCase();
            return agentsRef.current
              .filter((agent) =>
                agent.enabled !== false &&
                `${agent.name} ${agent.role} ${agent.description || ""}`.toLowerCase().includes(keyword)
              )
              .slice(0, 6)
              .map((agent) => ({
                id: agent.id,
                label: agent.name || agent.role,
                description: `${agent.role}${agent.description ? ` ${agent.description}` : ""}`,
              }));
          },
          command: ({ editor, range, props }: { editor: Editor; range: Range; props: MentionNodeAttrs }) => {
            removeExistingMentions(editor, props.id as string);
            editor.chain().focus().insertContentAt(range, [{ type: "mention", attrs: props }]).run();
          },
          render: () => createSuggestionRenderer(),
        },
      }),
    [disableMentionSuggestions, removeExistingMentions],
  );

  const slashExtension = useMemo(
    () =>
      createSlashExtension(
        () => activeSkillsRef.current,
        () => activeCommandsRef.current.map((command) => ({
          id: `${command.group || "root"}:${command.name}`,
          name: command.group ? `${command.group}/${command.name}` : command.name,
          content: command.content,
          insertText: command.name,
        })),
      ),
    [],
  );

  const fileSearchExtension = useMemo(() => createFileSearchExtension(workspaceId), [workspaceId]);
  const agentResourceExtension = useMemo(() => createAgentResourceExtension(() => activeResourcesRef.current), []);

  const submitCurrentMessage = useCallback(async () => {
    const currentEditor = editorRef.current;
    if (!currentEditor || isProcessingRef.current || submittingRef.current) return;
    const text = currentEditor.getText().trim();
    if (!text && attachments.length === 0) return;
    const mentions = collectMentionIds(currentEditor.getJSON());
    submittingRef.current = true;
    setSubmitting(true);
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    try {
      const uploaded = enableAttachments ? await Promise.all(attachments.map(uploadAttachment)) : [];
      await onSubmitRef.current(text ? stripSimpleParagraphs(currentEditor.getHTML()) : "", mentions, uploaded);
      currentEditor.commands.clearContent();
      setAttachments((prev) => {
        prev.forEach((item) => URL.revokeObjectURL(item.preview));
        return [];
      });
      // setMentionedAgentIds([]);
      onCancelReply?.();
      onDraftClear?.();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [attachments, enableAttachments, onCancelReply, onDraftClear]);

  const submitRef = useRef(submitCurrentMessage);
  submitRef.current = submitCurrentMessage;

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder }),
        mentionExtension,
        ...(enableSlashCommands ? [slashExtension] : []),
        ...(enableAgentResources ? [agentResourceExtension, fileSearchExtension] : []),
      ],
      editorProps: {
        attributes: { class: "tiptap tiptap-chat" },
        handleKeyDown: (_view, event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            const hasPopup = document.querySelector(".suggestion-menu");
            if (hasPopup) return false;
            event.preventDefault();
            submitRef.current();
            return true;
          }
          return false;
        },
        handlePaste: (_view, event) => {
          const html = event.clipboardData?.getData("text/html");
          if (html?.includes('data-type="mention"')) return false;
          const text = event.clipboardData?.getData("text/plain");
          if (!text || !/@\S+/.test(text)) return false;
          const allAgents = agentsRef.current;
          if (allAgents.length === 0) return false;
          const regex = /@(\S+)/g;
          let match: RegExpExecArray | null;
          let hasMatch = false;
          while ((match = regex.exec(text)) !== null) {
            if (allAgents.some((agent) => agent.name === match![1] || agent.id === match![1] || agent.role === match![1])) {
              hasMatch = true;
              break;
            }
          }
          if (!hasMatch) return false;
          const currentEditor = editorRef.current;
          if (!currentEditor) return false;
          currentEditor.commands.insertContent(buildContentWithMentions(text, allAgents));
          return true;
        },
      },
      content: "",
      onUpdate: ({ editor: currentEditor }) => {
        const ids = collectMentionIds(currentEditor.getJSON());
        setMentionedAgentIds((prev) => {
          if (prev.length === ids.length && prev.every((id, index) => id === ids[index])) return prev;
          return ids;
        });
        scheduleDraftSave(currentEditor.getHTML());
      },
    },
    [placeholder, mentionExtension, slashExtension, agentResourceExtension, fileSearchExtension, enableSlashCommands, enableAgentResources],
  );

  useEffect(() => { editorRef.current = editor; }, [editor]);

  const setMentionAgent = useCallback((agent: MentionedAgent) => {
    const currentEditor = editorRef.current ?? editor;
    if (!currentEditor) return;
    removeExistingMentions(currentEditor);
    const plainText = currentEditor.getText().trim();
    const content: JSONContent[] = [
      { type: "mention", attrs: { id: agent.id, label: agent.name || agent.role } },
      { type: "text", text: plainText ? ` ${plainText}` : " " },
    ];
    currentEditor.commands.setContent({ type: "doc", content: [{ type: "paragraph", content }] }, { emitUpdate: true });
    setMentionedAgentIds([agent.id]);
    scheduleDraftSave(currentEditor.getHTML());
    currentEditor.commands.focus("end");
  }, [editor, removeExistingMentions, scheduleDraftSave]);

  useEffect(() => {
    if (!editor || !draftKey || restoredDraftKeyRef.current === draftKey) return;
    restoredDraftKeyRef.current = draftKey;
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    const initialAgent = initialMentionAgentId ? agentsRef.current.find((agent) => agent.id === initialMentionAgentId) : undefined;
    const content = draftContent
      ? draftContent
      : initialAgent
        ? {
            type: "doc",
            content: [{
              type: "paragraph",
              content: [
                { type: "mention", attrs: { id: initialAgent.id, label: initialAgent.name || initialAgent.role } },
                { type: "text", text: " " },
              ],
            }],
          }
        : "";
    editor.commands.setContent(content, { emitUpdate: false });
    setMentionedAgentIds(collectMentionIds(editor.getJSON()));
  }, [editor, draftKey, draftContent, initialMentionAgentId, agents]);

  useEffect(() => {
    if (!editor || draftKey || !initialMentionAgentId) return;
    const initialAgent = agentsRef.current.find((agent) => agent.id === initialMentionAgentId);
    if (initialAgent) setMentionAgent(initialAgent);
  }, [editor, draftKey, initialMentionAgentId, setMentionAgent, agents]);

  useImperativeHandle(
    ref,
    () => ({
      setContent: (html: string, nextAgents?: MentionedAgent[]) => {
        if (!editor) return;
        if (html.includes('data-type="mention"')) {
          editor.commands.setContent(html, { emitUpdate: false });
        } else {
          const plainText = /<[a-z][\s\S]*>/i.test(html) ? html.replace(/<[^>]*>/g, "") : html;
          const allAgents = nextAgents ?? agentsRef.current;
          if (allAgents.length > 0 && /@\S+/.test(plainText)) {
            editor.commands.setContent(buildContentWithMentions(plainText, allAgents), { emitUpdate: false });
          } else {
            editor.commands.setContent(plainText, { emitUpdate: false });
          }
        }
        setMentionedAgentIds(collectMentionIds(editor.getJSON()));
        editor.commands.focus("end");
      },
      focus: () => { editor?.commands.focus("end"); },
      setMentionAgent,
    }),
    [editor, setMentionAgent],
  );

  const { getRootProps, getInputProps, open: openFilePicker } = useDropzone({
    noClick: true,
    noKeyboard: true,
    multiple: true,
    disabled: !enableAttachments,
    accept: {
      "image/*": [],
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/*": [".txt", ".md", ".csv", ".json"],
    },
    onDrop: (files) => {
      setAttachments((prev) => [
        ...prev,
        ...files.map((file) => ({ file, preview: URL.createObjectURL(file) })),
      ]);
    },
  });

  useEffect(() => {
    return () => { attachments.forEach((item) => URL.revokeObjectURL(item.preview)); };
  }, [attachments]);

  const toggleVoice = useCallback(() => {
    if (isVoiceRecording) {
      stopVoice();
      return;
    }
    startVoice((text, isFinal) => {
      const currentEditor = editorRef.current;
      if (currentEditor && isFinal) currentEditor.chain().focus().insertContent(text).run();
    });
  }, [isVoiceRecording, startVoice, stopVoice]);

  const hasText = useEditorState({
    editor,
    selector: (ctx) => !!ctx.editor?.getText().trim(),
  });
  const canSubmit = (Boolean(hasText) || attachments.length > 0) && !submitting;

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return next;
    });
  }, []);

  const actions = (
    <>
      {enableAttachments ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full border border-border hover:bg-accent" />
            }
          >
            <IconPlus className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5">
            <DropdownMenuGroup className="space-y-1">
              <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs" onClick={openFilePicker}>
                <IconPaperclip size={16} className="opacity-60" />
                {t("input.attachFiles")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {enableAutoMode ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAutoMode((current) => !current)}
          className={cn("h-7 px-2 rounded-full border border-border hover:bg-accent", {
            "bg-primary/10 text-primary border-primary/30": autoMode,
            "text-muted-foreground": !autoMode,
          })}
        >
          <IconWand className="size-3" />
          <span className="text-xs">{t("input.autoMode")}</span>
        </Button>
      ) : null}

      {enableVoice ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleVoice}
          className={cn("h-7 w-7 p-0 rounded-full border border-border hover:bg-accent", {
            "bg-red-500/10 text-red-500 border-red-500/30 animate-pulse": isVoiceRecording,
            "text-muted-foreground": !isVoiceRecording,
          })}
          title={isVoiceRecording ? t("input.voiceStop") : t("input.voiceStart")}
        >
          <IconMicrophone className="size-3" />
        </Button>
      ) : null}
    </>
  );

  return (
    <div className={className}>
      <ComposerShell
        workspaceId={workspaceId}
        editor={editor}
        canSubmit={canSubmit}
        onSubmit={() => { void submitCurrentMessage(); }}
        onStop={onStop}
        isProcessing={isProcessing || submitting}
        actions={actions}
        dropzoneProps={enableAttachments ? getRootProps() : undefined}
        hiddenInput={enableAttachments ? <input {...getInputProps()} data-chat-file-input="" /> : undefined}
        replyLabel={replyLabel}
        onCancelReply={onCancelReply}
      />
      {attachments.length > 0 ? (
        <Attachments variant="inline" className="mt-2 justify-start">
          {attachments.map((item, index) => (
            <Attachment
              key={`${item.file.name}-${item.file.lastModified}-${index}`}
              data={localAttachmentToData(item)}
              onRemove={() => removeAttachment(index)}
            >
              <AttachmentPreview />
              <AttachmentInfo />
              <AttachmentRemove />
            </Attachment>
          ))}
        </Attachments>
      ) : null}
    </div>
  );
});
