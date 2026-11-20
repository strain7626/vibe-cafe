// ============================================
// ☕ 바이브 카페 - 두뇌(기능) 파일
// ============================================

// ----- Supabase 연결 정보 (Project Settings → API 에서 복사) -----
// ⚠️ Publishable(anon) 키만 넣기! service_role/secret 키는 절대 금지
const SUPABASE_URL = '여기에_Project_URL';
const SUPABASE_KEY = '여기에_Publishable_또는_anon_키';
const TABLE_NAME = 'cafe_menu03';

// supabase-js(CDN)가 만들어 둔 window.supabase로 클라이언트(창고 출입증) 만들기
// 키를 아직 안 넣었으면 null (잘못된 주소로 만들면 에러가 나서 앱 전체가 멈춤)
const supabaseClient = SUPABASE_URL.startsWith('https://')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ----- 1. 화면 요소 가져오기 (바리스타가 도구 집기) -----
const form = document.getElementById('orderForm');
const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const drinkSelect = document.getElementById('drink');
const quantityInput = document.getElementById('quantity');
const requestInput = document.getElementById('request');
const totalPrice = document.getElementById('totalPrice');
const orderBtn = document.getElementById('orderBtn');
const confirmMessage = document.getElementById('confirmMessage');
const orderBadge = document.getElementById('orderBadge');
const orderList = document.getElementById('orderList');
const emptyMessage = document.getElementById('emptyMessage');
const historyFooter = document.getElementById('historyFooter');
const historyTotal = document.getElementById('historyTotal');
const clearBtn = document.getElementById('clearBtn');

// 주문 장부(배열). localStorage에 남겨서 새로고침해도 유지 (단, 내 브라우저에만!)
let orders = [];
try { orders = JSON.parse(localStorage.getItem('vibeOrders')) || []; } catch (e) { orders = []; }
let nextId = orders.reduce((max, o) => Math.max(max, o.id), 0) + 1;

function saveLocal() {
  try { localStorage.setItem('vibeOrders', JSON.stringify(orders)); } catch (e) { /* 저장 못 해도 앱은 계속 동작 */ }
}

// ----- 2. 금액 계산 레시피 (함수 하나로 재사용) -----
// 예상 금액 = (음료 가격 + 사이즈 추가금 + 옵션 추가금 합계) × 수량
function calculateTotal() {
  const drinkOption = drinkSelect.options[drinkSelect.selectedIndex];
  const drinkPrice = Number(drinkOption.dataset.price); // data-price는 글자라서 숫자로 바꿈

  // 음료를 안 골랐으면 0원
  if (drinkSelect.value === '') return 0;

  const sizeInput = document.querySelector('input[name="size"]:checked');
  const sizePrice = sizeInput ? Number(sizeInput.dataset.price) : 0;

  // 체크된 옵션들만 모두 찾아서 가격 더하기
  let optionPrice = 0;
  document.querySelectorAll('input[name="option"]:checked').forEach((opt) => {
    optionPrice += Number(opt.dataset.price);
  });

  // 수량은 1~10 사이로 고정
  let quantity = Number(quantityInput.value) || 1;
  quantity = Math.min(10, Math.max(1, quantity));

  return (drinkPrice + sizePrice + optionPrice) * quantity;
}

// 계산 결과를 화면에 표시 (천 단위 콤마)
function updateTotal() {
  totalPrice.textContent = `예상 금액: ${calculateTotal().toLocaleString()}원`;
}

// 값이 바뀔 때마다 다시 계산 (change: 선택 변경 / input: 숫자 타이핑 즉시)
form.addEventListener('change', updateTotal);
form.addEventListener('input', updateTotal);

