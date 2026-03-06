import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

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

export default function ProfileScreen({ navigation }: any) {
  const { user, isAuthenticated, logout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.navigate('Auth');
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      section: 'Account',
      items: [
        { icon: 'person-outline', label: 'Edit Profile', action: () => {} },
        { icon: 'shield-checkmark-outline', label: 'Security', action: () => {} },
        { icon: 'card-outline', label: 'Subscription', action: () => {} },
      ],
    },
    {
      section: 'Preferences',
      items: [
        { icon: 'notifications-outline', label: 'Notifications', toggle: true, value: notifications, onToggle: setNotifications },
        { icon: 'alert-circle-outline', label: 'Price Alerts', toggle: true, value: priceAlerts, onToggle: setPriceAlerts },
        { icon: 'moon-outline', label: 'Dark Mode', toggle: true, value: darkMode, onToggle: setDarkMode },
      ],
    },
    {
      section: 'Support',
      items: [
        { icon: 'help-circle-outline', label: 'Help Center', action: () => {} },
        { icon: 'chatbubble-outline', label: 'Contact Support', action: () => {} },
        { icon: 'document-text-outline', label: 'Terms of Service', action: () => {} },
        { icon: 'lock-closed-outline', label: 'Privacy Policy', action: () => {} },
      ],
    },
  ];

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>
        <View style={styles.guestContainer}>
          <View style={styles.guestIcon}>
            <Ionicons name="person" size={48} color={theme.gold} />
          </View>
          <Text style={styles.guestTitle}>Guest User</Text>
          <Text style={styles.guestSubtitle}>
            Sign in to access all features and sync your data
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>{user?.plan || 'FREE'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.editButton}>
          <Ionicons name="create-outline" size={20} color={theme.gold} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Watchlist</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>5</Text>
          <Text style={styles.statLabel}>Holdings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>8</Text>
          <Text style={styles.statLabel}>Alerts</Text>
        </View>
      </View>

      {/* Menu Sections */}
      {menuItems.map((section, sectionIndex) => (
        <View key={section.section} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.section}</Text>
          <View style={styles.sectionCard}>
            {section.items.map((item, itemIndex) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.menuItem,
                  itemIndex === section.items.length - 1 && styles.menuItemLast,
                ]}
                onPress={item.action}
                disabled={item.toggle}
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons name={item.icon as any} size={22} color={theme.gold} />
                  <Text style={styles.menuItemText}>{item.label}</Text>
                </View>
                {item.toggle ? (
                  <Switch
                    value={item.value}
                    onValueChange={item.onToggle}
                    trackColor={{ false: theme.border, true: `${theme.gold}50` }}
                    thumbColor={item.value ? theme.gold : theme.textSecondary}
                  />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appVersion}>StockWise Pro v1.0.0</Text>
        <Text style={styles.appBuild}>Build 2024.03.07</Text>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color={theme.red} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
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
  title: {
    color: theme.text,
    fontSize: 28,
    fontWeight: 'bold',
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  guestIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${theme.gold}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  guestTitle: {
    color: theme.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  guestSubtitle: {
    color: theme.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  signInButton: {
    backgroundColor: theme.gold,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
  },
  signInButtonText: {
    color: theme.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: theme.background,
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    color: theme.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileEmail: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  planBadge: {
    backgroundColor: `${theme.gold}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  planText: {
    color: theme.gold,
    fontSize: 12,
    fontWeight: 'bold',
  },
  editButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: theme.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.border,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    color: theme.text,
    fontSize: 16,
    marginLeft: 12,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 32,
  },
  appVersion: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  appBuild: {
    color: theme.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.red}15`,
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  logoutText: {
    color: theme.red,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 40,
  },
});
