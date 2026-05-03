import { state } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { supabase } from './supabase.js';

let tabsInitialized = false;
let uiBound = false;
let appLoaded = false;

/* ========================= INIT ========================= */

async function init() {
  const { data } = await supabase.auth.getSession();
  state.user = data.session?.user || null;

  ui.renderAuth();

  supabase.auth.onAuthStateChange(async (_, session) => {
    state.user = session?.user || null;
    ui.renderAuth();

    if (state.user) await loadAppData(true);
    else resetState();
  });
}

init();

/* ========================= LOAD ========================= */

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
    state.menu.currentDate = today;

    await loadDay(today);

  } catch (e) {
    console.error(e);
    alert('Помилка завантаження');
  } finally {
    state.ui.loading = false;
  }
}

/* ========================= UI ========================= */

function renderApp() {
  ui.renderProducts(state.products);
  ui.renderRecipes(state.dishes);
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

/* ========================= RESET ========================= */

function resetState() {
  state.products = [];
  state.dishes = [];
  state.inventory = { products: [], dishes: [] };
  state.menu = { currentDate: null, currentDay: null };
  appLoaded = false;
}
