import { supabase } from './supabase.js';

/* =========================
   HELPERS
========================= */

async function handle(query) {
  const { data, error } = await query;

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

/* =========================
   AUTH
========================= */

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

export async function logout() {
  return supabase.auth.signOut();
}

export async function loginWithEmail(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'https://arrowgit.github.io/family-planner/'
    }
  });
}

export async function loginWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://arrowgit.github.io/family-planner/'
    }
  });
}

/* =========================
   PRODUCTS
========================= */

export async function getProducts() {
  return await handle(
    supabase
      .from('products')
      .select('*')
      .order('name')
  );
}

export async function addProduct(product) {
  return await handle(
    supabase.from('products').insert(product)
  );
}

export async function deleteProduct(id) {
  return await handle(
    supabase.from('products').delete().eq('id', id)
  );
}

export async function updateProduct(id, data) {
  return await handle(
    supabase.from('products').update(data).eq('id', id)
  );
}


/* =========================
   RECIPES
========================= */

export async function getRecipes() {
  return await handle(
    supabase
      .from('recipes')
      .select('*')
  );
}

export async function addRecipe(recipe) {
  return await handle(
    supabase.from('recipes').insert(recipe)
  );
}

export async function createRecipeVersion(recipe_id, user_id) {
  const { data, error } = await supabase
    .from('recipe_versions')
    .insert({ recipe_id, user_id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addRecipeIngredients(ingredients) {
  return await handle(
    supabase.from('recipe_ingredients').insert(ingredients)
  );
}

export async function getRecipeIngredients(recipe_id) {
  // беремо останню версію рецепта
  const { data: version } = await supabase
    .from('recipe_versions')
    .select('*')
    .eq('recipe_id', recipe_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!version) return [];

  const { data: ingredients } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .eq('recipe_version_id', version.id);

  return ingredients || [];
}

export async function deleteRecipe(id) {
  return await handle(
    supabase.from('recipes').delete().eq('id', id)
  );
}

export async function updateRecipe(id, data) {
  return await handle(
    supabase.from('recipes').update(data).eq('id', id)
  );
}

/* =========================
   MENU
========================= */

export async function getMenuByDate(date, user_id) {
  return await handle(
    supabase
      .from('menu_days')
      .select('id, menu_items(*)')
      .eq('date', date)
      .eq('user_id', user_id)
      .maybeSingle()
  );
}

export async function addMenuItem(payload) {
  return await handle(
    supabase
      .from('menu_items')
      .insert(payload)
  );
}

/* =========================
   INVENTORY / PANTRY
========================= */

export async function getInventory(user_id) {
  return await handle(
    supabase
      .from('inventory')
      .select('*')
      .eq('user_id', user_id)
  );
}

/* =========================
   ACTIONS (RPC)
========================= */

export async function consumeItem(payload) {
  return await handle(
    supabase.rpc('consume_item', payload)
  );
}

export async function cookRecipe(payload) {
  return await handle(
    supabase.rpc('cook_recipe', payload)
  );
}

/* =========================
   SHOPPING
========================= */

export async function getShoppingList(user_id, from, to) {
  return await handle(
    supabase.rpc('get_shopping_list_v2', {
      p_user_id: user_id,
      p_date_from: from,
      p_date_to: to
    })
  );
}

/* =========================
   🔥 APP INIT (NEW)
========================= */

export async function loadAppData(user_id) {
  try {
    const [
      products,
      recipes,
      inventory
    ] = await Promise.all([
      getProducts(),
      getRecipes(),
      getInventory(user_id)
    ]);

    return {
      products,
      recipes,
      inventory
    };

  } catch (err) {
    console.error('loadAppData error:', err);
    throw err;
  }
}
