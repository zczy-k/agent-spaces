'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDropzone } from 'react-dropzone';
import { EditorContent, ReactRenderer, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import tippy from 'tippy.js';

import { USERS } from '@/lib/users';
import { useAgentStore } from '@/stores/agent';
import { SuggestionList } from './suggestion-list';

type Attachment = {
  file: File;
  preview: string;
};

function stripSimpleParagraphs(html: string): string {
  if (!html) return html;
  const stripped = html.replace(/<\/?p>/g, "");
  if (/<[^>]+>/.test(stripped)) return html;
  return html.replace(/<\/p>\s*<p>/g, "\n").replace(/<\/?p>/g, "");
}

function createSuggestionRenderer() {
  let component: ReactRenderer | null = null;
  let popup: InstanceType<typeof tippy>[0] | null = null;

  return {
    onStart(props: { editor: Editor; clientRect?: (() => DOMRect) | null }) {
      component = new ReactRenderer(SuggestionList, {
        props,
        editor: props.editor,
      });

      if (!props.clientRect) return;

      popup = tippy('body', {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      });
    },

    onUpdate(props: { editor: Editor; clientRect?: (() => DOMRect) | null }) {
      component?.updateProps(props);
      if (popup?.[0] && props.clientRect) {
        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      }
    },

    onKeyDown(props: { event: KeyboardEvent }) {
      if (component?.ref && typeof component.ref === 'object' && 'onKeyDown' in component.ref) {
        return (component.ref as { onKeyDown: (props: { event: KeyboardEvent }) => boolean }).onKeyDown(props);
      }
      return false;
    },

    onExit() {
      popup?.[0]?.destroy();
      component?.destroy();
    },
  };
}

function createSlashExtension(skills: string[]) {
  return Extension.create({
    name: 'slashCommand',

    addOptions() {
      return {
        suggestion: {
          char: '/',
          items: ({ query }: { query: string }) => {
            const keyword = query.toLowerCase();
            return skills
              .filter((s) => s.toLowerCase().includes(keyword))
              .map((s) => ({ id: s, title: s, description: 'skill' }));
          },

          command: ({
            editor,
            range,
            props,
          }: {
            editor: Editor;
            range: { from: number; to: number };
            props: { id: string };
          }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent(`[use skill: ${props.id}]`)
              .run();
          },

          render: () => createSuggestionRenderer(),
        },
      };
    },

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
        }),
      ];
    },
  });
}

export function ComposerEditor({
  onSubmit,
  onClose,
}: {
  onSubmit: (payload: {
    content: string;
    attachments: {
      name: string;
      size: number;
      type: string;
      url: string;
    }[];
  }) => Promise<void> | void;
  onClose: () => void;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations('composer');
  const tc = useTranslations('common');

  const { getRootProps, getInputProps, open: openFilePicker } = useDropzone({
    noClick: true,
    noKeyboard: true,
    multiple: true,
    onDrop: (files) => {
      setAttachments((prev) => [
        ...prev,
        ...files.map((file) => ({
          file,
          preview: URL.createObjectURL(file),
        })),
      ]);
    },
  });

  useEffect(() => {
    return () => {
      attachments.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, [attachments]);

  const mentionExtension = useMemo(() => {
    return Mention.configure({
      HTMLAttributes: {
        class: 'mention',
      },
      suggestion: {
        char: '@',
        items: ({ query }: { query: string }) => {
          const keyword = query.toLowerCase();

          return USERS.filter((user) =>
            `${user.name} ${user.email}`.toLowerCase().includes(keyword),
          )
            .slice(0, 6)
            .map((user) => ({
              id: user.id,
              label: user.name,
              email: user.email,
            }));
        },
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: { from: number; to: number };
          props: Record<string, string>;
        }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: 'mention',
                attrs: props,
              },
            ])
            .run();
        },
        render: () => createSuggestionRenderer(),
      },
    });
  }, []);

  const agents = useAgentStore((s) => s.agents);

  const allSkills = useMemo(() => {
    const set = new Set<string>();
    for (const agent of agents) {
      agent.skills?.forEach((s) => set.add(s));
    }
    return [...set].sort();
  }, [agents]);

  const slashExtension = useMemo(() => {
    return createSlashExtension(allSkills);
  }, [allSkills]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: t('placeholder'),
      }),
      mentionExtension,
      slashExtension,
    ],
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
    },
    content: '',
  });

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return next;
    });
  };

  const canSubmit =
    !!editor?.getText().trim() || attachments.length > 0 ? true : false;

  const handleSubmit = async () => {
    if (!editor || submitting) return;

    setSubmitting(true);

    try {
      const uploaded = await Promise.all(
        attachments.map(async (item) => {
          const formData = new FormData();
          formData.append('file', item.file);

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            throw new Error(t('uploadFailed', { name: item.file.name }));
          }

          return (await res.json()) as {
            name: string;
            size: number;
            type: string;
            url: string;
          };
        }),
      );

      await onSubmit({
        content: stripSimpleParagraphs(editor.getHTML()),
        attachments: uploaded,
      });

      editor.commands.clearContent();
      setAttachments([]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInsertHeading = () => {
    editor?.chain().focus().toggleHeading({ level: 1 }).run();
  };

  const handleInsertQuote = () => {
    editor?.chain().focus().toggleBlockquote().run();
  };

  const handleInsertDivider = () => {
    editor?.chain().focus().setHorizontalRule().run();
  };

  return (
    <div className="modal-body">
      <div className="editor-shell" {...getRootProps()}>
        <input {...getInputProps()} />
        <div className="editor-toolbar">
          <button className="btn" type="button" onClick={handleInsertHeading}>
            {t('heading')}
          </button>
          <button className="btn" type="button" onClick={handleInsertQuote}>
            {t('quote')}
          </button>
          <button className="btn" type="button" onClick={handleInsertDivider}>
            {t('divider')}
          </button>
          <button className="btn" type="button" onClick={openFilePicker}>
            {t('addFile')}
          </button>
        </div>

        <div className="editor-area">
          <EditorContent editor={editor} />
          <div className="dropzone-hint">{t('dropzoneHint')}</div>
        </div>

        {attachments.length > 0 ? (
          <div className="attachments">
            {attachments.map((item, index) => {
              const isImage = item.file.type.startsWith('image/');
              return (
                <div className="attachment-chip" key={`${item.file.name}-${index}`}>
                  {isImage ? (
                    <img src={item.preview} alt={item.file.name} />
                  ) : null}
                  <div>
                    <div>{item.file.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {(item.file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={() => removeAttachment(index)}
                  >
                    {tc('delete')}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="footer">
          <div className="footer-left">
            <button className="btn" type="button" onClick={onClose}>
              {tc('cancel')}
            </button>
          </div>

          <div className="footer-right">
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? t('sending') : t('send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
