import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Typography,
  Box,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { BackupManager, BackupItem } from '../../utils/BackupManager';
import { ExportService } from '../../utils/ExportService';

interface BackupManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onRestore: (content: string, fileName: string) => void;
}

export const BackupManagerDialog: React.FC<BackupManagerDialogProps> = ({
  open,
  onClose,
  onRestore,
}) => {
  const [backups, setBackups] = useState<BackupItem[]>(() =>
    BackupManager.getBackups()
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<'txt' | 'docx'>('txt');

  React.useEffect(() => {
    if (open) {
      setBackups(BackupManager.getBackups());
      setSelectedIds(new Set());
    }
  }, [open]);

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleRestore = (backup: BackupItem) => {
    if (
      window.confirm(
        `确定恢复到 ${new Date(backup.timestamp).toLocaleString()} 的备份吗？当前内容将被覆盖。`
      )
    ) {
      onRestore(backup.content, backup.fileName);
      onClose();
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定删除此备份吗？')) {
      BackupManager.deleteBackup(id);
      setBackups(BackupManager.getBackups());
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleExportSelected = async () => {
    const selected = backups.filter((b) => selectedIds.has(b.id));
    if (selected.length === 0) {
      alert('请先选择要导出的备份');
      return;
    }
    for (const backup of selected) {
      if (exportFormat === 'txt') {
        BackupManager.exportBackupAsTxt(backup);
      } else {
        await ExportService.export('docx', backup.content, backup.fileName);
      }
    }
    alert(`已导出 ${selected.length} 个备份（${exportFormat.toUpperCase()}）`);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) {
      alert('请先选择要删除的备份');
      return;
    }
    if (window.confirm(`确定删除选中的 ${selectedIds.size} 个备份吗？`)) {
      selectedIds.forEach((id) => BackupManager.deleteBackup(id));
      setBackups(BackupManager.getBackups());
      setSelectedIds(new Set());
    }
  };

  const handleClearAll = () => {
    if (window.confirm('确定清空所有备份吗？此操作不可恢复。')) {
      BackupManager.clearAllBackups();
      setBackups([]);
      setSelectedIds(new Set());
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
        备份管理
      </DialogTitle>
      <DialogContent>
        {backups.length === 0 ? (
          <Typography sx={{ fontSize: '1.2rem', py: 4, textAlign: 'center' }}>
            暂无备份记录
          </Typography>
        ) : (
          <List>
            {backups.map((backup) => (
              <React.Fragment key={backup.id}>
                <ListItem
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 1,
                    py: 2,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      gap: 1,
                    }}
                  >
                    <Checkbox
                      checked={selectedIds.has(backup.id)}
                      onChange={() => handleToggle(backup.id)}
                      inputProps={{
                        'aria-label': `选择备份 ${new Date(
                          backup.timestamp
                        ).toLocaleString()}`,
                      }}
                    />
                    <ListItemText
                      primary={
                        <Typography sx={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                          {backup.fileName}
                        </Typography>
                      }
                      secondary={
                        <Typography sx={{ fontSize: '1rem' }}>
                          {new Date(backup.timestamp).toLocaleString()}
                        </Typography>
                      }
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, ml: 6, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={() => handleRestore(backup)}
                      sx={{ fontSize: '1rem', minHeight: 44 }}
                    >
                      恢复此版本
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => BackupManager.exportBackupAsTxt(backup)}
                      sx={{ fontSize: '1rem', minHeight: 44 }}
                    >
                      导出TXT
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="large"
                      onClick={() => handleDelete(backup.id)}
                      sx={{ fontSize: '1rem', minHeight: 44 }}
                    >
                      删除
                    </Button>
                  </Box>
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>格式</InputLabel>
            <Select
              value={exportFormat}
              label="格式"
              onChange={(e) => setExportFormat(e.target.value as 'txt' | 'docx')}
              sx={{ height: 40 }}
            >
              <MenuItem value="txt">TXT</MenuItem>
              <MenuItem value="docx">DOCX</MenuItem>
            </Select>
          </FormControl>
          <Button
            onClick={handleExportSelected}
            variant="contained"
            size="large"
            sx={{ fontSize: '1.05rem', minHeight: 48 }}
          >
            批量导出
          </Button>
        </Box>
        <Button
          onClick={handleDeleteSelected}
          variant="outlined"
          color="error"
          size="large"
          sx={{ fontSize: '1.05rem', minHeight: 48 }}
        >
          删除选中
        </Button>
        <Button
          onClick={handleClearAll}
          variant="outlined"
          color="error"
          size="large"
          sx={{ fontSize: '1.05rem', minHeight: 48 }}
        >
          清空全部
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          onClick={onClose}
          variant="contained"
          size="large"
          sx={{ fontSize: '1.05rem', minHeight: 48 }}
        >
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
};
