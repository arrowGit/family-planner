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
      <div class="topbar">
        👤 ${name}
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
      showToast('Перевір пошту 📩');
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

function renderProducts(i) {
  return `
    <div>
      БЛА БЛА БЛА
    </div>
  `;
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

        <button onclick="consume('${i.product_id}', '${i.recipe_id}', ${qty}">
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
  el.innerHTML = items.map(i => `
    <div>
      ${getProductName(i.product_id)} 
      потрібно: ${i.needed}
      є: ${i.in_stock}
      купити: ${i.to_buy}
    </div>
  `)
}
