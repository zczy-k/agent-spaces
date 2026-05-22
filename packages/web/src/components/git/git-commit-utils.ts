export const statusColors: Record<string, string> = {
  modified: "text-yellow-600",
  added: "text-green-600",
  deleted: "text-red-600",
  renamed: "text-blue-600",
  untracked: "text-gray-500",
  conflicted: "text-red-500",
};

export const statusLabels: Record<string, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  untracked: "U",
  conflicted: "!",
};

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
