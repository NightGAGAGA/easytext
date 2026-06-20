import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface EditorState {
  content: string;
  fileName: string;
  fontSizeLevel: number;
  theme: 'default' | 'dark' | 'eye-care';
  hasVisited: boolean;
}

const loadInitialState = (): EditorState => {
  try {
    const content = localStorage.getItem('seniorTextEditorContent') || '';
    const fileName = localStorage.getItem('seniorTextEditorFileName') || '未命名文档';
    const savedTheme = localStorage.getItem('seniorTextEditorTheme') as EditorState['theme'] | null;
    const hasVisited = localStorage.getItem('easyText_hasVisited') === 'true';

    return {
      content,
      fileName,
      fontSizeLevel: 2,
      theme: savedTheme || 'default',
      hasVisited,
    };
  } catch {
    return {
      content: '',
      fileName: '未命名文档',
      fontSizeLevel: 2,
      theme: 'default',
      hasVisited: false,
    };
  }
};

const initialState: EditorState = loadInitialState();

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setContent: (state, action: PayloadAction<string>) => {
      state.content = action.payload;
    },
    setFileName: (state, action: PayloadAction<string>) => {
      state.fileName = action.payload;
    },
    setFontSizeLevel: (state, action: PayloadAction<number>) => {
      state.fontSizeLevel = action.payload;
    },
    setTheme: (state, action: PayloadAction<EditorState['theme']>) => {
      state.theme = action.payload;
    },
    markVisited: (state) => {
      state.hasVisited = true;
    },
    resetDocument: (state) => {
      state.content = '';
      state.fileName = '未命名文档';
    },
  },
});

export const {
  setContent,
  setFileName,
  setFontSizeLevel,
  setTheme,
  markVisited,
  resetDocument,
} = editorSlice.actions;

export const store = configureStore({
  reducer: {
    editor: editorSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

let previousContent = initialState.content;
let previousFileName = initialState.fileName;

store.subscribe(() => {
  const state = store.getState().editor;
  if (state.content !== previousContent) {
    localStorage.setItem('seniorTextEditorContent', state.content);
    previousContent = state.content;
  }
  if (state.fileName !== previousFileName) {
    localStorage.setItem('seniorTextEditorFileName', state.fileName);
    previousFileName = state.fileName;
  }
  localStorage.setItem('seniorTextEditorTheme', state.theme);
});
