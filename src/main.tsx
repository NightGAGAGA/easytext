import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 全局错误捕获
window.onerror = function(msg, _url, line, col, _error) {
  const message = 'Error: ' + msg + ' at line ' + line + ':' + col;
  console.error(message);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<div style="padding:20px;color:#fff;background:#424242;font-size:18px;line-height:1.8">' +
      '应用加载遇到问题。<br>请尝试刷新或重启应用。<br><br>错误：' + msg + '</div>';
  }
  return true;
};

window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
