import * as api from './api.js';
import { state } from './state.js';

let loginInProgress = false;

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
