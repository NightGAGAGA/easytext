import React, { useRef, useEffect, useCallback } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, setContent } from '../../store/store';
import { AccessibilityUtils } from '../../accessibility/AccessibilityUtils';

const FONT_SIZE_MAP = [20, 24, 28, 32, 36];
const CHAR_LIMIT = 100000;

interface TextEditorProps {
  savedContent?: string;
  onLimitExceeded?: () => void;
  previewMode?: boolean;
}

export const TextEditor: React.FC<TextEditorProps> = ({ savedContent = '', onLimitExceeded, previewMode = false }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { content, fontSizeLevel, theme: currentTheme } = useSelector(
    (state: RootState) => state.editor
  );
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);

  const fontSize = FONT_SIZE_MAP[Math.max(0, Math.min(FONT_SIZE_MAP.length - 1, fontSizeLevel))];

  // 字数统计（去掉 HTML 标签）
  const plainText = content.replace(/<[^>]+>/g, '');
  const wordCount = plainText.length;
  const chineseCount = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length;
  const isSaved = content === savedContent;

  // 保存光标位置（字符偏移量）
  const saveCursor = (element: HTMLElement): number => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  };

  // 恢复光标位置（字符偏移量）
  const restoreCursor = (element: HTMLElement, offset: number) => {
    const selection = window.getSelection();
    const range = document.createRange();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    let currentOffset = 0;
    let node;
    while ((node = walker.nextNode())) {
      const textLength = node.textContent?.length || 0;
      if (currentOffset + textLength >= offset) {
        const pos = Math.min(offset - currentOffset, textLength);
        range.setStart(node, pos);
        range.setEnd(node, pos);
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }
      currentOffset += textLength;
    }
    // 如果找不到位置，设置到最后
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      const currentHTML = editorRef.current.innerHTML;
      if (currentHTML !== content) {
        const cursorOffset = saveCursor(editorRef.current);
        editorRef.current.innerHTML = content;
        restoreCursor(editorRef.current, cursorOffset);
      }
    }
  }, [content]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (content !== (editorRef.current?.innerHTML || '')) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [content]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey) {
        if (e.key === 'R' || e.key === 'r') {
          e.preventDefault();
          const text =
            AccessibilityUtils.getSelectionText() ||
            AccessibilityUtils.stripHtml(editorRef.current?.innerHTML || '');
          AccessibilityUtils.speak(text);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTouchStart = useCallback((_e: React.TouchEvent) => {
    if (previewMode) return;
    const touchStartTime = Date.now();

    const handleTouchEnd = () => {
      const touchDuration = Date.now() - touchStartTime;
      const selection = window.getSelection();
      const hasSelection = selection && selection.toString().length > 0;

      if (touchDuration < 300 && hasSelection) {
        // 短点击（<300ms）且有选择 → 清除选择并失焦
        selection.removeAllRanges();
        if (editorRef.current) {
          editorRef.current.blur();
        }
      } else if (touchDuration >= 300 && hasSelection) {
        // 长按（>300ms）且形成了选择 → 隐藏键盘但不清除选择
        // Android 系统长按会自动 focus 编辑器并弹出键盘，这里隐藏键盘
        if (editorRef.current) {
          editorRef.current.blur();
        }
      }

      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);
  }, [previewMode]);

  const handleInput = useCallback(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      const plainText = editorRef.current.innerHTML.replace(/<[^>]+>/g, '');
      if (plainText.length > CHAR_LIMIT) {
        editorRef.current.innerHTML = content;
        onLimitExceeded?.();
        return;
      }
      isUpdatingRef.current = true;
      dispatch(setContent(editorRef.current.innerHTML));
      // 延迟解锁，确保 useEffect 不会重设 innerHTML
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);
    }
  }, [dispatch, content, onLimitExceeded]);

  // 用 MutationObserver 监听 DOM 变化（Android 6.0 WebView 中 onInput 不触发）
  useEffect(() => {
    if (!editorRef.current || previewMode) return;

    const editor = editorRef.current;
    const observer = new MutationObserver(() => {
      if (!isUpdatingRef.current && editorRef.current) {
        const currentHTML = editorRef.current.innerHTML;
        if (currentHTML !== content) {
          dispatch(setContent(currentHTML));
        }
      }
    });

    observer.observe(editor, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [content, previewMode, dispatch]);

  // 用 setInterval 轮询作为最后保障（每 500ms 检查一次内容）
  useEffect(() => {
    if (previewMode) return;
    const interval = setInterval(() => {
      if (editorRef.current && !isUpdatingRef.current) {
        const currentHTML = editorRef.current.innerHTML;
        if (currentHTML !== content) {
          dispatch(setContent(currentHTML));
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [content, previewMode, dispatch]);

  const getThemeStyles = () => {
    switch (currentTheme) {
      case 'dark':
        return {
          backgroundColor: '#212121',
          color: '#f5f5f5',
          borderColor: '#424242',
          statusBg: '#333333',
          statusColor: '#a0a0a0',
          savedColor: '#7cb87c',
          unsavedColor: '#e57373',
        };
      case 'eye-care':
        return {
          backgroundColor: '#B4DCB9',
          color: '#2E5A2E',
          borderColor: '#8FBF8F',
          statusBg: '#9BCBA0',
          statusColor: '#1a4a1a',
          savedColor: '#1a4a1a',
          unsavedColor: '#c62828',
        };
      default:
        return {
          backgroundColor: '#ffffff',
          color: '#212121',
          borderColor: '#bdbdbd',
          statusBg: '#f5f5f5',
          statusColor: '#616161',
          savedColor: '#4a7c4a',
          unsavedColor: '#c62828',
        };
    }
  };

  const themeStyles = getThemeStyles();

  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'auto',
        p: isMobile ? 1 : 2,
        pl: isMobile ? 1 : 2,
        pr: isMobile ? 2 : 5,
        backgroundColor: themeStyles.backgroundColor,
      }}
    >
      <Box
        ref={editorRef}
        contentEditable={!previewMode}
        suppressContentEditableWarning
        onInput={previewMode ? undefined : handleInput}
        onKeyUp={previewMode ? undefined : handleInput}
        onBlur={previewMode ? undefined : handleInput}
        onTouchStart={previewMode ? undefined : handleTouchStart}
        aria-label="文字编辑区域"
        role="textbox"
        aria-multiline="true"
        sx={{
          minHeight: previewMode ? (isMobile ? '90vh' : '88vh') : (isMobile ? '72vh' : '65vh'),
          maxHeight: '100%',
          overflow: 'auto',
          maxWidth: 1200,
          mx: 'auto',
          p: isMobile ? 3 : 3,
          fontSize,
          lineHeight: 1.8,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', sans-serif",
          backgroundColor: themeStyles.backgroundColor,
          color: themeStyles.color,
          border: `2px solid ${themeStyles.borderColor}`,
          borderRadius: 2,
          outline: 'none',
          '&:focus': {
            outline: 'none',
            boxShadow: 'none',
            borderColor: themeStyles.borderColor,
          },
          '& p': {
            margin: '0 0 1em 0',
          },
          '& b, & strong': {
            fontWeight: 'bold',
          },
          '& i, & em': {
            fontStyle: 'italic',
          },
          '& u': {
            textDecoration: 'underline',
          },
        }}
      />
      {/* 底部状态栏：字数统计 + 保存状态 */}
      <Box
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          mt: 1,
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: themeStyles.statusBg,
          color: themeStyles.statusColor,
          borderRadius: 1,
          fontSize: '0.9rem',
          border: `1px solid ${themeStyles.borderColor}`,
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.9rem', color: themeStyles.statusColor }}>
            {wordCount} 字符
          </Typography>
          <Typography sx={{ fontSize: '0.9rem', color: themeStyles.statusColor }}>
            {chineseCount} 汉字
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: '0.9rem',
            color: isSaved ? themeStyles.savedColor : themeStyles.unsavedColor,
            fontWeight: 'bold',
          }}
        >
          {isSaved ? '● 已保存' : '● 未保存'}
        </Typography>
      </Box>

      {/* 版权信息 */}
      <Box
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          mt: 1,
          px: 2,
          py: 1,
          textAlign: 'center',
          color: themeStyles.statusColor,
          fontSize: '0.85rem',
        }}
      >
        <Typography sx={{ fontSize: '0.85rem', color: themeStyles.statusColor }}>
          © 2026 Rymond W | EasyText v1.0
        </Typography>
      </Box>
    </Box>
  );
};
