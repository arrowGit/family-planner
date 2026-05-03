import { state } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { supabase } from './supabase.js';

let tabsInitialized = false;
let uiBound = false;
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
   LOAD
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

    if (!state.families.length) {
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
      state.user.id
    );

    state.products = data.products;
    state.dishes = data.dishes;
    state.inventory.products = data.inventoryProducts;
    state.inventory.dishes = data.inventoryDishes;

    appLoaded = true;

    renderApp();
    initTabs();

    const today = new Date().toISOString().slice(0, 10);
    await loadDay(today);

  } catch (e) {
    console.error(e);
    alert('Помилка завантаження');
  } finally {
    state.ui.loading = false;
  }
}

/* =========================
   RENDER
========================= */

function renderApp() {
  ui.renderProducts(state.products);
  ui.renderRecipes(state.dishes);
  ui.renderInventory(state.inventory);
  bindRecipeClicks();
  bindUI();
}

/* =========================
   UI
========================= */

function bindUI() {
  if (uiBound) return;
  uiBound = true;

  document.getElementById('profileBtn')?.addEventListener('click', openProfile);

  document.getElementById('saveProfileBtn').onclick = async () => {
    const name = document.getElementById('profileName').value;

    await supabase.auth.updateUser({
      data: { full_name: name }
    });

    location.reload();
  };
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
  state.inventory.products = await api.getInventoryProducts(state.activeFamilyId);
  state.inventory.dishes = await api.getInventoryDishes(state.activeFamilyId);

  ui.renderInventory(state.inventory);
}

/* =========================
   ACTIONS
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
   RECIPE CLICK
========================= */

function bindRecipeClicks() {
  document.getElementById('recipesList').onclick = (e) => {
    const el = e.target.closest('.recipe-item');
    if (!el) return;

    const recipe = state.dishes.find(r => r.id === el.dataset.id);
    if (recipe) openRecipeView(recipe);
  };
}

/* =========================
   PROFILE
========================= */

function openProfile() {
  const user = state.user;

  document.getElementById('profileModal').style.display = 'flex';
  document.getElementById('profileName').value =
    user.user_metadata?.full_name || '';

  document.getElementById('profileEmail').innerText = user.email;

  document.getElementById('profileFamilies').innerHTML =
    state.families.map(f => `
      <div>
        ${f.name} ${f.role === 'owner' ? '⭐' : ''}
      </div>
    `).join('');
}

window.closeProfile = () => {
  document.getElementById('profileModal').style.display = 'none';
};

/* =========================
   RESET
========================= */

function resetState() {
  state.products = [];
  state.dishes = [];
  state.inventory = { products: [], dishes: [] };
  state.menu = { currentDate: null, currentDay: null };
  appLoaded = false;
}
