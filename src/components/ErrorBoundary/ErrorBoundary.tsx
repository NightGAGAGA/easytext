import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('应用错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: 20,
            backgroundColor: '#f5f5f5',
            color: '#333',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
          }}
        >
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>页面出现了错误</h2>
          <p style={{ fontSize: '1.1rem', marginBottom: 24 }}>
            请刷新页面重试，或点击下方按钮恢复
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 32px',
              fontSize: '1.1rem',
              borderRadius: 4,
              border: 'none',
              backgroundColor: '#616161',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
