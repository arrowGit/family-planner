import { state } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { supabase } from './supabase.js';

let tabsInitialized = false;
let uiBound = false;
let loading = false;

/* ========================= CACHE ========================= */
let appLoaded = false;

/* ========================= INIT ========================= */
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

/* ========================= LOAD APP DATA ========================= */
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

    // вибір активної
    state.activeFamilyId =
      state.activeFamilyId ||
      localStorage.getItem('familyId') ||
      state.families[0].id;

    localStorage.setItem('familyId', state.activeFamilyId);

    const data = await api.getAppData(state.activeFamilyId);

    state.products = data.products;
    state.dishes = data.dishes;

    // 🔥 FIX
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

/* ========================= BIND UI ========================= */
function bindUI() {
  if (uiBound) return;
  uiBound = true;

  // ===== PRODUCTS =====
  document.getElementById('openAddProductBtn')
    ?.addEventListener('click', () => openProductModal());

  document.getElementById('saveProductBtn')
    ?.addEventListener('click', onSaveProduct);

  document.getElementById('closeProductModalBtn')
    ?.addEventListener('click', closeProductModal);

  document.getElementById('productModal')
    ?.addEventListener('click', (e) => {
      if (e.target.id === 'productModal') closeProductModal();
    });

  // ===== RECIPES =====
  document.getElementById('openAddRecipeBtn')
    ?.addEventListener('click', () => openRecipeModal());

  document.getElementById('saveRecipeBtn')
    ?.addEventListener('click', onSaveRecipe);

  document.getElementById('addIngredientBtn')
    ?.addEventListener('click', onAddIngredient);

  document.getElementById('closeRecipeModalBtn')
    ?.addEventListener('click', () => {
      closeRecipeModal();
      if (state.viewRecipe) {
        openRecipeView(state.viewRecipe);
      }
    });

  document.getElementById('recipeModal')
    ?.addEventListener('click', (e) => {
      if (e.target.id === 'recipeModal') {
        closeRecipeModal();
        if (state.viewRecipe) openRecipeView(state.viewRecipe);
      }
    });

  document.getElementById('prevVersionBtn')
    ?.addEventListener('click', () => {
      const versions = state.viewRecipe.recipe_variants;
      state.viewVersionIndex =
        (state.viewVersionIndex - 1 + versions.length) % versions.length;
      renderRecipeView();
    });

  document.getElementById('editVersionBtn')
    ?.addEventListener('click', () => {
      const recipe = state.viewRecipe;
      const version = recipe.recipe_variants[state.viewVersionIndex];
      closeRecipeViewModal();
      openRecipeModal(recipe, version);
    });

  document.getElementById('nextVersionBtn')
    ?.addEventListener('click', () => {
      const versions = state.viewRecipe.recipe_variants;
      state.viewVersionIndex =
        (state.viewVersionIndex + 1) % versions.length;
      renderRecipeView();
    });

  document.getElementById('closeRecipeViewBtn')
    ?.addEventListener('click', () => {
      document.getElementById('recipeViewModal').style.display = 'none';
      state.viewRecipe = null;
    });

  document.getElementById('makeMainBtn')
    ?.addEventListener('click', async () => {
      const recipe = state.viewRecipe;
      const version = recipe.recipe_variants[state.viewVersionIndex];

      await api.setMainRecipeVersion(recipe.id, version.id);

      // оновити локально
      recipe.main_version_id = version.id;
      renderRecipeView();
    });

  // ===== DATE =====
  document.getElementById('date')
    ?.addEventListener('change', (e) => {
      loadDay(e.target.value);
    });

  document.getElementById('profileBtn')
    ?.addEventListener('click', openProfile);

  document.getElementById('saveProfileBtn').onclick = async () => {
    const name = document.getElementById('profileName').value;

    await supabase.auth.updateUser({
      data: { full_name: name }
    });

    alert('Збережено');
    location.reload();
  };
}

