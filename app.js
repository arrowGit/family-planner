import { state } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { supabase } from './supabase.js';

/* =========================
   CACHE
========================= */

let appLoaded = false;

/* =========================
   INIT
========================= */

async function init() {
  const { data } = await supabase.auth.getSession();
  state.user = data.session?.user || null;

  ui.renderAuth();

  if (state.user) {
    await loadAppData();
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;

    ui.renderAuth();

    if (state.user) {
      await loadAppData(true);
    } else {
      resetState();
    }
  });
}

init();

/* =========================
   LOAD APP DATA
========================= */

async function loadAppData(force = false) {
  if (appLoaded && !force) return;

  try {
    const data = await api.loadAppData(state.user.id);

    state.products = data.products;
    state.recipes = data.recipes;
    state.inventory = data.inventory;

    appLoaded = true;

    renderApp();

  } catch (err) {
    console.error(err);
    alert('Помилка завантаження даних');
  }
}

/* =========================
   RESET
========================= */

function resetState() {
  state.products = [];
  state.recipes = [];
  state.inventory = [];
  appLoaded = false;
}

/* =========================
   RENDER
========================= */

function renderApp() {
  ui.renderProducts(state.products);
  ui.renderRecipes(state.recipes);
  ui.renderInventory(state.inventory);
}

/* =========================
   MENU (динамічне — без кешу)
========================= */

async function loadDay() {
  const date = document.getElementById('date').value;

  const data = await api.getMenuByDate(date, state.user.id);

  ui.renderMenu(data);
}

/* =========================
   ADD ITEM
========================= */

async function addItem() {
  const type = document.getElementById('itemType').value;
  const id = document.getElementById('itemSelect').value;
  const qty = parseFloat(document.getElementById('quantity').value);
  const meal = document.getElementById('meal').value;
  const date = document.getElementById('date').value;

  // ❗ поки лишаємо напряму (це ок)
  const { data: day } = await supabase
    .from('menu_days')
    .upsert({ date, user_id: state.user.id }, { onConflict: 'date,user_id' })
    .select()
    .single();

  await api.addMenuItem({
    menu_day_id: day.id,
    item_type: type,
    product_id: type === 'product' ? id : null,
    recipe_id: type === 'recipe' ? id : null,
    quantity: type === 'product' ? qty : null,
    portions: type === 'recipe' ? qty : null,
    meal,
    user_id: state.user.id
  });

  await loadDay(); // тільки день, не все
}

/* =========================
   INVENTORY
========================= */

async function refreshInventory() {
  state.inventory = await api.getInventory(state.user.id);
  ui.renderInventory(state.inventory);
}

/* =========================
   GLOBAL ACTIONS
========================= */

window.consume = async (product_id, recipe_id, qty) => {
  await api.consumeItem({
    p_user_id: state.user.id,
    p_product_id: product_id,
    p_recipe_id: recipe_id,
    p_quantity: qty
  });

  await refreshInventory(); // 🔥 тільки inventory
};

window.cook = async (recipe_id, portions) => {
  await api.cookRecipe({
    p_user_id: state.user.id,
    p_recipe_id: recipe_id,
    p_portions: portions
  });

  await refreshInventory();
};

/* =========================
   SHOPPING
========================= */

async function calcShopping() {
  const date = document.getElementById('date').value;

  const items = await api.getShoppingList(
    state.user.id,
    date,
    date
  );

  ui.renderShopping(items);
}

let currentMeal = null;

window.openAddModal = (meal) => {
  currentMeal = meal;

  document.getElementById('menuModal').style.display = 'flex';

  fillSelect();
};

window.closeModal = () => {
  document.getElementById('menuModal').style.display = 'none';
};

function fillSelect() {
  const type = document.getElementById('itemType').value;
  const select = document.getElementById('itemSelect');

  if (type === 'recipe') {
    select.innerHTML = state.recipes.map(r =>
      `<option value="${r.id}">${r.name}</option>`
    ).join('');
  } else {
    select.innerHTML = state.products.map(p =>
      `<option value="${p.id}">${p.name}</option>`
    ).join('');
  }
}

window.saveMenuItem = async () => {
  const type = document.getElementById('itemType').value;
  const id = document.getElementById('itemSelect').value;
  const qty = parseFloat(document.getElementById('quantity').value);
  const date = document.getElementById('date').value;

  const { data: day } = await supabase
    .from('menu_days')
    .upsert({ date, user_id: state.user.id }, { onConflict: 'date,user_id' })
    .select()
    .single();

  await api.addMenuItem({
    menu_day_id: day.id,
    item_type: type,
    product_id: type === 'product' ? id : null,
    recipe_id: type === 'recipe' ? id : null,
    quantity: type === 'product' ? qty : null,
    portions: type === 'recipe' ? qty : null,
    meal: currentMeal,
    user_id: state.user.id
  });

  closeModal();
  await loadDay();
};
