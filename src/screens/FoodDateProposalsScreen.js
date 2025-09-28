import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../utils/supabase';
import DateProposalCard from '../components/DateProposalCard';

export default function FoodDateProposalsScreen({ navigation }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [partnersMap, setPartnersMap] = useState({});

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in');

      // Get all pending proposals where current user is the recipient
      const { data: proposalData, error: proposalsError } = await supabase
        .from('food_date_proposals')
        .select('*')
        .eq('proposed_to', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (proposalsError) throw proposalsError;

      if (!proposalData || proposalData.length === 0) {
        setProposals([]);
        setPartnersMap({});
        return;
      }

      // Get partner names for all proposals
      const partnerIds = proposalData.map(p => p.proposed_by);
      const { data: partnersData, error: partnersError } = await supabase
        .from('users_public')
        .select('user_id, name')
        .in('user_id', partnerIds);

      if (partnersError) throw partnersError;

      // Create partners map
      const partnersMapping = {};
      for (const partner of partnersData || []) {
        partnersMapping[partner.user_id] = partner.name || 'Someone';
      }

      setProposals(proposalData);
      setPartnersMap(partnersMapping);
    } catch (error) {
      console.error('Load proposals error:', error);
      Alert.alert('Error', error.message || 'Failed to load date proposals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const handleProposalUpdate = (proposalId, newStatus) => {
    // Remove the proposal from the list since it's no longer pending
    setProposals(prev => prev.filter(p => p.id !== proposalId));
  };

  const renderProposal = ({ item }) => (
    <DateProposalCard
      proposal={item}
      partnerName={partnersMap[item.proposed_by] || 'Someone'}
      onUpdate={handleProposalUpdate}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>🍽️</Text>
      <Text style={styles.emptyTitle}>No Date Invitations</Text>
      <Text style={styles.emptySubtitle}>
        When someone invites you to share a meal, you'll see their proposals here!
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Food Date Invitations</Text>
        <Text style={styles.headerSubtitle}>
          {proposals.length > 0
            ? `You have ${proposals.length} pending invitation${proposals.length !== 1 ? 's' : ''}`
            : 'No pending invitations'
          }
        </Text>
      </View>

      <FlatList
        data={proposals}
        renderItem={renderProposal}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadProposals} />
        }
        ListEmptyComponent={!loading ? renderEmptyState : null}
        contentContainerStyle={proposals.length === 0 ? styles.emptyContainer : null}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffb6c1',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
});