import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';
import { supabase } from '../supabase/supabaseClient';

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
    const matchesDifficulty = selectedDifficulty === 'all' || recipe.difficulty === selectedDifficulty;
    
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
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  };

  const closeRecipeModal = () => {
    setIsModalOpen(false);
    setSelectedRecipe(null);
    document.body.style.overflow = 'unset'; // Restore scrolling
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
      <div className="space-y-1">
        {ingredients.slice(0, 3).map((ingredient, index) => {
          let ingredientText = '';
          
          if (typeof ingredient === 'object' && ingredient !== null) {
            // Handle object format: {qty, item, unit}
            if (ingredient.qty && ingredient.item) {
              ingredientText = `${ingredient.qty} ${ingredient.item}`;
              if (ingredient.unit) {
                ingredientText += ` ${ingredient.unit}`;
              }
            } else {
              // Handle other object formats
              ingredientText = JSON.stringify(ingredient);
            }
          } else if (typeof ingredient === 'string') {
            ingredientText = ingredient;
          } else {
            // Handle other types
            ingredientText = String(ingredient);
          }
          
          return (
            <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
              {ingredientText}
            </div>
          );
        })}
        {ingredients.length > 3 && (
          <div className="text-sm text-gray-500 dark:text-gray-500">
            +{ingredients.length - 3} {tr.ingredients.toLowerCase()}
          </div>
        )}
      </div>
    );
  };


  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} language-transition language-text-transition flex flex-col`} dir={direction} style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto custom-scrollbar ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900' : 'bg-gradient-to-br from-emerald-50 via-green-50 to-amber-50'}`} style={{ minHeight: 0 }}>
        {/* Hero Section */}
        <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${themeClasses.textPrimary} mb-3 sm:mb-4`}>
                {tr.title}
              </h2>
              <p className={`text-base sm:text-lg md:text-xl ${themeClasses.textSecondary} max-w-3xl mx-auto px-2`}>
                {tr.subtitle}
              </p>
            </div>

            {/* Search and Filters */}
            <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-4 sm:p-6 mb-6 sm:mb-8`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {/* Search */}
                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                    {tr.searchPlaceholder}
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full px-4 py-3 ${themeClasses.bgSecondary} ${themeClasses.borderPrimary} border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${themeClasses.textPrimary}`}
                    placeholder={tr.searchPlaceholder}
                  />
                </div>

                {/* Category Filter */}
                <div>
                  <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                    {tr.categories}
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className={`w-full px-4 py-3 ${themeClasses.bgSecondary} ${themeClasses.borderPrimary} border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${themeClasses.textPrimary}`}
                  >
                    {categories[language].map((category, index) => (
                      <option key={index} value={index === 0 ? 'all' : category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Difficulty Filter */}
                <div>
                  <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                    {tr.difficulty}
                  </label>
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                    className={`w-full px-4 py-3 ${themeClasses.bgSecondary} ${themeClasses.borderPrimary} border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${themeClasses.textPrimary}`}
                  >
                    <option value="all">{tr.all}</option>
                    <option value="קל">{tr.easy}</option>
                    <option value="בינוני">{tr.medium}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Recipes Grid */}
            {filteredRecipes.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🍽️</div>
                <h3 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-2`}>
                  {tr.noRecipes}
                </h3>
                <p className={`${themeClasses.textSecondary}`}>
                  {language === 'hebrew' ? 'נסה לשנות את החיפוש או הפילטרים' : 'Try changing your search or filters'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredRecipes.map((recipe) => (
                  <div key={recipe.id} className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} overflow-hidden ${themeClasses.shadowHover} transition-shadow duration-300 hover:-translate-y-2`}>
                    {/* Recipe Image */}
                    <div className="w-full relative overflow-hidden">
                      {getRecipeImage(recipe.title) ? (
                        <img 
                          src={getRecipeImage(recipe.title)} 
                          alt={recipe.title}
                          className="w-full h-auto"
                        />
                      ) : (
                        <div className="h-48 bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                          <span className="text-6xl">{recipe.image_emoji || '🍽️'}</span>
                        </div>
                      )}
                      <div className="absolute top-4 right-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          recipe.difficulty === 'קל' ? 'bg-green-100 text-green-800' :
                          recipe.difficulty === 'בינוני' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {recipe.difficulty === 'קל' ? tr.easy :
                           recipe.difficulty === 'בינוני' ? tr.medium : recipe.difficulty}
                        </span>
                      </div>
                    </div>

                    {/* Recipe Content */}
                    <div className="p-4 sm:p-6">
                      <div className="mb-3 sm:mb-4">
                        <h3 className={`text-lg sm:text-xl font-bold ${themeClasses.textPrimary} mb-2 line-clamp-2`}>
                          {recipe.title}
                        </h3>
                        <p className={`${themeClasses.textSecondary} text-xs sm:text-sm line-clamp-2`}>
                          {recipe.description}
                        </p>
                      </div>

                      {/* Recipe Stats */}
                      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                        <div className="text-center">
                          <div className={`text-lg font-bold ${themeClasses.textPrimary}`}>
                            {recipe.servings}
                          </div>
                          <div className={`text-xs ${themeClasses.textMuted}`}>
                            {tr.servings}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-lg font-bold ${themeClasses.textPrimary}`}>
                            {formatCookTime(recipe.cook_time)}
                          </div>
                          <div className={`text-xs ${themeClasses.textMuted}`}>
                            {tr.cookTime}
                          </div>
                        </div>
                      </div>

                      {/* Nutrition Info */}
                      <div className="grid grid-cols-3 gap-2 mb-3 sm:mb-4">
                        <div className="text-center">
                          <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>
                            {recipe.calories}
                          </div>
                          <div className={`text-xs ${themeClasses.textMuted}`}>
                            {tr.calories}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>
                            {formatNutrition(recipe.protein)}
                          </div>
                          <div className={`text-xs ${themeClasses.textMuted}`}>
                            {tr.protein}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>
                            {formatNutrition(recipe.carbs)}
                          </div>
                          <div className={`text-xs ${themeClasses.textMuted}`}>
                            {tr.carbs}
                          </div>
                        </div>
                      </div>

                      {/* Ingredients Preview */}
                      <div className="mb-4">
                        <h4 className={`text-sm font-semibold ${themeClasses.textPrimary} mb-2`}>
                          {tr.ingredients}
                        </h4>
                        {renderIngredients(recipe.ingredients)}
                      </div>

                      {/* Tags */}
                      {recipe.tags && Array.isArray(recipe.tags) && recipe.tags.length > 0 && (
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-1">
                            {recipe.tags.slice(0, 3).map((tag, index) => {
                              let tagText = '';
                              if (typeof tag === 'object' && tag !== null) {
                                tagText = JSON.stringify(tag);
                              } else {
                                tagText = String(tag);
                              }
                              
                              return (
                                <span key={index} className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full">
                                  {tagText}
                                </span>
                              );
                            })}
                            {recipe.tags.length > 3 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                +{recipe.tags.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* View Recipe Button */}
                      <button 
                        onClick={() => openRecipeModal(recipe)}
                        className={`w-full ${themeClasses.btnPrimary} text-white py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-300 hover:scale-105`}
                      >
                        {tr.viewRecipe}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Recipe Detail Modal */}
      {isModalOpen && selectedRecipe && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
          onClick={closeRecipeModal}
        >
          <div 
            className={`${themeClasses.bgCard} rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
            dir={direction}
          >
            {/* Modal Header with Full Image */}
            {getRecipeImage(selectedRecipe.title) ? (
              <div className="w-full relative">
                <img 
                  src={getRecipeImage(selectedRecipe.title)} 
                  alt={selectedRecipe.title}
                  className="w-full h-auto"
                />
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                        {selectedRecipe.title}
                      </h2>
                      <p className="text-white/90 text-sm sm:text-base">
                        {selectedRecipe.description}
                      </p>
                    </div>
                    <button
                      onClick={closeRecipeModal}
                      className="ml-4 p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
                    >
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="sticky top-0 z-10 bg-gradient-to-br from-emerald-400 to-teal-500 p-6 rounded-t-2xl">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-5xl">{selectedRecipe.image_emoji || '🍽️'}</span>
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-white">
                          {selectedRecipe.title}
                        </h2>
                        <p className="text-white/90 text-sm sm:text-base mt-1">
                          {selectedRecipe.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={closeRecipeModal}
                    className="ml-4 p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Stats - Only show if image exists, positioned below image */}
            {getRecipeImage(selectedRecipe.title) && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
                    <div className="text-white text-xl font-bold">{selectedRecipe.servings}</div>
                    <div className="text-white/80 text-xs">{tr.servings}</div>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
                    <div className="text-white text-xl font-bold">{selectedRecipe.cook_time}</div>
                    <div className="text-white/80 text-xs">{tr.minutes}</div>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
                    <div className="text-white text-xl font-bold">{selectedRecipe.difficulty}</div>
                    <div className="text-white/80 text-xs">{tr.difficulty}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats - For fallback (no image) */}
            {!getRecipeImage(selectedRecipe.title) && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
                  <div className="text-white text-xl font-bold">{selectedRecipe.servings}</div>
                  <div className="text-white/80 text-xs">{tr.servings}</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
                  <div className="text-white text-xl font-bold">{selectedRecipe.cook_time}</div>
                  <div className="text-white/80 text-xs">{tr.minutes}</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
                  <div className="text-white text-xl font-bold">{selectedRecipe.difficulty}</div>
                  <div className="text-white/80 text-xs">{tr.difficulty}</div>
                </div>
              </div>
            )}

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Nutrition Facts */}
              <div className={`${themeClasses.bgSecondary} rounded-xl p-4 sm:p-6`}>
                <h3 className={`text-xl font-bold ${themeClasses.textPrimary} mb-4 flex items-center gap-2`}>
                  <span>📊</span>
                  {tr.nutritionFacts}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>
                      {selectedRecipe.calories}
                    </div>
                    <div className={`text-sm ${themeClasses.textMuted}`}>{tr.calories}</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold text-red-500`}>
                      {selectedRecipe.protein}g
                    </div>
                    <div className={`text-sm ${themeClasses.textMuted}`}>{tr.protein}</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold text-blue-500`}>
                      {selectedRecipe.carbs}g
                    </div>
                    <div className={`text-sm ${themeClasses.textMuted}`}>{tr.carbs}</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold text-amber-500`}>
                      {selectedRecipe.fat}g
                    </div>
                    <div className={`text-sm ${themeClasses.textMuted}`}>{tr.fat}</div>
                  </div>
                </div>
              </div>

              {/* Ingredients */}
              <div className={`${themeClasses.bgSecondary} rounded-xl p-4 sm:p-6`}>
                <h3 className={`text-xl font-bold ${themeClasses.textPrimary} mb-4 flex items-center gap-2`}>
                  <span>🥘</span>
                  {tr.ingredients}
                </h3>
                <div className="space-y-3">
                  {selectedRecipe.ingredients && selectedRecipe.ingredients.map((ingredient, index) => {
                    let ingredientText = '';
                    if (typeof ingredient === 'object' && ingredient !== null) {
                      if (ingredient.qty && ingredient.item) {
                        ingredientText = `${ingredient.qty} ${ingredient.unit || ''} ${ingredient.item}`;
                      }
                    } else {
                      ingredientText = String(ingredient);
                    }
                    
                    return (
                      <div 
                        key={index} 
                        className={`flex items-center gap-3 p-3 ${themeClasses.bgCard} rounded-lg hover:scale-102 transition-transform duration-200`}
                      >
                        <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0"></div>
                        <span className={`${themeClasses.textPrimary} flex-1`}>{ingredientText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Instructions */}
              <div className={`${themeClasses.bgSecondary} rounded-xl p-4 sm:p-6`}>
                <h3 className={`text-xl font-bold ${themeClasses.textPrimary} mb-4 flex items-center gap-2`}>
                  <span>👨‍🍳</span>
                  {tr.instructions}
                </h3>
                <div className="space-y-4">
                  {selectedRecipe.instructions && selectedRecipe.instructions.map((instruction, index) => (
                    <div 
                      key={index} 
                      className={`flex gap-4 p-4 ${themeClasses.bgCard} rounded-lg hover:scale-102 transition-transform duration-200`}
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <p className={`${themeClasses.textPrimary} flex-1`}>{instruction}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cooking Tips */}
              <div className={`bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl p-4 sm:p-6 border-2 border-amber-300 dark:border-amber-700`}>
                <h3 className={`text-xl font-bold mb-3 flex items-center gap-2 ${
                  language === 'hebrew' ? 'flex-row-reverse' : ''
                } text-amber-900 dark:text-amber-100`}>
                  <span>💡</span>
                  {tr.cookingTips}
                </h3>
                <p className={`text-amber-800 dark:text-amber-200 leading-relaxed text-sm sm:text-base ${
                  language === 'hebrew' ? 'text-right' : 'text-left'
                }`}>
                  {getRandomTip()}
                </p>
              </div>

              {/* Tags */}
              {selectedRecipe.tags && selectedRecipe.tags.length > 0 && (
                <div>
                  <h3 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3 flex items-center gap-2`}>
                    <span>🏷️</span>
                    {tr.tags}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRecipe.tags.map((tag, index) => (
                      <span 
                        key={index} 
                        className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full text-sm font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={closeRecipeModal}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                {tr.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecipesPage;
