import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Check } from 'lucide-react';
import { signUp, createClientRecord, checkEmailExists, checkPhoneExists, normalizePhoneForDatabase } from '../supabase/auth';
import { AuthShell, AuthField, AuthNotice } from '../components/brand/AuthShell';
import { primaryButton, field, fieldLabel, focusClass } from '../components/brand/ui';

function WhatsAppRegisterPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { phoneNumber } = useParams();
  const { isAuthenticated } = useAuth();
  
  // State for form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  });
  
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Helper function to clean phone number (only keeps numbers and optional leading +)
  const cleanPhoneNumber = (phone) => {
    if (!phone) return '';
    // First normalize phone number (remove spaces, dashes, etc.)
    let normalized = normalizePhoneForDatabase(phone);
    // Strip all non-numeric characters except leading +
    const cleaned = normalized.replace(/[^\d+]/g, '');
    // Ensure + is only at the start if present
    const hasLeadingPlus = cleaned.startsWith('+');
    const digitsOnly = hasLeadingPlus ? cleaned.substring(1) : cleaned;
    // Remove any + characters that aren't at the start
    const cleanDigits = digitsOnly.replace(/\+/g, '');
    // Reconstruct with + only at the start if it was there originally
    return hasLeadingPlus ? `+${cleanDigits}` : cleanDigits;
  };

  // Helper function to validate phone number (only accepts numbers)
  const validatePhoneNumber = (phone) => {
    if (!phone) return false;
    // Clean the phone number first (removes all non-numeric except leading +)
    const cleaned = cleanPhoneNumber(phone);
    // Validate: must have optional + followed by 10-15 digits
    const phoneRegex = /^\+?\d{10,15}$/;
    return phoneRegex.test(cleaned);
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Extract and validate phone number from URL
  useEffect(() => {
    if (phoneNumber) {
      // Decode URL-encoded characters
      const decodedPhone = decodeURIComponent(phoneNumber);
      
      // Check if the parameter contains any numbers - if not, redirect to home
      if (!/\d/.test(decodedPhone)) {
        navigate('/');
        return;
      }
      
      // Clean and validate phone number (only accepts numbers)
      if (validatePhoneNumber(decodedPhone)) {
        // Store the cleaned phone number (only numbers, with optional leading +)
        const cleanedPhone = cleanPhoneNumber(decodedPhone);
        setPhone(cleanedPhone);
        setPhoneError('');
      } else {
        setPhoneError(
          language === 'hebrew' 
            ? 'מספר הטלפון מה-WhatsApp אינו תקין. פנו לתמיכה.' 
            : 'Invalid phone number from WhatsApp. Please contact support.'
        );
      }
    } else {
      // No phone number parameter - redirect to home
      navigate('/');
    }
  }, [phoneNumber, language, navigate]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validate phone number exists
    if (!phone) {
      setError(
        language === 'hebrew' 
          ? 'מספר טלפון לא זמין. השתמשו בקישור הנכון מה-WhatsApp.' 
          : 'Phone number not available. Please use the correct link from WhatsApp.'
      );
      setLoading(false);
      return;
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError(language === 'hebrew' ? 'הסיסמאות אינן תואמות' : 'Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (formData.password.length < 6) {
      setError(language === 'hebrew' ? 'הסיסמה חייבת להכיל לפחות 6 תווים' : 'Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    // Check if email already exists in both databases
    const emailCheck = await checkEmailExists(formData.email);
    if (emailCheck.exists) {
      setError(
        language === 'hebrew'
          ? 'כתובת האימייל כבר קיימת במערכת. השתמשו באימייל אחר או התחברו.'
          : 'This email is already registered. Please use a different email or login.'
      );
      setLoading(false);
      return;
    }

    // Normalize phone number (remove spaces and dashes) for database operations
    const normalizedPhone = normalizePhoneForDatabase(phone);

    // Check if phone number already exists in both databases (using normalized version)
    const phoneCheck = await checkPhoneExists(normalizedPhone);
    if (phoneCheck.exists) {
      setError(
        language === 'hebrew'
          ? 'מספר הטלפון כבר קיים במערכת. השתמשו במספר אחר או התחברו.'
          : 'This phone number is already registered. Please use a different number or login.'
      );
      setLoading(false);
      return;
    }

    try {
      const userData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: normalizedPhone, // Store normalized version (without spaces/dashes)
        newsletter: false, // Default to false for WhatsApp registrations
        platform: 'whatsapp' // Mark as WhatsApp registration
      };

      const { data, error } = await signUp(formData.email, formData.password, userData);
      
      if (error) {
        setError(error.message);
      } else {
        // Create client record in clients table
        if (data?.user?.id) {
          try {
            const clientResult = await createClientRecord(data.user.id, userData);
            
            if (clientResult.error) {
              setError(
                language === 'hebrew' 
                  ? 'החשבון נוצר אבל לא ניתן ליצור רשומת לקוח. פנו לתמיכה.' 
                  : 'Account created but failed to create client record. Please contact support.'
              );
              return;
            }
            
            if (clientResult.data && clientResult.chatUserCreated) {
              setSuccess(
                language === 'hebrew' 
                  ? 'החשבון נוצר בהצלחה! בדקו את האימייל שלכם לאישור.' 
                  : 'Account created successfully! Please check your email for confirmation.'
              );
            } else if (clientResult.data && !clientResult.chatUserCreated) {
              setError(
                language === 'hebrew' 
                  ? 'החשבון נוצר במסד הנתונים הראשי, אך לא ניתן ליצור רשומה במסד הנתונים השני. פנו לתמיכה.' 
                  : 'Account created in primary database, but failed to create record in secondary database. Please contact support.'
              );
              return;
            } else {
              setError(
                language === 'hebrew' 
                  ? 'לא ניתן ליצור רשומות במסדי הנתונים. פנו לתמיכה.' 
                  : 'Failed to create records in databases. Please contact support.'
              );
              return;
            }
          } catch (clientError) {
            setError(
              language === 'hebrew' 
                ? 'החשבון נוצר אבל לא ניתן ליצור רשומת לקוח. פנו לתמיכה.' 
                : 'Account created but failed to create client record. Please contact support.'
            );
            return;
          }
        } else {
          setError(
            language === 'hebrew' 
              ? 'החשבון נוצר אבל לא התקבל מזהה משתמש. פנו לתמיכה.' 
              : 'Account created but no user ID returned. Please contact support.'
          );
          return;
        }
        
        // Clear form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: '',
          agreeToTerms: false
        });
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      setError(language === 'hebrew' ? 'אירעה שגיאה ביצירת החשבון' : 'An error occurred during signup');
      console.error('WhatsApp registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isHebrew = language === 'hebrew';
  const linkClass = `font-semibold text-bc-text underline underline-offset-4 decoration-bc-border hover:decoration-bc-accent rounded ${focusClass}`;
  const inlineLinkClass = `text-bc-text underline underline-offset-2 decoration-bc-border hover:decoration-bc-accent rounded ${focusClass}`;
  // Read-only field: same shape as the input, on the secondary surface.
  const readOnlyField = `${field.replace('bg-bc-canvas', 'bg-bc-surface2')} cursor-not-allowed`;

  return (
    <AuthShell
      title={isHebrew ? 'הרשמה דרך WhatsApp' : 'Sign up with WhatsApp'}
      subtitle={isHebrew ? 'השלימו את ההרשמה עם מספר ה-WhatsApp שלכם' : 'Finish signing up with your WhatsApp number'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {(error || phoneError) ? <AuthNotice>{error || phoneError}</AuthNotice> : null}
        {success ? <AuthNotice tone="success">{success}</AuthNotice> : null}

        <div>
          <label htmlFor="phone" className={fieldLabel}>
            {isHebrew ? 'טלפון (מ-WhatsApp)' : 'Phone (from WhatsApp)'}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            dir="ltr"
            readOnly
            className={readOnlyField}
            value={phone}
          />
          {phone && !phoneError ? (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-bc-muted">
              <Check size={14} aria-hidden="true" className="text-bc-text" />
              {isHebrew ? 'המספר אומת מ-WhatsApp' : 'Verified from WhatsApp'}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AuthField
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            autoFocus
            label={isHebrew ? 'שם פרטי' : 'First name'}
            value={formData.firstName}
            onChange={handleInputChange}
          />
          <AuthField
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            label={isHebrew ? 'שם משפחה' : 'Last name'}
            value={formData.lastName}
            onChange={handleInputChange}
          />
        </div>

        <AuthField
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          label={isHebrew ? 'אימייל' : 'Email'}
          placeholder="name@example.com"
          value={formData.email}
          onChange={handleInputChange}
        />
        <AuthField
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          required
          label={isHebrew ? 'סיסמה' : 'Password'}
          hint={isHebrew ? 'לפחות 6 תווים' : 'At least 6 characters'}
          value={formData.password}
          onChange={handleInputChange}
        />
        <AuthField
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          required
          label={isHebrew ? 'אימות סיסמה' : 'Confirm password'}
          value={formData.confirmPassword}
          onChange={handleInputChange}
        />

        <label htmlFor="agreeToTerms" className="flex items-start gap-3 pt-2 cursor-pointer text-[14px] font-semibold text-bc-muted">
          <input
            id="agreeToTerms"
            name="agreeToTerms"
            type="checkbox"
            required
            className={`w-5 h-5 shrink-0 mt-0.5 accent-[var(--bc-accent)] cursor-pointer rounded ${focusClass}`}
            checked={formData.agreeToTerms}
            onChange={handleInputChange}
          />
          <span>
            {isHebrew ? (
              <>אני מסכים/ה ל<Link to="/terms" className={inlineLinkClass}>תנאי השימוש</Link> ול<Link to="/privacy-policy" className={inlineLinkClass}>מדיניות הפרטיות</Link></>
            ) : (
              <>I agree to the <Link to="/terms" className={inlineLinkClass}>Terms of Service</Link> and <Link to="/privacy-policy" className={inlineLinkClass}>Privacy Policy</Link></>
            )}
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !formData.agreeToTerms || !phone || !!phoneError}
          className={`${primaryButton} w-full mt-2`}
        >
          {loading ? (isHebrew ? 'יוצר חשבון…' : 'Creating account…') : isHebrew ? 'יצירת חשבון' : 'Create account'}
        </button>
      </form>

      <p className="mt-8 text-center text-[15px] font-semibold text-bc-muted">
        {isHebrew ? 'כבר יש לכם חשבון? ' : 'Already have an account? '}
        <Link to="/login" className={linkClass}>{isHebrew ? 'התחברות' : 'Log in'}</Link>
      </p>

      <p className="mt-6 pt-6 border-t border-bc-border text-center text-[13px] font-semibold text-bc-muted">
        {isHebrew ? 'מעדיפים בלי WhatsApp? ' : 'Prefer not to use WhatsApp? '}
        <Link to="/signup" className={linkClass}>{isHebrew ? 'להרשמה רגילה' : 'Use regular signup'}</Link>
      </p>
    </AuthShell>
  );
}

export default WhatsAppRegisterPage;
