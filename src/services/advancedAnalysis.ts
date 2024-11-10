import { api } from './api';
import * as tf from '@tensorflow/tfjs';
import { mlModels } from './ml/models';
import { strategyGenerator } from './strategy/strategyGenerator';
import { TechnicalSignals } from './types';

// Export the interface
export interface AdvancedAnalysis {
  marketCondition: {
    phase: string;
    strength: number;
    confidence: number;
    keyLevels: {
      strongSupport: number;
      support: number;
      pivot: number;
      resistance: number;
      strongResistance: number;
    };
  };
  technicalSignals: {
    trend: {
      primary: string;
      secondary: string;
      strength: number;
    };
    momentum: {
      rsi: { value: number; signal: string; };
      macd: { value: number; signal: string; };
      stochRSI: { value: number; signal: string; };
    };
    volatility: {
      current: number;
      trend: string;
      risk: 'low' | 'medium' | 'high';
    };
    volume: {
      change: number;
      trend: string;
      significance: 'weak' | 'moderate' | 'strong';
    };
  };
  sentimentAnalysis: {
    overall: {
      score: number;
      signal: string;
      confidence: number;
    };
    components: {
      news: {
        score: number;
        recent: string[];
        trend: string;
      };
      social: {
        score: number;
        trend: string;
        volume: number;
      };
      market: {
        score: number;
        dominance: number;
        flow: string;
      };
    };
  };
  predictions: {
    shortTerm: {
      price: { low: number; high: number; };
      confidence: number;
      signals: string[];
    };
    midTerm: {
      price: { low: number; high: number; };
      confidence: number;
      signals: string[];
    };
    longTerm: {
      price: { low: number; high: number; };
      confidence: number;
      signals: string[];
    };
  };
  riskAnalysis: {
    overall: number;
    factors: {
      technical: number;
      fundamental: number;
      sentiment: number;
      market: number;
    };
    warnings: string[];
  };
  tradingStrategy: {
    recommendation: string;
    confidence: number;
    entries: {
      conservative: number;
      moderate: number;
      aggressive: number;
    };
    stopLoss: {
      tight: number;
      normal: number;
      wide: number;
    };
    targets: {
      primary: number;
      secondary: number;
      final: number;
    };
    timeframe: string;
    rationale: string[];
  };
}

class AdvancedAnalysisService {
  private async calculateMarketPhase(prices: number[], volumeData: number[], crypto: string) {
    try {
      if (!Array.isArray(prices) || !Array.isArray(volumeData)) {
        throw new Error('Invalid input data');
      }

      const currentPrice = prices[prices.length - 1];

      // Calculate moving averages
      const ma20 = this.calculateSMA(prices, 20)[0];
      const ma50 = this.calculateSMA(prices, 50)[0];
      const ma200 = this.calculateSMA(prices, 200)[0];

      // Calculate trend structure
      const trendStructure = {
        aboveMA20: currentPrice > ma20,
        aboveMA50: currentPrice > ma50,
        aboveMA200: currentPrice > ma200,
        ma50AboveMA200: ma50 > ma200,
        ma20AboveMA50: ma20 > ma50
      };

      // Calculate support and resistance using recent price action
      const recentPrices = prices.slice(-20);
      const highPrice = Math.max(...recentPrices);
      const lowPrice = Math.min(...recentPrices);

      // Calculate dynamic support and resistance using multiple factors
      const support = Math.max(
        lowPrice,
        Math.min(ma20, ma50) * 0.995, // 0.5% below lowest MA
        currentPrice * 0.95 // Maximum 5% below current price
      );

      const resistance = Math.max(
        Math.min(
          highPrice,
          Math.max(ma20, ma50) * 1.005, // 0.5% above highest MA
          currentPrice * 1.05 // Maximum 5% above current price
        ),
        support * 1.01 // Ensure resistance is above support
      );

      // Determine market phase
      let phase = 'sideways';
      if (trendStructure.aboveMA50 && trendStructure.ma50AboveMA200 && trendStructure.ma20AboveMA50) {
        phase = 'bullish';
      } else if (!trendStructure.aboveMA50 && !trendStructure.ma50AboveMA200 && !trendStructure.ma20AboveMA50) {
        phase = 'bearish';
      } else if (trendStructure.aboveMA200 && !trendStructure.aboveMA50) {
        phase = 'correction';
      } else if (!trendStructure.aboveMA200 && trendStructure.aboveMA50) {
        phase = 'recovery';
      }

      // Calculate trend strength
      const trendStrength = await this.analyzeTrendStrength(prices, volumeData);
      const phaseStrength = Math.abs(trendStrength);

      // Calculate confidence
      const confidence = this.calculateConfidence([
        phaseStrength * 100,
        trendStructure.aboveMA50 ? 60 : 40,
        trendStructure.aboveMA200 ? 60 : 40,
        (currentPrice - support) / (resistance - support) * 100
      ]);

      // Ensure all values are valid numbers
      const keyLevels = {
        strongSupport: Number((support * 0.99).toFixed(2)),
        support: Number(support.toFixed(2)),
        pivot: Number(currentPrice.toFixed(2)),
        resistance: Number(resistance.toFixed(2)),
        strongResistance: Number((resistance * 1.01).toFixed(2))
      };

      // Validate key levels
      if (isNaN(keyLevels.resistance) || keyLevels.resistance === 0) {
        keyLevels.resistance = Number((currentPrice * 1.05).toFixed(2)); // 5% above current price
      }
      if (isNaN(keyLevels.strongResistance) || keyLevels.strongResistance === 0) {
        keyLevels.strongResistance = Number((keyLevels.resistance * 1.01).toFixed(2));
      }

      console.log('Market Phase Calculation:', {
        currentPrice,
        ma20,
        ma50,
        ma200,
        support,
        resistance,
        keyLevels
      });

      return {
        phase,
        strength: Number(phaseStrength.toFixed(2)),
        confidence: Number(confidence.toFixed(2)),
        keyLevels
      };
    } catch (error) {
      console.error('Error calculating market phase:', error);
      return this.getDefaultMarketPhase(prices[prices.length - 1] || 0, crypto);
    }
  }

