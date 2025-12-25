import React, { createContext, useContext, useState } from 'react';

const LanguageContext = createContext();

// Translation object containing all text in both languages
const translations = {
  hebrew: {
    tagline: "בריאות ואיכות חיים",
    nav: {
      home: "בית",
      services: "שירותים",
      about: "אודות",
      contact: "יצירת קשר",
      blog: "בלוג"
    },
    buttons: {
      login: "התחבר",
      signup: "הרשמה",
      startNow: "התחלה עכשיו",
      learnMore: "למד עוד",
      selectPlan: "בחר תוכנית",
      readMore: "קרא עוד ←",
      startLesson: "התחלה עכשיו",
      download: "הורד עכשיו",
      viewLinks: "צפה בקישורים",
      discoverApps: "גלה אפליקציות",
      browseBooks: "עיין בספרים",
      sendMessage: "שליחת הודעה",
      shareAchievement: "שיתוף הישגים",
      sendNewMessage: "שליחת הודעה חדשה"
    },
    hero: {
      welcome: "המסע",
      subtitle: "לחיים בריאים וטובים יותר",
      description: "התחלה עכשיו",
      mainDescription: "אפשר להתחיל במסע של שינוי אמיתי לבריאות עם תובנות מבוססות בינה מלאכותית והדרכה מקצועית הבנויה במיוחד",
      fullDescription: "בואו נתחיל יחד במסע מרתק של שינוי אמיתי לבריאות מיטבית, עם כלים חכמים והדרכה אישית שמותאמת בדיוק לכם",
      features: [
        "גישה מלאה 24/7 למומחים ולבינה מלאכותית שפותחה על ידי דיאטנים קליניים ומומחי כושר מובילים",
        "נתמך על ידי דיאטנים ומאמני כושר מנוסים עם אלפי לקוחות מרוצים, מבוסס על מחקר מדעי מאומת ועדכני",
        "מיועד לשיפור ביצועים פיזיים ובריאות לטווח ארוך עבור ספורטאים, מאמנים מקצועיים ואנשים בעלי שאיפות גבוהות"
      ],
      buttons: {
        joinToday: "הצטרפות אלינו היום",
        joinGym: "הצטרפות עם מכון"
      },
      footer: {
        satisfiedClients: "לקוחות מרוצים",
        beginJourney: "התחלת המסע",
        verifiedSuccess: "הצלחה מאומתת"
      }
    },
    painSection: {
      title: "אנחנו רואים את הכאב",
      subtitle: "אנחנו מבינים את האתגרים כי עברנו אותם בעצמנו. הנה מה שמצאנו:",
      challenges: {
        unbalancedNutrition: {
          percentage: "87%",
          title: "תזונה לא מאוזנת",
          description: "אוכלים מה שזמין במקום מה שטוב לנו, ללא תכנון או הבנה של הצרכים התזונתיים שלנו"
        },
        lackOfMotivation: {
          percentage: "92%",
          title: "חוסר מוטיבציה",
          description: "מתחילים דיאטות חדשות כל שבוע, אבל מאבדים מוטיבציה אחרי כמה ימים"
        },
        noTimeForWorkouts: {
          percentage: "78%",
          title: "אין זמן לאימונים",
          description: "עבודה, משפחה, חיים - איפה למצוא זמן לספורט כשכל יום נראה עמוס מדי?"
        },
        noResults: {
          percentage: "85%",
          title: "אין תוצאות",
          description: "מנסים הכל אבל לא רואים שינוי אמיתי, מה שמוביל לתסכול וייאוש"
        }
      },
      frustration: {
        title: "אנחנו מבינים את התסכול",
        description: "כל אחד מאיתנו עבר את אותו מסע - ניסיונות כושלים, אכזבות והרגשה שאולי זה פשוט לא מיועד לנו.",
        callToAction: "אבל אנחנו כאן כדי לשנות את זה.",
        legend: {
          frustration: "תסכול",
          hope: "תקווה",
          results: "תוצאות"
        }
      },
      statistics: {
        dietFailure: {
          percentage: "30%",
          description: "הפחתה באירועים קרדיווסקולריים עם דיאטה ים תיכונית",
          source: "מחקר PREDIMED, N Engl J Med 2018",
          link: "אפשר לקרוא את המחקר"
        },
        motivationLoss: {
          percentage: "23%",
          description: "סיכון תמותה נמוך יותר עם פעילות גופנית סדירה",
          source: "מחקר הרווארד Alumni Health, JAMA 1995",
          link: "אפשר לקרוא את המחקר"
        },
        noWorkoutTime: {
          percentage: "40%",
          description: "סיכון תמותה מוגבר עם דפוסי שינה גרועים",
          source: "מחקר משך שינה, J Epidemiol Community Health 2002",
          link: "אפשר לקרוא את המחקר"
        }
      }
    },
    features: {
      title: "מה אנחנו מציעים",
      subtitle: "פתרונות מקיפים לבריאות ואורח חיים טוב יותר",
      nutrition: {
        title: "תזונה מאוזנת",
        description: "תוכניות תזונה מותאמות אישית לכל מטרה ויעד בריאותי"
      },
      fitness: {
        title: "כושר גופני",
        description: "תוכניות אימון יעילות ומגוונות לכל רמות הכושר"
      },
      tracking: {
        title: "מעקב התקדמות",
        description: "מעקב אחר ההתקדמות והשגת המטרות"
      }
    },
    athletesSection: {
      title: "ספורטאים ומקצוענים",
      subtitle: "תוכניות מיוחדות לספורטאים, שחקנים מקצועיים ומאמנים המחפשים את היתרון התחרותי",
      features: {
        advancedNutrition: {
          title: "תזונת ספורט מתקדמת",
          description: "תוכניות תזונה מותאמות לסוג הספורט, עומס האימונים ומטרות הביצועים",
          metric: "40% שיפור ביצועים"
        },
        performanceTracking: {
          title: "מעקב ביצועים מתקדם",
          description: "ניטור מדויק של מדדי כושר, התאוששות ומדדים פיזיולוגיים",
          metric: "25% שיפור התאוששות"
        },
        professionalSupport: {
          title: "תמיכה מקצועית 24/7",
          description: "דיאטנים מומחי ספורט זמינים לכל שאלה, התאמה או ייעוץ",
          metric: "99% זמינות"
        },
        competitionPrograms: {
          title: "תוכניות תחרות",
          description: "הכנה נפשית ופיזית לאירועים, טורנירים ומשחקים חשובים",
          metric: "85% הצלחה בתחרויות"
        }
      },
      whyChooseUs: {
        title: "למה ספורטאים בוחרים בנו?",
        reasons: {
          scientificKnowledge: {
            title: "ידע מדעי עדכני",
            description: "מבוסס על המחקר העדכני ביותר בתזונת ספורט וביצועים"
          },
          fullPersonalization: {
            title: "התאמה מלאה",
            description: "כל תוכנית נבנית ספציפית עבור הספורטאי והמטרות הספציפיות"
          },
          mentalSupport: {
            title: "תמיכה נפשית",
            description: "הדרכה פסיכולוגית וטכניקות ריכוז לביצועים אופטימליים"
          }
        }
      },
      testimonials: {
        david: {
          name: "דוד כהן",
          profession: "שחקן כדורגל מקצועי",
          quote: "BetterChoice שינה לי את המשחק. התזונה מותאמת בדיוק למה שאני צריך",
          metric: "30% שיפור סיבולת"
        },
        sarah: {
          name: "שרה לוי",
          profession: "רצה מרתון",
          quote: "המעקב המתקדם עזר לי להבין בדיוק איך הגוף שלי מגיב לאימונים",
          metric: "15% שיפור זמן אישי"
        }
      },
      callToAction: {
        title: "מוכן לקחת את הביצועים לשלב הבא?",
        subtitle: "הצטרפות לספורטאים מקצועיים שכבר משתמשים במערכת שלנו",
        button: "התחלת תוכנית ספורטאי",
        details: "תוכנית ניסיון חינם • התאמה אישית • תוצאות תוך 30 יום"
      }
    },
    services: {
      title: "השירותים שלנו",
      subtitle: "מגוון רחב של שירותים לבריאות ואורח חיים בריא",
      nutrition: {
        title: "תזונה מותאמת",
        description: "תוכניות תזונה אישיות עם דיאטנים מוסמכים"
      },
      training: {
        title: "אימונים אישיים",
        description: "מאמנים מקצועיים ותוכניות אימון מותאמות"
      },
      mental: {
        title: "בריאות הנפש",
        description: "טיפולים פסיכולוגיים וטכניקות הרפיה"
      },
      app: {
        title: "אפליקציה חכמה",
        description: "מעקב אחר התקדמות וטיפים יומיים"
      }
    },
    scienceSection: {
      title: "מדע ומומחיות",
      subtitle: "בשירות הבריאות",
      description: "השיטה שלנו מתבססת על מחקר מדעי מוכח ושנות ניסיון בתזונה ובכושר. אנו משלבים טכנולוגיה מתקדמת עם מומחיות אנושית",
      metrics: {
        scienceBased: {
          percentage: "95%",
          title: "מחקר מבוסס מדע",
          description: "שיטות מוכחות מדעית",
          subDescription: "שיעור הצלחה"
        },
        certifiedExperts: {
          count: "10+",
          title: "מומחים מוסמכים",
          description: "דיאטנים קליניים",
          subDescription: "שנות ניסיון"
        },
        provenResults: {
          percentage: "87%",
          title: "תוצאות מוכחות",
          description: "מעקב מדויק",
          subDescription: "שיפור משמעותי"
        },
        advancedTechnology: {
          availability: "24/7",
          title: "טכנולוגיה מתקדמת",
          description: "בינה מלאכותית חכמה",
          subDescription: "תמיכה זמינה"
        }
      },
      team: {
        title: "הצוות המקצועי שלנו",
        subtitle: "מומחים מוסמכים עם ניסיון נרחב בתזונה וכושר",
        members: {
          gal: {
            name: "גל בקר",
            title: "דיאטנית קלינית מוסמכת",
            description: "מומחית בתזונת ספורט וירידה במשקל עם שנות ניסיון עם אלפי מטופלים",
            experience: "ניסיון",
            experienceDetail: "תואר שני במדעי התזונה"
          },
          yarden: {
            name: "ירדן אובדיה",
            title: "דיאטנית קלינית ומאמן כושר",
            description: "אימוני כוח ותזונת ספורט",
            experience: "ניסיון",
            experienceDetail: "דיאטנית קלינית"
          }
        }
      },
      research: {
        title: "מחקר ומדע",
        subtitle: "השיטה שלנו מבוססת על מחקר מדעי מוכח וניסיון קליני",
        articles: {
          aiOptimization: {
            title: "אופטימיזציה של ירידה במשקל עם בינה מלאכותית",
            description: "ניסוי אקראי של מרשמי תוספי תזונה בחולים עם השמנת יתר",
            link: "קרא עוד"
          },
          personalizedNutrition: {
            title: "השפעת תזונה מותאמת אישית על הבריאות",
            description: "מחקר על הקשר בין תזונה מותאמת אישית לבריאות הכללית",
            link: "קרא עוד"
          },
          digitalTechnology: {
            title: "טכנולוגיה דיגיטלית לשיפור התנהגות בריאותית",
            description: "מחקר על שימוש בטכנולוגיה לשיפור אורח חיים בריא",
            link: "קרא עוד"
          }
        },
        keyPoints: {
          title: "נקודות מחקר מרכזיות",
          points: [
            "מחקר מבוסס על נתונים מאלפי משתמשים",
            "שיטות מוכחות מדעית לשיפור הבריאות",
            "ניטור רציף ותוצאות מדידות"
          ]
        }
      }
    },
    about: {
      title: "אודות BetterChoice",
      description1: "BetterChoice היא פלטפורמה מתקדמת לבריאות ואורח חיים בריא, המתבססת על מחקר מדעי וטכנולוגיה חדשנית. אנו מספקים פתרונות מקיפים לכל מי שרוצה לשפר את איכות החיים.",
      description2: "עם צוות של מומחים מובילים בתחום הבריאות, התזונה והכושר, אנו מציעים שירותים מותאמים אישית לכל מטרה ויעד בריאותי.",
      features: [
        "צוות מומחים מוסמכים",
        "טכנולוגיה מתקדמת",
        "תוצאות מוכחות"
      ],
      achievements: {
        title: "הצלחות שלנו",
        clients: "לקוחות מרוצים",
        success: "שיעור הצלחה",
        experience: "שנות ניסיון"
      }
    },
    professionalPlatform: {
      title: "הגיע הזמן",
      subtitle: "לשנות את הכללים",
      challenges: {
        title: "אנחנו מבינים את האתגרים",
        oldReality: {
          title: "המציאות הישנה",
          points: [
            "לא תמיד יש זמן לעצור ולנשום בין לקוח ללקוח",
            "הראש מלא - וקיים חשש לשכוח משהו חשוב",
            "עוד תפריט, עוד מעקב, עוד הודעה שלא היה זמן לענות עליה",
            "זה לא שאין מקצועיות - פשוט אין כלי שעובד"
          ]
        },
        newReality: {
          title: "המציאות החדשה",
          points: [
            "לפתע הכל במקום אחד - ויש רגיעה",
            "אין צורך לרוץ אחרי נתונים - הם באים",
            "יש קליניקה חכמה שמבינה בדיוק איך עובדים",
            "הלקוחות מקבלים חוויה אחרת. ומקבלים את עצמם בחזרה"
          ]
        }
      },
      benefits: {
        savesTime: {
          title: "חוסך זמן",
          description: "אוטומציה של תהליכים חוזרים וחיסכון בשעות עבודה"
        },
        improvesResults: {
          title: "משפר תוצאות",
          description: "מעקב מדויק ותוצאות מוכחות עם הלקוחות"
        },
        expandsAudience: {
          title: "מרחיב קהל",
          description: "הגעה לקהל יעד רחב יותר עם תוכן איכותי"
        },
        focusesOnGoals: {
          title: "מתמקד במטרות",
          description: "התמקדות במה שבאמת חשוב - הלקוחות"
        }
      },
      platform: {
        title: "BetterMedia - פלטפורמה מקצועית",
        features: {
          contentCreation: {
            title: "יצירת תוכן מקצועי",
            description: "פלטפורמה ליצירת תוכן איכותי"
          },
          wideDistribution: {
            title: "הפצה רחבה",
            description: "הגעה לקהל יעד רחב"
          },
          performanceTracking: {
            title: "מעקב ביצועים",
            description: "ניתוח מפורט של תוכן"
          }
        }
      },
      callToAction: {
        question: "מוכנים לשנות",
        highlightedQuestion: "את הפרקטיקה?",
        buttons: {
          requestDemo: "אפשר לבקש הדגמה",
          contactUs: "יצירת קשר"
        }
      },
      footer: "הצטרפות למאות מקצוענים שכבר שינו את אופן העבודה עם BetterChoice"
    },
    testimonials: {
      title: "מה הלקוחות שלנו אומרים",
      subtitle: "סיפורי הצלחה אמיתיים",
      sarah: {
        name: "שרה כהן",
        location: "תל אביב",
        text: "BetterChoice שינה לי את החיים! הצלחתי לרדת 15 קילו ולשמור על המשקל החדש. הצוות המקצועי והתמיכה הקבועה עזרו לי להשיג את המטרות שלי."
      },
      michael: {
        name: "מיכאל לוי",
        location: "ירושלים",
        text: "התוכנית האישית שקבלתי מותאמת בדיוק לצרכים שלי. האימונים מגוונים ומעניינים, והתוצאות נראות כבר אחרי שבועיים!"
      },
      rachel: {
        name: "רחל אברהם",
        location: "חיפה",
        text: "האפליקציה נוחה מאוד לשימוש והמעקב אחר ההתקדמות עוזר לי להישאר מוטיבציה. ממליצה בחום לכל מי שרוצה לשפר את הבריאות שלו!"
      }
    },
    pricing: {
      title: "תוכניות המנוי שלנו",
      subtitle: "אפשר לבחור את התוכנית המתאימה",
      basic: {
        title: "בסיסי",
        price: "₪99",
        period: "/חודש",
        features: [
          "תוכנית תזונה בסיסית",
          "אימונים מוקלטים",
          "מעקב בסיסי"
        ]
      },
      professional: {
        title: "מקצועי",
        price: "₪199",
        period: "/חודש",
        popular: "הכי פופולרי",
        features: [
          "תוכנית תזונה אישית",
          "אימונים אישיים",
          "מעקב מתקדם",
          "תמיכה 24/7"
        ]
      },
      premium: {
        title: "פרמיום",
        price: "₪299",
        period: "/חודש",
        features: [
          "הכל מהתוכנית המקצועית",
          "ייעוץ עם דיאטן",
          "בדיקות מעבדה",
          "טיפול פסיכולוגי"
        ]
      }
    },
    blog: {
      title: "הבלוג שלנו",
      subtitle: "טיפים ומאמרים מעודכנים לבריאות טובה יותר",
      posts: [
        {
          date: "15 בדצמבר 2024",
          title: "10 טיפים לתזונה בריאה בחורף",
          description: "כיצד לשמור על תזונה מאוזנת גם בעונת החורף הקרה...",
          link: "/blog/winter-nutrition-tips"
        },
        {
          date: "12 בדצמבר 2024",
          title: "אימונים יעילים בבית",
          description: "תרגילים פשוטים שאפשר לבצע בבית ללא ציוד מיוחד...",
          link: "/blog/home-workouts"
        },
        {
          date: "10 בדצמבר 2024",
          title: "הקשר בין שינה לבריאות",
          description: "מדוע שינה איכותית חשובה כל כך לבריאות הכללית...",
          link: "/blog/sleep-health-connection"
        }
      ]
    },
    stats: {
      users: "משתמשים פעילים",
      success: "שיעור הצלחה",
      support: "תמיכה זמינה",
      experts: "מומחים מוסמכים"
    },
    learning: {
      title: "ספריית הלמידה",
      subtitle: "אפשר להשלים שיעורים, לצפות בנושאי הקורסים ולחזור על שיעורים שכבר הושלמו",
      nutrition: {
        title: "שיעורי תזונה",
        description: "אפשר ללמוד על עקרונות התזונה הבריאה והמאוזנת",
        lessons: "12 שיעורים"
      },
      fitness: {
        title: "שיעורי כושר",
        description: "תוכניות אימון מפורטות לכל רמות הכושר",
        lessons: "8 שיעורים"
      },
      mental: {
        title: "בריאות הנפש",
        description: "טכניקות לניהול מתח ושיפור הרווחה הנפשית",
        lessons: "6 שיעורים"
      }
    },
    discussion: {
      title: "מרכז הדיונים",
      subtitle: "פרסם אתגרים, בקש תמיכה והתחבר עם מדריכים ומשתתפים אחרים",
      forums: {
        title: "פורומים פעילים",
        nutrition: {
          title: "תזונה וירידה במשקל",
          stats: "1,234 הודעות • 89 משתתפים"
        },
        fitness: {
          title: "אימונים וכושר",
          stats: "987 הודעות • 156 משתתפים"
        },
        mental: {
          title: "בריאות הנפש",
          stats: "756 הודעות • 67 משתתפים"
        }
      },
      recent: {
        title: "הודעות אחרונות",
        sarah: {
          name: "שרה כהן",
          time: "לפני 2 שעות",
          message: "איך להתמודד עם חשקים למתוק אחרי ארוחת הערב?"
        },
        michael: {
          name: "מיכאל לוי",
          time: "לפני 4 שעות",
          message: "תרגילי כוח מומלצים למתחילים?"
        }
      }
    },
    actionPlan: {
      title: "לוח תוכניות פעולה",
      subtitle: "אפשר להגדיר מטרות ספציפיות, לתכנן תוכניות ולעקוב אחר ההתקדמות",
      weekly: {
        title: "מטרות שבועיות",
        goals: [
          "אימון 3 פעמים בשבוע",
          "שתיית 8 כוסות מים",
          "7 שעות שינה בלילה"
        ]
      },
      monthly: {
        title: "תוכנית חודשית",
        week1: {
          period: "שבוע 1-2",
          task: "התחלת תוכנית התזונה"
        },
        week3: {
          period: "שבוע 3-4",
          task: "הוספת אימוני כוח"
        }
      },
      progress: {
        title: "מעקב התקדמות",
        weight: "משקל",
        workouts: "אימונים",
        water: "מים"
      }
    },
    messages: {
      title: "הודעות פרטיות",
      subtitle: "אפשר לתקשר באופן פרטי עם המדריכים והמומחים שלנו",
      guides: {
        title: "המדריכים",
        ronit: {
          name: 'ד"ר רונית דיאטנית',
          specialty: "מומחית תזונה"
        },
        alon: {
          name: "אלון מאמן כושר",
          specialty: "מומחה כושר גופני"
        },
        yael: {
          name: "יעל פסיכולוגית",
          specialty: "מומחית בריאות הנפש"
        }
      },
      recentMessages: {
        title: "הודעות אחרונות",
        ronit: {
          name: 'ד"ר רונית דיאטנית',
          time: "לפני שעה",
          message: "התוכנית התזונתית נראית מצוינת! איך מרגישים עם השינויים?"
        },
        alon: {
          name: "אלון מאמן כושר",
          time: "לפני 3 שעות",
          message: "חשוב לנוח בין האימונים - זה חלק חשוב מהתהליך!"
        }
      }
    },
    celebrations: {
      title: "חגיגות והישגים",
      subtitle: "אפשר לשתף ולחגוג אירועים והישגים עם הקהילה שלנו",
      sarah: {
        name: "שרה כהן",
        time: "לפני שעה",
        message: "הצלחתי לרדת 5 קילו החודש! תודה לכל הצוות המדהים!",
        comments: "23 תגובות"
      },
      michael: {
        name: "מיכאל לוי",
        time: "לפני 3 שעות",
        message: "ריצתי 10 קילומטר לראשונה בחיים! הרגשה מדהימה!",
        comments: "18 תגובות"
      },
      rachel: {
        name: "רחל אברהם",
        time: "לפני יום",
        message: "השלמתי 30 יום רצופים של אימונים! אף פעם לא חשבתי שאוכל!",
        comments: "31 תגובות"
      }
    },
    resources: {
      title: "משאבים וכלים",
      subtitle: "אפשר לגשת למגוון רחב של דפי עבודה, קישורים שימושיים וחומרים נוספים",
      worksheets: {
        title: "דפי עבודה",
        description: "תבניות למעקב אחר התקדמות ותיעוד מטרות"
      },
      links: {
        title: "קישורים שימושיים",
        description: "מקורות מידע אמינים וכלים דיגיטליים"
      },
      apps: {
        title: "אפליקציות מומלצות",
        description: "אפליקציות מובילות לבריאות וכושר"
      },
      books: {
        title: "ספרים מומלצים",
        description: "ספרים מובילים בתחום הבריאות והכושר"
      }
    },
    contact: {
      title: "יצירת קשר",
      subtitle: "נשמח לעזור להתחיל את המסע לבריאות טובה יותר",
      form: {
        title: "בואו נתחיל יחד",
        fullName: "שם מלא",
        email: "אימייל",
        phone: "טלפון",
        message: "הודעה"
      },
      details: {
        title: "פרטי התקשרות",
        phone: "טלפון",
        email: "אימייל",
        address: "כתובת",
        addressValue: "מסקיט 10, הרצליה"
      },
      hours: {
        title: "שעות פעילות",
        weekdays: "ראשון - חמישי:",
        friday: "שישי:",
        saturday: "שבת:",
        weekdaysHours: "08:00 - 20:00",
        fridayHours: "08:00 - 14:00",
        saturdayHours: "סגור"
      }
    },
    footer: {
      privacy: "מדיניות פרטיות",
      terms: "תנאי שימוש",
      copyright: "© 2025 BetterChoice. כל הזכויות שמורות."
    },
    profile: {
      title: "הפרופיל שלי",
      tabs: {
        profile: "פרופיל",
        myPlan: "התוכנית שלי",
        dailyLog: "יומן יומי",
        messages: "הודעות"
      },
      profileTab: {
        title: "פרטי הפרופיל",
        subtitle: "אפשר לעדכן את הפרטים האישיים",
        personalInfo: "מידע אישי",
        firstName: "שם פרטי",
        lastName: "שם משפחה",
        email: "אימייל",
        phone: "טלפון",
        birthDate: "תאריך לידה",
        gender: "מין",
        height: "גובה (ס\"מ)",
        weight: "משקל (ק\"ג)",
        activityLevel: "רמת פעילות",
        goals: "מטרות",
        saveChanges: "שמור שינויים",
        saved: "נשמר בהצלחה!",
        saving: "שומר...",
        activityLevels: {
          sedentary: "יושבני",
          lightlyActive: "פעיל קל",
          moderatelyActive: "פעיל בינוני",
          veryActive: "פעיל מאוד",
          extremelyActive: "פעיל מאוד מאוד"
        },
        genders: {
          male: "זכר",
          female: "נקבה",
          other: "אחר"
        }
      },
      myPlanTab: {
        title: "התוכנית התזונתית שלי",
        subtitle: "התוכנית המותאמת אישית",
        loading: "טוען תוכנית...",
        noPlan: "אין תוכנית זמינה",
        noPlanDescription: "התוכנית התזונתית תוצג כאן לאחר השלמת ההרשמה",
        calories: "קלוריות יומיות",
        protein: "חלבון (גרם)",
        carbs: "פחמימות (גרם)",
        fat: "שומן (גרם)",
        fiber: "סיבים (גרם)",
        meals: "ארוחות",
        breakfast: "ארוחת בוקר",
        lunch: "ארוחת צהריים",
        dinner: "ארוחת ערב",
        snacks: "חטיפים"
      },
      dailyLogTab: {
        title: "יומן המזון שלי",
        subtitle: "מעקב אחר מה שאוכלים",
        today: "היום",
        addFood: "הוספת מזון",
        searchPlaceholder: "חפש מזון...",
        calories: "קלוריות",
        protein: "חלבון",
        carbs: "פחמימות",
        fat: "שומן",
        fiber: "סיבים",
        total: "סה\"כ",
        remaining: "נותר",
        meals: {
          breakfast: "ארוחת בוקר",
          lunch: "ארוחת צהריים",
          dinner: "ארוחת ערב",
          snacks: "חטיפים",
          other: "אחר"
        },
        noEntries: "אין רשומות היום",
        addFirstEntry: "אפשר להוסיף את המזון הראשון היום!"
      },
      messagesTab: {
        title: "הודעות עם הבוט שלנו",
        subtitle: "שאל שאלות וקבל עצות מותאמות אישית",
        sendMessage: "שליחת הודעה",
        typeMessage: "הקלד הודעה...",
        loading: "טוען הודעות...",
        noMessages: "אין הודעות עדיין",
        startConversation: "אפשר להתחיל שיחה עם הבוט שלנו!",
        botName: "BetterChoice Bot",
        user: "משתמש",
        bot: "בוט",
        send: "שליחה",
        sending: "שולח...",
        thinking: "הבוט חושב...",
        error: "שגיאה בשליחת ההודעה"
      },
      knowledgePage: {
        title: "ידע והשראה",
        subtitle: "מחקרים מדעיים מובילים בתחום התזונה, הבריאות והפעילות הגופנית",
        sectionTitle: "מחקרים מדעיים מובילים",
        sectionDescription: "חמישה מחקרים מדעיים מוכחים ומעניינים שמראים את הקשר בין תזונה, פעילות גופנית ובריאות",
        keyFindings: "ממצאים עיקריים:",
        whyInteresting: "למה זה מעניין:",
        readFullStudy: "קרא במלואו",
        moreStudiesTitle: "מחקרים נוספים בקרוב",
        moreStudiesDescription: "אנו מוסיפים בקביעות מחקרים חדשים ומעודכנים מהספרות המדעית המובילה בעולם",
        backToHome: "חזרה לעמוד הבית"
      }
    }
  },
  english: {
    tagline: "Health and Healthy Lifestyle",
    nav: {
      home: "Home",
      services: "Services",
      about: "About",
      contact: "Contact",
      blog: "Blog"
    },
    buttons: {
      login: "Login",
      signup: "Sign Up",
      startNow: "Start Now",
      learnMore: "Learn More",
      selectPlan: "Select Plan",
      readMore: "Read More →",
      startLesson: "Start Now",
      download: "Download Now",
      viewLinks: "View Links",
      discoverApps: "Discover Apps",
      browseBooks: "Browse Books",
      sendMessage: "Send Message",
      shareAchievement: "Share Your Achievement",
      sendNewMessage: "Send New Message"
    },
    hero: {
      welcome: "Your Journey",
      subtitle: "To Healthier And More",
      description: "Beautiful Life",
      mainDescription: "Starts Now",
      fullDescription: "Embark on a transformative journey to wellness with AI-driven insights and expert guidance tailored for you",
      features: [
        "24/7 access to professionals and AI developed by clinical nutritionists and fitness professors.",
        "Backed by experienced dietitians and fitness trainers with thousands of satisfied clients, and grounded in verified, up-to-date scientific research.",
        "Aimed at enhancing physical performance and long-term health for athletes, professional trainers, and high-performing individuals."
      ],
      buttons: {
        joinToday: "Join us today",
        joinGym: "Join with your gym"
      },
      footer: {
        satisfiedClients: "Satisfied Clients",
        beginJourney: "Begin Your Journey",
        verifiedSuccess: "Verified Success"
      }
    },
    painSection: {
      title: "We see your pain",
      subtitle: "We understand your challenges because we've been through them ourselves. Here's what we found:",
      challenges: {
        unbalancedNutrition: {
          percentage: "87%",
          title: "Unbalanced nutrition",
          description: "Eating what's available instead of what's good for us, without planning or understanding nutritional needs"
        },
        lackOfMotivation: {
          percentage: "92%",
          title: "Lack of motivation",
          description: "Starting new diets every week, but losing motivation after a few days"
        },
        noTimeForWorkouts: {
          percentage: "78%",
          title: "No time for workouts",
          description: "Work, family, life - where to find time for exercise when every day seems too busy?"
        },
        noResults: {
          percentage: "85%",
          title: "No results",
          description: "Trying everything but not seeing real change, leading to frustration and despair"
        }
      },
      frustration: {
        title: "We understand your frustration",
        description: "Each of us has been through the same journey - failed attempts, disappointments, and feeling like maybe this just isn't for us.",
        callToAction: "But we're here to change that.",
        legend: {
          frustration: "Frustration",
          hope: "Hope",
          results: "Results"
        }
      },
      statistics: {
        dietFailure: {
          percentage: "30%",
          description: "reduction in cardiovascular events with Mediterranean diet",
          source: "PREDIMED Study, N Engl J Med 2018",
          link: "Read the research"
        },
        motivationLoss: {
          percentage: "23%",
          description: "lower mortality risk with regular exercise",
          source: "Harvard Alumni Health Study, JAMA 1995",
          link: "Read the research"
        },
        noWorkoutTime: {
          percentage: "40%",
          description: "increased mortality risk with poor sleep patterns",
          source: "Sleep Duration Study, J Epidemiol Community Health 2002",
          link: "Read the research"
        }
      }
    },
    athletesSection: {
      title: "Athletes & Professionals",
      subtitle: "Programs specially designed for athletes, professional players and trainers looking for the competitive edge",
      features: {
        advancedNutrition: {
          title: "Advanced Sports Nutrition",
          description: "Nutrition plans tailored to sport type, training load and performance goals",
          metric: "40% performance improvement"
        },
        performanceTracking: {
          title: "Advanced Performance Tracking",
          description: "Accurate monitoring of fitness metrics, recovery and physiological indicators",
          metric: "25% recovery improvement"
        },
        professionalSupport: {
          title: "24/7 Professional Support",
          description: "Expert sports dietitians available for any question, adjustment or consultation",
          metric: "99% availability"
        },
        competitionPrograms: {
          title: "Competition Programs",
          description: "Mental and physical preparation for events, tournaments and important games",
          metric: "85% competition success"
        }
      },
      whyChooseUs: {
        title: "Why do athletes choose us?",
        reasons: {
          scientificKnowledge: {
            title: "Up-to-date scientific knowledge",
            description: "Based on the latest research in sports nutrition and performance"
          },
          fullPersonalization: {
            title: "Full personalization",
            description: "Every program is built specifically for the athlete and specific goals"
          },
          mentalSupport: {
            title: "Mental support",
            description: "Psychological guidance and focus techniques for optimal performance"
          }
        }
      },
      testimonials: {
        david: {
          name: "David Cohen",
          profession: "Professional Football Player",
          quote: "BetterChoice changed my game. The nutrition is tailored exactly to what I need",
          metric: "30% endurance improvement"
        },
        sarah: {
          name: "Sarah Levy",
          profession: "Marathon Runner",
          quote: "The advanced tracking helped me understand exactly how my body responds to training",
          metric: "15% personal time improvement"
        }
      },
      callToAction: {
        title: "Ready to take your performance to the next level?",
        subtitle: "Join professional athletes already using our system",
        button: "Start Athlete Program",
        details: "Free trial program • Personal adaptation • Results within 30 days"
      }
    },
    features: {
      title: "What We Offer",
      subtitle: "Comprehensive solutions for health and better lifestyle",
      nutrition: {
        title: "Balanced Nutrition",
        description: "Personalized nutrition plans for every health goal and objective"
      },
      fitness: {
        title: "Physical Fitness",
        description: "Effective and diverse training programs for all fitness levels"
      },
      tracking: {
        title: "Progress Tracking",
        description: "Track your progress and achieve your goals"
      }
    },
    services: {
      title: "Our Services",
      subtitle: "Wide range of services for health and healthy lifestyle",
      nutrition: {
        title: "Customized Nutrition",
        description: "Personal nutrition plans with certified dietitians"
      },
      training: {
        title: "Personal Training",
        description: "Professional trainers and customized training programs"
      },
      mental: {
        title: "Mental Health",
        description: "Psychological treatments and relaxation techniques"
      },
      app: {
        title: "Smart App",
        description: "Progress tracking and daily tips"
      }
    },
    scienceSection: {
      title: "Science and Expertise",
      subtitle: "At Your Health Service",
      description: "Our method is based on proven scientific research and years of experience in nutrition and fitness. We combine advanced technology with human expertise",
      metrics: {
        scienceBased: {
          percentage: "95%",
          title: "Science-Based Research",
          description: "Scientifically proven methods",
          subDescription: "Success rate"
        },
        certifiedExperts: {
          count: "10+",
          title: "Certified Experts",
          description: "Clinical dietitians",
          subDescription: "Years of experience"
        },
        provenResults: {
          percentage: "87%",
          title: "Proven Results",
          description: "Accurate tracking",
          subDescription: "Significant improvement"
        },
        advancedTechnology: {
          availability: "24/7",
          title: "Advanced Technology",
          description: "Smart AI",
          subDescription: "Available support"
        }
      },
      team: {
        title: "Our Professional Team",
        subtitle: "Certified experts with extensive experience in nutrition and fitness",
        members: {
          gal: {
            name: "Gal Becker",
            title: "Licensed Clinical Dietitian",
            description: "Expert in sports nutrition and weight loss with years of experience with thousands of patients",
            experience: "Experience",
            experienceDetail: "Master's degree in Nutrition Sciences"
          },
          yarden: {
            name: "Yarden Ovadia",
            title: "Clinical Dietitian and Fitness Trainer",
            description: "Strength training and sports nutrition",
            experience: "Experience",
            experienceDetail: "Clinical Dietitian"
          }
        }
      },
      research: {
        title: "Research and Science",
        subtitle: "Our method is based on proven scientific research and clinical experience",
        articles: {
          aiOptimization: {
            title: "Optimizing Weight Loss with AI",
            description: "Randomized trial of dietary supplement prescriptions in obese patients",
            link: "Read More"
          },
          personalizedNutrition: {
            title: "Impact of Personalized Nutrition on Health",
            description: "Research on the connection between personalized nutrition and overall health",
            link: "Read More"
          },
          digitalTechnology: {
            title: "Digital Technology for Health Behavior Improvement",
            description: "Research on using technology to improve healthy lifestyle",
            link: "Read More"
          }
        },
        keyPoints: {
          title: "Key Research Points",
          points: [
            "Research based on data from thousands of users",
            "Scientifically proven methods for health improvement",
            "Continuous monitoring and measurable results"
          ]
        }
      }
    },
    about: {
      title: "About BetterChoice",
      description1: "BetterChoice is an advanced platform for health and healthy lifestyle, based on scientific research and innovative technology. We provide comprehensive solutions for anyone who wants to improve their quality of life.",
      description2: "With a team of leading experts in health, nutrition and fitness, we offer personalized services for every health goal and objective.",
      features: [
        "Certified expert team",
        "Advanced technology",
        "Proven results"
      ],
      achievements: {
        title: "Our Achievements",
        clients: "Satisfied Clients",
        success: "Success Rate",
        experience: "Years of Experience"
      }
    },
    professionalPlatform: {
      title: "It's Time to",
      subtitle: "Change the Rules",
      challenges: {
        title: "We Understand Your Challenges",
        oldReality: {
          title: "The Old Reality",
          points: [
            "You don't always have time to stop and breathe between clients",
            "Your head is full – and you're afraid to forget something important",
            "Another menu, another follow-up, another message you didn't have time to answer",
            "It's not that you're not professional – you just don't have a tool that works for you"
          ]
        },
        newReality: {
          title: "The New Reality",
          points: [
            "Suddenly everything is in one place – and you're calm",
            "No need to chase after data – it comes to you",
            "You have a smart clinic that understands exactly how you work",
            "Clients get a different experience. And you get yourself back"
          ]
        }
      },
      benefits: {
        savesTime: {
          title: "Saves Time",
          description: "Automation of repetitive processes and saving hours of work"
        },
        improvesResults: {
          title: "Improves Results",
          description: "Accurate tracking and proven results with your clients"
        },
        expandsAudience: {
          title: "Expands Audience",
          description: "Reach a wider target audience with quality content"
        },
        focusesOnGoals: {
          title: "Focuses on Goals",
          description: "Focus on what really matters - your clients"
        }
      },
      platform: {
        title: "BetterMedia - Professional Platform",
        features: {
          contentCreation: {
            title: "Professional Content Creation",
            description: "Platform for creating quality content"
          },
          wideDistribution: {
            title: "Wide Distribution",
            description: "Reach a wide target audience"
          },
          performanceTracking: {
            title: "Performance Tracking",
            description: "Detailed content analysis"
          }
        }
      },
      callToAction: {
        question: "Ready to Change",
        highlightedQuestion: "Your Practice?",
        buttons: {
          requestDemo: "Request Demo",
          contactUs: "Contact Us"
        }
      },
      footer: "Join hundreds of professionals who have already changed the way they work with BetterChoice"
    },
    testimonials: {
      title: "What Our Clients Say",
      subtitle: "Real success stories",
      sarah: {
        name: "Sarah Cohen",
        location: "Tel Aviv",
        text: "BetterChoice changed my life! I managed to lose 15 kilos and maintain my new weight. The professional team and constant support helped me achieve my goals."
      },
      michael: {
        name: "Michael Levy",
        location: "Jerusalem",
        text: "The personal program I received is perfectly tailored to my needs. The workouts are varied and interesting, and the results are visible after just two weeks!"
      },
      rachel: {
        name: "Rachel Abraham",
        location: "Haifa",
        text: "The app is very user-friendly and tracking my progress helps me stay motivated. I highly recommend it to anyone who wants to improve their health!"
      }
    },
    pricing: {
      title: "Our Subscription Plans",
      subtitle: "Choose the plan that suits you",
      basic: {
        title: "Basic",
        price: "$29",
        period: "/month",
        features: [
          "Basic nutrition plan",
          "Recorded workouts",
          "Basic tracking"
        ]
      },
      professional: {
        title: "Professional",
        price: "$59",
        period: "/month",
        popular: "Most Popular",
        features: [
          "Personal nutrition plan",
          "Personal training",
          "Advanced tracking",
          "24/7 support"
        ]
      },
      premium: {
        title: "Premium",
        price: "$89",
        period: "/month",
        features: [
          "Everything from Professional plan",
          "Dietitian consultation",
          "Lab tests",
          "Psychological treatment"
        ]
      }
    },
    blog: {
      title: "Our Blog",
      subtitle: "Updated tips and articles for better health",
      posts: [
        {
          date: "December 15, 2024",
          title: "10 Tips for Healthy Winter Nutrition",
          description: "How to maintain a balanced diet even during the cold winter season...",
          link: "/blog/winter-nutrition-tips"
        },
        {
          date: "December 12, 2024",
          title: "Effective Home Workouts",
          description: "Simple exercises you can do at home without special equipment...",
          link: "/blog/home-workouts"
        },
        {
          date: "December 10, 2024",
          title: "The Connection Between Sleep and Health",
          description: "Why quality sleep is so important for overall health...",
          link: "/blog/sleep-health-connection"
        }
      ]
    },
    stats: {
      users: "Active Users",
      success: "Success Rate",
      support: "Available Support",
      experts: "Certified Experts"
    },
    learning: {
      title: "Learning Library",
      subtitle: "Complete your lessons, watch lesson topics and review lessons you've already completed",
      nutrition: {
        title: "Nutrition Lessons",
        description: "Learn about principles of healthy and balanced nutrition",
        lessons: "12 lessons"
      },
      fitness: {
        title: "Fitness Lessons",
        description: "Detailed training programs for all fitness levels",
        lessons: "8 lessons"
      },
      mental: {
        title: "Mental Health",
        description: "Techniques for stress management and improving mental well-being",
        lessons: "6 lessons"
      }
    },
    discussion: {
      title: "Discussion Center",
      subtitle: "Post challenges, request support and connect with guides and other participants",
      forums: {
        title: "Active Forums",
        nutrition: {
          title: "Nutrition and Weight Loss",
          stats: "1,234 messages • 89 participants"
        },
        fitness: {
          title: "Training and Fitness",
          stats: "987 messages • 156 participants"
        },
        mental: {
          title: "Mental Health",
          stats: "756 messages • 67 participants"
        }
      },
      recent: {
        title: "Recent Messages",
        sarah: {
          name: "Sarah Cohen",
          time: "2 hours ago",
          message: "How to deal with sugar cravings after dinner?"
        },
        michael: {
          name: "Michael Levy",
          time: "4 hours ago",
          message: "Recommended strength exercises for beginners?"
        }
      }
    },
    actionPlan: {
      title: "Action Plan Board",
      subtitle: "Set specific goals, plan programs and track your progress",
      weekly: {
        title: "Weekly Goals",
        goals: [
          "Workout 3 times a week",
          "Drink 8 glasses of water",
          "7 hours of sleep per night"
        ]
      },
      monthly: {
        title: "Monthly Plan",
        week1: {
          period: "Week 1-2",
          task: "Start nutrition program"
        },
        week3: {
          period: "Week 3-4",
          task: "Add strength training"
        }
      },
      progress: {
        title: "Progress Tracking",
        weight: "Weight",
        workouts: "Workouts",
        water: "Water"
      }
    },
    messages: {
      title: "Private Messages",
      subtitle: "Communicate privately with our guides and experts",
      guides: {
        title: "Your Guides",
        ronit: {
          name: "Dr. Ronit Dietitian",
          specialty: "Nutrition Specialist"
        },
        alon: {
          name: "Alon Fitness Trainer",
          specialty: "Physical Fitness Expert"
        },
        yael: {
          name: "Yael Psychologist",
          specialty: "Mental Health Specialist"
        }
      },
      recentMessages: {
        title: "Recent Messages",
        ronit: {
          name: "Dr. Ronit Dietitian",
          time: "1 hour ago",
          message: "Your nutrition plan looks great! How do you feel about the changes?"
        },
        alon: {
          name: "Alon Fitness Trainer",
          time: "3 hours ago",
          message: "Remember to rest between workouts - it's an important part of the process!"
        }
      }
    },
    celebrations: {
      title: "Celebrations and Achievements",
      subtitle: "Share and celebrate events and achievements with our community",
      sarah: {
        name: "Sarah Cohen",
        time: "1 hour ago",
        message: "I managed to lose 5 kilos this month! Thanks to the amazing team!",
        comments: "23 comments"
      },
      michael: {
        name: "Michael Levy",
        time: "3 hours ago",
        message: "I ran 10 km for the first time in my life! Amazing feeling!",
        comments: "18 comments"
      },
      rachel: {
        name: "Rachel Abraham",
        time: "1 day ago",
        message: "I completed 30 consecutive days of training! I never thought I could!",
        comments: "31 comments"
      }
    },
    resources: {
      title: "Resources and Tools",
      subtitle: "Access a wide range of worksheets, useful links and additional materials",
      worksheets: {
        title: "Worksheets",
        description: "Templates for tracking progress and documenting goals"
      },
      links: {
        title: "Useful Links",
        description: "Reliable information sources and digital tools"
      },
      apps: {
        title: "Recommended Apps",
        description: "Leading apps for health and fitness"
      },
      books: {
        title: "Recommended Books",
        description: "Leading books in health and fitness"
      }
    },
    contact: {
      title: "Contact",
      subtitle: "We'd be happy to help you start your journey to better health",
      form: {
        title: "Let's Start Together",
        fullName: "Full Name",
        email: "Email",
        phone: "Phone",
        message: "Message"
      },
      details: {
        title: "Contact Details",
        phone: "Phone",
        email: "Email",
        address: "Address",
        addressValue: "Health Street 123, Tel Aviv"
      },
      hours: {
        title: "Operating Hours",
        weekdays: "Sunday - Thursday:",
        friday: "Friday:",
        saturday: "Saturday:",
        weekdaysHours: "08:00 - 20:00",
        fridayHours: "08:00 - 14:00",
        saturdayHours: "Closed"
      }
    },
    footer: {
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      copyright: "© 2025 BetterChoice. All rights reserved."
    },
    profile: {
      title: "My Profile",
      tabs: {
        profile: "Profile",
        myPlan: "My Plan",
        dailyLog: "Daily Log",
        messages: "Messages"
      },
      profileTab: {
        title: "Profile Details",
        subtitle: "Update your personal information",
        personalInfo: "Personal Information",
        firstName: "First Name",
        lastName: "Last Name",
        email: "Email",
        phone: "Phone",
        birthDate: "Birth Date",
        gender: "Gender",
        height: "Height (cm)",
        weight: "Weight (kg)",
        activityLevel: "Activity Level",
        goals: "Goals",
        saveChanges: "Save Changes",
        saved: "Saved successfully!",
        saving: "Saving...",
        activityLevels: {
          sedentary: "Sedentary",
          lightlyActive: "Lightly Active",
          moderatelyActive: "Moderately Active",
          veryActive: "Very Active",
          extremelyActive: "Extremely Active"
        },
        genders: {
          male: "Male",
          female: "Female",
          other: "Other"
        }
      },
      myPlanTab: {
        title: "My Nutrition Plan",
        subtitle: "Your personalized nutrition plan",
        loading: "Loading plan...",
        noPlan: "No plan available",
        noPlanDescription: "Your nutrition plan will be displayed here after completing registration",
        calories: "Daily Calories",
        protein: "Protein (g)",
        carbs: "Carbs (g)",
        fat: "Fat (g)",
        fiber: "Fiber (g)",
        meals: "Meals",
        breakfast: "Breakfast",
        lunch: "Lunch",
        dinner: "Dinner",
        snacks: "Snacks"
      },
      dailyLogTab: {
        title: "My Food Log",
        subtitle: "Track what you eat",
        today: "Today",
        addFood: "Add Food",
        searchPlaceholder: "Search food...",
        calories: "Calories",
        protein: "Protein",
        carbs: "Carbs",
        fat: "Fat",
        fiber: "Fiber",
        total: "Total",
        remaining: "Remaining",
        meals: {
          breakfast: "Breakfast",
          lunch: "Lunch",
          dinner: "Dinner",
          snacks: "Snacks",
          other: "Other"
        },
        noEntries: "No entries today",
        addFirstEntry: "Add your first food entry today!"
      },
      messagesTab: {
        title: "Messages with Our Bot",
        subtitle: "Ask questions and get personalized advice",
        sendMessage: "Send Message",
        typeMessage: "Type a message...",
        loading: "Loading messages...",
        noMessages: "No messages yet",
        startConversation: "Start a conversation with our bot!",
        botName: "BetterChoice Bot",
        user: "You",
        bot: "Bot",
        send: "Send",
        sending: "Sending...",
        thinking: "Bot is thinking...",
        error: "Error sending message"
      },
      knowledgePage: {
        title: "Knowledge & Inspiration",
        subtitle: "Leading Scientific Research in Nutrition, Health, and Physical Activity",
        sectionTitle: "Evidence-Based Scientific Studies",
        sectionDescription: "Five well-known, evidence-based, and genuinely interesting scientific papers on nutrition, health, and exercise",
        keyFindings: "Key Findings:",
        whyInteresting: "Why it's interesting:",
        readFullStudy: "Read Full Study",
        moreStudiesTitle: "More Studies Coming Soon",
        moreStudiesDescription: "We regularly add new and updated research from the world's leading scientific literature",
        backToHome: "Back to Home"
      }
    }
  }
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Check localStorage first, then default to English
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) {
      return savedLanguage;
    }
    return 'english'; // Default to English
  });
  
  const [direction, setDirection] = useState(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) {
      return savedLanguage === 'hebrew' ? 'rtl' : 'ltr';
    }
    return 'ltr'; // Default to LTR for English
  });
  
  const [isTransitioning, setIsTransitioning] = useState(false);

  const toggleLanguage = () => {
    if (isTransitioning) return; // Prevent multiple transitions
    
    setIsTransitioning(true);
    
    // Create simple transition overlay
    const overlay = document.createElement('div');
    overlay.className = 'language-overlay';
    document.body.appendChild(overlay);
    
    // Add simple fade out to content elements
    const contentElements = document.querySelectorAll('.language-transition');
    contentElements.forEach(element => {
      element.classList.add('language-transition-out');
    });
    
    // Start transition with simple timing
    setTimeout(() => {
      if (language === 'english') {
        setLanguage('hebrew');
        setDirection('rtl');
        localStorage.setItem('language', 'hebrew');
      } else {
        setLanguage('english');
        setDirection('ltr');
        localStorage.setItem('language', 'english');
      }
      
      // Remove overlay and reset transition state
      setTimeout(() => {
        // Remove transition classes
        contentElements.forEach(element => {
          element.classList.remove('language-transition-out');
          element.classList.add('language-transition-in');
        });
        
        // Remove overlay
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        
        // Reset transition state
        setTimeout(() => {
          contentElements.forEach(element => {
            element.classList.remove('language-transition-in');
          });
          setIsTransitioning(false);
        }, 300);
      }, 300);
    }, 150);
  };

  // Ensure t always has a valid value, defaulting to English if language is invalid
  const t = translations[language] || translations.english;

  const value = {
    language,
    direction,
    isTransitioning,
    toggleLanguage,
    setLanguage,
    setDirection,
    t // Translation function
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
