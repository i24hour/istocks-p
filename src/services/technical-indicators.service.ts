import { 
  SMA, 
  EMA, 
  MACD, 
  RSI, 
  BollingerBands, 
  ATR,
  Stochastic,
  ADX,
  CCI,
  WilliamsR,
  ROC,
  OBV,
  VWAP as VWAPIndicator,
  ForceIndex,
  ADL
} from 'technicalindicators'

interface PriceData {
  timestamp: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface CalculatedIndicators {
  sma20?: number
  sma50?: number
  sma200?: number
  ema12?: number
  ema26?: number
  macd?: number
  macdSignal?: number
  macdHistogram?: number
  rsi?: number
  stochK?: number
  stochD?: number
  bbUpper?: number
  bbMiddle?: number
  bbLower?: number
  atr?: number
  adx?: number
  plusDI?: number
  minusDI?: number
  cci?: number
  williamsR?: number
  roc?: number
  obv?: bigint
  vwap?: number
  forceIndex?: number
  adLine?: number
}

export class TechnicalIndicatorsService {
  calculateAllIndicators(data: PriceData[]): CalculatedIndicators[] {
    if (data.length < 200) {
      console.warn('Not enough data points for all indicators')
    }

    const closes = data.map(d => d.close)
    const highs = data.map(d => d.high)
    const lows = data.map(d => d.low)
    const opens = data.map(d => d.open)
    const volumes = data.map(d => d.volume)

    // Calculate indicators
    const sma20Values = SMA.calculate({ period: 20, values: closes })
    const sma50Values = SMA.calculate({ period: 50, values: closes })
    const sma200Values = SMA.calculate({ period: 200, values: closes })
    
    const ema12Values = EMA.calculate({ period: 12, values: closes })
    const ema26Values = EMA.calculate({ period: 26, values: closes })
    
    const macdValues = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    })
    
    const rsiValues = RSI.calculate({ period: 14, values: closes })
    
    const stochValues = Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
      signalPeriod: 3,
    })
    
    const bbValues = BollingerBands.calculate({
      period: 20,
      values: closes,
      stdDev: 2,
    })
    
    const atrValues = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
    })
    
    const adxValues = ADX.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
    })
    
    const cciValues = CCI.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 20,
    })
    
    const williamsRValues = WilliamsR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
    })
    
    const rocValues = ROC.calculate({
      values: closes,
      period: 12,
    })
    
    const obvValues = OBV.calculate({
      close: closes,
      volume: volumes,
    })
    
    const forceIndexValues = ForceIndex.calculate({
      close: closes,
      volume: volumes,
      period: 13,
    })
    
    const adlValues = ADL.calculate({
      high: highs,
      low: lows,
      close: closes,
      volume: volumes,
    })

    // Combine all indicators
    const results: CalculatedIndicators[] = []
    
    for (let i = 0; i < data.length; i++) {
      const indicators: CalculatedIndicators = {}
      
      // Adjust indices for indicators with different starting points
      const sma20Index = i - (20 - 1)
      const sma50Index = i - (50 - 1)
      const sma200Index = i - (200 - 1)
      const ema12Index = i - (12 - 1)
      const ema26Index = i - (26 - 1)
      const macdIndex = i - (26 + 9 - 2)
      const rsiIndex = i - (14)
      const stochIndex = i - (14 + 3 - 2)
      const bbIndex = i - (20 - 1)
      const atrIndex = i - (14)
      const adxIndex = i - (14 * 2)
      const cciIndex = i - (20 - 1)
      const williamsRIndex = i - (14 - 1)
      const rocIndex = i - (12)
      
      if (sma20Index >= 0 && sma20Values[sma20Index] !== undefined) {
        indicators.sma20 = sma20Values[sma20Index]
      }
      if (sma50Index >= 0 && sma50Values[sma50Index] !== undefined) {
        indicators.sma50 = sma50Values[sma50Index]
      }
      if (sma200Index >= 0 && sma200Values[sma200Index] !== undefined) {
        indicators.sma200 = sma200Values[sma200Index]
      }
      if (ema12Index >= 0 && ema12Values[ema12Index] !== undefined) {
        indicators.ema12 = ema12Values[ema12Index]
      }
      if (ema26Index >= 0 && ema26Values[ema26Index] !== undefined) {
        indicators.ema26 = ema26Values[ema26Index]
      }
      if (macdIndex >= 0 && macdValues[macdIndex]) {
        indicators.macd = macdValues[macdIndex].MACD
        indicators.macdSignal = macdValues[macdIndex].signal
        indicators.macdHistogram = macdValues[macdIndex].histogram
      }
      if (rsiIndex >= 0 && rsiValues[rsiIndex] !== undefined) {
        indicators.rsi = rsiValues[rsiIndex]
      }
      if (stochIndex >= 0 && stochValues[stochIndex]) {
        indicators.stochK = stochValues[stochIndex].k
        indicators.stochD = stochValues[stochIndex].d
      }
      if (bbIndex >= 0 && bbValues[bbIndex]) {
        indicators.bbUpper = bbValues[bbIndex].upper
        indicators.bbMiddle = bbValues[bbIndex].middle
        indicators.bbLower = bbValues[bbIndex].lower
      }
      if (atrIndex >= 0 && atrValues[atrIndex] !== undefined) {
        indicators.atr = atrValues[atrIndex]
      }
      if (adxIndex >= 0 && adxValues[adxIndex]) {
        indicators.adx = adxValues[adxIndex].adx
        indicators.plusDI = adxValues[adxIndex].pdi
        indicators.minusDI = adxValues[adxIndex].mdi
      }
      if (cciIndex >= 0 && cciValues[cciIndex] !== undefined) {
        indicators.cci = cciValues[cciIndex]
      }
      if (williamsRIndex >= 0 && williamsRValues[williamsRIndex] !== undefined) {
        indicators.williamsR = williamsRValues[williamsRIndex]
      }
      if (rocIndex >= 0 && rocValues[rocIndex] !== undefined) {
        indicators.roc = rocValues[rocIndex]
      }
      if (obvValues[i] !== undefined) {
        indicators.obv = BigInt(Math.round(obvValues[i]))
      }
      if (forceIndexValues[i] !== undefined) {
        indicators.forceIndex = forceIndexValues[i]
      }
      if (adlValues[i] !== undefined) {
        indicators.adLine = adlValues[i]
      }
      
      // Calculate VWAP
      const vwap = (data[i].close * data[i].volume) / data[i].volume
      indicators.vwap = vwap
      
      results.push(indicators)
    }
    
    return results
  }
}

export const technicalIndicatorsService = new TechnicalIndicatorsService()
