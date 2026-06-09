"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/layout/theme-provider";
import { MonacoCodeEditor as MonacoEditor } from "@/components/editor/monaco-code-editor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  onContentChange: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}

export function GitGitignoreDialog({ open, onOpenChange, content, onContentChange, saving, onSave }: Props) {
  const tc = useTranslations('common');
  const { resolvedTheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>.gitignore</DialogTitle></DialogHeader>
        <div className="h-80 border rounded overflow-hidden">
          <MonacoEditor height="100%" language="plaintext" value={content} onChange={(v) => onContentChange(v ?? "")}
            options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 8 }, lineNumbers: "on" }}
            theme={resolvedTheme === "dark" ? "vs-dark" : "vs"} />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>{tc('cancel')}</DialogClose>
          <Button size="sm" onClick={onSave} disabled={saving}>{saving ? tc('saving') : tc('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
