import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaCut, FaUserTie, FaCalendarCheck } from "react-icons/fa";
import supabase from "../hooks/supabase";
import axios from 'axios';

// ── HELPER FUNCTIONS ─────────────────────────────
const timeStringToMinutes = (timeStr) => {
  const [hour, minute] = timeStr.split(":").map(Number);
  return hour * 60 + minute;
};

const minutesToTimeString = (minutes) => {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

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

// Custom calendar container
const CustomCalendarContainer = ({ className, children }) => {
  return (
    <div className={`p-4 bg-white rounded-lg shadow-lg ${className}`}>
      {children}
    </div>
  );
};

const ReservationPage = () => {
  const [step, setStep] = useState(1);
  const [teamMembers, setTeamMembers] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [themeData, setThemeData] = useState(null);

  const businessData = JSON.parse(localStorage.getItem("selectedBusiness") || "{}");
  const businessId = businessData.id;

  // Fetch theme data
  useEffect(() => {
    if (!businessId) return;
    
    const fetchThemeData = async () => {
      const { data, error } = await supabase
        .from("Business")
        .select("themeData")
        .eq("id", businessId)
        .single();
        
      if (error) {
        console.error("Error fetching theme data:", error);
      } else if (data?.themeData) {
        setThemeData(data.themeData);
        console.log("Theme data loaded:", data.themeData);
      }
    };

    fetchThemeData();
  }, [businessId]);

  // Fetch team members
  useEffect(() => {
    if (!businessId) return;
    (async () => {
      const { data, error } = await supabase
        .from("BusinessTeam")
        .select(`
          *,
          Users: userId (
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
        setTeamMembers(data);
      }
    })();
  }, [businessId]);

  // Fetch services for selected team member
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

  // Calculate available slots
  useEffect(() => {
    if (!selectedTeamMember || selectedServices.length === 0 || !selectedDate) return;

    const totalServiceTime = selectedServices.reduce(
      (total, service) => total + (Number(service.timetomake) || 30),
      0
    );

    const buffer = selectedTeamMember.bufferTime ? Number(selectedTeamMember.bufferTime) : 10;

    const computedSlots = computeSequentialAvailableSlots(
      selectedTeamMember.worktime,
      selectedDate,
      totalServiceTime,
      buffer
    );

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const fetchReservations = async () => {
      const { data, error } = await supabase
        .from("Reservations")
        .select("reservationAt, timeToMake")
        .eq("employeeId", selectedTeamMember.id)
        .in("status", ["Waiting for approval", "Approved"])
        .gte("reservationAt", startOfDay.toISOString())
        .lte("reservationAt", endOfDay.toISOString());

      if (error) {
        console.error("Error fetching reservations", error);
        setAvailableSlots(computedSlots);
      } else {
        const reservedIntervals = data.map((r) => {
          const resDate = new Date(r.reservationAt);
          const reservedStart = resDate.getHours() * 60 + resDate.getMinutes();
          const reservedTime = Number(r.timeToMake);
          return [reservedStart, reservedStart + reservedTime + buffer];
        });

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

        setAvailableSlots(freeSlots);
      }
    };

    fetchReservations();
  }, [selectedTeamMember, selectedServices, selectedDate]);

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

  const confirmAppointment = async () => {
    try {
      const totalServiceTime = selectedServices.reduce(
        (total, service) => total + (Number(service.timetomake) || 30),
        0
      );
      const [hours, minutes] = selectedSlot.split(":").map(Number);
      const reservationDate = new Date(selectedDate);
      reservationDate.setHours(hours, minutes, 0, 0);
      const reservationAt = reservationDate.toISOString();

      // Generate a random 8-digit number for the reservation ID
      const generateUniqueId = async () => {
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
          const id = Math.floor(10000000 + Math.random() * 90000000);
          
          const { data, error } = await supabase
            .from("Reservations")
            .select("id")
            .eq("id", id)
            .single();
          
          if (!error && !data) {
            return id;
          }
          
          attempts++;
        }
        throw new Error("Could not generate unique reservation ID");
      };

      const reservationId = await generateUniqueId();

      const { error } = await supabase.from("Reservations").insert({
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
        status: "Waiting for approval"
      });

      if (error) throw error;

      alert("Appointment confirmed!");

      try {
        const name = firstName + " " + lastName;
        const response = await axios.post('http://localhost:3000/pending-reservation', {
          name: name,
          business: "test",
          link: "https://example.com",
          email: email
        });

        console.log("Response:", response.data);
      } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
      }

      setStep(1);
      setSelectedTeamMember(null);
      setSelectedServices([]);
      setSelectedSlot(null);
      setFirstName("");
      setLastName("");
      setPhoneNumber("");
      setEmail("");

    } catch (error) {
      console.error("Error creating reservation:", error);
      alert("There was an error creating your reservation. Please try again.");
    }
  };

  return (
    <div className="reservation-page min-h-screen flex flex-col bg-gray-50">
      {/* Stepper */}
      <div 
        className="stepper py-4 text-white text-center shadow-md"
        style={{ backgroundColor: themeData?.general?.color || '#4F46E5' }}
      >
        <p className="text-xl font-bold">Step {step} of 4</p>
      </div>

      <main className="py-10 px-4 md:px-8 lg:px-16 flex-grow">
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl font-extrabold text-center mb-10 text-gray-800"
        >
          {themeData?.general?.actionButtonText || 'Make a Reservation'}
        </motion.h1>

        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="mb-6 px-4 py-2 rounded shadow text-white transition duration-300 self-start hover:opacity-90"
            style={{ backgroundColor: themeData?.general?.color || '#4F46E5' }}
          >
            ← Go Back
          </button>
        )}

        {/* Step 1: Team Member Selection */}
        {step === 1 && (
          <div className="select-team-member mb-12">
            <h2 className="text-3xl font-bold text-gray-700 mb-6 text-center">
              Select a Team Member
            </h2>
            <div className="flex flex-wrap gap-6 justify-center">
              {teamMembers.map((member) => (
                <motion.div
                  key={member.id}
                  whileHover={{ scale: 1.05 }}
                  className="team-member-card w-64 p-6 bg-white rounded-lg shadow-lg text-center cursor-pointer"
                  onClick={() => handleTeamMemberSelect(member)}
                >
                  <img
                    src={member.Users?.avatar || "/default-avatar.jpg"}
                    alt={`${member.Users?.first_name} ${member.Users?.last_name}`}
                    className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
                  />
                  <p className="text-xl font-semibold text-gray-800">
                    {member.Users?.first_name} {member.Users?.last_name}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Service Selection */}
        {step === 2 && selectedTeamMember && (
          <div className="select-service mb-12">
            <h2 className="text-3xl font-bold text-gray-700 mb-6 text-center">
              Select Services
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <motion.div
                  key={service.id}
                  whileHover={{ scale: 1.03 }}
                  className={`service-card p-6 text-white rounded-lg shadow-lg cursor-pointer transition transform ${
                    selectedServices.some((s) => s.id === service.id)
                      ? "border-4"
                      : ""
                  }`}
                  style={{ 
                    backgroundColor: themeData?.general?.color || '#4F46E5',
                    borderColor: selectedServices.some((s) => s.id === service.id)
                      ? '#ffffff'
                      : 'transparent'
                  }}
                  onClick={() => handleServiceSelect(service)}
                >
                  <div className="text-4xl mb-3">
                    {service.name === "Haircut" ? (
                      <FaCut />
                    ) : service.name === "Shaving" ? (
                      <FaUserTie />
                    ) : (
                      <FaCalendarCheck />
                    )}
                  </div>
                  <h3 className="text-2xl font-semibold mb-1">{service.name}</h3>
                  <p className="text-lg">${service.price}</p>
                </motion.div>
              ))}
            </div>
            <div className="text-center mt-8">
              <button
                onClick={() => setStep(3)}
                disabled={selectedServices.length === 0}
                className={`px-6 py-3 text-white rounded-lg shadow transition duration-300 ${
                  selectedServices.length === 0 ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"
                }`}
                style={{ backgroundColor: themeData?.general?.color || '#4F46E5' }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Date & Time Selection */}
        {step === 3 && selectedServices.length > 0 && (
          <div className="select-slot mb-12">
            <h2 className="text-3xl font-bold text-gray-700 mb-6 text-center">
              Select a Date and Time Slot
            </h2>
            <div className="flex flex-col md:flex-row gap-8 items-start justify-center">
              <div className="calendar-container max-w-sm w-full border border-gray-200 rounded-xl shadow-lg p-4">
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => setSelectedDate(date)}
                  inline
                  minDate={new Date()}
                  maxDate={new Date(new Date().setMonth(new Date().getMonth() + 1))}
                  calendarContainer={CustomCalendarContainer}
                />
              </div>
              <div className="available-slots flex-1 max-w-md">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">
                  Available Time Slots
                </h3>
                {availableSlots.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {availableSlots.map((slot) => (
                      <motion.div
                        key={slot}
                        whileHover={{ scale: 1.05 }}
                        className="time-slot p-4 rounded-lg shadow text-white text-center cursor-pointer hover:opacity-90 transition duration-300"
                        style={{ backgroundColor: themeData?.general?.color || '#4F46E5' }}
                        onClick={() => handleSlotSelect(slot)}
                      >
                        <p className="text-lg font-medium">{slot}</p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-center">
                    No available slots for {selectedDate.toLocaleDateString()}.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Customer Information */}
        {step === 4 && (
          <div className="customer-info mb-12">
            <h2 className="text-3xl font-bold text-gray-700 mb-6 text-center">
              Enter Your Information
            </h2>
            <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-200">
              <div className="mb-5">
                <label className="block text-gray-700 mb-2" htmlFor="firstName">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="mb-5">
                <label className="block text-gray-700 mb-2" htmlFor="lastName">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="mb-5">
                <label className="block text-gray-700 mb-2" htmlFor="phoneNumber">
                  Phone Number
                </label>
                <input
                  id="phoneNumber"
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 mb-2" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={confirmAppointment}
                disabled={!firstName || !lastName || !phoneNumber || !email}
                className={`w-full py-3 text-white rounded-lg shadow transition duration-300 ${
                  !firstName || !lastName || !phoneNumber || !email
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:opacity-90"
                }`}
                style={{ backgroundColor: themeData?.general?.color || '#4F46E5' }}
              >
                {themeData?.general?.actionButtonText || 'Confirm Appointment'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white text-center py-4">
        <p className="text-sm">
          {themeData?.footer?.copyright || '© 2024 Your Business Name. All rights reserved.'}
        </p>
      </footer>
    </div>
  );
};

export default ReservationPage; 