  private determineMarketPhase(prices: number[], volumeData: number[], trendStrength: number): string {
    try {
      const currentPrice = prices[prices.length - 1];
      const ma50 = this.calculateSMA(prices, 50)[0];
      const ma200 = this.calculateSMA(prices, 200)[0];
      
      // Calculate momentum
      const rsi = this.calculateRSI(prices);
      const macd = this.calculateMACD(prices);
      
      // Determine phase based on multiple factors
      if (currentPrice > ma50 && ma50 > ma200 && trendStrength > 0.5 && rsi > 50) {
        return 'bullish';
      } else if (currentPrice < ma50 && ma50 < ma200 && trendStrength < -0.5 && rsi < 50) {
        return 'bearish';
      } else if (currentPrice > ma200 && currentPrice < ma50) {
        return 'correction';
      } else if (currentPrice < ma200 && currentPrice > ma50) {
        return 'recovery';
      } else if (Math.abs(trendStrength) < 0.3) {
        return 'sideways';
      }
      
      return 'neutral';
    } catch (error) {
      console.error('Error determining market phase:', error);
      return 'neutral';
    }
  }

  private calculatePhaseStrength(phase: string, trendStrength: number, volumeProfile: any): number {
    switch (phase) {
      case 'markup':
        return Math.min(1, trendStrength * 1.2);
      case 'markdown':
        return Math.min(1, Math.abs(trendStrength) * 1.2);
      case 'accumulation':
        return Math.min(1, volumeProfile.buyingPressure * 1.5);
      case 'distribution':
        return Math.min(1, volumeProfile.sellingPressure * 1.5);
      default:
        return 0.5;
    }
  }

  private async analyzeTrendStrength(prices: number[], volumes: number[]) {
    // Calculate multiple trend indicators
    const adx = this.calculateADX(prices, 14);
    const trendIntensity = this.calculateTrendIntensity(prices);
    const priceROC = this.calculatePriceROC(prices);
    const volumeTrend = this.calculateVolumeTrend(volumes);

    // Combine indicators with ML model
    const model = await this.getTrendModel();
    const prediction = await model.predict(tf.tensor2d([
      [adx, trendIntensity, priceROC, volumeTrend]
    ])) as tf.Tensor;

    return (await prediction.data())[0];
  }

  private async predictPriceTargets(data: {
    prices: number[];
    volumes: number[];
    currentPrice: number;
    volatility: number;
    sentiment: number;
  }) {
    try {
      // Calculate base volatility factor (normalized to smaller range)
      const volatilityFactor = Math.min(0.05, data.volatility / 1000); // Max 5% impact
      
      // Calculate sentiment impact (normalized to smaller range)
      const sentimentFactor = ((data.sentiment - 50) / 100) * 0.02; // Max 2% impact
      
      // Calculate recent trend (using last 20 periods)
      const recentPrices = data.prices.slice(-20);
      const trendFactor = Math.min(0.03, Math.max(-0.03,
        (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]
      )); // Max 3% impact

      // Calculate timeframe-specific ranges with tighter bounds
      const shortTermRange = {
        low: data.currentPrice * (1 - (volatilityFactor + 0.01)), // Max 6% down
        high: data.currentPrice * (1 + (volatilityFactor + 0.01))  // Max 6% up
      };

      const midTermRange = {
        low: data.currentPrice * (1 - (volatilityFactor * 2 + 0.02)), // Max 12% down
        high: data.currentPrice * (1 + (volatilityFactor * 2 + 0.02))  // Max 12% up
      };

      const longTermRange = {
        low: data.currentPrice * (1 - (volatilityFactor * 3 + 0.03)), // Max 18% down
        high: data.currentPrice * (1 + (volatilityFactor * 3 + 0.03))  // Max 18% up
      };

      // Adjust ranges based on sentiment and trend
      const adjustRanges = (range: { low: number; high: number }) => {
        const sentimentAdjustment = data.currentPrice * sentimentFactor;
        const trendAdjustment = data.currentPrice * trendFactor;
        
        return {
          low: Math.max(range.low + sentimentAdjustment + trendAdjustment, 
                       data.currentPrice * 0.85), // Prevent extreme lows
          high: Math.min(range.high + sentimentAdjustment + trendAdjustment, 
                        data.currentPrice * 1.15)  // Prevent extreme highs
        };
      };

      // Calculate confidence levels based on timeframe and data quality
      const baseConfidence = Math.min(90, Math.max(50, 
        70 - (volatilityFactor * 100) + (Math.abs(sentimentFactor) * 100)
      ));

      return {
        shortTerm: {
          price: adjustRanges(shortTermRange),
          confidence: baseConfidence,
          signals: this.generatePredictionSignals(
            shortTermRange.low,
            shortTermRange.high,
            volatilityFactor
          )
        },
        midTerm: {
          price: adjustRanges(midTermRange),
          confidence: Math.max(40, baseConfidence * 0.9),
          signals: this.generatePredictionSignals(
            midTermRange.low,
            midTermRange.high,
            volatilityFactor * 2
          )
        },
        longTerm: {
          price: adjustRanges(longTermRange),
          confidence: Math.max(30, baseConfidence * 0.8),
          signals: this.generatePredictionSignals(
            longTermRange.low,
            longTermRange.high,
            volatilityFactor * 3
          )
        }
      };
    } catch (error) {
      console.error('Error in price predictions:', error);
      return this.getDefaultPredictions(data.currentPrice);
    }
  }

