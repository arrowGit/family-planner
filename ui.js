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
  const el = document.getElementById('auth');

  if (state.user) {
    el.innerHTML = `
      <div>
        👤 ${state.user.email}
        <button id="logoutBtn">Вийти</button>
      </div>
    `;

    document.getElementById('app').style.display = 'block';

    document.getElementById('logoutBtn').onclick = async () => {
      await api.logout();
      state.user = null;
      renderAuth();
    };

  } else {
    document.getElementById('app').style.display = 'none';

    el.innerHTML = `
      <div style="border:1px solid #ccc; padding:20px; max-width:300px;">
        
        <h3>Вхід</h3>

        <input id="emailInput" placeholder="Email" style="width:100%; margin-bottom:10px;" />

        <button id="emailLoginBtn" style="width:100%; margin-bottom:10px;">
          Увійти через email
        </button>

        <hr>

        <button id="googleLoginBtn" style="width:100%;">
          Увійти через Google
        </button>

      </div>
    `;

    // EMAIL LOGIN
    document.getElementById('emailLoginBtn').onclick = async () => {
      if (loginInProgress) return;

      const email = document.getElementById('emailInput').value;
      if (!email) {
        alert('Введи email');
        return;
      }

      loginInProgress = true;

      const { error } = await api.loginWithEmail(email);

      loginInProgress = false;

      if (error) {
        alert(error.message);
      } else {
        alert('Перевір email 📩');
      }
    };

    // GOOGLE LOGIN
    document.getElementById('googleLoginBtn').onclick = async () => {
      await api.loginWithGoogle();
    };
  }
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

        <button onclick="consume('${i.product_id}', '${i.recipe_id}', ${qty)">
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
}