// ----- 3. 주문하기 -----
form.addEventListener('submit', async (event) => {
  event.preventDefault(); // 페이지 새로고침 막기

  const name = nameInput.value.trim();
  if (name === '') {
    alert('이름을 입력해주세요');
    nameInput.focus();
    return;
  }
  if (drinkSelect.value === '') {
    alert('음료를 선택해주세요');
    drinkSelect.focus();
    return;
  }

  const drink = drinkSelect.value;
  const drinkPrice = Number(drinkSelect.options[drinkSelect.selectedIndex].dataset.price);
  const size = document.querySelector('input[name="size"]:checked').value;
  const options = Array.from(document.querySelectorAll('input[name="option"]:checked')).map((o) => o.value);
  const quantity = Math.min(10, Math.max(1, Number(quantityInput.value) || 1));
  const request = requestInput.value.trim();
  const total = calculateTotal();

  if (!supabaseClient) {
    alert('주문 저장에 실패했어요');
    console.error('script.js 맨 위에 SUPABASE_URL과 SUPABASE_KEY를 넣어주세요.');
    return;
  }

  // 저장하는 동안 버튼 잠그기 (두 번 눌림 방지)
  orderBtn.disabled = true;
  orderBtn.textContent = '저장 중...';

  // Supabase 창고에 주문 1줄 넣기 (RLS가 insert만 허용하므로 select는 하지 않음)
  const { error } = await supabaseClient.from(TABLE_NAME).insert({
    customer_name: name,
    phone: phoneInput.value.trim() || null,
    drink: drink,
    drink_price: drinkPrice,
    size: size,
    options: options,
    quantity: quantity,
    request: request || null,
    total_price: total,
  });

  orderBtn.disabled = false;
  orderBtn.textContent = '주문하기';

  if (error) {
    console.error('Supabase 저장 에러:', error);
    alert('주문 저장에 실패했어요');
    return;
  }

  // 주문 확인 메시지 (옵션이 없으면 괄호 생략)
  const optionText = options.length > 0 ? ` (${options.join(', ')})` : '';
  const summary = `${drink} ${size}사이즈${optionText} ${quantity}잔`;
  confirmMessage.textContent = `${name}님, ${summary}, 총 ${total.toLocaleString()}원 주문이 접수되었습니다!`;
  confirmMessage.classList.remove('hidden');

  // 주문 장부에 추가 → 목록 다시 그리기
  orders.push({
    id: nextId++,
    name, drink, size, options, quantity, request, total,
    time: new Date().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }),
  });
  saveLocal();
  renderOrders();

  // 배지 통통 애니메이션
  orderBadge.classList.remove('bounce');
  void orderBadge.offsetWidth; // 애니메이션 다시 시작시키는 요령
  orderBadge.classList.add('bounce');
});

// ----- 4. 다시 작성 (주문서만 초기화, 주문 내역은 유지) -----
form.addEventListener('reset', () => {
  // reset 이벤트 직후에 기본값(M, 수량 1)으로 돌아가므로 다음 순간에 금액 갱신
  setTimeout(() => {
    updateTotal();
    confirmMessage.classList.add('hidden');
    confirmMessage.textContent = '';
  }, 0);
});

// ----- 5. 탭 전환: 하나는 보이고 나머지는 hidden -----
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t === tab);
      document.getElementById(t.dataset.tab).classList.toggle('hidden', t !== tab);
    });
  });
});

// ----- 6. 주문 내역 그리기: 매번 싹 지우고 처음부터 다시 -----
// 손님이 입력한 글자는 항상 textContent로 (innerHTML은 XSS 위험!)
function renderOrders() {
  orderList.replaceChildren(); // 기존 목록 지우기
  orderBadge.textContent = orders.length;

  const isEmpty = orders.length === 0;
  emptyMessage.classList.toggle('hidden', !isEmpty);
  historyFooter.classList.toggle('hidden', isEmpty);

  // 최신 주문이 맨 위로 (원본은 건드리지 않게 복사 후 뒤집기)
  [...orders].reverse().forEach((order) => {
    const li = document.createElement('li');
    li.className = 'order-card';

    const title = document.createElement('p');
    title.className = 'order-title';
    title.textContent = `#${order.id} ${order.name}님 · ${order.total.toLocaleString()}원`;

    const detail = document.createElement('p');
    const optionText = order.options.length > 0 ? ` (${order.options.join(', ')})` : '';
    detail.textContent = `${order.drink} ${order.size}사이즈${optionText} ${order.quantity}잔`;

    const meta = document.createElement('p');
    meta.className = 'order-meta';
    meta.textContent = order.request ? `요청: ${order.request} · ${order.time}` : order.time;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = '취소';
    cancelBtn.addEventListener('click', () => {
      if (!confirm(`#${order.id} 주문을 취소할까요?`)) return;
      orders.splice(orders.indexOf(order), 1); // 장부에서 1건 지우기
      saveLocal();
      renderOrders();
    });

    li.append(title, detail, meta, cancelBtn);
    orderList.appendChild(li);
  });

  // 총 주문 금액 + 음료별 요약
  const sum = orders.reduce((acc, o) => acc + o.total, 0);
  historyTotal.textContent = `총 주문 금액: ${sum.toLocaleString()}원 (${orders.length}건)`;

  const counts = {};
  orders.forEach((o) => { counts[o.drink] = (counts[o.drink] || 0) + o.quantity; });
  const summaryEl = historyFooter.querySelector('.summary') || historyFooter.insertBefore(document.createElement('p'), historyTotal);
  summaryEl.className = 'summary';
  summaryEl.textContent = Object.entries(counts).map(([d, n]) => `${d} ${n}잔`).join(', ');
}

// 내역 모두 지우기
clearBtn.addEventListener('click', () => {
  if (!confirm('주문 내역을 모두 지울까요?')) return;
  orders = [];
  saveLocal();
  renderOrders();
});

// 처음 열었을 때 화면 준비
updateTotal();
renderOrders();