  private generatePredictionSignals(low: number, high: number, volatility: number): string[] {
    const signals: string[] = [];
    const range = (high - low) / low;
    
    // Add price movement signals with more realistic thresholds
    if (range > 0.05) {
      signals.push('Moderate price movement expected');
    } else if (range > 0.10) {
      signals.push('Significant price movement expected');
    } else {
      signals.push('Stable price action expected');
    }

    // Add volatility signals
    if (volatility > 0.03) {
      signals.push('Higher than average volatility');
    } else if (volatility < 0.01) {
      signals.push('Lower than average volatility');
    }

    return signals;
  }

  private async analyzeRisk(technicalData: any, sentimentData: any) {
    const { prices, volumes, volatility, trendStrength } = technicalData;
    const { news, sentiment } = sentimentData;

    // Calculate technical risk
    const technicalRisk = volatility * 0.7 + (1 - Math.abs(trendStrength)) * 30;

    // Calculate sentiment risk
    const sentimentRisk = 100 - this.calculateSentimentScore(news, sentiment);

    // Calculate fundamental risk (based on market metrics)
    const fundamentalRisk = this.calculateFundamentalRisk(prices, volumes);

    // Calculate market risk (based on overall market conditions)
    const marketRisk = this.calculateMarketRisk(prices, volumes);

    return {
      overall: (technicalRisk + sentimentRisk + fundamentalRisk + marketRisk) / 4,
      factors: {
        technical: technicalRisk,
        fundamental: fundamentalRisk,
        sentiment: sentimentRisk,
        market: marketRisk
      },
      warnings: this.generateRiskWarnings(volatility, trendStrength, volumes[volumes.length - 1] / volumes[volumes.length - 2])
    };
  }

  private calculateFundamentalRisk(prices: number[], volumes: number[]): number {
    // Calculate fundamental risk based on price and volume patterns
    const volatility = this.calculateVolatility(prices);
    const volumeChange = volumes[volumes.length - 1] / volumes[volumes.length - 2];
    const priceChange = (prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2];

    const riskScore = (
      (volatility * 0.4) +
      (Math.abs(volumeChange - 1) * 30) +
      (Math.abs(priceChange) * 30)
    );

    return Math.min(100, Math.max(0, riskScore));
  }

  private calculateMarketRisk(prices: number[], volumes: number[]): number {
    // Calculate market risk based on trend strength and market conditions
    const trendStrength = Math.abs(
      (prices[prices.length - 1] - prices[prices.length - 20]) / prices[prices.length - 20]
    );
    const volumeTrend = volumes[volumes.length - 1] / 
      (volumes.slice(-20).reduce((sum, vol) => sum + vol, 0) / 20);

    const riskScore = (
      (50 - trendStrength * 100) * 0.6 +
      (Math.abs(volumeTrend - 1) * 40)
    );

    return Math.min(100, Math.max(0, riskScore));
  }



  private calculateSentimentScore(news: any[], sentiment: any): number {
    if (!news?.length) return 50;
    const newsScore = this.calculateNewsScore(news);
    const sentimentScore = sentiment[0]?.volume || 50;
    return (newsScore + sentimentScore) / 2;
  }

  private calculateNewsScore(news: any[]): number {
    if (!news?.length) return 50;
    const positiveCount = news.filter(n => n.sentiment === 'positive').length;
    const negativeCount = news.filter(n => n.sentiment === 'negative').length;
    return ((positiveCount - negativeCount) / news.length + 1) * 50;
  }

  private calculateNewsTrend(news: any[]): string {
    if (!news?.length) return 'neutral';
    const recentNews = news.slice(0, 5);
    const positiveCount = recentNews.filter(n => n.sentiment === 'positive').length;
    const negativeCount = recentNews.filter(n => n.sentiment === 'negative').length;
    if (positiveCount > negativeCount * 1.5) return 'bullish';
    if (negativeCount > positiveCount * 1.5) return 'bearish';
    return 'neutral';
  }

  private async getTrendModel() {
    return await mlModels.getTrendModel();
  }

  private prepareFeatures(data: any) {
    try {
      if (!data?.prices?.length) {
        throw new Error('Invalid price data for feature preparation');
      }

      // Calculate technical indicators
      const rsi = this.calculateRSI(data.prices);
      const macd = this.calculateMACD(data.prices);
      const volatility = this.calculateVolatility(data.prices);
      const volumeChange = data.volumes?.length > 0 ? 
        this.calculateVolumeRatio(data.volumes) : 1;

      // Create feature vector with exactly 4 features
      const features = [
        [
          rsi / 100, // Normalize RSI to 0-1 range
          macd, // MACD
          volatility / 100, // Normalize volatility
          volumeChange // Volume change ratio
        ]
      ];

      console.log('Prepared Features:', {
        shape: [1, 4],
        features: features[0]
      });
      
      // Return as 2D tensor with shape [1, 4]
      return tf.tensor2d(features);
    } catch (error) {
      console.error('Error preparing features:', error);
      // Return default feature tensor with correct shape [1, 4]
      return tf.tensor2d([[
        0.5,  // default normalized RSI
        0,    // default MACD
        0.3,  // default normalized volatility
        1     // default volume ratio
      ]]);
    }
  }

