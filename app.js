import { state } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { supabase } from './supabase.js';

async function init() {
  state.user = await api.getSession();

  ui.renderAuth();

  // слухаємо зміни авторизації
  supabase.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null;
    ui.renderAuth();

    // 🔥 прибираємо #access_token з URL
    if (window.location.hash.includes('access_token')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  });
}

init();

async function loadDay() {
  const date = document.getElementById('date').value;
  const data = await api.getMenu(date, state.user.id);
  ui.renderMenu(data);
}

async function addItem() {
  const type = document.getElementById('itemType').value;
  const id = document.getElementById('itemSelect').value;
  const qty = parseFloat(document.getElementById('quantity').value);
  const meal = document.getElementById('meal').value;
  const date = document.getElementById('date').value;

  // 1. ensure menu_day exists
  const { data: day } = await supabase
    .from('menu_days')
    .upsert({ date, user_id: state.user.id }, { onConflict: 'date,user_id' })
    .select()
    .single();

  // 2. insert item
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

  await loadDay();
}

async function refreshInventory() {
  const items = await api.loadInventory(state.user.id);
  ui.renderInventory(items);
}

window.consume = async (product_id, recipe_id, qty) => {
  await api.consumeItem({
    p_user_id: state.user.id,
    p_product_id: product_id,
    p_recipe_id: recipe_id,
    p_quantity: qty
  });

  await refreshInventory();
};

async function calcShopping() {
  const date = document.getElementById('date').value;

  const items = await api.getShopping(state.user.id, date, date);
  ui.renderShopping(items);
}

init();
