import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/billing'
  },
  {
    path: '/billing',
    name: 'Billing',
    component: () => import('@/pages/BillingPage.vue')
  },
  {
    path: '/provisioning',
    name: 'Provisioning',
    component: () => import('@/pages/ProvisioningPage.vue')
  },
  {
    path: '/testing',
    name: 'Testing',
    component: () => import('@/pages/TestingPage.vue')
  }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
