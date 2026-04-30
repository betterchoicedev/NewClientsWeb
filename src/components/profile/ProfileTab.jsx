import React, { useRef, useState } from 'react';
import { supabase } from '../../supabase/supabaseClient';

const allergiesOptions = [
  { value: 'peanuts', labelHe: 'בוטנים', labelEn: 'Peanuts' },
  { value: 'tree_nuts', labelHe: 'אגוזי עץ', labelEn: 'Tree Nuts' },
  { value: 'milk', labelHe: 'חלב', labelEn: 'Milk/Dairy' },
  { value: 'eggs', labelHe: 'ביצים', labelEn: 'Eggs' },
  { value: 'wheat', labelHe: 'חיטה', labelEn: 'Wheat' },
  { value: 'soy', labelHe: 'סויה', labelEn: 'Soy' },
  { value: 'fish', labelHe: 'דגים', labelEn: 'Fish' },
  { value: 'seafood', labelHe: 'פירות ים', labelEn: 'Seafood' }
];

const limitationsOptions = [
  { value: 'vegetarian', labelHe: 'צמחוני', labelEn: 'Vegetarian' },
  { value: 'vegan', labelHe: 'טבעוני', labelEn: 'Vegan' },
  { value: 'pescatarian', labelHe: 'פסקטריאני', labelEn: 'Pescatarian' },
  { value: 'kosher', labelHe: 'כשר', labelEn: 'Kosher' },
  { value: 'halal', labelHe: 'חלאל', labelEn: 'Halal' },
  { value: 'gluten_free', labelHe: 'ללא גלוטן', labelEn: 'Gluten-free' },
  { value: 'dairy_free', labelHe: 'ללא חלב', labelEn: 'Dairy-free' }
];

const otherOption = { value: 'other', labelHe: 'אחר', labelEn: 'Other' };

const allergiesOptionsWithOther = [...allergiesOptions, otherOption];
const limitationsOptionsWithOther = [...limitationsOptions, otherOption];

const ALLERGY_VALUE_SET = new Set(allergiesOptions.map((o) => o.value));
const LIMITATION_VALUE_SET = new Set(limitationsOptions.map((o) => o.value));

/** Parse comma-separated food_allergies / food_limitations (values + optional Other: free text) */
const parseMultiSelectField = (stored, knownValueSet, optionsList) => {
  if (!stored || typeof stored !== 'string' || !stored.trim()) {
    return { selected: [], otherText: '' };
  }
  let text = stored.trim();
  let otherText = '';
  const otherPrefix = text.match(/\b(?:Other|אחר)\s*:\s*(.+)$/is);
  if (otherPrefix) {
    otherText = otherPrefix[1].trim();
    text = text.slice(0, otherPrefix.index).replace(/,\s*$/, '').trim();
  }
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  const selected = [];
  for (const part of parts) {
    if (knownValueSet.has(part)) {
      selected.push(part);
      continue;
    }
    if (part === 'other') {
      if (!selected.includes('other')) selected.push('other');
      continue;
    }
    const opt = optionsList.find(
      (o) =>
        o.value === part ||
        o.labelEn.toLowerCase() === part.toLowerCase() ||
        o.labelHe === part
    );
    if (opt) {
      if (!selected.includes(opt.value)) selected.push(opt.value);
      continue;
    }
    if (!otherText) otherText = part;
    else otherText = `${otherText}, ${part}`;
    if (!selected.includes('other')) selected.push('other');
  }
  if (otherText && !selected.includes('other')) selected.push('other');
  return { selected, otherText };
};

/** Serialize selected values + optional other text (matches onboarding + supports commas in "Other" via prefix) */
const serializeMultiSelectField = (selected, otherText, knownValueSet) => {
  const parts = selected.filter((v) => v !== 'other' && knownValueSet.has(v));
  if (selected.includes('other')) {
    if (otherText.trim()) {
      parts.push(`Other: ${otherText.trim()}`);
    } else {
      parts.push('other');
    }
  }
  return parts.join(', ');
};

