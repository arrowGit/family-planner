import * as api from './api.js';
import { state } from './state.js';

const meals = [
  { key: 'breakfast', label: '🍳 Сніданок' },
  { key: 'lunch', label: '🍲 Обід' },
  { key: 'dinner', label: '🍝 Вечеря' },
  { key: 'snack', label: '🍎 Перекус' }
];

/* =========================
   AUTH
========================= */

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
        <button id="emailLoginBtn">Увійти через email</button>
        <hr>
        <button id="googleLoginBtn">Google</button>
      </div>
    `;

    bindAuthEvents();
  }
}

function bindAuthEvents() {
  document.getElementById('emailLoginBtn').onclick = async () => {
    const email = document.getElementById('emailInput').value;

    if (!email) return alert('Введи email');

    const { error } = await api.loginWithEmail(email);

    if (error) alert(error.message);
    else alert('Перевір пошту 📩');
  };

  document.getElementById('googleLoginBtn').onclick = async () => {
    await api.loginWithGoogle();
  };
}

/* =========================
   MENU
========================= */

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

        <button onclick="openAddModal('${meal.key}')">+ Додати</button>
      </div>
    `;
  }).join('');
}

function renderMenuItem(i) {
  const isRecipe = !!i.recipe_id;

  const name = isRecipe
    ? i.dishes?.name || '❓'
    : i.products?.name || '❓';

  const qty = isRecipe ? i.portions : i.quantity;

  return `
    <div class="menu-item">
      <div>${name} (${qty})</div>

      <div>
        ${
          isRecipe
            ? `<button onclick="cook('${i.recipe_id}', '${i.dish_id}', ${qty})">🍳</button>`
            : ''
        }

        <button onclick="consume('${i.product_id}', '${i.recipe_id}', '${i.dish_id}', ${qty})">
          ✔
        </button>
      </div>
    </div>
  `;
}

/* =========================
   PRODUCTS
========================= */

export function renderProducts(products) {
  const el = document.getElementById('productsList');

  el.innerHTML = products.map(p => `
    <div class="list-item">
      ${p.name} (${p.unit})

      <div>
        <button onclick="editProduct('${p.id}')">✏️</button>
        <button onclick="deleteProduct('${p.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

/* =========================
   RECIPES
========================= */

export function renderRecipes(dishes) {
  const el = document.getElementById('recipesList');

  el.innerHTML = dishes.map(d => {
    const versions = d.recipe_variants || [];
    const main = versions.find(v => v.is_primary);

    return `
      <div class="list-item recipe-item" data-id="${d.id}">
        ${d.name}
        (${main?.portions || '?'} порц., ${versions.length} верс.)
      </div>
    `;
  }).join('');
}

/* =========================
   INVENTORY
========================= */

export function renderInventory(inv) {
  renderInventoryProducts(inv.products);
  renderInventoryDishes(inv.dishes);
}

function renderInventoryProducts(products) {
  const el = document.getElementById('inventoryProducts');

  if (!products.length) {
    el.innerHTML = 'Немає продуктів';
    return;
  }

  el.innerHTML = products.map(p => {
    const product = state.products.find(x => x.id === p.product_id);

    return `
      <div class="inventory-item">
        ${product?.name || '❓'} — ${p.qty}
      </div>
    `;
  }).join('');
}

function renderInventoryDishes(dishes) {
  const el = document.getElementById('inventoryDishes');

  if (!dishes.length) {
    el.innerHTML = 'Немає страв';
    return;
  }

  el.innerHTML = dishes.map(d => `
    <div class="inventory-item">
      <b>${d.dishes?.name || '❓'}</b>
      — ${Number(d.portions).toFixed(1)} порц.
    </div>
  `).join('');
}

/* =========================
   SHOPPING
========================= */

export function renderShopping(items) {
  const el = document.getElementById('shopping');

  el.innerHTML = items.map(i => `
    <div>
      ${i.product_name}
      — потрібно: ${i.needed}
      — є: ${i.in_stock}
      — купити: <b>${i.to_buy}</b>
    </div>
  `).join('');
}

/* =========================
   CALENDAR
========================= */

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
      document.querySelectorAll('.calendar-day')
        .forEach(d => d.classList.remove('active'));

      day.classList.add('active');

      await loadDay(day.dataset.date);
    };
  });
}
