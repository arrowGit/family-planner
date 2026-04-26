import { state } from './state.js';
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
  const el = document.getElementById('shopping');

  el.innerHTML = items.map(i => `
    <div>
      ${i.product_id} → купити: ${i.to_buy}
    </div>
  `).join('');
}
