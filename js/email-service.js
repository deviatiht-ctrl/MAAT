/**
 * Email Service - Resend Integration via Supabase Edge Functions
 * Sends automatic email notifications for reservations
 * Uses DB templates from email_templates table, with hardcoded fallback
 */

import { getConfig, getSupabase } from './main.js';

// ── Template Cache ──
let _templateCache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load email templates from Supabase (cached)
 */
async function loadTemplates() {
  if (_templateCache && Date.now() - _cacheTime < CACHE_TTL) return _templateCache;
  const supabase = getSupabase();
  if (!supabase) { console.warn('📧 Supabase not available for template loading'); return null; }
  try {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('is_active', true);
    if (error) {
      console.warn('📧 email_templates query error (table may not exist):', error.message);
      return null;
    }
    if (data && data.length > 0) {
      _templateCache = {};
      data.forEach(t => { _templateCache[t.template_key] = t; });
      _cacheTime = Date.now();
      console.log('✅ Email templates loaded:', Object.keys(_templateCache));
      return _templateCache;
    }
    console.warn('📧 email_templates empty, using hardcoded fallback');
    return null;
  } catch (e) {
    console.warn('📧 email_templates load failed (using fallback):', e.message || e);
    return null;
  }
}

/**
 * Replace {{variables}} in a template string
 */
function replaceVars(str, vars) {
  if (!str) return '';
  let out = str;
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || '');
  });
  // Handle conditional blocks {{#key}}...{{/key}}
  out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    return vars[key] ? content : '';
  });
  return out;
}

/**
 * Build a full email HTML from a DB template record + variables
 */
function buildFromTemplate(tpl, vars) {
  const accent = tpl.accent_color || '#D4AF37';
  const headerBg = tpl.header_bg || 'linear-gradient(135deg, #4A3728 0%, #6B4F3B 100%)';
  const logoUrl = tpl.logo_url || '';
  const headerTitle = replaceVars(tpl.header_title || 'DALIGHT Head Spa', vars);
  const headerSubtitle = replaceVars(tpl.header_subtitle || '', vars);
  const greeting = replaceVars(tpl.greeting || '', vars);
  const body = replaceVars(tpl.body_html || '', vars);
  const footer = replaceVars(tpl.footer_text || '', vars);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f5f5}
