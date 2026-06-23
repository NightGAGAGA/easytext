import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Folder,
  InsertDriveFile,
  ArrowUpward,
  NavigateNext,
  Storage,
  SdCard,
} from '@mui/icons-material';
import { Filesystem, Directory } from '@capacitor/filesystem';

interface FileBrowserProps {
  open: boolean;
  onClose: () => void;
  onSelectFile: (fileName: string, path: string) => void;
  onSelectFolder?: (folderPath: string) => void;
  allowedExtensions: string[];
  mode?: 'import' | 'export';
  initialPath?: string;
  initialRoot?: string;
  title?: string;
}

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
}

interface StorageRoot {
  name: string;
  path: string;
  icon: 'storage' | 'sdcard';
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  open,
  onClose,
  onSelectFile,
  onSelectFolder,
  allowedExtensions,
  mode = 'import',
  initialPath = '',
  initialRoot = '',
  title,
}) => {
  const isExport = mode === 'export';
  const hasInitializedRef = useRef(false);
  const rootsRef = useRef<StorageRoot[]>([{ name: '内部存储', path: '', icon: 'storage' }]);
  const [currentRoot, setCurrentRoot] = useState<StorageRoot>(rootsRef.current[0]);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRootSelector, setShowRootSelector] = useState(false);

  // 检测所有可用存储设备
  const detectRoots = useCallback(async () => {
    const detectedRoots: StorageRoot[] = [{ name: '内部存储', path: '', icon: 'storage' }];

    // 导出模式下只显示内部存储，避免 ../ 路径导致 writeFile 安全检查失败
    if (isExport) {
      rootsRef.current = detectedRoots;
      return;
    }

    // 方案1：尝试读取 /storage/ 目录（Android 6.0+ 的通用存储挂载点）
    try {
      const result = await Filesystem.readdir({
        path: '../..',
        directory: Directory.ExternalStorage,
      });

      const storageItems = (result.files as any[])
        .map((f: any) => f.name || f)
        .filter((name: string) => {
          // 排除已知系统目录，保留可能是存储设备的目录
          const excluded = ['emulated', 'self', 'tmpfs', 'proc', 'sys', 'data', 'system'];
          return typeof name === 'string' && !excluded.includes(name);
        });

      for (const item of storageItems) {
        const path = `../../${item}`;
        if (!detectedRoots.some((r) => r.path === path)) {
          detectedRoots.push({ name: 'SD卡', path, icon: 'sdcard' });
        }
      }
    } catch (e) {
      console.log('无法读取 /storage/ 目录，尝试已知路径');
    }

    // 方案2：尝试常见的 SD 卡固定路径
    const sdCardPaths = [
      { name: 'SD卡', path: '../../sdcard1', icon: 'sdcard' as const },
      { name: 'SD卡', path: '../../extSdCard', icon: 'sdcard' as const },
      { name: 'SD卡', path: '../../sdcard0', icon: 'sdcard' as const },
      { name: 'SD卡', path: '../sdcard1', icon: 'sdcard' as const },
      { name: 'SD卡', path: '../extSdCard', icon: 'sdcard' as const },
      { name: 'SD卡', path: 'sdcard1', icon: 'sdcard' as const },
      { name: 'SD卡', path: 'extSdCard', icon: 'sdcard' as const },
      { name: 'SD卡', path: '../external_sd', icon: 'sdcard' as const },
      { name: 'SD卡', path: '../../external_sd', icon: 'sdcard' as const },
    ];

    for (const sd of sdCardPaths) {
      if (detectedRoots.some((r) => r.path === sd.path)) continue;
      try {
        await Filesystem.readdir({
          path: sd.path,
          directory: Directory.ExternalStorage,
        });
        detectedRoots.push(sd);
      } catch {
        // 路径不存在，跳过
      }
    }

    rootsRef.current = detectedRoots;
  }, [isExport]);

  const scanDirectory = useCallback(async (root: StorageRoot, path: string) => {
    setLoading(true);
    setError('');
    try {
      // 正确拼接 root.path 和 path
      // 内部存储: root.path = '', path = '' -> ''
      // 内部存储子目录: root.path = '', path = 'Download' -> 'Download'
      // SD卡根目录: root.path = '../../sdcard1', path = '' -> '../../sdcard1'
      // SD卡子目录: root.path = '../../sdcard1', path = 'Download' -> '../../sdcard1/Download'
      const fullPath = root.path ? (path ? `${root.path}/${path}` : root.path) : path;

      const result = await Filesystem.readdir({
        path: fullPath,
        directory: Directory.ExternalStorage,
      });

      let items: FileEntry[] = (result.files as any[])
        .map((f: any) => {
          const name = f.name || f;
          const type = f.type || 'file';
          return { name, type };
        });

      // 导出模式下只显示文件夹
      if (isExport) {
        items = items.filter((item: FileEntry) => item.type === 'directory');
      } else {
        items = items.filter((item: FileEntry) => {
          if (item.type === 'directory') return true;
          const ext = item.name.split('.').pop()?.toLowerCase() || '';
          return allowedExtensions.includes(ext);
        });
      }

      items = items.sort((a: FileEntry, b: FileEntry) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });

      setEntries(items);
      setCurrentPath(path);
      setCurrentRoot(root);
      setShowRootSelector(false);
    } catch (e: any) {
      console.error('读取目录失败:', e);
      setError('读取目录失败：' + (e.message || '请检查存储权限'));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [allowedExtensions, isExport]);

  useEffect(() => {
    if (!open || hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    detectRoots().then(() => {
      // 导出模式下尝试恢复上次路径
      if (isExport && initialPath) {
        const matchedRoot = rootsRef.current.find(r => r.path === initialRoot) || rootsRef.current[0];
        scanDirectory(matchedRoot, initialPath);
      } else {
        scanDirectory(rootsRef.current[0], '');
      }
    });
  }, [open, detectRoots, scanDirectory, isExport, initialPath, initialRoot]);

  // 关闭时重置
  useEffect(() => {
    if (!open) {
      hasInitializedRef.current = false;
    }
  }, [open]);

  const navigateTo = (subPath: string) => {
    const newPath = currentPath ? `${currentPath}/${subPath}` : subPath;
    scanDirectory(currentRoot, newPath);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    const parentPath = parts.join('/');
    scanDirectory(currentRoot, parentPath);
  };

  const handleSelectRoot = (root: StorageRoot) => {
    scanDirectory(root, '');
  };

  const handleSelectFile = (fileName: string) => {
    const prefix = currentRoot.path ? currentRoot.path + '/' : '';
    const fullPath = currentPath ? prefix + currentPath + '/' + fileName : prefix + fileName;
    const cleanPath = fullPath.replace(/^\/+/, '').replace(/\/+/g, '/');
    onSelectFile(fileName, cleanPath);
  };

  const handleSelectFolder = () => {
    const prefix = currentRoot.path ? currentRoot.path + '/' : '';
    const fullPath = currentPath ? prefix + currentPath : prefix;
    const cleanPath = fullPath.replace(/^\/+/, '').replace(/\/+/g, '/');
    if (onSelectFolder) {
      onSelectFolder(cleanPath);
    }
  };

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];

  const dialogTitle = title || (isExport ? '选择导出位置' : '选择文件导入');
  const subtitle = isExport
    ? '请选择要保存到的文件夹'
    : `支持格式: ${allowedExtensions.join(', ')}`;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: '1.25rem', pb: 1 }}>
        {dialogTitle}
        <Typography sx={{ fontSize: '0.8rem', color: '#757575', mt: 0.5 }}>
          {subtitle}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ minHeight: 300, p: 0 }}>
        {/* 存储设备选择 */}
        <Box sx={{ px: 2, py: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setShowRootSelector(!showRootSelector)}
            sx={{ fontSize: '0.85rem', textTransform: 'none' }}
          >
            {currentRoot.icon === 'sdcard' ? <SdCard sx={{ fontSize: 18, mr: 0.5 }} /> : <Storage sx={{ fontSize: 18, mr: 0.5 }} />}
            {currentRoot.name}
          </Button>
          <Typography sx={{ fontSize: '0.8rem', color: '#757575' }}>
            点击切换存储设备
          </Typography>
        </Box>

        {showRootSelector && (
          <Box sx={{ px: 2, py: 1, bgcolor: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
            <Typography sx={{ fontSize: '0.8rem', color: '#757575', mb: 0.5 }}>选择存储位置:</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {rootsRef.current.map((root: StorageRoot) => (
                <Button
                  key={root.path}
                  size="small"
                  variant={root.path === currentRoot.path ? 'contained' : 'outlined'}
                  onClick={() => handleSelectRoot(root)}
                  sx={{ fontSize: '0.85rem', textTransform: 'none' }}
                >
                  {root.icon === 'sdcard' ? <SdCard sx={{ fontSize: 16, mr: 0.5 }} /> : <Storage sx={{ fontSize: 16, mr: 0.5 }} />}
                  {root.name}
                </Button>
              ))}
            </Box>
          </Box>
        )}

        {/* 路径面包屑 */}
        <Box sx={{ px: 2, py: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
          <Breadcrumbs
            separator={<NavigateNext sx={{ fontSize: 16 }} />}
            maxItems={3}
          >
            <Link
              component="button"
              underline="hover"
              onClick={() => scanDirectory(currentRoot, '')}
              sx={{ fontSize: '0.85rem', color: '#616161', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {currentRoot.name}
            </Link>
            {pathParts.map((part, index) => {
              const pathUpTo = pathParts.slice(0, index + 1).join('/');
              return (
                <Link
                  key={index}
                  component="button"
                  underline="hover"
                  onClick={() => scanDirectory(currentRoot, pathUpTo)}
                  sx={{ fontSize: '0.85rem', color: '#616161', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {part}
                </Link>
              );
            })}
          </Breadcrumbs>
        </Box>

        {/* 返回上一级 */}
        {currentPath && (
          <ListItemButton onClick={navigateUp} sx={{ py: 0.5, outline: 'none', '&:focus': { outline: 'none' } }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <ArrowUpward sx={{ fontSize: 20, color: '#616161' }} />
            </ListItemIcon>
            <ListItemText primary="返回上一级" sx={{ '& .MuiListItemText-primary': { fontSize: '0.95rem' } }} />
          </ListItemButton>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Typography sx={{ fontSize: '1rem', color: '#c62828', textAlign: 'center', py: 4, px: 2 }}>
            {error}
          </Typography>
        ) : entries.length === 0 ? (
          <Typography sx={{ fontSize: '1rem', color: '#757575', textAlign: 'center', py: 4 }}>
            该目录为空
          </Typography>
        ) : (
          <List dense sx={{ py: 0 }}>
            {entries.map((entry) => (
              <ListItem key={entry.name} disablePadding>
                {entry.type === 'directory' ? (
                  <ListItemButton onClick={() => navigateTo(entry.name)} sx={{ py: 0.75, outline: 'none', '&:focus': { outline: 'none' } }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Folder sx={{ fontSize: 22, color: '#ffa726' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={entry.name}
                      sx={{ '& .MuiListItemText-primary': { fontSize: '0.95rem' } }}
                    />
                  </ListItemButton>
                ) : (
                  <ListItemButton onClick={() => handleSelectFile(entry.name)} sx={{ py: 0.75, outline: 'none', '&:focus': { outline: 'none' } }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <InsertDriveFile sx={{ fontSize: 22, color: '#616161' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={entry.name}
                      sx={{ '& .MuiListItemText-primary': { fontSize: '0.95rem' } }}
                    />
                  </ListItemButton>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        {isExport && (
          <Button
            onClick={handleSelectFolder}
            variant="contained"
            size="large"
            sx={{ fontSize: '1.05rem', mr: 1 }}
          >
            选择此文件夹
          </Button>
        )}
        <Button onClick={onClose} size="large" sx={{ fontSize: '1.05rem' }}>
          取消
        </Button>
      </DialogActions>
    </Dialog>
  );
};
