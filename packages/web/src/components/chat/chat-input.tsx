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
  IconChevronUp,
  IconMicrophone,
  IconPaperclip,
  IconPlus,
  IconWand,
} from "@tabler/icons-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
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
import { createAgentResourceExtension } from "@/components/composer/create-agent-resource-extension";
import { createFileSearchExtension } from "@/components/composer/create-file-search-extension";
import {
  BUILT_IN_AGENT_TOOLS,
  type Attachment as MessageAttachment,
  type Channel,
  type Message,
} from "@agent-spaces/shared";
import { useChannelStore } from "@/stores/channel";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "./attachments";
import { AddMemberDialog } from "./add-member-dialog";
import { getAgentDisplayName, normalizeChannelMembersToAgentIds } from "@/lib/agent-members";
import { useAgentStore } from "@/stores/agent";

import {
  type MentionedAgent,
  collectMentionIds,
  stripSimpleParagraphs,
  getMcpLabels,
  getToolIcon,
  buildContentWithMentions,
} from "./chat-input-utils";
import {
  type LocalAttachment,
  uploadAttachment,
  localAttachmentToData,
} from "./chat-input-attachments";
import { ChatInputAgentBar } from "./chat-input-agent-bar";
import { ChatInputInfoBar } from "./chat-input-info-bar";

type AgentCommandItem = {
  name: string;
  content?: string;
  group?: string;
  agentId: string;
};

interface ChatInputProps {
  channelName: string;
  channelId: string;
  workspaceId: string;
  channel: Channel;
  agents: MentionedAgent[];
  messages?: Message[];
  onSend: (message: string, mentions: string[], attachments?: MessageAttachment[], replyToMessageId?: string) => void;
  isProcessing?: boolean;
  onStop?: () => void;
  replyTo?: { id: string; label: string } | null;
  onCancelReply?: () => void;
}

