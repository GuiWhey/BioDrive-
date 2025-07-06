import passport from 'passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { storage } from './storage';

// WHOOP OAuth Configuration
const whoopOAuthConfig = {
  authorizationURL: 'https://api.prod.whoop.com/oauth/oauth2/auth',
  tokenURL: 'https://api.prod.whoop.com/oauth/oauth2/token',
  clientID: process.env.WHOOP_CLIENT_ID!,
  clientSecret: process.env.WHOOP_CLIENT_SECRET!,
  callbackURL: process.env.WHOOP_REDIRECT_URI!,
  state: true, // Let Passport handle state generation
  scope: [
    'offline',
    'read:profile',
    'read:recovery',
    'read:cycles',
    'read:sleep',
    'read:workout',
    'read:body_measurement'
  ]
};

// Function to handle successful authentication
const handleAuthentication = async (
  accessToken: string,
  refreshToken: string,
  results: any,
  profile: any,
  done: any
) => {
  try {
    console.log('=== WHOOP Authentication Handler ===');
    console.log('Access token received:', !!accessToken);
    console.log('Refresh token received:', !!refreshToken);
    console.log('Results:', results);
    console.log('Profile:', profile);
    
    const { user_id } = profile;
    const expiresAt = new Date(Date.now() + (results.expires_in * 1000));

    // Find user by WHOOP user ID or create new mapping
    // For now, we'll use user ID 1 (in production, you'd map this properly)
    const userId = 1;

    // Store or update the WHOOP token
    const existingToken = await storage.getWearableToken(userId, 'whoop');
    
    if (existingToken) {
      await storage.updateWearableToken(userId, 'whoop', {
        accessToken,
        refreshToken,
        expiresAt,
        externalUserId: user_id.toString()
      });
    } else {
      await storage.createWearableToken({
        userId,
        provider: 'whoop',
        accessToken,
        refreshToken,
        expiresAt,
        externalUserId: user_id.toString()
      });
    }

    // Return the user object
    done(null, { userId, whoopUserId: user_id, accessToken });
  } catch (error) {
    console.error('Error handling WHOOP authentication:', error);
    done(error, null);
  }
};

// Function to fetch user profile from WHOOP
const fetchProfile = async (accessToken: string, done: any) => {
  try {
    const profileResponse = await fetch(
      'https://api.prod.whoop.com/developer/v1/user/profile/basic',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!profileResponse.ok) {
      throw new Error(`WHOOP API error: ${profileResponse.status}`);
    }

    const profile = await profileResponse.json();
    done(null, profile);
  } catch (error) {
    console.error('Error fetching WHOOP profile:', error);
    done(error, null);
  }
};

// Create and configure the WHOOP strategy
const whoopStrategy = new OAuth2Strategy(whoopOAuthConfig, handleAuthentication);
whoopStrategy.userProfile = fetchProfile;

// Configure Passport
passport.use('whoop', whoopStrategy);

// Serialize user for session storage
passport.serializeUser((user: any, done) => {
  done(null, user.userId);
});

// Deserialize user from session
passport.deserializeUser(async (userId: number, done) => {
  try {
    const user = await storage.getUser(userId);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export { passport };