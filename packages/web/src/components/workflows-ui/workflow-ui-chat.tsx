"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FloatingChatPanel,
  type ChatMessage,
  type ChatAgentInfo,
} from '@/components/ui/floating-chat-widget';
import { fetchWithAuth } from '@/lib/auth';
import { sdk } from '@/lib/sdk';
import type { WorkflowUiProject } from '@agent-spaces/sdk';

interface AgentPreset {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

interface WorkflowUiChatProps {
  project: WorkflowUiProject;
  workspaceId?: string;
  activeFilePath: string;
  fileContent: string;
  onUpdateProject: (updates: Partial<Pick<WorkflowUiProject, 'agentConfigId'>>) => void;
}

export function WorkflowUiChat({
  project,
  workspaceId,
  activeFilePath,
  fileContent,
  onUpdateProject,
}: WorkflowUiChatProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [agent, setAgent] = useState<AgentPreset | null>(null);
  const [agents, setAgents] = useState<AgentPreset[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load agent list
  useEffect(() => {
    async function load() {
      try {
        const presets = await sdk.agent.listPresets();
        setAgents(presets.map((p: any) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          role: p.role,
        })));

        if (project.agentConfigId) {
          const current = presets.find((p: any) => p.id === project.agentConfigId);
          if (current) {
            setAgent({ id: current.id, name: current.name, avatar: (current as any).avatar, role: current.role });
          }
        }
      } catch (error) {
        console.error('Failed to load agents:', error);
      }
    }
    load();
  }, [project.agentConfigId]);

  const handleSend = useCallback(async () => {
    if (!chatInput.trim() || !agent || sending) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setSending(true);

    try {
      abortRef.current = new AbortController();
      const response = await fetchWithAuth('/api/agent-sse/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          workspaceId,
          message: chatInput.trim(),
          workflowUiContext: {
            projectId: project.id,
            activeFilePath,
            projectType: project.type,
            fileContent: fileContent.slice(0, 4000),
          },
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'output' && parsed.text) {
              assistantContent += parsed.text;
              setChatMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'agent' && last.id === `assistant_${userMessage.id}`) {
                  return [...prev.slice(0, -1), { ...last, content: assistantContent }];
                }
                return [...prev, {
                  id: `assistant_${userMessage.id}`,
                  role: 'agent' as const,
                  content: assistantContent,
                  timestamp: new Date(),
                }];
              });
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setChatMessages((prev) => [...prev, {
          id: `error_${Date.now()}`,
          role: 'agent',
          content: `错误: ${error.message}`,
          timestamp: new Date(),
        }]);
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [chatInput, agent, sending, workspaceId, project, activeFilePath, fileContent]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setSending(false);
  }, []);

  const handleSelectAgent = useCallback((preset: AgentPreset) => {
    setAgent(preset);
    setChatMessages([]);
    onUpdateProject({ agentConfigId: preset.id });
    setPickerOpen(false);
  }, [onUpdateProject]);

  const agentInfo: ChatAgentInfo = {
    name: agent?.name ?? 'AI 助手',
    avatar: agent?.avatar,
    role: agent?.role,
    status: sending ? 'busy' : 'online',
  };

  return (
    <>
      <FloatingChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onToggle={() => setChatOpen((prev) => !prev)}
        agent={agentInfo}
        messages={chatMessages}
        sending={sending}
        input={chatInput}
        onInputChange={setChatInput}
        onSend={handleSend}
        onStop={handleStop}
        inputPlaceholder={agent ? `向 ${agent.name} 提问...` : '选择 Agent...'}
        markdown
        headerActions={
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-background/50" onClick={() => setPickerOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        }
      />

      {/* Agent picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择 AI 助手</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-64 overflow-auto">
            {agents.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                暂无可用 Agent，请先在工作空间中创建 Agent
              </div>
            ) : (
              agents.map((preset) => (
                <button
                  key={preset.id}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm hover:bg-muted cursor-pointer ${
                    preset.id === agent?.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => handleSelectAgent(preset)}
                >
                  <span className="font-medium">{preset.name}</span>
                  {preset.role && <span className="text-xs text-muted-foreground">{preset.role}</span>}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
