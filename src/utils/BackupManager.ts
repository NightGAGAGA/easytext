export interface BackupItem {
  id: string;
  content: string;
  fileName: string;
  timestamp: number;
}

const BACKUP_KEY = 'seniorTextEditorBackups';
const MAX_BACKUPS = 50;

export class BackupManager {
  static getBackups(): BackupItem[] {
    try {
      const data = localStorage.getItem(BACKUP_KEY);
      return data ? (JSON.parse(data) as BackupItem[]) : [];
    } catch {
      return [];
    }
  }

  static saveBackups(backups: BackupItem[]): void {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
    } catch (e) {
      console.error('保存备份失败:', e);
    }
  }

  static createBackup(content: string, fileName: string): BackupItem {
    const backup: BackupItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      fileName,
      timestamp: Date.now(),
    };

    const backups = this.getBackups();

    // 每日去重：同一天相同内容不重复保存
    const today = new Date().toDateString();
    const hasSameToday = backups.some(
      (b) =>
        new Date(b.timestamp).toDateString() === today &&
        b.content === content &&
        b.fileName === fileName
    );

    if (hasSameToday) {
      return backup;
    }

    backups.unshift(backup);

    // 保留最多 MAX_BACKUPS 个，但确保至少保留10天的数据
    if (backups.length > MAX_BACKUPS) {
      const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const recentBackups = backups.filter((b) => b.timestamp >= tenDaysAgo);
      if (recentBackups.length < MAX_BACKUPS) {
        backups.length = MAX_BACKUPS;
      } else {
        backups.length = 0;
        backups.push(...recentBackups.slice(0, MAX_BACKUPS));
      }
    }

    this.saveBackups(backups);
    return backup;
  }

  static deleteBackup(id: string): void {
    const backups = this.getBackups().filter((b) => b.id !== id);
    this.saveBackups(backups);
  }

  static clearAllBackups(): void {
    this.saveBackups([]);
  }

  static restoreBackup(id: string): BackupItem | null {
    return this.getBackups().find((b) => b.id === id) || null;
  }

  static exportBackupAsTxt(backup: BackupItem): void {
    const blob = new Blob([backup.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${backup.fileName}_备份_${new Date(backup.timestamp).toLocaleString().replace(/[/:]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
