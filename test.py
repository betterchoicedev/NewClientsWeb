import stripe
import sys
import time
import traceback

# הגדרות - שנה ל-Secret Key שלך (או השתמש ב-STRIPE_SECRET_KEY מהסביבה)

def report_usage_for_user(si_id):
    try:
        # In newer stripe-python the usage_records endpoint is not on SubscriptionItem.
        # Call the REST API directly: POST /v1/subscription_items/{id}/usage_records
        usage_record = stripe.SubscriptionItem._static_request(
            "post",
            "/v1/billing/meter_events",
            params={
                "event_name": "api_requests",
                "payload[stripe_customer_id]": "cus_TJX24edvtH1A0O",
                "payload[stripe_subscription_item_id]": "si_TsjMByC4dzvrNW",
                "payload[value]": "22",
                "timestamp": int(time.time()),
            },
            base_address="api",
        )

        print(f"✅ הצלחה!")
        print(f"🔹 מזהה מנוי: {si_id}")
        total = getattr(usage_record, "total_usage", getattr(usage_record, "quantity", "?"))
        print(f"🔹 סך ימי פעילות שנרשמו: {total}")

    except stripe.error.StripeError as e:
        print(f"❌ שגיאת Stripe: {e.user_message if e.user_message else e}")
    except Exception:
        print("❌ שגיאה בלתי צפויה:")
        traceback.print_exc()


if __name__ == "__main__":
    target_id = sys.argv[1] if len(sys.argv) > 1 else "si_TsjMByC4dzvrNW"
    report_usage_for_user(target_id)
