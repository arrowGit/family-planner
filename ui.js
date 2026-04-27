import * as api from './api.js';
import { state } from './state.js';

let loginInProgress = false;

const meals = [
  { key: 'breakfast', label: '🍳 Сніданок' },
  { key: 'lunch', label: '🍲 Обід' },
  { key: 'dinner', label: '🍝 Вечеря' },
  { key: 'snack', label: '🍎 Перекус' }
];

export function renderAuth() {
  const authEl = document.getElementById('auth');
  const appEl = document.getElementById('app');

  if (state.user) {
    authEl.innerHTML = '';

    appEl.style.display = 'block';

    const name =
      state.user.user_metadata?.full_name ||
      state.user.email;

    document.getElementById('topbar').innerHTML = `
      <div class="user-info">
        <span>👤 ${name}</span>
        <button id="logoutBtn">Вийти</button>
      </div>
    `;

    document.getElementById('logoutBtn').onclick = async () => {
      await api.logout();
    };

  } else {
    appEl.style.display = 'none';

    authEl.innerHTML = `
      <div class="login-box">
        <h3>Вхід</h3>

        <input id="emailInput" placeholder="Email" />

        <button id="emailLoginBtn">
          Увійти через email
        </button>

        <hr>

        <button id="googleLoginBtn">
          Google
        </button>
      </div>
    `;

    bindAuthEvents();
  }
}

function bindAuthEvents() {
  const emailBtn = document.getElementById('emailLoginBtn');
  const googleBtn = document.getElementById('googleLoginBtn');

  emailBtn.onclick = async () => {
    const email = document.getElementById('emailInput').value;

    if (!email) {
      alert('Введи email');
      return;
    }

    emailBtn.disabled = true;

    const { error } = await api.loginWithEmail(email);

    emailBtn.disabled = false;

    if (error) {
      alert(error.message);
    } else {
      alert('Перевір пошту 📩');
    }
  };

  googleBtn.onclick = async () => {
    await api.loginWithGoogle();
  };
}

export function fillDropdowns() {
  const select = document.getElementById('itemSelect');

  select.innerHTML = state.products.map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join('');
}

export function renderMenu(day) {
  const container = document.getElementById('menuContainer');

  if (!day) {
    container.innerHTML = 'Немає меню';
    return;
  }

  container.innerHTML = meals.map(meal => {
    const items = day.menu_items?.filter(i => i.meal === meal.key) || [];

    return `
      <div class="meal-block">
        <div class="meal-title">${meal.label}</div>

        ${items.map(renderMenuItem).join('')}

        <button class="add-btn" onclick="openAddModal('${meal.key}')">
          + Додати
        </button>
      </div>
    `;
  }).join('');
}

export function renderProducts(products) {
  const el = document.getElementById('productsList');

  el.innerHTML = products.map(p => `
    <div>
      ${p.name} (${p.unit})
    </div>
  `).join('');
}

export function renderRecipes(recipes) {
  const el = document.getElementById('recipesList');

  el.innerHTML = recipes.map(r => `
    <div>
      ${r.name}
    </div>
  `).join('');
}

function renderMenuItem(i) {
  const name =
    i.item_type === 'recipe'
      ? state.recipes.find(r => r.id === i.recipe_id)?.name
      : state.products.find(p => p.id === i.product_id)?.name;

  const qty = i.item_type === 'recipe' ? i.portions : i.quantity;

  return `
    <div class="menu-item">
      <div>
        ${name} (${qty})
      </div>

      <div>
        ${
          i.item_type === 'recipe'
            ? `<button onclick="cook('${i.recipe_id}', ${qty})">🍳</button>`
            : ''
        }

        <button onclick="consume('${i.product_id}', '${i.recipe_id}', ${qty})">
          ✔
        </button>
      </div>
    </div>
  `;
}

export function renderInventory(items) {
  const el = document.getElementById('inventory');

  el.innerHTML = items.map(i => `
    <div>
      ${i.product_id || i.recipe_id} — ${i.qty}
      <button onclick="consume('${i.product_id}', '${i.recipe_id}', 1)">Спожити</button>
    </div>
  `).join('');
}

export function renderShopping(items) {
  const el = document.getElementById('shopping');

  el.innerHTML = items.map(i => `
    <div>
      ${state.products.find(p => p.id === i.product_id)?.name || '❓'}
      — потрібно: ${i.needed}
      — є: ${i.in_stock}
      — купити: <b>${i.to_buy}</b>
    </div>
  `).join('');
}

export function renderCalendar(selectedDate = new Date()) {
  const container = document.getElementById('calendar');

  const date = new Date(selectedDate);
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay() + 6) % 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = `<div class="calendar">`;

  for (let i = 1; i < startDay; i++) {
    html += `<div></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const fullDate = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    html += `
      <div class="calendar-day" data-date="${fullDate}">
        ${d}
      </div>
    `;
  }

  html += `</div>`;

  container.innerHTML = html;

  bindCalendar();
}

function bindCalendar() {
  document.querySelectorAll('.calendar-day').forEach(day => {
    day.onclick = async () => {
      document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('active'));
      day.classList.add('active');

      const date = day.dataset.date;

      await loadDay(date);
    };
  });
}
