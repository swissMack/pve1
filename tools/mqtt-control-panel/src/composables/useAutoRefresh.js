import { onMounted, onUnmounted, ref } from 'vue'

export function useAutoRefresh(fetchFn, interval = 30000) {
  const isRefreshing = ref(false)
  let timer = null

  const refresh = async () => {
    isRefreshing.value = true
    try {
      await fetchFn()
    } finally {
      isRefreshing.value = false
    }
  }

  const start = () => {
    if (timer) return
    refresh()
    timer = setInterval(refresh, interval)
  }

  const stop = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(() => {
    start()
  })

  onUnmounted(() => {
    stop()
  })

  return { isRefreshing, refresh, start, stop }
}
