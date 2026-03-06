import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';

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

export default function HomeScreen({ navigation }: any) {
  const [indices, setIndices] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch market indices
      const indicesRes = await fetch(`${API_URL}/stocks/indices`);
      const indicesData = await indicesRes.json();
      setIndices(indicesData);

      // Fetch trending stocks
      const trendingRes = await fetch(`${API_URL}/stocks/trending`);
      const trendingData = await trendingRes.json();
      setTrending(trendingData.slice(0, 5));
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning,</Text>
        <Text style={styles.title}>StockWise Pro</Text>
      </View>

      {/* Market Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Market Overview</Text>
        <View style={styles.indicesContainer}>
          {indices.map((index) => (
            <TouchableOpacity
              key={index.symbol}
              style={styles.indexCard}
              onPress={() => navigation.navigate('StockDetail', { ticker: index.symbol })}
            >
              <Text style={styles.indexName}>{index.name}</Text>
              <Text style={styles.indexPrice}>{formatCurrency(index.price)}</Text>
              <Text
                style={[
                  styles.indexChange,
                  { color: index.change >= 0 ? theme.green : theme.red },
                ]}
              >
                {formatPercentage(index.changesPercentage)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Trending Stocks */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending Now</Text>
        {trending.map((stock) => (
          <TouchableOpacity
            key={stock.symbol}
            style={styles.stockRow}
            onPress={() => navigation.navigate('StockDetail', { ticker: stock.symbol })}
          >
            <View style={styles.stockInfo}>
              <View style={styles.stockIcon}>
                <Text style={styles.stockIconText}>{stock.symbol[0]}</Text>
              </View>
              <View>
                <Text style={styles.stockSymbol}>{stock.symbol}</Text>
                <Text style={styles.stockName} numberOfLines={1}>
                  {stock.name}
                </Text>
              </View>
            </View>
            <View style={styles.stockPrice}>
              <Text style={styles.priceText}>{formatCurrency(stock.price)}</Text>
              <Text
                style={[
                  styles.changeText,
                  { color: stock.change >= 0 ? theme.green : theme.red },
                ]}
              >
                {formatPercentage(stock.changesPercentage)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Screener')}
          >
            <Ionicons name="search" size={24} color={theme.gold} />
            <Text style={styles.actionText}>Screener</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Watchlist')}
          >
            <Ionicons name="eye" size={24} color={theme.gold} />
            <Text style={styles.actionText}>Watchlist</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Portfolio')}
          >
            <Ionicons name="pie-chart" size={24} color={theme.gold} />
            <Text style={styles.actionText}>Portfolio</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  greeting: {
    color: theme.textSecondary,
    fontSize: 16,
  },
  title: {
    color: theme.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  indicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  indexCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    width: (screenWidth - 52) / 2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  indexName: {
    color: theme.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  indexPrice: {
    color: theme.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  indexChange: {
    fontSize: 14,
    marginTop: 4,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stockIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: `${theme.gold}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stockIconText: {
    color: theme.gold,
    fontSize: 16,
    fontWeight: 'bold',
  },
  stockSymbol: {
    color: theme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  stockName: {
    color: theme.textSecondary,
    fontSize: 12,
    maxWidth: 150,
  },
  stockPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  changeText: {
    fontSize: 14,
    marginTop: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  actionText: {
    color: theme.text,
    marginTop: 8,
    fontSize: 12,
  },
});
