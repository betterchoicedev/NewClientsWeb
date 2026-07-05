const WA_GRAPH_URL = 'https://graph.facebook.com/v22.0/656545780873051/messages';

/**
 * Send a WhatsApp welcome message directly to a phone number.
 * @param {string} phone  - E.164 phone number
 * @param {string} language - User language code (e.g. 'en', 'he', 'hebrew')
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
async function sendWhatsAppWelcomeToPhone(phone, language) {
  const waToken = process.env.WA_TOKEN || process.env.WHATSAPP_TOKEN;
  if (!waToken) {
    return { success: false, error: 'WA_TOKEN environment variable is missing' };
  }

  let templateName = 'welcome_message_paid_clients';
  let languageCode = 'en';
  if (language === 'he' || language === 'hebrew') {
    templateName = 'welcome_message_paid_clients_hebrew';
    languageCode = 'he';
  }

  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: { name: templateName, language: { code: languageCode } },
  };

  console.log('📱 Sending WhatsApp welcome message:', { to: phone, template: templateName, language: languageCode });

  const response = await fetch(WA_GRAPH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error('❌ WhatsApp API error:', responseData);
    return { success: false, error: responseData.error?.message || 'Unknown error', details: responseData };
  }

  console.log('✅ WhatsApp welcome message sent successfully:', responseData);
  return { success: true, data: responseData };
}

/**
 * Lookup a client by user_id and send the full welcome + pin-the-chat WhatsApp flow.
 * @param {string} userId
 * @param {import('@supabase/supabase-js').SupabaseClient} clientDB
 * @returns {Promise<{ success: boolean, status?: number, message?: string }>}
 */
async function sendWhatsAppWelcomeByUserId(userId, clientDB) {
  const { data: client, error } = await clientDB
    .from('clients')
    .select('phone, user_language')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error fetching client for WhatsApp:', error);
    return { success: false, status: 500, message: 'Failed to fetch client' };
  }
  if (!client || !client.phone) {
    console.log('📱 sendWhatsAppWelcomeByUserId: no client or phone for user_id:', userId);
    return { success: false, message: 'No client or phone found' };
  }

  const phone    = client.phone;
  const language = client.user_language || 'en';
  console.log('📱 sendWhatsAppWelcomeByUserId: attempting to send to number:', phone, 'user_id:', userId);

  const waToken = process.env.WA_TOKEN || process.env.WHATSAPP_TOKEN;
  if (!waToken) {
    console.error('❌ WhatsApp token not configured');
    return { success: false, status: 500, message: 'WhatsApp service not configured' };
  }

  let templateName = 'welcome_message_paid_clients';
  let languageCode = 'en';
  if (language === 'he' || language === 'hebrew') {
    templateName = 'welcome_message_paid_clients_hebrew';
    languageCode = 'he';
  }

  // 1) Welcome message
  const res = await fetch(WA_GRAPH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: { name: templateName, language: { code: languageCode } },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('❌ WhatsApp welcome failed — to:', phone, 'user_id:', userId, 'API error:', data);
    return { success: false, status: res.status, message: data?.error?.message || 'Failed to send' };
  }
  console.log('✅ WhatsApp welcome actually sent — to:', phone, 'user_id:', userId, 'message_id:', data?.messages?.[0]?.id || '(none)');

  // 2) Pin-the-chat message (same language)
  const pinTemplateName = languageCode === 'he' ? 'pin_the_chat_hebrew' : 'pin_the_chat';
  const resPin = await fetch(WA_GRAPH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: { name: pinTemplateName, language: { code: languageCode } },
    }),
  });
  const dataPin = await resPin.json();
  if (!resPin.ok) {
    console.error('❌ WhatsApp pin-the-chat failed — to:', phone, 'user_id:', userId, 'API error:', dataPin);
  } else {
    console.log('✅ WhatsApp pin-the-chat sent — to:', phone, 'user_id:', userId);
  }

  console.log('✅ WhatsApp welcome flow complete — message sent to number:', phone, 'user_id:', userId);
  return { success: true };
}

module.exports = { sendWhatsAppWelcomeToPhone, sendWhatsAppWelcomeByUserId };
