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
  const { data, error } = await supabase
    .from('families')
    .insert({ name })
    .select()
    .single();

  if (error) throw error;

  await supabase.from('family_members').insert({
    family_id: data.id,
    role: 'owner'
  });

  return data;
}

export async function getMyFamily() {
  const { data, error } = await supabase
    .from('family_members')
    .select(`
      family_id,
      families (
        id,
        name
      )
    `)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.family_id,
    name: data.families?.name
  };
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
  return handle(
    supabase.from('products').insert(data)
  );
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

export function updateDish(id, data) {
  return handle(
    supabase.from('dishes').update(data).eq('id', id)
  );
}

export function deleteDish(id) {
  return handle(
    supabase.from('dishes').delete().eq('id', id)
  );
}

/* =========================
   RECIPE VARIANTS
========================= */

export function getRecipeVariants(dish_id) {
  return handle(
    supabase
      .from('recipe_variants')
      .select('*')
      .eq('dish_id', dish_id)
      .order('created_at')
  );
}

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
    supabase
      .from('recipe_variants')
      .update(data)
      .eq('id', id)
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
      .eq('recipe_id', variant_id)
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
      .eq('recipe_id', variant_id)
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

export function upsertMenuDay(date, family_id) {
  return handle(
    supabase
      .from('menu_days')
      .upsert(
        { date, family_id },
        { onConflict: 'family_id,date' }
      )
      .select()
      .single()
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
   ACTIONS (КЛЮЧОВЕ 🔥)
========================= */

// 🍳 ГОТУВАННЯ = додати dish у склад
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

// ✔ СПОЖИВАННЯ ОДНОГО ITEM (з меню)
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

// 🍽 СПОЖИТИ ВЕСЬ ДЕНЬ
export function consumeDay(family_id, menu_day_id) {
  return handle(
    supabase.rpc('consume_from_menu', {
      p_family_id: family_id,
      p_menu_day_id: menu_day_id
    })
  );
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
