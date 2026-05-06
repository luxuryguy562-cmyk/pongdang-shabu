// 캐쉬플로우 Service Worker
// 전략: 네트워크 우선 + 폴백 캐시 (앱은 매번 최신, 인터넷 끊겨도 마지막 화면 보임)

const CACHE_VERSION = 'cashflow-v1-2026-05-06';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png'
];

// 설치 시: 앱 셸 미리 캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// 활성화 시: 옛 버전 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// fetch 가로채기: 네트워크 우선, 실패 시 캐시
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // GET 외, 외부 도메인(Supabase·CDN)은 패스 — 우리 앱 셸만 캐시
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // 성공: 캐시에 사본 저장 후 반환
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
