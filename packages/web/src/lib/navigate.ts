import { isTauriEnvironment } from './native-notification';

export function tauriNavigate(router: { push: (href: string) => void; replace: (href: string) => void }, href: string, replace = false) {
  if (isTauriEnvironment()) {
    if (replace) {
      window.location.replace(href);
    } else {
      window.location.href = href;
    }
  } else {
    replace ? router.replace(href) : router.push(href);
  }
}
