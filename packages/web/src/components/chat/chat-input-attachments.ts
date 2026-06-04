import type { Attachment as MessageAttachment } from "@agent-spaces/shared";
import { sdk } from '@/lib/sdk';
import type { AttachmentData } from "./attachments";

export type LocalAttachment = {
  file: File;
  preview: string;
};

export async function uploadAttachment(item: LocalAttachment): Promise<MessageAttachment> {
  const formData = new FormData();
  formData.append("file", item.file);
  const uploaded = await sdk.http.upload<{ name: string; size: number; type: string; url: string }>("/api/upload", formData);
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
