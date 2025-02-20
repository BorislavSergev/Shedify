import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaCut, FaUserTie, FaCalendarCheck } from "react-icons/fa";
import supabase from "../hooks/supabase";
import axios from 'axios';
import { useParams, useSearchParams } from "react-router-dom";
import { translations } from '../translations/translations';
import { BACKEND_EMAIL_URL, FRONTEND_URL } from '../config/config';

// ── HELPER FUNCTIONS ─────────────────────────────
// Convert a HH:MM string to minutes past midnight.
const timeStringToMinutes = (timeStr) => {
  const [hour, minute] = timeStr.split(":").map(Number);
  return hour * 60 + minute;
};

// Convert minutes past midnight to a HH:MM string.
const minutesToTimeString = (minutes) => {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

const getThemeColor = (color) => {
  const colorMap = {
    'red': 'red-600',
    'blue': 'blue-600',
    'green': 'green-600',
    'yellow': 'yellow-600',
    'purple': 'purple-600',
    'pink': 'pink-600',
    'indigo': 'indigo-600',
    // Add more color mappings as needed
  };
  
  return colorMap[color?.toLowerCase()] || 'indigo-600'; // default to indigo if no match
};

/**
 * computeSequentialAvailableSlots:
 *
 * Given a team member's worktime for a day, the total service time,
 * and a buffer time, this helper calculates sequential (non‑overlapping)
 * available appointment start times.
 *
 * For each work period, we sequentially generate slots by adding
 * (totalServiceTime + buffer) until the period end is reached.
 */
const computeSequentialAvailableSlots = (worktime, date, totalServiceTime, buffer) => {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  const periods = worktime?.[weekday] || [];
  let slots = [];
  periods.forEach(({ start, end }) => {
    let currentSlot = timeStringToMinutes(start);
    const periodEnd = timeStringToMinutes(end);
    while (currentSlot + totalServiceTime + buffer <= periodEnd) {
      slots.push(minutesToTimeString(currentSlot));
      currentSlot += totalServiceTime + buffer;
    }
  });
  return slots;
};

// Add this helper function at the top with other helpers
const generateUniqueId = () => {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000000);
  return `${random}`;
};

// Add this helper function to filter out current time slots
const filterTimeSlotsByCurrentTime = (slots, selectedDate) => {
  const now = new Date();
  const isToday = selectedDate.toDateString() === now.toDateString();
  
  if (!isToday) return slots;

  // Add buffer time (e.g., 1 hour) to current time
  const currentMinutes = now.getHours() * 60 + now.getMinutes() + 60; // +60 for 1 hour buffer

  return slots.filter(slot => {
    const [hours, minutes] = slot.split(':').map(Number);
    const slotMinutes = hours * 60 + minutes;
    return slotMinutes > currentMinutes;
  });
};

// Add this helper function to determine if a color is light or dark
const isLightColor = (hexColor) => {
  if (!hexColor) return false;
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
};

// Add this helper function near other helper functions at the top
const calculateTotalPrice = (services, isOfferBooking, currentOffer) => {
  // First calculate regular total
  const regularTotal = services.reduce((total, service) => total + (Number(service.price) || 0), 0);
  
  // If this is an offer booking, apply the discount
  if (isOfferBooking && currentOffer) {
    if (currentOffer.fixed_price) {
      // If there's a fixed price offer, use that
      return currentOffer.fixed_price;
    } else if (currentOffer.discount_percentage) {
      // Apply percentage discount
      const discount = (regularTotal * currentOffer.discount_percentage) / 100;
      return regularTotal - discount;
    }
  }
  
  return regularTotal;
};

// ── CUSTOM REACT-DATEPICKER COMPONENTS ─────────────────────────
// Custom calendar container for styling the calendar
const CustomCalendarContainer = ({ className, children }) => {
  return (
    <div className={`p-6 bg-white rounded-xl shadow-lg ${className}`}>
      {children}
    </div>
  );
};

