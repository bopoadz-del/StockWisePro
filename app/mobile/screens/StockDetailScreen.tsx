import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://stockwise-pro-api.onrender.com/api';
const theme = {
  background: '#0a0a0a',
  card: '#141414',
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  gold: '#c9a962',
  green: '#22c55e',
  red: '#ef4444',
  border: 'rgba(255,255,255,0.1)',
};

const screenWidth = Dimensions.get('window').width;

interface StockDetail {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  marketCap: number;
  volume: number;
  avgVolume: number;
  open: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  yearHigh: number;
  yearLow: number;
  pe: number;
  eps: number;
  sector: string;
  industry: string;
  description: string;
  score?: number;
  recommendation?: string;
}

export default function StockDetailScreen({ route, navigation }: any) {
  const { ticker } = route.params;
  const { isAuthenticated, user } = useAuth();
  const [stock, setStock] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1M');
  const [chartData, setChartData] = useState<number[]>([]);

  useEffect(() => {
    fetchStockDetail();
    checkWatchlist();
  }, [ticker]);

  const fetchStockDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/stocks/${ticker}`);
      const data = await response.json();
      
      // Add mock score and recommendation
      const enrichedData = {
        ...data,
        score: Math.floor(Math.random() * 40) + 60,
        recommendation: ['STRONG_BUY', 'BUY', 'HOLD'][Math.floor(Math.random() * 3)],
      };
      
      setStock(enrichedData);
      
      // Generate mock chart data
      const basePrice = data.price;
      const mockData = Array.from({ length: 30 }, (_, i) => {
        const variation = (Math.random() - 0.5) * 0.1;
        return basePrice * (1 + variation * (i / 30));
      });
      setChartData(mockData);
    } catch (error) {
      console.error('Error fetching stock detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkWatchlist = async () => {
    try {
      if (isAuthenticated) {
        const token = await AsyncStorage.getItem('auth-token');
        const response = await fetch(`${API_URL}/watchlist`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setInWatchlist(data.some((item: any) => item.ticker === ticker));
        }
      } else {
        const localWatchlist = await AsyncStorage.getItem('guest-watchlist');
        if (localWatchlist) {
          const data = JSON.parse(localWatchlist);
          setInWatchlist(data.some((item: any) => item.ticker === ticker));
        }
      }
    } catch (error) {
      console.error('Error checking watchlist:', error);
    }
  };

  const toggleWatchlist = async () => {
    try {
      if (!stock) return;

      if (isAuthenticated) {
        const token = await AsyncStorage.getItem('auth-token');
        if (inWatchlist) {
          await fetch(`${API_URL}/watchlist/${ticker}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        } else {
          await fetch(`${API_URL}/watchlist`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ ticker }),
          });
        }
      } else {
        const localWatchlist = await AsyncStorage.getItem('guest-watchlist');
        let data = localWatchlist ? JSON.parse(localWatchlist) : [];
        
        if (inWatchlist) {
          data = data.filter((item: any) => item.ticker !== ticker);
        } else {
          data.push({
            ticker: stock.symbol,
            name: stock.name,
            price: stock.price,
            change: stock.change,
            changesPercentage: stock.changesPercentage,
          });
        }
        await AsyncStorage.setItem('guest-watchlist', JSON.stringify(data));
      }
      
      setInWatchlist(!inWatchlist);
      Alert.alert(
        inWatchlist ? 'Removed' : 'Added',
        inWatchlist 
          ? `${ticker} removed from watchlist` 
          : `${ticker} added to watchlist`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update watchlist');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatMarketCap = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value}`;
  };

  const formatVolume = (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return `${value}`;
  };

  const getRecommendationColor = (rec?: string) => {
    switch (rec) {
      case 'STRONG_BUY':
      case 'BUY':
        return theme.green;
      case 'HOLD':
        return theme.gold;
      case 'SELL':
      case 'STRONG_SELL':
        return theme.red;
      default:
        return theme.textSecondary;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return theme.green;
    if (score >= 60) return theme.gold;
    return theme.red;
  };

  if (loading || !stock) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-down" size={28} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleWatchlist} style={styles.watchlistButton}>
          <Ionicons
            name={inWatchlist ? 'star' : 'star-outline'}
            size={24}
            color={inWatchlist ? theme.gold : theme.text}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stock Info */}
        <View style={styles.stockHeader}>
          <View>
            <Text style={styles.symbol}>{stock.symbol}</Text>
            <Text style={styles.name} numberOfLines={2}>
              {stock.name}
            </Text>
          </View>
          {stock.score && (
            <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(stock.score)}20` }]}>
              <Text style={[styles.scoreText, { color: getScoreColor(stock.score) }]}>
                {stock.score}
              </Text>
            </View>
          )}
        </View>

        {/* Price */}
        <View style={styles.priceContainer}>
          <Text style={styles.price}>{formatCurrency(stock.price)}</Text>
          <View style={styles.changeContainer}>
            <Ionicons
              name={stock.change >= 0 ? 'trending-up' : 'trending-down'}
              size={20}
              color={stock.change >= 0 ? theme.green : theme.red}
            />
            <Text
              style={[
                styles.change,
                { color: stock.change >= 0 ? theme.green : theme.red },
              ]}
            >
              {formatCurrency(stock.change)} ({formatPercentage(stock.changesPercentage)})
            </Text>
          </View>
        </View>

        {/* Recommendation */}
        {stock.recommendation && (
          <View style={styles.recommendationContainer}>
            <View
              style={[
                styles.recommendationBadge,
                { backgroundColor: `${getRecommendationColor(stock.recommendation)}20` },
              ]}
            >
              <Text
                style={[
                  styles.recommendationText,
                  { color: getRecommendationColor(stock.recommendation) },
                ]}
              >
                {stock.recommendation.replace('_', ' ')}
              </Text>
            </View>
          </View>
        )}

        {/* Timeframe Selector */}
        <View style={styles.timeframeContainer}>
          {(['1D', '1W', '1M', '3M', '1Y'] as const).map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[styles.timeframeButton, selectedTimeframe === tf && styles.timeframeActive]}
              onPress={() => setSelectedTimeframe(tf)}
            >
              <Text
                style={[
                  styles.timeframeText,
                  selectedTimeframe === tf && styles.timeframeTextActive,
                ]}
              >
                {tf}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        {chartData.length > 0 && (
          <View style={styles.chartContainer}>
            <LineChart
              data={{
                labels: [],
                datasets: [
                  {
                    data: chartData,
                  },
                ],
              }}
              width={screenWidth - 40}
              height={200}
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: theme.card,
                backgroundGradientTo: theme.card,
                decimalPlaces: 2,
                color: (opacity = 1) =>
                  stock.change >= 0
                    ? `rgba(34, 197, 94, ${opacity})`
                    : `rgba(239, 68, 68, ${opacity})`,
                labelColor: () => theme.textSecondary,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '0',
                },
              }}
              bezier
              style={styles.chart}
              withDots={false}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLines={false}
              withHorizontalLines={false}
              withVerticalLabels={false}
              withHorizontalLabels={false}
            />
          </View>
        )}

        {/* Key Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Market Cap</Text>
              <Text style={styles.statValue}>{formatMarketCap(stock.marketCap)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Volume</Text>
              <Text style={styles.statValue}>{formatVolume(stock.volume)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Avg Volume</Text>
              <Text style={styles.statValue}>{formatVolume(stock.avgVolume)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>P/E Ratio</Text>
              <Text style={styles.statValue}>{stock.pe?.toFixed(2) || 'N/A'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>EPS</Text>
              <Text style={styles.statValue}>{stock.eps ? formatCurrency(stock.eps) : 'N/A'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>52W High</Text>
              <Text style={styles.statValue}>{formatCurrency(stock.yearHigh)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>52W Low</Text>
              <Text style={styles.statValue}>{formatCurrency(stock.yearLow)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Open</Text>
              <Text style={styles.statValue}>{formatCurrency(stock.open)}</Text>
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutCard}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Sector</Text>
              <Text style={styles.aboutValue}>{stock.sector || 'Technology'}</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Industry</Text>
              <Text style={styles.aboutValue}>{stock.industry || 'Consumer Electronics'}</Text>
            </View>
            <Text style={styles.description}>{stock.description || `${stock.name} is a leading company in its industry.`}</Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={toggleWatchlist}>
          <Ionicons
            name={inWatchlist ? 'star' : 'star-outline'}
            size={20}
            color={inWatchlist ? theme.gold : theme.text}
          />
          <Text style={styles.actionButtonText}>
            {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Set Alert</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  watchlistButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  symbol: {
    color: theme.text,
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    color: theme.textSecondary,
    fontSize: 16,
    marginTop: 4,
    maxWidth: 250,
  },
  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  priceContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  price: {
    color: theme.text,
    fontSize: 40,
    fontWeight: 'bold',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  change: {
    fontSize: 18,
    marginLeft: 6,
    fontWeight: '500',
  },
  recommendationContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  recommendationBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  recommendationText: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  timeframeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: theme.card,
  },
  timeframeActive: {
    backgroundColor: theme.gold,
  },
  timeframeText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  timeframeTextActive: {
    color: theme.background,
    fontWeight: 'bold',
  },
  chartContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  chart: {
    borderRadius: 16,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsGrid: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    paddingVertical: 10,
  },
  statLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  aboutCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  aboutLabel: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  aboutValue: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '500',
  },
  description: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  bottomPadding: {
    height: 100,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 34,
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  actionButtonText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: theme.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
