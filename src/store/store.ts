import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface RecentDocument {
  fileName: string;
  content: string;
  timestamp: number;
}

export interface EditorState {
  content: string;
  fileName: string;
  fontSizeLevel: number;
  theme: 'default' | 'dark' | 'eye-care';
  hasVisited: boolean;
  recentDocuments: RecentDocument[];
}

const loadRecentDocs = (): RecentDocument[] => {
  try {
    const raw = localStorage.getItem('easyText_recentDocs');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

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
      recentDocuments: loadRecentDocs(),
    };
  } catch {
    return {
      content: '',
      fileName: '未命名文档',
      fontSizeLevel: 2,
      theme: 'default',
      hasVisited: false,
      recentDocuments: loadRecentDocs(),
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
    addRecentDocument: (state, action: PayloadAction<{ fileName: string; content: string }>) => {
      const { fileName, content } = action.payload;
      const filtered = state.recentDocuments.filter((d) => d.fileName !== fileName);
      filtered.unshift({ fileName, content, timestamp: Date.now() });
      state.recentDocuments = filtered.slice(0, 5);
    },
    removeRecentDocument: (state, action: PayloadAction<string>) => {
      state.recentDocuments = state.recentDocuments.filter(
        (d) => d.fileName !== action.payload
      );
    },
    setRecentDocuments: (state, action: PayloadAction<RecentDocument[]>) => {
      state.recentDocuments = action.payload;
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
  addRecentDocument,
  removeRecentDocument,
  setRecentDocuments,
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
let previousRecentDocs = initialState.recentDocuments;

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
  if (state.recentDocuments !== previousRecentDocs) {
    localStorage.setItem('easyText_recentDocs', JSON.stringify(state.recentDocuments));
    previousRecentDocs = state.recentDocuments;
  }
});