/* ========================= RECIPE CLICKS ========================= */
function bindRecipeClicks() {
  document.getElementById('recipesList').onclick = (e) => {
    const el = e.target.closest('.recipe-item');
    if (!el) return;

    const id = el.dataset.id;
    const recipe = state.dishes.find(r => r.id === id);

    if (recipe) openRecipeView(recipe);
  };
}

function closeRecipeViewModal() {
  document.getElementById('recipeViewModal').style.display = 'none';
}

/* ========================= RESET ========================= */
function resetState() {
  state.products = [];
  state.dishes = [];
  state.shopping = [];
  state.inventory = { products: [], dishes: [] };
  state.menu = { currentDate: null, currentDay: null };
  appLoaded = false;
}

/* ========================= RENDER ========================= */
function renderApp() {
  ui.renderProducts(state.products);
  ui.renderRecipes(state.dishes);

  bindRecipeClicks();

  ui.renderInventory(state.inventory);

  bindUI();
}

/* ========================= TABS ========================= */
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

/* ========================= MENU ========================= */
async function loadDay(date) {
  const data = await api.getMenuByDate(date, state.activeFamilyId);

  state.menu.currentDate = date;
  state.menu.currentDay = data;

  ui.renderMenu(data);
}

window.loadDay = loadDay;

/* ========================= INVENTORY ========================= */
async function refreshInventory() {
  const products = await api.getInventoryProducts(state.activeFamilyId);
  const dishes = await api.getInventoryDishes(state.activeFamilyId);

  state.inventory.products = products;
  state.inventory.dishes = dishes;

  ui.renderInventory(state.inventory);
}

/* ========================= GLOBAL ACTIONS ========================= */
window.consume = async (product_id, recipe_id, dish_id, qty) => {
  await api.consumeItem({
    family_id: state.activeFamilyId,
    product_id,
    recipe_id,
    dish_id,
    quantity: qty
  });

  await refreshInventory();

  const date = document.getElementById('date').value;
  await loadDay(date);
};

window.cook = async (recipe_id, dish_id, portions) => {
  await api.cookDish({
    family_id: state.activeFamilyId,
    dish_id,
    recipe_id,
    portions
  });

  await refreshInventory();

  const date = document.getElementById('date').value;
  await loadDay(date);
};

/* ========================= MENU ITEM SAVE ========================= */
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
    meal: state.ui.currentMeal,
    date
  });

  closeModal();
}

/* ========================= SHOPPING ========================= */
async function onCalcShopping() {
  const date = document.getElementById('date').value;

  if (!date) {
    alert('Оберіть дату');
    return;
  }

  const items = await api.getShoppingList(
    state.activeFamilyId,
    date,
    date
  );

  ui.renderShopping(items);
}

/* ========================= MODAL ========================= */
window.openAddModal = (meal) => {
  state.ui.currentMeal = meal;

  document.getElementById('menuModal').style.display = 'flex';
  fillSelect();
};

window.closeModal = () => {
  document.getElementById('menuModal').style.display = 'none';
};

/* ========================= SELECT ========================= */
function fillSelect() {
  const type = document.getElementById('itemType').value;
  const select = document.getElementById('itemSelect');

  if (type === 'recipe') {
    select.innerHTML = state.dishes
      .map(r => `<option value="${r.id}">${r.name}</option>`)
      .join('');
  } else {
    select.innerHTML = state.products
      .map(p => `<option value="${p.id}">${p.name}</option>`)
      .join('');
  }
}

/* ========================= UPSERT MENU ========================= */
async function upsertMenuItem({ type, id, qty, meal, date }) {
  const { data: day } = await supabase
    .from('menu_days')
    .upsert(
      {
        date,
        family_id: state.activeFamilyId
      },
      {
        onConflict: 'family_id,date'
      }
    )
    .select()
    .single();

  await api.addMenuItem({
    menu_day_id: day.id,
    item_type: type,
    product_id: type === 'product' ? id : null,
    recipe_id: type === 'recipe' ? id : null,
    quantity: type === 'product' ? qty : null,
    portions: type === 'recipe' ? qty : null,
    meal
  });

  await loadDay(date);
}

