import React, { useState, useEffect } from 'react';
import {
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
  FileDownload,
  FolderOpen,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  StrikethroughS,
  Undo,
  Redo,
  Visibility,
  History,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import {
  RootState,
  setFileName,
  resetDocument,
  setContent,
  addRecentDocument,
} from '../../store/store';
import { ExportService, ExportFormat } from '../../utils/ExportService';
import { extractDocText, isHtmlDisguisedDoc } from '../../utils/DocExtractor';
import mammoth from 'mammoth';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { FileBrowser } from '../FileBrowser/FileBrowser';

interface ToolbarProps {
  onSave?: (content: string) => void;
  onPreview?: () => void;
  onOpenRecent?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onSave, onPreview, onOpenRecent }) => {
  const dispatch = useDispatch();
  const { content, fileName } = useSelector(
    (state: RootState) => state.editor
  );

  const [renameOpen, setRenameOpen] = useState(false);
  const [newFileName, setNewFileName] = useState(fileName);
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const displayToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  // 导入文件浏览器
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);

  // 保存状态
  const [lastSavePath, setLastSavePath] = useState('');
  const [lastSaveFormat, setLastSaveFormat] = useState<ExportFormat>('txt');
  const isNative = Capacitor.isNativePlatform();

  // 读取上次保存路径
  useEffect(() => {
    try {
      const savedPath = localStorage.getItem('easyText_lastSavePath');
      const savedFormat = localStorage.getItem('easyText_lastSaveFormat') as ExportFormat;
      if (savedPath) setLastSavePath(savedPath);
      if (savedFormat) setLastSaveFormat(savedFormat);
    } catch { /* ignore */ }
  }, []);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  // 导出确认对话框
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [exportConfirmFormat, setExportConfirmFormat] = useState<ExportFormat>('txt');
  const [exportConfirmFileName, setExportConfirmFileName] = useState('');
  const [exportConfirmPath, setExportConfirmPath] = useState('');
  const [exportConfirmLoading, setExportConfirmLoading] = useState(false);

  const showConfirm = (title: string, message: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    confirmAction?.();
  };

  const handleNew = () => {
    if (content) {
      showConfirm('确认新建', '新建文档会清空当前内容，是否继续？', () => {
        dispatch(resetDocument());
      });
    } else {
      dispatch(resetDocument());
    }
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
      displayToast('文档名称不能超过 50 个字符');
      return;
    }
    dispatch(setFileName(trimmed));
    setRenameOpen(false);
  };

  const handleQuickSave = async () => {
    setLoading(true);
    try {
      const perm = await Filesystem.requestPermissions();
      if (perm.publicStorage !== 'granted') {
        displayToast('需要存储权限才能保存文件');
        setLoading(false);
        return;
      }
      
      const rawName = fileName.replace(/\.[^/.]+$/, '');
      await ExportService.export(lastSaveFormat, content, rawName, lastSavePath);
      onSave?.(content);
      dispatch(addRecentDocument({ fileName: rawName, content }));
      displayToast('保存成功');
    } catch (error: any) {
      console.error('保存失败:', error);
      displayToast('保存失败：' + (error.message || '请检查存储权限'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // 如果有上次保存路径，直接保存（不弹菜单）
    if (lastSavePath) {
      handleQuickSave();
      return;
    }
    // 首次保存：弹出格式选择菜单
    setExportAnchor(e.currentTarget);
  };

  const handleSaveMenuClick = async (format: ExportFormat) => {
    // 首次保存：弹出确认对话框
    setExportAnchor(null);
    setExportConfirmLoading(true);
    try {
      const suggestedName = await ExportService.getSuggestedFileName(fileName, format);
      const defaultPath = isNative ? '0101text' : 'EasyText';
      
      setExportConfirmFormat(format);
      setExportConfirmFileName(suggestedName);
      setExportConfirmPath(defaultPath);
      setExportConfirmOpen(true);
    } catch (error) {
      console.error('准备保存失败:', error);
      displayToast('保存准备失败，请重试');
    } finally {
      setExportConfirmLoading(false);
    }
  };

  const handleExportConfirm = async () => {
    setExportConfirmOpen(false);
    setLoading(true);
    try {
      const perm = await Filesystem.requestPermissions();
      if (perm.publicStorage !== 'granted') {
        displayToast('需要存储权限才能保存文件');
        setLoading(false);
        return;
      }

      const rawName = exportConfirmFileName.replace(/\.[^/.]+$/, '');
      await ExportService.export(exportConfirmFormat, content, rawName, exportConfirmPath);
      
      // 记录保存路径和格式
      setLastSavePath(exportConfirmPath);
      setLastSaveFormat(exportConfirmFormat);
      localStorage.setItem('easyText_lastSavePath', exportConfirmPath);
      localStorage.setItem('easyText_lastSaveFormat', exportConfirmFormat);
      
      dispatch(setFileName(rawName));
      onSave?.(content);
      dispatch(addRecentDocument({ fileName: rawName, content }));
      displayToast('保存成功');
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('保存失败:', error);
        displayToast('保存失败：' + (error.message || '请检查存储权限'));
      }
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

  const handleImportClick = async () => {
    try {
      const perm = await Filesystem.requestPermissions();
      if (perm.publicStorage !== 'granted') {
        displayToast('需要存储权限才能导入文件');
        return;
      }
      // 强制清除所有文本选择，防止 Android 系统选择手柄覆盖对话框
      if (window.getSelection) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.empty && sel.empty();
        }
      }
      // 让编辑器强制失去焦点，隐藏键盘和系统选择手柄
      const editor = document.querySelector('[role="textbox"]') as HTMLElement;
      if (editor) {
        editor.blur();
        editor.setAttribute('contenteditable', 'false');
        setTimeout(() => {
          editor.setAttribute('contenteditable', 'true');
        }, 500);
      }
      // 同时 blur 当前 activeElement
      if (document.activeElement && (document.activeElement as HTMLElement).blur) {
        (document.activeElement as HTMLElement).blur();
      }
      setFileBrowserOpen(true);
    } catch (e: any) {
      console.error('请求权限失败:', e);
      displayToast('请求权限失败：' + (e.message || '请检查存储权限'));
    }
  };

  const base64ToBytes = (base64: string): Uint8Array => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const readBytesAsText = (bytes: Uint8Array, encoding: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const blob = new Blob([bytes.buffer as ArrayBuffer]);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob, encoding);
      } catch (e) {
        reject(e);
      }
    });
  };

  const detectEncoding = (bytes: Uint8Array): 'utf-8' | 'gbk' | 'utf-8-bom' | 'utf-16le' | 'utf-16be' => {
    // 检测 UTF-8 BOM
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return 'utf-8-bom';
    }
    // 检测 UTF-16 LE BOM
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return 'utf-16le';
    }
    // 检测 UTF-16 BE BOM
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return 'utf-16be';
    }

    // 检测 UTF-8 有效性（检查前 4096 字节）
    let isValidUtf8 = true;
    let invalidUtf8Count = 0;
    let i = 0;
    const checkLen = Math.min(bytes.length, 4096);

    while (i < checkLen) {
      if (bytes[i] < 0x80) {
        i++;
      } else if ((bytes[i] & 0xE0) === 0xC0) {
        if (i + 1 >= checkLen || (bytes[i + 1] & 0xC0) !== 0x80) { invalidUtf8Count++; isValidUtf8 = false; }
        i += 2;
      } else if ((bytes[i] & 0xF0) === 0xE0) {
        if (i + 2 >= checkLen || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80) { invalidUtf8Count++; isValidUtf8 = false; }
        i += 3;
      } else if ((bytes[i] & 0xF8) === 0xF0) {
        if (i + 3 >= checkLen || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80 || (bytes[i + 3] & 0xC0) !== 0x80) { invalidUtf8Count++; isValidUtf8 = false; }
        i += 4;
      } else {
        invalidUtf8Count++;
        isValidUtf8 = false;
        i++;
      }
    }

    // 检测 GBK 特征：双字节编码对
    let gbkPairCount = 0;
    for (let j = 0; j < checkLen; j++) {
      if (bytes[j] >= 0x81 && bytes[j] <= 0xFE) {
        if (j + 1 < bytes.length && bytes[j + 1] >= 0x40 && bytes[j + 1] <= 0xFE && bytes[j + 1] !== 0x7F) {
          gbkPairCount++;
          j++;
        }
      }
    }

    // 判定：UTF-8 无效且有很多 GBK 特征 → GBK
    if (!isValidUtf8 && gbkPairCount > 0) {
      return 'gbk';
    }
    // 判定：UTF-8 有效但 GBK 特征很多，可能是纯中文 GBK（恰好某些 GBK 字节符合 UTF-8 规则的概率极低）
    if (isValidUtf8 && gbkPairCount > 5) {
      return 'gbk';
    }

    return 'utf-8';
  };

  // 导入成功后清除保存状态，让导入的文档被视为新文档
  const handleImportSuccess = () => {
    setLastSavePath('');
    setLastSaveFormat('txt');
    localStorage.removeItem('easyText_lastSavePath');
    localStorage.removeItem('easyText_lastSaveFormat');
  };

  const handleSelectImportFile = async (fileName: string, fullPath: string) => {
    setLoading(true);
    try {
      const ext = fileName.toLowerCase();
      const isDoc = ext.endsWith('.doc') || ext.endsWith('.docx');
      const isTxt = ext.endsWith('.txt');
      const isHtml = ext.endsWith('.html') || ext.endsWith('.htm');

      // 统一读取二进制
      const result = await Filesystem.readFile({
        path: fullPath,
        directory: Directory.ExternalStorage
      });
      const base64 = result.data as string;
      const bytes = base64ToBytes(base64);

      if (isDoc) {
        // 检查 ZIP 头（真正的 docx 是 ZIP 格式）
        const isZip = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4B;
        let importedContent = '';

        if (isZip) {
          // 真正的 docx 文件 → 用 mammoth 解析
          try {
            const mammothResult = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer as ArrayBuffer });
            importedContent = mammothResult.value;
            if (!importedContent || importedContent.trim() === '') {
              throw new Error('解析结果为空');
            }
          } catch (e: any) {
            console.error('docx解析失败:', e);
            alert('该DOCX文件格式较复杂，无法自动解析。建议：\n1. 用Word打开后复制粘贴到编辑器\n2. 或另存为纯文本(.txt)再导入');
            setLoading(false);
            return;
          }
        } else {
          // 不是 ZIP 格式 → 尝试 UTF-8 解码检查是否是 HTML 伪装
          let decodedText = '';
          try {
            decodedText = await readBytesAsText(bytes, 'utf-8');
          } catch (e) {
            console.error('UTF-8解码失败:', e);
          }

          // 严格检测 HTML 伪装（使用 DocExtractor 的工具函数）
          const isHtmlDisguised = isHtmlDisguisedDoc(bytes);

          if (isHtmlDisguised) {
            // 本应用导出的 HTML 伪装 DOC/DOCX
            const parser = new DOMParser();
            const doc = parser.parseFromString(decodedText, 'text/html');
            importedContent = doc.body.innerHTML || '';
          } else {
            // 尝试从 .doc 二进制格式中提取文本
            try {
              const result = await extractDocText(bytes);
              if (result.text && result.text.length > 0) {
                importedContent = result.text.replace(/\n/g, '<br/>');
              } else {
                throw new Error('无法提取文本');
              }
            } catch (e) {
              console.error('.doc提取失败:', e);
              alert('该文件格式较复杂，无法自动解析。建议：\n1. 用Word打开后复制粘贴到编辑器\n2. 或另存为纯文本(.txt)再导入');
              setLoading(false);
              return;
            }
          }
        }

        dispatch(setContent(importedContent || ''));
        const importedName = fileName.replace(/\.(docx|doc)$/i, '');
        dispatch(setFileName(importedName));
        dispatch(addRecentDocument({ fileName: importedName, content: importedContent || '' }));

      } else if (isTxt || isHtml) {
        // TXT/HTML 文件 → 编码检测 + 正确解码
        const detected = detectEncoding(bytes);
        let text = '';

        try {
          if (detected === 'utf-16le') {
            // 手动解码 UTF-16 LE
            const arr = new Uint16Array(bytes.buffer, bytes.byteOffset + 2, (bytes.length - 2) / 2);
            const chars = [];
            for (let i = 0; i < arr.length; i++) {
              chars.push(String.fromCharCode(arr[i]));
            }
            text = chars.join('');
          } else if (detected === 'utf-16be') {
            // 手动解码 UTF-16 BE（字节交换）
            const arr = new Uint16Array(bytes.buffer, bytes.byteOffset + 2, (bytes.length - 2) / 2);
            const chars = [];
            for (let i = 0; i < arr.length; i++) {
              chars.push(String.fromCharCode((arr[i] >> 8) | ((arr[i] & 0xFF) << 8)));
            }
            text = chars.join('');
          } else {
            text = await readBytesAsText(bytes, detected === 'utf-8-bom' ? 'utf-8' : detected);
            if (detected === 'utf-8-bom') {
              text = text.replace(/^\uFEFF/, '');
            }
          }

          // 如果检测到 UTF-8 但仍有乱码，尝试 GBK 作为 fallback
          if (detected === 'utf-8' && /[\uFFFD\uFFFE\uFFFF]/.test(text)) {
            try {
              const gbkText = await readBytesAsText(bytes, 'gbk');
              // 如果 GBK 结果明显不同且没有乱码，使用 GBK
              if (!/[\uFFFD\uFFFE\uFFFF]/.test(gbkText) && gbkText.length >= text.length * 0.8) {
                text = gbkText;
              }
            } catch (e) {
              console.error('GBK fallback失败:', e);
            }
          }
        } catch (e) {
          console.error('编码读取失败:', e);
          text = await readBytesAsText(bytes, 'utf-8');
        }

        const htmlContent = text.replace(/\n/g, '<br/>');
        dispatch(setContent(htmlContent));
        const cleanName = fileName.replace(/\.(txt|html|htm)$/i, '');
        dispatch(setFileName(cleanName));
        dispatch(addRecentDocument({ fileName: cleanName, content: htmlContent }));
      }

      setFileBrowserOpen(false);
      // 导入成功后清除保存状态，让导入的文档被视为新文档
      handleImportSuccess();
    } catch (e: any) {
      console.error('导入失败:', e);
      displayToast('导入失败：' + (e.message || '请检查文件权限'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 标题区域 */}
      <Box sx={{ bgcolor: '#424242', borderBottom: '1px solid #bdbdbd' }}>
        <MuiToolbar
          sx={{
            flexWrap: 'wrap',
            gap: 0.5,
            py: 0.5,
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: '44px',
          }}
        >
          {/* 左上角：标题 */}
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Typography
              variant="h6"
              component="div"
              sx={{ fontWeight: 'bold', color: '#ffffff', fontSize: '1.15rem', lineHeight: 1.2 }}
            >
              爱心打字
            </Typography>
            <Typography
              component="span"
              sx={{
                fontStyle: 'italic',
                color: '#bdbdbd',
                fontSize: '0.85rem',
                lineHeight: 1.2,
                pt: 0.2,
              }}
            >
              EasyText
            </Typography>
          </Box>

          <Typography
            variant="body1"
            onClick={handleRename}
            title={fileName}
            sx={{
              color: '#e0e0e0',
              fontSize: '1rem',
              fontWeight: 500,
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              '&:hover': { color: '#ffffff' },
            }}
          >
            {fileName.length > 6 ? fileName.slice(0, 6) + '…' : fileName}
          </Typography>
        </MuiToolbar>
      </Box>

      {/* 按钮区域 */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1200,
          bgcolor: '#616161',
          borderTop: '1px solid #757575',
        }}
      >
        {/* 第一行：文件操作 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            px: 1,
            py: 0.75,
            flexWrap: 'wrap',
          }}
        >
          <ButtonGroup variant="contained" sx={{ flexWrap: 'wrap' }}>
            <Button
              onClick={handleNew}
              size="small"
              title="新建"
              sx={{ minHeight: 40, minWidth: 44, p: 0, bgcolor: '#757575', '&:hover': { bgcolor: '#858585' } }}
            >
              <Add sx={{ fontSize: 22 }} />
            </Button>
            <Button
              onClick={handleImportClick}
              size="small"
              title="导入"
              sx={{ minHeight: 40, minWidth: 44, p: 0, bgcolor: '#757575', '&:hover': { bgcolor: '#858585' } }}
            >
              <FolderOpen sx={{ fontSize: 22 }} />
            </Button>
            <Button
              onClick={handleSaveButtonClick}
              size="small"
              title="保存"
              sx={{ minHeight: 40, minWidth: 44, p: 0, bgcolor: '#757575', '&:hover': { bgcolor: '#858585' } }}
            >
              <FileDownload sx={{ fontSize: 22 }} />
            </Button>
            <Button
              onClick={onOpenRecent}
              size="small"
              title="最近文档"
              sx={{ minHeight: 40, minWidth: 44, p: 0, bgcolor: '#757575', '&:hover': { bgcolor: '#858585' } }}
            >
              <History sx={{ fontSize: 22 }} />
            </Button>
            <Button
              onClick={onPreview}
              size="small"
              title="预览"
              sx={{ minHeight: 40, minWidth: 44, p: 0, bgcolor: '#757575', '&:hover': { bgcolor: '#858585' } }}
            >
              <Visibility sx={{ fontSize: 22 }} />
            </Button>
          </ButtonGroup>
        </Box>

        {/* 第二行：编辑操作 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            px: 1,
            pb: 0.75,
            flexWrap: 'wrap',
          }}
        >
          <ButtonGroup variant="outlined" sx={{ flexWrap: 'wrap' }}>
            <Button
              onClick={handleUndo}
              size="small"
              title="撤销"
              sx={{ minHeight: 40, minWidth: 44, p: 0, color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <Undo sx={{ fontSize: 22 }} />
            </Button>
            <Button
              onClick={handleRedo}
              size="small"
              title="重做"
              sx={{ minHeight: 40, minWidth: 44, p: 0, color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <Redo sx={{ fontSize: 22 }} />
            </Button>
          </ButtonGroup>
          <ButtonGroup variant="outlined" sx={{ flexWrap: 'wrap' }}>
            <Button
              onClick={() => handleFormat('bold')}
              size="small"
              title="加粗"
              sx={{ minHeight: 40, minWidth: 44, p: 0, color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <FormatBold sx={{ fontSize: 22 }} />
            </Button>
            <Button
              onClick={() => handleFormat('italic')}
              size="small"
              title="斜体"
              sx={{ minHeight: 40, minWidth: 44, p: 0, color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <FormatItalic sx={{ fontSize: 22 }} />
            </Button>
            <Button
              onClick={() => handleFormat('underline')}
              size="small"
              title="下划线"
              sx={{ minHeight: 40, minWidth: 44, p: 0, color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <FormatUnderlined sx={{ fontSize: 22 }} />
            </Button>
            <Button
              onClick={() => handleFormat('strikeThrough')}
              size="small"
              title="删除线"
              sx={{ minHeight: 40, minWidth: 44, p: 0, color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <StrikethroughS sx={{ fontSize: 22 }} />
            </Button>
          </ButtonGroup>
        </Box>
      </Box>

      <Menu
        anchorEl={exportAnchor}
        open={Boolean(exportAnchor)}
        onClose={() => setExportAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <MenuItem onClick={() => handleSaveMenuClick('txt')} sx={{ fontSize: '1.05rem', minHeight: 48 }}>
          保存为 TXT
        </MenuItem>
        <MenuItem onClick={() => handleSaveMenuClick('pdf')} sx={{ fontSize: '1.05rem', minHeight: 48 }}>
          保存为 PDF
        </MenuItem>
        <MenuItem onClick={() => handleSaveMenuClick('doc')} sx={{ fontSize: '1.05rem', minHeight: 48 }}>
          保存为 DOC
        </MenuItem>
        <MenuItem onClick={() => handleSaveMenuClick('docx')} sx={{ fontSize: '1.05rem', minHeight: 48 }}>
          保存为 DOCX
        </MenuItem>
      </Menu>

      {/* 导入文件浏览器 */}
      <FileBrowser
        open={fileBrowserOpen}
        onClose={() => setFileBrowserOpen(false)}
        onSelectFile={handleSelectImportFile}
        allowedExtensions={['txt', 'doc', 'docx', 'html']}
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

      {/* 确认对话框 */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          {confirmTitle}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '1.1rem', lineHeight: 1.8 }}>
            {confirmMessage}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmOpen(false)}
            variant="outlined"
            size="large"
            sx={{ fontSize: '1.05rem', minHeight: 48, color: '#616161', borderColor: '#bdbdbd', '&:hover': { borderColor: '#616161' } }}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            size="large"
            sx={{ fontSize: '1.05rem', minHeight: 48, bgcolor: '#616161', '&:hover': { bgcolor: '#505050' } }}
          >
            确定
          </Button>
        </DialogActions>
      </Dialog>

      {/* 保存确认对话框 */}
      <Dialog open={exportConfirmOpen} onClose={() => setExportConfirmOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          确认导出
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="文件名"
            value={exportConfirmFileName}
            onChange={(e) => setExportConfirmFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleExportConfirm();
            }}
            sx={{ mt: 1, mb: 2 }}
            inputProps={{ style: { fontSize: '1.1rem' } }}
            helperText={`保存位置：${exportConfirmPath}`}
          />
          <Typography sx={{ fontSize: '1rem', color: '#616161' }}>
            格式：{exportConfirmFormat.toUpperCase()}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setExportConfirmOpen(false)}
            variant="outlined"
            size="large"
            sx={{ fontSize: '1.05rem', minHeight: 48, color: '#616161', borderColor: '#bdbdbd', '&:hover': { borderColor: '#616161' } }}
          >
            取消
          </Button>
          <Button
            onClick={handleExportConfirm}
            variant="contained"
            size="large"
            disabled={exportConfirmLoading}
            sx={{ fontSize: '1.05rem', minHeight: 48, bgcolor: '#616161', '&:hover': { bgcolor: '#505050' } }}
          >
            确认保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast 提示 */}
      {showToast && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: '#424242',
            color: '#ffffff',
            px: 3,
            py: 1.5,
            borderRadius: 2,
            fontSize: '1rem',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'opacity 0.3s',
          }}
        >
          {toastMessage}
        </Box>
      )}

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
