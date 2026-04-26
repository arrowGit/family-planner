import { supabase } from './supabase.js';

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

export async function login(email) {
  return supabase.auth.signInWithOtp({ email });
}

export async function loadProducts() {
  const { data } = await supabase.from('products').select('*').order('name');
  return data || [];
}

export async function loadRecipes() {
  const { data } = await supabase.from('recipes').select('*');
  return data || [];
}

export async function getMenu(date, user_id) {
  const { data } = await supabase
    .from('menu_days')
    .select('id, menu_items(*)')
    .eq('date', date)
    .eq('user_id', user_id)
    .single();

  return data;
}

export async function addMenuItem(payload) {
  return supabase.from('menu_items').insert(payload);
}

export async function loadInventory(user_id) {
  const { data } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', user_id);

  return data || [];
}

export async function consumeItem(payload) {
  return supabase.rpc('consume_item', payload);
}

export async function cookRecipe(payload) {
  return supabase.rpc('cook_recipe', payload);
}

export async function getShopping(user_id, from, to) {
  const { data } = await supabase.rpc('get_shopping_list_v2', {
    p_user_id: user_id,
    p_date_from: from,
    p_date_to: to
  });

  return data || [];
}
