/**
 * SIMPLIFIED Backend Integration Service
 * 
 * HOW TO USE:
 * 1. Your frontend will work WITHOUT the backend (uses mock data)
 * 2. To enable backend:
 *    - Start Flask: cd backend && python app.py
 *    - Backend runs on http://localhost:5000
 * 3. That's it! The app auto-detects if backend is available
 */

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:5000/api';

// Simple flag - app works either way!
let backendAvailable = false;

console.log('✨ Backend Service: Frontend works with OR without backend');
console.log('📍 Backend URL:', API_BASE_URL);
console.log('💡 To connect backend: cd backend && python app.py');

export interface PredictionFeatures {
  timestamp: string;
  temperature: number;
  humidity: number;
  occupancy: number;
  renewable: number;
  hvac_status: number;
  lighting_status: number;
  day_of_week: number;
  is_holiday: number;
  hour: number;
  month: number;
  day_of_month: number;
  is_weekend: number;
  is_business_hour: number;
}

export interface PredictionResult {
  index: number;
  timestamp: string;
  predicted: number;
  lower_bound?: number;
  upper_bound?: number;
  confidence?: number;
}

export interface ModelInfo {
  model_type: string;
  n_estimators?: number;
  n_features?: number;
  feature_names?: string[];
  top_features?: Record<string, number>;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    value: any;
    message: string;
  }>;
  warnings: Array<{
    field: string;
    value: any;
    message: string;
  }>;
}

export interface PerformanceMetrics {
  total_predictions: number;
  successful_predictions: number;
  failed_predictions: number;
  avg_prediction: number;
  last_updated: string;
  startup_time: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: any[];
}

class BackendService {
  private baseUrl: string;
  private enabled: boolean;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.enabled = backendAvailable;
  }

  /**
   * Check backend availability and health
   */
  async healthCheck(): Promise<ApiResponse<{
    status: string;
    model_loaded: boolean;
    model_type?: string;
    total_predictions?: number;
  }>> {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Backend integration disabled',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.warn('Backend health check failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Backend unavailable',
      };
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<ApiResponse<ModelInfo>> {
    if (!this.enabled) {
      return { success: false, error: 'Backend disabled' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/model-info`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch model info: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Model not loaded');
      }

      return {
        success: true,
        data: {
          model_type: result.model_type,
          n_estimators: result.n_estimators,
          n_features: result.n_features,
          feature_names: result.feature_names,
          top_features: result.top_features,
        },
      };
    } catch (error) {
      console.error('Failed to get model info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Make predictions with full validation
   */
  async predict(
    features: Partial<PredictionFeatures>[],
    includeConfidence: boolean = true
  ): Promise<ApiResponse<PredictionResult[]>> {
    if (!this.enabled) {
      return { success: false, error: 'Backend disabled' };
    }

    try {
      // Validate input
      if (!features || features.length === 0) {
        throw new Error('No features provided for prediction');
      }

      const response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          features,
          include_confidence: includeConfidence,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || `HTTP ${response.status}`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Prediction failed');
      }

      return {
        success: true,
        data: result.predictions,
        warnings: result.warnings,
      };
    } catch (error) {
      console.error('Prediction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Prediction failed',
      };
    }
  }

  /**
   * Validate features without making predictions
   */
  async validateFeatures(
    features: Partial<PredictionFeatures>
  ): Promise<ApiResponse<ValidationResult>> {
    if (!this.enabled) {
      return { success: false, error: 'Backend disabled' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          features: [features],
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result.validation,
      };
    } catch (error) {
      console.error('Validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Get performance metrics
   */
  async getMetrics(): Promise<ApiResponse<PerformanceMetrics>> {
    if (!this.enabled) {
      return { success: false, error: 'Backend disabled' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/metrics`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get metrics');
      }

      return {
        success: true,
        data: result.metrics,
      };
    } catch (error) {
      // Silently return failure - backend might not be available
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Metrics unavailable',
      };
    }
  }

  /**
   * Reload the model
   */
  async reloadModel(): Promise<ApiResponse<{ message: string }>> {
    if (!this.enabled) {
      return { success: false, error: 'Backend disabled' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/reload-model`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Failed to reload model: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: result.success,
        data: { message: result.message },
        error: result.success ? undefined : result.message,
      };
    } catch (error) {
      console.error('Failed to reload model:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Reload failed',
      };
    }
  }

  /**
   * Generate sample features for testing
   */
  generateSampleFeatures(count: number = 24): Partial<PredictionFeatures>[] {
    const features: Partial<PredictionFeatures>[] = [];
    const baseDate = new Date();

    for (let i = 0; i < count; i++) {
      const date = new Date(baseDate);
      date.setHours(date.getHours() + i);

      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
      const isBusinessHour = hour >= 8 && hour <= 18 && !isWeekend ? 1 : 0;

      features.push({
        timestamp: date.toISOString().replace('T', ' ').substring(0, 19),
        temperature: 18 + Math.random() * 8, // 18-26°C
        humidity: 40 + Math.random() * 30, // 40-70%
        occupancy: isBusinessHour ? 50 + Math.random() * 100 : Math.random() * 30,
        renewable: 20 + Math.random() * 80, // 20-100 kW
        hvac_status: isBusinessHour ? 1 : Math.random() > 0.3 ? 1 : 0,
        lighting_status: isBusinessHour ? 1 : Math.random() > 0.7 ? 1 : 0,
        day_of_week: dayOfWeek,
        is_holiday: 0,
        hour,
        month: date.getMonth() + 1,
        day_of_month: date.getDate(),
        is_weekend: isWeekend,
        is_business_hour: isBusinessHour,
      });
    }

    return features;
  }

  /**
   * Check if backend is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const backendService = new BackendService();