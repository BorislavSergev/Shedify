import React, { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import supabase from "../hooks/supabase";
import { format, isToday, isTomorrow, isThisWeek, isThisMonth } from "date-fns";
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';

import { BACKEND_EMAIL_URL, FRONTEND_URL } from '../config/config';

const Dashboard = () => {
  const { translate } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    pendingReservations: {
      today: [],
      upcoming: [],
      past: []
    },
    acceptedReservations: {
      today: [],
      tomorrow: [],
      thisWeek: [],
      thisMonth: []
    },
    totalTeamMembers: 0,
    totalOffers: 0,
    recentReservations: [],
    todayEarnings: 0,
    totalTeamMemberReservations: 0,
    totalBusinessReservations: 0
  });

  const [todayEarnings, setTodayEarnings] = useState(0);

  const selectedBusiness = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("selectedBusiness")) || {};
    } catch (error) {
      console.error("Invalid business data in local storage", error);
      return {};
    }
  }, []);

  const [authenticatedUserId, setAuthenticatedUserId] = useState(null);

  const [expandedSections, setExpandedSections] = useState({
    today: true,
    tomorrow: true,
    thisWeek: false,
    thisMonth: false,
    pendingToday: true,
    pendingUpcoming: true,
    pendingPast: true
  });

  const [selectedRevenuePeriod, setSelectedRevenuePeriod] = useState('today');
  const [customDateRange, setCustomDateRange] = useState({
    start: null,
    end: null
  });

  const [searchParams] = useSearchParams();

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching user:", error);
      } else {
        setAuthenticatedUserId(user?.id);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    if (selectedBusiness?.id && authenticatedUserId) {
      fetchDashboardData();
    }
  }, [selectedBusiness?.id, authenticatedUserId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      // Step 1: Fetch the employeeId
      const { data: businessTeam, error: businessTeamError } = await supabase
        .from('BusinessTeam')
        .select('id')
        .eq('businessId', selectedBusiness.id)
        .eq('userId', authenticatedUserId)
        .single();

      if (businessTeamError) throw businessTeamError;

      const employeeId = businessTeam?.id;
      if (!employeeId) {
        throw new Error('Employee ID not found');
      }

      // Fetch total reservations for team member
      const { data: teamMemberReservations, error: teamMemberReservationsError } = await supabase
        .from('Reservations')
        .select('id')
        .eq('employeeId', employeeId);

      if (teamMemberReservationsError) throw teamMemberReservationsError;

      // Fetch total reservations for business
      const { data: businessReservations, error: businessReservationsError } = await supabase
        .from('Reservations')
        .select('id')
        .eq('businessId', selectedBusiness.id);

      if (businessReservationsError) throw businessReservationsError;

      // Step 2: Fetch reservations
      const { data: reservations, error: reservationsError } = await supabase
        .from('Reservations')
        .select(`
          *,
          BusinessTeam (
            Users (
              first_name,
              last_name
            )
          )
        `)
        .eq('businessId', selectedBusiness.id)
        .eq('employeeId', employeeId);

      if (reservationsError) throw reservationsError;

      // Step 3: Fetch services
      // Step 4: Fetch offers
      const { data: offers, error: offersError } = await supabase
        .from('Offers')
        .select('id')
        .eq('team_member_id', employeeId);

      if (offersError) throw offersError;

      // Step 5: Fetch team members
      const { data: teamMembers, error: teamMembersError } = await supabase
        .from('BusinessTeam')
        .select('id')
        .eq('businessId', selectedBusiness.id);

      if (teamMembersError) throw teamMembersError;

      // Calculate today's earnings
      const todayReservations = reservations.filter(reservation => {
        const reservationDate = new Date(reservation.reservationAt);
        return reservationDate >= startOfToday && reservationDate <= endOfToday;
      });

      const totalEarnings = todayReservations.reduce((acc, reservation) => 
        acc + (reservation.totalPrice || 0), 0);
      setTodayEarnings(totalEarnings);

      // Updated reservation organization
      const currentDate = new Date();
      const organizedReservations = {
        pending: {
          today: [],
          upcoming: [],
          past: []
        },
        accepted: {
          today: [],
          tomorrow: [],
          thisWeek: [],
          thisMonth: []
        }
      };

      reservations.forEach(reservation => {
        const reservationDate = new Date(reservation.reservationAt);
        
        if (reservation.status === 'pending') {
          if (isToday(reservationDate)) {
            organizedReservations.pending.today.push(reservation);
          } else if (reservationDate > currentDate) {
            organizedReservations.pending.upcoming.push(reservation);
          } else {
            organizedReservations.pending.past.push(reservation);
          }
        } else if (reservation.status === 'approved') {
          if (isToday(reservationDate)) {
            organizedReservations.accepted.today.push(reservation);
          } else if (isTomorrow(reservationDate)) {
            organizedReservations.accepted.tomorrow.push(reservation);
          } else if (isThisWeek(reservationDate) && !isToday(reservationDate) && !isTomorrow(reservationDate)) {
            organizedReservations.accepted.thisWeek.push(reservation);
          } else if (isThisMonth(reservationDate) && !isThisWeek(reservationDate)) {
            organizedReservations.accepted.thisMonth.push(reservation);
          }
        }
      });

      // Sort all reservation arrays by date
      Object.keys(organizedReservations).forEach(status => {
        Object.keys(organizedReservations[status]).forEach(timeframe => {
          organizedReservations[status][timeframe].sort((a, b) => 
            new Date(a.reservationAt) - new Date(b.reservationAt)
          );
        });
      });

      setStats({
        pendingReservations: organizedReservations.pending,
        acceptedReservations: organizedReservations.accepted,
        totalTeamMembers: teamMembers?.length || 0,
        totalOffers: offers?.length || 0,
        recentReservations: reservations.slice(-7) || [],
        todayEarnings: totalEarnings,
        totalTeamMemberReservations: teamMemberReservations?.length || 0,
        totalBusinessReservations: businessReservations?.length || 0
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (reservationId, newStatus) => {
    try {
      // First update the status in Supabase
      const { error } = await supabase
        .from("Reservations")
        .update({ status: newStatus })
        .eq("id", reservationId);

      if (error) throw error;

      // Get the reservation details
      const { data: reservation } = await supabase
        .from("Reservations")
        .select(`
          *,
          BusinessTeam (
            Users (
              first_name,
              last_name
            )
          )
        `)
        .eq("id", reservationId)
        .single();

      // Format date and time
      const date = format(new Date(reservation.reservationAt), "dd/MM/yyyy");
      const hour = format(new Date(reservation.reservationAt), "HH:mm");

      // Send email notification based on status
      if (newStatus === 'approved') {
        // Send acceptance email
        await axios.post(`${BACKEND_EMAIL_URL}/accepted-reservation`, {
          name: `${reservation.firstName} ${reservation.lastName}`,
          business: selectedBusiness.name,
          email: reservation.email,
          date,
          hour,
          services: reservation.services
        });

        // Schedule reminder email
        const reminderResponse = await axios.post(`${BACKEND_EMAIL_URL}/schedule-reminder`, {
          name: `${reservation.firstName} ${reservation.lastName}`,
          business: selectedBusiness.name,
          email: reservation.email,
          date,
          hour,
          services: reservation.services
        });

        // Update reservation with reminderId
        const { error: updateError } = await supabase
          .from("Reservations")
          .update({ 
            reminderId: reminderResponse.id
          })
          .eq("id", reservationId);

        if (updateError) throw updateError;

      } else if (newStatus === 'cancelled') {
        await axios.post(`${BACKEND_EMAIL_URL}/rejected-reservation`, {
          name: `${reservation.firstName} ${reservation.lastName}`,
          business: selectedBusiness.name,
          email: reservation.email,
          reason: "Съжаляваме, но резервацията Ви беше отказана."
        });
      }

      fetchDashboardData();
    } catch (error) {
      console.error("Error updating reservation status:", error);
      setError(error.message);
    }
  };

  const calculateReservationTrend = () => {
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000));
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Get all reservations
    const allReservations = [
      ...Object.values(stats.pendingReservations).flat(),
      ...Object.values(stats.acceptedReservations).flat()
    ];

    // Calculate scores for recent and previous periods
    const calculatePeriodScore = (startDate, endDate) => {
      return allReservations
        .filter(r => {
          const reservationDate = new Date(r.reservationAt);
          return reservationDate >= startDate && reservationDate <= endDate;
        })
        .reduce((score, reservation) => {
          // Enhanced weight system for different statuses
          const weights = {
            approved: 2.0,    // Highest positive impact
            completed: 2.0,   // Same as approved
            pending: 0.5,     // Small positive impact
            cancelled: -1.0,  // Significant negative impact
            rejected: -1.0,   // Same as cancelled
            noShow: -1.5     // Highest negative impact
          };

          return score + (weights[reservation.status] || 0);
        }, 0);
    };

    // Calculate scores for both periods
    const recentScore = calculatePeriodScore(fifteenDaysAgo, now);
    const previousScore = calculatePeriodScore(thirtyDaysAgo, fifteenDaysAgo);

    // Count total reservations for each period
    const recentTotal = allReservations.filter(r => {
      const reservationDate = new Date(r.reservationAt);
      return reservationDate >= fifteenDaysAgo && reservationDate <= now;
    }).length;

    const previousTotal = allReservations.filter(r => {
      const reservationDate = new Date(r.reservationAt);
      return reservationDate >= thirtyDaysAgo && reservationDate < fifteenDaysAgo;
    }).length;

    // Calculate percentage change with improved handling of edge cases
    let percentageChange = 0;
    let trendDirection = 'neutral';

    if (previousScore === 0) {
      if (recentScore > 0) {
        percentageChange = 100;
        trendDirection = 'up';
      } else if (recentScore < 0) {
        percentageChange = -100;
        trendDirection = 'down';
      }
    } else {
      percentageChange = ((recentScore - previousScore) / Math.abs(previousScore)) * 100;
      
      // Add threshold for neutral trend (e.g., changes less than 5%)
      if (Math.abs(percentageChange) < 5) {
        trendDirection = 'neutral';
      } else {
        trendDirection = percentageChange > 0 ? 'up' : 'down';
      }
    }

    // Cap percentage change at reasonable limits
    percentageChange = Math.min(Math.max(percentageChange, -100), 100);

    return {
      percentage: Math.abs(Math.round(percentageChange)),
      direction: trendDirection,
      recentCount: recentTotal,
      olderCount: previousTotal,
      recentScore: Math.round(recentScore * 10) / 10,
      previousScore: Math.round(previousScore * 10) / 10
    };
  };

  const calculateRevenue = (period) => {
    const now = new Date();
    let startDate;
    let endDate = new Date(now.setHours(23, 59, 59, 999));

    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          startDate = new Date(customDateRange.start);
          endDate = new Date(customDateRange.end);
        }
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    // Filter only approved reservations
    const approvedReservations = Object.values(stats.acceptedReservations)
      .flat()
      .filter(reservation => reservation.status === 'approved');
    
    // Calculate revenue for the selected period
    const revenue = approvedReservations
      .filter(reservation => {
        const reservationDate = new Date(reservation.reservationAt);
        return reservationDate >= startDate && reservationDate <= endDate;
      })
      .reduce((total, reservation) => total + (reservation.totalPrice || 0), 0);

    return revenue;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-600 mb-4">Error loading dashboard data</div>
        <div className="text-gray-600">{error}</div>
      </div>
    );
  }

  const reservationTrend = calculateReservationTrend();

  return (
    <div className="p-6 space-y-6 bg-background">
      <h1 className="text-3xl font-bold text-gray-900">{translate('dashboard')}</h1>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Today's Earnings Card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-600">{translate("todayEarnings")}</h3>
            <span className="text-gray-600">💰</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{calculateRevenue('today').toFixed(2)} лв.</p>
        </div>

        {/* Team Members Card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-600">{translate("totalTeamMembers")}</h3>
            <span className="text-gray-600">👥</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalTeamMembers || 0}</p>
        </div>

        {/* Services Card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-600">{translate("services")}</h3>
            <span className="text-gray-600">📋</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalServices || 0}</p>
        </div>

        {/* Offers Card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-600">{translate("activeOffers")}</h3>
            <span className="text-gray-600">🏷️</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalOffers || 0}</p>
        </div>

        {/* Total Team Member Reservations Card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-600">{translate("myTotalReservations")}</h3>
            <span className="text-gray-600">📊</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalTeamMemberReservations || 0}</p>
        </div>

        {/* Total Business Reservations Card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-600">{translate("businessTotalReservations")}</h3>
            <span className="text-gray-600">📈</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalBusinessReservations || 0}</p>
        </div>

        {/* Reservation Trend Card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-600">{translate("reservationTrend")}</h3>
            <span className="text-gray-600">{reservationTrend.direction === 'up' ? "📈" : reservationTrend.direction === 'down' ? "📉" : "→"}</span>
          </div>
          <div className="flex items-center">
            <span className={`text-2xl font-bold mr-2 ${
              reservationTrend.direction === 'up' 
                ? 'text-green-600' 
                : reservationTrend.direction === 'down' 
                  ? 'text-red-600' 
                  : 'text-gray-600'
            }`}>
              {reservationTrend.percentage}%
              {reservationTrend.direction === 'up' && ' ↑'}
              {reservationTrend.direction === 'down' && ' ↓'}
              {reservationTrend.direction === 'neutral' && ' →'}
            </span>
            <span className="text-sm text-gray-500">
              {translate("last15DaysVsPrevious")}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            <div>
              {translate("recent")}: {reservationTrend.recentCount} 
              <span className="text-xs ml-1">({translate("score")}: {reservationTrend.recentScore})</span>
            </div>
            <div>
              {translate("previous")}: {reservationTrend.olderCount}
              <span className="text-xs ml-1">({translate("score")}: {reservationTrend.previousScore})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accepted Reservations Calendar View */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {translate("upcomingAcceptedReservations")} 
              ({stats.acceptedReservations.today.length + 
                stats.acceptedReservations.tomorrow.length + 
                stats.acceptedReservations.thisWeek.length + 
                stats.acceptedReservations.thisMonth.length})
            </h2>
            <Link to="/dashboard/reservations" className="text-sm text-accent hover:underline">
              {translate("viewCalendar")}
            </Link>
          </div>
        </div>

        <div className="p-6">
          {/* Today's Accepted */}
          {stats.acceptedReservations.today.length > 0 && (
            <div className="mb-6">
              <button 
                onClick={() => toggleSection('today')}
                className="w-full flex justify-between items-center text-lg font-medium text-gray-900 mb-3 hover:text-accent"
              >
                <span>{translate("today")} ({stats.acceptedReservations.today.length})</span>
                <span className="transform transition-transform duration-200">
                  {expandedSections.today ? '↑' : '↓'}
                </span>
              </button>
              {expandedSections.today && (
                <div className="space-y-3">
                  {stats.acceptedReservations.today.map(reservation => (
                    <AcceptedReservationCard key={reservation.id} reservation={reservation} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tomorrow's Accepted */}
          {stats.acceptedReservations.tomorrow.length > 0 && (
            <div className="mb-6">
              <button 
                onClick={() => toggleSection('tomorrow')}
                className="w-full flex justify-between items-center text-lg font-medium text-gray-900 mb-3 hover:text-accent"
              >
                <span>{translate("tomorrow")} ({stats.acceptedReservations.tomorrow.length})</span>
                <span className="transform transition-transform duration-200">
                  {expandedSections.tomorrow ? '↑' : '↓'}
                </span>
              </button>
              {expandedSections.tomorrow && (
                <div className="space-y-3">
                  {stats.acceptedReservations.tomorrow.map(reservation => (
                    <AcceptedReservationCard key={reservation.id} reservation={reservation} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* This Week's Accepted */}
          {stats.acceptedReservations.thisWeek.length > 0 && (
            <div className="mb-6">
              <button 
                onClick={() => toggleSection('thisWeek')}
                className="w-full flex justify-between items-center text-lg font-medium text-gray-900 mb-3 hover:text-accent"
              >
                <span>{translate("thisWeek")} ({stats.acceptedReservations.thisWeek.length})</span>
                <span className="transform transition-transform duration-200">
                  {expandedSections.thisWeek ? '↑' : '↓'}
                </span>
              </button>
              {expandedSections.thisWeek && (
                <div className="space-y-3">
                  {stats.acceptedReservations.thisWeek.map(reservation => (
                    <AcceptedReservationCard key={reservation.id} reservation={reservation} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* This Month's Accepted */}
          {stats.acceptedReservations.thisMonth.length > 0 && (
            <div>
              <button 
                onClick={() => toggleSection('thisMonth')}
                className="w-full flex justify-between items-center text-lg font-medium text-gray-900 mb-3 hover:text-accent"
              >
                <span>{translate("thisMonth")} ({stats.acceptedReservations.thisMonth.length})</span>
                <span className="transform transition-transform duration-200">
                  {expandedSections.thisMonth ? '↑' : '↓'}
                </span>
              </button>
              {expandedSections.thisMonth && (
                <div className="space-y-3">
                  {stats.acceptedReservations.thisMonth.map(reservation => (
                    <AcceptedReservationCard key={reservation.id} reservation={reservation} />
                  ))}
                </div>
              )}
            </div>
          )}

          {Object.values(stats.acceptedReservations).every(arr => arr.length === 0) && (
            <p className="text-gray-500 text-center py-4">{translate("noUpcomingAcceptedReservations")}</p>
          )}
        </div>
      </div>

      {/* Pending Reservations Section */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {translate("pendingReservations")} 
              ({stats.pendingReservations.today.length + 
                stats.pendingReservations.upcoming.length + 
                stats.pendingReservations.past.length})
            </h2>
            <Link to="/dashboard/reservations" className="text-sm text-accent hover:underline">
              {translate("viewAll")}
            </Link>
          </div>
        </div>

        <div className="p-6">
          {/* Today's Pending */}
          {stats.pendingReservations.today.length > 0 && (
            <div className="mb-6">
              <button 
                onClick={() => toggleSection('pendingToday')}
                className="w-full flex justify-between items-center text-lg font-medium text-gray-900 mb-3 hover:text-accent"
              >
                <span>{translate("today")} ({stats.pendingReservations.today.length})</span>
                <span className="transform transition-transform duration-200">
                  {expandedSections.pendingToday ? '↑' : '↓'}
                </span>
              </button>
              {expandedSections.pendingToday && (
                <div className="space-y-4">
                  {stats.pendingReservations.today.map((reservation) => (
                    <ReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming Pending */}
          {stats.pendingReservations.upcoming.length > 0 && (
            <div className="mb-6">
              <button 
                onClick={() => toggleSection('pendingUpcoming')}
                className="w-full flex justify-between items-center text-lg font-medium text-gray-900 mb-3 hover:text-accent"
              >
                <span>{translate("upcomingReservations")} ({stats.pendingReservations.upcoming.length})</span>
                <span className="transform transition-transform duration-200">
                  {expandedSections.pendingUpcoming ? '↑' : '↓'}
                </span>
              </button>
              {expandedSections.pendingUpcoming && (
                <div className="space-y-4">
                  {stats.pendingReservations.upcoming.map((reservation) => (
                    <ReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Past Pending */}
          {stats.pendingReservations.past.length > 0 && (
            <div>
              <button 
                onClick={() => toggleSection('pendingPast')}
                className="w-full flex justify-between items-center text-lg font-medium text-gray-900 mb-3 hover:text-accent"
              >
                <span>{translate("pastReservations")} ({stats.pendingReservations.past.length})</span>
                <span className="transform transition-transform duration-200">
                  {expandedSections.pendingPast ? '↑' : '↓'}
                </span>
              </button>
              {expandedSections.pendingPast && (
                <div className="space-y-4">
                  {stats.pendingReservations.past.map((reservation) => (
                    <ReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {Object.values(stats.pendingReservations).every(arr => arr.length === 0) && (
            <p className="text-gray-500 text-center py-4">{translate("noPendingReservations")}</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{translate("revenue")}</h2>
          <div className="w-full sm:w-auto">
            <select
              className="w-full sm:w-auto px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              value={selectedRevenuePeriod}
              onChange={(e) => setSelectedRevenuePeriod(e.target.value)}
            >
              <option value="today">{translate("today")}</option>
              <option value="week">{translate("lastWeek")}</option>
              <option value="month">{translate("lastMonth")}</option>
              <option value="custom">{translate("customRange")}</option>
            </select>
          </div>
        </div>

        {selectedRevenuePeriod === 'custom' && (
          <div className="mb-4 flex flex-col sm:flex-row gap-4">
            <input
              type="date"
              className="w-full sm:w-auto px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              value={customDateRange.start || ''}
              onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
            <input
              type="date"
              className="w-full sm:w-auto px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              value={customDateRange.end || ''}
              onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
        )}

        <div className="mt-4">
          <div className="text-3xl font-bold text-gray-900">
            {calculateRevenue(selectedRevenuePeriod).toFixed(2)} лв.
          </div>
          
          <div className="mt-2 text-sm text-gray-500">
            {selectedRevenuePeriod === 'today' && translate("todayRevenue")}
            {selectedRevenuePeriod === 'week' && translate("lastWeekRevenue")}
            {selectedRevenuePeriod === 'month' && translate("lastMonthRevenue")}
            {selectedRevenuePeriod === 'custom' && translate("customRangeRevenue")}
          </div>
        </div>
      </div>
    </div>
  );
};

// Accepted Reservation Card Component
const AcceptedReservationCard = ({ reservation }) => {
  const { translate } = useLanguage();
  
  return (
    <div className="p-4 bg-green-50 rounded-lg border border-green-100 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-medium text-gray-900">
            {reservation.firstName} {reservation.lastName}
          </h3>
          <div className="text-sm text-gray-500 space-y-1 mt-1">
            <p className="flex items-center">
              <span className="mr-2">🕒</span>
              {format(new Date(reservation.reservationAt), "HH:mm")}
            </p>
            <p className="flex items-center">
              <span className="mr-2">⏱️</span>
              {reservation.timeToMake} {translate("minutes")}
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-sm font-medium text-gray-900">
            {reservation.BusinessTeam?.Users?.first_name} {reservation.BusinessTeam?.Users?.last_name}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {Array.isArray(reservation.services) ? reservation.services.join(", ") : reservation.services}
          </p>
          <p className="text-sm font-medium text-accent mt-1">
            {reservation.totalPrice?.toFixed(2)} лв.
          </p>
        </div>
      </div>
    </div>
  );
};

// Reservation Card Component
const ReservationCard = ({ reservation, onStatusUpdate }) => {
  const { translate } = useLanguage();
  
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-medium text-gray-900">
            {reservation.firstName} {reservation.lastName}
          </h3>
          <div className="text-sm text-gray-500 space-y-1 mt-1">
            <p className="flex items-center">
              <span className="mr-2">📅</span>
              {format(new Date(reservation.reservationAt), "PPp")}
            </p>
            <p className="flex items-center">
              <span className="mr-2">⏱️</span>
              {translate("duration")}: {reservation.timeToMake} {translate("minutes")}
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="mb-2">
            <p className="text-sm font-medium text-gray-900">
              {translate("assignedTo")}: {reservation.BusinessTeam?.Users?.first_name} {reservation.BusinessTeam?.Users?.last_name}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {Array.isArray(reservation.services) && reservation.services.join(", ")}
            </p>
          </div>
          <div className="flex gap-2 justify-start sm:justify-end">
            <button
              onClick={() => onStatusUpdate(reservation.id, 'approved')}
              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              {translate("accept")}
            </button>
            <button
              onClick={() => onStatusUpdate(reservation.id, 'cancelled')}
              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
            >
              {translate("decline")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;