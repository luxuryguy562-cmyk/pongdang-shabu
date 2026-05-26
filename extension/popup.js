// popup.js — 확장 아이콘 클릭 시 셋업 화면

async function init() {
  const cfg = await chrome.storage.sync.get(['workersUrl', 'secret', 'storeId', 'autoSync']);
  document.getElementById('workersUrl').value = cfg.workersUrl || '';
  document.getElementById('secret').value = cfg.secret || '';
  document.getElementById('storeId').value = cfg.storeId || '';
  document.getElementById('autoSync').checked = cfg.autoSync !== false;

  const local = await chrome.storage.local.get(['lastSync', 'lastResult', 'lastError']);
  renderStatus(local);
}

function renderStatus({ lastSync, lastResult, lastError }) {
  const el = document.getElementById('status');
  if (!lastSync) { el.textContent = '아직 동기화 안 됨. 쿠팡 주문내역 페이지를 열어주세요.'; return; }
  const ago = Math.round((Date.now() - lastSync) / 60000);
  if (lastError) {
    el.innerHTML = `<span class="err">❌ ${ago}분 전 실패: ${escape(lastError)}</span>`;
    return;
  }
  if (lastResult) {
    el.innerHTML = `<span class="ok">✅ ${ago}분 전 — 새로 ${lastResult.inserted || 0}건, 건너뜀 ${lastResult.skipped || 0}건</span>`;
  }
}

document.getElementById('save').addEventListener('click', async () => {
  const cfg = {
    workersUrl: document.getElementById('workersUrl').value.trim().replace(/\/$/, ''),
    secret: document.getElementById('secret').value.trim(),
    storeId: document.getElementById('storeId').value.trim(),
    autoSync: document.getElementById('autoSync').checked,
  };
  await chrome.storage.sync.set(cfg);
  document.getElementById('status').textContent = '저장됨. 쿠팡 페이지 새로고침해주세요.';
});

document.getElementById('syncNow').addEventListener('click', async () => {
  const cfg = await chrome.storage.sync.get(['workersUrl', 'secret', 'storeId']);
  if (!cfg.workersUrl || !cfg.secret || !cfg.storeId) {
    document.getElementById('status').innerHTML = '<span class="err">먼저 설정 저장하세요</span>';
    return;
  }
  // 쿠팡 탭에 메시지
  const tabs = await chrome.tabs.query({ url: ['https://mc.coupang.com/ssr/desktop/order/list*', 'https://www.coupang.com/np/mypage/orderlist*'] });
  if (tabs.length === 0) {
    document.getElementById('status').innerHTML = '<span class="err">쿠팡 주문내역 페이지를 먼저 여세요</span>';
    return;
  }
  document.getElementById('status').textContent = '동기화 중...';
  const result = await chrome.tabs.sendMessage(tabs[0].id, { action: 'syncNow', config: cfg }).catch(e => ({ ok: false, error: e.message }));
  if (result?.ok) {
    document.getElementById('status').innerHTML = `<span class="ok">✅ 새로 ${result.result.inserted}건 / 건너뜀 ${result.result.skipped}건</span>`;
  } else {
    document.getElementById('status').innerHTML = `<span class="err">❌ ${escape(result?.error || '실패')}</span>`;
  }
});

function escape(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

init();
