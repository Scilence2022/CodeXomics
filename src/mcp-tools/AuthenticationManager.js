/**
 * Authentication Manager for MCP Server
 * Handles API key validation, client authentication, and security
 */

const crypto = require('crypto');

class AuthenticationManager {
  constructor(config = {}) {
    // API keys storage (in production, use database or secure key management)
    this.apiKeys = new Map();

    // Active sessions
    this.sessions = new Map();

    // Configuration
    this.config = {
      requireAuth: config.requireAuth !== false, // Default: true
      sessionTimeout: config.sessionTimeout || 3600000, // 1 hour
      maxSessionsPerKey: config.maxSessionsPerKey || 10,
      enableLocalBypass: config.enableLocalBypass === true, // Local bypass is explicit and development-only
      ...config,
    };

    // Initialize with master key if provided
    if (config.masterKey) {
      this.addApiKey('master', config.masterKey, {
        name: 'Master Key',
        permissions: ['*'],
        isAdmin: true,
      });
    }

    const configuredKeys = Array.isArray(config.apiKeys)
      ? config.apiKeys
      : Object.entries(config.apiKeys || {}).map(([keyId, value]) => ({ keyId, ...(value || {}) }));
    for (const entry of configuredKeys) {
      const keyId = String(entry.keyId || entry.id || '').trim();
      const apiKey = entry.apiKey || entry.key || entry.token;
      if (!keyId || !apiKey) continue;
      this.addApiKey(keyId, apiKey, {
        name: entry.name || keyId,
        permissions: Array.isArray(entry.permissions) ? entry.permissions : [],
        isAdmin: entry.isAdmin === true,
      });
    }

    // Generate default development key if in dev mode
    if (config.developmentMode) {
      const devKey = this.generateApiKey();
      this.addApiKey('development', devKey, {
        name: 'Development Key',
        permissions: ['*'],
        isDevelopment: true,
      });
      console.log('🔑 Development API Key:', devKey);
    }

    // Cleanup expired sessions periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Every minute
  }

