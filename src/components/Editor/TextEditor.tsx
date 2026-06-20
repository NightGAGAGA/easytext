import React, { useRef, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, setContent } from '../../store/store';
import { AccessibilityUtils } from '../../accessibility/AccessibilityUtils';

const FONT_SIZE_MAP = [20, 24, 28, 32, 36];
const CHAR_LIMIT = 100000;

interface TextEditorProps {
  savedContent?: string;
  onLimitExceeded?: () => void;
}

export const TextEditor: React.FC<TextEditorProps> = ({ savedContent = '', onLimitExceeded }) => {
  const dispatch = useDispatch();
  const { content, fontSizeLevel, theme } = useSelector(
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

  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      isUpdatingRef.current = true;
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content;
      }
      isUpdatingRef.current = false;
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

  const handleInput = useCallback(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      const plainText = editorRef.current.innerHTML.replace(/<[^>]+>/g, '');
      if (plainText.length > CHAR_LIMIT) {
        // 恢复之前的内容，阻止写入
        editorRef.current.innerHTML = content;
        onLimitExceeded?.();
        return;
      }
      dispatch(setContent(editorRef.current.innerHTML));
    }
  }, [dispatch, content, onLimitExceeded]);

  const getThemeStyles = () => {
    switch (theme) {
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
        p: 2,
        pl: 2,
        pr: 5,
        backgroundColor: themeStyles.backgroundColor,
      }}
    >
      <Box
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        aria-label="文字编辑区域"
        role="textbox"
        aria-multiline="true"
        sx={{
          minHeight: '65vh',
          maxHeight: '100%',
          overflow: 'auto',
          maxWidth: 1200,
          mx: 'auto',
          p: 3,
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
            borderColor: '#616161',
            boxShadow: '0 0 0 3px rgba(97, 97, 97, 0.2)',
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
    </Box>
  );
};
