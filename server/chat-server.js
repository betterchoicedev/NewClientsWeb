require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const chatSupabaseUrl = process.env.CHAT_SUPABASE_URL;
const chatSupabaseServiceRoleKey = process.env.CHAT_SUPABASE_SERVICE_ROLE_KEY;

if (!chatSupabaseUrl || !chatSupabaseServiceRoleKey) {
  console.error('Missing CHAT_SUPABASE_URL or CHAT_SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const chatSupabase = createClient(chatSupabaseUrl, chatSupabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const app = express();
app.use(cors());
app.use(express.json());

// =========================================================================
// PUBLIC DYNAMIC LANDING PAGE VALIDATION ENDPOINT (CHAT DB RESOLVED)
// =========================================================================
app.post('/api/landing/validate', async (req, res) => {
  try {
    console.log('=== [LANDING API START] ===');
    console.log('Received payload body:', req.body);
    
    const { managerId, linkId } = req.body;

    if (!managerId) {
      console.warn('Validation Halt: Missing managerId in request body.');
      return res.status(400).json({ error: 'Missing required manager verification signature.' });
    }

    // Determine the active database client based on your initialization variable strings
    const activeDbClient = typeof chatSupabase !== 'undefined' && chatSupabase ? chatSupabase : supabase;

    if (!activeDbClient) {
      console.error('CRITICAL: No valid Supabase database client instance could be resolved.');
      return res.status(500).json({ error: 'Server database connection profile missing.' });
    }

    console.log(`Querying profiles table via active instance for manager ID: ${managerId}`);
    
    // 1. Fetch manager profile and verify their company relationship dynamically
    const { data: profile, error: profileError } = await activeDbClient
      .from('profiles')
      .select('id, name, role, company_id')
      .eq('id', managerId)
      .single();

    if (profileError) {
      console.error('Database Profiles Table Query Error:', profileError);
      return res.status(404).json({ error: 'Authorized campaign supervisor account credentials not found.', details: profileError.message });
    }

    console.log('Successfully resolved manager profile:', profile);

    if (!profile || !profile.company_id) {
      console.warn(`Validation Halt: Profile found, but company_id is blank or null.`);
      return res.status(400).json({ error: 'Manager account is not allocated to an active organization.' });
    }

    console.log(`Querying companies table for ID: ${profile.company_id}`);

    // 2. Fetch company parameters based on the manager's corporate ID binding
    const { data: company, error: companyError } = await activeDbClient
      .from('companies')
      .select('id, name')
      .eq('id', profile.company_id)
      .single();

    if (companyError) {
      console.error('Database Companies Table Query Error:', companyError);
      return res.status(404).json({ error: 'Associated company records could not be resolved.', details: companyError.message });
    }

    console.log('Successfully resolved company data:', company);

    // 3. Scenario 2: Validate Smart Link Rules from registration_rules table if present
    if (linkId) {
      console.log(`Scenario 2 Detected! Verifying registration rule for linkId: ${linkId}`);
      
      const { data: rule, error: ruleError } = await activeDbClient
        .from('registration_rules')
        .select('*')
        .eq('link_id', linkId)
        .single();

      if (ruleError) {
        console.error('Registration Rules Query Error:', ruleError);
        return res.status(404).json({ error: 'Active campaign parameters not found in registration engine.', details: ruleError.message });
      }

      console.log('Successfully resolved registration rule metrics:', rule);

      // Strict Time Quota Assertion based on Server-Clock
      if (rule.expires_at) {
        const expirationDate = new Date(rule.expires_at);
        console.log(`Evaluating link expiration. Server Time: ${new Date().toISOString()} vs Expiry Time: ${expirationDate.toISOString()}`);
        if (expirationDate.getTime() < Date.now()) {
          console.warn('Validation Halt: Registration link parameters have expired.');
          return res.status(410).json({ error: 'This registration link parameters have reached expiration thresholds.' });
        }
      }

      // Strict Seat Quota Counter Assertion
      if (rule.current_count != null && rule.max_slots != null) {
        console.log(`Evaluating slot quotas: ${rule.current_count} used out of ${rule.max_slots}`);
        if (rule.current_count >= rule.max_slots) {
          console.warn('Validation Halt: All allocated participant seats have been consumed.');
          return res.status(403).json({ error: 'All allocated participant seats for this link have been consumed.' });
        }
      }
    }

    const payloadResponse = {
      success: true,
      company: {
        id: company.id,
        name: company.name,
        slug: company.name.toLowerCase().trim()
      },
      manager: {
        name: profile.name,
        role: profile.role
      }
    };

    console.log('=== [LANDING API SUCCESS] === Dispatched Payload:', payloadResponse);
    return res.status(200).json(payloadResponse);

  } catch (err) {
    console.error('CRITICAL INTERNAL ROUTE EXCEPTION TRACE:', err);
    return res.status(500).json({ error: 'Internal system validation processing failure.', exception: err.message });
  }
});

app.get('/health', async (req, res) => {
  try {
    const { error } = await chatSupabase.auth.getSession();

    if (error) {
      return res.status(500).json({
        status: 'error',
        supabase: 'unreachable',
        message: error.message,
      });
    }

    return res.json({
      status: 'ok',
      supabase: 'connected',
      url: chatSupabaseUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

app.get('/api/companies', async (req, res) => {
  try {
    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('companies')
      .select('id, name, managers:profiles!profiles_company_id_fkey(id, name, role)')
      .order('name', { ascending: true });

    if (error) throw error;

    const formattedCompanies = (data || []).map((company) => ({
      id: company.id,
      name: company.name,
      managers: (company.managers || []).filter((manager) => manager.role === 'company_manager')
    }));

    res.json({ data: formattedCompanies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.CHAT_SERVER_PORT || 3002;
app.listen(PORT, () => {
  console.log(`Chat server listening on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