.email-wrapper{background:#f5f5f5;padding:20px}
.container{max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)}
.header{background:${headerBg};color:white;padding:40px 30px;text-align:center}
.logo{max-width:150px;margin-bottom:20px;border-radius:8px}
.header h1{margin:10px 0 5px 0;font-size:28px;font-weight:600}
.header p{margin:0;font-size:16px;opacity:.9}
.content{background:#fff;padding:40px 30px}
.greeting{font-size:18px;color:#4A3728;margin-bottom:20px;font-weight:500}
.message{color:#666;margin-bottom:25px;line-height:1.8}
.detail-box{background:#f9f7f5;border-left:4px solid ${accent};padding:20px;margin:25px 0;border-radius:8px}
.detail-row{margin:12px 0;display:flex;align-items:flex-start}
.label{font-weight:600;color:#4A3728;min-width:120px}
.value{color:#555;flex:1}
.info-box{background:#fff3cd;border-left:4px solid ${accent};padding:20px;margin:25px 0;border-radius:8px}
.alert-box{background:#fff3cd;border-left:4px solid ${accent};padding:20px;margin:0 0 25px 0;border-radius:8px}
.alert-box strong{color:#4A3728;font-size:16px}
.section-title{color:#4A3728;font-size:18px;font-weight:600;margin:25px 0 15px 0;border-bottom:2px solid ${accent};padding-bottom:8px}
.action-box{background:#e8f5e9;border-left:4px solid #4CAF50;padding:20px;margin:25px 0;border-radius:8px}
.action-box strong{color:#2e7d32}
.order-number{background:#f9f7f5;padding:15px;margin:20px 0;border-radius:8px;text-align:center;border-left:4px solid ${accent}}
.order-number strong{color:#4A3728;font-size:20px}
.contact-box{background:#f9f7f5;padding:25px;margin:25px 0;border-radius:8px;text-align:center}
.contact-item{margin:10px 0;color:#666}
.footer{background:#4A3728;color:white;text-align:center;padding:25px;font-size:14px}
.footer a{color:${accent};text-decoration:none}
.divider{height:1px;background:#e0e0e0;margin:25px 0}
.cta-button{display:inline-block;background:linear-gradient(135deg,${accent},#4A3728);color:white;padding:15px 30px;text-decoration:none;border-radius:8px;margin:20px 0;font-weight:600}
</style></head><body>
<div class="email-wrapper"><div class="container">
<div class="header">
  ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" onerror="this.style.display='none'">` : ''}
  <h1>${headerTitle}</h1>
  ${headerSubtitle ? `<p>${headerSubtitle}</p>` : ''}
</div>
<div class="content">
  ${greeting ? `<p class="greeting">${greeting}</p>` : ''}
  ${body}
  <div class="divider"></div>
  <div class="contact-box">
    <div class="contact-item">📞 <strong>+509 48 48 12 25</strong></div>
    <div class="contact-item">📍 <strong>Delmas 65, Faustin Premier Durandise #10</strong></div>
    <div class="contact-item">📧 <strong>laurorejeanclarens0@gmail.com</strong></div>
  </div>
</div>
<div class="footer">
  <p style="margin:0 0 10px 0;">${footer}</p>
  <p style="margin:0;font-size:12px;opacity:.8;">L'art du bien-être et de la relaxation</p>
</div>
</div></div></body></html>`;
}

/**
 * Try to build email from DB template, return null if not available
 */
async function tryBuildFromDB(templateKey, vars) {
  const templates = await loadTemplates();
  if (!templates || !templates[templateKey]) return null;
  const tpl = templates[templateKey];
  return {
    subject: replaceVars(tpl.subject, vars),
    html: buildFromTemplate(tpl, vars),
  };
}

/**
 * Send reservation email notification via Supabase Edge Function
 * @param {Object} reservationData - Reservation details
 * @param {boolean} isAdmin - Whether sending to admin or client
 */
export async function sendReservationEmail(reservationData, isAdmin = false) {
  const config = getConfig();
  const supabase = getSupabase();
  
  // Skip if no Supabase client
  if (!supabase) {
    console.warn('Supabase not available. Email not sent.');
    return;
  }

  // Try DB template first
  const templateKey = isAdmin ? 'reservation_admin' : 'reservation_client';
  const vars = {
    client_name: reservationData.user_name || reservationData.user_email || '',
    client_email: reservationData.user_email || '',
    service: reservationData.service || '',
    date: formatDate(reservationData.date),
    time: reservationData.time || '',
    location: reservationData.location || '',
    notes: reservationData.notes || '',
    year: new Date().getFullYear().toString(),
  };

  let emailData;
  const dbResult = await tryBuildFromDB(templateKey, vars);
  if (dbResult) {
    emailData = {
      to: [isAdmin ? config.adminEmail : reservationData.user_email],
      subject: dbResult.subject,
      html: dbResult.html,
    };
  } else {
    emailData = isAdmin 
      ? buildAdminEmail(reservationData, config)
      : buildClientEmail(reservationData);
  }

  try {
    console.log(`📧 Sending ${isAdmin ? 'admin' : 'client'} email to:`, emailData.to[0]);
    const response = await supabase.functions.invoke('send-email', {
      body: {
        to: emailData.to[0],
        subject: emailData.subject,
        html: emailData.html,
        isAdmin: isAdmin,
      },
    });

    console.log('📧 Edge Function response:', response);

    if (response.error) {
      const errMsg = response.error?.message || response.error?.context?.message || JSON.stringify(response.error);
      console.error('❌ Edge Function error:', errMsg);
      throw new Error(errMsg);
    }

    // Check if data indicates failure
    if (response.data && response.data.success === false) {
      console.error('❌ Edge Function returned failure:', response.data.error);
      throw new Error(response.data.error || 'Email send failed');
    }

    console.log(`✅ Email sent successfully to ${isAdmin ? 'admin' : 'client'}`, response.data);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    // Don't throw - reservation should still work even if email fails
    return false;
  }
}

/**
 * Send status update email when admin confirms/cancels reservation
 * @param {Object} reservationData - Reservation details
 * @param {string} newStatus - New status (CONFIRMED, CANCELLED, COMPLETED)
 */
export async function sendStatusUpdateEmail(reservationData, newStatus) {
  const config = getConfig();
  const supabase = getSupabase();
  
  if (!supabase) {
    console.warn('Supabase not available. Email not sent.');
    return;
  }

  // Map status to template key
  const statusTemplateMap = {
    'CONFIRMED': 'status_confirmed',
    'CANCELLED': 'status_cancelled',
    'COMPLETED': 'status_completed',
  };
  const templateKey = statusTemplateMap[newStatus];
  const vars = {
    client_name: reservationData.user_name || reservationData.user_email || '',
    client_email: reservationData.user_email || '',
    service: reservationData.service || '',
    date: formatDate(reservationData.date),
    time: reservationData.time || '',
    location: reservationData.location || '',
    notes: reservationData.notes || '',
    year: new Date().getFullYear().toString(),
  };

  let emailData;
  const dbResult = templateKey ? await tryBuildFromDB(templateKey, vars) : null;
  if (dbResult) {
    emailData = { to: [reservationData.user_email], subject: dbResult.subject, html: dbResult.html };
  } else {
    emailData = buildStatusUpdateEmail(reservationData, newStatus);
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: emailData.to[0],
        subject: emailData.subject,
        html: emailData.html,
        isAdmin: false,
      },
    });

    if (error) {
      console.error('Edge Function error:', error);
      throw error;
    }

    console.log(`Status update email sent successfully to client`, data);
    return true;
  } catch (error) {
    console.error('Error sending status update email:', error);
    return false;
  }
}

/**
 * Send order confirmation email
 * @param {Object} orderData - Order details
 * @param {boolean} isAdmin - Whether sending to admin or client
 */
export async function sendOrderEmail(orderData, isAdmin = false) {
  const config = getConfig();
  const supabase = getSupabase();
  
  if (!supabase) {
    console.warn('Supabase not available. Email not sent.');
    return;
  }

  const templateKey = isAdmin ? 'order_admin' : 'order_client';
  const vars = {
    client_name: orderData.customer_name || '',
    client_email: orderData.customer_email || '',
    order_number: orderData.order_number || '',
    year: new Date().getFullYear().toString(),
  };

  let emailData;
  const dbResult = await tryBuildFromDB(templateKey, vars);
  if (dbResult) {
    emailData = {
      to: [isAdmin ? config.adminEmail : orderData.customer_email],
      subject: dbResult.subject,
      html: dbResult.html,
    };
  } else {
    emailData = isAdmin 
      ? buildAdminOrderEmail(orderData, config)
      : buildClientOrderEmail(orderData);
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: emailData.to[0],
        subject: emailData.subject,
        html: emailData.html,
        isAdmin: isAdmin,
      },
    });

    if (error) {
      console.error('Edge Function error:', error);
      throw error;
    }

    console.log(`Order email sent successfully to ${isAdmin ? 'admin' : 'client'}`, data);
    return true;
  } catch (error) {
    console.error('Error sending order email:', error);
    return false;
  }
}

/**
 * Send follow/subscription thank you email
 * @param {Object} userData - User details
 */
export async function sendFollowEmail(userData) {
  const config = getConfig();
  const supabase = getSupabase();
  
  if (!supabase) {
    console.warn('Supabase not available. Email not sent.');
    return;
  }

  const vars = {
    client_name: userData.name || userData.email || '',
    client_email: userData.email || '',
    year: new Date().getFullYear().toString(),
  };

  let emailData;
  const dbResult = await tryBuildFromDB('follow_welcome', vars);
  if (dbResult) {
    emailData = { to: [userData.email], subject: dbResult.subject, html: dbResult.html };
  } else {
    emailData = buildFollowEmail(userData);
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: emailData.to[0],
        subject: emailData.subject,
        html: emailData.html,
        isAdmin: false,
      },
    });

    if (error) {
      console.error('Edge Function error:', error);
      throw error;
    }

    console.log(`Follow email sent successfully to ${userData.email}`, data);
    return true;
  } catch (error) {
    console.error('Error sending follow email:', error);
    return false;
  }
}

/**
 * Build email data for client confirmation
 */
function buildClientEmail(reservationData) {
  return {
    from: 'DALIGHT Head Spa <onboarding@resend.dev>',
    to: [reservationData.user_email],
    subject: '📋 Réservation Reçue - En attente de confirmation · DALIGHT Head Spa',
    html: buildClientEmailHTML(reservationData),
  };
}

/**
 * Build email data for admin notification
 */
function buildAdminEmail(reservationData, config) {
  return {
    from: 'DALIGHT Reservations <onboarding@resend.dev>',
    to: [config.adminEmail],
    subject: '🔔 Nouvelle Réservation Reçue',
    html: buildAdminEmailHTML(reservationData),
  };
}

/**
 * Build email data for status update (confirm/cancel/complete)
 */
function buildStatusUpdateEmail(reservationData, newStatus) {
  const statusSubjects = {
    'CONFIRMED': '✓ Votre réservation est confirmée - DALIGHT Head Spa',
    'CANCELLED': '✗ Votre réservation a été annulée - DALIGHT Head Spa',
    'COMPLETED': '★ Merci pour votre visite - DALIGHT Head Spa',
  };

  return {
    from: 'DALIGHT Head Spa <onboarding@resend.dev>',
    to: [reservationData.user_email],
    subject: statusSubjects[newStatus] || 'Mise à jour de votre réservation - DALIGHT Head Spa',
    html: buildStatusUpdateEmailHTML(reservationData, newStatus),
  };
}

/**
 * Build HTML email content for client
 */
function buildClientEmailHTML(data) {
  const logoUrl = 'https://rbwoiejztrkghfkpxquo.supabase.co/storage/v1/object/public/assets/images/logodaligth.jpg';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .email-wrapper { background-color: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #4A3728 0%, #6B4F3B 100%); color: white; padding: 40px 30px; text-align: center; }
        .logo { max-width: 150px; margin-bottom: 20px; border-radius: 8px; }
        .header h1 { margin: 10px 0 5px 0; font-size: 28px; font-weight: 600; }
        .header p { margin: 0; font-size: 16px; opacity: 0.9; }
        .content { background: #ffffff; padding: 40px 30px; }
        .greeting { font-size: 18px; color: #4A3728; margin-bottom: 20px; font-weight: 500; }
        .message { color: #666; margin-bottom: 25px; line-height: 1.8; }
        .detail-box { background: #f9f7f5; border-left: 4px solid #D4AF37; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .detail-row { margin: 12px 0; display: flex; align-items: flex-start; }
        .label { font-weight: 600; color: #4A3728; min-width: 120px; }
        .value { color: #555; flex: 1; }
        .info-box { background: #fff3cd; border-left: 4px solid #D4AF37; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .contact-box { background: #f9f7f5; padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center; }
        .contact-item { margin: 10px 0; color: #666; }
        .footer { background: #4A3728; color: white; text-align: center; padding: 25px; font-size: 14px; }
        .footer a { color: #D4AF37; text-decoration: none; }
        .divider { height: 1px; background: #e0e0e0; margin: 25px 0; }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="DALIGHT Logo" class="logo" onerror="this.style.display='none'">
            <h1>DALIGHT Head Spa</h1>
            <p>Réservation Reçue · En attente de confirmation</p>
          </div>
          <div class="content">
            <p class="greeting">Cher(e) ${data.user_name},</p>
            <p class="message">Nous vous remercions pour votre réservation. Elle a été enregistrée avec succès et est actuellement en attente de confirmation. Voici les détails:</p>
            
            <div class="detail-box">
              <div class="detail-row">
                <span class="label">Service:</span>
                <span class="value">${data.service}</span>
              </div>
              <div class="detail-row">
                <span class="label">Date:</span>
                <span class="value">${formatDate(data.date)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Heure:</span>
                <span class="value">${data.time}</span>
              </div>
              <div class="detail-row">
                <span class="label">Lieu:</span>
                <span class="value">${data.location}</span>
              </div>
              ${data.notes ? `
              <div class="detail-row">
                <span class="label">Notes:</span>
                <span class="value">${data.notes}</span>
              </div>
              ` : ''}
            </div>

            <div class="info-box">
              <strong>ℹ️ Prochaine étape:</strong> Notre équipe examinera votre demande et vous contactera sous peu pour confirmer votre rendez-vous. Vous recevrez un email de confirmation dès que votre réservation sera validée.
            </div>

            <div class="divider"></div>

            <p class="message">Pour toute question ou modification, n'hésitez pas à nous contacter:</p>
            
            <div class="contact-box">
              <div class="contact-item">📞 <strong>+509 48 48 12 25</strong></div>
              <div class="contact-item">📍 <strong>Delmas 65, Faustin Premier Durandise #10</strong></div>
              <div class="contact-item">📧 <strong>laurorejeanclarens0@gmail.com</strong></div>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} <strong>DALIGHT Head Spa</strong>. Tous droits réservés.</p>
            <p style="margin: 0; font-size: 12px; opacity: 0.8;">L'art du bien-être et de la relaxation</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Build HTML email content for admin
 */
function buildAdminEmailHTML(data) {
  const logoUrl = 'https://rbwoiejztrkghfkpxquo.supabase.co/storage/v1/object/public/assets/images/logodaligth.jpg';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .email-wrapper { background-color: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #D4AF37 0%, #4A3728 100%); color: white; padding: 40px 30px; text-align: center; }
        .logo { max-width: 150px; margin-bottom: 20px; border-radius: 8px; }
        .header h1 { margin: 10px 0 5px 0; font-size: 28px; font-weight: 600; }
        .header p { margin: 0; font-size: 16px; opacity: 0.9; }
        .content { background: #ffffff; padding: 40px 30px; }
        .alert-box { background: #fff3cd; border-left: 4px solid #D4AF37; padding: 20px; margin: 0 0 25px 0; border-radius: 8px; }
        .alert-box strong { color: #4A3728; font-size: 16px; }
        .section-title { color: #4A3728; font-size: 18px; font-weight: 600; margin: 25px 0 15px 0; border-bottom: 2px solid #D4AF37; padding-bottom: 8px; }
        .detail-box { background: #f9f7f5; padding: 20px; margin: 15px 0; border-radius: 8px; }
        .detail-row { margin: 12px 0; display: flex; align-items: flex-start; }
        .label { font-weight: 600; color: #4A3728; min-width: 140px; }
        .value { color: #555; flex: 1; }
        .status-badge { display: inline-block; background: #fff3cd; color: #4A3728; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 14px; }
        .action-box { background: #e8f5e9; border-left: 4px solid #4CAF50; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .action-box strong { color: #2e7d32; }
        .footer { background: #4A3728; color: white; text-align: center; padding: 25px; font-size: 14px; }
        .divider { height: 1px; background: #e0e0e0; margin: 25px 0; }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="DALIGHT Logo" class="logo" onerror="this.style.display='none'">
            <h1>🔔 Nouvelle Réservation</h1>
            <p>DALIGHT Head Spa - Panneau d'Administration</p>
          </div>
          <div class="content">
            <div class="alert-box">
              <strong>⚡ Une nouvelle réservation vient d'être soumise!</strong>
              <p style="margin: 10px 0 0 0; color: #666;">Veuillez examiner les détails ci-dessous et prendre les mesures nécessaires.</p>
            </div>
            
            <h3 class="section-title">👤 Informations du Client</h3>
            <div class="detail-box">
              <div class="detail-row">
                <span class="label">Nom:</span>
                <span class="value">${data.user_name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Email:</span>
                <span class="value"><a href="mailto:${data.user_email}" style="color: #D4AF37;">${data.user_email}</a></span>
              </div>
              ${data.user_phone ? `
              <div class="detail-row">
                <span class="label">Téléphone:</span>
                <span class="value"><a href="tel:${data.user_phone}" style="color: #D4AF37;">${data.user_phone}</a></span>
              </div>
              ` : ''}
            </div>

            <h3 class="section-title">📋 Détails de la Réservation</h3>
            <div class="detail-box">
              <div class="detail-row">
                <span class="label">Service:</span>
                <span class="value">${data.service}</span>
              </div>
              <div class="detail-row">
                <span class="label">Date:</span>
                <span class="value">${formatDate(data.date)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Heure:</span>
                <span class="value">${data.time}</span>
              </div>
              <div class="detail-row">
                <span class="label">Lieu:</span>
                <span class="value">${data.location}</span>
              </div>
              ${data.total_amount_usd ? `
              <div class="detail-row">
                <span class="label">Montant Total:</span>
                <span class="value">$${data.total_amount_usd} / ${data.total_amount_htg} HTG</span>
              </div>
              ` : ''}
              ${data.notes ? `
              <div class="detail-row">
                <span class="label">Notes:</span>
                <span class="value">${data.notes}</span>
              </div>
              ` : ''}
              <div class="detail-row">
                <span class="label">Statut:</span>
                <span class="value"><span class="status-badge">PENDING</span></span>
              </div>
            </div>

            <div class="action-box">
              <strong>✅ Action requise:</strong> Connectez-vous au panneau d'administration pour examiner et confirmer cette réservation.
              <p style="margin: 10px 0 0 0; color: #666;">Le client recevra un email de notification une fois la réservation confirmée ou annulée.</p>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} <strong>DALIGHT Head Spa</strong> - Système de Gestion</p>
            <p style="margin: 0; font-size: 12px; opacity: 0.8;">Ceci est un email automatique. Ne pas répondre directement.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Build HTML email content for status updates (confirm/cancel/complete)
 */
function buildStatusUpdateEmailHTML(data, newStatus) {
  const logoUrl = 'https://rbwoiejztrkghfkpxquo.supabase.co/storage/v1/object/public/assets/images/logodaligth.jpg';
  
  const statusConfig = {
    'CONFIRMED': {
      icon: '✓',
      title: 'Réservation Confirmée',
      color: '#4CAF50',
      bgColor: '#e8f5e9',
      message: 'Bonne nouvelle! Votre réservation a été confirmée par notre équipe.',
    },
    'CANCELLED': {
      icon: '✗',
      title: 'Réservation Annulée',
      color: '#f44336',
      bgColor: '#ffebee',
      message: 'Votre réservation a été annulée. N\'hésitez pas à faire une nouvelle réservation.',
    },
    'COMPLETED': {
      icon: '★',
      title: 'Merci pour votre visite!',
      color: '#2196F3',
      bgColor: '#e3f2fd',
      message: 'Nous espérons que vous avez apprécié votre expérience chez DALIGHT Head Spa.',
    },
  };

  const config = statusConfig[newStatus] || statusConfig['CONFIRMED'];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .email-wrapper { background-color: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #4A3728 0%, #6B4F3B 100%); color: white; padding: 40px 30px; text-align: center; }
        .logo { max-width: 150px; margin-bottom: 20px; border-radius: 8px; }
        .header h1 { margin: 10px 0 5px 0; font-size: 28px; font-weight: 600; }
        .header p { margin: 0; font-size: 16px; opacity: 0.9; }
        .content { background: #ffffff; padding: 40px 30px; }
        .status-banner { background: ${config.bgColor}; border-left: 4px solid ${config.color}; padding: 30px; margin: 0 0 25px 0; border-radius: 8px; text-align: center; }
        .status-icon { font-size: 48px; color: ${config.color}; margin-bottom: 15px; }
        .status-title { font-size: 24px; font-weight: 600; color: ${config.color}; margin: 0 0 10px 0; }
        .status-message { color: #666; font-size: 16px; margin: 0; }
        .greeting { font-size: 18px; color: #4A3728; margin: 25px 0 15px 0; font-weight: 500; }
        .detail-box { background: #f9f7f5; border-left: 4px solid #D4AF37; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .detail-row { margin: 12px 0; display: flex; align-items: flex-start; }
        .label { font-weight: 600; color: #4A3728; min-width: 120px; }
        .value { color: #555; flex: 1; }
        .info-box { background: #fff3cd; border-left: 4px solid #D4AF37; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .contact-box { background: #f9f7f5; padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center; }
        .contact-item { margin: 10px 0; color: #666; }
        .footer { background: #4A3728; color: white; text-align: center; padding: 25px; font-size: 14px; }
        .divider { height: 1px; background: #e0e0e0; margin: 25px 0; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #D4AF37, #4A3728); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="DALIGHT Logo" class="logo" onerror="this.style.display='none'">
            <h1>DALIGHT Head Spa</h1>
            <p>Mise à jour de votre réservation</p>
          </div>
          <div class="content">
            <div class="status-banner">
              <div class="status-icon">${config.icon}</div>
              <h2 class="status-title">${config.title}</h2>
              <p class="status-message">${config.message}</p>
            </div>

            <p class="greeting">Cher(e) ${data.user_name},</p>
            
            <div class="detail-box">
              <div class="detail-row">
                <span class="label">Service:</span>
                <span class="value">${data.service}</span>
              </div>
              <div class="detail-row">
                <span class="label">Date:</span>
                <span class="value">${formatDate(data.date)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Heure:</span>
                <span class="value">${data.time}</span>
              </div>
              <div class="detail-row">
                <span class="label">Lieu:</span>
                <span class="value">${data.location}</span>
              </div>
              ${data.notes ? `
              <div class="detail-row">
                <span class="label">Notes:</span>
                <span class="value">${data.notes}</span>
              </div>
              ` : ''}
            </div>

            ${newStatus === 'CONFIRMED' ? `
            <div class="info-box">
              <strong>ℹ️ Informations importantes:</strong>
              <ul style="margin: 10px 0 0 0; color: #666; padding-left: 20px;">
                <li>Veuillez arriver 10 minutes avant votre rendez-vous</li>
                <li>Apportez une pièce d'identité valide</li>
                <li>En cas d'empêchement, merci de nous prévenir au moins 24h à l'avance</li>
              </ul>
            </div>
            ` : ''}

            ${newStatus === 'CANCELLED' ? `
            <div class="info-box">
              <strong>💡 Faire une nouvelle réservation:</strong>
              <p style="margin: 10px 0 0 0; color: #666;">Vous pouvez facilement faire une nouvelle réservation en visitant notre site web.</p>
              <a href="https://dalight-headspa.com/pages/reservation.html" class="cta-button">Réserver Maintenant</a>
            </div>
            ` : ''}

            ${newStatus === 'COMPLETED' ? `
            <div class="info-box">
              <strong>⭐ Votre avis compte pour nous!</strong>
              <p style="margin: 10px 0 0 0; color: #666;">Nous serions ravis de connaître votre expérience. N'hésitez pas à nous laisser un avis ou à nous recommander à vos proches.</p>
            </div>
            ` : ''}

            <div class="divider"></div>

            <p style="color: #666; margin-bottom: 20px;">Pour toute question ou modification, contactez-nous:</p>
            
            <div class="contact-box">
              <div class="contact-item">📞 <strong>+509 48 48 12 25</strong></div>
              <div class="contact-item">📍 <strong>Delmas 65, Faustin Premier Durandise #10</strong></div>
              <div class="contact-item">📧 <strong>laurorejeanclarens0@gmail.com</strong></div>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} <strong>DALIGHT Head Spa</strong>. Tous droits réservés.</p>
            <p style="margin: 0; font-size: 12px; opacity: 0.8;">L'art du bien-être et de la relaxation</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Format date for email display
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Build email data for client order confirmation
 */
function buildClientOrderEmail(orderData) {
  return {
    from: 'DALIGHT Head Spa <onboarding@resend.dev>',
    to: [orderData.customer_email],
    subject: '✓ Confirmation de Commande - DALIGHT Head Spa',
    html: buildClientOrderEmailHTML(orderData),
  };
}

/**
 * Build email data for admin order notification
 */
function buildAdminOrderEmail(orderData, config) {
  return {
    from: 'DALIGHT Orders <onboarding@resend.dev>',
    to: [config.adminEmail],
    subject: '🔔 Nouvelle Commande Reçue',
    html: buildAdminOrderEmailHTML(orderData),
  };
}

/**
 * Build email data for follow/subscription thank you
 */
function buildFollowEmail(userData) {
  return {
    from: 'DALIGHT Head Spa <onboarding@resend.dev>',
    to: [userData.email],
    subject: '🌟 Merci de suivre DALIGHT Head Spa!',
    html: buildFollowEmailHTML(userData),
  };
}

/**
 * Build HTML email content for client order confirmation
 */
function buildClientOrderEmailHTML(data) {
  const logoUrl = 'https://rbwoiejztrkghfkpxquo.supabase.co/storage/v1/object/public/assets/images/logodaligth.jpg';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .email-wrapper { background-color: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #4A3728 0%, #6B4F3B 100%); color: white; padding: 40px 30px; text-align: center; }
        .logo { max-width: 150px; margin-bottom: 20px; border-radius: 8px; }
        .header h1 { margin: 10px 0 5px 0; font-size: 28px; font-weight: 600; }
        .header p { margin: 0; font-size: 16px; opacity: 0.9; }
        .content { background: #ffffff; padding: 40px 30px; }
        .greeting { font-size: 18px; color: #4A3728; margin-bottom: 20px; font-weight: 500; }
        .order-number { background: #f9f7f5; padding: 15px; margin: 20px 0; border-radius: 8px; text-align: center; border-left: 4px solid #D4AF37; }
        .order-number strong { color: #4A3728; font-size: 20px; }
        .message { color: #666; margin-bottom: 25px; line-height: 1.8; }
        .items-box { background: #f9f7f5; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .item-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e0e0e0; }
        .item-row:last-child { border-bottom: none; }
        .item-name { font-weight: 600; color: #4A3728; }
        .item-qty { color: #666; font-size: 14px; }
        .item-price { font-weight: 600; color: #555; }
        .total-box { background: #fff3cd; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #D4AF37; }
        .total-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .total-label { font-weight: 600; color: #4A3728; }
        .total-value { font-weight: 600; color: #D4AF37; font-size: 18px; }
        .info-box { background: #e8f5e9; border-left: 4px solid #4CAF50; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .contact-box { background: #f9f7f5; padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center; }
        .contact-item { margin: 10px 0; color: #666; }
        .footer { background: #4A3728; color: white; text-align: center; padding: 25px; font-size: 14px; }
        .divider { height: 1px; background: #e0e0e0; margin: 25px 0; }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="DALIGHT Logo" class="logo" onerror="this.style.display='none'">
            <h1>DALIGHT Head Spa</h1>
            <p>Commande Confirmée</p>
          </div>
          <div class="content">
            <p class="greeting">Cher(e) ${data.customer_name},</p>
            <p class="message">Nous vous remercions pour votre commande. Elle a été enregistrée avec succès et est en cours de traitement.</p>
            
            <div class="order-number">
              <div style="color: #666; font-size: 14px; margin-bottom: 5px;">Numéro de Commande</div>
              <strong>${data.order_number}</strong>
            </div>

            <h3 style="color: #4A3728; margin: 25px 0 15px 0;">📦 Articles Commandés</h3>
            <div class="items-box">
              ${data.items ? data.items.map(item => `
              <div class="item-row">
                <div>
                  <div class="item-name">${item.name}</div>
                  <div class="item-qty">Quantité: ${item.quantity}</div>
                </div>
                <div class="item-price">${(item.price * item.quantity).toFixed(2)} HTG</div>
              </div>
              `).join('') : ''}
            </div>

            <div class="total-box">
              <div class="total-row">
                <span class="total-label">Sous-total:</span>
                <span>${data.subtotal.toFixed(2)} HTG</span>
              </div>
              <div class="total-row">
                <span class="total-label">Livraison:</span>
                <span>${data.shipping ? data.shipping.toFixed(2) : '0.00'} HTG</span>
              </div>
              <div class="total-row" style="border-top: 2px solid #D4AF37; padding-top: 12px; margin-top: 12px;">
                <span class="total-label">Total:</span>
                <span class="total-value">${data.total.toFixed(2)} HTG</span>
              </div>
            </div>

            <h3 style="color: #4A3728; margin: 25px 0 15px 0;">🚗 Adresse de Livraison</h3>
            <div style="background: #f9f7f5; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <strong>${data.customer_name}</strong><br>
              ${data.shipping_address}<br>
              📞 ${data.customer_phone}
            </div>

            <div class="info-box">
              <strong>ℹ️ Prochaine étape:</strong> Notre équipe préparera votre commande et vous contactera pour organiser la livraison. Vous recevrez un email de suivi dès que votre commande sera expédiée.
            </div>

            <div class="divider"></div>

            <p class="message">Pour toute question, contactez-nous:</p>
            
            <div class="contact-box">
              <div class="contact-item">📞 <strong>+509 48 48 12 25</strong></div>
              <div class="contact-item">📍 <strong>Delmas 65, Faustin Premier Durandise #10</strong></div>
              <div class="contact-item">📧 <strong>laurorejeanclarens0@gmail.com</strong></div>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} <strong>DALIGHT Head Spa</strong>. Tous droits réservés.</p>
            <p style="margin: 0; font-size: 12px; opacity: 0.8;">L'art du bien-être et de la relaxation</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Build HTML email content for admin order notification
 */
function buildAdminOrderEmailHTML(data) {
  const logoUrl = 'https://rbwoiejztrkghfkpxquo.supabase.co/storage/v1/object/public/assets/images/logodaligth.jpg';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .email-wrapper { background-color: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #D4AF37 0%, #4A3728 100%); color: white; padding: 40px 30px; text-align: center; }
        .logo { max-width: 150px; margin-bottom: 20px; border-radius: 8px; }
        .header h1 { margin: 10px 0 5px 0; font-size: 28px; font-weight: 600; }
        .header p { margin: 0; font-size: 16px; opacity: 0.9; }
        .content { background: #ffffff; padding: 40px 30px; }
        .alert-box { background: #fff3cd; border-left: 4px solid #D4AF37; padding: 20px; margin: 0 0 25px 0; border-radius: 8px; }
        .alert-box strong { color: #4A3728; font-size: 16px; }
        .section-title { color: #4A3728; font-size: 18px; font-weight: 600; margin: 25px 0 15px 0; border-bottom: 2px solid #D4AF37; padding-bottom: 8px; }
        .detail-box { background: #f9f7f5; padding: 20px; margin: 15px 0; border-radius: 8px; }
        .detail-row { margin: 12px 0; display: flex; align-items: flex-start; }
        .label { font-weight: 600; color: #4A3728; min-width: 140px; }
        .value { color: #555; flex: 1; }
        .order-number { background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px; text-align: center; border-left: 4px solid #D4AF37; }
        .order-number strong { color: #4A3728; font-size: 20px; }
        .items-box { background: #f9f7f5; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .item-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e0e0e0; }
        .item-row:last-child { border-bottom: none; }
        .item-name { font-weight: 600; color: #4A3728; }
        .item-qty { color: #666; font-size: 14px; }
        .item-price { font-weight: 600; color: #555; }
        .total-box { background: #fff3cd; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #D4AF37; }
        .total-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .total-label { font-weight: 600; color: #4A3728; }
        .total-value { font-weight: 600; color: #D4AF37; font-size: 18px; }
        .action-box { background: #e8f5e9; border-left: 4px solid #4CAF50; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .action-box strong { color: #2e7d32; }
        .footer { background: #4A3728; color: white; text-align: center; padding: 25px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="DALIGHT Logo" class="logo" onerror="this.style.display='none'">
            <h1>🔔 Nouvelle Commande</h1>
            <p>DALIGHT Head Spa - Panneau d'Administration</p>
          </div>
          <div class="content">
            <div class="alert-box">
              <strong>⚡ Une nouvelle commande vient d'être soumise!</strong>
              <p style="margin: 10px 0 0 0; color: #666;">Veuillez examiner les détails ci-dessous et préparer la commande.</p>
            </div>

            <div class="order-number">
              <div style="color: #666; font-size: 14px; margin-bottom: 5px;">Numéro de Commande</div>
              <strong>${data.order_number}</strong>
            </div>
            
            <h3 class="section-title">👤 Informations du Client</h3>
            <div class="detail-box">
              <div class="detail-row">
                <span class="label">Nom:</span>
                <span class="value">${data.customer_name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Email:</span>
                <span class="value"><a href="mailto:${data.customer_email}" style="color: #D4AF37;">${data.customer_email}</a></span>
              </div>
              <div class="detail-row">
                <span class="label">Téléphone:</span>
                <span class="value"><a href="tel:${data.customer_phone}" style="color: #D4AF37;">${data.customer_phone}</a></span>
              </div>
            </div>

            <h3 class="section-title">📦 Articles Commandés</h3>
            <div class="items-box">
              ${data.items ? data.items.map(item => `
              <div class="item-row">
                <div>
                  <div class="item-name">${item.name}</div>
                  <div class="item-qty">Quantité: ${item.quantity}</div>
                </div>
                <div class="item-price">${(item.price * item.quantity).toFixed(2)} HTG</div>
              </div>
              `).join('') : ''}
            </div>

            <div class="total-box">
              <div class="total-row">
                <span class="total-label">Sous-total:</span>
                <span>${data.subtotal.toFixed(2)} HTG</span>
              </div>
              <div class="total-row">
                <span class="total-label">Total:</span>
                <span class="total-value">${data.total.toFixed(2)} HTG</span>
              </div>
            </div>

            <h3 class="section-title">🚗 Adresse de Livraison</h3>
            <div class="detail-box">
              <strong>${data.customer_name}</strong><br>
              ${data.shipping_address}<br>
              📞 ${data.customer_phone}
            </div>

            <div class="detail-box">
              <div class="detail-row">
                <span class="label">Mode de Paiement:</span>
                <span class="value">${data.payment_method}</span>
              </div>
              <div class="detail-row">
                <span class="label">Statut Paiement:</span>
                <span class="value">${data.payment_status}</span>
              </div>
              ${data.notes ? `
              <div class="detail-row">
                <span class="label">Notes:</span>
                <span class="value">${data.notes}</span>
              </div>
              ` : ''}
            </div>

            <div class="action-box">
              <strong>✅ Action requise:</strong> Connectez-vous au panneau d'administration pour examiner et traiter cette commande.
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} <strong>DALIGHT Head Spa</strong> - Système de Gestion</p>
            <p style="margin: 0; font-size: 12px; opacity: 0.8;">Ceci est un email automatique. Ne pas répondre directement.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Build HTML email content for follow/subscription thank you
 */
function buildFollowEmailHTML(data) {
  const logoUrl = 'https://rbwoiejztrkghfkpxquo.supabase.co/storage/v1/object/public/assets/images/logodaligth.jpg';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .email-wrapper { background-color: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #4A3728 0%, #6B4F3B 100%); color: white; padding: 40px 30px; text-align: center; }
        .logo { max-width: 150px; margin-bottom: 20px; border-radius: 8px; }
        .header h1 { margin: 10px 0 5px 0; font-size: 28px; font-weight: 600; }
        .header p { margin: 0; font-size: 16px; opacity: 0.9; }
        .content { background: #ffffff; padding: 40px 30px; }
        .welcome-banner { background: linear-gradient(135deg, #fff3cd, #f9f7f5); padding: 30px; margin: 0 0 25px 0; border-radius: 8px; text-align: center; border-left: 4px solid #D4AF37; }
        .welcome-icon { font-size: 48px; margin-bottom: 15px; }
        .welcome-title { font-size: 24px; font-weight: 600; color: #4A3728; margin: 0 0 10px 0; }
        .welcome-message { color: #666; font-size: 16px; margin: 0; line-height: 1.8; }
        .greeting { font-size: 18px; color: #4A3728; margin: 25px 0 15px 0; font-weight: 500; }
        .benefits-box { background: #f9f7f5; padding: 25px; margin: 25px 0; border-radius: 8px; }
        .benefits-title { color: #4A3728; font-size: 18px; font-weight: 600; margin: 0 0 15px 0; }
        .benefit-item { display: flex; align-items: center; margin: 12px 0; color: #666; }
        .benefit-icon { font-size: 20px; margin-right: 12px; }
        .cta-box { background: #e8f5e9; padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center; border-left: 4px solid #4CAF50; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #D4AF37, #4A3728); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 15px 0; font-weight: 600; }
        .social-box { background: #f9f7f5; padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center; }
        .social-title { color: #4A3728; font-weight: 600; margin-bottom: 15px; }
        .social-links { display: flex; justify-content: center; gap: 15px; margin: 15px 0; }
        .social-link { display: inline-block; padding: 10px 20px; background: #4A3728; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; }
        .contact-box { background: #f9f7f5; padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center; }
        .contact-item { margin: 10px 0; color: #666; }
        .footer { background: #4A3728; color: white; text-align: center; padding: 25px; font-size: 14px; }
        .divider { height: 1px; background: #e0e0e0; margin: 25px 0; }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="DALIGHT Logo" class="logo" onerror="this.style.display='none'">
            <h1>DALIGHT Head Spa</h1>
            <p>Bienvenue dans notre communauté!</p>
          </div>
          <div class="content">
            <div class="welcome-banner">
              <div class="welcome-icon">🌟</div>
              <h2 class="welcome-title">Merci de suivre DALIGHT Head Spa!</h2>
              <p class="welcome-message">Nous sommes ravis de vous compter parmi nos abonnés. Vous faites maintenant partie de notre communauté bien-être exclusive.</p>
            </div>

            <p class="greeting">Cher(e) membre DALIGHT,</p>
            
            <p style="color: #666; line-height: 1.8; margin-bottom: 25px;">
              En suivant DALIGHT Head Spa, vous avez accès à du contenu exclusif et restez informé de nos dernières actualités, promotions et nouveaux rituels.
            </p>

            <div class="benefits-box">
              <h3 class="benefits-title">✨ Vos avantages d'abonné:</h3>
              <div class="benefit-item">
                <span class="benefit-icon">🎥</span>
                <span>Accès à nos vidéos exclusives de rituels bien-être</span>
              </div>
              <div class="benefit-item">
                <span class="benefit-icon">🎁</span>
                <span>Promotions et offres spéciales réservées aux abonnés</span>
              </div>
              <div class="benefit-item">
                <span class="benefit-icon">📰</span>
                <span>Actualités et conseils bien-être avant tout le monde</span>
              </div>
              <div class="benefit-item">
                <span class="benefit-icon">⭐</span>
                <span>Invitations à nos événements et ateliers exclusifs</span>
              </div>
            </div>

            <div class="cta-box">
              <h3 style="color: #2e7d32; margin: 0 0 10px 0;">🎯 Découvrez nos services</h3>
              <p style="color: #666; margin: 0 0 15px 0;">Explorez notre gamme complète de soins et trouvez le rituel parfait pour vous</p>
              <a href="https://dalight-headspa.com/pages/services.html" class="cta-button">Voir nos Services</a>
            </div>

            <div class="social-box">
              <h3 class="social-title">📱 Suivez-nous sur les réseaux sociaux</h3>
              <p style="color: #666; margin-bottom: 15px;">Rejoignez notre communauté et restez connecté</p>
              <div class="social-links">
                <a href="#" class="social-link">📘 Facebook</a>
                <a href="#" class="social-link">📸 Instagram</a>
                <a href="#" class="social-link">▶️ YouTube</a>
              </div>
            </div>

            <div class="divider"></div>

            <p style="color: #666; margin-bottom: 20px;">Une question? Contactez-nous:</p>
            
            <div class="contact-box">
              <div class="contact-item">📞 <strong>+509 48 48 12 25</strong></div>
              <div class="contact-item">📍 <strong>Delmas 65, Faustin Premier Durandise #10</strong></div>
              <div class="contact-item">📧 <strong>laurorejeanclarens0@gmail.com</strong></div>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} <strong>DALIGHT Head Spa</strong>. Tous droits réservés.</p>
            <p style="margin: 0; font-size: 12px; opacity: 0.8;">L'art du bien-être et de la relaxation</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
