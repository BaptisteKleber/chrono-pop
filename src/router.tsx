import { type AnchorHTMLAttributes, useSyncExternalStore } from "react"

/** Routeur minimal (5 routes, pas besoin de react-router) : l'URL du navigateur, et des liens sans rechargement */

const listeners = new Set<() => void>()
window.addEventListener("popstate", () => listeners.forEach((l) => l()))

export function navigate(to: string) {
  if (to !== window.location.pathname) {
    window.history.pushState(null, "", to)
    listeners.forEach((l) => l())
  }
  window.scrollTo(0, 0)
}

export function usePath() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => window.location.pathname.replace(/\/+$/, "") || "/",
  )
}

export function Link({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      {...props}
      href={to}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        navigate(to)
      }}
    />
  )
}