  private calculateBollingerBands(prices: number[], period: number = 20, multiplier: number = 2) {
    const smaValues = this.calculateSMA(prices, period);
    const stdDev = this.calculateStandardDeviation(prices, period);
    
    // Get the last SMA value
    const lastSMA = Array.isArray(smaValues) ? smaValues[smaValues.length - 1] : smaValues;
    
    return {
      upper: lastSMA + (multiplier * stdDev),
      middle: lastSMA,
      lower: lastSMA - (multiplier * stdDev)
    };
  }

  private calculateATR(prices: number[], period: number = 14): number {
    const tr = this.calculateTrueRange(prices);
    return tr.slice(-period).reduce((sum, val) => sum + val, 0) / period;
  }

  private calculateStandardDeviation(prices: number[], period: number): number {
    if (!prices || prices.length === 0) return 0;
    const slice = prices.slice(-period);
    const mean = slice.reduce((sum, price) => sum + price, 0) / slice.length;
    const squaredDiffs = slice.map(price => Math.pow(price - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / slice.length;
    return Math.sqrt(variance);
  }

  private async makePrediction(
    model: tf.LayersModel,
    features: tf.Tensor2D,
    timeframe: string
  ): Promise<{ price: { low: number; high: number }; confidence: number; signals: string[] }> {
    try {
      // Verify input shape
      const shape = features.shape;
      if (shape[1] !== 4) {
        throw new Error(`Invalid feature shape: expected [null, 4] but got [${shape[0]}, ${shape[1]}]`);
      }

      // Make prediction
      const prediction = await model.predict(features) as tf.Tensor;
      const [predictedValue] = await prediction.data();
      
      // Calculate price range based on timeframe and volatility
      const baseRange = timeframe === '24h' ? 0.02 : 
                       timeframe === '7d' ? 0.05 : 0.10;
      
      const currentPrice = features.arraySync()[0][0];
      const predictedChange = (predictedValue - currentPrice) / currentPrice;
      
      // Calculate confidence based on model output
      const confidence = Math.min(95, Math.max(30,
        (1 - Math.abs(predictedChange)) * 100 * 
        (timeframe === '24h' ? 1 : timeframe === '7d' ? 0.9 : 0.8)
      ));

      // Generate price range
      const low = currentPrice * (1 + predictedChange - baseRange);
      const high = currentPrice * (1 + predictedChange + baseRange);

      // Clean up tensors
      prediction.dispose();
      features.dispose();

      // Generate signals
      const signals = this.generatePredictionSignals(low, high, baseRange);

      return {
        price: { low, high },
        confidence,
        signals
      };
    } catch (error) {
      console.error('Error making prediction:', error);
      const currentPrice = features.arraySync()[0][0];
      return {
        price: {
          low: currentPrice * 0.95,
          high: currentPrice * 1.05
        },
        confidence: 50,
        signals: ['Using fallback prediction due to error']
      };
    }
  }

  private calculateConfidence(indicators: number[]): number {
    const avgStrength = indicators.reduce((a, b) => a + b, 0) / indicators.length;
    return Math.min(95, Math.max(30, avgStrength));
  }

  private async calculateTechnicalSignals(priceData: any, volumeData: any): Promise<TechnicalSignals> {
    try {
      // Additional validation
      if (!Array.isArray(priceData.prices) || priceData.prices.length < 200) {
        console.error('Invalid price data:', priceData);
        throw new Error('Insufficient price data');
      }

      const prices = priceData.prices;
      const volumes = Array.isArray(volumeData) ? volumeData : [];

      // Validate data quality
      if (prices.some((p: number) => typeof p !== 'number' || isNaN(p) || p <= 0)) {
        console.error('Invalid price values found:', prices.filter((p: number) => typeof p !== 'number' || isNaN(p) || p <= 0));
        throw new Error('Invalid price data detected');
      }

      console.log('Technical Signals Input:', {
        pricesLength: prices.length,
        volumesLength: volumes.length,
        samplePrices: prices.slice(-20), // Show last 20 points for debugging
        sampleVolumes: volumes.slice(-20)
      });

      // Calculate indicators using full dataset
      const rsi = this.calculateRSI(prices, 14); // 14-period RSI using all available data
      const macd = {
        value: this.calculateMACD(prices), // Using full dataset for EMA calculations
        signal: this.calculateMACDSignal(prices),
        histogram: this.calculateMACDHistogram(prices)
      };
      const stochRSI = this.calculateStochRSI(prices, 14);
      
      // Calculate volume metrics using more data
      const volumeChange = volumes.length > 0 ? 
        this.calculateVolumeRatio(volumes.slice(-100)) : 1; // Use last 100 periods for volume ratio
      
      // Calculate volatility using more data
      const volatility = this.calculateVolatility(prices.slice(-100)); // 100-period volatility

      // Calculate trends using full dataset
      const primaryTrend = this.determineTrendDirection(prices);
      const secondaryTrend = this.determineSecondaryTrend(prices);
      const volumeProfile = this.calculateVolumeProfile(
        prices.slice(-200), // Use last 200 periods for volume profile
        volumes.slice(-200)
      );
      const trendStrength = volumeProfile.strength || 0.5;

      console.log('Technical Calculations:', {
        dataPointsUsed: prices.length,
        currentPrice: prices[prices.length - 1],
        rsi,
        macd,
        stochRSI,
        volumeChange,
        volatility,
        trendStrength
      });

      return {
        trend: {
          primary: primaryTrend || 'neutral',
          secondary: secondaryTrend || 'neutral',
          strength: Number(trendStrength.toFixed(2))
        },
        momentum: {
          rsi: {
            value: Number(rsi.toFixed(2)),
            signal: this.interpretRSI(rsi)
          },
          macd: {
            value: Number(macd.value.toFixed(2)),
            signal: this.interpretMACD(macd.value, macd.signal, macd.histogram)
          },
          stochRSI: {
            value: Number(stochRSI.toFixed(2)),
            signal: this.interpretStochRSI(stochRSI)
          }
        },
        volatility: {
          current: Number(volatility.toFixed(2)),
          trend: this.determineVolatilityTrend(prices.slice(-100)), // 100-period volatility trend
          risk: this.categorizeVolatilityRisk(volatility)
        },
        volume: {
          change: Number(volumeChange.toFixed(2)),
          trend: this.determineVolumeTrend(volumes.slice(-100)), // 100-period volume trend
          significance: volumeProfile.strength > 0.7 ? 'strong' :
                       volumeProfile.strength > 0.4 ? 'moderate' : 'weak'
        }
      };
    } catch (error) {
      console.error('Error calculating technical signals:', error);
      throw error;
    }
  }

  private calculateRSI(prices: number[], period: number = 14): number {
    try {
      if (!Array.isArray(prices) || prices.length < period + 1) {
        return 50;
      }

      let gains = 0;
      let losses = 0;

      // Calculate initial gains and losses
      for (let i = 1; i < period + 1; i++) {
        const difference = prices[i] - prices[i - 1];
        if (difference >= 0) {
          gains += difference;
        } else {
          losses -= difference;
        }
      }

      let avgGain = gains / period;
      let avgLoss = losses / period;

      // Calculate RSI using Wilder's smoothing
      for (let i = period + 1; i < prices.length; i++) {
        const difference = prices[i] - prices[i - 1];
        avgGain = ((avgGain * (period - 1)) + Math.max(0, difference)) / period;
        avgLoss = ((avgLoss * (period - 1)) + Math.max(0, -difference)) / period;
      }

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));

      return isNaN(rsi) ? 50 : rsi;
    } catch (error) {
      console.error('Error calculating RSI:', error);
      return 50;
    }
  }

