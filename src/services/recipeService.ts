/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Recipe, DietType } from '../types/inventory';

export const INDIAN_ZERO_WASTE_RECIPES: Recipe[] = [
  {
    id: 'kadhi-pakora',
    title: 'Dahi Ki Kadhi with Besan Pakora',
    description: 'The ultimate Indian zero-waste classic! Turns sour curd (dahi) and leftover besan into a rich, comforting spiced yogurt curry.',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&q=80',
    timeMinutes: 25,
    servings: 4,
    difficulty: 'Easy',
    diet: 'veg',
    cuisine: 'North Indian',
    usedExpiringItems: ['Curd', 'Dahi', 'Coriander'],
    allIngredients: [
      { name: 'Sour Curd (Dahi)', amount: '1.5 cups (whisked)' },
      { name: 'Besan (Gram Flour)', amount: '4 tbsp' },
      { name: 'Turmeric (Haldi)', amount: '1/2 tsp' },
      { name: 'Mustard Seeds & Methi', amount: '1 tsp' },
      { name: 'Curry Leaves & Hing', amount: '1 sprig + pinch' },
      { name: 'Fresh Dhaniya (Coriander)', amount: 'Handful chopped' },
    ],
    instructions: [
      'Whisk sour curd and besan together with 3 cups water and haldi until completely smooth.',
      'Heat mustard oil or ghee in a kadai. Splutter rai, methi dana, hing, and curry leaves.',
      'Pour the yogurt mixture slowly while stirring continuously on medium flame until it comes to a boil.',
      'Simmer on low for 15-20 minutes until fragrant and creamy.',
      'Garnish generously with fresh coriander and serve with steamed rice.',
    ],
  },
  {
    id: 'tomato-rasam',
    title: 'Tangy Tomato Pepper Rasam',
    description: 'Rescues softening or overripe tomatoes into a soothing South Indian immunity booster and soup.',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80',
    timeMinutes: 15,
    servings: 3,
    difficulty: 'Quick',
    diet: 'veg',
    cuisine: 'South Indian',
    usedExpiringItems: ['Tomatoes', 'Coriander'],
    allIngredients: [
      { name: 'Soft/Ripe Tomatoes', amount: '3 medium (crushed)' },
      { name: 'Tamarind Pulp or Lemon', amount: '1 tbsp' },
      { name: 'Crushed Black Pepper & Jeera', amount: '1.5 tsp' },
      { name: 'Garlic Pods', amount: '4 crushed' },
      { name: 'Mustard Seeds & Curry Leaves', amount: 'For tadka' },
      { name: 'Coriander Stems & Leaves', amount: 'Handful' },
    ],
    instructions: [
      'Crush soft tomatoes with hands or fork in 2 cups of water with tamarind, turmeric, and salt.',
      'Add crushed pepper, cumin, and garlic pods. Bring to a rolling boil for 6-8 minutes.',
      'Prepare tadka: heat 1 tsp ghee, splutter mustard seeds, dry red chilli, and curry leaves.',
      'Pour tadka into the boiling rasam. Turn off flame immediately and top with coriander.',
      'Drink as a warm soup or mix with piping hot steamed rice and ghee.',
    ],
  },
  {
    id: 'bread-upma',
    title: 'Desi Masala Bread Upma',
    description: 'Breathes crunchy life into day-old or older bread slices using everyday Indian pantry spices and diced vegetables.',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80',
    timeMinutes: 12,
    servings: 2,
    difficulty: 'Quick',
    diet: 'veg',
    cuisine: 'Homestyle Street Food',
    usedExpiringItems: ['Bread', 'Tomatoes', 'Onions', 'Coriander'],
    allIngredients: [
      { name: 'Older Bread Slices', amount: '5-6 slices cubed' },
      { name: 'Onion & Tomato', amount: '1 each finely chopped' },
      { name: 'Green Chilli & Ginger', amount: '1 tsp chopped' },
      { name: 'Mustard Seeds & Curry Leaves', amount: '1 tsp' },
      { name: 'Haldi & Red Chilli Powder', amount: '1/2 tsp each' },
      { name: 'Lemon Juice', amount: '1 tbsp' },
    ],
    instructions: [
      'Toss bread cubes lightly in a dry pan until lightly toasted and crisp. Set aside.',
      'In the same pan, heat 1 tbsp oil. Add mustard seeds, curry leaves, and green chillies.',
      'Sauté chopped onions until golden, then add tomatoes and dry spices. Cook until soft.',
      'Splash 2 tbsp water into the masala, then fold in the toasted bread cubes until well coated.',
      'Drizzle lemon juice, garnish with dhaniya, and serve hot with chai.',
    ],
  },
  {
    id: 'paneer-bhurji',
    title: 'Homestyle Dhaba Paneer Bhurji',
    description: 'Perfect rescue recipe for expiring paneer! Quick, protein-packed scramble spiced with onions, tomatoes, and kasuri methi.',
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&q=80',
    timeMinutes: 15,
    servings: 2,
    difficulty: 'Quick',
    diet: 'veg',
    cuisine: 'North Indian',
    usedExpiringItems: ['Paneer', 'Tomatoes', 'Coriander'],
    allIngredients: [
      { name: 'Fresh Paneer', amount: '200g crumbled' },
      { name: 'Onion & Tomatoes', amount: '1 each chopped' },
      { name: 'Ginger-Garlic Paste', amount: '1 tsp' },
      { name: 'Pav Bhaji or Garam Masala', amount: '1 tsp' },
      { name: 'Butter / Ghee', amount: '1 tbsp' },
    ],
    instructions: [
      'Melt butter in a pan, add cumin and sauté ginger-garlic with finely sliced onions until transluscent.',
      'Add chopped tomatoes, turmeric, red chilli, and garam masala. Cook till tomatoes break down.',
      'Fold in the crumbled paneer gently on medium heat for 3-4 minutes (do not overcook).',
      'Finish with a dollop of butter and fresh coriander. Serve with rotis or bread pav.',
    ],
  },
  {
    id: 'palak-paratha',
    title: 'Stuffed Palak & Aloo Parathas',
    description: 'Rescues wilted palak (spinach) or methi leaves into nutritious, crispy whole wheat parathas.',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&q=80',
    timeMinutes: 20,
    servings: 3,
    difficulty: 'Easy',
    diet: 'veg',
    cuisine: 'North Indian',
    usedExpiringItems: ['Palak', 'Spinach', 'Atta'],
    allIngredients: [
      { name: 'Palak (Spinach)', amount: '1 bunch finely shredded' },
      { name: 'Aashirvaad Chakki Atta', amount: '2 cups' },
      { name: 'Boiled Potato (Optional)', amount: '1 mashed' },
      { name: 'Ajwain (Carom Seeds)', amount: '1/2 tsp' },
      { name: 'Green Chillies & Ginger', amount: '1 tsp minced' },
    ],
    instructions: [
      'Knead shredded spinach directly into atta with ajwain, salt, green chilli, and 1 tsp oil.',
      'Rest dough for 10 minutes, then roll into triangular or round flatbreads.',
      'Cook on a hot tawa with ghee or butter until both sides develop golden brown spots.',
      'Serve piping hot with dahi or pickle.',
    ],
  },
  {
    id: 'masala-egg-bhurji',
    title: 'Mumbai Street Style Egg Bhurji',
    description: 'Classic Mumbai egg scramble rescuing older eggs, softened tomatoes, and fresh coriander in 10 minutes.',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80',
    timeMinutes: 10,
    servings: 2,
    difficulty: 'Quick',
    diet: 'egg',
    cuisine: 'Mumbai Street Food',
    usedExpiringItems: ['Eggs', 'Tomatoes', 'Onions', 'Coriander'],
    allIngredients: [
      { name: 'Eggs', amount: '4 eggs whisked' },
      { name: 'Onion & Tomato', amount: '1 each finely diced' },
      { name: 'Green Chillies', amount: '2 chopped' },
      { name: 'Pav Bhaji Masala', amount: '1 tsp' },
      { name: 'Butter', amount: '1.5 tbsp' },
    ],
    instructions: [
      'Melt butter in a pan. Sauté green chillies and onions until lightly browned.',
      'Add tomatoes, turmeric, and pav bhaji masala. Cook till tomatoes turn mushy.',
      'Pour in the whisked eggs and scramble gently over medium-low heat until soft and moist.',
      'Sprinkle lots of fresh coriander and serve immediately with butter toasted pav.',
    ],
  },
];

export class RecipeService {
  constructor(private apiKey?: string) {}

  public async getRecipesForExpiringItems(
    expiringItemNames: string[],
    diet: DietType = 'veg'
  ): Promise<Recipe[]> {
    const lowerExpiring = expiringItemNames.map((n) => n.toLowerCase());

    // Filter local catalog by diet
    const matchingDiet = INDIAN_ZERO_WASTE_RECIPES.filter((r) => {
      if (diet === 'veg') return r.diet === 'veg';
      if (diet === 'egg') return r.diet === 'veg' || r.diet === 'egg';
      return true;
    });

    // Score recipes by how many expiring items they rescue
    const scored = matchingDiet.map((recipe) => {
      let score = 0;
      for (const exp of lowerExpiring) {
        if (
          recipe.usedExpiringItems.some((u) => u.toLowerCase().includes(exp) || exp.includes(u.toLowerCase())) ||
          recipe.allIngredients.some((i) => i.name.toLowerCase().includes(exp) || exp.includes(i.name.toLowerCase()))
        ) {
          score += 2;
        }
      }
      return { recipe, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.recipe);
  }
}
