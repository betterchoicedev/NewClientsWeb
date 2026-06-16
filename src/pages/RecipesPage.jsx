import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';
import { motion, AnimatePresence } from 'framer-motion';

function RecipesPage() {
  const { language, direction, t } = useLanguage();
  const { isDarkMode, themeClasses } = useTheme();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isRtl = direction === 'rtl';

  // Translations
  const translations = {
    hebrew: {
      title: 'מתכונים',
      subtitle: 'גלה מתכונים בריאים וטעימים',
      searchPlaceholder: 'חפש מתכונים...',
      categories: 'קטגוריות',
      difficulty: 'רמת קושי',
      all: 'הכל',
      easy: 'קל',
      medium: 'בינוני',
      servings: 'מנות',
      cookTime: 'זמן בישול',
      calories: 'קלוריות',
      protein: 'חלבון',
      carbs: 'פחמימות',
      fat: 'שומן',
      ingredients: 'מרכיבים',
      instructions: 'הוראות הכנה',
      tags: 'תגיות',
      published: 'פורסם',
      noRecipes: 'לא נמצאו מתכונים',
      loading: 'טוען מתכונים...',
      error: 'שגיאה בטעינת המתכונים',
      viewRecipe: 'צפה במתכון',
      minutes: 'דקות',
      grams: 'גרם',
      close: 'סגור',
      nutritionFacts: 'ערכים תזונתיים',
      perServing: 'למנה',
      totalTime: 'זמן כולל',
      prepTime: 'זמן הכנה',
      cookingTips: 'טיפי בישול',
      tips: [
        'מומלץ להכין את המרכיבים מראש לחיסכון בזמן - מדידה וחיתוך מוקדמים יקלו על תהליך הבישול',
        'כדי לקבל ירקות פריכים יותר, הקפיאו אותם מיד לאחר הבישול במים קרים עם קרח',
        'תבלינים רעננים מוסיפים טעם עשיר יותר מתבלינים יבשים - השתמשו בהם בסוף הבישול',
        'חממו תמיד את המחבת או התנור לפני תחילת הבישול לתוצאות אחידות וטעימות יותר',
        'טעמו את האוכל לאורך כל תהליך הבישול - זה הסוד למנה מושלמת!',
        'שמרו על סכיני המטבח חדים - סכין חד בטוח יותר ומקל על העבודה במטבח',
        'הוסיפו מעט מלח למים של פסטה - זה משפר את הטעם וגורם למים לרתוח מהר יותר',
        'תנו לבשר לנוח 5-10 דקות אחרי הבישול - כך המיצים יתפזרו שווה והבשר יהיה עסיסי יותר'
      ]
    },
    english: {
      title: 'Recipes',
      subtitle: 'Discover healthy and delicious recipes',
      searchPlaceholder: 'Search recipes...',
      categories: 'Categories',
      difficulty: 'Difficulty',
      all: 'All',
      easy: 'Easy',
      medium: 'Medium',
      servings: 'Servings',
      cookTime: 'Cook Time',
      calories: 'Calories',
      protein: 'Protein',
      carbs: 'Carbs',
      fat: 'Fat',
      ingredients: 'Ingredients',
      instructions: 'Instructions',
      tags: 'Tags',
      published: 'Published',
      noRecipes: 'No recipes found',
      loading: 'Loading recipes...',
      error: 'Error loading recipes',
      viewRecipe: 'View Recipe',
      minutes: 'minutes',
      grams: 'g',
      close: 'Close',
      nutritionFacts: 'Nutrition Facts',
      perServing: 'Per Serving',
      totalTime: 'Total Time',
      prepTime: 'Prep Time',
      cookingTips: 'Cooking Tips',
      tips: [
        'Prep your ingredients beforehand - measuring and chopping in advance makes cooking smoother',
        'For crispier vegetables, shock them in ice water immediately after cooking to lock in color and texture',
        'Fresh herbs add richer flavor than dried - add them at the end of cooking for maximum impact',
        'Always preheat your pan or oven before cooking for even, consistent results',
        'Taste as you go - it\'s the secret to perfectly balanced dishes!',
        'Keep your knives sharp - a sharp knife is safer and makes kitchen work much easier',
        'Add a pinch of salt to pasta water - it enhances flavor and helps water boil faster',
        'Let meat rest 5-10 minutes after cooking - juices redistribute, making it more tender and juicy'
      ]
    }
  };

  const tr = translations[language];

  // Recipe image mapping - maps recipe titles to image filenames
  const recipeImageMap = {
    hebrew: {
      'שייק ירוק בריא': '/recipes/Healthy_Green_Smoothie.png',
      'סלט קינואה עם ירקות': '/recipes/Quinoa_Salad_with_Vegetables.png',
      'דג סלמון אפוי עם ירקות': '/recipes/Baked_Salmon_with_Vegetables.png',
      'פנקייק בננה בריא': '/recipes/Healthy_Banana_Pancakes.png',
      'פסטה עם ירקות ופסטו': '/recipes/Pasta_with_Vegetables_and_Pesto.png',
      'עוף בגריל עם ירקות': '/recipes/Grilled_Chicken_with_Vegetables.png',
      'גרנולה ביתית': '/recipes/Homemade_Granola.png',
      'שוקולד צמחי בריא': '/recipes/Healthy_Plant-Based_Chocolate.png',
      'מרק ירקות עשיר': '/recipes/Rich_Vegetable_Soup.png',
      'תה ירוק עם נענע': '/recipes/Green_Tea_with_Mint.png'
    },
    english: {
      'Healthy Green Smoothie': '/recipes/Healthy_Green_Smoothie.png',
      'Quinoa Salad with Vegetables': '/recipes/Quinoa_Salad_with_Vegetables.png',
      'Baked Salmon with Vegetables': '/recipes/Baked_Salmon_with_Vegetables.png',
      'Healthy Banana Pancakes': '/recipes/Healthy_Banana_Pancakes.png',
      'Pasta with Vegetables and Pesto': '/recipes/Pasta_with_Vegetables_and_Pesto.png',
      'Grilled Chicken with Vegetables': '/recipes/Grilled_Chicken_with_Vegetables.png',
      'Homemade Granola': '/recipes/Homemade_Granola.png',
      'Healthy Plant-Based Chocolate': '/recipes/Healthy_Plant-Based_Chocolate.png',
      'Rich Vegetable Soup': '/recipes/Rich_Vegetable_Soup.png',
      'Green Tea with Mint': '/recipes/Green_Tea_with_Mint.png'
    }
  };

  // Helper function to get recipe image
  const getRecipeImage = (recipeTitle) => {
    return recipeImageMap[language]?.[recipeTitle] || null;
  };

  // Categories mapping
  const categories = {
    hebrew: ['הכל', 'ארוחת בוקר', 'ארוחת צהריים', 'ארוחת ערב', 'נשנושים', 'קינוחים', 'משקאות'],
    english: ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Desserts', 'Beverages']
  };

  // Difficulty mapping
  const difficultyLevels = {
    hebrew: [{ val: 'all', label: 'הכל' }, { val: 'קל', label: 'קל' }, { val: 'בינוני', label: 'בינוני' }],
    english: [{ val: 'all', label: 'All' }, { val: 'Easy', label: 'Easy' }, { val: 'Medium', label: 'Medium' }]
  };

  // Mock recipe data
  const mockRecipes = {
    hebrew: [
      {
        id: 1,
        title: 'שייק ירוק בריא',
        description: 'שייק מזין עם תרד, בננה ואבוקדו - מושלם לארוחת בוקר',
        image_url: null,
        image_emoji: '🥤',
        cook_time: '5',
        servings: 2,
        difficulty: 'קל',
        category: 'ארוחת בוקר',
        calories: 180,
        protein: 8,
        carbs: 25,
        fat: 6,
        ingredients: [
          {qty: 1, item: 'בננה', unit: 'פרי'},
          {qty: 1, item: 'אבוקדו', unit: 'חצי'},
          {qty: 2, item: 'תרד', unit: 'כוסות'},
          {qty: 1, item: 'חלב שקדים', unit: 'כוס'},
          {qty: 1, item: 'דבש', unit: 'כף'}
        ],
        instructions: [
          'שופכים את כל המרכיבים לבלנדר',
          'מערבבים במהירות גבוהה למשך 30 שניות',
          'מגישים בכוס גבוהה עם קרח'
        ],
        tags: ['בריא', 'צמחוני', 'מהיר'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 2,
        title: 'סלט קינואה עם ירקות',
        description: 'סלט מזין וצבעוני עם קינואה, ירקות טריים ורוטב לימון',
        image_url: null,
        image_emoji: '🥗',
        cook_time: '25',
        servings: 4,
        difficulty: 'בינוני',
        category: 'ארוחת צהריים',
        calories: 320,
        protein: 12,
        carbs: 45,
        fat: 8,
        ingredients: [
          {qty: 1, item: 'קינואה', unit: 'כוס'},
          {qty: 2, item: 'מלפפון', unit: 'פרי'},
          {qty: 2, item: 'עגבנייה', unit: 'פרי'},
          {qty: 1, item: 'פלפל אדום', unit: 'פרי'},
          {qty: 0.5, item: 'בצל סגול', unit: 'פרי'},
          {qty: 2, item: 'לימון', unit: 'כפות מיץ'},
          {qty: 3, item: 'שמן זית', unit: 'כפות'}
        ],
        instructions: [
          'מבשלים את הקינואה לפי ההוראות על האריזה',
          'חותכים את כל הירקות לקוביות קטנות',
          'מכינים רוטב ממיץ לימון ושמן זית',
          'מערבבים הכל יחד ומגישים'
        ],
        tags: ['צמחוני', 'גלוטן חופשי', 'חלבון'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 3,
        title: 'דג סלמון אפוי עם ירקות',
        description: 'דג סלמון טעים עם ירקות שורש אפויים - ארוחת ערב מושלמת',
        image_url: null,
        image_emoji: '🐟',
        cook_time: '35',
        servings: 2,
        difficulty: 'בינוני',
        category: 'ארוחת ערב',
        calories: 450,
        protein: 35,
        carbs: 20,
        fat: 25,
        ingredients: [
          {qty: 2, item: 'פילה סלמון', unit: 'חתיכות'},
          {qty: 2, item: 'גזר', unit: 'פרי'},
          {qty: 2, item: 'תפוח אדמה', unit: 'פרי'},
          {qty: 1, item: 'ברוקולי', unit: 'ראש'},
          {qty: 3, item: 'שמן זית', unit: 'כפות'},
          {qty: 2, item: 'שום', unit: 'שן'},
          {qty: 1, item: 'לימון', unit: 'פרי'}
        ],
        instructions: [
          'מחממים תנור ל-200 מעלות',
          'מכינים את הירקות וחותכים לקוביות',
          'מניחים את הסלמון והירקות בתבנית',
          'מתבלים בשמן זית, שום ולימון',
          'אופים למשך 25-30 דקות'
        ],
        tags: ['אומגה 3', 'חלבון', 'דל פחמימות'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 4,
        title: 'פנקייק בננה בריא',
        description: 'פנקייקים טעימים ללא סוכר עם בננה ושיבולת שועל',
        image_url: null,
        image_emoji: '🥞',
        cook_time: '15',
        servings: 3,
        difficulty: 'קל',
        category: 'ארוחת בוקר',
        calories: 220,
        protein: 8,
        carbs: 35,
        fat: 5,
        ingredients: [
          {qty: 2, item: 'בננה', unit: 'פרי'},
          {qty: 1, item: 'ביצה', unit: 'פרי'},
          {qty: 0.5, item: 'שיבולת שועל', unit: 'כוס'},
          {qty: 0.25, item: 'חלב', unit: 'כוס'},
          {qty: 1, item: 'אבקת אפיה', unit: 'כפית'},
          {qty: 1, item: 'קינמון', unit: 'כפית'}
        ],
        instructions: [
          'מערבבים את הבננה במזלג עד לקבלת מחית',
          'מוסיפים את הביצה ומערבבים',
          'מוסיפים את שאר המרכיבים ומערבבים',
          'מטגנים במחבת חמה עם מעט שמן',
          'מגישים עם פירות טריים'
        ],
        tags: ['ללא סוכר', 'שיבולת שועל', 'מהיר'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 5,
        title: 'פסטה עם ירקות ופסטו',
        description: 'פסטה טרייה עם ירקות צבעוניים ורוטב פסטו ביתי',
        image_url: null,
        image_emoji: '🍝',
        cook_time: '20',
        servings: 4,
        difficulty: 'קל',
        category: 'ארוחת צהריים',
        calories: 380,
        protein: 15,
        carbs: 55,
        fat: 12,
        ingredients: [
          {qty: 400, item: 'פסטה', unit: 'גרם'},
          {qty: 2, item: 'זוקיני', unit: 'פרי'},
          {qty: 1, item: 'פלפל צהוב', unit: 'פרי'},
          {qty: 1, item: 'עגבניות שרי', unit: 'כוס'},
          {qty: 2, item: 'בזיליקום', unit: 'כוסות'},
          {qty: 2, item: 'אגוזי צנובר', unit: 'כפות'},
          {qty: 3, item: 'שמן זית', unit: 'כפות'},
          {qty: 2, item: 'שום', unit: 'שן'}
        ],
        instructions: [
          'מבשלים את הפסטה לפי ההוראות',
          'מכינים פסטו מבזיליקום, אגוזי צנובר ושמן זית',
          'מטגנים את הירקות במחבת',
          'מערבבים הכל יחד ומגישים'
        ],
        tags: ['צמחוני', 'פסטו', 'טרי'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 6,
        title: 'עוף בגריל עם ירקות',
        description: 'חזה עוף בגריל עם ירקות צלויים - ארוחה מאוזנת ומזינה',
        image_url: null,
        image_emoji: '🍗',
        cook_time: '30',
        servings: 3,
        difficulty: 'בינוני',
        category: 'ארוחת ערב',
        calories: 320,
        protein: 40,
        carbs: 15,
        fat: 8,
        ingredients: [
          {qty: 3, item: 'חזה עוף', unit: 'חתיכות'},
          {qty: 2, item: 'ברוקולי', unit: 'ראש'},
          {qty: 2, item: 'גזר', unit: 'פרי'},
          {qty: 1, item: 'פלפל אדום', unit: 'פרי'},
          {qty: 2, item: 'שמן זית', unit: 'כפות'},
          {qty: 2, item: 'רוזמרין', unit: 'כפות'},
          {qty: 1, item: 'לימון', unit: 'פרי'}
        ],
        instructions: [
          'מחממים גריל או תנור ל-200 מעלות',
          'מתבלים את העוף במלח, פלפל ורוזמרין',
          'מכינים את הירקות וחותכים לחתיכות',
          'מניחים הכל על הגריל או בתבנית',
          'צולים למשך 25-30 דקות'
        ],
        tags: ['חלבון', 'דל שומן', 'גריל'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 7,
        title: 'גרנולה ביתית',
        description: 'גרנולה טעימה וקריספית עם אגוזים ופירות יבשים',
        image_url: null,
        image_emoji: '🥣',
        cook_time: '40',
        servings: 8,
        difficulty: 'קל',
        category: 'נשנושים',
        calories: 280,
        protein: 8,
        carbs: 35,
        fat: 12,
        ingredients: [
          {qty: 3, item: 'שיבולת שועל', unit: 'כוסות'},
          {qty: 1, item: 'אגוזי מלך', unit: 'כוס'},
          {qty: 0.5, item: 'שקדים', unit: 'כוס'},
          {qty: 0.5, item: 'צימוקים', unit: 'כוס'},
          {qty: 0.25, item: 'דבש', unit: 'כוס'},
          {qty: 3, item: 'שמן קוקוס', unit: 'כפות'},
          {qty: 1, item: 'קינמון', unit: 'כפית'}
        ],
        instructions: [
          'מחממים תנור ל-150 מעלות',
          'מערבבים את כל המרכיבים היבשים',
          'מוסיפים דבש ושמן קוקוס',
          'מערבבים עד לקבלת תערובת אחידה',
          'אופים למשך 30 דקות, מערבבים כל 10 דקות'
        ],
        tags: ['אגוזים', 'דבש', 'בריא'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 8,
        title: 'שוקולד צמחי בריא',
        description: 'שוקולד טעים ללא חלב עם אגוזים ופירות יבשים',
        image_url: null,
        image_emoji: '🍫',
        cook_time: '15',
        servings: 6,
        difficulty: 'קל',
        category: 'קינוחים',
        calories: 180,
        protein: 4,
        carbs: 20,
        fat: 10,
        ingredients: [
          {qty: 0.5, item: 'קקאו', unit: 'כוס'},
          {qty: 0.25, item: 'שמן קוקוס', unit: 'כוס'},
          {qty: 2, item: 'דבש', unit: 'כפות'},
          {qty: 0.5, item: 'אגוזי מלך', unit: 'כוס'},
          {qty: 0.25, item: 'צימוקים', unit: 'כוס'},
          {qty: 1, item: 'וניל', unit: 'כפית'}
        ],
        instructions: [
          'ממיסים את שמן הקוקוס במיקרו או בסיר',
          'מוסיפים קקאו ודבש ומערבבים',
          'מוסיפים אגוזים וצימוקים',
          'יוצקים לתבנית ומקפיאים למשך שעה',
          'חותכים לחתיכות ומגישים'
        ],
        tags: ['ללא חלב', 'קקאו', 'קינוח בריא'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 9,
        title: 'מרק ירקות עשיר',
        description: 'מרק חם ומזין עם ירקות שורש ותבלינים',
        image_url: null,
        image_emoji: '🍲',
        cook_time: '45',
        servings: 6,
        difficulty: 'קל',
        category: 'ארוחת ערב',
        calories: 120,
        protein: 4,
        carbs: 25,
        fat: 2,
        ingredients: [
          {qty: 2, item: 'גזר', unit: 'פרי'},
          {qty: 2, item: 'תפוח אדמה', unit: 'פרי'},
          {qty: 1, item: 'בצל', unit: 'פרי'},
          {qty: 2, item: 'שום', unit: 'שן'},
          {qty: 1, item: 'ג\'ינג\'ר', unit: 'פרי קטן'},
          {qty: 1, item: 'ציר ירקות', unit: 'ליטר'},
          {qty: 2, item: 'שמן זית', unit: 'כפות'},
          {qty: 1, item: 'כוסברה', unit: 'כף'}
        ],
        instructions: [
          'מחממים שמן זית בסיר גדול',
          'מטגנים בצל ושום עד להזהבה',
          'מוסיפים את כל הירקות הקצוצים',
          'מוסיפים ציר ירקות ומביאים לרתיחה',
          'מבשלים על אש נמוכה למשך 30 דקות',
          'מתבלים ומגישים חם'
        ],
        tags: ['צמחוני', 'מחמם', 'דל קלוריות'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 10,
        title: 'תה ירוק עם נענע',
        description: 'תה מרענן ומרגיע עם נענע טרייה ודבש',
        image_url: null,
        image_emoji: '🍵',
        cook_time: '5',
        servings: 2,
        difficulty: 'קל',
        category: 'משקאות',
        calories: 15,
        protein: 0,
        carbs: 4,
        fat: 0,
        ingredients: [
          {qty: 2, item: 'שקיקי תה ירוק', unit: 'שקיקים'},
          {qty: 1, item: 'נענע טרייה', unit: 'כוס'},
          {qty: 2, item: 'דבש', unit: 'כפות'},
          {qty: 1, item: 'לימון', unit: 'פרי'},
          {qty: 2, item: 'מים רותחים', unit: 'כוסות'}
        ],
        instructions: [
          'מחממים מים עד לרתיחה',
          'מניחים שקיקי תה ירוק בכוסות',
          'יוצקים מים רותחים וממתינים 3 דקות',
          'מוסיפים עלי נענע טריים',
          'מתבלים בדבש ומיץ לימון',
          'מגישים חם'
        ],
        tags: ['אנטי אוקסידנטים', 'מרגיע', 'ללא קפאין'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      }
    ],
    english: [
      {
        id: 1,
        title: 'Healthy Green Smoothie',
        description: 'Nutritious smoothie with spinach, banana and avocado - perfect for breakfast',
        image_url: null,
        image_emoji: '🥤',
        cook_time: '5',
        servings: 2,
        difficulty: 'Easy',
        category: 'Breakfast',
        calories: 180,
        protein: 8,
        carbs: 25,
        fat: 6,
        ingredients: [
          {qty: 1, item: 'banana', unit: 'fruit'},
          {qty: 1, item: 'avocado', unit: 'half'},
          {qty: 2, item: 'spinach', unit: 'cups'},
          {qty: 1, item: 'almond milk', unit: 'cup'},
          {qty: 1, item: 'honey', unit: 'tbsp'}
        ],
        instructions: [
          'Add all ingredients to blender',
          'Blend on high speed for 30 seconds',
          'Serve in tall glass with ice'
        ],
        tags: ['healthy', 'vegetarian', 'quick'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 2,
        title: 'Quinoa Salad with Vegetables',
        description: 'Nutritious and colorful salad with quinoa, fresh vegetables and lemon dressing',
        image_url: null,
        image_emoji: '🥗',
        cook_time: '25',
        servings: 4,
        difficulty: 'Medium',
        category: 'Lunch',
        calories: 320,
        protein: 12,
        carbs: 45,
        fat: 8,
        ingredients: [
          {qty: 1, item: 'quinoa', unit: 'cup'},
          {qty: 2, item: 'cucumber', unit: 'fruit'},
          {qty: 2, item: 'tomato', unit: 'fruit'},
          {qty: 1, item: 'red bell pepper', unit: 'fruit'},
          {qty: 0.5, item: 'red onion', unit: 'fruit'},
          {qty: 2, item: 'lemon juice', unit: 'tbsp'},
          {qty: 3, item: 'olive oil', unit: 'tbsp'}
        ],
        instructions: [
          'Cook quinoa according to package instructions',
          'Chop all vegetables into small cubes',
          'Make dressing with lemon juice and olive oil',
          'Mix everything together and serve'
        ],
        tags: ['vegetarian', 'gluten-free', 'protein'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 3,
        title: 'Baked Salmon with Vegetables',
        description: 'Delicious salmon with roasted root vegetables - perfect dinner',
        image_url: null,
        image_emoji: '🐟',
        cook_time: '35',
        servings: 2,
        difficulty: 'Medium',
        category: 'Dinner',
        calories: 450,
        protein: 35,
        carbs: 20,
        fat: 25,
        ingredients: [
          {qty: 2, item: 'salmon fillets', unit: 'pieces'},
          {qty: 2, item: 'carrots', unit: 'fruit'},
          {qty: 2, item: 'potatoes', unit: 'fruit'},
          {qty: 1, item: 'broccoli', unit: 'head'},
          {qty: 3, item: 'olive oil', unit: 'tbsp'},
          {qty: 2, item: 'garlic', unit: 'cloves'},
          {qty: 1, item: 'lemon', unit: 'fruit'}
        ],
        instructions: [
          'Preheat oven to 200°C',
          'Prepare vegetables and cut into cubes',
          'Place salmon and vegetables in baking dish',
          'Season with olive oil, garlic and lemon',
          'Bake for 25-30 minutes'
        ],
        tags: ['omega-3', 'protein', 'low-carb'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 4,
        title: 'Healthy Banana Pancakes',
        description: 'Delicious sugar-free pancakes with banana and oats',
        image_url: null,
        image_emoji: '🥞',
        cook_time: '15',
        servings: 3,
        difficulty: 'Easy',
        category: 'Breakfast',
        calories: 220,
        protein: 8,
        carbs: 35,
        fat: 5,
        ingredients: [
          {qty: 2, item: 'bananas', unit: 'fruit'},
          {qty: 1, item: 'egg', unit: 'fruit'},
          {qty: 0.5, item: 'oats', unit: 'cup'},
          {qty: 0.25, item: 'milk', unit: 'cup'},
          {qty: 1, item: 'baking powder', unit: 'tsp'},
          {qty: 1, item: 'cinnamon', unit: 'tsp'}
        ],
        instructions: [
          'Mash bananas with fork until smooth',
          'Add egg and mix',
          'Add remaining ingredients and mix',
          'Cook in hot pan with little oil',
          'Serve with fresh fruits'
        ],
        tags: ['sugar-free', 'oats', 'quick'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 5,
        title: 'Pasta with Vegetables and Pesto',
        description: 'Fresh pasta with colorful vegetables and homemade pesto sauce',
        image_url: null,
        image_emoji: '🍝',
        cook_time: '20',
        servings: 4,
        difficulty: 'Easy',
        category: 'Lunch',
        calories: 380,
        protein: 15,
        carbs: 55,
        fat: 12,
        ingredients: [
          {qty: 400, item: 'pasta', unit: 'grams'},
          {qty: 2, item: 'zucchini', unit: 'fruit'},
          {qty: 1, item: 'yellow bell pepper', unit: 'fruit'},
          {qty: 1, item: 'cherry tomatoes', unit: 'cup'},
          {qty: 2, item: 'basil', unit: 'cups'},
          {qty: 2, item: 'pine nuts', unit: 'tbsp'},
          {qty: 3, item: 'olive oil', unit: 'tbsp'},
          {qty: 2, item: 'garlic', unit: 'cloves'}
        ],
        instructions: [
          'Cook pasta according to instructions',
          'Make pesto with basil, pine nuts and olive oil',
          'Sauté vegetables in pan',
          'Mix everything together and serve'
        ],
        tags: ['vegetarian', 'pesto', 'fresh'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 6,
        title: 'Grilled Chicken with Vegetables',
        description: 'Grilled chicken breast with roasted vegetables - balanced and nutritious meal',
        image_url: null,
        image_emoji: '🍗',
        cook_time: '30',
        servings: 3,
        difficulty: 'Medium',
        category: 'Dinner',
        calories: 320,
        protein: 40,
        carbs: 15,
        fat: 8,
        ingredients: [
          {qty: 3, item: 'chicken breast', unit: 'pieces'},
          {qty: 2, item: 'broccoli', unit: 'heads'},
          {qty: 2, item: 'carrots', unit: 'fruit'},
          {qty: 1, item: 'red bell pepper', unit: 'fruit'},
          {qty: 2, item: 'olive oil', unit: 'tbsp'},
          {qty: 2, item: 'rosemary', unit: 'tbsp'},
          {qty: 1, item: 'lemon', unit: 'fruit'}
        ],
        instructions: [
          'Preheat grill or oven to 200°C',
          'Season chicken with salt, pepper and rosemary',
          'Prepare vegetables and cut into pieces',
          'Place everything on grill or baking sheet',
          'Cook for 25-30 minutes'
        ],
        tags: ['protein', 'low-fat', 'grilled'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 7,
        title: 'Homemade Granola',
        description: 'Delicious and crispy granola with nuts and dried fruits',
        image_url: null,
        image_emoji: '🥣',
        cook_time: '40',
        servings: 8,
        difficulty: 'Easy',
        category: 'Snacks',
        calories: 280,
        protein: 8,
        carbs: 35,
        fat: 12,
        ingredients: [
          {qty: 3, item: 'oats', unit: 'cups'},
          {qty: 1, item: 'walnuts', unit: 'cup'},
          {qty: 0.5, item: 'almonds', unit: 'cup'},
          {qty: 0.5, item: 'raisins', unit: 'cup'},
          {qty: 0.25, item: 'honey', unit: 'cup'},
          {qty: 3, item: 'coconut oil', unit: 'tbsp'},
          {qty: 1, item: 'cinnamon', unit: 'tsp'}
        ],
        instructions: [
          'Preheat oven to 150°C',
          'Mix all dry ingredients',
          'Add honey and coconut oil',
          'Mix until evenly combined',
          'Bake for 30 minutes, stirring every 10 minutes'
        ],
        tags: ['nuts', 'honey', 'healthy'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 8,
        title: 'Healthy Plant-Based Chocolate',
        description: 'Delicious dairy-free chocolate with nuts and dried fruits',
        image_url: null,
        image_emoji: '🍫',
        cook_time: '15',
        servings: 6,
        difficulty: 'Easy',
        category: 'Desserts',
        calories: 180,
        protein: 4,
        carbs: 20,
        fat: 10,
        ingredients: [
          {qty: 0.5, item: 'cocoa powder', unit: 'cup'},
          {qty: 0.25, item: 'coconut oil', unit: 'cup'},
          {qty: 2, item: 'honey', unit: 'tbsp'},
          {qty: 0.5, item: 'walnuts', unit: 'cup'},
          {qty: 0.25, item: 'raisins', unit: 'cup'},
          {qty: 1, item: 'vanilla', unit: 'tsp'}
        ],
        instructions: [
          'Melt coconut oil in microwave or saucepan',
          'Add cocoa powder and honey, mix',
          'Add nuts and raisins',
          'Pour into mold and freeze for 1 hour',
          'Cut into pieces and serve'
        ],
        tags: ['dairy-free', 'cocoa', 'healthy dessert'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 9,
        title: 'Rich Vegetable Soup',
        description: 'Warm and nutritious soup with root vegetables and spices',
        image_url: null,
        image_emoji: '🍲',
        cook_time: '45',
        servings: 6,
        difficulty: 'Easy',
        category: 'Dinner',
        calories: 120,
        protein: 4,
        carbs: 25,
        fat: 2,
        ingredients: [
          {qty: 2, item: 'carrots', unit: 'fruit'},
          {qty: 2, item: 'potatoes', unit: 'fruit'},
          {qty: 1, item: 'onion', unit: 'fruit'},
          {qty: 2, item: 'garlic', unit: 'cloves'},
          {qty: 1, item: 'ginger', unit: 'small piece'},
          {qty: 1, item: 'vegetable broth', unit: 'liter'},
          {qty: 2, item: 'olive oil', unit: 'tbsp'},
          {qty: 1, item: 'cilantro', unit: 'tbsp'}
        ],
        instructions: [
          'Heat olive oil in large pot',
          'Sauté onion and garlic until golden',
          'Add all chopped vegetables',
          'Add vegetable broth and bring to boil',
          'Simmer on low heat for 30 minutes',
          'Season and serve hot'
        ],
        tags: ['vegetarian', 'warming', 'low-calorie'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      },
      {
        id: 10,
        title: 'Green Tea with Mint',
        description: 'Refreshing and soothing tea with fresh mint and honey',
        image_url: null,
        image_emoji: '🍵',
        cook_time: '5',
        servings: 2,
        difficulty: 'Easy',
        category: 'Beverages',
        calories: 15,
        protein: 0,
        carbs: 4,
        fat: 0,
        ingredients: [
          {qty: 2, item: 'green tea bags', unit: 'bags'},
          {qty: 1, item: 'fresh mint', unit: 'cup'},
          {qty: 2, item: 'honey', unit: 'tbsp'},
          {qty: 1, item: 'lemon', unit: 'fruit'},
          {qty: 2, item: 'boiling water', unit: 'cups'}
        ],
        instructions: [
          'Heat water until boiling',
          'Place green tea bags in cups',
          'Pour boiling water and wait 3 minutes',
          'Add fresh mint leaves',
          'Sweeten with honey and lemon juice',
          'Serve hot'
        ],
        tags: ['antioxidants', 'soothing', 'caffeine-free'],
        published: true,
        created_at: '2025-01-14',
        updated_at: '2025-01-14'
      }
    ]
  };

  useEffect(() => {
    loadRecipes();
  }, [language]);

  // Prevent body scrolling to avoid double scrollbars
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeRecipeModal();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isModalOpen]);

  const loadRecipes = () => {
    // Use mock data instead of database
    setRecipes(mockRecipes[language] || []);
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         recipe.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory;
    
    const engDifficultyFilter = selectedDifficulty === 'Easy' ? 'קל' : selectedDifficulty === 'Medium' ? 'בינוני' : selectedDifficulty;
    const matchesDifficulty = selectedDifficulty === 'all' || recipe.difficulty === engDifficultyFilter || recipe.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const formatCookTime = (cookTime) => {
    if (!cookTime) return '';
    return `${cookTime} ${tr.minutes}`;
  };

  const formatNutrition = (value, unit = tr.grams) => {
    if (!value) return '';
    return `${value}${unit}`;
  };

  const openRecipeModal = (recipe) => {
    setSelectedRecipe(recipe);
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden'; 
  };

  const closeRecipeModal = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'hidden'; 
  };

  const getRandomTip = () => {
    const tips = tr.tips || [];
    if (tips.length === 0) return '';
    const randomIndex = Math.floor(Math.random() * tips.length);
    return tips[randomIndex];
  };

  const renderIngredients = (ingredients) => {
    if (!ingredients || !Array.isArray(ingredients)) return null;
    
    return (
      <div className="space-y-2 mt-4">
        {ingredients.slice(0, 3).map((ingredient, index) => {
          let ingredientText = '';
          
          if (typeof ingredient === 'object' && ingredient !== null) {
            if (ingredient.qty && ingredient.item) {
              ingredientText = `${ingredient.qty} ${ingredient.unit ? ingredient.unit + ' ' : ''}${ingredient.item}`;
            } else {
              ingredientText = JSON.stringify(ingredient);
            }
          } else {
            ingredientText = String(ingredient);
          }
          
          return (
            <div key={index} className={`flex items-center gap-2.5 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">{ingredientText}</span>
            </div>
          );
        })}
        {ingredients.length > 3 && (
          <div className="text-xs font-semibold text-emerald-500 pt-1">
            +{ingredients.length - 3} {tr.ingredients.toLowerCase()}
          </div>
        )}
      </div>
    );
  };

  // --- Animation Variants ---
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 15 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} transition-colors duration-500 font-sans flex flex-col`} dir={direction} style={{ height: '100vh', overflow: 'hidden' }}>
      <Navigation />

      <main className={`flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${isDarkMode ? 'bg-[#0f172a]' : 'bg-slate-50/50'}`}>
        
        {/* Header Section */}
        <section className="pt-10 sm:pt-14 pb-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className={`text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {tr.title}
            </h2>
            <p className={`text-lg sm:text-xl font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {tr.subtitle}
            </p>
          </div>
        </section>

        {/* Filter & Search Bar */}
<section className={`sticky top-0 z-20 py-6 px-4 sm:px-6 lg:px-8 border-b transition-colors duration-300 ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
  <div className="max-w-7xl mx-auto space-y-5">
    {/* Search Input */}
    <div className="relative max-w-2xl mx-auto">
      <div className={`absolute inset-y-0 ${isRtl ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none`}>
        <svg className={`h-5 w-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={`w-full ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 rounded-2xl border-2 font-medium focus:ring-4 focus:outline-none transition-all duration-300 ${
          isDarkMode 
            ? 'bg-[#1e293b] border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20' 
            : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20'
        } shadow-sm hover:shadow-md`}
        placeholder={tr.searchPlaceholder}
      />
    </div>

    {/* Scrollable Categories (Pills) */}
    <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x">
      {categories[language].map((category, index) => {
        const value = index === 0 ? 'all' : category;
        const isActive = selectedCategory === value;
        return (
          <button
            key={index}
            onClick={() => setSelectedCategory(value)}
            className={`shrink-0 snap-center px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
              isActive 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md transform scale-105' 
                : isDarkMode 
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-transparent' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            {category}
          </button>
        );
      })}
    </div>

    {/* Difficulty Filter (Pills) */}
    <div className="flex justify-center gap-3">
      {difficultyLevels[language].map((diff) => {
        const isActive = selectedDifficulty === diff.val;
        return (
          <button
            key={diff.val}
            onClick={() => setSelectedDifficulty(diff.val)}
            className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              isActive
                ? isDarkMode 
                  ? 'bg-white text-slate-900 shadow-md' 
                  : 'bg-slate-800 text-white shadow-md'
                : isDarkMode 
                  ? 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700' 
                  : 'bg-slate-200/80 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
            }`}
          >
            {diff.label}
          </button>
        );
      })}
    </div>
  </div>
</section>

        {/* Recipes Grid */}
        <section className="py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {filteredRecipes.length === 0 ? (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} className="text-center py-20">
                <div className="text-7xl mb-6 opacity-80">🍽️</div>
                <h3 className={`text-2xl sm:text-3xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {tr.noRecipes}
                </h3>
                <p className={`text-lg font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {language === 'hebrew' ? 'נסה לשנות את החיפוש או הפילטרים למעלה' : 'Try adjusting your search or filters above'}
                </p>
              </motion.div>
            ) : (
              <motion.div 
                layout 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
              >
                <AnimatePresence mode="popLayout">
                  {filteredRecipes.map((recipe) => (
                    <motion.div 
                      layout
                      variants={cardVariants}
                      initial="hidden"
                      animate="show"
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                      key={recipe.id} 
                      className={`group flex flex-col rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-500 cursor-pointer ${isDarkMode ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-white border border-slate-100'}`}
                      onClick={() => openRecipeModal(recipe)}
                    >
                      {/* Image Wrapper */}
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-slate-700 dark:to-slate-800">
                        {getRecipeImage(recipe.title) ? (
                          <img 
                            src={getRecipeImage(recipe.title)} 
                            alt={recipe.title}
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-out"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center transform group-hover:scale-110 transition-transform duration-700 ease-out">
                            <span className="text-7xl drop-shadow-md">{recipe.image_emoji || '🍽️'}</span>
                          </div>
                        )}
                        
                        {/* Floating Badges inside Image */}
                        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-black tracking-wide shadow-lg backdrop-blur-md ${
                            recipe.difficulty === 'קל' || recipe.difficulty === 'Easy' ? 'bg-emerald-500/90 text-white' :
                            recipe.difficulty === 'בינוני' || recipe.difficulty === 'Medium' ? 'bg-amber-500/90 text-white' :
                            'bg-slate-800/90 text-white'
                          }`}>
                            {recipe.difficulty}
                          </span>
                          
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-md bg-white/90 text-slate-800 dark:bg-slate-900/90 dark:text-white">
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {formatCookTime(recipe.cook_time)}
                          </div>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-6 flex flex-col flex-grow">
                        <div className="mb-4 flex-grow">
                          <h3 className={`text-xl font-extrabold mb-2 line-clamp-2 leading-snug group-hover:text-emerald-500 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {recipe.title}
                          </h3>
                          <p className={`text-sm font-medium line-clamp-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {recipe.description}
                          </p>
                          {renderIngredients(recipe.ingredients)}
                        </div>

                        {/* Footer Stats */}
                        <div className={`pt-4 border-t flex items-center justify-between ${isDarkMode ? 'border-slate-700/50' : 'border-slate-100'}`}>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                              <span className={`text-lg font-black leading-none ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{recipe.calories}</span>
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{tr.calories}</span>
                            </div>
                            <div className={`w-px h-8 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                            <div className="flex flex-col">
                              <span className={`text-lg font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{recipe.servings}</span>
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{tr.servings}</span>
                            </div>
                          </div>
                          
                          <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-slate-700 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </section>
      </main>

      {/* Modern Recipe Detail Modal */}
      <AnimatePresence>
        {isModalOpen && selectedRecipe && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-slate-900/80 backdrop-blur-md"
            onClick={closeRecipeModal}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 30, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative max-w-5xl mx-auto ${isDarkMode ? 'bg-[#0f172a]' : 'bg-white'}`}
              onClick={(e) => e.stopPropagation()}
              dir={direction}
            >
              {/* Floating Close Button */}
              <button
                onClick={closeRecipeModal}
                className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} z-10 p-2.5 rounded-full backdrop-blur-md transition-transform hover:scale-110 shadow-lg ${getRecipeImage(selectedRecipe.title) ? 'bg-black/40 text-white hover:bg-black/60' : 'bg-white/80 text-slate-800 hover:bg-white dark:bg-slate-800/80 dark:text-white'}`}
              >
                <svg className="w-5 h-5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Scrollable Content inside modal */}
              <div className="overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                
                {/* Modal Header/Hero */}
                <div className="relative w-full min-h-[30vh] sm:min-h-[40vh] bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center overflow-hidden">
                  {getRecipeImage(selectedRecipe.title) ? (
                    <>
                      <img 
                        src={getRecipeImage(selectedRecipe.title)} 
                        alt={selectedRecipe.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>
                    </>
                  ) : (
                    <span className="text-8xl drop-shadow-2xl z-0">{selectedRecipe.image_emoji || '🍽️'}</span>
                  )}
                  
                  {/* Hero Text overlay positioned at bottom */}
                  <div className="absolute bottom-0 inset-x-0 p-6 sm:p-10 z-10">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-md">
                        {selectedRecipe.category}
                      </span>
                      {selectedRecipe.tags?.slice(0, 2).map((tag, i) => (
                        <span key={i} className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-bold rounded-full border border-white/20">
                          {typeof tag === 'object' ? JSON.stringify(tag) : String(tag)}
                        </span>
                      ))}
                    </div>
                    <h2 className={`text-3xl sm:text-5xl font-extrabold mb-3 leading-tight ${getRecipeImage(selectedRecipe.title) ? 'text-white' : (isDarkMode ? 'text-white' : 'text-slate-900')}`}>
                      {selectedRecipe.title}
                    </h2>
                    <p className={`text-base sm:text-lg font-medium max-w-2xl ${getRecipeImage(selectedRecipe.title) ? 'text-slate-200' : (isDarkMode ? 'text-slate-400' : 'text-slate-600')}`}>
                      {selectedRecipe.description}
                    </p>
                  </div>
                </div>

                {/* Body Details Grid */}
                <div className="p-6 sm:p-10">
                  {/* Quick Stats Bar */}
                  <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl mb-10 shadow-sm border ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center text-xl">🕒</div>
                      <div>
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{tr.totalTime}</div>
                        <div className={`text-sm font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatCookTime(selectedRecipe.cook_time)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center text-xl">👥</div>
                      <div>
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{tr.servings}</div>
                        <div className={`text-sm font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedRecipe.servings}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center text-xl">🔥</div>
                      <div>
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{tr.calories}</div>
                        <div className={`text-sm font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedRecipe.calories} kcal</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 flex items-center justify-center text-xl">💪</div>
                      <div>
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{tr.difficulty}</div>
                        <div className={`text-sm font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedRecipe.difficulty}</div>
                      </div>
                    </div>
                  </div>

                  {/* Main Grid: Ingredients & Instructions */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    
                    {/* Left Column: Ingredients & Macros */}
                    <div className="lg:col-span-4 space-y-10">
                      
                      {/* Ingredients */}
                      <div>
                        <h3 className={`text-2xl font-extrabold mb-6 flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {tr.ingredients}
                        </h3>
                        <ul className="space-y-4">
                          {selectedRecipe.ingredients?.map((ingredient, i) => {
                            let text = '';
                            if (typeof ingredient === 'object' && ingredient !== null) {
                              text = ingredient.qty && ingredient.item ? `${ingredient.qty} ${ingredient.unit ? ingredient.unit + ' ' : ''}${ingredient.item}` : JSON.stringify(ingredient);
                            } else {
                              text = String(ingredient);
                            }
                            return (
                              <li key={i} className={`flex items-start gap-4 p-3.5 rounded-2xl transition-colors ${isDarkMode ? 'bg-slate-800/60 hover:bg-slate-800' : 'bg-slate-50 hover:bg-emerald-50/50'}`}>
                                <div className="w-6 h-6 mt-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 flex justify-center items-center shrink-0 shadow-sm border border-emerald-200 dark:border-emerald-500/30">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                </div>
                                <span className={`font-semibold leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{text}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {/* Nutrition Macro breakdown */}
                      <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <h4 className={`text-lg font-extrabold mb-5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{tr.nutritionFacts} <span className="text-xs font-medium text-slate-400 ml-1">({tr.perServing})</span></h4>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className={`font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{tr.protein}</span>
                            <span className="font-black text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg">{selectedRecipe.protein}g</span>
                          </div>
                          <div className={`h-px w-full ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'}`}></div>
                          <div className="flex justify-between items-center">
                            <span className={`font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{tr.carbs}</span>
                            <span className="font-black text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-lg">{selectedRecipe.carbs}g</span>
                          </div>
                          <div className={`h-px w-full ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'}`}></div>
                          <div className="flex justify-between items-center">
                            <span className={`font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{tr.fat}</span>
                            <span className="font-black text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-lg">{selectedRecipe.fat}g</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Instructions */}
                    <div className="lg:col-span-8">
                      <h3 className={`text-2xl font-extrabold mb-8 flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {tr.instructions}
                      </h3>
                      <div className="space-y-8">
                        {selectedRecipe.instructions?.map((inst, i) => (
                          <div key={i} className="flex gap-5">
                            <div className="flex flex-col items-center">
                              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0 border-4 border-white dark:border-[#0f172a] z-10">
                                {i + 1}
                              </div>
                              {i !== selectedRecipe.instructions.length - 1 && (
                                <div className={`w-0.5 h-full mt-2 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-emerald-100'}`}></div>
                              )}
                            </div>
                            <div className="pb-8 pt-1.5">
                              <p className={`text-lg leading-relaxed font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {inst}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Random Tip Box */}
                      <div className={`mt-8 p-6 sm:p-8 rounded-3xl border-2 flex items-start gap-4 shadow-sm ${isDarkMode ? 'bg-amber-900/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="text-3xl drop-shadow-sm">💡</div>
                        <div>
                          <h4 className={`text-sm font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>{tr.cookingTips}</h4>
                          <p className={`font-semibold leading-relaxed ${isDarkMode ? 'text-amber-200/80' : 'text-amber-800'}`}>
                            {getRandomTip()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default RecipesPage;