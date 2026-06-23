import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton,
  Tooltip,
  TextField,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  InvertColors,
  RecordVoiceOver,
  Stop,
  HelpOutline,
  Search,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { Provider, useDispatch, useSelector } from 'react-redux';
import {
  store,
  RootState,
  markVisited,
  setContent,
  setFileName,
  setFontSizeLevel,
  setTheme,
  addRecentDocument,
  removeRecentDocument,
  RecentDocument,
} from './store/store';
import { Toolbar } from './components/Toolbar/Toolbar';
import { TextEditor } from './components/Editor/TextEditor';
import { BackupManagerDialog } from './components/BackupManager/BackupManagerDialog';
import { RecentDocumentsDialog } from './components/RecentDocumentsDialog';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { AccessibilityUtils } from './accessibility/AccessibilityUtils';
import { App as CapacitorApp } from '@capacitor/app';

const FONT_SIZE_LABELS = ['20px', '24px', '28px', '32px', '36px'];
const THEME_OPTIONS: { value: 'default' | 'dark' | 'eye-care'; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'dark', label: '夜间' },
  { value: 'eye-care', label: '护眼' },
];

const theme = createTheme({
  typography: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', sans-serif",
    fontSize: 16,
  },
  palette: {
    primary: {
      main: '#616161',
    },
    secondary: {
      main: '#424242',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          '&:focus': {
            outline: 'none',
          },
          '&:focus-visible': {
            outline: 'none',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '&:focus': {
            outline: 'none',
          },
          '&:focus-visible': {
            outline: 'none',
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          '-webkit-tap-highlight-color': 'transparent',
          '-webkit-touch-callout': 'none',
          '&:focus': {
            outline: 'none',
          },
          '&:focus-visible': {
            outline: 'none',
          },
        },
      },
    },
  },
});

