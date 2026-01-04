/**
 * WhatsApp OTP Service
 * Service for sending OTP codes via WhatsApp
 */

/**
 * Send OTP code via WhatsApp
 * @param {string} phoneNumber - Phone number in E.164 format (e.g., +972504451096)
 * @param {string} otpCode - The OTP code to send
 * @returns {Promise<Object|string>} - Response from the API
 */
export async function sendWhatsAppOTP(phoneNumber, otpCode) {
    const url = 'https://api-gw.eu-prod.betterchoice.one/api/conversations/messages';

    const payload = {
        "phone_number": phoneNumber,
        "template_id": "auth_hebrew ",
        "language": "he",
       
    };

    try {
        console.log(`Attempting to send OTP to ${phoneNumber}...`);
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        console.log('Request headers:', headers);
        console.log('Request payload:', payload);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        // Get response text first, then try to parse as JSON
        const responseText = await response.text();
        let result;
        
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            // If response is not JSON, use the text directly
            result = responseText;
        }

        if (response.ok) {
            console.log('✅ Success! Message sent:', result);
        } else {
            console.error('❌ Error from server:', result);
            console.error('Response status:', response.status, response.statusText);
            
            // Log detailed error information
            if (result && result.detail && Array.isArray(result.detail)) {
                result.detail.forEach((errorDetail, index) => {
                    console.error(`Error ${index + 1}:`, {
                        type: errorDetail.type,
                        location: errorDetail.loc,
                        message: errorDetail.msg,
                        input: errorDetail.input
                    });
                    console.error(`  Missing field path: ${JSON.stringify(errorDetail.loc)}`);
                });
            }
        }

        return result;
    } catch (error) {
        console.error(' Network or unexpected error:', error.message);
        throw error;
    }
}

sendWhatsAppOTP("+972504451096", "123456");
