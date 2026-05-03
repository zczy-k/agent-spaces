"use client"

import type { Message, MessagePart } from "@agent-spaces/shared"
import { CheckCircle2Icon, CircleIcon, MessageSquareTextIcon } from "lucide-react"
import { Markdown } from "@/components/ui/markdown"
import { Loader } from "@/components/ui/loader"
import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
  AgentTool,
  AgentTools,
} from "./subagent"
import { AskUserQuestion } from "./ask-user-question"
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  Attachments,
  type AttachmentData,
} from "./attachments"
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationActions,
  ConfirmationAction,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "./confirmation"
import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "./context"
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "./chain-of-thought"
import { Terminal } from "./terminal"

interface MessagePartsProps {
  message: Message
  isUser: boolean
}

export function MessageParts({ message, isUser }: MessagePartsProps) {
  const parts = message.parts ?? []
  const hasTextPart = parts.some((part) => part.type === "text")

  return (
    <div className="space-y-3">
      {message.attachments?.length ? (
        <MessageAttachments attachments={message.attachments} isUser={isUser} />
      ) : null}
      {parts.length > 0 ? parts.map((part) => <MessagePartView key={part.id} part={part} />) : null}
      {!hasTextPart && message.content ? (
        isUser ? <UserContent content={message.content} /> : <Markdown content={message.content} />
      ) : null}
      {message.status === "pending" && parts.length === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader size={14} />
          <span>Agent is processing...</span>
        </div>
      ) : null}
    </div>
  )
}

function MessagePartView({ part }: { part: MessagePart }) {
  switch (part.type) {
    case "text":
      return <Markdown content={part.text} />
    case "reasoning":
      return (
        <ChainOfThought defaultOpen={part.status === "streaming"} className="max-w-none">
          <ChainOfThoughtHeader>
            {part.status === "streaming" ? "Agent is thinking" : "AI intermediate output"}
          </ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            <ChainOfThoughtStep
              icon={MessageSquareTextIcon}
              label={part.status === "streaming" ? "Streaming response" : "Intermediate message"}
              status={part.status === "streaming" ? "active" : "complete"}
            >
              <Markdown content={part.text} />
            </ChainOfThoughtStep>
          </ChainOfThoughtContent>
        </ChainOfThought>
      )
    case "todo":
      return (
        <ChainOfThought defaultOpen className="max-w-none">
          <ChainOfThoughtHeader>{part.todos.length} tool {part.todos.length === 1 ? "use" : "uses"}</ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            {part.todos.map((todo) => {
              const completed = todo.status === "completed"
              return (
                <ChainOfThoughtStep
                  key={todo.id}
                  icon={completed ? CheckCircle2Icon : CircleIcon}
                  label={todo.title}
                  description={todo.description}
                  status={completed ? "complete" : "active"}
                />
              )
            })}
          </ChainOfThoughtContent>
        </ChainOfThought>
      )
    case "terminal":
      return (
        <Terminal
          output={part.command ? `$ ${part.command}\n${part.output}` : part.output}
          isStreaming={part.status === "streaming"}
          className={part.status === "error" ? "border-destructive/40" : undefined}
        />
      )
    case "confirmation": {
      const approval = normalizeApproval(part.id, part.approval)
      return (
        <Confirmation
          approval={approval}
          state={approval.approved === undefined ? "approval-requested" : "approval-responded"}
        >
          <ConfirmationTitle>
            <ConfirmationRequest>
              {part.title}
              {part.description ? <span className="block text-xs">{part.description}</span> : null}
            </ConfirmationRequest>
            <ConfirmationAccepted>{part.title}</ConfirmationAccepted>
            <ConfirmationRejected>{part.approval?.reason ?? part.title}</ConfirmationRejected>
          </ConfirmationTitle>
          <ConfirmationActions>
            <ConfirmationAction variant="outline">Reject</ConfirmationAction>
            <ConfirmationAction>Approve</ConfirmationAction>
          </ConfirmationActions>
        </Confirmation>
      )
    }
    case "context":
      return (
        <Context
          usedTokens={part.usedTokens}
          maxTokens={part.maxTokens}
          modelId={part.modelId}
          usage={{
            inputTokens: part.usage?.inputTokens ?? 0,
            outputTokens: part.usage?.outputTokens ?? 0,
            totalTokens: part.usage?.totalTokens ?? part.usedTokens,
            cachedInputTokens: part.usage?.cachedInputTokens ?? 0,
            reasoningTokens: part.usage?.reasoningTokens ?? 0,
            inputTokenDetails: {
              noCacheTokens: undefined,
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
            },
            outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
          }}
        >
          <ContextTrigger />
          <ContextContent>
            <ContextContentHeader />
            <ContextContentBody className="space-y-2">
              <ContextInputUsage />
              <ContextOutputUsage />
              <ContextReasoningUsage />
              <ContextCacheUsage />
            </ContextContentBody>
            <ContextContentFooter />
          </ContextContent>
        </Context>
      )
    case "subagent":
      return (
        <Agent>
          <AgentHeader name={part.name} model={part.model} />
          {(part.instructions || part.tools?.length) ? (
            <AgentContent>
              {part.instructions ? <AgentInstructions>{part.instructions}</AgentInstructions> : null}
              {part.tools?.length ? (
                <AgentTools>
                  {part.tools.map((tool, index) => (
                    <AgentTool
                      key={`${tool.name ?? "tool"}-${index}`}
                      value={`tool-${index}`}
                      tool={{
                        description: tool.description ?? tool.name,
                        inputSchema: tool.inputSchema,
                        jsonSchema: tool.jsonSchema,
                      }}
                    />
                  ))}
                </AgentTools>
              ) : null}
            </AgentContent>
          ) : null}
        </Agent>
      )
    case "ask_user_question":
      return (
        <AskUserQuestion
          question={part.question}
          choices={part.choices}
          status={part.status}
          answer={part.answer}
        />
      )
    default:
      return null
  }
}

function normalizeApproval(id: string, approval: Extract<MessagePart, { type: "confirmation" }>["approval"]) {
  if (!approval || approval.approved === undefined) return { id: approval?.id ?? id }
  return {
    id: approval.id,
    approved: approval.approved,
    reason: approval.reason,
  }
}

function MessageAttachments({ attachments, isUser }: { attachments: NonNullable<Message["attachments"]>; isUser: boolean }) {
  return (
    <Attachments variant="inline" className={isUser ? "justify-end" : "justify-start"}>
      {attachments.map((attachment, index) => (
        <Attachment key={`${attachment.path}-${index}`} data={attachmentToData(attachment, index)}>
          <AttachmentPreview />
          <AttachmentInfo showMediaType />
        </Attachment>
      ))}
    </Attachments>
  )
}

function attachmentToData(attachment: NonNullable<Message["attachments"]>[number], index: number): AttachmentData {
  return {
    id: `${attachment.path || attachment.name}-${index}`,
    type: "file",
    filename: attachment.name,
    mediaType: attachment.type,
    url: attachment.url || attachment.path,
  }
}

function UserContent({ content }: { content: string }) {
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return <span className="tiptap tiptap-message" dangerouslySetInnerHTML={{ __html: content }} />
  }
  return <span className="whitespace-pre-wrap break-words">{content}</span>
}
