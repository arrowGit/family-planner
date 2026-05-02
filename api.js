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
      emailRedirectTo: location.origin
    }
  });
}

export async function loginWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: location.origin
    }
  });
}

/* =========================
   FAMILY
========================= */

export async function createFamily(name = 'My family') {
  const { data: family, error } = await supabase
    .from('families')
    .insert({ name })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('family_members')
    .insert({
      family_id: family.id,
      role: 'owner'
    });

  return family;
}

export async function getMyFamily() {
  const { data, error } = await supabase
    .from('family_members')
    .select(`
      family_id,
      families (id, name)
    `)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.family_id,
    name: data.families?.name
  };
}

/* =========================
   PRODUCTS
========================= */

export async function getProducts() {
  return handle(
    supabase
      .from('products')
      .select('*')
      .order('name')
  );
}

export async function addProduct(data) {
  return handle(
    supabase
      .from('products')
      .insert(data)
      .select()
      .single()
  );
}

export async function updateProduct(id, data) {
  return handle(
    supabase
      .from('products')
      .update(data)
      .eq('id', id)
  );
}

export async function deleteProduct(id) {
  return handle(
    supabase
      .from('products')
      .delete()
      .eq('id', id)
  );
}

/* =========================
   DISHES (recipes)
========================= */

export async function getDishes(user_id) {
  return handle(
    supabase
      .from('dishes')
      .select(`
        *,
        recipe_versions (*)
      `)
      .eq('created_by', user_id)
      .order('name')
  );
}

export async function addDish(data) {
  return handle(
    supabase
      .from('dishes')
      .insert(data)
      .select()
      .single()
  );
}

export async function updateDish(id, data) {
  return handle(
    supabase
      .from('dishes')
      .update(data)
      .eq('id', id)
  );
}

export async function deleteDish(id) {
  return handle(
    supabase
      .from('dishes')
      .delete()
      .eq('id', id)
  );
}

/* =========================
   RECIPE VERSIONS
========================= */

export async function createRecipeVersion(dish_id, user_id, portions) {
  return handle(
    supabase
      .from('recipe_versions')
      .insert({
        dish_id,
        created_by: user_id,
        portions
      })
      .select()
      .single()
  );
}

export async function updateRecipeVersion(id, data) {
  return handle(
    supabase
      .from('recipe_versions')
      .update(data)
      .eq('id', id)
  );
}

export async function setMainRecipeVersion(dish_id, version_id) {
  return handle(
    supabase
      .from('dishes')
      .update({ main_version_id: version_id })
      .eq('id', dish_id)
  );
}

/* =========================
   INGREDIENTS
========================= */

export async function getIngredientsByVersion(version_id) {
  return handle(
    supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_version_id', version_id)
  );
}

export async function addRecipeIngredients(rows) {
  return handle(
    supabase
      .from('recipe_ingredients')
      .insert(rows)
  );
}

export async function deleteIngredientsByVersion(version_id) {
  return handle(
    supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_version_id', version_id)
  );
}

/* =========================
   MENU
========================= */

export async function getMenuByDate(date, family_id) {
  return handle(
    supabase
      .from('menu_days')
      .select(`
        id,
        menu_items (
          *,
          dishes (id, name),
          products (id, name)
        )
      `)
      .eq('date', date)
      .eq('family_id', family_id)
      .maybeSingle()
  );
}

export async function addMenuItem(data) {
  return handle(
    supabase
      .from('menu_items')
      .insert(data)
  );
}

/* =========================
   INVENTORY
========================= */

export async function getInventoryProducts(family_id) {
  return handle(
    supabase
      .from('inventory_products')
      .select('*')
      .eq('family_id', family_id)
  );
}

export async function getInventoryDishes(family_id) {
  return handle(
    supabase
      .from('inventory_dishes')
      .select(`
        dish_id,
        portions,
        dishes (id, name)
      `)
      .eq('family_id', family_id)
      .order('portions', { ascending: false })
  );
}

/* =========================
   ACTIONS
========================= */

export async function cookRecipe({
  p_family_id,
  p_recipe_id,
  p_portions
}) {
  return handle(
    supabase.rpc('cook_recipe', {
      p_family_id,
      p_recipe_id,
      p_portions
    })
  );
}

export async function consumeItem(payload) {
  return handle(
    supabase.rpc('consume_item', payload)
  );
}

/* =========================
   SHOPPING
========================= */

export async function getShoppingList(family_id, from, to) {
  return handle(
    supabase.rpc('get_shopping_list_v3', {
      p_family_id: family_id,
      p_date_from: from,
      p_date_to: to
    })
  );
}

/* =========================
   APP INIT
========================= */

export async function loadAppData(family_id, user_id) {
  const [
    products,
    dishes,
    inventoryProducts,
    inventoryDishes
  ] = await Promise.all([
    getProducts(),
    getDishes(user_id),
    getInventoryProducts(family_id),
    getInventoryDishes(family_id)
  ]);

  return {
    products,
    dishes,
    inventoryProducts,
    inventoryDishes
  };
}
