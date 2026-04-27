import { state } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { supabase } from './supabase.js';

let tabsInitialized = false;
let uiBound  = false;

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
    initTabs();
    ui.renderCalendar();
   
    const dateInput = document.getElementById('date');
   
    if (dateInput) {
      const today = new Date().toISOString().slice(0,10);
      dateInput.value = today;
      await loadDay(today);
    }
     
  } catch (err) {
    console.error(err);
    alert('Помилка завантаження даних');
  }
}

function bindUI() {
  if (uiBound) return;
  uiBound = true;
 
  // ===== PRODUCTS =====
  document.getElementById('addProductBtn')?.addEventListener('click', onAddProduct);

  // ===== RECIPES =====
  document.getElementById('addRecipeBtn')?.addEventListener('click', onAddRecipe);

  // ===== MENU MODAL =====
  //document.getElementById('saveMenuItemBtn')?.addEventListener('click', onSaveMenuItem);
  //document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);

  // ===== DATE =====
  document.getElementById('date')?.addEventListener('change', (e) => {
    loadDay(e.target.value);
  });

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
  bindUI();
}

function initTabs() {
  if (tabsInitialized) return;
  tabsInitialized = true;
  const buttons = document.querySelectorAll('#tabs button');

  buttons.forEach(btn => {
    btn.onclick = () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab').forEach(tab => {
        tab.style.display = 'none';
      });

      document.getElementById(`tab-${btn.dataset.tab}`).style.display = 'block';
    };
  });
}

/* =========================
   MENU (динамічне — без кешу)
========================= */

async function loadDay(date) {
  const data = await api.getMenuByDate(date, state.user.id);
  ui.renderMenu(data);
}

window.loadDay = loadDay;

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
  const date = document.getElementById('date').value;
  await loadDay(date); 
};

window.cook = async (recipe_id, portions) => {
  await api.cookRecipe({
    p_user_id: state.user.id,
    p_recipe_id: recipe_id,
    p_portions: portions
  });

  await refreshInventory();
  const date = document.getElementById('date').value;
  await loadDay(date);
};

async function onAddProduct() {
  const name = document.getElementById('productName').value;
  const unit = document.getElementById('productUnit').value;
  const calories = parseFloat(document.getElementById('productCalories').value);

  if (!name || !unit) {
    alert('Заповни назву і одиницю');
    return;
  }

  await api.addProduct({
    name,
    unit,
    calories_per_unit: calories || null,
    user_id: state.user.id
  });

  state.products = await api.getProducts();
  ui.renderProducts(state.products);
}

async function onAddRecipe() {
  const name = document.getElementById('recipeName').value;

  if (!name) {
    alert('Введи назву');
    return;
  }

  await api.addRecipe({
    name,
    user_id: state.user.id
  });

  state.recipes = await api.getRecipes();
  ui.renderRecipes(state.recipes);
}

async function onSaveMenuItem() {
  const type = document.getElementById('itemType').value;
  const id = document.getElementById('itemSelect').value;
  const qty = parseFloat(document.getElementById('quantity').value);
  const date = document.getElementById('date').value;

  if (!qty || qty <= 0) {
    alert('Введи кількість');
    return;
  }

  if (!date) {
    alert('Оберіть дату');
    return;
  }

  await upsertMenuItem({
    type,
    id,
    qty,
    meal: currentMeal,
    date
  });

  closeModal();
}

/* =========================
   SHOPPING
========================= */

async function onCalcShopping() {
  const date = document.getElementById('date').value;
  if (!date) {
    alert('Оберіть дату');
    return;
  }
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

async function upsertMenuItem({ type, id, qty, meal, date }) {
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

  await loadDay(date);
}
