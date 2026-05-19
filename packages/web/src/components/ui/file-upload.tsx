"use client";

import { useCallback, useState } from "react";
import { useDropzone, type Accept, type FileRejection } from "react-dropzone";
import { Upload, X, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileUploadFile {
  id: string;
  file: File;
  preview?: string;
}

interface FileUploadProps {
  value?: FileUploadFile[];
  onChange?: (files: FileUploadFile[]) => void;
  accept?: Accept;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

let _fileId = 0;

export function FileUpload({
  value = [],
  onChange,
  accept,
  maxFiles = 0,
  maxSize,
  disabled = false,
  className,
  placeholder,
}: FileUploadProps) {
  const [dragError, setDragError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      setDragError(null);

      if (rejected.length > 0) {
        const msg = rejected[0].errors[0]?.message;
        if (msg) setDragError(msg);
      }

      if (accepted.length === 0) return;

      const newFiles: FileUploadFile[] = accepted.map((file) => {
        const item: FileUploadFile = { id: `upload-${++_fileId}`, file };
        if (file.type.startsWith("image/")) {
          item.preview = URL.createObjectURL(file);
        }
        return item;
      });

      const next = maxFiles > 0 ? [...value, ...newFiles].slice(0, maxFiles) : [...value, ...newFiles];
      onChange?.(next);
    },
    [value, onChange, maxFiles],
  );

  const removeFile = useCallback(
    (id: string) => {
      const target = value.find((f) => f.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      onChange?.(value.filter((f) => f.id !== id));
    },
    [value, onChange],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept,
    maxFiles: maxFiles || undefined,
    maxSize,
    disabled,
    noClick: false,
  });

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition-colors cursor-pointer",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/50",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <input {...getInputProps()} />
        <Upload className="size-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">
            {placeholder ?? (isDragActive ? "松开即可上传" : "拖拽文件到此处，或点击选择")}
          </p>
          {!isDragActive && (
            <p className="mt-1 text-xs text-muted-foreground">
              支持多文件{maxSize ? `，单文件最大 ${(maxSize / 1024 / 1024).toFixed(0)}MB` : ""}
            </p>
          )}
        </div>
      </div>

      {dragError && <p className="text-xs text-destructive">{dragError}</p>}

      {/* File list */}
      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 overflow-hidden"
            >
              {item.preview ? (
                <img src={item.preview} alt="" className="size-10 rounded-md object-cover" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                  <FileIcon className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-sm">{item.file.name}</p>
                <p className="truncate text-xs text-muted-foreground">{formatSize(item.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(item.id);
                }}
                className="flex size-7 items-center justify-center rounded-md hover:bg-accent transition-colors"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
