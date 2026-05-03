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
   
    await loadAppData(state.activeFamilyId, state.user.id);
    state.products = data.products;
    state.dishes = data.dishes; // 🔥 FIX
    state.inventory.products = data.inventoryProducts;
    state.inventory.dishes = data.inventoryDishes;

    appLoaded = true;

    renderApp();
    initTabs();

    ui.renderCalendar();

    const today = new Date().toISOString().slice(0,10);
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
  document.getElementById('closeRecipeModalBtn')?.addEventListener('click', () => {
    closeRecipeModal();
    if (state.viewRecipe) {
      openRecipeView(state.viewRecipe);
    }
  });
  document.getElementById('recipeModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'recipeModal') {
      closeRecipeModal();
      if (state.viewRecipe) openRecipeView(state.viewRecipe);
    }
  });
  document.getElementById('prevVersionBtn')?.addEventListener('click', () => {
    const versions = state.viewRecipe.recipe_variants;
    state.viewVersionIndex = (state.viewVersionIndex - 1 + versions.length) % versions.length;
    renderRecipeView();
  });
  document.getElementById('editVersionBtn')?.addEventListener('click', () => {
    const recipe = state.viewRecipe;
    const version = recipe.recipe_variants[state.viewVersionIndex];
    closeRecipeViewModal();
    openRecipeModal(recipe, version);
  });
  document.getElementById('nextVersionBtn')?.addEventListener('click', () => {
    const versions = state.viewRecipe.recipe_variants;
    state.viewVersionIndex = (state.viewVersionIndex + 1) % versions.length;
    renderRecipeView();
  });
  document.getElementById('closeRecipeViewBtn')?.addEventListener('click', () => {
    document.getElementById('recipeViewModal').style.display = 'none';
    state.viewRecipe = null;
  });
  document.getElementById('makeMainBtn')?.addEventListener('click', async () => {
    const recipe = state.viewRecipe;
    const version = recipe.recipe_variants[state.viewVersionIndex];
    await api.setMainRecipeVersion(recipe.id, version.id);
    // оновити локально
    recipe.main_version_id = version.id;
    renderRecipeView();
  });

     // ===== DATE =====
  document.getElementById('date')?.addEventListener('change', (e) => {
    loadDay(e.target.value);
  });

  document.getElementById('profileBtn').onclick = openProfile;
  document.getElementById('saveProfileBtn').onclick = async () => {
  const name = document.getElementById('profileName').value;

  await supabase.auth.updateUser({
    data: { full_name: name }
  });

  alert('Збережено');
  location.reload();
};


}

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
  const data = await api.getMenuByDate(date, state.familyId);

  state.menu.currentDate = date;
  state.menu.currentDay = data;

  ui.renderMenu(data);
}

window.loadDay = loadDay;

/* =========================
   INVENTORY
========================= */

async function refreshInventory() {
  const products = await api.getInventoryProducts(state.familyId);
  const dishes = await api.getInventoryDishes(state.familyId);

  state.inventory.products = products;
  state.inventory.dishes = dishes;

  ui.renderInventory(state.inventory);
}

/* =========================
   GLOBAL ACTIONS
========================= */

