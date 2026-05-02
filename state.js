export const state = {
  user: null,
  familyId: null,

  products: [],
  dishes: [],

  inventory: {
    products: [],
    dishes: []
  },

  // UI state
  editingProduct: null,
  editingRecipe: null,
  editingVersion: null,

  recipeDraft: [],

  viewRecipe: null,
  viewVersionIndex: 0
};
