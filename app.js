import { state } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { supabase } from './supabase.js';

let tabsInitialized = false;
let uiBound  = false;
let loading = false;


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
  if (loading) return;
  if (appLoaded && !force) return;

  if (!state.user?.id) {
    console.warn('⛔ user_id відсутній');
    return;
  }
  loading = true;
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
  } finally {
     loading = false;
  }
}

function bindUI() {
  if (uiBound) return;
  uiBound = true;
 
  // ===== PRODUCTS =====
  document.getElementById('openAddProductBtn')?.addEventListener('click', () => openProductModal());
  document.getElementById('saveProductBtn')?.addEventListener('click', onSaveProduct);
  document.getElementById('closeProductModalBtn')?.addEventListener('click', closeProductModal);
  document.getElementById('productModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'productModal') closeProductModal();
  });
  // ===== RECIPES =====
  document.getElementById('openAddRecipeBtn')?.addEventListener('click', () => openRecipeModal());
  document.getElementById('saveRecipeBtn')?.addEventListener('click', onSaveRecipe);
  document.getElementById('addIngredientBtn')?.addEventListener('click', onAddIngredient);
  document.getElementById('closeRecipeModalBtn')?.addEventListener('click', closeRecipeModal);
  document.getElementById('recipeModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'recipeModal') closeRecipeModal();
  });
  document.getElementById('prevVersionBtn')?.addEventListener('click', () => {
    if (state.currentVersionIndex > 0) {
      state.currentVersionIndex--;
      renderRecipeView();
    }
  });
  document.getElementById('nextVersionBtn')?.addEventListener('click', () => {
    if (state.currentVersionIndex < state.currentVersions.length - 1) {
      state.currentVersionIndex++;
      renderRecipeView();
    }
  });
  document.getElementById('setMainBtn')?.addEventListener('click', async () => {
    const version = state.currentVersions[state.currentVersionIndex];
    await api.setMainRecipeVersion(
      state.currentRecipe.id,
      version.id
    );
    await loadAppData(true);
    renderRecipeView();
  });
  document.getElementById('editVersionBtn')?.addEventListener('click', () => {
    const version = state.currentVersions[state.currentVersionIndex];
    openRecipeModal(state.currentRecipe, version);
  });
  document.getElementById('closeRecipeViewBtn')?.addEventListener('click', () => {
    document.getElementById('recipeViewModal').style.display = 'none';
  });

   
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

/* =========================
   Products
========================= */
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

function openProductModal(product = null) {
  state.editingProduct = product;

  document.getElementById('productModal').style.display = 'flex';

  document.getElementById('productName').value = product?.name || '';
  document.getElementById('productUnit').value = product?.unit || '';
  document.getElementById('productCalories').value = product?.calories_per_unit || '';

  document.getElementById('deleteProductBtn').style.display = product ? 'block' : 'none';
}

async function onSaveProduct() {
  const name = document.getElementById('productName').value;
  const unit = document.getElementById('productUnit').value;
  const calories = parseFloat(document.getElementById('productCalories').value);

  if (!name || !unit) {
    alert('Заповни поля');
    return;
  }

  if (state.editingProduct) {
    await api.updateProduct(state.editingProduct.id, {
      name,
      unit,
      calories_per_unit: calories
    });
  } else {
    await api.addProduct({
      name,
      unit,
      calories_per_unit: calories,
      user_id: state.user.id
    });
  }

  state.products = await api.getProducts();
  ui.renderProducts(state.products);

  closeProductModal();
}

window.deleteProduct = async (id) => {
  if (!confirm('Видалити продукт?')) return;

  await api.deleteProduct(id);

  state.products = await api.getProducts();
  ui.renderProducts(state.products);
};

window.editProduct = (id) => {
  const product = state.products.find(p => p.id === id);
  openProductModal(product);
};

function closeProductModal() {
  document.getElementById('productModal').style.display = 'none';

  state.editingProduct = null;

  // очистка форми (важливо)
  document.getElementById('productName').value = '';
  document.getElementById('productUnit').value = '';
  document.getElementById('productCalories').value = '';
}

/* =========================
   Recipes
========================= */
async function openRecipeModal(recipe = null) {
  state.editingRecipe = recipe;

  document.getElementById('recipeModal').style.display = 'flex';
  document.getElementById('recipeName').value = recipe?.name || '';

  document.getElementById('deleteRecipeBtn').style.display = recipe ? 'block' : 'none';

  // 🔥 НОВЕ
  state.recipeDraft = [];

  if (recipe) {
    const ingredients = await api.getRecipeIngredients(recipe.id);

    state.recipeDraft = ingredients.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity
    }));
  }

  fillIngredientProducts();
  renderIngredients();
}

function fillIngredientProducts() {
  const select = document.getElementById('ingredientProduct');

  select.innerHTML = state.products.map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join('');
}

function onAddIngredient() {
  const product_id = document.getElementById('ingredientProduct').value;
  const qty = parseFloat(document.getElementById('ingredientQty').value);

  if (!qty || qty <= 0) {
    alert('Введи кількість');
    return;
  }

  state.recipeDraft.push({
    product_id,
    quantity: qty
  });

  renderIngredients();
}

function renderIngredients() {
  const el = document.getElementById('ingredientsList');

  el.innerHTML = state.recipeDraft.map((i, idx) => {
    const name = state.products.find(p => p.id === i.product_id)?.name;

    return `
      <div class="list-item">
        ${name} — ${i.quantity}

        <button onclick="removeIngredient(${idx})">❌</button>
      </div>
    `;
  }).join('');
}

window.removeIngredient = (index) => {
  state.recipeDraft.splice(index, 1);
  renderIngredients();
};

window.editRecipe = (id) => {
  const recipe = state.recipes.find(r => r.id === id);
  openRecipeModal(recipe);
};

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

async function onSaveRecipe() {
  let recipe = state.editingRecipe;

  const name = document.getElementById('recipeName').value;

  if (!name) {
    alert('Введи назву');
    return;
  }

  const portions = parseFloat(document.getElementById('recipePortions').value);

  if (!portions || portions <= 0) {
    alert('Вкажи кількість порцій');
    return;
  }
   
  // 🔥 якщо новий
  if (!recipe) {
    const created = await api.addRecipe({
      name,
      user_id: state.user.id
    });

    if (!created) {
      alert('Помилка створення рецепта');
      return;
    }

    recipe = created;
    state.editingRecipe = recipe;
  }

  if (state.recipeDraft.length === 0) {
    alert('Додай інгредієнти');
    return;
  }

  const version = await api.createRecipeVersion(
    recipe.id,
    state.user.id,
    portions
  );

  const ingredients = state.recipeDraft.map(i => ({
    recipe_version_id: version.id,
    product_id: i.product_id,
    quantity: i.quantity
  }));

  await api.addRecipeIngredients(ingredients);

  state.recipes = await api.getRecipes();
  ui.renderRecipes(state.recipes);

  closeRecipeModal();
}

function closeRecipeModal() {
  document.getElementById('recipeModal').style.display = 'none';

  state.editingRecipe = null;
  state.recipeDraft = [];

  document.getElementById('recipeName').value = '';
  document.getElementById('ingredientsList').innerHTML = '';
}
