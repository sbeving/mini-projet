/**
 * Notification Integrations Routes
 * Twilio SMS, SendGrid Email, Slack, Discord, Telegram
 * For HIGH and FATAL log alerts
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Notification provider types
type NotificationProvider = 'twilio' | 'sendgrid' | 'slack' | 'discord' | 'telegram';

interface NotificationConfig {
  twilio?: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
    toNumbers: string[];
    enabled: boolean;
  };
  sendgrid?: {
    apiKey: string;
    fromEmail: string;
    toEmails: string[];
    enabled: boolean;
  };
  slack?: {
    webhookUrl: string;
    channel?: string;
    enabled: boolean;
  };
  discord?: {
    webhookUrl: string;
    enabled: boolean;
  };
  telegram?: {
    botToken: string;
    chatIds: string[];
    enabled: boolean;
  };
}

// In-memory config store (would be better in Redis/DB in production)
let notificationConfig: NotificationConfig = {};

// Encryption helpers
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'logchat-notification-key-32char!';
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return text;
  }
}

// =============================================================================
// GET /api/notifications/config - Get current notification config
// =============================================================================
router.get('/config', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Return config with masked sensitive data
    const maskedConfig: any = {};
    
    for (const [provider, config] of Object.entries(notificationConfig)) {
      if (!config) continue;
      
      maskedConfig[provider] = { ...config };
      
      // Mask sensitive fields
      if (provider === 'twilio') {
        maskedConfig[provider].authToken = config.authToken ? '••••••••' : '';
      } else if (provider === 'sendgrid') {
        maskedConfig[provider].apiKey = config.apiKey ? '••••••••' : '';
      } else if (provider === 'telegram') {
        maskedConfig[provider].botToken = config.botToken ? '••••••••' : '';
      }
    }
    
    res.json({
      success: true,
      config: maskedConfig
    });
  } catch (error: any) {
    console.error('[Notifications] Error getting config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// POST /api/notifications/configure/:provider - Configure a notification provider
// =============================================================================
router.post('/configure/:provider', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { provider } = req.params as { provider: NotificationProvider };
    const config = req.body;
    
    switch (provider) {
      case 'twilio':
        notificationConfig.twilio = {
          accountSid: config.accountSid,
          authToken: encrypt(config.authToken),
          fromNumber: config.fromNumber,
          toNumbers: config.toNumbers || [],
          enabled: config.enabled ?? true
        };
        break;
        
      case 'sendgrid':
        notificationConfig.sendgrid = {
          apiKey: encrypt(config.apiKey),
          fromEmail: config.fromEmail,
          toEmails: config.toEmails || [],
          enabled: config.enabled ?? true
        };
        break;
        
      case 'slack':
        notificationConfig.slack = {
          webhookUrl: config.webhookUrl,
          channel: config.channel,
          enabled: config.enabled ?? true
        };
        break;
        
      case 'discord':
        notificationConfig.discord = {
          webhookUrl: config.webhookUrl,
          enabled: config.enabled ?? true
        };
        break;
        
      case 'telegram':
        notificationConfig.telegram = {
          botToken: encrypt(config.botToken),
          chatIds: config.chatIds || [],
          enabled: config.enabled ?? true
        };
        break;
        
      default:
        return res.status(400).json({ success: false, error: 'Invalid provider' });
    }
    
    res.json({
      success: true,
      message: `${provider} configured successfully`
    });
  } catch (error: any) {
    console.error('[Notifications] Error configuring provider:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// POST /api/notifications/test/:provider - Test a notification provider
// =============================================================================
router.post('/test/:provider', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { provider } = req.params as { provider: NotificationProvider };
    const testConfig = req.body; // Optionally pass config for testing before saving
    
    let result: { success: boolean; message: string; error?: string };
    
    switch (provider) {
      case 'twilio':
        result = await testTwilio(testConfig || notificationConfig.twilio);
        break;
        
      case 'sendgrid':
        result = await testSendGrid(testConfig || notificationConfig.sendgrid);
        break;
        
      case 'slack':
        result = await testSlack(testConfig || notificationConfig.slack);
        break;
        
      case 'discord':
        result = await testDiscord(testConfig || notificationConfig.discord);
        break;
        
      case 'telegram':
        result = await testTelegram(testConfig || notificationConfig.telegram);
        break;
        
      default:
        return res.status(400).json({ success: false, error: 'Invalid provider' });
    }
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('[Notifications] Test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// DELETE /api/notifications/configure/:provider - Remove a provider config
// =============================================================================
router.delete('/configure/:provider', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { provider } = req.params as { provider: NotificationProvider };
    
    if (notificationConfig[provider]) {
      delete notificationConfig[provider];
    }
    
    res.json({
      success: true,
      message: `${provider} configuration removed`
    });
  } catch (error: any) {
    console.error('[Notifications] Error removing config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// POST /api/notifications/send - Send a notification (internal use)
// =============================================================================
router.post('/send', authenticate, async (req: Request, res: Response) => {
  try {
    const { level, title, message, service, timestamp } = req.body;
    
    // Only send for HIGH (ERROR) or FATAL level alerts
    if (!['ERROR', 'FATAL', 'HIGH', 'CRITICAL'].includes(level?.toUpperCase())) {
      return res.json({ success: true, message: 'Notification skipped - not a critical alert' });
    }
    
    const results: Record<string, any> = {};
    
    // Send to all enabled providers
    if (notificationConfig.twilio?.enabled) {
      results.twilio = await sendTwilioAlert({ level, title, message, service, timestamp });
    }
    if (notificationConfig.sendgrid?.enabled) {
      results.sendgrid = await sendSendGridAlert({ level, title, message, service, timestamp });
    }
    if (notificationConfig.slack?.enabled) {
      results.slack = await sendSlackAlert({ level, title, message, service, timestamp });
    }
    if (notificationConfig.discord?.enabled) {
      results.discord = await sendDiscordAlert({ level, title, message, service, timestamp });
    }
    if (notificationConfig.telegram?.enabled) {
      results.telegram = await sendTelegramAlert({ level, title, message, service, timestamp });
    }
    
    res.json({ success: true, results });
  } catch (error: any) {
    console.error('[Notifications] Send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// Test Functions
// =============================================================================

async function testTwilio(config: any): Promise<{ success: boolean; message: string; error?: string }> {
  if (!config?.accountSid || !config?.authToken || !config?.fromNumber) {
    return { success: false, message: 'Missing required Twilio configuration', error: 'Missing accountSid, authToken, or fromNumber' };
  }
  
  try {
    const authToken = config.authToken.includes(':') ? decrypt(config.authToken) : config.authToken;
    const auth = Buffer.from(`${config.accountSid}:${authToken}`).toString('base64');
    
    // Verify account by fetching account info
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return { 
        success: true, 
        message: `Twilio connected! Account: ${data.friendly_name}, Status: ${data.status}` 
      };
    } else {
      const error = await response.text();
      return { success: false, message: 'Twilio authentication failed', error };
    }
  } catch (error: any) {
    return { success: false, message: 'Failed to connect to Twilio', error: error.message };
  }
}

async function testSendGrid(config: any): Promise<{ success: boolean; message: string; error?: string }> {
  if (!config?.apiKey || !config?.fromEmail) {
    return { success: false, message: 'Missing required SendGrid configuration', error: 'Missing apiKey or fromEmail' };
  }
  
  try {
    const apiKey = config.apiKey.includes(':') ? decrypt(config.apiKey) : config.apiKey;
    
    // Verify API key by getting user info
    const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return { 
        success: true, 
        message: `SendGrid connected! Account: ${data.first_name} ${data.last_name}` 
      };
    } else {
      const error = await response.text();
      return { success: false, message: 'SendGrid authentication failed', error };
    }
  } catch (error: any) {
    return { success: false, message: 'Failed to connect to SendGrid', error: error.message };
  }
}

async function testSlack(config: any): Promise<{ success: boolean; message: string; error?: string }> {
  if (!config?.webhookUrl) {
    return { success: false, message: 'Missing Slack webhook URL', error: 'Missing webhookUrl' };
  }
  
  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '🔔 *LogChat Test Notification*\nSlack integration is working correctly!',
        username: 'LogChat Alerts',
        icon_emoji: ':bell:'
      })
    });
    
    if (response.ok) {
      return { success: true, message: 'Slack test message sent successfully!' };
    } else {
      const error = await response.text();
      return { success: false, message: 'Slack webhook failed', error };
    }
  } catch (error: any) {
    return { success: false, message: 'Failed to send Slack message', error: error.message };
  }
}

async function testDiscord(config: any): Promise<{ success: boolean; message: string; error?: string }> {
  if (!config?.webhookUrl) {
    return { success: false, message: 'Missing Discord webhook URL', error: 'Missing webhookUrl' };
  }
  
  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'LogChat Alerts',
        embeds: [{
          title: '🔔 LogChat Test Notification',
          description: 'Discord integration is working correctly!',
          color: 0x5865F2, // Discord blurple
          timestamp: new Date().toISOString()
        }]
      })
    });
    
    if (response.ok || response.status === 204) {
      return { success: true, message: 'Discord test message sent successfully!' };
    } else {
      const error = await response.text();
      return { success: false, message: 'Discord webhook failed', error };
    }
  } catch (error: any) {
    return { success: false, message: 'Failed to send Discord message', error: error.message };
  }
}

async function testTelegram(config: any): Promise<{ success: boolean; message: string; error?: string }> {
  if (!config?.botToken) {
    return { success: false, message: 'Missing Telegram bot token', error: 'Missing botToken' };
  }
  
  try {
    const botToken = config.botToken.includes(':') && config.botToken.split(':').length === 3 
      ? decrypt(config.botToken) 
      : config.botToken;
    
    // Get bot info to verify token
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      // If chat IDs provided, send test message to first one
      if (config.chatIds?.length > 0) {
        const msgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: config.chatIds[0],
            text: '🔔 *LogChat Test Notification*\nTelegram integration is working correctly!',
            parse_mode: 'Markdown'
          })
        });
        
        const msgData = await msgResponse.json();
        if (!msgData.ok) {
          return { success: false, message: 'Bot connected but failed to send message', error: msgData.description };
        }
      }
      
      return { 
        success: true, 
        message: `Telegram connected! Bot: @${data.result.username}` 
      };
    } else {
      return { success: false, message: 'Telegram authentication failed', error: data.description };
    }
  } catch (error: any) {
    return { success: false, message: 'Failed to connect to Telegram', error: error.message };
  }
}

// =============================================================================
// Send Alert Functions
// =============================================================================

interface AlertPayload {
  level: string;
  title: string;
  message: string;
  service?: string;
  timestamp?: string;
}

async function sendTwilioAlert(alert: AlertPayload): Promise<{ success: boolean; error?: string }> {
  const config = notificationConfig.twilio;
  if (!config) return { success: false, error: 'Twilio not configured' };
  
  try {
    const authToken = decrypt(config.authToken);
    const auth = Buffer.from(`${config.accountSid}:${authToken}`).toString('base64');
    
    const body = `🚨 ${alert.level} ALERT\n${alert.title}\n\n${alert.message}\nService: ${alert.service || 'Unknown'}\nTime: ${alert.timestamp || new Date().toISOString()}`;
    
    for (const toNumber of config.toNumbers) {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: toNumber,
          From: config.fromNumber,
          Body: body
        })
      });
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function sendSendGridAlert(alert: AlertPayload): Promise<{ success: boolean; error?: string }> {
  const config = notificationConfig.sendgrid;
  if (!config) return { success: false, error: 'SendGrid not configured' };
  
  try {
    const apiKey = decrypt(config.apiKey);
    
    const levelColor = alert.level === 'FATAL' ? '#dc2626' : '#f59e0b';
    
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: config.toEmails.map(email => ({ email })) }],
        from: { email: config.fromEmail, name: 'LogChat Alerts' },
        subject: `🚨 [${alert.level}] ${alert.title}`,
        content: [{
          type: 'text/html',
          value: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: ${levelColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">🚨 ${alert.level} Alert</h1>
              </div>
              <div style="background: #1e1e1e; color: #e5e5e5; padding: 20px; border-radius: 0 0 8px 8px;">
                <h2 style="color: white; margin-top: 0;">${alert.title}</h2>
                <p style="white-space: pre-wrap;">${alert.message}</p>
                <hr style="border-color: #333;">
                <p><strong>Service:</strong> ${alert.service || 'Unknown'}</p>
                <p><strong>Time:</strong> ${alert.timestamp || new Date().toISOString()}</p>
              </div>
            </div>
          `
        }]
      })
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function sendSlackAlert(alert: AlertPayload): Promise<{ success: boolean; error?: string }> {
  const config = notificationConfig.slack;
  if (!config) return { success: false, error: 'Slack not configured' };
  
  try {
    const color = alert.level === 'FATAL' ? '#dc2626' : '#f59e0b';
    
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'LogChat Alerts',
        icon_emoji: ':rotating_light:',
        attachments: [{
          color,
          title: `🚨 ${alert.level} Alert: ${alert.title}`,
          text: alert.message,
          fields: [
            { title: 'Service', value: alert.service || 'Unknown', short: true },
            { title: 'Time', value: alert.timestamp || new Date().toISOString(), short: true }
          ],
          footer: 'LogChat Alert System'
        }]
      })
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function sendDiscordAlert(alert: AlertPayload): Promise<{ success: boolean; error?: string }> {
  const config = notificationConfig.discord;
  if (!config) return { success: false, error: 'Discord not configured' };
  
  try {
    const color = alert.level === 'FATAL' ? 0xdc2626 : 0xf59e0b;
    
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'LogChat Alerts',
        embeds: [{
          title: `🚨 ${alert.level} Alert: ${alert.title}`,
          description: alert.message,
          color,
          fields: [
            { name: 'Service', value: alert.service || 'Unknown', inline: true },
            { name: 'Time', value: alert.timestamp || new Date().toISOString(), inline: true }
          ],
          footer: { text: 'LogChat Alert System' },
          timestamp: new Date().toISOString()
        }]
      })
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function sendTelegramAlert(alert: AlertPayload): Promise<{ success: boolean; error?: string }> {
  const config = notificationConfig.telegram;
  if (!config) return { success: false, error: 'Telegram not configured' };
  
  try {
    const botToken = decrypt(config.botToken);
    
    const text = `🚨 *${alert.level} ALERT*\n\n*${alert.title}*\n\n${alert.message}\n\n📦 Service: ${alert.service || 'Unknown'}\n🕐 Time: ${alert.timestamp || new Date().toISOString()}`;
    
    for (const chatId of config.chatIds) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        })
      });
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Export the send function for use in other parts of the app
export async function sendCriticalAlert(alert: AlertPayload): Promise<void> {
  if (!['ERROR', 'FATAL', 'HIGH', 'CRITICAL'].includes(alert.level?.toUpperCase())) {
    return;
  }
  
  const promises = [];
  
  if (notificationConfig.twilio?.enabled) {
    promises.push(sendTwilioAlert(alert));
  }
  if (notificationConfig.sendgrid?.enabled) {
    promises.push(sendSendGridAlert(alert));
  }
  if (notificationConfig.slack?.enabled) {
    promises.push(sendSlackAlert(alert));
  }
  if (notificationConfig.discord?.enabled) {
    promises.push(sendDiscordAlert(alert));
  }
  if (notificationConfig.telegram?.enabled) {
    promises.push(sendTelegramAlert(alert));
  }
  
  await Promise.allSettled(promises);
}

export default router;
