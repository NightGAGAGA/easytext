import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import {
  AppBar,
  Toolbar as MuiToolbar,
  Button,
  ButtonGroup,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Menu,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Save,
  Backup,
  FolderOpen,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  StrikethroughS,
  Undo,
  Redo,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import {
  RootState,
  setFileName,
  resetDocument,
  setContent,
} from '../../store/store';
import { ExportService, ExportFormat } from '../../utils/ExportService';
import { BackupManager } from '../../utils/BackupManager';
import mammoth from 'mammoth';

interface ToolbarProps {
  onOpenBackupManager: () => void;
  onSave?: (content: string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onOpenBackupManager, onSave }) => {
  const dispatch = useDispatch();
  const { content, fileName } = useSelector(
    (state: RootState) => state.editor
  );

  const [renameOpen, setRenameOpen] = useState(false);
  const [newFileName, setNewFileName] = useState(fileName);
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);
  const [lastBackupContent, setLastBackupContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 自动备份：每10秒检查一次，内容有变化则备份
  useEffect(() => {
    const interval = setInterval(() => {
      if (content && (lastBackupContent === null || content !== lastBackupContent)) {
        BackupManager.createBackup(content, fileName);
        setLastBackupContent(content);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [content, fileName, lastBackupContent]);

  // 内容变化后重新启用备份按钮
  useEffect(() => {
    if (lastBackupContent !== null && content !== lastBackupContent) {
      setLastBackupContent(null);
    }
  }, [content, lastBackupContent]);

  const isBackupDisabled = lastBackupContent !== null;

  const handleNew = () => {
    if (
      content &&
      !window.confirm('新建文档会清空当前内容，是否继续？')
    ) {
      return;
    }
    dispatch(resetDocument());
  };

  const handleRename = () => {
    setNewFileName(fileName);
    setRenameOpen(true);
  };

  const handleRenameConfirm = () => {
    const trimmed = newFileName.trim();
    if (!trimmed) {
      setRenameOpen(false);
      return;
    }
    if (trimmed.length > 50) {
      alert('文档名称不能超过 50 个字符');
      return;
    }
    dispatch(setFileName(trimmed));
    setRenameOpen(false);
  };

  const handleBackup = () => {
    BackupManager.createBackup(content, fileName);
    setLastBackupContent(content);
    onSave?.(content);
  };

  const handleExport = async (format: ExportFormat) => {
    setExportAnchor(null);
    setLoading(true);
    try {
      await ExportService.export(format, content, fileName);
      onSave?.(content);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleFormat = (command: string) => {
    const editor = document.querySelector('[role="textbox"]') as HTMLElement;
    if (editor) {
      editor.focus();
      document.execCommand(command);
    }
  };

  const handleUndo = () => {
    const editor = document.querySelector('[role="textbox"]') as HTMLElement;
    if (editor) {
      editor.focus();
      document.execCommand('undo');
    }
  };

  const handleRedo = () => {
    const editor = document.querySelector('[role="textbox"]') as HTMLElement;
    if (editor) {
      editor.focus();
      document.execCommand('redo');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        const arrayBuffer = await file.arrayBuffer();
        try {
          const result = await mammoth.convertToHtml({ arrayBuffer });
          dispatch(setContent(result.value));
        } catch {
          // 如果 mammoth 无法解析（旧版 .doc），尝试纯文本提取
          const text = await file.text();
          dispatch(setContent(text.replace(/\n/g, '<br/>')));
        }
        dispatch(setFileName(file.name.replace(/\.(docx|doc)$/i, '')));
      } else if (file.name.endsWith('.txt') || file.name.endsWith('.html')) {
        const text = await file.text();
        dispatch(
          setContent(
            file.name.endsWith('.txt')
              ? text.replace(/\n/g, '<br/>')
              : text
          )
        );
        dispatch(setFileName(file.name.replace(/\.(txt|html)$/i, '')));
      } else {
        alert('仅支持 TXT、DOC、DOCX、HTML 文件导入');
      }
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败，请重试');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <AppBar
        position="static"
        elevation={0}
        sx={{ bgcolor: '#424242', borderBottom: '1px solid #bdbdbd' }}
      >
        <MuiToolbar
          sx={{
            flexWrap: 'wrap',
            gap: 1,
            py: 1,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* 左上角：标题 */}
          <Box>
            <Typography
              variant="h5"
              component="div"
              sx={{ fontWeight: 'bold', color: '#ffffff', fontSize: '1.4rem', lineHeight: 1.2 }}
            >
              老年人友好文字编辑
            </Typography>
            <Typography
              component="span"
              sx={{
                fontStyle: 'italic',
                color: '#bdbdbd',
                fontSize: '1rem',
                ml: 0.5,
              }}
            >
              EasyText
            </Typography>
          </Box>

          <Typography
            variant="h6"
            onClick={handleRename}
            sx={{
              color: '#e0e0e0',
              fontSize: '1.2rem',
              fontWeight: 500,
              cursor: 'pointer',
              maxWidth: 300,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              '&:hover': { color: '#ffffff' },
            }}
          >
            {fileName}
          </Typography>
        </MuiToolbar>

        {/* 第二行：按钮组 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            px: 2,
            py: 1,
            flexWrap: 'wrap',
            bgcolor: '#616161',
            borderTop: '1px solid #757575',
          }}
        >
          <ButtonGroup variant="contained" sx={{ flexWrap: 'wrap' }}>
            <Button
              startIcon={<Add />}
              onClick={handleNew}
              size="large"
              sx={{ minHeight: 44, fontSize: '1rem', bgcolor: '#757575', '&:hover': { bgcolor: '#858585' } }}
            >
              新建
            </Button>
            <Button
              startIcon={<FolderOpen />}
              onClick={handleImportClick}
              size="large"
              sx={{ minHeight: 44, fontSize: '1rem', bgcolor: '#757575', '&:hover': { bgcolor: '#858585' } }}
            >
              导入
            </Button>
            <Button
              startIcon={<Backup />}
              onClick={handleBackup}
              disabled={isBackupDisabled}
              size="large"
              sx={{
                minHeight: 44,
                fontSize: '1rem',
                bgcolor: isBackupDisabled ? '#9e9e9e' : '#757575',
                '&:hover': { bgcolor: isBackupDisabled ? '#9e9e9e' : '#858585' },
                cursor: isBackupDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              备份
            </Button>
            <Button
              startIcon={<Save />}
              onClick={(e) => setExportAnchor(e.currentTarget)}
              size="large"
              sx={{ minHeight: 44, fontSize: '1rem', bgcolor: '#757575', '&:hover': { bgcolor: '#858585' } }}
            >
              保存
            </Button>
          </ButtonGroup>

          {/* 撤销/重做按钮组 */}
          <ButtonGroup variant="outlined" sx={{ flexWrap: 'wrap' }}>
            <Button
              onClick={handleUndo}
              size="medium"
              sx={{ minHeight: 36, minWidth: 44, color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <Undo sx={{ fontSize: 20 }} />
            </Button>
            <Button
              onClick={handleRedo}
              size="medium"
              sx={{ minHeight: 36, minWidth: 44, color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <Redo sx={{ fontSize: 20 }} />
            </Button>
          </ButtonGroup>

          {/* 格式化按钮组 */}
          <ButtonGroup variant="outlined" sx={{ flexWrap: 'wrap' }}>
            <Button
              onClick={() => handleFormat('bold')}
              size="medium"
              sx={{ minHeight: 36, minWidth: 44, color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <FormatBold sx={{ fontSize: 20 }} />
            </Button>
            <Button
              onClick={() => handleFormat('italic')}
              size="medium"
              sx={{ minHeight: 36, minWidth: 44, color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <FormatItalic sx={{ fontSize: 20 }} />
            </Button>
            <Button
              onClick={() => handleFormat('underline')}
              size="medium"
              sx={{ minHeight: 36, minWidth: 44, color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <FormatUnderlined sx={{ fontSize: 20 }} />
            </Button>
            <Button
              onClick={() => handleFormat('strikeThrough')}
              size="medium"
              sx={{ minHeight: 36, minWidth: 44, color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <StrikethroughS sx={{ fontSize: 20 }} />
            </Button>
          </ButtonGroup>

          <Button
            variant="outlined"
            onClick={onOpenBackupManager}
            size="large"
            sx={{
              minHeight: 44,
              fontSize: '1rem',
              color: '#ffffff',
              borderColor: 'rgba(255,255,255,0.4)',
              '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            备份管理
          </Button>
        </Box>
      </AppBar>

      <Menu
        anchorEl={exportAnchor}
        open={Boolean(exportAnchor)}
        onClose={() => setExportAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <MenuItem onClick={() => handleExport('txt')} sx={{ fontSize: '1.05rem', minHeight: 48 }}>
          导出为 TXT
        </MenuItem>
        <MenuItem onClick={() => handleExport('pdf')} sx={{ fontSize: '1.05rem', minHeight: 48 }}>
          导出为 PDF
        </MenuItem>
        <MenuItem onClick={() => handleExport('doc')} sx={{ fontSize: '1.05rem', minHeight: 48 }}>
          导出为 DOC
        </MenuItem>
        <MenuItem onClick={() => handleExport('docx')} sx={{ fontSize: '1.05rem', minHeight: 48 }}>
          导出为 DOCX
        </MenuItem>
      </Menu>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".txt,.doc,.docx,.html"
        onChange={handleFileChange}
      />

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: '1.25rem' }}>重命名文档</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="文档名称"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameConfirm();
            }}
            sx={{ mt: 1 }}
            inputProps={{ style: { fontSize: '1.1rem' }, maxLength: 50 }}
            helperText={`${newFileName.length}/50`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)} size="large" sx={{ fontSize: '1.05rem' }}>
            取消
          </Button>
          <Button onClick={handleRenameConfirm} variant="contained" size="large" sx={{ fontSize: '1.05rem', bgcolor: '#616161', '&:hover': { bgcolor: '#505050' } }}>
            确定
          </Button>
        </DialogActions>
      </Dialog>

      {loading && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.3)',
            zIndex: 9999,
          }}
        >
          <CircularProgress size={64} sx={{ color: '#616161' }} />
        </Box>
      )}
    </>
  );
};