  private calculateMACD(prices: number[]): number {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    return ema12[ema12.length - 1] - ema26[ema26.length - 1];
  }

  private calculateMACDSignal(prices: number[]): number {
    const macdLine = [];
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    for (let i = 0; i < ema12.length; i++) {
      macdLine.push(ema12[i] - ema26[i]);
    }
    
    const signal = this.calculateEMA(macdLine, 9);
    return signal[signal.length - 1];
  }

  private calculateMACDHistogram(prices: number[]): number {
    const macd = this.calculateMACD(prices);
    const signal = this.calculateMACDSignal(prices);
    return macd - signal;
  }

  private calculateVolatility(prices: number[]): number {
    try {
      if (!Array.isArray(prices) || prices.length < 2) {
        return 30;
      }

      const returns = prices.slice(1).map((price, i) => 
        Math.log(price / prices[i])
      );
      
      const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const squaredDiffs = returns.map(ret => Math.pow(ret - avgReturn, 2));
      const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / returns.length;
      const volatility = Math.sqrt(variance) * Math.sqrt(365) * 100;

      return isNaN(volatility) ? 30 : Math.min(100, Math.max(0, volatility));
    } catch (error) {
      console.error('Error calculating volatility:', error);
      return 30;
    }
  }

  private calculateVolumeTrend(volumes: number[]): number {
    if (!volumes || volumes.length < 20) return 0;
    
    const recentAvg = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const historicalAvg = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    
    return (recentAvg - historicalAvg) / historicalAvg;
  }

