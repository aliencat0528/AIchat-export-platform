<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router';
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="logo">
        <h1>AI Chat Export</h1>
      </div>

      <nav>
        <RouterLink to="/" class="nav-item">
          <span class="icon">📋</span>
          對話列表
        </RouterLink>
        <RouterLink to="/import" class="nav-item">
          <span class="icon">📥</span>
          匯入資料
        </RouterLink>
        <RouterLink to="/export" class="nav-item">
          <span class="icon">📤</span>
          匯出 / 備份
        </RouterLink>
        <RouterLink to="/settings" class="nav-item">
          <span class="icon">⚙️</span>
          設定
        </RouterLink>
      </nav>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
}

.app {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: #1a1a2e;
  color: white;
  padding: 20px;
  flex-shrink: 0;
}

.logo h1 {
  font-size: 18px;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #333;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  color: #aaa;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.2s;
}

.nav-item:hover {
  background: #2a2a4e;
  color: white;
}

.nav-item.router-link-active {
  background: #3a3a6e;
  color: white;
}

.icon {
  font-size: 18px;
}

.content {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
}
</style>
