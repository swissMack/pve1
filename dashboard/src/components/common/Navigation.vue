<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TabMenu from 'primevue/tabmenu'

const route = useRoute()
const router = useRouter()

const items = ref([
  { label: 'Billing', icon: 'pi pi-dollar', route: '/billing' },
  { label: 'Provisioning', icon: 'pi pi-server', route: '/provisioning' },
  { label: 'Testing', icon: 'pi pi-cog', route: '/testing' }
])

const activeIndex = computed(() => {
  const currentPath = route.path
  return items.value.findIndex(item => currentPath.startsWith(item.route))
})

const onTabChange = (event: { index: number }) => {
  const item = items.value[event.index]
  if (item) {
    router.push(item.route)
  }
}
</script>

<template>
  <div class="navigation-container mb-4">
    <TabMenu :model="items" :activeIndex="activeIndex" @tab-change="onTabChange" />
  </div>
</template>
