import { supabase } from './supabase.js';

/* =========================
   CORE
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

export function logout() {
  return supabase.auth.signOut();
}

export function loginWithEmail(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin }
  });
}

export function loginWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin }
  });
}

/* =========================
   FAMILY
========================= */

export function getMyFamilies() {
  return handle(
    supabase
      .from('family_members')
      .select(`
        family_id,
        role,
        families (id, name)
      `)
      .eq('status', 'active')
  );
}

/* =========================
   PRODUCTS
========================= */

export function getProducts() {
  return handle(
    supabase.from('products').select('*').order('name')
  );
}

export function addProduct(data) {
  return handle(supabase.from('products').insert(data));
}

export function updateProduct(id, data) {
  return handle(
    supabase.from('products').update(data).eq('id', id)
  );
}

export function deleteProduct(id) {
  return handle(
    supabase.from('products').delete().eq('id', id)
  );
}

/* =========================
   DISHES
========================= */

export function getDishes(user_id) {
  return handle(
    supabase
      .from('dishes')
      .select(`
        *,
        recipe_variants (*)
      `)
      .eq('created_by', user_id)
      .order('name')
  );
}

export function addDish(data) {
  return handle(
    supabase.from('dishes').insert(data).select().single()
  );
}

/* =========================
   RECIPE VARIANTS
========================= */

export async function createRecipeVariant(dish_id, portions) {
  const user = await getSession();

  return handle(
    supabase
      .from('recipe_variants')
      .insert({
        dish_id,
        portions,
        created_by: user.id
      })
      .select()
      .single()
  );
}

export function updateRecipeVariant(id, data) {
  return handle(
    supabase.from('recipe_variants').update(data).eq('id', id)
  );
}

/* =========================
   INGREDIENTS
========================= */

export function getIngredientsByVariant(variant_id) {
  return handle(
    supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_version_id', variant_id)
  );
}

export function addIngredients(rows) {
  return handle(
    supabase.from('recipe_ingredients').insert(rows)
  );
}

export function deleteIngredientsByVariant(variant_id) {
  return handle(
    supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_version_id', variant_id)
  );
}

/* =========================
   MENU
========================= */

export function getMenuByDate(date, family_id) {
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

export function addMenuItem(payload) {
  return handle(
    supabase.from('menu_items').insert(payload)
  );
}

/* =========================
   INVENTORY
========================= */

export function getInventoryProducts(family_id) {
  return handle(
    supabase
      .from('inventory_products')
      .select('*')
      .eq('family_id', family_id)
  );
}

export function getInventoryDishes(family_id) {
  return handle(
    supabase
      .from('inventory_dishes')
      .select(`
        dish_id,
        portions,
        dishes (id, name)
      `)
      .eq('family_id', family_id)
  );
}

/* =========================
   ACTIONS
========================= */

export function cookDish({ family_id, dish_id, recipe_id, portions }) {
  return handle(
    supabase.from('inventory_movements').insert({
      family_id,
      dish_id,
      recipe_id,
      quantity: portions,
      movement_type: 'cook'
    })
  );
}

export async function consumeItem({
  family_id,
  product_id,
  recipe_id,
  dish_id,
  quantity
}) {
  if (product_id) {
    return handle(
      supabase.from('inventory_movements').insert({
        family_id,
        product_id,
        quantity: -quantity,
        movement_type: 'consume'
      })
    );
  }

  if (recipe_id && dish_id) {
    return handle(
      supabase.from('inventory_movements').insert({
        family_id,
        dish_id,
        recipe_id,
        quantity: -quantity,
        movement_type: 'consume'
      })
    );
  }

  throw new Error('Invalid consume payload');
}

/* =========================
   SHOPPING
========================= */

export function getShoppingList(family_id, from, to) {
  return handle(
    supabase.rpc('get_shopping_list_v3', {
      p_family_id: family_id,
      p_date_from: from,
      p_date_to: to
    })
  );
}

/* =========================
   APP LOAD
========================= */

export async function getAppData(family_id, user_id) {
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
