import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateMealPlan, generateRecoveryProtocol, calculatePerformanceScore, generatePersonalizedCoaching } from "./services/openai";
import { simulateWearableDataUpdate, getDeviceConnectionStatus } from "./services/wearableData";
import { WHOOPIntegration, AppleHealthIntegration, WearableDataTransformer } from "./services/wearableIntegration";
import { insertMealPlanSchema, insertRecoveryProtocolSchema, insertPerformanceScoreSchema, insertUserPreferencesSchema } from "@shared/schema";
import { passport } from "./whoopStrategy";

// Extend Express session to include userId
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get user dashboard data
  app.get("/api/dashboard/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prioritize WHOOP data over other devices
      const allWearableData = await storage.getWearableDataByUserId(userId, 10);
      const whoopData = allWearableData.find(data => data.deviceType === 'whoop');
      const latestWearableData = whoopData || allWearableData[0] || null;
      
      const mealPlans = await storage.getMealPlansByUserId(userId);
      const recoveryProtocols = await storage.getRecoveryProtocolsByUserId(userId);
      const performanceScores = await storage.getPerformanceScoresByUserId(userId, 7);

      res.json({
        user,
        wearableData: latestWearableData,
        mealPlans: mealPlans.slice(0, 3), // Latest 3 meals
        recoveryProtocols: recoveryProtocols.slice(0, 3), // Latest 3 protocols
        performanceScores,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Generate new wearable data simulation
  app.post("/api/wearable-data/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const wearableData = simulateWearableDataUpdate(userId);
      
      const created = await storage.createWearableData(wearableData);
      res.json(created);
    } catch (error) {
      console.error("Error creating wearable data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get wearable device connection status
  app.get("/api/devices/:userId", async (req, res) => {
    try {
      const whoopStatus = getDeviceConnectionStatus('whoop');
      const appleWatchStatus = getDeviceConnectionStatus('apple_watch');
      
      res.json({
        whoop: whoopStatus,
        apple_watch: appleWatchStatus,
      });
    } catch (error) {
      console.error("Error fetching device status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Generate AI meal plan
  app.post("/api/meal-plan/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { mealType } = req.body;
      
      const user = await storage.getUser(userId);
      const latestWearableData = await storage.getLatestWearableData(userId);
      
      if (!user || !latestWearableData) {
        return res.status(404).json({ message: "User or wearable data not found" });
      }

      const mealPlan = await generateMealPlan({
        sleepScore: latestWearableData.sleepScore || 70,
        strainLevel: parseFloat(latestWearableData.strainLevel || "10"),
        hrv: latestWearableData.hrv || 40,
        subscriptionTier: user.subscriptionTier,
        mealType: mealType || 'breakfast',
      });

      const insertData = insertMealPlanSchema.parse({
        userId,
        mealType: mealType || 'breakfast',
        name: mealPlan.name,
        description: mealPlan.description,
        calories: mealPlan.calories,
        protein: mealPlan.protein,
        carbs: mealPlan.carbs,
        fat: mealPlan.fat,
        imageUrl: mealPlan.imageUrl,
      });

      const created = await storage.createMealPlan(insertData);
      res.json(created);
    } catch (error) {
      console.error("Error generating meal plan:", error);
      res.status(500).json({ message: "Failed to generate meal plan" });
    }
  });

  // Generate recovery protocol
  app.post("/api/recovery-protocol/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      const user = await storage.getUser(userId);
      const latestWearableData = await storage.getLatestWearableData(userId);
      
      if (!user || !latestWearableData) {
        return res.status(404).json({ message: "User or wearable data not found" });
      }

      const protocol = await generateRecoveryProtocol({
        sleepScore: latestWearableData.sleepScore || 70,
        strainLevel: parseFloat(latestWearableData.strainLevel || "10"),
        hrv: latestWearableData.hrv || 40,
        subscriptionTier: user.subscriptionTier,
      });

      // Create individual protocol entries
      const protocols = [
        {
          userId,
          type: 'cold_therapy',
          name: 'Cold Therapy',
          description: protocol.coldTherapy,
          duration: '2-3 min',
        },
        {
          userId,
          type: 'breathwork',
          name: 'Breathwork',
          description: protocol.breathwork,
          duration: '10 min',
        },
        {
          userId,
          type: 'supplements',
          name: 'Supplements',
          description: protocol.supplements,
          duration: 'As needed',
        },
      ];

      const created = await Promise.all(
        protocols.map(p => storage.createRecoveryProtocol(insertRecoveryProtocolSchema.parse(p)))
      );

      res.json(created);
    } catch (error) {
      console.error("Error generating recovery protocol:", error);
      res.status(500).json({ message: "Failed to generate recovery protocol" });
    }
  });

  // Calculate and store performance score
  app.post("/api/performance-score/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      const latestWearableData = await storage.getLatestWearableData(userId);
      
      if (!latestWearableData) {
        return res.status(404).json({ message: "Wearable data not found" });
      }

      const sleepScore = latestWearableData.sleepScore || 70;
      const recoveryScore = 90; // Mock recovery score based on protocols
      const strainLevel = parseFloat(latestWearableData.strainLevel || "10");

      const overallScore = await calculatePerformanceScore(sleepScore, recoveryScore, strainLevel);

      const performanceData = insertPerformanceScoreSchema.parse({
        userId,
        sleepScore,
        recoveryScore,
        strainLevel: strainLevel.toString(),
        overallScore,
      });

      const created = await storage.createPerformanceScore(performanceData);
      res.json(created);
    } catch (error) {
      console.error("Error calculating performance score:", error);
      res.status(500).json({ message: "Failed to calculate performance score" });
    }
  });

  // WHOOP OAuth Routes using Passport.js
  app.get("/api/auth/whoop/:userId", (req, res, next) => {
    // Store user ID in session for later use
    if (req.session) {
      req.session.userId = parseInt(req.params.userId);
    }
    
    // Debug logging for OAuth troubleshooting
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const currentDomain = `${protocol}://${host}`;
    
    console.log('=== WHOOP OAuth Debug ===');
    console.log(`Current domain: ${currentDomain}`);
    console.log(`Expected redirect URI: ${process.env.WHOOP_REDIRECT_URI}`);
    console.log(`User ID: ${req.params.userId}`);
    console.log('========================');
    
    // Redirect to Passport WHOOP authentication
    passport.authenticate('whoop')(req, res, next);
  });

  // Demo WHOOP authentication for development
  app.get("/api/auth/whoop/demo", async (req, res) => {
    try {
      const userIdStr = req.query.userId as string;
      const userId = parseInt(userIdStr);
      if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({ error: `Invalid user ID: ${userIdStr}` });
      }

      // Simulate successful WHOOP connection
      const existingToken = await storage.getWearableToken(userId, 'whoop');
      
      if (existingToken) {
        await storage.updateWearableToken(userId, 'whoop', {
          accessToken: 'demo_whoop_token',
          refreshToken: 'demo_refresh_token',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        });
      } else {
        await storage.createWearableToken({
          userId,
          provider: 'whoop',
          accessToken: 'demo_whoop_token',
          refreshToken: 'demo_refresh_token',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          externalUserId: `demo_whoop_${userId}`
        });
      }

      // Create initial demo WHOOP data
      await storage.createWearableData({
        userId,
        deviceType: 'whoop',
        sleepScore: Math.floor(Math.random() * 40) + 60,
        sleepDuration: `${Math.floor(Math.random() * 2) + 7}h ${Math.floor(Math.random() * 60)}m`,
        strainLevel: (Math.random() * 15 + 5).toFixed(1),
        hrv: Math.floor(Math.random() * 50) + 25,
        heartRate: Math.floor(Math.random() * 40) + 60
      });

      res.send(`
        <html>
          <head><title>WHOOP Connected</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px; background: #0a0a0a; color: white;">
            <h2>✅ WHOOP Connected Successfully!</h2>
            <p>Your WHOOP data is now syncing with BioDrive+</p>
            <p><em>Note: This is a demo connection with simulated data. To use real WHOOP data, configure USE_REAL_WHOOP=true.</em></p>
            <p>Redirecting back to your dashboard...</p>
            <script>
              setTimeout(() => {
                const returnUrl = localStorage.getItem('biodrive_return_url') || 'http://localhost:5173/dashboard';
                localStorage.removeItem('biodrive_return_url');
                window.location.href = returnUrl;
              }, 3000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Demo WHOOP auth error:', error);
      res.status(500).json({ error: 'Failed to connect WHOOP demo' });
    }
  });

  // Test route to verify routing works
  app.get("/api/test", (req, res) => {
    res.json({ message: "API routing works!", timestamp: new Date().toISOString() });
  });

  // WHOOP webhook endpoint
  app.post("/api/webhook", (req, res) => {
    console.log('WHOOP webhook received:', req.body);
    // Acknowledge receipt of webhook
    res.status(200).json({ received: true });
  });

  app.get("/api/auth/whoop/callback", (req, res, next) => {
    console.log('=== WHOOP OAuth Callback ===');
    console.log('Query params:', req.query);
    console.log('Session:', req.session);
    console.log('Headers:', req.headers);
    
    passport.authenticate('whoop', (err, user, info) => {
      console.log('Passport authenticate result:');
      console.log('Error:', err);
      console.log('User:', user);
      console.log('Info:', info);
      
      if (err) {
        console.error('WHOOP OAuth error:', err);
        const baseUrl = process.env.CLIENT_URL || 'https://biodrive.app';
        return res.redirect(`${baseUrl}/dashboard?whoop=error&reason=server_error`);
      }
      
      if (!user) {
        console.log('WHOOP OAuth failed - no user returned');
        const baseUrl = process.env.CLIENT_URL || 'https://biodrive.app';
        return res.redirect(`${baseUrl}/dashboard?whoop=error&reason=auth_failed`);
      }
      
      // Success!
      console.log('WHOOP OAuth successful for user:', user);
      const baseUrl = process.env.CLIENT_URL || 'https://biodrive.app';
      res.redirect(`${baseUrl}/dashboard?whoop=success`);
    })(req, res, next);
  });

  // Apple Health OAuth Routes (Cost-effective mock for demo)
  app.get("/api/auth/apple/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Generate mock auth URL for cost-effective demo
      const authURL = `http://localhost:5000/api/auth/apple/mock?userId=${userId}`;
      res.json({ authUrl: authURL });
    } catch (error) {
      console.error('Apple Health auth URL generation error:', error);
      res.status(500).json({ error: 'Failed to generate Apple Health auth URL.' });
    }
  });

  // Mock Apple Health authentication (instead of expensive Terra)
  app.get("/api/auth/apple/mock", async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Simulate successful Apple Health connection
      const mockTerraUserId = `mock_apple_${userId}_${Date.now()}`;
      
      const existingToken = await storage.getWearableToken(userId, 'apple_health');
      
      if (existingToken) {
        await storage.updateWearableToken(userId, 'apple_health', {
          externalUserId: mockTerraUserId,
          accessToken: 'mock_apple_authenticated'
        });
      } else {
        await storage.createWearableToken({
          userId,
          provider: 'apple_health',
          accessToken: 'mock_apple_authenticated',
          refreshToken: null,
          externalUserId: mockTerraUserId,
          expiresAt: null
        });
      }

      // Create initial mock Apple Health data
      await storage.createWearableData({
        userId,
        deviceType: 'apple_watch',
        sleepScore: Math.floor(Math.random() * 40) + 60, // 60-100
        sleepDuration: `${Math.floor(Math.random() * 2) + 7}h ${Math.floor(Math.random() * 60)}m`,
        strainLevel: (Math.random() * 15 + 5).toFixed(1), // 5-20
        hrv: Math.floor(Math.random() * 50) + 25, // 25-75
        heartRate: Math.floor(Math.random() * 40) + 60 // 60-100
      });

      res.send(`
        <html>
          <head><title>Apple Health Connected</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>✅ Apple Health Connected Successfully!</h2>
            <p>Your Apple Health data is now syncing with BioDrive+</p>
            <p><em>Note: This is a demo connection. In production, this would connect to real Apple Health data.</em></p>
            <script>
              setTimeout(() => {
                window.close();
                if (window.opener) {
                  window.opener.location.reload();
                }
              }, 2000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Mock Apple Health auth error:', error);
      res.status(500).json({ error: 'Failed to connect Apple Health' });
    }
  });

  app.post("/api/auth/apple/callback", async (req, res) => {
    try {
      const { user_id, provider, status, state } = req.body;

      if (status !== 'success') {
        return res.status(400).json({ error: 'Apple Health authentication failed' });
      }

      const userId = parseInt((state as string).replace('apple_', ''));
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid state parameter' });
      }

      const existingToken = await storage.getWearableToken(userId, 'apple_health');
      
      if (existingToken) {
        await storage.updateWearableToken(userId, 'apple_health', {
          externalUserId: user_id,
          accessToken: 'terra_authenticated'
        });
      } else {
        await storage.createWearableToken({
          userId,
          provider: 'apple_health',
          accessToken: 'terra_authenticated',
          refreshToken: null,
          externalUserId: user_id,
          expiresAt: null
        });
      }

      res.json({ success: true, message: 'Apple Health connected successfully' });
    } catch (error) {
      console.error('Apple Health callback error:', error);
      res.status(500).json({ error: 'Failed to process Apple Health authentication' });
    }
  });

  // Terra webhook endpoint for receiving data
  app.post("/api/terra/webhook", async (req, res) => {
    try {
      const { type, user, data } = req.body;
      
      // Verify webhook signature if needed
      // const signature = req.headers['terra-signature'];
      
      console.log('Terra webhook received:', { type, user: user?.user_id });

      if (type === 'body' || type === 'daily' || type === 'sleep') {
        // Find the user by Terra user ID
        const userToken = await storage.getWearableToken(user.user_id, 'apple_health');
        if (!userToken) {
          console.log('No user found for Terra user ID:', user.user_id);
          return res.status(200).json({ message: 'User not found, ignoring webhook' });
        }

        // Transform and store the data
        const transformedData = WearableDataTransformer.transformAppleHealthData(
          type === 'sleep' ? data : null,
          type === 'daily' ? data : null,
          type === 'body' ? data : null
        );

        await storage.createWearableData({
          userId: userToken.userId,
          deviceType: transformedData.deviceType,
          sleepScore: transformedData.sleepScore || null,
          sleepDuration: transformedData.sleepDuration || null,
          strainLevel: transformedData.strainLevel?.toString() || null,
          hrv: transformedData.hrv || null,
          heartRate: transformedData.heartRate || null
        });

        console.log('Successfully processed Terra webhook data for user:', userToken.userId);
      }

      res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('Terra webhook processing error:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  // Disconnect wearable device
  app.delete("/api/auth/:provider/:userId", async (req, res) => {
    try {
      const { provider, userId } = req.params;
      const userIdNum = parseInt(userId);

      if (!userIdNum || isNaN(userIdNum)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      if (!['whoop', 'apple_health'].includes(provider)) {
        return res.status(400).json({ error: 'Invalid provider' });
      }

      await storage.deleteWearableToken(userIdNum, provider);
      res.json({ success: true, message: `${provider} disconnected successfully` });
    } catch (error) {
      console.error('Disconnect error:', error);
      res.status(500).json({ error: 'Failed to disconnect device' });
    }
  });

  // Sync data from connected devices
  app.post("/api/sync/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      console.log(`=== Sync request for user ${userId} ===`);
      const results = [];

      // Sync WHOOP data
      const whoopToken = await storage.getWearableToken(userId, 'whoop');
      console.log('WHOOP token found:', !!whoopToken);
      
      if (whoopToken) {
        try {
          console.log('Starting WHOOP data sync...');
          // Check if token needs refresh
          if (whoopToken.expiresAt && new Date() > whoopToken.expiresAt) {
            const refreshedTokens = await WHOOPIntegration.refreshAccessToken(whoopToken.refreshToken!);
            const newExpiresAt = new Date(Date.now() + (refreshedTokens.expires_in * 1000));
            
            await storage.updateWearableToken(userId, 'whoop', {
              accessToken: refreshedTokens.access_token,
              refreshToken: refreshedTokens.refresh_token,
              expiresAt: newExpiresAt
            });
            
            whoopToken.accessToken = refreshedTokens.access_token;
          }

          // Check if using real WHOOP API or demo mode
          // Enable real WHOOP data when user has valid tokens
          const useRealWhoop = true; // Always try real API first when token exists
          
          if (useRealWhoop) {
            try {
              console.log('Using real WHOOP API...');
              console.log('Access token length:', whoopToken.accessToken?.length || 0);
              const [recoveryData, sleepData, cycleData] = await Promise.all([
                WHOOPIntegration.getRecoveryData(whoopToken.accessToken, 1),
                WHOOPIntegration.getSleepData(whoopToken.accessToken, 1),
                WHOOPIntegration.getCycleData(whoopToken.accessToken, 1)
              ]);

              console.log('WHOOP Recovery Data:', JSON.stringify(recoveryData, null, 2));
              console.log('WHOOP Sleep Data:', JSON.stringify(sleepData, null, 2));
              console.log('WHOOP Cycle Data:', JSON.stringify(cycleData, null, 2));

              const transformedData = WearableDataTransformer.transformWHOOPData(recoveryData, sleepData, cycleData);
              console.log('Transformed WHOOP Data:', JSON.stringify(transformedData, null, 2));
              await storage.createWearableData({
                userId,
                deviceType: transformedData.deviceType,
                sleepScore: transformedData.sleepScore || null,
                sleepDuration: transformedData.sleepDuration || null,
                strainLevel: transformedData.strainLevel?.toString() || null,
                hrv: transformedData.hrv || null,
                heartRate: transformedData.heartRate || null
              });

              results.push({ provider: 'whoop', status: 'success', data: transformedData });
            } catch (error) {
              console.log('Real WHOOP API failed, falling back to demo:', error.message);
              // Fall through to demo mode
            }
          }
          
          if (!useRealWhoop || results.find(r => r.provider === 'whoop')?.status !== 'success') {
            console.log('Using demo WHOOP data for sync...');
            // Generate fresh demo data for sync
            const demoData = {
              deviceType: 'whoop' as const,
              sleepScore: Math.floor(Math.random() * 40) + 60,
              sleepDuration: `${Math.floor(Math.random() * 2) + 7}h ${Math.floor(Math.random() * 60)}m`,
              strainLevel: (Math.random() * 15 + 5).toFixed(1),
              hrv: Math.floor(Math.random() * 50) + 25, // Ensure integer
              heartRate: Math.floor(Math.random() * 40) + 60, // Ensure integer
              recordedAt: new Date()
            };

            await storage.createWearableData({
              userId,
              deviceType: demoData.deviceType,
              sleepScore: demoData.sleepScore,
              sleepDuration: demoData.sleepDuration,
              strainLevel: demoData.strainLevel,
              hrv: demoData.hrv,
              heartRate: demoData.heartRate
            });

            // Update token timestamp to show recent sync
            await storage.updateWearableToken(userId, 'whoop', {
              updatedAt: new Date()
            });

            results.push({ provider: 'whoop', status: 'success', data: demoData });
          }
        } catch (error) {
          console.error('WHOOP sync error:', error);
          results.push({ provider: 'whoop', status: 'error', error: (error as Error).message });
        }
      }

      // Sync Apple Health data (mock for cost-effective demo)
      const appleToken = await storage.getWearableToken(userId, 'apple_health');
      if (appleToken?.externalUserId) {
        try {
          // Generate fresh mock Apple Health data
          const mockData = {
            deviceType: 'apple_watch' as const,
            sleepScore: Math.floor(Math.random() * 40) + 60,
            sleepDuration: `${Math.floor(Math.random() * 2) + 7}h ${Math.floor(Math.random() * 60)}m`,
            strainLevel: Math.floor(Math.random() * 15) + 5,
            hrv: Math.floor(Math.random() * 50) + 25,
            heartRate: Math.floor(Math.random() * 40) + 60,
            recordedAt: new Date()
          };

          await storage.createWearableData({
            userId,
            deviceType: mockData.deviceType,
            sleepScore: mockData.sleepScore,
            sleepDuration: mockData.sleepDuration,
            strainLevel: mockData.strainLevel.toString(),
            hrv: mockData.hrv,
            heartRate: mockData.heartRate
          });

          results.push({ provider: 'apple_health', status: 'success', data: mockData });
        } catch (error) {
          console.error('Apple Health sync error:', error);
          results.push({ provider: 'apple_health', status: 'error', error: (error as Error).message });
        }
      }

      res.json({ success: true, results });
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({ error: 'Failed to sync wearable data' });
    }
  });

  // Check wearable connection status
  app.get("/api/wearable-status/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const [whoopToken, appleToken] = await Promise.all([
        storage.getWearableToken(userId, 'whoop'),
        storage.getWearableToken(userId, 'apple_health')
      ]);

      const status = {
        whoop: {
          connected: !!whoopToken,
          lastSync: whoopToken?.updatedAt || null,
          needsReauth: whoopToken?.expiresAt ? new Date() > whoopToken.expiresAt : false
        },
        apple_health: {
          connected: !!appleToken,
          lastSync: appleToken?.updatedAt || null,
          needsReauth: false
        }
      };

      res.json(status);
    } catch (error) {
      console.error('Status check error:', error);
      res.status(500).json({ error: 'Failed to check connection status' });
    }
  });

  // AI Coaching routes
  app.post("/api/coaching/generate/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get latest wearable data
      const wearableData = await storage.getLatestWearableData(userId);
      if (!wearableData) {
        return res.status(400).json({ error: "No wearable data found for user" });
      }

      // Get recent performance scores for trend analysis
      const performanceScores = await storage.getPerformanceScoresByUserId(userId, 7);
      const recentScores = performanceScores.map(p => p.overallScore || 70);

      // Get user preferences if available
      let userPrefs = await storage.getUserPreferences(userId);
      if (!userPrefs) {
        // Create default preferences if none exist
        userPrefs = await storage.createUserPreferences({
          userId,
          goals: ["Improve sleep quality"],
          currentChallenges: [],
          workoutTypes: [],
          dietaryRestrictions: [],
          sleepSchedule: "Not specified"
        });
      }

      // Generate AI coaching response
      const coachingRequest = {
        userId,
        sleepScore: wearableData.sleepScore || 70,
        recoveryScore: 75, // Calculate based on multiple factors
        strainLevel: typeof wearableData.strainLevel === 'string' ? parseFloat(wearableData.strainLevel) : (wearableData.strainLevel || 10),
        hrv: wearableData.hrv || 30,
        heartRate: wearableData.heartRate || 70,
        subscriptionTier: user.subscriptionTier,
        recentPerformanceScores: recentScores,
        goals: userPrefs.goals || [],
        currentChallenges: userPrefs.currentChallenges || [],
        userPreferences: {
          workoutTypes: userPrefs.workoutTypes || [],
          dietaryRestrictions: userPrefs.dietaryRestrictions || [],
          sleepSchedule: userPrefs.sleepSchedule || undefined
        }
      };

      const coachingResponse = await generatePersonalizedCoaching(coachingRequest);

      // Save coaching session to database
      const session = await storage.createCoachingSession({
        userId,
        personalizedMessage: coachingResponse.personalizedMessage,
        keyInsights: coachingResponse.keyInsights,
        weeklyFocus: coachingResponse.weeklyFocus,
        motivationalNote: coachingResponse.motivationalNote,
        nextCheckIn: coachingResponse.nextCheckIn,
        performanceTrend: recentScores.length > 1 ? recentScores[recentScores.length - 1] - recentScores[0] : 0
      });

      // Save recommendations
      for (const rec of coachingResponse.actionableRecommendations) {
        await storage.createCoachingRecommendation({
          sessionId: session.id,
          priority: rec.priority,
          category: rec.category,
          title: rec.title,
          description: rec.description,
          timeframe: rec.timeframe
        });
      }

      // Get complete session with recommendations
      const recommendations = await storage.getCoachingRecommendationsBySessionId(session.id);

      res.json({
        session,
        recommendations,
        coachingResponse
      });
    } catch (error) {
      console.error("Error generating coaching:", error);
      res.status(500).json({ error: "Failed to generate personalized coaching" });
    }
  });

  app.get("/api/coaching/sessions/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 10;
      
      const sessions = await storage.getCoachingSessionsByUserId(userId, limit);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching coaching sessions:", error);
      res.status(500).json({ error: "Failed to fetch coaching sessions" });
    }
  });

  // Frontend-compatible endpoints (without user ID in path)
  app.get("/api/coaching/latest", async (req, res) => {
    try {
      const userId = 1; // Default user
      
      const session = await storage.getLatestCoachingSession(userId);
      if (!session) {
        return res.json({});
      }

      const recommendations = await storage.getCoachingRecommendationsBySessionId(session.id);
      
      res.json({
        session,
        recommendations
      });
    } catch (error) {
      console.error("Error fetching latest coaching session:", error);
      res.status(500).json({ error: "Failed to fetch latest coaching session" });
    }
  });

  app.get("/api/coaching/sessions", async (req, res) => {
    try {
      const userId = 1; // Default user
      const limit = parseInt(req.query.limit as string) || 10;
      
      const sessions = await storage.getCoachingSessionsByUserId(userId, limit);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching coaching sessions:", error);
      res.status(500).json({ error: "Failed to fetch coaching sessions" });
    }
  });

  app.get("/api/coaching/recommendations/all", async (req, res) => {
    try {
      const userId = 1; // Default user
      
      const sessions = await storage.getCoachingSessionsByUserId(userId, 50);
      const allRecommendations = [];
      for (const session of sessions) {
        const recommendations = await storage.getCoachingRecommendationsBySessionId(session.id);
        allRecommendations.push(...recommendations);
      }
      
      res.json(allRecommendations);
    } catch (error) {
      console.error("Error fetching all recommendations:", error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  });

  app.get("/api/preferences", async (req, res) => {
    try {
      const userId = 1; // Default user
      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences || {});
    } catch (error) {
      console.error("Error fetching user preferences:", error);
      res.status(500).json({ error: "Failed to fetch user preferences" });
    }
  });

  app.post("/api/preferences", async (req, res) => {
    try {
      const userId = 1; // Default user
      const existingPreferences = await storage.getUserPreferences(userId);
      
      if (existingPreferences) {
        const updated = await storage.updateUserPreferences(userId, req.body);
        res.json(updated);
      } else {
        const created = await storage.createUserPreferences({ userId, ...req.body });
        res.json(created);
      }
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  app.get("/api/coaching/latest/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      const session = await storage.getLatestCoachingSession(userId);
      if (!session) {
        return res.status(404).json({ error: "No coaching sessions found" });
      }

      const recommendations = await storage.getCoachingRecommendationsBySessionId(session.id);
      
      res.json({
        session,
        recommendations
      });
    } catch (error) {
      console.error("Error fetching latest coaching session:", error);
      res.status(500).json({ error: "Failed to fetch latest coaching session" });
    }
  });

  app.get("/api/coaching/recommendations/all/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Get all sessions for the user
      const sessions = await storage.getCoachingSessionsByUserId(userId, 50);
      
      // Get all recommendations for all sessions
      const allRecommendations = [];
      for (const session of sessions) {
        const recommendations = await storage.getCoachingRecommendationsBySessionId(session.id);
        allRecommendations.push(...recommendations);
      }
      
      res.json(allRecommendations);
    } catch (error) {
      console.error("Error fetching all recommendations:", error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  });

  app.patch("/api/coaching/recommendations/:id/complete", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { completed } = req.body;
      
      const recommendation = await storage.updateCoachingRecommendationCompletion(id, completed);
      res.json(recommendation);
    } catch (error) {
      console.error("Error updating recommendation:", error);
      res.status(500).json({ error: "Failed to update recommendation" });
    }
  });

  app.get("/api/preferences/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching user preferences:", error);
      res.status(500).json({ error: "Failed to fetch user preferences" });
    }
  });

  app.post("/api/preferences/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const validatedData = insertUserPreferencesSchema.parse({ userId, ...req.body });
      
      const existing = await storage.getUserPreferences(userId);
      let preferences;
      
      if (existing) {
        preferences = await storage.updateUserPreferences(userId, validatedData);
      } else {
        preferences = await storage.createUserPreferences(validatedData);
      }
      
      res.json(preferences);
    } catch (error) {
      console.error("Error saving user preferences:", error);
      res.status(500).json({ error: "Failed to save user preferences" });
    }
  });

  // Performance scores endpoint for analytics
  app.get("/api/performance-scores/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 30;
      
      const performanceScores = await storage.getPerformanceScoresByUserId(userId, limit);
      res.json(performanceScores);
    } catch (error) {
      console.error("Error fetching performance scores:", error);
      res.status(500).json({ error: "Failed to fetch performance scores" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