window.consume = async (product_id, recipe_id, dish_id, qty) => {
  await api.consumeItem({
    family_id: state.familyId,
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
    family_id: state.familyId,
    dish_id,
    recipe_id,
    portions
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
    meal: state.ui.currentMeal,
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
    state.familyId,
    date,
    date
  );

  ui.renderShopping(items);
}

window.openAddModal = (meal) => {
  state.ui.currentMeal = meal;
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
    select.innerHTML = state.dishes.map(r =>
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
    .upsert(
      { date, family_id: state.familyId },
      { onConflict: 'family_id,date' }
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
    //created_by: state.user.id,
    meal
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

  state.products = await api.getProducts(state.familyId);
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

  state.products = await api.getProducts(state.familyId);
  ui.renderProducts(state.products);

  closeProductModal();
}

window.deleteProduct = async (id) => {
  if (!confirm('Видалити продукт?')) return;

  await api.deleteProduct(id);

  state.products = await api.getProducts(state.familyId);
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
function openRecipeView(recipe) {
  state.viewRecipe = recipe;

  // знайти індекс main версії
  const idx = recipe.recipe_variants.findIndex(
    v => v.id === recipe.main_version_id
  );

  state.viewVersionIndex = idx >= 0 ? idx : 0;

  document.getElementById('recipeViewModal').style.display = 'flex';

  renderRecipeView();
} 

function renderRecipeView() {
  const recipe = state.viewRecipe;
  const versions = recipe.recipe_variants || [];

  if (versions.length === 0) return;

  const version = versions[state.viewVersionIndex];

  const isMain = version.id === recipe.main_version_id;

  document.getElementById('viewRecipeName').innerHTML = `
    ${recipe.name} ${isMain ? '⭐' : ''}
  `;  
  document.getElementById('viewRecipeMeta').innerText =
    `Порції: ${version.portions} | Версія ${state.viewVersionIndex + 1} з ${versions.length}`;

  renderViewIngredients(version.id);

  document.getElementById('makeMainBtn').style.display =
    isMain ? 'none' : 'block';
}

async function renderViewIngredients(versionId) {
  const ingredients = await api.getIngredientsByVariant(versionId);

  const el = document.getElementById('viewIngredients');

  el.innerHTML = ingredients.map(i => {
    const name = state.products.find(p => p.id === i.product_id)?.name || '???';

    return `<div>${name} — ${i.quantity}</div>`;
  }).join('');
}

async function openRecipeModal(recipe = null, version = null) {
  state.editingRecipe = recipe;
  state.editingVersion = version || null;


  document.getElementById('recipeModal').style.display = 'flex';
  document.getElementById('recipeName').value = recipe?.name || '';

  document.getElementById('deleteRecipeBtn').style.display = recipe ? 'block' : 'none';

  // 🔥 НОВЕ
  state.recipeDraft = [];

  if (version) {
    // 🔥 редагування конкретної версії
    document.getElementById('recipePortions').value = version.portions;

    const ingredients = await api.getIngredientsByVariant(version.id);

    state.recipeDraft = ingredients.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity
    }));

  } else if (recipe) {
    // 🔥 fallback (наприклад старий режим)
    document.getElementById('recipePortions').value = '';

    const ingredients = await api.getRecipeIngredients(recipe.id);

    state.recipeDraft = ingredients.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity
    }));

  } else {
    document.getElementById('recipePortions').value = '';
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
  const recipe = state.dishes.find(r => r.id === id);
  openRecipeModal(recipe);
};

async function onAddRecipe() {
  const name = document.getElementById('recipeName').value;

  if (!name) {
    alert('Введи назву');
    return;
  }

  await api.addDish({
    name,
    user_id: state.user.id
  });

  state.dishes = await api.getDish(state.familyId);
  ui.renderRecipes(state.dishes);
}

async function onSaveRecipe() {
  let recipe = state.editingRecipe;
  const version = state.editingVersion;

  const name = document.getElementById('recipeName').value;
  const portions = parseFloat(document.getElementById('recipePortions').value);

  if (!name) {
    alert('Введи назву');
    return;
  }

  if (!portions || portions <= 0) {
    alert('Вкажи порції');
    return;
  }

  if (!recipe) {
    const created = await api.addDish({
      name,
      user_id: state.user.id
    });

    recipe = created;
    state.editingRecipe = recipe;
  }

  if (state.recipeDraft.length === 0) {
    alert('Додай інгредієнти');
    return;
  }

  // 🔥 ВИБІР РЕЖИМУ
  let overwrite = false;

  if (version) {
    overwrite = confirm('Перезаписати цю версію? (ОК = так, Cancel = нова версія)');
  }

  if (overwrite && version) {
    // ♻️ OVERWRITE

    await api.deleteIngredientsByVariant(version.id);

    const ingredients = state.recipeDraft.map(i => ({
      recipe_version_id: version.id,
      product_id: i.product_id,
      quantity: i.quantity
    }));

    await api.addIngredients(ingredients);

    await api.updateRecipeVariant(version.id, {
      portions
    });

  } else {
    // 🆕 NEW VERSION

    const newVersion = await api.createRecipeVariant(
      recipe.id,
      state.user.id,
      portions
    );

    const ingredients = state.recipeDraft.map(i => ({
      recipe_version_id: newVersion.id,
      product_id: i.product_id,
      quantity: i.quantity
    }));

    await api.addIngredients(ingredients);
  }

  const updatedRecipes = await api.getDish(state.familyId);
  state.dishes = updatedRecipes;

  const fresh = updatedRecipes.find(r => r.id === recipe.id);
  ui.renderRecipes(state.dishes);

  closeRecipeModal();
  // 🔥 відкрити назад перегляд рецепта
  openRecipeView(fresh);
}

function closeRecipeModal() {
  document.getElementById('recipeModal').style.display = 'none';

  state.editingRecipe = null;
  state.recipeDraft = [];
  state.editingVersion = null;

  document.getElementById('recipeName').value = '';
  document.getElementById('ingredientsList').innerHTML = '';
}

/* =========================
   Profile
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
        ${f.name}
        ${f.role === 'owner' ? '⭐' : ''}
      </div>
    `).join('');
}

window.closeProfile = () => {
  document.getElementById('profileModal').style.display = 'none';
};