// Add this helper function to convert hex to RGB with opacity
const getLighterShade = (hexColor, opacity = 0.15) => {
  if (!hexColor) return 'rgba(79, 70, 229, 0.15)'; // default indigo color
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Add this helper function for initials avatar
const getInitials = (firstName, lastName) => {
  const firstInitial = firstName?.charAt(0) || '';
  const lastInitial = lastName?.charAt(0) || '';
  return (firstInitial + lastInitial).toUpperCase();
};

// Add this date formatting helper function near the top of the file
const formatDate = (date, language) => {
  const locale = language.toLowerCase() === 'bulgarian' ? 'bg-BG' : 'en-US';
  return date.toLocaleDateString(locale, { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

// ── RESERVATION COMPONENT ─────────────────────────
const ReservationPage = () => {
  const { businessId } = useParams();
  // Steps:
  // 1 = Team Member Selection
  // 2 = Service Selection
  // 3 = Date & Time Slot Selection (Calendar + available slots)
  // 4 = Customer Information (first name, last name, phone, email)
  const [step, setStep] = useState(1);

  // Data fetched from Supabase.
  const [teamMembers, setTeamMembers] = useState([]);
  const [services, setServices] = useState([]); // Services for the selected team member.

  // User selections.
  const [selectedTeamMember, setSelectedTeamMember] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Customer information.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [BusinessName, setBusinessName] = useState("");

  // Get business data including theme
  const [themeData, setThemeData] = useState(null);

  // Add these state variables in the component
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationStatus, setConfirmationStatus] = useState('processing'); // 'processing', 'success', or 'error'

  // Add this near the top of the file with other state variables in ReservationPage component
  const [businessLanguage, setBusinessLanguage] = useState('english');

  // Add new state variables in ReservationPage component
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [currentOffer, setCurrentOffer] = useState(null);
  const [lastReservationDetails, setLastReservationDetails] = useState(null);

  // Add new state to track if we're booking from an offer
  const [isOfferBooking, setIsOfferBooking] = useState(false);

  // Add this new state variable near the other state declarations
  const [offerStartDate, setOfferStartDate] = useState(null);

  // Add these near your other state declarations
  const [searchParams] = useSearchParams();
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [originalReservation, setOriginalReservation] = useState(null);

  // Add this useEffect after your other useEffects
  useEffect(() => {
    const rescheduleId = searchParams.get('reschedule');
    if (rescheduleId) {
      setIsRescheduling(true);
      fetchOriginalReservation(rescheduleId);
    }
  }, [searchParams]);

  // Add this function with your other functions
  const fetchOriginalReservation = async (rescheduleId) => {
    try {
      const { data, error } = await supabase
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
        .eq('id', rescheduleId)
        .single();

      if (error) throw error;

      setOriginalReservation(data);
      // Pre-fill the form with existing data
      setSelectedTeamMember(data.businessTeamId);
      setSelectedServices(data.services);
      setFirstName(data.firstName);
      setLastName(data.lastName);
      setEmail(data.email);
      setPhoneNumber(data.phoneNumber);
      // Start at date/time selection step for rescheduling
      setStep(3);
    } catch (err) {
      console.error("Error fetching reservation:", err);
    }
  };

  // Replace the existing confirmAppointment function with this updated version
  const confirmAppointment = async () => {
    try {
      setShowConfirmationModal(true);
      setConfirmationStatus('processing');

      if (isRescheduling) {
        // Update existing reservation
        const { error: updateError } = await supabase
          .from("Reservations")
          .update({
            reservationAt: selectedDate.toISOString().split('T')[0] + ' ' + selectedSlot,
            updatedAt: new Date().toISOString()
          })
          .eq('id', originalReservation.id);

        if (updateError) throw updateError;

        setConfirmationStatus('success');
        
        // Reset form after 2 seconds
        setTimeout(() => {
          setShowConfirmationModal(false);
          // Redirect back to manage reservation page
          navigate(`/manage-reservation/${businessId}?id=${originalReservation.id}`);
        }, 2000);
        
      } else {
        // Regular booking flow
        const totalServiceTime = selectedServices.reduce(
          (total, service) => total + (Number(service.timetomake) || 30),
          0
        );
        
        // Calculate total price
        const totalPrice = calculateTotalPrice(selectedServices, isOfferBooking, currentOffer);

        const [hours, minutes] = selectedSlot.split(":").map(Number);
        const reservationDate = new Date(selectedDate);
        reservationDate.setHours(hours, minutes, 0, 0);
        const reservationAt = reservationDate.toISOString();

        // Generate reservation ID
        const reservationId = await generateUniqueId();

        // Create the reservation
        const { error: reservationError } = await supabase
          .from("Reservations")
          .insert({
            id: reservationId,
            businessId,
            employeeId: selectedTeamMember.id,
            reservationAt,
            services: selectedServices.map((s) => s.name),
            timeToMake: totalServiceTime,
            firstName,
            lastName,
            email,
            phoneNumber,
            status: "pending",
            isOfferBooking: isOfferBooking,
            totalPrice: totalPrice,
            ...(isOfferBooking && currentOffer ? {
              offerId: currentOffer.id,
              originalPrice: selectedServices.reduce((total, service) => total + (Number(service.price) || 0), 0),
              discountAmount: currentOffer.fixed_price ? 
                selectedServices.reduce((total, service) => total + (Number(service.price) || 0), 0) - currentOffer.fixed_price :
                (selectedServices.reduce((total, service) => total + (Number(service.price) || 0), 0) * currentOffer.discount_percentage) / 100
            } : {})
          });

        if (reservationError) throw reservationError;

        // Send email notification
        try {
          await axios.post(`${BACKEND_EMAIL_URL}/pending-reservation`, {
            name: `${firstName} ${lastName}`,
            business: BusinessName,
            link: `${FRONTEND_URL}/manage/reservation/${reservationId}`,
            email
          });
        } catch (error) {
          console.error("Email notification error:", error);
        }

        // Set success status first
        setConfirmationStatus('success');

        // After 1.5 seconds, check for offers ONLY if not booking through an offer
        setTimeout(async () => {
          // Close confirmation modal
          setShowConfirmationModal(false);

          if (!isOfferBooking) {
            // Check for offers only if this is not an offer booking
            const offer = await checkForOffers(selectedTeamMember.id, selectedServices);

            if (offer) {
              // Save reservation details
              setLastReservationDetails({
                firstName,
                lastName,
                email,
                phoneNumber,
                teamMember: selectedTeamMember,
                services: selectedServices,
                reservationDate: reservationDate
              });
              
              // Set current offer and show offer modal
              setCurrentOffer(offer);
              setShowOfferModal(true);
            } else {
              // If no offer, reset the form
              resetForm();
            }
          } else {
            // If this is an offer booking, just reset the form
            resetForm();
          }
        }, 1500);
      }
    } catch (error) {
      console.error("Error creating/updating reservation:", error);
      setConfirmationStatus('error');
    }
  };

  // Fetch business data including theme
  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        const { data, error } = await supabase
          .from("Business")
          .select("themeData, name, language")
          .eq("id", businessId)
          .single();

        if (error) throw error;
        setThemeData(data.themeData);
        setBusinessName(data.name);
        setBusinessLanguage(data.language || 'english');
      } catch (err) {
        console.error("Error fetching business data:", err);
      }
    };

    if (businessId) {
      fetchBusinessData();
    }
  }, [businessId]);

  // Add this after the fetchBusinessData useEffect
  // Dynamic theme styles with Tailwind classes
  const themeStyles = {
    accent: themeData?.general?.color ? 
      { backgroundColor: themeData.general.color } : 
      { backgroundColor: '#4F46E5' }, // default indigo
    accentHover: themeData?.general?.color ? 
      { backgroundColor: getLighterShade(themeData.general.color, 0.8) } : 
      { backgroundColor: '#4338CA' },
    borderAccent: themeData?.general?.color ? 
      { borderColor: themeData.general.color } : 
      { borderColor: '#4F46E5' },
    bgLighter: themeData?.general?.color ? 
      { backgroundColor: getLighterShade(themeData.general.color) } : 
      { backgroundColor: 'rgba(79, 70, 229, 0.15)' }
  };

  // ── FETCH TEAM MEMBERS ─────────────────────────
  useEffect(() => {
    if (!businessId) return;
    (async () => {
      const { data, error } = await supabase
        .from("BusinessTeam")
        .select(`
          id,
          businessId,
          userId,
          worktime,
          bufferTime,
          Users (
            id,
            first_name,
            last_name,
            avatar
          )
        `)
        .eq("businessId", businessId);

      if (error) {
        console.error("Error fetching team members:", error);
      } else {
        const validTeamMembers = data.filter(member => member.Users);
        setTeamMembers(validTeamMembers);
      }
    })();
  }, [businessId]);

  // ── FETCH SERVICES FOR SELECTED TEAM MEMBER ─────────────────
  useEffect(() => {
    if (!selectedTeamMember) return;
    (async () => {
      const { data, error } = await supabase
        .from("Services")
        .select("*")
        .eq("team_id", selectedTeamMember.id);
      if (error) {
        console.error("Error fetching services:", error);
      } else {
        setServices(data);
      }
    })();
  }, [selectedTeamMember]);

  // ── CALCULATE AVAILABLE TIME SLOTS & FILTER OUT CONFLICTS ─────────────────
  useEffect(() => {
    if (!selectedTeamMember || selectedServices.length === 0 || !selectedDate) return;

    // Calculate the total time required for the selected services.
    const totalServiceTime = selectedServices.reduce(
      (total, service) => total + (Number(service.timetomake) || 30),
      0
    );

    // Use a buffer time of 10 minutes (or use selectedTeamMember.bufferTime if available).
    const buffer = selectedTeamMember.bufferTime ? Number(selectedTeamMember.bufferTime) : 10;

    // Compute available slots based solely on worktime.
    const computedSlots = computeSequentialAvailableSlots(
      selectedTeamMember.worktime,
      selectedDate,
      totalServiceTime,
      buffer
    );

    // Define the boundaries for the selected day.
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch reservations for the selected day with status Waiting for approval or Approved.
    const fetchReservations = async () => {
      const { data, error } = await supabase
        .from("Reservations")
        .select("reservationAt, timeToMake")
        .eq("employeeId", selectedTeamMember.id)
        .in("status", ["pending", "approved"])
        .gte("reservationAt", startOfDay.toISOString())
        .lte("reservationAt", endOfDay.toISOString());

      if (error) {
        console.error("Error fetching reservations", error);
        setAvailableSlots(computedSlots);
      } else {
        // Define reserved intervals as [reservedStart, reservedStart + timeToMake + buffer)
        const reservedIntervals = data.map((r) => {
          const resDate = new Date(r.reservationAt);
          const reservedStart = resDate.getHours() * 60 + resDate.getMinutes();
          const reservedTime = Number(r.timeToMake);
          return [reservedStart, reservedStart + reservedTime + buffer];
        });

        // For a new appointment starting at "slot", define its interval as:
        // [slot, slot + totalServiceTime + buffer)
        const freeSlots = computedSlots.filter((slotStr) => {
          const slotMinutes = timeStringToMinutes(slotStr);
          const newStart = slotMinutes;
          const newEnd = slotMinutes + totalServiceTime + buffer;
          for (const [rStart, rEnd] of reservedIntervals) {
            if (newStart < rEnd && rStart < newEnd) {
              return false;
            }
          }
          return true;
        });

        // Filter slots by current time
        const timeFilteredSlots = filterTimeSlotsByCurrentTime(freeSlots, selectedDate);
        setAvailableSlots(timeFilteredSlots);
      }
    };

    fetchReservations();
  }, [selectedTeamMember, selectedServices, selectedDate]);

  // Update the useEffect to set initial date when entering step 3
  useEffect(() => {
    if (step === 3) {
      setSelectedDate(new Date());
    }
  }, [step]);

  // ── HANDLERS ─────────────────────────
  const handleTeamMemberSelect = (member) => {
    setSelectedTeamMember(member);
    setStep(2);
  };

  const handleServiceSelect = (service) => {
    setSelectedServices((prev) =>
      prev.some((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    setStep(4);
  };

  // Update translate function to use the imported translations
  const translate = (key) => {
    const lang = businessLanguage.toLowerCase() === 'bulgarian' ? 'bg' : 'en';
    return translations[lang][key] || key;
  };

  // Add this function to check for available offers
  const checkForOffers = async (teamMemberId, services) => {


    // First, get all offers for this team member without date filtering
    const { data: offers, error } = await supabase
      .from("Offers")
      .select(`
        *,
        Services!offers_service_fkey (
          id,
          name,
          price,
          timetomake
        )
      `)
      .eq("team_member_id", teamMemberId);

    if (error) {
      console.error("Error fetching offers:", error);
      return null;
    }


    if (offers && offers.length > 0) {
      // Check each offer's validity

      // Find valid offers
      const validOffers = offers.filter(offer => {
        const now = new Date();
        const startTime = new Date(offer.start_time);
        const endTime = new Date(offer.end_time);
        const isTimeValid = startTime <= now && now <= endTime;
        const hasMatchingService = services.some(service => service.id === offer.service_id);
        
        return isTimeValid && hasMatchingService;
      });


      if (validOffers.length > 0) {
        return validOffers[0]; // Return the first valid offer
      }
    }

    return null;
  };

  // Modify handleAcceptOffer function
  const handleAcceptOffer = async () => {
    setShowOfferModal(false);
    setShowConfirmationModal(true);
    setConfirmationStatus('processing');

    try {
      // Get the date from the first reservation
      const firstReservationDate = new Date(lastReservationDetails.reservationDate);
      
      // Set the start date for the offer booking
      setOfferStartDate(firstReservationDate);
      
      // Reset to date/time selection step
      setStep(3);
      setIsOfferBooking(true);
      
      // Pre-fill customer information
      setFirstName(lastReservationDetails.firstName);
      setLastName(lastReservationDetails.lastName);
      setEmail(lastReservationDetails.email);
      setPhoneNumber(lastReservationDetails.phoneNumber);
      
      // Update selected services with the offered service
      setSelectedServices([currentOffer.Services]);
      
      // Set the selected date to the same day as the first reservation
      setSelectedDate(firstReservationDate);
      
      setShowConfirmationModal(false);
    } catch (error) {
      console.error("Error processing offer:", error);
      setConfirmationStatus('error');
    }
  };

  // Add function to handle offer decline
  const handleDeclineOffer = () => {
    setShowOfferModal(false);
    resetForm();
  };

  // Add function to reset form
  const resetForm = () => {
    setStep(1);
    setSelectedTeamMember(null);
    setSelectedServices([]);
    setSelectedSlot(null);
    setFirstName("");
    setLastName("");
    setPhoneNumber("");
    setEmail("");
    setCurrentOffer(null);
    setLastReservationDetails(null);
    setIsOfferBooking(false); // Reset the offer booking flag
  };

  // ── RENDER ─────────────────────────
  return (
    <div className="reservation-page min-h-screen bg-gray-50 flex flex-col">
      {/* Stepper */}
      <div 
        className="stepper py-4 text-white text-center shadow-md"
        style={themeStyles.accent}
      >
        <p className="text-xl font-bold">Step {step} of 4</p>
      </div>

      <main className="py-10 px-4 md:px-8 lg:px-16 flex-grow">
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl font-extrabold text-center text-gray-800 mb-10"
        >
          {translate('makeReservation')}
        </motion.h1>

        {step > 1 && !isOfferBooking && (
          <button
            onClick={() => setStep(step - 1)}
            className="mb-6 px-6 py-2.5 rounded-lg text-white font-medium flex items-center gap-2 transition-transform duration-300 hover:transform hover:translate-x-[-4px]"
            style={themeStyles.accent}
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {translate('back')}
          </button>
        )}

        {/* Step 1: Team Member Selection */}
        {step === 1 && (
          <div className="select-team-member mb-12">
            <h2 className="text-3xl font-bold text-gray-700 mb-8 text-center">
              {translate('selectTeamMember')}
            </h2>
            <div className="flex flex-wrap gap-6 justify-center">
              {teamMembers.map((member) => (
                <motion.div
                  key={member.id}
                  whileHover={{ scale: 1.05 }}
                  className={`team-member-card w-72 p-8 bg-white rounded-xl shadow-lg text-center cursor-pointer transition transform hover:shadow-xl ${
                    selectedTeamMember?.id === member.id ? 'border-2' : ''
                  }`}
                  style={selectedTeamMember?.id === member.id ? themeStyles.borderAccent : {}}
                  onClick={() => handleTeamMemberSelect(member)}
                >
                  {member.Users?.avatar ? (
                    <img
                      src={member.Users.avatar}
                      alt={`${member.Users.first_name} ${member.Users.last_name}`}
                      className="w-32 h-32 rounded-full mx-auto mb-6 object-cover shadow-md"
                    />
                  ) : (
                    <div 
                      className="w-32 h-32 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl font-bold text-white shadow-md"
                      style={themeStyles.accent}
                    >
                      {getInitials(member.Users?.first_name, member.Users?.last_name)}
                    </div>
                  )}
                  <h3 className="text-2xl font-semibold text-gray-800 mb-2">
                    {member.Users?.first_name} {member.Users?.last_name}
                  </h3>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Service Selection */}
        {step === 2 && selectedTeamMember && (
          <div className="select-service mb-12">
            <h2 className="text-3xl font-bold text-gray-700 mb-6 text-center">
              {translate('selectServices')}
            </h2>
            {services.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((service) => (
                  <motion.div
                    key={service.id}
                    whileHover={{ scale: 1.03 }}
                    className={`service-card p-6 rounded-lg shadow-lg cursor-pointer transition-all duration-300 ${
                      selectedServices.some((s) => s.id === service.id)
                        ? 'text-white'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                    style={selectedServices.some((s) => s.id === service.id) ? 
                      themeStyles.accent : 
                      { border: `2px solid ${themeData?.general?.color || '#4F46E5'}` }
                    }
                    onClick={() => handleServiceSelect(service)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className={`text-2xl font-semibold mb-1 ${
                          selectedServices.some((s) => s.id === service.id)
                            ? 'text-white'
                            : 'text-gray-800'
                        }`}>
                          {service.name}
                        </h3>
                        <p className={`text-lg ${
                          selectedServices.some((s) => s.id === service.id)
                            ? 'text-white'
                            : 'text-gray-600'
                        }`}>
                          {service.price} лв.
                        </p>
                      </div>
                      <div className={`p-2 rounded-full ${
                        selectedServices.some((s) => s.id === service.id)
                          ? 'bg-white bg-opacity-20'
                          : ''
                      }`}>
                        <FaCut className={`w-5 h-5 ${
                          selectedServices.some((s) => s.id === service.id)
                            ? 'text-white'
                            : 'text-gray-600'
                        }`} />
                      </div>
                    </div>
                    <div className={`text-sm ${
                      selectedServices.some((s) => s.id === service.id)
                        ? 'text-white text-opacity-90'
                        : 'text-gray-500'
                    }`}>
                      <div className="flex items-center gap-2">
                        <FaCalendarCheck className="w-4 h-4" />
                        <span>{service.timetomake} {translate('minutes')}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16 px-4 bg-white rounded-xl shadow-lg max-w-2xl mx-auto"
              >
                <div className="mb-6">
                  <svg 
                    className="w-16 h-16 mx-auto text-gray-400"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={1.5}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 21a9 9 0 110-18 9 9 0 010 18z" 
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  No Services Available
                </h3>
                <p className="text-gray-600 mb-6">
                  There are currently no services available for this team member.
                </p>
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white transition-transform duration-300 hover:transform hover:translate-x-[-4px]"
                  style={themeStyles.accent}
                >
                  <svg 
                    className="w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Select Another Team Member
                </button>
              </motion.div>
            )}
            {services.length > 0 && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setStep(3)}
                  disabled={selectedServices.length === 0}
                  className={`px-6 py-3 text-white rounded-lg shadow transition duration-300 ${
                    selectedServices.length === 0 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'transform hover:scale-105'
                  }`}
                  style={selectedServices.length === 0 ? {} : themeStyles.accent}
                >
                  {translate('next')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Date & Time Selection */}
        {step === 3 && selectedServices.length > 0 && (
          <div className="select-slot mb-12">
            <h2 className="text-3xl font-bold text-gray-700 mb-8 text-center">
              {isRescheduling ? translate('selectNewDateTime') : translate('selectDateTime')}
            </h2>
            <div className="flex flex-col md:flex-row gap-12 items-start justify-center max-w-6xl mx-auto">
              <div className="calendar-container w-full md:w-auto">
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => setSelectedDate(date)}
                  inline
                  minDate={isOfferBooking ? offerStartDate : new Date()}
                  maxDate={
                    isOfferBooking 
                      ? new Date(offerStartDate.getFullYear(), offerStartDate.getMonth() + 1, offerStartDate.getDate())
                      : new Date(new Date().setMonth(new Date().getMonth() + 1))
                  }
                  calendarContainer={CustomCalendarContainer}
                  calendarClassName="!bg-white !border-none w-full"
                  wrapperClassName="w-full"
                  dayClassName={(date) => {
                    const isSelected = date.toDateString() === selectedDate?.toDateString();
                    return isSelected ? "selected-day" : "default-day";
                  }}
                  renderCustomHeader={({
                    date,
                    decreaseMonth,
                    increaseMonth,
                    prevMonthButtonDisabled,
                    nextMonthButtonDisabled,
                  }) => (
                    <div className="flex justify-between items-center px-2 py-4 border-b border-gray-200 mb-4">
                      <button
                        onClick={decreaseMonth}
                        disabled={prevMonthButtonDisabled}
                        className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${
                          prevMonthButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <h3 className="text-xl font-semibold text-gray-800">
                        {translate(date.toLocaleString("default", { month: "long" }).toLowerCase())} {date.getFullYear()}
                      </h3>
                      <button
                        onClick={increaseMonth}
                        disabled={nextMonthButtonDisabled}
                        className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${
                          nextMonthButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                  formatWeekDay={(nameOfDay) => (
                    <div className="text-gray-500 font-medium text-center w-8 h-8 flex items-center justify-center">
                      {nameOfDay.slice(0, 1)}
                    </div>
                  )}
                />
                <style>
                  {`
                    .react-datepicker {
                      border: none !important;
                      font-family: inherit !important;
                    }
                    .react-datepicker__header {
                      background: white !important;
                      border-bottom: none !important;
                      padding-top: 0 !important;
                    }
                    .react-datepicker__day {
                      width: 2.5rem !important;
                      height: 2.5rem !important;
                      line-height: 2.5rem !important;
                      margin: 0.2rem !important;
                      font-size: 1rem !important;
                      font-weight: 500 !important;
                      border-radius: 9999px !important;
                      transition: all 0.2s ease-in-out !important;
                    }
                    .react-datepicker__day:hover:not(.react-datepicker__day--selected):not(.react-datepicker__day--disabled) {
                      background-color: ${getLighterShade(themeData?.general?.color, 0.1)} !important;
                      color: ${themeData?.general?.color || '#4F46E5'} !important;
                    }
                    .react-datepicker__day.selected-day {
                      background-color: ${themeData?.general?.color || '#4F46E5'} !important;
                      color: ${isLightColor(themeData?.general?.color) ? '#1F2937' : 'white'} !important;
                      font-weight: 600 !important;
                    }
                    .react-datepicker__day.default-day {
                      color: #4B5563 !important;
                    }
                    .react-datepicker__day--disabled {
                      color: #E5E7EB !important;
                      cursor: not-allowed !important;
                      background-color: transparent !important;
                      text-decoration: line-through !important;
                      opacity: 0.5 !important;
                    }
                    .react-datepicker__day--outside-month {
                      color: #D1D5DB !important;
                      opacity: 0.5 !important;
                    }
                    .react-datepicker__current-month {
                      font-size: 1.25rem !important;
                      font-weight: 600 !important;
                      color: #1f2937 !important;
                      margin-bottom: 0.5rem !important;
                    }
                    .react-datepicker__day-name {
                      width: 2.5rem !important;
                      font-weight: 500 !important;
                      color: #6B7280 !important;
                    }
                    .react-datepicker__month {
                      margin: 0.4rem !important;
                    }
                    .react-datepicker__day--keyboard-selected {
                      background-color: transparent !important;
                      color: inherit !important;
                    }
                    .react-datepicker__day--today:not(.react-datepicker__day--selected) {
                      font-weight: bold !important;
                      color: ${themeData?.general?.color || '#4F46E5'} !important;
                    }
                  `}
                </style>
              </div>

              <div className="available-slots flex-1 w-full md:max-w-md bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
                  {translate('availableTimeSlots')}
                </h3>
                {availableSlots.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-4">
                    {availableSlots.map((slot) => (
                      <motion.button
                        key={slot}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        className={`time-slot py-4 px-6 rounded-lg text-center cursor-pointer transition-all duration-200 ${
                          selectedSlot === slot
                            ? 'text-white shadow-lg'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                        }`}
                        style={selectedSlot === slot ? themeStyles.accent : {}}
                        onClick={() => handleSlotSelect(slot)}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <svg 
                            className="w-5 h-5" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                            />
                          </svg>
                          <span className="text-lg font-medium">{slot}</span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg 
                      className="w-16 h-16 mx-auto text-gray-400 mb-4"
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={1.5}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    <p className="text-gray-500 text-lg">
                      {translate('noAvailableSlots')} {selectedDate.toLocaleDateString()}
                    </p>
                    <p className="text-gray-400 mt-2">
                      {translate('selectAnotherDate')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Customer Information */}
        {step === 4 && (
          <div className="customer-info mb-12">
            <h2 className="text-3xl font-bold text-gray-700 mb-8 text-center">
              {translate('enterInformation')}
            </h2>
            <div className="max-w-xl mx-auto">
              <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                {/* Selected Services Summary */}
                <div className="mb-8 p-4 rounded-lg" style={{ backgroundColor: getLighterShade(themeData?.general?.color, 0.1) }}>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    {translate('bookingSummary')}
                  </h3>
                  <div className="space-y-2">
                    <p className="text-gray-600">
                      <span className="font-medium">{translate('teamMember')}:</span>{' '}
                      {selectedTeamMember?.Users?.first_name} {selectedTeamMember?.Users?.last_name}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">{translate('date')}:</span>{' '}
                      {formatDate(selectedDate, businessLanguage)}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">{translate('time')}:</span>{' '}
                      {selectedSlot}
                    </p>
                    <div className="border-t border-gray-200 my-2 pt-2">
                      <p className="font-medium text-gray-800 mb-1">{translate('selectedServices')}:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {selectedServices.map(service => (
                          <li key={service.id} className="text-gray-600 ml-2">
                            {service.name} - {service.price} лв.
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 font-medium mb-2" htmlFor="firstName">
                        {translate('firstName')}
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 transition-shadow"
                        style={{ 
                          focusRing: themeData?.general?.color ? 
                            `ring-${themeData.general.color}` : 
                            'ring-indigo-500' 
                        }}
                        placeholder={translate('enterYourFirstName')}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-2" htmlFor="lastName">
                        {translate('lastName')}
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 transition-shadow"
                        style={{ 
                          focusRing: themeData?.general?.color ? 
                            `ring-${themeData.general.color}` : 
                            'ring-indigo-500' 
                        }}
                        placeholder={translate('enterYourLastName')}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-2" htmlFor="email">
                      {translate('email')}
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 transition-shadow"
                      style={{ 
                        focusRing: themeData?.general?.color ? 
                          `ring-${themeData.general.color}` : 
                          'ring-indigo-500' 
                      }}
                      placeholder={translate('enterYourEmail')}
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-2" htmlFor="phoneNumber">
                      {translate('phoneNumber')}
                    </label>
                    <input
                      id="phoneNumber"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 transition-shadow"
                      style={{ 
                        focusRing: themeData?.general?.color ? 
                          `ring-${themeData.general.color}` : 
                          'ring-indigo-500' 
                      }}
                        placeholder={translate('enterYourPhone')}
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={confirmAppointment}
                      disabled={!firstName || !lastName || !phoneNumber || !email}
                      className={`w-full py-4 rounded-lg text-white font-medium shadow-md transition duration-300 flex items-center justify-center gap-2 ${
                        !firstName || !lastName || !phoneNumber || !email
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'transform hover:scale-[1.02]'
                      }`}
                      style={!firstName || !lastName || !phoneNumber || !email ? {} : themeStyles.accent}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12l3 3 5-5"
                        />
                      </svg>
                      {translate('confirmBooking')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer 
        className="text-white text-center py-6"
        style={themeStyles.accent}
      >
        <div className="container mx-auto px-4">
          <p className="text-sm mb-2">
            {themeData?.footer?.copyright || `© ${new Date().getFullYear()} All rights reserved.`}
          </p>
          {themeData?.footer?.additionalText && (
            <p className="text-sm opacity-75">{themeData.footer.additionalText}</p>
          )}
        </div>
      </footer>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl p-8 max-w-md w-full shadow-xl"
            >
              {confirmationStatus === 'processing' && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4">
                    <svg 
                      className="animate-spin w-full h-full text-gray-600" 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24"
                    >
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {translate('processing')}
                  </h3>
                  <p className="text-gray-600">
                    {translate('pleaseWait')}
                  </p>
                </div>
              )}

              {confirmationStatus === 'success' && (
                <div className="text-center">
                  <div 
                    className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: getLighterShade(themeData?.general?.color, 0.15) }}
                  >
                    <svg 
                      className="w-8 h-8"
                      style={{ color: themeData?.general?.color }}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {translate('reservationSubmitted')}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {translate('appointmentRequestSent')}
                  </p>
                  <div className="text-sm text-gray-500">
                    {translate('confirmationEmailSent')} {email}
                  </div>
                </div>
              )}

              {confirmationStatus === 'error' && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                    <svg 
                      className="w-8 h-8 text-red-600" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {translate('oops')}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {translate('reservationProcessingError')}
                  </p>
                  <button
                    onClick={() => setShowConfirmationModal(false)}
                    className="px-6 py-2 rounded-lg text-white transition duration-300"
                    style={themeStyles.accent}
                  >
                    {translate('tryAgain')}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offer Modal */}
      {showOfferModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-xl p-8 max-w-md w-full shadow-xl"
          >
            <div className="text-center">
              <div 
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: getLighterShade(themeData?.general?.color, 0.15) }}
              >
                <svg
                  className="w-8 h-8"
                  style={{ color: themeData?.general?.color }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round" 
                    strokeWidth={2}
                    d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {translate('specialOffer')}
              </h3>
              <p className="text-gray-600 mb-4">
                {translate('specialOfferDescription')}
              </p>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p className="text-gray-700 font-medium mb-2">
                  {translate('offerDetails')}:
                </p>
                <div className="space-y-2">
                  <p className="text-gray-600">
                    <span className="font-medium">{translate('service')}:</span>{' '}
                    {currentOffer?.Services?.name}
                  </p>
                  {currentOffer?.discount_percentage ? (
                    <p className="text-gray-600">
                      <span className="font-medium">{translate('discount')}:</span>{' '}
                      {currentOffer.discount_percentage}%
                    </p>
                  ) : (
                    <p className="text-gray-600">
                      <span className="font-medium">{translate('specialPrice')}:</span>{' '}
                      {currentOffer?.fixed_price} лв.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleDeclineOffer}
                  className="flex-1 px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  {translate('decline')}
                </button>
                <button
                  onClick={handleAcceptOffer}
                  className="flex-1 px-6 py-3 rounded-lg text-white font-medium shadow-md transition-transform hover:scale-105"
                  style={themeStyles.accent}
                >
                  {translate('accept')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default ReservationPage;
