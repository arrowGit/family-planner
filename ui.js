import { state } from './state.js';
import * as api from './api.js';

export function renderAuth() {
  const el = document.getElementById('auth');

  if (state.user) {
    el.innerHTML = `👤 ${state.user.email}`;
    document.getElementById('app').style.display = 'block';
  } else {
    el.innerHTML = `<button id="loginBtn">Login</button>`;

    document.getElementById('loginBtn').onclick = async () => {
      const email = prompt('email');
      await api.login(email);
      alert('Перевір пошту');
    };
  }
}

export function fillDropdowns() {
  const select = document.getElementById('itemSelect');

  select.innerHTML = state.products.map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join('');
}

export function renderMenu(data) {
  const el = document.getElementById('menu');

  if (!data) {
    el.innerHTML = 'Немає даних';
    return;
  }

  el.innerHTML = data.menu_items.map(i => `
    <div>
      ${i.meal} - ${i.item_type} 
      <button onclick="consume('${i.product_id}', '${i.recipe_id}', ${i.quantity || i.portions})">✔</button>
    </div>
  `).join('');
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
