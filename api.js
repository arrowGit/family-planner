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
      families (
        id,
        name
      )
    `)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

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

export async function updateProduct(id, data) {
  return await handle(
    supabase.from('products').update(data).eq('id', id)
  );
}

export async function deleteProduct(id) {
  return await handle(
    supabase.from('products').delete().eq('id', id)
  );
}

/* =========================
   DISHES
========================= */

export async function getDishes(user_id) {
  return await handle(
    supabase
      .from('dishes')
      .select('*')
      .eq('created_by', user_id)
      .order('name')
  );
}

export async function addDish(data) {
  return await handle(
    supabase.from('dishes').insert(data)
  );
}

export async function updateDish(id, data) {
  return await handle(
    supabase.from('dishes').update(data).eq('id', id)
  );
}

export async function deleteDish(id) {
  return await handle(
    supabase.from('dishes').delete().eq('id', id)
  );
}

/* =========================
   RECIPE VARIANTS
========================= */

export async function getRecipeVariants(dish_id) {
  return await handle(
    supabase
      .from('recipe_variants')
      .select('*')
      .eq('dish_id', dish_id)
      .order('created_at')
  );
}

export async function createRecipeVariant({ dish_id, portions }) {
  const user = await getSession();

  return await handle(
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

export async function updateRecipeVariant(id, data) {
  return await handle(
    supabase
      .from('recipe_variants')
      .update(data)
      .eq('id', id)
  );
}

/* =========================
   INGREDIENTS
========================= */

export async function getIngredients(recipe_id) {
  return await handle(
    supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', recipe_id)
  );
}

export async function addIngredients(rows) {
  return await handle(
    supabase
      .from('recipe_ingredients')
      .insert(rows)
  );
}

export async function deleteIngredients(recipe_id) {
  return await handle(
    supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipe_id)
  );
}

/* =========================
   MENU
========================= */

export async function getMenuByDate(date, family_id) {
  return await handle(
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

export async function addMenuItem(payload) {
  return await handle(
    supabase.from('menu_items').insert(payload)
  );
}

/* =========================
   INVENTORY
========================= */

export async function getInventoryProducts(family_id) {
  return await handle(
    supabase
      .from('inventory_products')
      .select('*')
      .eq('family_id', family_id)
  );
}

export async function getInventoryDishes(family_id) {
  return await handle(
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

export async function cookDish({ family_id, dish_id, recipe_id, portions }) {
  return await handle(
    supabase
      .from('inventory_movements')
      .insert({
        family_id,
        dish_id,
        recipe_id,
        quantity: portions,
        movement_type: 'cook'
      })
  );
}

export async function consumeFromMenu(family_id, menu_day_id) {
  return await handle(
    supabase.rpc('consume_from_menu', {
      p_family_id: family_id,
      p_menu_day_id: menu_day_id
    })
  );
}

/* =========================
   SHOPPING
========================= */

export async function getShoppingList(family_id, from, to) {
  return await handle(
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
  try {
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

  } catch (err) {
    console.error('loadAppData error:', err);
    throw err;
  }
}
