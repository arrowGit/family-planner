import { state } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { supabase } from './supabase.js';

let tabsInitialized = false;
let uiBound = false;

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
  if (state.ui.loading) return;
  if (appLoaded && !force) return;
  if (!state.user?.id) return;

  state.ui.loading = true;

  try {
    const families = await api.getMyFamilies();

    state.families = families.map(f => ({
      id: f.family_id,
      name: f.families.name,
      role: f.role
    }));

    if (state.families.length === 0) {
      ui.renderNoFamily();
      return;
    }

    state.activeFamilyId =
      state.activeFamilyId ||
      localStorage.getItem('familyId') ||
      state.families[0].id;

    localStorage.setItem('familyId', state.activeFamilyId);

    const data = await api.getAppData(
      state.activeFamilyId,
      state.user.id // 🔥 FIX
    );

    state.products = data.products;
    state.dishes = data.dishes;
    state.inventory.products = data.inventoryProducts;
    state.inventory.dishes = data.inventoryDishes;

    appLoaded = true;

    renderApp();
    initTabs();

    ui.renderCalendar();

    const today = new Date().toISOString().slice(0, 10);
    state.menu.currentDate = today;

    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.value = today;

    await loadDay(today);

  } catch (err) {
    console.error(err);
    alert('Помилка завантаження');
  } finally {
    state.ui.loading = false;
  }
}

/* =========================
   UI BINDING
========================= */

function bindUI() {
  if (uiBound) return;
  uiBound = true;

  // PRODUCTS
  document.getElementById('openAddProductBtn')?.addEventListener('click', () => openProductModal());
  document.getElementById('saveProductBtn')?.addEventListener('click', onSaveProduct);
  document.getElementById('closeProductModalBtn')?.addEventListener('click', closeProductModal);

  // RECIPES
  document.getElementById('openAddRecipeBtn')?.addEventListener('click', () => openRecipeModal());
  document.getElementById('saveRecipeBtn')?.addEventListener('click', onSaveRecipe);
  document.getElementById('addIngredientBtn')?.addEventListener('click', onAddIngredient);

  // DATE
  document.getElementById('date')?.addEventListener('change', (e) => {
    loadDay(e.target.value);
  });
}

/* =========================
   RECIPES CLICK
========================= */

function bindRecipeClicks() {
  document.getElementById('recipesList').onclick = (e) => {
    const el = e.target.closest('.recipe-item');
    if (!el) return;

    const id = el.dataset.id;
    const recipe = state.dishes.find(r => r.id === id);

    if (recipe) openRecipeView(recipe);
  };
}

/* =========================
   RESET
========================= */

function resetState() {
  state.products = [];
  state.dishes = [];
  state.shopping = [];

  state.inventory = {
    products: [],
    dishes: []
  };

  state.menu = {
    currentDate: null,
    currentDay: null
  };

  appLoaded = false;
}

/* =========================
   RENDER
========================= */

function renderApp() {
  ui.renderProducts(state.products);
  ui.renderRecipes(state.dishes);
  bindRecipeClicks();
  ui.renderInventory(state.inventory);
  bindUI();
}

/* =========================
   TABS (🔥 ПОВЕРНУТО)
========================= */

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
   MENU
========================= */

async function loadDay(date) {
  const data = await api.getMenuByDate(date, state.activeFamilyId);

  state.menu.currentDate = date;
  state.menu.currentDay = data;

  ui.renderMenu(data);
}

window.loadDay = loadDay;

/* =========================
   INVENTORY
========================= */

async function refreshInventory() {
  const products = await api.getInventoryProducts(state.activeFamilyId);
  const dishes = await api.getInventoryDishes(state.activeFamilyId);

  state.inventory.products = products;
  state.inventory.dishes = dishes;

  ui.renderInventory(state.inventory);
}

/* =========================
   GLOBAL ACTIONS
========================= */

window.consume = async (product_id, recipe_id, dish_id, qty) => {
  await api.consumeItem({
    family_id: state.activeFamilyId,
    product_id,
    recipe_id,
    dish_id,
    quantity: qty
  });

  await refreshInventory();
  await loadDay(state.menu.currentDate);
};

window.cook = async (recipe_id, dish_id, portions) => {
  await api.cookDish({
    family_id: state.activeFamilyId,
    dish_id,
    recipe_id,
    portions
  });

  await refreshInventory();
  await loadDay(state.menu.currentDate);
};

/* =========================
   PRODUCTS
========================= */

function openProductModal(product = null) {
  state.editingProduct = product;

  document.getElementById('productModal').style.display = 'flex';

  document.getElementById('productName').value = product?.name || '';
  document.getElementById('productUnit').value = product?.unit || '';
}

async function onSaveProduct() {
  const name = document.getElementById('productName').value;
  const unit = document.getElementById('productUnit').value;

  if (!name || !unit) {
    alert('Заповни поля');
    return;
  }

  if (state.editingProduct) {
    await api.updateProduct(state.editingProduct.id, { name, unit });
  } else {
    await api.addProduct({
      name,
      unit,
      user_id: state.user.id
    });
  }

  state.products = await api.getProducts();
  ui.renderProducts(state.products);

  closeProductModal();
}

function closeProductModal() {
  document.getElementById('productModal').style.display = 'none';
  state.editingProduct = null;
}

/* =========================
   RECIPES (FIXED)
========================= */

function openRecipeView(recipe) {
  state.viewRecipe = recipe;

  const idx = recipe.recipe_variants.findIndex(
    v => v.id === recipe.main_version_id
  );

  state.viewVersionIndex = idx >= 0 ? idx : 0;

  document.getElementById('recipeViewModal').style.display = 'flex';

  renderRecipeView();
}

function renderRecipeView() {
  const recipe = state.viewRecipe;
  const version = recipe.recipe_variants[state.viewVersionIndex];

  document.getElementById('viewRecipeName').innerHTML =
    `${recipe.name} ${version.id === recipe.main_version_id ? '⭐' : ''}`;

  document.getElementById('viewRecipeMeta').innerText =
    `Порції: ${version.portions}`;
}
