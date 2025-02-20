import React, { useState, useEffect, useMemo } from "react";
import { format, startOfDay, endOfDay } from "date-fns";
import supabase from "../hooks/supabase";
import { Search, Calendar, Mail, Phone, Filter, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from '../contexts/LanguageContext';
import axios from "axios";
import { BACKEND_EMAIL_URL, FRONTEND_URL } from '../config/config';

// Badge Component
const Badge = ({ children, className, ...props }) => {
  return (
    <div
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// Button Component
const Button = ({ children, variant = "default", className = "", ...props }) => {
  const variants = {
    default: "bg-accent text-white hover:bg-accentHover",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    success: "bg-green-600 text-white hover:bg-green-700",
    destructive: "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// Card Component
const Card = ({ children, className = "", ...props }) => {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// Enhanced Search Input Component
const SearchInput = ({ icon: Icon, placeholder, value, onChange, onClear }) => (
  <div className="relative">
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <Icon className="h-4 w-4 text-gray-400" />
    </div>
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="pl-10 pr-10 py-2 w-full border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accentHover"
    />
    {value && (
      <button
        onClick={onClear}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);

const Reservations = () => {
  const { translate } = useLanguage();
  const [activeTab, setActiveTab] = useState("pending");
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchParams, setSearchParams] = useState({
    email: "",
    phone: "",
    startDate: "",
    endDate: "",
  });
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const navigate = useNavigate();
  const [business, setBusiness] = useState(null);
  const [businessLanguage, setBusinessLanguage] = useState('bulgarian');

  // Get current business from localStorage with safety check
  const selectedBusiness = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("selectedBusiness")) || {};
    } catch {
      console.error("Invalid business data in localStorage");
      return {};
    }
  }, []);

  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        if (selectedBusiness?.id) {
          const { data, error } = await supabase
            .from("Business")
            .select("*, themeData, language")
            .eq("id", selectedBusiness.id)
            .single();

          if (error) throw error;
          setBusiness(data);
          setBusinessLanguage(data.language || 'english');
        }
      } catch (err) {
        console.error("Error fetching business data:", err);
      }
    };

    fetchBusinessData();
  }, [selectedBusiness?.id]);

  useEffect(() => {
    // First, get the current user
    const getCurrentUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log("Session:", session); // Debug log
        if (session?.user) {
          setCurrentUser(session.user.id);
          if (selectedBusiness?.id) {
            fetchReservations();
          }
        } else {
          setError("Please sign in to view reservations");
          setLoading(false);
        }
      } catch (error) {
        console.error("Error getting current user:", error);
        setError("Authentication error");
        setLoading(false);
      }
    };

    getCurrentUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth state changed:", session); // Debug log
      setCurrentUser(session?.user.id || null);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    console.log("Current user:", currentUser); // Debug log
    console.log("Current business:", selectedBusiness.id); // Debug log
    if (currentUser && selectedBusiness?.id) {
      fetchReservations();
    }
  }, [activeTab, currentUser]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("Reservations")
        .select(`
          *,
          BusinessTeam (
            id,
            worktime,
            bufferTime,
            Users (
              first_name,
              last_name
            )
          )
        `)
        .eq("businessId", selectedBusiness.id)
        .eq("status", activeTab);

      // Apply filters
      if (searchParams.email) {
        query = query.ilike("email", `%${searchParams.email}%`);
      }
      if (searchParams.phone) {
        query = query.ilike("phoneNumber", `%${searchParams.phone}%`);
      }
      if (searchParams.startDate) {
        query = query.gte("reservationAt", searchParams.startDate);
      }
      if (searchParams.endDate) {
        query = query.lte("reservationAt", searchParams.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter out past reservations if showPast is false
      const now = new Date();
      const filteredData = showPast ? data : data.filter(reservation => new Date(reservation.reservationAt) >= now);
      
      setReservations(filteredData || []);
    } catch (error) {
      console.error("Error fetching reservations:", error);
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
            reminderId: reminderResponse.data.reminderId,
            reminderDate: reminderResponse.data.reminderDate
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

      // Refresh reservations after status update
      fetchReservations();
    } catch (error) {
      console.error("Error updating reservation status:", error);
      setError(error.message);
    }
  };

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  // Function to clear all filters
  const clearFilters = () => {
    setSearchParams({
      email: "",
      phone: "",
      startDate: "",
      endDate: "",
    });
    fetchReservations();
  };

  // Function to apply filters
  const applyFilters = () => {
    fetchReservations();
    setIsFilterVisible(false);
    setCurrentPage(1);
  };

  // Function to handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Calculate the current items to display based on pagination
  const indexOfLastReservation = currentPage * itemsPerPage;
  const indexOfFirstReservation = indexOfLastReservation - itemsPerPage;
  const currentReservations = reservations.slice(indexOfFirstReservation, indexOfLastReservation);

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-red-50 rounded-lg">
          <p className="text-red-600">{error}</p>
          {error === "No business selected" && (
            <p className="text-gray-500 mt-2">Please select a business to view reservations.</p>
          )}
          {error === "Not authenticated" && (
            <p className="text-gray-500 mt-2">Please sign in to view reservations.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {translate('reservations')}
        </h1>
      </div>

      {/* Header */}
      <div className="mb-8 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-900">
            {translate('reservations')} for {selectedBusiness.name}
          </h2>
          <Button
            variant="outline"
            onClick={() => setIsFilterVisible(!isFilterVisible)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            {isFilterVisible ? translate('hideFilters') : translate('showFilters')}
          </Button>
        </div>

        {/* Search Filters */}
        {isFilterVisible && (
          <div className="bg-white p-6 rounded-lg shadow-md border">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Email Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{translate('email')}</label>
                <SearchInput
                  icon={Mail}
                  placeholder={translate('searchReservations')}
                  value={searchParams.email}
                  onChange={(value) => setSearchParams(prev => ({ ...prev, email: value }))}
                  onClear={() => setSearchParams(prev => ({ ...prev, email: "" }))}
                />
              </div>

              {/* Phone Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{translate('phone')}</label>
                <SearchInput
                  icon={Phone}
                  placeholder={translate('searchReservations')}
                  value={searchParams.phone}
                  onChange={(value) => setSearchParams(prev => ({ ...prev, phone: value }))}
                  onClear={() => setSearchParams(prev => ({ ...prev, phone: "" }))}
                />
              </div>

              {/* Date Range */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">{translate('dateRange')}</label>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      value={searchParams.startDate}
                      onChange={(e) => setSearchParams(prev => ({ ...prev, startDate: e.target.value }))}
                      className="pl-10 w-full border rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <span className="text-gray-500">{translate('to')}</span>
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      value={searchParams.endDate}
                      onChange={(e) => setSearchParams(prev => ({ ...prev, endDate: e.target.value }))}
                      className="pl-10 w-full border rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
              </div>

              {/* Toggle for showing past reservations */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={showPast}
                  onChange={() => setShowPast(!showPast)}
                  className="mr-2"
                />
                <label>{translate('showPastReservations')}</label>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="mt-6 flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                {translate('clearFilters')}
              </Button>
              <Button
                onClick={applyFilters}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                {translate('applyFilters')}
              </Button>
            </div>
          </div>
        )}

        {/* Status Tabs */}
        <div className="flex gap-4 pt-4">
          {["pending", "approved", "cancelled"].map((status) => (
            <Button
              key={status}
              variant={activeTab === status ? "default" : "outline"}
              onClick={() => setActiveTab(status)}
              className={`capitalize ${
                activeTab === status 
                  ? 'ring-2 ring-offset-2 ring-accent' 
                  : 'hover:bg-gray-50'
              }`}
            >
              {translate(status.toLowerCase())}
            </Button>
          ))}
        </div>
      </div>

      {/* Active Filters Summary */}
      {(searchParams.email || searchParams.phone || searchParams.startDate || searchParams.endDate) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {searchParams.email && (
            <Badge variant="outline" className="flex items-center gap-2">
              <Mail className="h-3 w-3" />
              {translate('email')}: {searchParams.email}
              <button onClick={() => setSearchParams(prev => ({ ...prev, email: "" }))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {searchParams.phone && (
            <Badge variant="outline" className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              {translate('phone')}: {searchParams.phone}
              <button onClick={() => setSearchParams(prev => ({ ...prev, phone: "" }))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(searchParams.startDate || searchParams.endDate) && (
            <Badge variant="outline" className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              {translate('dateRange')}: {searchParams.startDate || translate('start')} - {searchParams.endDate || translate('end')}
              <button onClick={() => setSearchParams(prev => ({ ...prev, startDate: "", endDate: "" }))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Reservations Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : currentReservations.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {currentReservations.map((reservation) => (
            <Card key={reservation.id} className="overflow-hidden">
              {/* Reservation Status Badge */}
              <div className="p-4 border-b bg-gray-50">
                <Badge className={statusColors[reservation.status]}>
                  {translate(reservation.status.toLowerCase())}
                </Badge>
                <p className="mt-2 text-sm text-gray-600">
                  {translate('reservedFor')}: {format(new Date(reservation.reservationAt), "PPp")}
                </p>
              </div>

              {/* Reservation Details */}
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="font-medium text-lg">
                    {reservation.firstName} {reservation.lastName}
                  </h3>
                  <p className="text-sm text-gray-600">{reservation.email}</p>
                  <p className="text-sm text-gray-600">{reservation.phoneNumber}</p>
                </div>

                {/* Employee Info */}
                <div className="text-sm">
                  <span className="font-medium">{translate('employee')}: </span>
                  {reservation.BusinessTeam?.Users ? 
                    `${reservation.BusinessTeam.Users.first_name} ${reservation.BusinessTeam.Users.last_name}` : 
                    translate('notAssigned')
                  }
                </div>

                {/* Services List */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">{translate('services')}:</h4>
                  <div className="bg-gray-50 rounded-md p-3">
                    {Array.isArray(reservation.services) && reservation.services.map((service, index) => (
                      <div key={index} className="text-sm py-1">
                        {service}
                      </div>
                    ))}
                    <div className="border-t mt-2 pt-2 flex justify-between font-medium">
                      <span>{translate('totalPrice')}</span>
                      <span>{reservation.totalPrice?.toFixed(2) || '0.00'} лв.</span>
                    </div>
                  </div>
                </div>

                {/* Duration */}
                <div className="text-sm">
                  <span className="font-medium">{translate('duration')}: </span>
                  {reservation.timeToMake} {translate('minutes')}
                </div>

                {/* Action Buttons */}
                {activeTab === "pending" && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="success"
                      onClick={() => handleStatusUpdate(reservation.id, "approved")}
                      className="flex-1"
                    >
                      {translate('accept')}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleStatusUpdate(reservation.id, "cancelled")}
                      className="flex-1"
                    >
                      {translate('reject')}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <svg 
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="1.5" 
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="mt-4 text-lg font-medium text-gray-900">
            {translate('noReservationsFound')}
          </p>
          <p className="mt-1 text-gray-500">
            {activeTab === "pending" && translate('noPendingReservationsMessage')}
            {activeTab === "approved" && translate('noApprovedReservationsMessage')}
            {activeTab === "cancelled" && translate('noCancelledReservationsMessage')}
          </p>
          {/* Show filters hint if filters are active */}
          {(searchParams.email || searchParams.phone || searchParams.startDate || searchParams.endDate) && (
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="inline-flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                {translate('clearFilters')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex justify-center mt-4">
        {Array.from({ length: Math.ceil(reservations.length / itemsPerPage) }, (_, index) => (
          <Button
            key={index + 1}
            variant={currentPage === index + 1 ? "default" : "outline"}
            onClick={() => handlePageChange(index + 1)}
            className="mx-1"
          >
            {index + 1}
          </Button>
        ))}
      </div>

      {error && (
        <div className="text-center py-4 mt-4 bg-red-50 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
};

export default Reservations;
