export const state = {
  /* =========================
     AUTH / CORE
  ========================= */
  user: null,
  familyId: null,

  /* =========================
     DATA
  ========================= */
  products: [],
  dishes: [], // 🔥 єдине джерело (не recipes!)

  menu: {
    currentDate: null,
    currentDay: null
  },

  inventory: {
    products: [],
    dishes: []
  },

  shopping: [],

  /* =========================
     UI STATE
  ========================= */

  ui: {
    loading: false,

    modals: {
      product: false,
      recipe: false,
      recipeView: false,
      menu: false
    },

    editing: {
      product: null,
      recipe: null,
      version: null
    },

    recipeDraft: [],

    viewRecipe: null,
    viewVersionIndex: 0,

    currentMeal: null
  }
};
