import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import supabase from "../hooks/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { translations } from '../translations/translations';

// Add the helper function for lighter shade calculation
const getLighterShade = (hexColor, opacity = 0.15) => {
  if (!hexColor) return 'rgba(79, 70, 229, 0.15)'; // default indigo color
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const ManageReservation = () => {
  const { id: reservationId } = useParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState(1); // 1: email, 2: verification code, 3: details
  const [verified, setVerified] = useState(false);
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [themeData, setThemeData] = useState(null);
  const [businessLanguage, setBusinessLanguage] = useState('english');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchReservation();
  }, [reservationId]);

  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        const { data, error } = await supabase
          .from("Business")
          .select("themeData, language")
          .eq("id", searchParams.get('businessId'))
          .single();

        if (error) throw error;
        setThemeData(data.themeData);
        setBusinessLanguage(data.language || 'english');
      } catch (err) {
        console.error("Error fetching business data:", err);
      }
    };

    if (searchParams.get('businessId')) {
      fetchBusinessData();
    }
  }, [searchParams]);

  const fetchReservation = async () => {
    try {
      // First fetch the reservation
      const { data: reservationData, error: reservationError } = await supabase
        .from("Reservations")
        .select(`
          *,
          Business (
            name,
            themeData
          ),
          BusinessTeam (
            Users (
              first_name,
              last_name
            )
          )
        `)
        .eq('id', reservationId)
        .single();

      if (reservationError) throw reservationError;

      setReservation(reservationData);
      setThemeData(reservationData.Business.themeData);
      setLoading(false);
    } catch (err) {
      setError("Reservation not found");
      setLoading(false);
    }
  };

  const requestEditCode = async () => {
    if (email === reservation.email) {
      // In a real application, send verification code to email
      setStep(2);
    } else {
      setError("There was an error try again with diffrent email.");
    }
  };

  const verifyCode = () => {
    // In production, verify against actual code sent to email
    if (code === "123456") {
      setVerified(true);
      setStep(3);
      setError(null);
    } else {
      setError("Invalid verification code");
    }
  };

  const cancelReservation = async () => {
    try {
      const { error: updateError } = await supabase
        .from("Reservations")
        .update({ status: "Cancelled" })
        .eq('id', reservationId);

      if (updateError) throw updateError;
      alert("Reservation cancelled successfully!");
    } catch (err) {
      setError("Failed to cancel reservation");
    }
  };

  // Create theme styles object
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

  // Translation helper function
  const translate = (key) => {
    const language = businessLanguage?.toLowerCase() === 'bulgarian' ? 'bg' : 'en';
    return translations[language]?.[key] || key;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2"
          style={themeStyles.borderAccent}
        ></div>
      </div>
    );
  }

  const accentColor = themeData?.general?.color || 'accent';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex-grow max-w-4xl mx-auto px-4 py-12 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white shadow-2xl rounded-2xl overflow-hidden"
          >
            {step === 1 && (
              <div className="p-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">
                  Verify Your Identity
                </h2>
                <div className={`w-16 h-1 bg-${accentColor}-600 mx-auto mb-6`}></div>
                
                {error && (
                  <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
                    {error}
                  </div>
                )}

                <div className="max-w-md mx-auto">
                  <div className="mb-6">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={requestEditCode}
                    style={themeStyles.accent}
                    className="w-full text-white py-3 rounded-lg hover:opacity-90 transform hover:scale-[1.02] transition-all duration-200"
                  >
                    {translate('continue')}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="p-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">
                  Enter Verification Code
                </h2>
                <div className={`w-16 h-1 bg-${accentColor}-600 mx-auto mb-6`}></div>

                {error && (
                  <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
                    {error}
                  </div>
                )}

                <div className="max-w-md mx-auto">
                  <div className="mb-6">
                    <input
                      type="text"
                      maxLength="6"
                      className="w-full px-4 py-3 text-center text-2xl tracking-widest rounded-lg border border-gray-200 focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    />
                    <p className="mt-2 text-sm text-gray-500 text-center">
                      Enter the 6-digit code sent to your email
                    </p>
                  </div>

                  <button
                    onClick={verifyCode}
                    style={themeStyles.accent}
                    className="w-full text-white py-3 rounded-lg hover:opacity-90 transform hover:scale-[1.02] transition-all duration-200"
                  >
                    {translate('verifyCode')}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && reservation && (
              <div className="p-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">
                  Reservation Details
                </h2>
                <div className={`w-16 h-1 bg-${accentColor} mx-auto mb-8`}></div>

                <div className="bg-gray-50 rounded-xl p-6 mb-8">
                  <div className="grid gap-4">
                    <div className="flex items-center border-b border-gray-200 pb-3">
                      <span className="text-gray-600 font-medium w-1/3">Reservation ID:</span>
                      <span className="text-gray-800 flex-1">{reservation.id}</span>
                    </div>
                    <div className="flex items-center border-b border-gray-200 pb-3">
                      <span className="text-gray-600 font-medium w-1/3">Name:</span>
                      <span className="text-gray-800 flex-1">
                        {reservation.firstName} {reservation.lastName}
                      </span>
                    </div>
                    <div className="flex items-center border-b border-gray-200 pb-3">
                      <span className="text-gray-600 font-medium w-1/3">Date & Time:</span>
                      <span className="text-gray-800 flex-1">
                        {new Date(reservation.reservationAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center border-b border-gray-200 pb-3">
                      <span className="text-gray-600 font-medium w-1/3">Services:</span>
                      <span className="text-gray-800 flex-1">
                        {reservation.services.join(", ")}
                      </span>
                    </div>
                    <div className="flex items-center border-b border-gray-200 pb-3">
                      <span className="text-gray-600 font-medium w-1/3">Status:</span>
                      <span className="text-gray-800 flex-1">{reservation.status}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {reservation.status !== 'Cancelled' && (
                    <>
                      <button
                        onClick={() => navigate(`/${reservation.businessId}/reservation?reschedule=${reservationId}`)}
                        style={themeStyles.accent}
                        className="w-full text-white py-3 px-4 rounded-lg hover:opacity-90 transform hover:scale-[1.02] transition-all duration-200"
                      >
                        {translate('rescheduleReservation')}
                      </button>
                      <button
                        onClick={cancelReservation}
                        style={themeStyles.accent}
                        className="w-full text-white py-3 px-4 rounded-lg hover:opacity-90 transform hover:scale-[1.02] transition-all duration-200"
                      >
                        {translate('cancelReservation')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer - Now properly positioned at the bottom */}
      <footer 
        className="py-6 mt-auto text-white text-center"
        style={themeStyles.accent}
      >
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-sm">
            {themeData?.footer?.copyright || `© ${new Date().getFullYear()} ${translate('allRightsReserved')}`}
          </p>
          {themeData?.footer?.additionalText && (
            <p className="text-sm opacity-75">{themeData.footer.additionalText}</p>
          )}
        </div>
      </footer>
    </div>
  );
};

export default ManageReservation;
