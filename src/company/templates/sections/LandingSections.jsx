import React from 'react';
import BenefitsSection from './BenefitsSection';
import ShowcaseSection from './ShowcaseSection';
import SocialProofSection from './SocialProofSection';
import ComparisonSection from './ComparisonSection';
import FinalCtaSection from './FinalCtaSection';
import FaqSection from './FaqSection';
import FlowSection from './FlowSection';

export default function LandingSections({ content, onCtaClick, campaign, variant = 'default' }) {
  const sections = [
    {
      key: 'benefits',
      eyebrow: content.benefits?.sectionEyebrow,
      node: <BenefitsSection content={content} variant={variant} />,
    },
    {
      key: 'showcase',
      eyebrow: content.showcase?.sectionEyebrow,
      node: <ShowcaseSection content={content} variant={variant} />,
    },
    {
      key: 'social',
      eyebrow: content.socialProof?.sectionEyebrow,
      node: <SocialProofSection content={content} variant={variant} />,
    },
    {
      key: 'compare',
      eyebrow: content.comparison?.sectionEyebrow,
      node: <ComparisonSection content={content} variant={variant} />,
    },
    {
      key: 'cta',
      eyebrow: content.finalCta?.sectionEyebrow,
      node: <FinalCtaSection content={content} onCtaClick={onCtaClick} campaign={campaign} variant={variant} />,
    },
    {
      key: 'faq',
      eyebrow: content.faq?.sectionEyebrow,
      node: <FaqSection content={content} variant={variant} />,
    },
  ];

  return (
    <div className="relative">
      {sections.map((section, index) => (
        <FlowSection
          key={section.key}
          index={index}
          eyebrow={section.eyebrow}
          isFirst={index === 0}
          isLast={index === sections.length - 1}
          variant={variant}
        >
          {section.node}
        </FlowSection>
      ))}
    </div>
  );
}
