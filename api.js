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

export async function getRecipeFull(recipe_id) {
  const { data, error } = await supabase
    .from('recipe_versions')
    .select(`
      id,
      portions,
      created_at,
      recipe_ingredients (
        product_id,
        quantity
      )
    `)
    .eq('recipe_id', recipe_id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function getRecipes(family_id) {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      id,
      name,
      main_version_id,
      recipe_versions!recipe_versions_recipe_id_fkey (
        id,
        portions
      )
    `)
    .eq('family_id', family_id); // 🔥 було user_id

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function setMainRecipeVersion(recipe_id, version_id) {
  const { error } = await supabase
    .from('recipes')
    .update({ main_version_id: version_id })
    .eq('id', recipe_id);

  if (error) {
    console.error(error);
  }
}

export async function addRecipe(data) {
  const { data: res, error } = await supabase
    .from('recipes')
    .insert(data)
    .select()
    .single();

  if (error) throw error;

  return res;
}

export async function createRecipeVersion(recipe_id, user_id, portions) {
  const { data: version, error } = await supabase
    .from('recipe_versions')
    .insert({
      recipe_id,
      user_id,
      portions
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return null;
  }

  // 🔥 перевіряємо чи є вже main_version
  const { data: recipe } = await supabase
    .from('recipes')
    .select('main_version_id')
    .eq('id', recipe_id)
    .single();

  if (!recipe.main_version_id) {
    await supabase
      .from('recipes')
      .update({ main_version_id: version.id })
      .eq('id', recipe_id);
  }

  return version;
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

export async function getIngredientsByVersion(version_id) {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .eq('recipe_version_id', version_id);

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function deleteIngredientsByVersion(version_id) {
  return await handle(
    supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_version_id', version_id)
  );
}

export async function updateRecipeVersion(id, data) {
  return await handle(
    supabase
      .from('recipe_versions')
      .update(data)
      .eq('id', id)
  );
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

export async function getMenuByDate(date, family_id) {
  return await handle(
    supabase
      .from('menu_days')
      .select('id, menu_items(*)')
      .eq('date', date)
      .eq('family_id', family_id) // 🔥 було user_id
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

export async function getInventory(family_id) {
  return await handle(
    supabase
      .from('inventory')
      .select('*')
      .eq('family_id', family_id) // 🔥 було user_id
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

export async function getShoppingList(family_id, from, to) {
  return await handle(
    supabase.rpc('get_shopping_list_v2', {
      p_family_id: family_id, // 🔥 було p_user_id
      p_date_from: from,
      p_date_to: to
    })
  );
}

/* =========================
   🔥 APP INIT (NEW)
========================= */

export async function loadAppData(family_id) {
  try {
    const [
      products,
      recipes,
      inventory
    ] = await Promise.all([
      getProducts(),
      getRecipes(family_id),
      getInventory(family_id)
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

// =========================
// INVENTORY (DISHES)
// =========================

export async function getInventoryDishes(familyId) {
  const { data, error } = await supabase
    .from('inventory_dishes')
    .select(`
      dish_id,
      portions,
      dishes (id, name)
    `)
    .eq('family_id', familyId)
    .order('portions', { ascending: false });

  if (error) throw error;
  return data;
}

// =========================
// COOK DISH
// =========================

export async function cookDish({ family_id, dish_id, recipe_id, portions }) {
  const { error } = await supabase
    .from('inventory_movements')
    .insert({
      family_id,
      dish_id,
      recipe_id,
      quantity: portions,
      movement_type: 'cook'
    });

  if (error) throw error;
}

// =========================
// CONSUME FROM MENU
// =========================

export async function consumeFromMenu(familyId, menuDayId) {
  const { error } = await supabase.rpc('consume_from_menu', {
    p_family_id: familyId,
    p_menu_day_id: menuDayId
  });

  if (error) throw error;
}
