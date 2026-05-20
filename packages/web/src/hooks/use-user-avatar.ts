import { useEffect, useState } from "react";

let cachedUrl: string | null | undefined = undefined;

export function useUserAvatar() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (cachedUrl !== undefined) return cachedUrl;
    return null;
  });

  useEffect(() => {
    if (cachedUrl !== undefined) return;
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.avatarUrl) {
          cachedUrl = data.avatarUrl;
          setAvatarUrl(data.avatarUrl);
        }
      })
      .catch(() => {});
  }, []);

  return avatarUrl;
}
