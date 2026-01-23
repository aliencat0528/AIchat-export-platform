/**
 * IndexedDB 資料庫設定
 * 使用 idb 套件簡化操作
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { UnifiedConversation, Platform } from '@aichat-export/shared';

interface ChatExportDB extends DBSchema {
  conversations: {
    key: string;
    value: UnifiedConversation;
    indexes: {
      'by-platform': Platform;
      'by-createdAt': string;
      'by-updatedAt': string;
    };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'aichat-export-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<ChatExportDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<ChatExportDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<ChatExportDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 建立 conversations store
      const conversationStore = db.createObjectStore('conversations', {
        keyPath: 'id',
      });
      conversationStore.createIndex('by-platform', 'platform');
      conversationStore.createIndex('by-createdAt', 'createdAt');
      conversationStore.createIndex('by-updatedAt', 'updatedAt');

      // 建立 settings store
      db.createObjectStore('settings', {
        keyPath: 'key',
      });
    },
  });

  return dbInstance;
}

// ============================================
// 對話相關操作
// ============================================

export async function getAllConversations(): Promise<UnifiedConversation[]> {
  const db = await getDB();
  return db.getAll('conversations');
}

export async function getConversation(id: string): Promise<UnifiedConversation | undefined> {
  const db = await getDB();
  return db.get('conversations', id);
}

export async function getConversationsByPlatform(platform: Platform): Promise<UnifiedConversation[]> {
  const db = await getDB();
  return db.getAllFromIndex('conversations', 'by-platform', platform);
}

export async function saveConversation(conversation: UnifiedConversation): Promise<void> {
  const db = await getDB();
  await db.put('conversations', conversation);
}

export async function saveConversations(conversations: UnifiedConversation[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('conversations', 'readwrite');
  await Promise.all([
    ...conversations.map(c => tx.store.put(c)),
    tx.done,
  ]);
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('conversations', id);
}

export async function deleteAllConversations(): Promise<void> {
  const db = await getDB();
  await db.clear('conversations');
}

// ============================================
// 備份 / 還原
// ============================================

export async function exportAllData(): Promise<string> {
  const db = await getDB();
  const conversations = await db.getAll('conversations');

  const backup = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    conversations,
    metadata: {
      totalConversations: conversations.length,
      platforms: [...new Set(conversations.map(c => c.platform))],
      exportedBy: 'AI Chat Export Platform',
    },
  };

  return JSON.stringify(backup, null, 2);
}

export async function importBackupData(jsonString: string): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    const data = JSON.parse(jsonString);

    if (!data.conversations || !Array.isArray(data.conversations)) {
      throw new Error('無效的備份格式');
    }

    const db = await getDB();
    const tx = db.transaction('conversations', 'readwrite');

    let imported = 0;
    for (const conv of data.conversations) {
      try {
        await tx.store.put(conv);
        imported++;
      } catch (e) {
        errors.push(`匯入對話 "${conv.title}" 失敗: ${e}`);
      }
    }

    await tx.done;
    return { imported, errors };
  } catch (e) {
    throw new Error(`解析備份檔案失敗: ${e}`);
  }
}
