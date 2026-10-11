import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import MarketingShell from '../components/brand/MarketingShell';
import { primaryButton, titleFont } from '../components/brand/ui';

const NotFoundPage = () => {
  const { language } = useLanguage();
  const isHebrew = language === 'hebrew';

  return (
    <MarketingShell>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mx-auto max-w-xl px-4 sm:px-6 py-24 flex flex-col items-center text-center"
      >
        <p className="text-[13px] font-semibold text-bc-muted" dir="ltr">404</p>
        <h1 className={`mt-3 text-[32px] leading-tight text-bc-text ${isHebrew ? 'font-bold' : `${titleFont(language)} font-medium`}`}>
          {isHebrew ? 'העמוד לא נמצא' : 'Page not found'}
        </h1>
        <p className="mt-3 text-[15px] font-semibold text-bc-muted leading-relaxed">
          {isHebrew
            ? 'העמוד שחיפשתם לא קיים או שהועבר.'
            : 'The page you’re looking for doesn’t exist or has moved.'}
        </p>
        <Link to="/" className={`${primaryButton} mt-8`}>
          {isHebrew ? 'חזרה לדף הבית' : 'Back to home'}
        </Link>
      </motion.div>
    </MarketingShell>
  );
};

export default NotFoundPage;