  private calculateTrueRange(prices: number[]): number[] {
    const tr = [];
    for (let i = 1; i < prices.length; i++) {
      const high = prices[i];
      const low = prices[i - 1];
      const previousClose = prices[i - 1];
      
      tr.push(Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose)
      ));
    }
    return tr;
  }

  private calculateADX(prices: number[], period: number = 14): number {
    const tr = this.calculateTrueRange(prices);
    const atr = tr.slice(-period).reduce((a, b) => a + b, 0) / period;
    const dmPlus = [];
    const dmMinus = [];
    
    for (let i = 1; i < prices.length; i++) {
      const high = prices[i];
      const low = prices[i - 1];
      dmPlus.push(Math.max(0, high - prices[i - 1]));
      dmMinus.push(Math.max(0, prices[i - 1] - low));
    }
    
    const diPlus = (dmPlus.reduce((a, b) => a + b, 0) / period) / atr * 100;
    const diMinus = (dmMinus.reduce((a, b) => a + b, 0) / period) / atr * 100;
    
    return Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
  }

  private calculateTrendIntensity(prices: number[]): number {
    const returns = prices.slice(1).map((price, i) => 
      (price - prices[i]) / prices[i]
    );
    
    const positiveReturns = returns.filter(r => r > 0).length;
    const negativeReturns = returns.filter(r => r < 0).length;
    
    return (positiveReturns - negativeReturns) / returns.length;
  }

  private calculatePriceROC(prices: number[]): number {
    const period = 14;
    if (prices.length < period) return 0;
    
    const currentPrice = prices[prices.length - 1];
    const oldPrice = prices[prices.length - period];
    
    return ((currentPrice - oldPrice) / oldPrice) * 100;
  }

  private calculateVolumeProfile(prices: number[], volumes: number[]) {
    if (!prices?.length || !volumes?.length) {
      return {
        poc: 0,
        valueArea: { high: 0, low: 0 },
        supports: [0],
        resistances: [0],
        buyingPressure: 0.5,
        sellingPressure: 0.5,
        strength: 0.5
      };
    }

    const currentPrice = prices[prices.length - 1];
    const priceVolume = new Map<number, number>();
    
    // Calculate volume at price levels
    prices.forEach((price, i) => {
      const roundedPrice = Math.round(price / 10) * 10;
      priceVolume.set(
        roundedPrice,
        (priceVolume.get(roundedPrice) || 0) + volumes[i]
      );
    });

    // Find POC (Point of Control)
    let maxVolume = 0;
    let poc = currentPrice;
    priceVolume.forEach((volume, price) => {
      if (volume > maxVolume) {
        maxVolume = volume;
        poc = price;
      }
    });

    // Calculate Value Area
    const totalVolume = Array.from(priceVolume.values()).reduce((a, b) => a + b, 0);
    const valueAreaVolume = totalVolume * 0.68;
    let volumeSum = 0;
    const pricesSorted = Array.from(priceVolume.keys()).sort((a, b) => a - b);
    let low = poc;
    let high = poc;

    while (volumeSum < valueAreaVolume && (low > pricesSorted[0] || high < pricesSorted[pricesSorted.length - 1])) {
      const nextLow = pricesSorted[pricesSorted.indexOf(low) - 1];
      const nextHigh = pricesSorted[pricesSorted.indexOf(high) + 1];
      
      const lowVolume = nextLow ? priceVolume.get(nextLow) || 0 : 0;
      const highVolume = nextHigh ? priceVolume.get(nextHigh) || 0 : 0;
      
      if (lowVolume > highVolume) {
        volumeSum += lowVolume;
        if (nextLow) low = nextLow;
      } else {
        volumeSum += highVolume;
        if (nextHigh) high = nextHigh;
      }
    }

    return {
      poc,
      valueArea: { high, low },
      supports: [low],
      resistances: [high],
      buyingPressure: volumeSum / totalVolume,
      sellingPressure: 1 - (volumeSum / totalVolume),
      strength: maxVolume / totalVolume
    };
  }

  private determineTrendDirection(prices: number[]): string {
    const ma20 = this.calculateSMA(prices, 20);
    const ma50 = this.calculateSMA(prices, 50);
    const ma200 = this.calculateSMA(prices, 200);
    
    if (ma20 > ma50 && ma50 > ma200) return 'bullish';
    if (ma20 < ma50 && ma50 < ma200) return 'bearish';
    return 'neutral';
  }

  private determineSecondaryTrend(prices: number[]): string {
    const shortMAValues = this.calculateEMA(prices.slice(-20), 5);
    const mediumMAValues = this.calculateEMA(prices.slice(-20), 10);
    
    const shortMA = shortMAValues[shortMAValues.length - 1];
    const mediumMA = mediumMAValues[mediumMAValues.length - 1];
    
    if (shortMA > mediumMA) return 'bullish';
    if (shortMA < mediumMA) return 'bearish';
    return 'neutral';
  }

  private determineVolatilityTrend(prices: number[]): string {
    if (!prices || prices.length < 100) return 'stable';
    
    const currentVol = this.calculateVolatility(prices.slice(-50));
    const previousVol = this.calculateVolatility(prices.slice(-100, -50));
    
    if (currentVol > previousVol * 1.2) return 'increasing';
    if (currentVol < previousVol * 0.8) return 'decreasing';
    return 'stable';
  }

  private categorizeVolatilityRisk(volatility: number): 'low' | 'medium' | 'high' {
    if (volatility > 80) return 'high';
    if (volatility > 40) return 'medium';
    return 'low';
  }

  private interpretRSI(rsi: number): string {
    if (rsi > 70) return 'overbought';
    if (rsi < 30) return 'oversold';
    return 'neutral';
  }

  private interpretStochRSI(stochRSI: number): string {
    if (stochRSI > 80) return 'extremely overbought';
    if (stochRSI > 60) return 'overbought';
    if (stochRSI < 20) return 'extremely oversold';
    if (stochRSI < 40) return 'oversold';
    return 'neutral';
  }

  // Update the calculateEMA method to handle arrays
  private calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema = [prices[0]];
    
    for (let i = 1; i < prices.length; i++) {
      ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }
    
    return ema;
  }

  // Update the calculateStochRSI method to handle arrays
  private calculateStochRSI(prices: number[], period: number = 14): number {
    const rsiValues = this.calculateRSIArray(prices, period);
    const minRSI = Math.min(...rsiValues);
    const maxRSI = Math.max(...rsiValues);
    const currentRSI = rsiValues[rsiValues.length - 1];
    
    return ((currentRSI - minRSI) / (maxRSI - minRSI)) * 100;
  }

  private calculateRSIArray(prices: number[], period: number = 14): number[] {
    const rsiValues = [];
    let gains = 0;
    let losses = 0;

    // Calculate initial average gain and loss
    for (let i = 1; i < period + 1; i++) {
      const difference = prices[i] - prices[i - 1];
      if (difference >= 0) {
        gains += difference;
      } else {
        losses -= difference;
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Calculate RSI values
    for (let i = period + 1; i < prices.length; i++) {
      const difference = prices[i] - prices[i - 1];
      avgGain = ((avgGain * (period - 1)) + Math.max(0, difference)) / period;
      avgLoss = ((avgLoss * (period - 1)) + Math.max(0, -difference)) / period;
      
      const rs = avgGain / avgLoss;
      rsiValues.push(100 - (100 / (1 + rs)));
    }

    return rsiValues;
  }

  // Update the calculateVolumeRatio method to handle arrays
  private calculateVolumeRatio(volumes: number[]): number {
    try {
      if (!Array.isArray(volumes) || volumes.length < 20) {
        return 1;
      }

      const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const averageVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      
      const ratio = recentVolume / averageVolume;
      return isNaN(ratio) ? 1 : Math.max(0, ratio);
    } catch (error) {
      console.error('Error calculating volume ratio:', error);
      return 1;
    }
  }

  // Update the interpretMACD method to handle arrays
  private interpretMACD(value: number, signal: number, histogram: number): string {
    let interpretation = '';

    if (histogram > 0) {
      interpretation = histogram > histogram * 0.1 
        ? 'Strong bullish momentum' 
        : 'Bullish momentum';
    } else {
      interpretation = histogram < -histogram * 0.1 
        ? 'Strong bearish momentum' 
        : 'Bearish momentum';
    }

    if (value > 0 && signal > 0) {
      interpretation += ', upward trend';
    } else if (value < 0 && signal < 0) {
      interpretation += ', downward trend';
    }

    if (Math.abs(value - signal) < 0.1) {
      interpretation += ', potential trend reversal';
    }

    return interpretation;
  }

  // Update the getDefaultMarketPhase method to handle arrays
  private getDefaultMarketPhase(currentPrice: number, crypto: string) {
    // Default price ranges for different cryptocurrencies
    const defaultRanges: Record<string, { support: number, resistance: number }> = {
      'bitcoin': { support: 65000, resistance: 70000 },
      'ethereum': { support: 2300, resistance: 2500 },
      'binancecoin': { support: 280, resistance: 320 },
      'cardano': { support: 0.45, resistance: 0.55 },
      'solana': { support: 90, resistance: 110 }
    };

    const range = defaultRanges[crypto.toLowerCase()] || { 
      support: currentPrice * 0.95, 
      resistance: currentPrice * 1.05 
    };

    return {
      phase: 'Analyzing',
      strength: 0.5,
      confidence: 50,
      keyLevels: {
        strongSupport: Number((range.support * 0.98).toFixed(2)),
        support: Number(range.support.toFixed(2)),
        pivot: Number(currentPrice.toFixed(2)),
        resistance: Number(range.resistance.toFixed(2)),
        strongResistance: Number((range.resistance * 1.02).toFixed(2))
      }
    };
  }

  private generateRiskWarnings(volatility: number, trendStrength: number, volumeRatio: number): string[] {
    const warnings: string[] = [];
    
    if (volatility > 50) warnings.push('High market volatility');
    if (trendStrength < 0.3) warnings.push('Weak market trend');
    if (volumeRatio > 2) warnings.push('Unusual trading volume');
    
    return warnings.length ? warnings : ['No significant risks detected'];
  }

  async getFullAnalysis(crypto: string): Promise<AdvancedAnalysis> {
    try {
      // Fetch historical data
      const historicalData = await api.getHistoricalData(crypto);
      console.log('Raw Historical Data:', historicalData);

      // Validate the data
      if (!historicalData?.prices?.length || historicalData.prices.length < 20) {
        console.error('Invalid or insufficient historical data:', historicalData);
        return this.getDefaultAnalysis(crypto);
      }

      // Process the data
      const processedData = {
        prices: historicalData.prices,
        volumes: historicalData.volumes || Array(historicalData.prices.length).fill(0),
        current_price: historicalData.current_price || historicalData.prices[historicalData.prices.length - 1],
        market_cap: historicalData.market_cap,
        price_change_24h: historicalData.price_change_24h
      };

      // Validate processed data
      if (!processedData.current_price || processedData.prices.length === 0) {
        console.error('Invalid processed data:', processedData);
        return this.getDefaultAnalysis(crypto);
      }

      console.log('Processed Data:', {
        pricesLength: processedData.prices.length,
        firstPrice: processedData.prices[0],
        lastPrice: processedData.prices[processedData.prices.length - 1],
        currentPrice: processedData.current_price,
        marketCap: processedData.market_cap,
        priceChange24h: processedData.price_change_24h
      });

      // Calculate technical signals
      const technicalSignals = await this.calculateTechnicalSignals(
        { 
          prices: processedData.prices,
          current_price: processedData.current_price 
        },
        processedData.volumes
      );

      // Calculate market phase with processed data
      const marketCondition = await this.calculateMarketPhase(
        processedData.prices,
        processedData.volumes,
        crypto
      );

      // Get sentiment and news data
      const sentiment = await api.getSentiment(crypto);
      const newsData = await api.getNews(crypto);

      // Calculate predictions with processed data
      const predictions = await this.predictPriceTargets({
        prices: processedData.prices,
        volumes: processedData.volumes,
        currentPrice: processedData.current_price,
        volatility: technicalSignals.volatility.current,
        sentiment: sentiment?.[0]?.volume || 50
      });

      // Calculate risk analysis with processed data
      const riskAnalysis = await this.analyzeRisk(
        {
          prices: processedData.prices,
          volumes: processedData.volumes,
          volatility: technicalSignals.volatility.current,
          trendStrength: technicalSignals.trend.strength
        },
        { news: newsData?.news || [], sentiment }
      );

      console.log('Analysis Components:', {
        technicalSignals,
        marketCondition,
        predictions,
        riskAnalysis
      });

      return {
        marketCondition,
        technicalSignals,
        sentimentAnalysis: {
          overall: {
            score: this.calculateSentimentScore(newsData?.news || [], sentiment),
            signal: this.determineSentimentSignal(sentiment),
            confidence: this.calculateConfidence([
              technicalSignals.trend.strength * 100,
              this.calculateNewsScore(newsData?.news || [])
            ])
          },
          components: {
            news: {
              score: this.calculateNewsScore(newsData?.news || []),
              recent: (newsData?.news || []).slice(0, 3).map(n => n.title),
              trend: this.calculateNewsTrend(newsData?.news || [])
            },
            social: {
              score: sentiment?.[0]?.volume || 50,
              trend: sentiment?.[0]?.sentiment || 'neutral',
              volume: technicalSignals.volume.change
            },
            market: {
              score: (technicalSignals.momentum.rsi.value + 
                     (technicalSignals.momentum.macd.value > 0 ? 60 : 40)) / 2,
              dominance: technicalSignals.trend.strength * 100,
              flow: technicalSignals.volume.change > 1 ? 'inflow' : 'outflow'
            }
          }
        },
        predictions,
        riskAnalysis,
        tradingStrategy: await strategyGenerator.generateStrategy({
          currentPrice: processedData.current_price,
          marketCondition,
          technicalSignals,
          sentimentAnalysis: this.calculateSentimentScore(newsData?.news || [], sentiment),
          riskAnalysis,
          predictions
        })
      };
    } catch (error) {
      console.error('Error in advanced analysis:', error);
      return this.getDefaultAnalysis(crypto);
    }
  }

  private determineSentimentSignal(sentiment: any): string {
    const score = sentiment[0]?.volume || 50;
    if (score > 60) return 'bullish';
    if (score < 40) return 'bearish';
    return 'neutral';
  }

  private getDefaultAnalysis(crypto: string): AdvancedAnalysis {
    const defaultPrice = 76000; // Updated default price for Bitcoin
    return {
      marketCondition: this.getDefaultMarketPhase(defaultPrice, crypto),
      technicalSignals: {
        trend: { primary: 'neutral', secondary: 'neutral', strength: 0.5 },
        momentum: {
          rsi: { value: 50, signal: 'neutral' },
          macd: { value: 0, signal: 'neutral' },
          stochRSI: { value: 50, signal: 'neutral' }
        },
        volatility: { current: 30, trend: 'stable', risk: 'low' },
        volume: { change: 1, trend: 'neutral', significance: 'moderate' }
      },
      sentimentAnalysis: {
        overall: { score: 50, signal: 'neutral', confidence: 50 },
        components: {
          news: { score: 50, recent: [], trend: 'neutral' },
          social: { score: 50, trend: 'neutral', volume: 1 },
          market: { score: 50, dominance: 50, flow: 'stable' }
        }
      },
      predictions: this.getDefaultPredictions(defaultPrice),
      riskAnalysis: {
        overall: 50,
        factors: { technical: 50, fundamental: 50, sentiment: 50, market: 50 },
        warnings: ['Using default analysis due to data unavailability']
      },
      tradingStrategy: {
        recommendation: 'Hold',
        confidence: 50,
        entries: { conservative: defaultPrice * 0.98, moderate: defaultPrice, aggressive: defaultPrice * 1.02 },
        stopLoss: { tight: defaultPrice * 0.95, normal: defaultPrice * 0.93, wide: defaultPrice * 0.90 },
        targets: { primary: defaultPrice * 1.05, secondary: defaultPrice * 1.10, final: defaultPrice * 1.15 },
        timeframe: 'Medium-term',
        rationale: ['Using default analysis due to data unavailability']
      }
    };
  }

  private calculatePriceTargets(
    currentPrice: number,
    prices: number[],
    volatility: number,
    support: number,
    resistance: number
  ) {
    // Calculate Fibonacci levels and use fib236
    const range = resistance - support;
    const fib236 = support + (range * 0.236);
    const fib382 = support + (range * 0.382);
    const fib618 = support + (range * 0.618);

    // Use fib236 for short-term support
    const shortTermRange = {
      low: Math.max(fib236, currentPrice * (1 - volatility * 0.1)),
      high: Math.min(resistance, currentPrice * (1 + volatility * 0.1))
    };

    // Rest of the code remains the same...
    return {
      shortTerm: shortTermRange,
      midTerm: {
        low: Math.min(currentPrice, fib382),
        high: Math.max(currentPrice, fib618)
      },
      longTerm: {
        low: support,
        high: resistance
      }
    };
  }

  private determineVolumeTrend(volumes: number[]): string {
    if (!volumes || volumes.length < 100) return 'neutral';
    
    const recentAvg = volumes.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const previousAvg = volumes.slice(-100, -50).reduce((a, b) => a + b, 0) / 50;
    
    if (recentAvg > previousAvg * 1.1) return 'increasing';
    if (recentAvg < previousAvg * 0.9) return 'decreasing';
    return 'neutral';
  }

  private getDefaultPredictions(currentPrice: number) {
    return {
      shortTerm: {
        price: { low: currentPrice * 0.95, high: currentPrice * 1.05 },
        confidence: 50,
        signals: ['Default prediction']
      },
      midTerm: {
        price: { low: currentPrice * 0.90, high: currentPrice * 1.10 },
        confidence: 40,
        signals: ['Default prediction']
      },
      longTerm: {
        price: { low: currentPrice * 0.85, high: currentPrice * 1.15 },
        confidence: 30,
        signals: ['Default prediction']
      }
    };
  }

  // Add this method to the AdvancedAnalysisService class

  private calculateSMA(prices: number[], period: number = 20): number[] {
    try {
      if (!prices || prices.length === 0) return [0];
      
      const sma: number[] = [];
      for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
          sma.push(0);
          continue;
        }
        
        const slice = prices.slice(i - period + 1, i + 1);
        const average = slice.reduce((sum, price) => sum + price, 0) / period;
        sma.push(average);
      }
      
      return sma;
    } catch (error) {
      console.error('Error calculating SMA:', error);
      return [0];
    }
  }
}

export const advancedAnalysis = new AdvancedAnalysisService();