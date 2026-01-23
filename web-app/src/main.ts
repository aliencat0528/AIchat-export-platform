import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';

// 路由設定
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/HomeView.vue'),
    },
    {
      path: '/import',
      name: 'import',
      component: () => import('./views/ImportView.vue'),
    },
    {
      path: '/conversation/:id',
      name: 'conversation',
      component: () => import('./views/ConversationView.vue'),
    },
    {
      path: '/export',
      name: 'export',
      component: () => import('./views/ExportView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./views/SettingsView.vue'),
    },
  ],
});

const app = createApp(App);
app.use(router);
app.mount('#app');
