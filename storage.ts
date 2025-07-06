import {
  users,
  wearableData,
  mealPlans,
  recoveryProtocols,
  performanceScores,
  wearableTokens,
  coachingSessions,
  coachingRecommendations,
  userPreferences,
  type User,
  type InsertUser,
  type WearableData,
  type InsertWearableData,
  type MealPlan,
  type InsertMealPlan,
  type RecoveryProtocol,
  type InsertRecoveryProtocol,
  type PerformanceScore,
  type InsertPerformanceScore,
  type WearableToken,
  type InsertWearableToken,
  type CoachingSession,
  type InsertCoachingSession,
  type CoachingRecommendation,
  type InsertCoachingRecommendation,
  type UserPreferences,
  type InsertUserPreferences,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Wearable data methods
  getLatestWearableData(userId: number): Promise<WearableData | undefined>;
  getWearableDataByUserId(userId: number, limit?: number): Promise<WearableData[]>;
  createWearableData(data: InsertWearableData): Promise<WearableData>;
  
  // Wearable token methods
  getWearableToken(userId: number, provider: string): Promise<WearableToken | undefined>;
  createWearableToken(token: InsertWearableToken): Promise<WearableToken>;
  updateWearableToken(userId: number, provider: string, updates: Partial<WearableToken>): Promise<WearableToken>;
  deleteWearableToken(userId: number, provider: string): Promise<void>;
  
  // Meal plan methods
  getMealPlansByUserId(userId: number): Promise<MealPlan[]>;
  createMealPlan(mealPlan: InsertMealPlan): Promise<MealPlan>;
  
  // Recovery protocol methods
  getRecoveryProtocolsByUserId(userId: number): Promise<RecoveryProtocol[]>;
  createRecoveryProtocol(protocol: InsertRecoveryProtocol): Promise<RecoveryProtocol>;
  
  // Performance score methods
  getPerformanceScoresByUserId(userId: number, limit?: number): Promise<PerformanceScore[]>;
  createPerformanceScore(score: InsertPerformanceScore): Promise<PerformanceScore>;
  
  // Coaching session methods
  getCoachingSessionsByUserId(userId: number, limit?: number): Promise<CoachingSession[]>;
  createCoachingSession(session: InsertCoachingSession): Promise<CoachingSession>;
  getLatestCoachingSession(userId: number): Promise<CoachingSession | undefined>;
  
  // Coaching recommendation methods
  getCoachingRecommendationsBySessionId(sessionId: number): Promise<CoachingRecommendation[]>;
  createCoachingRecommendation(recommendation: InsertCoachingRecommendation): Promise<CoachingRecommendation>;
  updateCoachingRecommendationCompletion(id: number, completed: boolean): Promise<CoachingRecommendation>;
  
  // User preferences methods
  getUserPreferences(userId: number): Promise<UserPreferences | undefined>;
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(userId: number, updates: Partial<UserPreferences>): Promise<UserPreferences>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private wearableData: Map<number, WearableData> = new Map();
  private mealPlans: Map<number, MealPlan> = new Map();
  private recoveryProtocols: Map<number, RecoveryProtocol> = new Map();
  private performanceScores: Map<number, PerformanceScore> = new Map();
  
  private currentUserId = 1;
  private currentWearableDataId = 1;
  private currentMealPlanId = 1;
  private currentRecoveryProtocolId = 1;
  private currentPerformanceScoreId = 1;

  constructor() {
    // Initialize with a demo user
    this.createUser({
      username: "john_doe",
      email: "john@example.com",
      subscriptionTier: "basic",
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      ...insertUser,
      id,
      subscriptionTier: insertUser.subscriptionTier || "basic",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getLatestWearableData(userId: number): Promise<WearableData | undefined> {
    const userWearableData = Array.from(this.wearableData.values())
      .filter(data => data.userId === userId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    
    return userWearableData[0];
  }

  async getWearableDataByUserId(userId: number, limit: number = 10): Promise<WearableData[]> {
    return Array.from(this.wearableData.values())
      .filter(data => data.userId === userId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
      .slice(0, limit);
  }

  async createWearableData(insertData: InsertWearableData): Promise<WearableData> {
    const id = this.currentWearableDataId++;
    const data: WearableData = {
      id,
      userId: insertData.userId,
      deviceType: insertData.deviceType,
      sleepScore: insertData.sleepScore || null,
      sleepDuration: insertData.sleepDuration || null,
      strainLevel: insertData.strainLevel || null,
      hrv: insertData.hrv || null,
      heartRate: insertData.heartRate || null,
      recordedAt: new Date(),
    };
    this.wearableData.set(id, data);
    return data;
  }

  async getMealPlansByUserId(userId: number): Promise<MealPlan[]> {
    return Array.from(this.mealPlans.values())
      .filter(plan => plan.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createMealPlan(insertMealPlan: InsertMealPlan): Promise<MealPlan> {
    const id = this.currentMealPlanId++;
    const mealPlan: MealPlan = {
      id,
      userId: insertMealPlan.userId,
      mealType: insertMealPlan.mealType,
      name: insertMealPlan.name,
      description: insertMealPlan.description || null,
      calories: insertMealPlan.calories || null,
      protein: insertMealPlan.protein || null,
      carbs: insertMealPlan.carbs || null,
      fat: insertMealPlan.fat || null,
      imageUrl: insertMealPlan.imageUrl || null,
      createdAt: new Date(),
    };
    this.mealPlans.set(id, mealPlan);
    return mealPlan;
  }

  async getRecoveryProtocolsByUserId(userId: number): Promise<RecoveryProtocol[]> {
    return Array.from(this.recoveryProtocols.values())
      .filter(protocol => protocol.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createRecoveryProtocol(insertProtocol: InsertRecoveryProtocol): Promise<RecoveryProtocol> {
    const id = this.currentRecoveryProtocolId++;
    const protocol: RecoveryProtocol = {
      id,
      userId: insertProtocol.userId,
      type: insertProtocol.type,
      name: insertProtocol.name,
      description: insertProtocol.description || null,
      duration: insertProtocol.duration || null,
      createdAt: new Date(),
    };
    this.recoveryProtocols.set(id, protocol);
    return protocol;
  }

  async getPerformanceScoresByUserId(userId: number, limit: number = 10): Promise<PerformanceScore[]> {
    return Array.from(this.performanceScores.values())
      .filter(score => score.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  async createPerformanceScore(insertScore: InsertPerformanceScore): Promise<PerformanceScore> {
    const id = this.currentPerformanceScoreId++;
    const score: PerformanceScore = {
      id,
      userId: insertScore.userId,
      sleepScore: insertScore.sleepScore || null,
      recoveryScore: insertScore.recoveryScore || null,
      strainLevel: insertScore.strainLevel || null,
      overallScore: insertScore.overallScore || null,
      date: new Date(),
    };
    this.performanceScores.set(id, score);
    return score;
  }

  async getWearableToken(userId: number, provider: string): Promise<WearableToken | undefined> {
    // Not implemented in MemStorage - always return undefined
    return undefined;
  }

  async createWearableToken(insertToken: InsertWearableToken): Promise<WearableToken> {
    // Not implemented in MemStorage - throw error
    throw new Error('Wearable token management requires database storage');
  }

  async updateWearableToken(userId: number, provider: string, updates: Partial<WearableToken>): Promise<WearableToken> {
    // Not implemented in MemStorage - throw error
    throw new Error('Wearable token management requires database storage');
  }

  async deleteWearableToken(userId: number, provider: string): Promise<void> {
    // Not implemented in MemStorage - do nothing
    return;
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        subscriptionTier: insertUser.subscriptionTier || "basic"
      })
      .returning();
    return user;
  }

  async getLatestWearableData(userId: number): Promise<WearableData | undefined> {
    const [data] = await db
      .select()
      .from(wearableData)
      .where(eq(wearableData.userId, userId))
      .orderBy(desc(wearableData.recordedAt))
      .limit(1);
    return data || undefined;
  }

  async getWearableDataByUserId(userId: number, limit: number = 10): Promise<WearableData[]> {
    return await db
      .select()
      .from(wearableData)
      .where(eq(wearableData.userId, userId))
      .orderBy(desc(wearableData.recordedAt))
      .limit(limit);
  }

  async createWearableData(insertData: InsertWearableData): Promise<WearableData> {
    const [data] = await db
      .insert(wearableData)
      .values(insertData)
      .returning();
    return data;
  }

  async getMealPlansByUserId(userId: number): Promise<MealPlan[]> {
    return await db
      .select()
      .from(mealPlans)
      .where(eq(mealPlans.userId, userId))
      .orderBy(desc(mealPlans.createdAt));
  }

  async createMealPlan(insertMealPlan: InsertMealPlan): Promise<MealPlan> {
    const [mealPlan] = await db
      .insert(mealPlans)
      .values(insertMealPlan)
      .returning();
    return mealPlan;
  }

  async getRecoveryProtocolsByUserId(userId: number): Promise<RecoveryProtocol[]> {
    return await db
      .select()
      .from(recoveryProtocols)
      .where(eq(recoveryProtocols.userId, userId))
      .orderBy(desc(recoveryProtocols.createdAt));
  }

  async createRecoveryProtocol(insertProtocol: InsertRecoveryProtocol): Promise<RecoveryProtocol> {
    const [protocol] = await db
      .insert(recoveryProtocols)
      .values(insertProtocol)
      .returning();
    return protocol;
  }

  async getPerformanceScoresByUserId(userId: number, limit: number = 10): Promise<PerformanceScore[]> {
    return await db
      .select()
      .from(performanceScores)
      .where(eq(performanceScores.userId, userId))
      .orderBy(desc(performanceScores.date))
      .limit(limit);
  }

  async createPerformanceScore(insertScore: InsertPerformanceScore): Promise<PerformanceScore> {
    const [score] = await db
      .insert(performanceScores)
      .values(insertScore)
      .returning();
    return score;
  }

  async getWearableToken(userId: number, provider: string): Promise<WearableToken | undefined> {
    const [token] = await db
      .select()
      .from(wearableTokens)
      .where(and(eq(wearableTokens.userId, userId), eq(wearableTokens.provider, provider)));
    return token || undefined;
  }

  async createWearableToken(insertToken: InsertWearableToken): Promise<WearableToken> {
    const [token] = await db
      .insert(wearableTokens)
      .values(insertToken)
      .returning();
    return token;
  }

  async updateWearableToken(userId: number, provider: string, updates: Partial<WearableToken>): Promise<WearableToken> {
    const [token] = await db
      .update(wearableTokens)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(wearableTokens.userId, userId), eq(wearableTokens.provider, provider)))
      .returning();
    return token;
  }

  async deleteWearableToken(userId: number, provider: string): Promise<void> {
    await db
      .delete(wearableTokens)
      .where(and(eq(wearableTokens.userId, userId), eq(wearableTokens.provider, provider)));
  }

  // Coaching session methods
  async getCoachingSessionsByUserId(userId: number, limit: number = 10): Promise<CoachingSession[]> {
    return await db.select()
      .from(coachingSessions)
      .where(eq(coachingSessions.userId, userId))
      .orderBy(desc(coachingSessions.createdAt))
      .limit(limit);
  }

  async createCoachingSession(insertSession: InsertCoachingSession): Promise<CoachingSession> {
    const [session] = await db.insert(coachingSessions).values(insertSession).returning();
    return session;
  }

  async getLatestCoachingSession(userId: number): Promise<CoachingSession | undefined> {
    const [session] = await db.select()
      .from(coachingSessions)
      .where(eq(coachingSessions.userId, userId))
      .orderBy(desc(coachingSessions.createdAt))
      .limit(1);
    return session || undefined;
  }

  // Coaching recommendation methods
  async getCoachingRecommendationsBySessionId(sessionId: number): Promise<CoachingRecommendation[]> {
    return await db.select()
      .from(coachingRecommendations)
      .where(eq(coachingRecommendations.sessionId, sessionId))
      .orderBy(desc(coachingRecommendations.createdAt));
  }

  async createCoachingRecommendation(insertRecommendation: InsertCoachingRecommendation): Promise<CoachingRecommendation> {
    const [recommendation] = await db.insert(coachingRecommendations).values(insertRecommendation).returning();
    return recommendation;
  }

  async updateCoachingRecommendationCompletion(id: number, completed: boolean): Promise<CoachingRecommendation> {
    const [recommendation] = await db.update(coachingRecommendations)
      .set({ completed })
      .where(eq(coachingRecommendations.id, id))
      .returning();
    return recommendation;
  }

  // User preferences methods
  async getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
    const [preferences] = await db.select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return preferences || undefined;
  }

  async createUserPreferences(insertPreferences: InsertUserPreferences): Promise<UserPreferences> {
    const [preferences] = await db.insert(userPreferences).values(insertPreferences).returning();
    return preferences;
  }

  async updateUserPreferences(userId: number, updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const [preferences] = await db.update(userPreferences)
      .set(updates)
      .where(eq(userPreferences.userId, userId))
      .returning();
    return preferences;
  }
}

export const storage = new DatabaseStorage();
