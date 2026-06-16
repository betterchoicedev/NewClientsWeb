/**
 * @param {string} phoneNumber 
 * @param {string} otpCode 
 */
async function sendWhatsAppOTP(phoneNumber, otpCode) {
    const url = 'https://api-gw.eu-prod.betterchoice.one/whapi/send-external-message';

    const payload = {
        "phone_number": phoneNumber,
        "template_id": "auth_hebrew", 
        "message": "test",
        "template_data": {
            "1": otpCode
        }
    };

    try {
        console.log(`Attempting to send OTP to ${phoneNumber}...`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
        }
    } catch (error) {
        console.error(' Network or unexpected error:', error.message);
    }
}

sendWhatsAppOTP("+972504451096", "123456");