export interface ChatInputHandle {
  setContent: (html: string, agents?: MentionedAgent[]) => void;
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { channelName, channelId, workspaceId, channel, agents, messages = [], onSend, isProcessing = false, onStop, replyTo, onCancelReply },
  ref
) {
  const t = useTranslations('chat');
  const [collapsed, setCollapsed] = useState(false);
  const { isRecording: isVoiceRecording, start: startVoice, stop: stopVoice } = useSpeechRecognition();
  const [mentionedAgentIds, setMentionedAgentIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const isProcessingRef = useRef(isProcessing);
  const onSendRef = useRef(onSend);
  const editorRef = useRef<Editor | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  const restoredChannelRef = useRef<string | null>(null);
  const agentsRef = useRef(agents);
  const channelRef = useRef(channel);
  const activeSkillsRef = useRef<string[]>([]);
  const activeCommandsRef = useRef<AgentCommandItem[]>([]);
  const activeResourcesRef = useRef<{
    mcps: string[];
    tools: { name: string; label: string }[];
  }>({ mcps: [], tools: [] });

  const { saveDraft, clearDraft, updateChannel } = useChannelStore();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const allAgents = useAgentStore((s) => s.agents);
  const pinnedMentionId = channel.pinnedMentionId;
  const isPinned = pinnedMentionId === mentionedAgentIds[0] && !!pinnedMentionId;

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
  const activeResourceTools = useMemo(
    () => activeTools.map((tool) => ({ name: tool.name, label: tool.label })),
    [activeTools]
  );

  const agentLastActive = useMemo(() => {
    const map = new Map<string, string>();
    for (const msg of messages) {
      if (msg.senderId && msg.senderId !== 'user') {
        map.set(msg.senderId, msg.createdAt);
      }
    }
    return map;
  }, [messages]);

  const sortedAgents = useMemo(() => {
    const activeId = activeAgent?.id;
    return [...agents].sort((a, b) => {
      if (a.id === activeId) return -1;
      if (b.id === activeId) return 1;
      const ta = agentLastActive.get(a.id) ?? '';
      const tb = agentLastActive.get(b.id) ?? '';
      return tb.localeCompare(ta);
    });
  }, [agents, activeAgent?.id, agentLastActive]);

  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { onSendRef.current = onSend; }, [onSend]);
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { channelRef.current = channel; }, [channel]);
  useEffect(() => { activeSkillsRef.current = activeSkills; }, [activeSkills]);
  useEffect(() => {
    if (!activeAgent?.id) {
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
  }, [activeAgent?.id]);
  useEffect(() => {
    activeResourcesRef.current = {
      mcps: activeMcps,
      tools: activeResourceTools,
    };
  }, [activeMcps, activeResourceTools]);

  const scheduleDraftSave = useCallback(
    (content: string) => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = setTimeout(() => {
        if (content.trim()) {
          saveDraft(workspaceId, channelId, content);
        } else {
          clearDraft(workspaceId, channelId);
        }
      }, 1000);
    },
    [workspaceId, channelId, saveDraft, clearDraft]
  );

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
      const uploaded = await Promise.all(attachments.map(uploadAttachment));
      onSendRef.current(text ? stripSimpleParagraphs(currentEditor.getHTML()) : "", mentions, uploaded, replyTo?.id);
      currentEditor.commands.clearContent();
      setAttachments((prev) => {
        prev.forEach((item) => URL.revokeObjectURL(item.preview));
        return [];
      });
      setMentionedAgentIds([]);
      onCancelReply?.();
      clearDraft(workspaceId, channelId);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [attachments, workspaceId, channelId, replyTo?.id, onCancelReply, clearDraft]);

  const { getRootProps, getInputProps, open: openFilePicker } = useDropzone({
    noClick: true,
    noKeyboard: true,
    multiple: true,
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

  const removeExistingMentions = useCallback((editor: Editor, keepId?: string) => {
    const { tr } = editor.state;
    let removed = false;
    const nodesToRemove: { pos: number; nodeSize: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "mention") {
        const nodeId = node.attrs?.id;
        if (nodeId !== keepId) {
          nodesToRemove.push({ pos, nodeSize: node.nodeSize });
        }
      }
    });
    for (let i = nodesToRemove.length - 1; i >= 0; i--) {
      const { pos, nodeSize } = nodesToRemove[i];
      tr.delete(pos, pos + nodeSize);
      removed = true;
    }
    if (removed) editor.view.dispatch(tr);
  }, []);

  const replyToRef = useRef(replyTo);
  useEffect(() => { replyToRef.current = replyTo; }, [replyTo]);

  const mentionExtension = useMemo(
    () =>
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        suggestion: {
          char: "@",
          items: ({ query }: { query: string }) => {
            if (replyToRef.current) return [];
            const keyword = query.toLowerCase();
            return agentsRef.current
              .filter(
                (agent) =>
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
            removeExistingMentions(editor, props.id as string);
            editor
              .chain()
              .focus()
              .insertContentAt(range, [{ type: "mention", attrs: props }])
              .run();
          },
          render: () => createSuggestionRenderer(),
        },
      }),
    [removeExistingMentions]
  );

  const slashExtension = useMemo(
    () =>
      createSlashExtension(
        () => activeSkillsRef.current,
        () => activeCommandsRef.current.map((command) => ({
          id: `${command.group || 'root'}:${command.name}`,
          name: command.group ? `${command.group}/${command.name}` : command.name,
          content: command.content,
          insertText: command.name,
        })),
      ),
    []
  );

  const fileSearchExtension = useMemo(
    () => createFileSearchExtension(workspaceId),
    [workspaceId]
  );

  const agentResourceExtension = useMemo(
    () => createAgentResourceExtension(() => activeResourcesRef.current),
    []
  );

  const submitRef = useRef(submitCurrentMessage);
  submitRef.current = submitCurrentMessage;

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: t('input.placeholder', { channel: channelName }) }),
        mentionExtension,
        slashExtension,
        agentResourceExtension,
        fileSearchExtension,
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
          let m: RegExpExecArray | null;
          let hasMatch = false;
          while ((m = regex.exec(text)) !== null) {
            if (allAgents.some((a) => a.name === m![1] || a.id === m![1] || a.role === m![1])) {
              hasMatch = true;
              break;
            }
          }
          if (!hasMatch) return false;
          const ed = editorRef.current;
          if (!ed) return false;
          ed.commands.insertContent(buildContentWithMentions(text, allAgents));
          return true;
        },
      },
      content: "",
      onUpdate: ({ editor }) => {
        const ids = collectMentionIds(editor.getJSON());
        setMentionedAgentIds((prev) => {
          if (prev.length === ids.length && prev.every((id, i) => id === ids[i])) return prev;
          return ids;
        });
        scheduleDraftSave(editor.getHTML());
      },
    },
    [mentionExtension, slashExtension, agentResourceExtension, fileSearchExtension, channelName]
  );

  useEffect(() => { editorRef.current = editor; }, [editor]);

  const activateAgent = useCallback((agent: MentionedAgent) => {
    if (!editor) return;
    if (mentionedAgentIds[0] === agent.id) return;
    removeExistingMentions(editor, agent.id);
    const plainText = editor.getText().trim();
    const content: JSONContent[] = [
      { type: 'mention', attrs: { id: agent.id, label: agent.name || agent.role } },
      { type: 'text', text: ' ' + plainText },
    ];
    editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content }] }, { emitUpdate: true });
    editor.commands.focus('end');
  }, [editor, mentionedAgentIds, removeExistingMentions]);

  useEffect(() => {
    if (!editor || restoredChannelRef.current === channelId) return;
    restoredChannelRef.current = channelId;
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    const draft = channelRef.current.draft;
    const pinnedId = channelRef.current.pinnedMentionId;
    const pinnedAgent = pinnedId ? agentsRef.current.find((agent) => agent.id === pinnedId) : undefined;
    const content = draft?.content
      ? draft.content
      : pinnedAgent
        ? [
            { type: "mention", attrs: { id: pinnedAgent.id, label: pinnedAgent.name || pinnedAgent.role } },
            { type: "text", text: " " },
          ]
        : "";
    editor.commands.setContent(content, { emitUpdate: false });
    setMentionedAgentIds(collectMentionIds(editor.getJSON()));
  }, [editor, channelId]);

  useImperativeHandle(
    ref,
    () => ({
      setContent: (html: string, agents?: MentionedAgent[]) => {
        if (!editor) return;
        if (html.includes('data-type="mention"')) {
          editor.commands.setContent(html, { emitUpdate: false });
        } else {
          const plainText = /<[a-z][\s\S]*>/i.test(html) ? html.replace(/<[^>]*>/g, '') : html;
          const allAgents = agents ?? agentsRef.current;
          if (allAgents.length > 0 && /@\S+/.test(plainText)) {
            editor.commands.setContent(buildContentWithMentions(plainText, allAgents), { emitUpdate: false });
          } else {
            editor.commands.setContent(plainText, { emitUpdate: false });
          }
        }
        editor.commands.focus("end");
      },
      focus: () => { editor?.commands.focus("end"); },
    }),
    [editor]
  );

  const handleSubmit = useCallback(() => { submitCurrentMessage(); }, [submitCurrentMessage]);

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

  const togglePin = useCallback(() => {
    const currentMentionId = mentionedAgentIds[0];
    if (!currentMentionId) return;
    const newPinnedId = isPinned ? undefined : currentMentionId;
    updateChannel(workspaceId, channelId, { pinnedMentionId: newPinnedId });
  }, [mentionedAgentIds, isPinned, workspaceId, channelId, updateChannel]);

  const toggleVoice = useCallback(() => {
    if (isVoiceRecording) { stopVoice(); return; }
    const onText = (text: string, isFinal: boolean) => {
      const ed = editorRef.current;
      if (!ed) return;
      if (isFinal) ed.chain().focus().insertContent(text).run();
    };
    startVoice(onText);
  }, [isVoiceRecording, startVoice, stopVoice]);

  const chatActions = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-full border border-border hover:bg-accent"
            />
          }
        >
          <IconPlus className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5">
          <DropdownMenuGroup className="space-y-1">
            <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs" onClick={openFilePicker}>
              <IconPaperclip size={16} className="opacity-60" />
              {t('input.attachFiles')}
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
        <span className="text-xs">{t('input.autoMode')}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={toggleVoice}
        className={cn("h-7 w-7 p-0 rounded-full border border-border hover:bg-accent", {
          "bg-red-500/10 text-red-500 border-red-500/30 animate-pulse": isVoiceRecording,
          "text-muted-foreground": !isVoiceRecording,
        })}
        title={isVoiceRecording ? t('input.voiceStop') : t('input.voiceStart')}
      >
        <IconMicrophone className="size-3" />
      </Button>
    </>
  );

  return (
    <>
      <div className="flex justify-center -mt-0.5">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
        >
          <IconChevronUp className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>
      {!collapsed && (
        <div className="border-t px-4 py-2">
          {!replyTo && (
            <ChatInputAgentBar
              agents={sortedAgents}
              activeAgent={activeAgent}
              pinnedMentionId={pinnedMentionId}
              isPinned={isPinned}
              channel={channel}
              onActivateAgent={activateAgent}
              onTogglePin={togglePin}
              onOpenAddMember={() => setAddMemberOpen(true)}
              onToggleNotify={() => updateChannel(workspaceId, channelId, { notifyOnComplete: !channel.notifyOnComplete })}
            />
          )}

          <ComposerShell
            workspaceId={workspaceId}
            editor={editor}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
            onStop={onStop}
            isProcessing={isProcessing || submitting}
            actions={chatActions}
            dropzoneProps={getRootProps()}
            hiddenInput={<input {...getInputProps()} data-chat-file-input="" />}
            replyLabel={replyTo?.label}
            onCancelReply={onCancelReply}
          />
          {attachments.length > 0 && (
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
          )}

          <ChatInputInfoBar
            mcps={activeMcps}
            skills={activeSkills}
            tools={activeTools}
            todos={channel.todos}
            onClearTodos={() => updateChannel(workspaceId, channelId, { todos: [] })}
          />
        </div>
      )}

      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        candidates={allAgents.filter(a => a.enabled !== false).map(a => ({
          id: a.id,
          label: getAgentDisplayName(a),
          description: a.role,
        }))}
        defaultSelected={channel.members}
        onAdd={(newMembers) => {
          const enabled = allAgents.filter(a => a.enabled !== false);
          updateChannel(workspaceId, channelId, {
            members: normalizeChannelMembersToAgentIds(enabled, newMembers),
          });
        }}
      />
    </>
  );
});
