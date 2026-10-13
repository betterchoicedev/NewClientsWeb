// Creates (or updates) a company's pricing offer: a Stripe product with a monthly and a
// yearly price, saved to companies.config.pricing.offer. Safe to re-run: existing prices
// are reused when the amount has not changed.
//
// Usage:
//   node scripts/create-company-offer.js --manager <profileId> \
//     --monthly 15 --yearly 144 --trial 30 --days 25 --window 30 --extra 30 [--dry-run]
//   (use --company <companyId> instead of --manager to target a company directly)
//   node scripts/create-company-offer.js --company <companyId> --disable

const stripe = require('../config/stripe');
const { clientDB, adminDB } = require('../config/db');
const { readCompanyOffer } = require('../services/company-offer');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key.slice(2)] = true;
    else { args[key.slice(2)] = next; i++; }
  }
  return args;
}

async function resolveCompanyId(args) {
  if (args.company) return String(args.company);
  if (!args.manager) throw new Error('Pass --company <id> or --manager <profileId>');
  const { data, error } = await adminDB.from('profiles').select('company_id').eq('id', args.manager).maybeSingle();
  if (error) throw error;
  if (!data?.company_id) throw new Error(`Manager ${args.manager} has no company_id`);
  return data.company_id;
}

// companies rows can live in both projects; fetchCompanies lets the main DB row win.
async function loadCompanyRows(companyId) {
  const rows = [];
  for (const [label, db] of [['admin', adminDB], ['client', clientDB]]) {
    if (!db) continue;
    const { data, error } = await db.from('companies').select('id, name, config').eq('id', companyId).maybeSingle();
    if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw error;
    if (data) rows.push({ label, db, row: data });
  }
  return rows;
}

async function reusablePrice(priceId, cents, interval) {
  if (!priceId) return null;
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (price.active && price.unit_amount === cents && price.currency === 'usd' && price.recurring?.interval === interval) {
      return price;
    }
  } catch {
    return null;
  }
  return null;
}

async function ensureProduct(existingPriceId, companyId, companyName) {
  if (existingPriceId) {
    try {
      const price = await stripe.prices.retrieve(existingPriceId);
      if (price.product) return typeof price.product === 'string' ? price.product : price.product.id;
    } catch { /* fall through and create */ }
  }
  const product = await stripe.products.create({
    name: `${companyName} — Membership`,
    metadata: { company_id: String(companyId), app_plan: 'company_offer' },
  });
  return product.id;
}

async function ensurePrice(productId, existingPriceId, dollars, interval, companyId) {
  const cents = Math.round(dollars * 100);
  const existing = await reusablePrice(existingPriceId, cents, interval);
  if (existing) return existing;
  const created = await stripe.prices.create({
    product: productId,
    unit_amount: cents,
    currency: 'usd',
    recurring: { interval },
    metadata: { company_id: String(companyId), app_plan: 'company_offer', plan: interval === 'year' ? 'yearly' : 'monthly' },
  });
  if (existingPriceId && existingPriceId !== created.id) {
    try { await stripe.prices.update(existingPriceId, { active: false }); } catch { /* old price may be gone */ }
  }
  return created;
}

async function saveOffer(rows, offer) {
  for (const { label, db, row } of rows) {
    const config = row.config && typeof row.config === 'object' ? row.config : {};
    const pricing = config.pricing && typeof config.pricing === 'object' ? config.pricing : {};
    const nextConfig = { ...config, pricing: { ...pricing, offer } };
    const { error } = await db.from('companies').update({ config: nextConfig }).eq('id', row.id);
    if (error) throw error;
    console.log(`Saved offer on ${label} DB companies row`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!adminDB) throw new Error('Admin DB is not configured');

  const companyId = await resolveCompanyId(args);
  const rows = await loadCompanyRows(companyId);
  if (rows.length === 0) throw new Error(`Company ${companyId} not found`);
  const winning = rows[rows.length - 1].row;
  const companyName = winning.name || 'Company';
  const current = winning.config?.pricing?.offer || null;
  console.log(`Company: ${companyName} (${companyId})`);

  if (args.disable) {
    if (!current) { console.log('No offer to disable'); return; }
    await saveOffer(rows, { ...current, active: false });
    console.log('Offer disabled');
    return;
  }

  const monthlyDollars = Number(args.monthly ?? 15);
  const yearlyDollars = Number(args.yearly ?? 144);
  const trialDays = Number(args.trial ?? 30);
  const earnedFreeMonth = args['no-earned-month'] ? null : {
    activeDaysNeeded: Number(args.days ?? 25),
    windowDays: Number(args.window ?? 30),
    extraDays: Number(args.extra ?? 30),
  };

  if (args['dry-run']) {
    console.log('Dry run. Would save:', { monthlyDollars, yearlyDollars, trialDays, earnedFreeMonth });
    return;
  }

  const productId = await ensureProduct(current?.monthlyPriceId || current?.yearlyPriceId, companyId, companyName);
  const monthly = await ensurePrice(productId, current?.monthlyPriceId, monthlyDollars, 'month', companyId);
  const yearly = await ensurePrice(productId, current?.yearlyPriceId, yearlyDollars, 'year', companyId);

  const offer = {
    active: true,
    stripeProductId: productId,
    monthlyPriceId: monthly.id,
    monthlyDollars,
    yearlyPriceId: yearly.id,
    yearlyDollars,
    trialDays,
    earnedFreeMonth,
    updatedAt: new Date().toISOString(),
  };
  if (!readCompanyOffer({ pricing: { offer } })) throw new Error('Offer failed validation, nothing saved');

  await saveOffer(rows, offer);
  console.log(`Stripe mode: ${monthly.livemode ? 'LIVE' : 'TEST'}`);
  console.log(JSON.stringify(offer, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
