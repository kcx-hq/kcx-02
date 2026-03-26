import { useEffect } from "react"

function scrollToHashTarget(hash: string) {
  const id = hash.startsWith("#") ? hash.slice(1) : hash
  if (!id) return

  const target = document.getElementById(id)
  if (!target) return

  target.scrollIntoView({ behavior: "smooth", block: "start" })
}

export function useScrollToHash() {
  useEffect(() => {
    scrollToHashTarget(window.location.hash)

    function handleHashChange() {
      scrollToHashTarget(window.location.hash)
    }

    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])
}

