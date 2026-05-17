import type { Attachment as MessageAttachment } from "@agent-spaces/shared";
import type { AttachmentData } from "./attachments";

export type LocalAttachment = {
  file: File;
  preview: string;
};

export async function uploadAttachment(item: LocalAttachment): Promise<MessageAttachment> {
  const formData = new FormData();
  formData.append("file", item.file);
  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${item.file.name}`);
  }
  const uploaded = (await res.json()) as { name: string; size: number; type: string; url: string };
  return {
    name: uploaded.name,
    path: uploaded.url,
    url: uploaded.url,
    type: uploaded.type,
    size: uploaded.size,
  };
}

export function localAttachmentToData(item: LocalAttachment): AttachmentData {
  return {
    id: `${item.file.name}-${item.file.lastModified}`,
    type: "file",
    filename: item.file.name,
    mediaType: item.file.type,
    url: item.preview,
  };
}
