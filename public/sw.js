const CACHE_NAME = 'easytext-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/vite.svg'
];

// 安装：缓存核心文件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 缓存核心文件');
      return cache.addAll(URLS_TO_CACHE);
    }).catch((err) => {
      console.error('[SW] 缓存失败:', err);
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 拦截请求：优先网络，失败回退缓存
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 跳过非 GET 请求和 chrome-extension 请求
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // 网络请求成功，更新缓存
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // 网络失败，尝试从缓存读取
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] 从缓存返回:', request.url);
            return cachedResponse;
          }
          // 如果缓存也没有，返回 index.html（SPA 回退）
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('离线模式：该资源未缓存', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});