const ProfileTab = ({ profileData, onInputChange, onSave, isSaving, saveStatus, errorMessage, themeClasses, t, companyOptions, isLoadingCompanies, companyError, language, onboardingCompleted = false, user, onSaveProfileImageUrl }) => {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [cropImage, setCropImage] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const isHebrew = language === 'hebrew';

  const { selected: selectedAllergies, otherText: allergiesOtherText } = parseMultiSelectField(
    profileData.foodAllergies,
    ALLERGY_VALUE_SET,
    allergiesOptions
  );
  const { selected: selectedLimitations, otherText: limitationsOtherText } = parseMultiSelectField(
    profileData.foodLimitations,
    LIMITATION_VALUE_SET,
    limitationsOptions
  );

  const toggleMultiValueField = (field, currentSelected, otherText, value, knownSet) => {
    const next = currentSelected.includes(value)
      ? currentSelected.filter((item) => item !== value)
      : [...currentSelected, value];
    const nextOther = next.includes('other') ? otherText : '';
    onInputChange(field, serializeMultiSelectField(next, nextOther, knownSet));
  };

  const handleMultiSelectOtherTextChange = (field, currentSelected, text, knownSet) => {
    onInputChange(field, serializeMultiSelectField(currentSelected, text, knownSet));
  };

  // Helper function to check if a field should be shown (if onboarding not completed, only show non-null fields)
  const shouldShowField = (fieldValue) => {
    if (onboardingCompleted === true) return true; // Show all fields if onboarding is completed
    return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''; // Only show non-null fields if skipped
  };

  // Personal Information fields are always read-only - cannot be edited
  const isReadOnly = true;

  // Handle image selection - show crop modal
  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setImageError(language === 'hebrew' ? 'הקובץ חייב להיות תמונה' : 'File must be an image');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setImageError(language === 'hebrew' ? 'התמונה גדולה מדי (מקסימום 5MB)' : 'Image is too large (max 5MB)');
      return;
    }

    setImageError('');
    
    // Create image preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageToCrop(e.target.result);
      setShowCropModal(true);
      setCropImage({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle mouse events for dragging
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropImage.x, y: e.clientY - cropImage.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setCropImage(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };


  // Crop and upload the image
  const handleCropAndUpload = async () => {
    if (!imageToCrop || !imageRef.current || !containerRef.current) return;

    setUploadingImage(true);
    setImageError('');

    try {
      // Get container and image dimensions
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerSize = Math.min(containerRect.width, containerRect.height);
      
      // Create canvas for cropping
      const canvas = document.createElement('canvas');
      canvas.width = 400; // Output size
      canvas.height = 400;
      const ctx = canvas.getContext('2d');

      // Load image
      const img = new Image();
      img.onload = async () => {
        const container = containerRef.current;
        if (!container) return;
        
        const containerRect = container.getBoundingClientRect();
        const containerSize = Math.min(containerRect.width, containerRect.height);
        const cropCircleSize = containerSize * 0.75; // 75% - the visible circle
        const circleRadius = cropCircleSize / 2;
        
        // Calculate how image is displayed with object-fit: cover
        const imgAspect = img.width / img.height;
        let coverScale;
        
        if (imgAspect > 1) {
          // Wider image - height fills container
          coverScale = containerSize / img.height;
        } else {
          // Taller image - width fills container
          coverScale = containerSize / img.width;
        }
        
        // Image element dimensions after object-fit: cover
        const displayedWidth = img.width * coverScale;
        const displayedHeight = img.height * coverScale;
        
        // Offset to center the image (object-fit: cover centers it)
        const offsetX = (containerSize - displayedWidth) / 2;
        const offsetY = (containerSize - displayedHeight) / 2;
        
        // Circle center in container coordinates
        const circleCenterX = containerSize / 2;
        const circleCenterY = containerSize / 2;
        
        // Transform origin is top-left of the image element
        // We need to find what point in the original image corresponds to the circle center
        // Step 1: Convert circle center to coordinates relative to image element (before transform)
        let relativeX = circleCenterX - offsetX;
        let relativeY = circleCenterY - offsetY;
        
        // Step 2: Account for the transform (translate only, no scale)
        // The transform is: translate(x, y)
        // First undo the translation
        relativeX = relativeX - cropImage.x;
        relativeY = relativeY - cropImage.y;
        
        // Step 3: Add back the offset to get position in displayed image
        relativeX = relativeX + offsetX;
        relativeY = relativeY + offsetY;
        
        // Step 4: Convert to original image pixel coordinates
        const imageX = relativeX / coverScale;
        const imageY = relativeY / coverScale;
        
        // Calculate crop size in original image coordinates
        const cropSizeInImage = cropCircleSize / coverScale;
        
        // Calculate crop rectangle centered on the calculated position
        let cropX = imageX - cropSizeInImage / 2;
        let cropY = imageY - cropSizeInImage / 2;
        
        // Ensure crop stays within image bounds
        cropX = Math.max(0, Math.min(cropX, img.width - cropSizeInImage));
        cropY = Math.max(0, Math.min(cropY, img.height - cropSizeInImage));
        const finalCropSize = Math.min(cropSizeInImage, img.width - cropX, img.height - cropY);

        // Draw cropped image
        ctx.drawImage(
          img,
          cropX, cropY, finalCropSize, finalCropSize,
          0, 0, 400, 400
        );

        // Convert to blob
        canvas.toBlob(async (blob) => {
          if (!blob) {
            setImageError(language === 'hebrew' ? 'שגיאה בעיבוד התמונה' : 'Error processing image');
            setUploadingImage(false);
            return;
          }

          // Get user_code from clients table
          const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
          const userCodeResponse = await fetch(`${apiUrl}/api/profile/user-code?userId=${encodeURIComponent(user.id)}`);
          const userCodeResult = await userCodeResponse.json();

          if (!userCodeResponse.ok) {
            console.error('Error fetching user_code:', userCodeResult.error);
            setImageError(language === 'hebrew' ? 'שגיאה בטעינת פרטי המשתמש' : 'Error loading user information');
            setUploadingImage(false);
            setShowCropModal(false);
            return;
          }

          const userCode = userCodeResult.user_code;
          if (!userCode) {
            setImageError(language === 'hebrew' ? 'קוד משתמש לא נמצא. אנא השלם את הגדרת הפרופיל תחילה.' : 'User code not found. Please complete your profile setup first.');
            setUploadingImage(false);
            setShowCropModal(false);
            return;
          }

          // Generate unique filename
          const timestamp = Date.now();
          const filename = `${userCode}/${timestamp}.jpeg`;

          // Check if user is authenticated
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setImageError(language === 'hebrew' ? 'נא להתחבר כדי להעלות תמונה' : 'Please sign in to upload an image');
            setUploadingImage(false);
            setShowCropModal(false);
            return;
          }

          // Upload to Supabase Storage
          const bucketName = process.env.REACT_APP_SUPABASE_STORAGE_BUCKET_NAME || 'profile-pictures';
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filename, blob, {
              contentType: 'image/jpeg',
              upsert: false,
              cacheControl: '3600',
              metadata: {
                userId: user.id,
                userCode: userCode,
                uploadedAt: new Date().toISOString()
              }
            });

          if (uploadError) {
            console.error('Error uploading to Supabase Storage:', uploadError);
            if (uploadError.message?.includes('row-level security policy') || 
                uploadError.message?.includes('RLS') ||
                uploadError.statusCode === 400 ||
                uploadError.message?.includes('violates')) {
              const rlsErrorMsg = language === 'hebrew' 
                ? `שגיאת הרשאות: מדיניות האבטחה חוסמת את ההעלאה.`
                : `Permission error: Security policy is blocking the upload.`;
              setImageError(rlsErrorMsg);
            } else {
              setImageError(uploadError.message || (language === 'hebrew' ? 'שגיאה בהעלאת התמונה' : 'Error uploading image'));
            }
            setUploadingImage(false);
            setShowCropModal(false);
            return;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(uploadData.path);

          const publicUrl = urlData.publicUrl;

          // Update profile data
          onInputChange('profileImageUrl', publicUrl);
          
          // Save to database
          if (onSaveProfileImageUrl) {
            const saveResult = await onSaveProfileImageUrl(publicUrl);
            if (saveResult.error) {
              console.error('Error saving profile image URL to database:', saveResult.error);
              setImageError(language === 'hebrew' ? 'התמונה הועלתה אך לא נשמרה. אנא נסה לשמור ידנית.' : 'Image uploaded but not saved. Please try saving manually.');
            } else {
              setImageError('');
            }
          } else {
            setImageError('');
          }

          setShowCropModal(false);
          setImageToCrop(null);
          setUploadingImage(false);
        }, 'image/jpeg', 0.9);
      };
      img.src = imageToCrop;
    } catch (error) {
      console.error('Error processing image:', error);
      setImageError(error.message || (language === 'hebrew' ? 'שגיאה בעיבוד התמונה' : 'Error processing image'));
      setUploadingImage(false);
      setShowCropModal(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
      {/* Header Section */}
      <div className="mb-8 sm:mb-10 md:mb-12 animate-slideInUp">
        <div className="flex items-center mb-6 sm:mb-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-indigo-500/25 animate-pulse">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
          </div>
    <div>
            <h2 className="text-white text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">{t.profile.profileTab.title}</h2>
            <p className="text-slate-400 text-sm sm:text-base mt-1">{t.profile.profileTab.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* Profile Photo Section */}
        <div className={`${themeClasses.bgCard} border border-emerald-500/20 rounded-2xl p-5 shadow-lg shadow-emerald-500/5`}>
          <div className="flex items-start gap-4">
            {/* Profile Photo Display */}
            <div className="relative flex-shrink-0">
              <div 
                onClick={handleImageClick}
                className={`relative w-24 h-24 rounded-full overflow-hidden cursor-pointer transition-all duration-300 ${
                uploadingImage 
                  ? 'ring-2 ring-gray-400/50' 
                  : 'ring-2 ring-emerald-500/30 hover:ring-emerald-500/50 shadow-lg'
              }`}
              >
                {profileData.profileImageUrl ? (
                  <img 
                    src={profileData.profileImageUrl} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white/90" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                    </svg>
                  </div>
                )}
                
                {/* Upload overlay */}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-white"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className={`${themeClasses.textPrimary} text-base font-semibold mb-3`}>
                {language === 'hebrew' ? 'תמונת פרופיל' : 'Profile Photo'}
              </h3>
              
              <button
                onClick={handleImageClick}
                disabled={uploadingImage}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  uploadingImage 
                    ? 'bg-gray-400/50 cursor-not-allowed text-gray-600' 
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {uploadingImage ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {language === 'hebrew' ? 'מעלה...' : 'Uploading...'}
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {language === 'hebrew' ? 'העלה תמונה' : 'Upload Photo'}
                  </span>
                )}
              </button>

              {/* Info Text */}
              <p className={`${themeClasses.textSecondary} text-xs mt-3`}>
                {language === 'hebrew' 
                  ? 'JPG, PNG, GIF, WebP (מקסימום 5MB)'
                  : 'JPG, PNG, GIF, WebP (max 5MB)'}
              </p>

              {/* Error Message */}
              {imageError && (
                <div className="mt-3 px-3 py-2 bg-red-500/10 dark:bg-red-900/20 border border-red-400/30 dark:border-red-600/30 text-red-600 dark:text-red-400 rounded-lg text-xs">
                  {imageError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Crop Modal */}
        {showCropModal && imageToCrop && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => !uploadingImage && setShowCropModal(false)}>
            <div className={`${themeClasses.bgCard} rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`${themeClasses.textPrimary} text-xl font-bold`}>
                  {language === 'hebrew' ? 'התאם את התמונה' : 'Adjust Your Photo'}
                </h3>
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setImageToCrop(null);
                  }}
                  className={`${themeClasses.textSecondary} hover:${themeClasses.textPrimary} transition-colors`}
                  disabled={uploadingImage}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className={`${themeClasses.textSecondary} text-sm mb-4`}>
                  {language === 'hebrew' 
                    ? 'גרור את התמונה כדי למקם את הפנים במרכז.'
                    : 'Drag the image to position your face in the center.'}
                </p>
                
                <div 
                  ref={containerRef}
                  className="relative w-full aspect-square bg-gray-900 rounded-lg overflow-hidden border-2 border-emerald-500/50"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                  <img
                    ref={imageRef}
                    src={imageToCrop}
                    alt="Crop preview"
                    className="absolute select-none"
                    style={{
                      transform: `translate(${cropImage.x}px, ${cropImage.y}px)`,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none'
                    }}
                    draggable={false}
                  />
                  
                  {/* Crop overlay circle */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-3/4 rounded-full border-4 border-emerald-500 shadow-lg ring-4 ring-black/50"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setImageToCrop(null);
                    setCropImage({ x: 0, y: 0 });
                  }}
                  className={`px-4 py-2 rounded-lg ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:opacity-80 transition-opacity`}
                  disabled={uploadingImage}
                >
                  {language === 'hebrew' ? 'ביטול' : 'Cancel'}
                </button>
                
                <button
                  onClick={handleCropAndUpload}
                  disabled={uploadingImage}
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                    uploadingImage
                      ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl'
                  }`}
                >
                  {uploadingImage ? (
                    <span className="flex items-center">
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {language === 'hebrew' ? 'מעלה...' : 'Uploading...'}
                    </span>
                  ) : (
                    language === 'hebrew' ? 'שמור והעלה' : 'Save & Upload'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Personal Information */}
        <div className={`${themeClasses.bgCard} border border-indigo-500/30 rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl shadow-indigo-500/10 transform hover:scale-[1.01] transition-all duration-300 animate-slideInUp`} style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center mb-6 sm:mb-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-indigo-500/25">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold tracking-tight`}>
                {t.profile.profileTab.personalInfo}
              </h3>
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mt-1`}>
                {language === 'hebrew' ? 'פרטים אישיים - לא ניתן לערוך' : 'Your basic personal details - Read only'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {shouldShowField(profileData.firstName) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {t.profile.profileTab.firstName} *
              </label>
              <input
                type="text"
                value={profileData.firstName}
                readOnly
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} cursor-not-allowed opacity-80`}
                required
              />
            </div>
            )}

            {shouldShowField(profileData.lastName) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {t.profile.profileTab.lastName} *
              </label>
              <input
                type="text"
                value={profileData.lastName}
                readOnly
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} cursor-not-allowed opacity-80`}
                required
              />
            </div>
            )}

            {shouldShowField(profileData.email) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {t.profile.profileTab.email} *
              </label>
              <input
                type="email"
                value={profileData.email}
                readOnly
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} cursor-not-allowed opacity-80`}
                required
              />
            </div>
            )}

            {shouldShowField(profileData.phone) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {t.profile.profileTab.phone}
              </label>
              <input
                type="tel"
                value={profileData.phone}
                readOnly
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} cursor-not-allowed opacity-80`}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            )}
            </div>
        </div>

        {/* Location Information */}
        <div className={`${themeClasses.bgSecondary} rounded-xl p-4 sm:p-6 border-l-4 border-purple-500`}>
          <div className="flex items-center mb-4 sm:mb-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mr-3">
              <span className="text-purple-600 dark:text-purple-400 text-base sm:text-lg">📍</span>
            </div>
            <div>
              <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold`}>
                {language === 'hebrew' ? 'מידע מיקום' : 'Location Information'}
              </h3>
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm`}>
                {language === 'hebrew' ? 'עזרו לנו לספק המלצות מותאמות למיקום' : 'Help us provide location-specific recommendations'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {language === 'hebrew' ? 'אזור' : 'Region'}
              </label>
              <select
                value={profileData.region}
                onChange={(e) => onInputChange('region', e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
              >
                <option value="">{language === 'hebrew' ? 'בחר אזור' : 'Select Region'}</option>
                <option value="israel">{language === 'hebrew' ? 'ישראל' : 'Israel'}</option>
                <option value="japan">{language === 'hebrew' ? 'יפן' : 'Japan'}</option>
                <option value="korea">{language === 'hebrew' ? 'קוריאה' : 'Korea'}</option>
                <option value="greater_china">{language === 'hebrew' ? 'סין/הונג קונג/טאיוואן' : 'Greater China (China/Hong Kong/Taiwan)'}</option>
                <option value="india_south_asia">{language === 'hebrew' ? 'הודו / דרום אסיה' : 'India / South Asia'}</option>
                <option value="southeast_asia">{language === 'hebrew' ? 'דרום־מזרח אסיה' : 'Southeast Asia'}</option>
                <option value="indonesia_malaysia">{language === 'hebrew' ? 'אינדונזיה/מלזיה' : 'Indonesia/Malaysia'}</option>
                <option value="turkey">{language === 'hebrew' ? 'טורקיה' : 'Turkey'}</option>
                <option value="persian_iranian">{language === 'hebrew' ? 'איראן/פרס' : 'Persian/Iranian'}</option>
                <option value="gulf_arabia">{language === 'hebrew' ? 'העולם הערבי-מפרץ' : 'Gulf Arabia'}</option>
                <option value="north_africa">{language === 'hebrew' ? 'צפון אפריקה' : 'North Africa'}</option>
                <option value="east_africa">{language === 'hebrew' ? 'אפריקה מזרחית' : 'East Africa'}</option>
                <option value="europe_mediterranean">{language === 'hebrew' ? 'אירופה - ים תיכוני' : 'Europe - Mediterranean'}</option>
                <option value="europe_west">{language === 'hebrew' ? 'אירופה - מרכז/מערב' : 'Europe - Central/West'}</option>
                <option value="europe_east_russian">{language === 'hebrew' ? 'אירופה - מזרח/רוסי' : 'Europe - East/Russian'}</option>
                <option value="mexico">{language === 'hebrew' ? 'אמריקה לטינית - מקסיקו' : 'Latin America - Mexico'}</option>
                <option value="latam_south_america">{language === 'hebrew' ? 'אמריקה לטינית - דרום אמריקה' : 'Latin America - South America'}</option>
                <option value="caribbean">{language === 'hebrew' ? 'קריביים' : 'Caribbean'}</option>
                <option value="north_america">{language === 'hebrew' ? 'צפון אמריקה' : 'North America'}</option>
                <option value="other">{language === 'hebrew' ? 'אחר' : 'Other'}</option>
              </select>
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {language === 'hebrew' ? 'עיר' : 'City'}
              </label>
              <input
                type="text"
                value={profileData.city}
                onChange={(e) => onInputChange('city', e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
                placeholder={language === 'hebrew' ? 'תל אביב' : 'Tel Aviv'}
              />
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {language === 'hebrew' ? 'אזור זמן' : 'Timezone'}
              </label>
              <select
                value={profileData.timezone}
                onChange={(e) => onInputChange('timezone', e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
              >
                <option value="">{language === 'hebrew' ? 'בחר אזור זמן' : 'Select Timezone'}</option>
                <optgroup label={language === 'hebrew' ? 'ישראל והמזרח התיכון' : 'Israel & Middle East'}>
                  <option value="Asia/Jerusalem">{language === 'hebrew' ? 'ירושלים (ישראל)' : 'Asia/Jerusalem (Israel)'}</option>
                  <option value="Asia/Dubai">{language === 'hebrew' ? 'דובאי (איחוד האמירויות)' : 'Asia/Dubai (UAE)'}</option>
                  <option value="Asia/Riyadh">{language === 'hebrew' ? 'ריאד (ערב הסעודית)' : 'Asia/Riyadh (Saudi Arabia)'}</option>
                  <option value="Asia/Tehran">{language === 'hebrew' ? 'טהרן (איראן)' : 'Asia/Tehran (Iran)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'אירופה' : 'Europe'}>
                  <option value="Europe/London">{language === 'hebrew' ? 'לונדון (GMT)' : 'Europe/London (GMT)'}</option>
                  <option value="Europe/Paris">{language === 'hebrew' ? 'פריז (CET)' : 'Europe/Paris (CET)'}</option>
                  <option value="Europe/Berlin">{language === 'hebrew' ? 'ברלין (CET)' : 'Europe/Berlin (CET)'}</option>
                  <option value="Europe/Rome">{language === 'hebrew' ? 'רומא (CET)' : 'Europe/Rome (CET)'}</option>
                  <option value="Europe/Madrid">{language === 'hebrew' ? 'מדריד (CET)' : 'Europe/Madrid (CET)'}</option>
                  <option value="Europe/Amsterdam">{language === 'hebrew' ? 'אמסטרדם (CET)' : 'Europe/Amsterdam (CET)'}</option>
                  <option value="Europe/Moscow">{language === 'hebrew' ? 'מוסקבה (MSK)' : 'Europe/Moscow (MSK)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'צפון אמריקה' : 'North America'}>
                  <option value="America/New_York">{language === 'hebrew' ? 'ניו יורק (EST)' : 'America/New_York (EST)'}</option>
                  <option value="America/Chicago">{language === 'hebrew' ? 'שיקגו (CST)' : 'America/Chicago (CST)'}</option>
                  <option value="America/Denver">{language === 'hebrew' ? 'דנבר (MST)' : 'America/Denver (MST)'}</option>
                  <option value="America/Los_Angeles">{language === 'hebrew' ? 'לוס אנג\'לס (PST)' : 'America/Los_Angeles (PST)'}</option>
                  <option value="America/Toronto">{language === 'hebrew' ? 'טורונטו (EST)' : 'America/Toronto (EST)'}</option>
                  <option value="America/Vancouver">{language === 'hebrew' ? 'ונקובר (PST)' : 'America/Vancouver (PST)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'אסיה' : 'Asia'}>
                  <option value="Asia/Tokyo">{language === 'hebrew' ? 'טוקיו (JST)' : 'Asia/Tokyo (JST)'}</option>
                  <option value="Asia/Shanghai">{language === 'hebrew' ? 'שנחאי (CST)' : 'Asia/Shanghai (CST)'}</option>
                  <option value="Asia/Hong_Kong">{language === 'hebrew' ? 'הונג קונג (HKT)' : 'Asia/Hong_Kong (HKT)'}</option>
                  <option value="Asia/Singapore">{language === 'hebrew' ? 'סינגפור (SGT)' : 'Asia/Singapore (SGT)'}</option>
                  <option value="Asia/Kolkata">{language === 'hebrew' ? 'קולקטה (IST)' : 'Asia/Kolkata (IST)'}</option>
                  <option value="Asia/Seoul">{language === 'hebrew' ? 'סיאול (KST)' : 'Asia/Seoul (KST)'}</option>
                  <option value="Asia/Bangkok">{language === 'hebrew' ? 'בנגקוק (ICT)' : 'Asia/Bangkok (ICT)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'אוקיאניה' : 'Oceania'}>
                  <option value="Australia/Sydney">{language === 'hebrew' ? 'סידני (AEST)' : 'Australia/Sydney (AEST)'}</option>
                  <option value="Australia/Melbourne">{language === 'hebrew' ? 'מלבורן (AEST)' : 'Australia/Melbourne (AEST)'}</option>
                  <option value="Australia/Perth">{language === 'hebrew' ? 'פרת (AWST)' : 'Australia/Perth (AWST)'}</option>
                  <option value="Pacific/Auckland">{language === 'hebrew' ? 'אוקלנד (NZST)' : 'Pacific/Auckland (NZST)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'דרום אמריקה' : 'South America'}>
                  <option value="America/Sao_Paulo">{language === 'hebrew' ? 'סאו פאולו (BRT)' : 'America/Sao_Paulo (BRT)'}</option>
                  <option value="America/Buenos_Aires">{language === 'hebrew' ? 'בואנוס איירס (ART)' : 'America/Buenos_Aires (ART)'}</option>
                  <option value="America/Lima">{language === 'hebrew' ? 'לימה (PET)' : 'America/Lima (PET)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'אפריקה' : 'Africa'}>
                  <option value="Africa/Cairo">{language === 'hebrew' ? 'קהיר (EET)' : 'Africa/Cairo (EET)'}</option>
                  <option value="Africa/Johannesburg">{language === 'hebrew' ? 'יוהנסבורג (SAST)' : 'Africa/Johannesburg (SAST)'}</option>
                  <option value="Africa/Lagos">{language === 'hebrew' ? 'לאגוס (WAT)' : 'Africa/Lagos (WAT)'}</option>
                </optgroup>
              </select>
            </div>
          </div>

          <div className="mt-6">
            <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
              {language === 'hebrew' ? 'חברה' : 'Company'}
            </label>
            {companyError && (
              <p className="text-red-500 text-xs mb-2">
                {companyError}
              </p>
            )}
            <select
              value={profileData.companyId || ''}
              onChange={(e) => onInputChange('companyId', e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`}
              disabled={true}
              readOnly={true}
            >
              <option value="">{language === 'hebrew' ? 'ללא חברה' : 'No company'}</option>
              {companyOptions.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            {isLoadingCompanies && (
              <p className={`${themeClasses.textSecondary} text-xs mt-2`}>
                {language === 'hebrew' ? 'טוען רשימת חברות...' : 'Loading companies...'}
              </p>
            )}
            {!isLoadingCompanies && companyOptions.length === 0 && !companyError && (
              <p className={`${themeClasses.textSecondary} text-xs mt-2`}>
                {language === 'hebrew' ? 'לא נמצאו חברות זמינות' : 'No companies available'}
              </p>
            )}
          </div>

        </div>

        {/* Health Information */}
        <div className={`${themeClasses.bgSecondary} rounded-xl p-4 sm:p-6 border-l-4 border-emerald-500`}>
          <div className="flex items-center mb-4 sm:mb-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center mr-3">
              <span className="text-emerald-600 dark:text-emerald-400 text-base sm:text-lg">🏥</span>
            </div>
            <div>
              <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold`}>
                {language === 'hebrew' ? 'מידע בריאותי' : 'Health Information'}
              </h3>
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm`}>
                {language === 'hebrew' ? 'אופציונלי - ספקו פרטי בריאות אם רלוונטי' : 'Optional - provide your health details if relevant'}
              </p>
            </div>
          </div>
          
          <div className="space-y-4 sm:space-y-6">
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-3`}>
                {language === 'hebrew' ? 'העדפות תזונתיות' : 'Dietary Preferences'}
              </label>
              <textarea
                value={profileData.dietaryPreferences}
                onChange={(e) => onInputChange('dietaryPreferences', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                placeholder={language === 'hebrew' ? 'לדוגמה: צמחוני, טבעוני, ללא גלוטן, דיאטה ים תיכונית...' : 'e.g., Vegetarian, Vegan, Gluten-free, Mediterranean diet...'}
              />
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-1`}>
                {language === 'hebrew' ? 'אלרגיות למזון' : 'Food Allergies'}
              </label>
              <p className={`${themeClasses.textMuted} text-xs mb-3`}>
                {isHebrew ? 'ניתן לבחור מספר אפשרויות' : 'Select all that apply'}
              </p>
              <div
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200 dark:focus-within:ring-emerald-800`}
              >
                <div className="flex flex-wrap gap-2">
                  {allergiesOptionsWithOther.map((option) => {
                    const isSelected = selectedAllergies.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        onClick={() =>
                          toggleMultiValueField(
                            'foodAllergies',
                            selectedAllergies,
                            allergiesOtherText,
                            option.value,
                            ALLERGY_VALUE_SET
                          )
                        }
                        className={`
                          group inline-flex items-center gap-2 min-h-[38px] px-3 py-1.5 rounded-full text-sm font-medium
                          border-2 transition-all
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:focus-visible:ring-offset-slate-900
                          ${isHebrew ? 'flex-row-reverse' : ''}
                          ${
                            isSelected
                              ? `border-emerald-500 bg-emerald-500/10 ${themeClasses.textPrimary}`
                              : `border-slate-300/60 dark:border-slate-600/80 bg-transparent ${themeClasses.textPrimary} hover:border-emerald-500/50`
                          }
                        `}
                      >
                        <span
                          className={`
                            flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors
                            ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-500 text-white dark:border-emerald-400'
                                : 'border-slate-400/70 dark:border-slate-500 bg-transparent'
                            }
                          `}
                          aria-hidden
                        >
                          {isSelected ? (
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </span>
                        <span className="whitespace-nowrap">{isHebrew ? option.labelHe : option.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedAllergies.includes('other') && (
                  <div className="mt-3">
                    <label className={`${themeClasses.textMuted} block text-xs font-medium mb-2`}>
                      {isHebrew ? 'פרטו (אחר)' : 'Please specify (other)'}
                    </label>
                    <textarea
                      value={allergiesOtherText}
                      onChange={(e) =>
                        handleMultiSelectOtherTextChange(
                          'foodAllergies',
                          selectedAllergies,
                          e.target.value,
                          ALLERGY_VALUE_SET
                        )
                      }
                      rows={2}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                      placeholder={
                        isHebrew ? 'תארו אלרגיות נוספות...' : 'Describe any additional allergies...'
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-1`}>
                {language === 'hebrew' ? 'מגבלות תזונתיות' : 'Food Limitations'}
              </label>
              <p className={`${themeClasses.textMuted} text-xs mb-3`}>
                {isHebrew ? 'ניתן לבחור מספר אפשרויות' : 'Select all that apply'}
              </p>
              <div
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200 dark:focus-within:ring-emerald-800`}
              >
                <div className="flex flex-wrap gap-2">
                  {limitationsOptionsWithOther.map((option) => {
                    const isSelected = selectedLimitations.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        onClick={() =>
                          toggleMultiValueField(
                            'foodLimitations',
                            selectedLimitations,
                            limitationsOtherText,
                            option.value,
                            LIMITATION_VALUE_SET
                          )
                        }
                        className={`
                          group inline-flex items-center gap-2 min-h-[38px] px-3 py-1.5 rounded-full text-sm font-medium
                          border-2 transition-all
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:focus-visible:ring-offset-slate-900
                          ${isHebrew ? 'flex-row-reverse' : ''}
                          ${
                            isSelected
                              ? `border-emerald-500 bg-emerald-500/10 ${themeClasses.textPrimary}`
                              : `border-slate-300/60 dark:border-slate-600/80 bg-transparent ${themeClasses.textPrimary} hover:border-emerald-500/50`
                          }
                        `}
                      >
                        <span
                          className={`
                            flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors
                            ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-500 text-white dark:border-emerald-400'
                                : 'border-slate-400/70 dark:border-slate-500 bg-transparent'
                            }
                          `}
                          aria-hidden
                        >
                          {isSelected ? (
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </span>
                        <span className="whitespace-nowrap">{isHebrew ? option.labelHe : option.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedLimitations.includes('other') && (
                  <div className="mt-3">
                    <label className={`${themeClasses.textMuted} block text-xs font-medium mb-2`}>
                      {isHebrew ? 'פרטו (אחר)' : 'Please specify (other)'}
                    </label>
                    <textarea
                      value={limitationsOtherText}
                      onChange={(e) =>
                        handleMultiSelectOtherTextChange(
                          'foodLimitations',
                          selectedLimitations,
                          e.target.value,
                          LIMITATION_VALUE_SET
                        )
                      }
                      rows={2}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                      placeholder={
                        isHebrew ? 'תארו מגבלות נוספות...' : 'Describe any additional limitations...'
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-3`}>
                {language === 'hebrew' ? 'מצבים רפואיים' : 'Medical Conditions'}
              </label>
              <textarea
                value={profileData.medicalConditions}
                onChange={(e) => onInputChange('medicalConditions', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                placeholder={language === 'hebrew' ? 'לדוגמה: סוכרת, יתר לחץ דם, בעיות לב...' : 'e.g., Diabetes, Hypertension, Heart condition...'}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Save Button */}
      <div className="mt-6 sm:mt-8 flex justify-end">
        <button
          onClick={onSave}
          disabled={isSaving}
          className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-all duration-200 transform hover:scale-105 ${
            isSaving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-xl'
          } text-white`}
        >
          {isSaving ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              {t.profile.profileTab.saving}
            </div>
          ) : (
            <div className="flex items-center">
              <span className="mr-2">💾</span>
              {t.profile.profileTab.saveChanges}
            </div>
          )}
        </button>
      </div>

      {/* Save Status */}
      {saveStatus && (
        <div className={`mt-6 p-4 rounded-xl border-l-4 ${
          saveStatus === 'success' 
            ? 'bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-500' 
            : 'bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-500'
        }`}>
          <div className="flex items-center">
            <span className="text-2xl mr-3">
              {saveStatus === 'success' ? '✅' : '❌'}
            </span>
            <p className={`text-sm font-medium ${
              saveStatus === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
            }`}>
              {saveStatus === 'success' ? t.profile.profileTab.saved : (errorMessage || 'Error saving profile')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileTab;