  /**
   * Generate a secure API key
   */
  generateApiKey(length = 32) {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Add an API key to the system
   */
  addApiKey(keyId, apiKey, metadata = {}) {
    const keyHash = this.hashApiKey(apiKey);
    if (this.apiKeys.has(keyHash)) {
      throw new Error(`Duplicate API key secret configured for ${keyId}`);
    }

    this.apiKeys.set(keyHash, {
      keyId,
      metadata: {
        name: metadata.name || keyId,
        permissions: metadata.permissions || [],
        isAdmin: metadata.isAdmin || false,
        isDevelopment: metadata.isDevelopment || false,
        createdAt: Date.now(),
        ...metadata,
      },
      sessions: new Set(),
    });

    console.log(`✅ API key added: ${keyId}`);
    return keyHash;
  }

  /**
   * Remove an API key
   */
  removeApiKey(apiKey) {
    const keyHash = this.hashApiKey(apiKey);
    const keyData = this.apiKeys.get(keyHash);

    if (keyData) {
      // Invalidate all sessions for this key
      keyData.sessions.forEach(sessionId => {
        this.sessions.delete(sessionId);
      });

      this.apiKeys.delete(keyHash);
      console.log(`🗑️  API key removed: ${keyData.metadata.name}`);
      return true;
    }

    return false;
  }

  /**
   * Hash API key for secure storage
   */
  hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Validate API key and create session
   */
  validateApiKey(apiKey, clientInfo = {}, options = {}) {
    if (!this.config.requireAuth) {
      return this.createBypassSession(clientInfo);
    }

    const keyHash = this.hashApiKey(apiKey);
    const keyData = this.apiKeys.get(keyHash);

    if (!keyData) {
      return {
        valid: false,
        error: 'Invalid API key',
      };
    }

    if (options.reuseSession) {
      for (const existingSessionId of Array.from(keyData.sessions)) {
        const validation = this.validateSession(existingSessionId);
        if (validation.valid) {
          return {
            valid: true,
            sessionId: existingSessionId,
            keyId: keyData.keyId,
            principal: keyData.keyId,
            permissions: keyData.metadata.permissions,
            isAdmin: keyData.metadata.isAdmin,
            expiresAt: validation.session.expiresAt,
          };
        }
        keyData.sessions.delete(existingSessionId);
      }
    }

    // Check session limit
    if (keyData.sessions.size >= this.config.maxSessionsPerKey) {
      return {
        valid: false,
        error: 'Maximum sessions reached for this API key',
      };
    }

    // Create session
    const session = this.createSession(keyData, clientInfo);

    return {
      valid: true,
      sessionId: session.sessionId,
      keyId: keyData.keyId,
      principal: keyData.keyId,
      permissions: keyData.metadata.permissions,
      isAdmin: keyData.metadata.isAdmin,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Create authenticated session
   */
  createSession(keyData, clientInfo) {
    const sessionId = this.generateSessionId();
    const expiresAt = Date.now() + this.config.sessionTimeout;

    const session = {
      sessionId,
      keyId: keyData.keyId,
      permissions: keyData.metadata.permissions,
      isAdmin: keyData.metadata.isAdmin,
      clientInfo,
      createdAt: Date.now(),
      expiresAt,
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, session);
    keyData.sessions.add(sessionId);

    return session;
  }

  /**
   * Create bypass session for local connections
   */
  createBypassSession(clientInfo) {
    for (const [existingSessionId, existingSession] of this.sessions) {
      if (existingSession.keyId !== 'local-bypass') continue;
      const validation = this.validateSession(existingSessionId);
      if (validation.valid) {
        return {
          valid: true,
          sessionId: existingSessionId,
          keyId: existingSession.keyId,
          principal: existingSession.keyId,
          permissions: existingSession.permissions,
          isAdmin: existingSession.isAdmin,
          expiresAt: existingSession.expiresAt,
        };
      }
    }
    const sessionId = this.generateSessionId();

    const session = {
      sessionId,
      keyId: 'local-bypass',
      permissions: ['*'],
      isAdmin: true,
      isBypass: true,
      clientInfo,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.sessionTimeout,
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, session);

    return {
      valid: true,
      sessionId: session.sessionId,
      keyId: session.keyId,
      principal: session.keyId,
      permissions: session.permissions,
      isAdmin: session.isAdmin,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Validate session
   */
  validateSession(sessionId) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        valid: false,
        error: 'Session not found',
      };
    }

    // Check expiration
    if (Date.now() > session.expiresAt) {
      this.invalidateSession(sessionId);
      return {
        valid: false,
        error: 'Session expired',
      };
    }

    // Update last activity
    session.lastActivity = Date.now();

    return {
      valid: true,
      session,
    };
  }

  /**
   * Check if session has permission
   */
  hasPermission(sessionId, permission) {
    const validation = this.validateSession(sessionId);

    if (!validation.valid) {
      return false;
    }

    const { session } = validation;

    // Admin has all permissions
    if (session.isAdmin) {
      return true;
    }

    // Check wildcard permission
    if (session.permissions.includes('*')) {
      return true;
    }

    // Check specific permission
    return session.permissions.includes(permission);
  }

  /**
   * Invalidate session
   */
  invalidateSession(sessionId) {
    const session = this.sessions.get(sessionId);

    if (session) {
      // Remove from key's session set
      const keyHash = Array.from(this.apiKeys.values()).find(k => k.keyId === session.keyId);

      if (keyHash) {
        keyHash.sessions.delete(sessionId);
      }

      this.sessions.delete(sessionId);
      return true;
    }

    return false;
  }

  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.invalidateSession(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired sessions`);
    }
  }

  /**
   * Check if request is from localhost
   */
  isLocalhost(req) {
    if (!req) return false;

    const ip = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '';

    return ip === '127.0.0.1' || ip === 'localhost' || ip === '::1' || ip === '::ffff:127.0.0.1';
  }

  /**
   * Authenticate HTTP request
   */
  authenticateRequest(req) {
    // Check if local bypass is enabled
    if (this.config.enableLocalBypass && this.isLocalhost(req)) {
      return this.createBypassSession({
        type: 'http',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }

    if (!this.config.requireAuth) {
      return this.createBypassSession({
        type: 'http',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }

    // Check Authorization header
    const authHeader = req.get('Authorization');

    if (!authHeader) {
      return {
        valid: false,
        error: 'No authorization header',
      };
    }

    // Support Bearer token format
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const apiKey = match ? match[1] : authHeader;

    return this.validateApiKey(
      apiKey,
      {
        type: 'http',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      { reuseSession: true }
    );
  }

  /**
   * Get session statistics
   */
  getStatistics() {
    const now = Date.now();

    return {
      totalApiKeys: this.apiKeys.size,
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => s.expiresAt > now).length,
      expiredSessions: Array.from(this.sessions.values()).filter(s => s.expiresAt <= now).length,
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.sessions.clear();
    this.apiKeys.clear();
  }
}

module.exports = AuthenticationManager;