const AppContent: React.FC = () => {
  const dispatch = useDispatch();
  const { theme: appTheme, hasVisited, fontSizeLevel, theme: currentTheme, content, fileName } = useSelector(
    (state: RootState) => state.editor
  );
  const [previewMode, setPreviewMode] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [exportReminderOpen, setExportReminderOpen] = useState(false);
  const [findMatchIndex, setFindMatchIndex] = useState(-1);
  const [findMatches, setFindMatches] = useState<{node: Node; start: number; end: number}[]>([]);
  const [savedContent, setSavedContent] = useState<string>(() => {
    try {
      return localStorage.getItem('easyText_savedContent') || '';
    } catch { return ''; }
  });

  // 启动页已移除，使用原生启动背景以提升启动速度

  // 最近文档
  const [recentOpen, setRecentOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<RecentDocument | null>(null);
  const { recentDocuments } = useSelector((state: RootState) => state.editor);

  // 自动备份：每10秒检查一次，内容有变化则备份（预览模式下依然生效）
  const [lastAutoBackupContent, setLastAutoBackupContent] = useState<string | null>(null);
  useEffect(() => {
    const interval = setInterval(() => {
      if (content && (lastAutoBackupContent === null || content !== lastAutoBackupContent)) {
        import('./utils/BackupManager').then(({ BackupManager }) => {
          BackupManager.createBackup(content, fileName);
        });
        setLastAutoBackupContent(content);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [content, fileName, lastAutoBackupContent]);

  // 打开最近文档（带未保存确认）
  const handleOpenRecent = useCallback((doc: RecentDocument) => {
    if (content !== savedContent && savedContent !== '') {
      setPendingDoc(doc);
      setConfirmOpen(true);
    } else {
      dispatch(setContent(doc.content));
      dispatch(setFileName(doc.fileName));
      setRecentOpen(false);
    }
  }, [content, savedContent, dispatch]);

  const confirmOpenRecent = useCallback(() => {
    if (pendingDoc) {
      dispatch(setContent(pendingDoc.content));
      dispatch(setFileName(pendingDoc.fileName));
      setSavedContent(pendingDoc.content);
      try {
        localStorage.setItem('easyText_savedContent', pendingDoc.content);
      } catch { /* ignore */ }
    }
    setConfirmOpen(false);
    setPendingDoc(null);
    setRecentOpen(false);
  }, [pendingDoc, dispatch]);

  const cancelOpenRecent = useCallback(() => {
    setConfirmOpen(false);
    setPendingDoc(null);
  }, []);

  // 右下角浮动按钮展开/折叠状态
  const [floatExpanded, setFloatExpanded] = useState(false);
  const floatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startFloatTimer = useCallback(() => {
    if (floatTimerRef.current) {
      clearTimeout(floatTimerRef.current);
    }
    floatTimerRef.current = setTimeout(() => {
      setFloatExpanded(false);
    }, 5000);
  }, []);

  const toggleFloat = () => {
    const next = !floatExpanded;
    setFloatExpanded(next);
    if (next) {
      startFloatTimer();
    }
  };

  const handleFloatAction = (action: () => void) => {
    action();
    startFloatTimer();
  };

  // 点击外部自动缩回右下角浮动按钮
  useEffect(() => {
    if (!floatExpanded) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const floatEl = document.querySelector('[data-float-group]');
      if (floatEl && !floatEl.contains(target)) {
        setFloatExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [floatExpanded]);

  // 3秒无操作自动缩回
  useEffect(() => {
    if (!floatExpanded) return;
    const handler = () => startFloatTimer();
    window.addEventListener('scroll', handler);
    window.addEventListener('touchstart', handler);
    return () => {
      window.removeEventListener('scroll', handler);
      window.removeEventListener('touchstart', handler);
      if (floatTimerRef.current) clearTimeout(floatTimerRef.current);
    };
  }, [floatExpanded, startFloatTimer]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appTheme);
  }, [appTheme]);

  useEffect(() => {
    if (!hasVisited) {
      setGuideOpen(true);
      dispatch(markVisited());
      localStorage.setItem('easyText_hasVisited', 'true');
    }
  }, [dispatch, hasVisited]);

  // 监听 Android 物理返回按钮：预览模式下退出预览，否则退出应用
  useEffect(() => {
    let backHandler: any;
    const setupBackButton = async () => {
      backHandler = await CapacitorApp.addListener('backButton', () => {
        if (previewMode) {
          setPreviewMode(false);
        } else {
          CapacitorApp.exitApp();
        }
      });
    };
    setupBackButton();
    return () => {
      if (backHandler) backHandler.remove();
    };
  }, [previewMode]);

  // 夜间自动切换：20:00-06:00自动切换夜间模式（仅首次启动，用户手动切换后不再自动）
  useEffect(() => {
    const today = new Date().toDateString();
    const lastAutoSwitch = localStorage.getItem('easyText_lastAutoSwitch');
    if (lastAutoSwitch === today) return; // 今天已经切换过，不再自动

    const hour = new Date().getHours();
    if (hour >= 20 || hour < 6) {
      dispatch(setTheme('dark'));
      localStorage.setItem('easyText_lastAutoSwitch', today);
    }
  }, [dispatch]);

  // 自动保存到最近文档（导出、新建、导入时）
  const saveToRecent = useCallback(() => {
    if (content && fileName && fileName !== '未命名文档') {
      dispatch(addRecentDocument({ fileName, content }));
    }
  }, [content, fileName, dispatch]);

  // 导出时保存到最近文档
  useEffect(() => {
    saveToRecent();
  }, [savedContent]);

  // 超过一天未导出提醒
  useEffect(() => {
    const lastExport = localStorage.getItem('easyText_lastExportTime');
    if (lastExport) {
      const lastDate = new Date(Number(lastExport));
      const now = new Date();
      const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
      if (diffHours > 24) {
        setExportReminderOpen(true);
      }
    }
  }, []);

  // 性能监控
  useEffect(() => {
    if (!('performance' in window)) return;
    const logMetrics = () => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (!nav) return;
      const metrics = {
        dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
        tcp: Math.round(nav.connectEnd - nav.connectStart),
        ttfb: Math.round(nav.responseStart - nav.startTime),
        fcp: Math.round(nav.domContentLoadedEventStart - nav.startTime),
        lcp: Math.round(nav.loadEventEnd - nav.startTime),
        timestamp: Date.now(),
      };
      console.log('[性能监控]', metrics);
      const all = JSON.parse(localStorage.getItem('easyText_perf') || '[]');
      all.push(metrics);
      localStorage.setItem('easyText_perf', JSON.stringify(all.slice(-30)));
    };
    if (document.readyState === 'complete') {
      setTimeout(logMetrics, 0);
    } else {
      window.addEventListener('load', () => setTimeout(logMetrics, 0));
    }
  }, []);

  // 埋点函数
  const track = useCallback((event: string, params?: Record<string, any>) => {
    const record = { event, params, timestamp: Date.now() };
    const all = JSON.parse(localStorage.getItem('easyText_events') || '[]');
    all.push(record);
    localStorage.setItem('easyText_events', JSON.stringify(all.slice(-200)));
    console.log('[埋点]', record);
  }, []);

  const handleRestore = (content: string, fileName: string) => {
    dispatch(setContent(content));
    dispatch(setFileName(fileName));
  };

  const handleFontSizeCycle = () => {
    const next = (fontSizeLevel + 1) % FONT_SIZE_LABELS.length;
    dispatch(setFontSizeLevel(next));
    track('fontSize_change', { level: next });
  };

  const handleThemeCycle = () => {
    const currentIndex = THEME_OPTIONS.findIndex((o) => o.value === currentTheme);
    const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
    dispatch(setTheme(THEME_OPTIONS[nextIndex].value));
    track('theme_change', { theme: THEME_OPTIONS[nextIndex].value });
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      AccessibilityUtils.stop();
      setIsSpeaking(false);
      return;
    }

    const text =
      AccessibilityUtils.getSelectionText() ||
      AccessibilityUtils.stripHtml(content);
    if (!text.trim()) {
      alert('请先输入或选中要朗读的内容');
      return;
    }

    setIsSpeaking(true);
    AccessibilityUtils.speak(text, () => {
      setIsSpeaking(false);
    });
    track('speak', { textLength: text.length });
  };

  // 查找下一个功能
  const handleFindNext = () => {
    if (!findText) return;
    const editor = document.querySelector('[role="textbox"]') as HTMLElement;
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection) return;

    let matches = findMatches;
    let currentIndex = findMatchIndex;

    // 如果 matches 为空，重新收集
    if (matches.length === 0) {
      const newMatches: {node: Node; start: number; end: number}[] = [];
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent || '';
        let idx = 0;
        while ((idx = text.indexOf(findText, idx)) !== -1) {
          newMatches.push({ node, start: idx, end: idx + findText.length });
          idx += findText.length;
        }
      }
      matches = newMatches;
      setFindMatches(newMatches);
      currentIndex = -1;
    }

    if (matches.length === 0) {
      alert('未找到匹配内容');
      setFindMatchIndex(-1);
      return;
    }

    const nextIndex = currentIndex >= matches.length - 1 ? 0 : currentIndex + 1;
    setFindMatchIndex(nextIndex);

    const match = matches[nextIndex];
    const range = document.createRange();
    range.setStart(match.node, match.start);
    range.setEnd(match.node, match.end);

    selection.removeAllRanges();
    selection.addRange(range);

    // 滚动到可视区域
    try {
      const rect = range.getBoundingClientRect();
      const editorEl = document.querySelector('[role="textbox"]') as HTMLElement;
      if (editorEl) {
        const scrollContainer = editorEl.parentElement;
        if (scrollContainer) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const relativeTop = rect.top - containerRect.top;
          if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
            scrollContainer.scrollTop += relativeTop - containerRect.height / 3;
          }
        }
      }
    } catch (e) { /* ignore */ }
  };

  // 查找文本变化时重置匹配
  useEffect(() => {
    setFindMatchIndex(-1);
    setFindMatches([]);
  }, [findText]);

  // 替换功能
  const handleReplace = () => {
    if (!findText) return;
    const editor = document.querySelector('[role="textbox"]') as HTMLElement;
    if (!editor) return;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (range.toString() === findText) {
        range.deleteContents();
        range.insertNode(document.createTextNode(replaceText));
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
        track('replace', { count: 1 });
        return;
      }
    }
    // 如果没有当前选中匹配项，先查找下一个再替换
    handleFindNext();
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (range.toString() === findText) {
          range.deleteContents();
          range.insertNode(document.createTextNode(replaceText));
          const ed = document.querySelector('[role="textbox"]') as HTMLElement;
          if (ed) ed.dispatchEvent(new InputEvent('input', { bubbles: true }));
          track('replace', { count: 1 });
        }
      }
    }, 10);
  };

  // 全部替换
  const handleReplaceAll = () => {
    if (!findText) return;
    const editor = document.querySelector('[role="textbox"]') as HTMLElement;
    if (!editor) return;
    
    const html = editor.innerHTML;
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const newHtml = html.replace(regex, replaceText);
    if (newHtml !== html) {
      editor.innerHTML = newHtml;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      const count = (html.match(new RegExp(escaped, 'g')) || []).length;
      track('replaceAll', { count });
    }
  };

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleSaveContent = (content: string) => {
    setSavedContent(content);
    try {
      localStorage.setItem('easyText_savedContent', content);
    } catch { /* ignore */ }
  };

  const handleCloseFindReplace = () => {
    setFindReplaceOpen(false);
    setFindMatchIndex(-1);
    setFindMatches([]);
  };

  // 字符上限对话框
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);

  const handleLimitExceeded = () => {
    setLimitDialogOpen(true);
  };

  const handleLimitClose = () => {
    setLimitDialogOpen(false);
  };

  const handleLimitExport = async () => {
    setLimitDialogOpen(false);
    // 导出为 TXT
    try {
      const { ExportService } = await import('./utils/ExportService');
      await ExportService.export('txt', content, fileName);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: '#f5f5f5',
      }}
    >
      {!previewMode && <Toolbar onSave={handleSaveContent} onPreview={() => setPreviewMode(true)} onOpenRecent={() => setRecentOpen(true)} />}

      <Box sx={{ flex: 1, position: 'relative', overflow: 'auto' }}>
        <TextEditor savedContent={savedContent} onLimitExceeded={handleLimitExceeded} previewMode={previewMode} />

        {/* 预览模式：点击屏幕任意位置直接退出 */}
        {previewMode && (
          <Box
            onClick={() => setPreviewMode(false)}
            onTouchStart={() => setPreviewMode(false)}
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              cursor: 'pointer',
            }}
          />
        )}

        {/* 右下角竖排圆形图标按钮 - 非预览模式 */}
        {!previewMode && (
        <Box
          data-float-group
          sx={{
            position: 'fixed',
            right: isMobile ? 8 : 16,
            bottom: isMobile ? 48 : 80,
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 2 : 2.5,
            zIndex: 10,
          }}
        >
          {floatExpanded && (
            <>
              <Tooltip title={`字号: ${FONT_SIZE_LABELS[fontSizeLevel]}`} placement="left">
                <IconButton
                  onClick={() => handleFloatAction(handleFontSizeCycle)}
                  sx={{
                    width: isMobile ? 52 : 60,
                    height: isMobile ? 52 : 60,
                    bgcolor: '#ffffff',
                    color: '#616161',
                    border: '1px solid #bdbdbd',
                    borderRadius: '50%',
                    fontSize: '1.6rem',
                    fontWeight: 'bold',
                    '&:hover': { bgcolor: '#f5f5f5', borderColor: '#616161' },
                  }}
                >
                  A
                </IconButton>
              </Tooltip>

              <Tooltip title={`主题: ${THEME_OPTIONS.find((o) => o.value === currentTheme)?.label}`} placement="left">
                <IconButton
                  onClick={() => handleFloatAction(handleThemeCycle)}
                  sx={{
                    width: isMobile ? 52 : 60,
                    height: isMobile ? 52 : 60,
                    bgcolor: '#ffffff',
                    color: '#616161',
                    border: '1px solid #bdbdbd',
                    borderRadius: '50%',
                    '&:hover': { bgcolor: '#f5f5f5', borderColor: '#616161' },
                  }}
                >
                  <InvertColors sx={{ fontSize: isMobile ? 28 : 32 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title={isSpeaking ? '停止' : '朗读'} placement="left">
                <IconButton
                  onClick={() => handleFloatAction(handleSpeak)}
                  sx={{
                    width: isMobile ? 52 : 60,
                    height: isMobile ? 52 : 60,
                    bgcolor: isSpeaking ? '#424242' : '#616161',
                    color: '#ffffff',
                    borderRadius: '50%',
                    '&:hover': { bgcolor: isSpeaking ? '#333333' : '#505050' },
                  }}
                >
                  {isSpeaking ? (
                    <Stop sx={{ fontSize: isMobile ? 28 : 32 }} />
                  ) : (
                    <RecordVoiceOver sx={{ fontSize: isMobile ? 28 : 32 }} />
                  )}
                </IconButton>
              </Tooltip>

              <Tooltip title="查找替换" placement="left">
                <IconButton
                  onClick={() => handleFloatAction(() => setFindReplaceOpen(true))}
                  sx={{
                    width: isMobile ? 52 : 60,
                    height: isMobile ? 52 : 60,
                    bgcolor: '#ffffff',
                    color: '#616161',
                    border: '1px solid #bdbdbd',
                    borderRadius: '50%',
                    '&:hover': { bgcolor: '#f5f5f5', borderColor: '#616161' },
                  }}
                >
                  <Search sx={{ fontSize: isMobile ? 28 : 32 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="帮助" placement="left">
                <IconButton
                  onClick={() => handleFloatAction(() => setGuideOpen(true))}
                  sx={{
                    width: isMobile ? 52 : 60,
                    height: isMobile ? 52 : 60,
                    bgcolor: '#ffffff',
                    color: '#616161',
                    border: '1px solid #bdbdbd',
                    borderRadius: '50%',
                    '&:hover': { bgcolor: '#f5f5f5', borderColor: '#616161' },
                  }}
                >
                  <HelpOutline sx={{ fontSize: isMobile ? 28 : 32 }} />
                </IconButton>
              </Tooltip>
            </>
          )}

          <Tooltip title={floatExpanded ? '收起' : '展开'} placement="left">
            <IconButton
              onClick={toggleFloat}
              sx={{
                width: isMobile ? 56 : 64,
                height: isMobile ? 56 : 64,
                bgcolor: '#616161',
                color: '#ffffff',
                borderRadius: '50%',
                '&:hover': { bgcolor: '#505050' },
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              {floatExpanded ? (
                <ExpandLess sx={{ fontSize: isMobile ? 30 : 34 }} />
              ) : (
                <ExpandMore sx={{ fontSize: isMobile ? 30 : 34 }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
        )}
      </Box>

      <BackupManagerDialog
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        onRestore={handleRestore}
      />

      <RecentDocumentsDialog
        open={recentOpen}
        onClose={() => setRecentOpen(false)}
        documents={recentDocuments}
        onOpen={handleOpenRecent}
        onDelete={(fileName) => {
          dispatch(removeRecentDocument(fileName));
        }}
      />

      {/* 未保存确认弹窗 */}
      <Dialog open={confirmOpen} onClose={cancelOpenRecent} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          当前文档未保存
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '1.15rem', lineHeight: 1.8 }}>
            您当前编辑的文档还未保存，打开其他文档将丢失当前内容。是否继续？
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={cancelOpenRecent}
            variant="outlined"
            size="large"
            fullWidth
            sx={{ fontSize: '1.05rem', minHeight: 48 }}
          >
            取消
          </Button>
          <Button
            onClick={confirmOpenRecent}
            variant="contained"
            size="large"
            fullWidth
            sx={{ fontSize: '1.05rem', minHeight: 48, bgcolor: '#616161', '&:hover': { bgcolor: '#505050' } }}
          >
            继续打开
          </Button>
        </DialogActions>
      </Dialog>

      {/* 使用指南 */}
      <Dialog open={guideOpen} onClose={() => setGuideOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          使用指南
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 'bold', mb: 1 }}>
            基本操作
          </Typography>
          <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.8, mb: 2 }}>
            • 新建：创建新文档<br />
            • 导入：从文件导入内容（支持TXT、DOC、DOCX、HTML）<br />
            • 备份：手动创建备份，每10秒自动备份一次<br />
            • 导出：导出为TXT、PDF、DOC、DOCX格式
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 'bold', mb: 1 }}>
            导入说明
          </Typography>
          <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.8, mb: 2 }}>
            • 导入Word文档（DOC/DOCX）时，仅提取纯文字内容<br />
            • 格式、排版、颜色、图片等非文字内容不予保留<br />
            • 建议复杂文档先用Word另存为纯文本(.txt)再导入<br />
            • 部分特殊格式的DOC文件可能无法识别，建议用Word转换后重试
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 'bold', mb: 1 }}>
            字体调节
          </Typography>
          <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.8, mb: 2 }}>
            • 点击 A：自动改变大小<br />
            • 共5档字体大小，适合40岁到80岁用户
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 'bold', mb: 1 }}>
            撤销与重做
          </Typography>
          <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.8, mb: 2 }}>
            • 点击↶撤销刚才的操作，点击↷重做<br />
            • 支持误删恢复、格式还原
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 'bold', mb: 1 }}>
            查找与替换
          </Typography>
          <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.8, mb: 2 }}>
            • 点击搜索图标：打开查找替换面板<br />
            • 支持查找下一个、单个替换、全部替换
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 'bold', mb: 1 }}>
            字数与汉字统计
          </Typography>
          <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.8, mb: 2 }}>
            • 编辑区底部实时显示字符数和汉字数<br />
            • 绿色圆点表示已保存，红色表示未保存
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 'bold', mb: 1 }}>
            字符上限提示
          </Typography>
          <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.8, mb: 2 }}>
            • 文档上限 100,000 字符，超过后自动阻止输入<br />
            • 到达上限时会弹出提示，建议导出保存
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 'bold', mb: 1 }}>
            主题切换
          </Typography>
          <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.8, mb: 2 }}>
            • 默认模式：白底黑字，明亮清晰<br />
            • 夜间模式：深色背景，保护眼睛<br />
            • 护眼模式：绿色背景，缓解疲劳
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 'bold', mb: 1 }}>
            语音朗读
          </Typography>
          <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.8, mb: 2 }}>
            • 点击喇叭图标开始/停止朗读<br />
            • 使用浏览器内置语音引擎
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontSize: '1rem', color: '#616161', textAlign: 'center' }}>
            作者：Rymond W | 许可证：MIT License
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setGuideOpen(false)}
            variant="contained"
            size="large"
            fullWidth
            sx={{ fontSize: '1.1rem', minHeight: 52, bgcolor: '#616161', '&:hover': { bgcolor: '#505050' } }}
          >
            我知道了
          </Button>
        </DialogActions>
      </Dialog>

      {/* 查找替换对话框 */}
      <Dialog open={findReplaceOpen} onClose={handleCloseFindReplace} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
          查找与替换
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="查找内容"
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            inputProps={{ style: { fontSize: '1.1rem' } }}
          />
          <TextField
            fullWidth
            label="替换为"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            sx={{ mb: 1 }}
            inputProps={{ style: { fontSize: '1.1rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button
            onClick={handleFindNext}
            variant="contained"
            size="large"
            sx={{ fontSize: '1.05rem', minHeight: 44, bgcolor: '#616161', '&:hover': { bgcolor: '#505050' } }}
          >
            查找下一个
          </Button>
          <Button
            onClick={handleReplace}
            variant="contained"
            size="large"
            sx={{ fontSize: '1.05rem', minHeight: 44, bgcolor: '#616161', '&:hover': { bgcolor: '#505050' } }}
          >
            替换
          </Button>
          <Button
            onClick={handleReplaceAll}
            variant="outlined"
            size="large"
            sx={{ fontSize: '1.05rem', minHeight: 44, color: '#616161', borderColor: '#bdbdbd', '&:hover': { borderColor: '#616161' } }}
          >
            全部替换
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            onClick={handleCloseFindReplace}
            size="large"
            sx={{ fontSize: '1.05rem', color: '#616161' }}
          >
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      {/* 导出提醒对话框 */}
      <Dialog open={exportReminderOpen} onClose={() => setExportReminderOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          导出提醒
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '1.1rem', lineHeight: 1.8 }}>
            您已经超过24小时没有导出文档了。为了防止数据丢失，建议立即导出保存您的文档。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setExportReminderOpen(false)}
            variant="contained"
            size="large"
            fullWidth
            sx={{ fontSize: '1.1rem', minHeight: 52, bgcolor: '#616161', '&:hover': { bgcolor: '#505050' } }}
          >
            我知道了
          </Button>
        </DialogActions>
      </Dialog>

      {/* 字符上限提示对话框 */}
      <Dialog open={limitDialogOpen} onClose={handleLimitClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          字符上限提醒
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '1.1rem', lineHeight: 1.8 }}>
            已达到 100,000 字符上限，无法继续输入。请先导出保存当前内容，以免数据丢失。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleLimitExport}
            variant="contained"
            size="large"
            sx={{ fontSize: '1.05rem', minHeight: 48, bgcolor: '#616161', '&:hover': { bgcolor: '#505050' } }}
          >
            导出保存
          </Button>
          <Button
            onClick={handleLimitClose}
            variant="outlined"
            size="large"
            sx={{ fontSize: '1.05rem', minHeight: 48, color: '#616161', borderColor: '#bdbdbd', '&:hover': { borderColor: '#616161' } }}
          >
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      {/* 全局成功提示 */}
    </Box>
  );
};

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
