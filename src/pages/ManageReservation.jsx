import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import supabase from "../hooks/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { translations } from "../translations/translations";
import axios from "axios";

// Add getLighterShade function directly in the file
const getLighterShade = (hexColor, factor = 0.15) => {
  // Remove the # if present
  hexColor = hexColor.replace('#', '');
  
  // Convert hex to RGB
  let r = parseInt(hexColor.substring(0, 2), 16);
  let g = parseInt(hexColor.substring(2, 4), 16);
  let b = parseInt(hexColor.substring(4, 6), 16);
  
  // Make lighter
  r = Math.min(255, Math.round(r + (255 - r) * factor));
  g = Math.min(255, Math.round(g + (255 - g) * factor));
  b = Math.min(255, Math.round(b + (255 - b) * factor));
  
  // Convert back to hex
  const rHex = r.toString(16).padStart(2, '0');
  const gHex = g.toString(16).padStart(2, '0');
  const bHex = b.toString(16).padStart(2, '0');
  
  return `#${rHex}${gHex}${bHex}`;
};

const ManageReservation = () => {
  const { id: reservationId } = useParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState(1);
  const [verified, setVerified] = useState(false);
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [business, setBusiness] = useState(null);
  const [themeData, setThemeData] = useState(null);
  const [businessLanguage, setBusinessLanguage] = useState('bulgarian');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First fetch the reservation
        const { data: reservationData, error: reservationError } = await supabase
          .from("Reservations")
          .select(`
            *,
            Business (
              id,
              name,
              themeData,
              language
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
        setBusiness(reservationData.Business);
        setThemeData(reservationData.Business.themeData);
        setBusinessLanguage(reservationData.Business.language || 'bulgarian');
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Reservation not found");
        setLoading(false);
      }
    };

    fetchData();
  }, [reservationId]);

  const requestEditCode = async () => {
    if (email === reservation.email) {
      try {
        setIsRequestingCode(true);
        setError(null);
        
        const response = await axios.post(`${BACKEND_EMAIL_URL}/send-confirmation-code`, {
          reservationId,
          email
        });

        if (response.status === 200) {
          setStep(2);
        }
      } catch (err) {
        setError(translate('failedToSendCode'));
      } finally {
        setIsRequestingCode(false);
      }
    } else {
      setError(translate('invalidEmail'));
    }
  };

  const verifyCode = async () => {
    try {
      setIsVerifyingCode(true);
      setError(null);

      const response = await axios.post(`${BACKEND_EMAIL_URL}/verify-confirmation-code`, {
        reservationId,
        email,
        code
      });

      if (response.status === 200) {
        setVerified(true);
        setStep(3);
        setError(null);
      }
    } catch (err) {
      setError(translate('invalidVerificationCode'));
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const cancelReservation = async () => {
    try {
      const { error: updateError } = await supabase
        .from("Reservations")
        .update({ status: "cancelled" })
        .eq('id', reservationId);

      if (updateError) throw updateError;

      // Send cancellation email
      await axios.post(`${BACKEND_EMAIL_URL}/rejected-reservation`, {
        name: `${reservation.firstName} ${reservation.lastName}`,
        business: business.name,
        email: reservation.email,
        reason: translate('cancelledByUser')
      });

      setShowCancelSuccess(true);
      fetchReservation();
    } catch (err) {
      setError(translate('failedToCancelReservation'));
    }
  };

  // Create theme styles object
  const themeStyles = {
    accent: themeData?.general?.color ? 
      { backgroundColor: themeData.general.color } : 
      { backgroundColor: '#4F46E5' },
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
                  {translate('verifyIdentity')}
                </h2>
                <div className="w-16 h-1 mx-auto mb-6" style={themeStyles.accent}></div>
                
                {error && (
                  <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
                    {error}
                  </div>
                )}

                <div className="max-w-md mx-auto">
                  <div className="mb-6">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      {translate('email')}
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                      placeholder={translate('enterYourEmail')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isRequestingCode}
                    />
                  </div>

                  <button
                    onClick={requestEditCode}
                    style={themeStyles.accent}
                    className="w-full text-white py-3 rounded-lg hover:opacity-90 transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center"
                    disabled={isRequestingCode}
                  >
                    {isRequestingCode ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                        {translate('sending')}
                      </>
                    ) : (
                      translate('continue')
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="p-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">
                  {translate('enterVerificationCode')}
                </h2>
                <div className="w-16 h-1 mx-auto mb-6" style={themeStyles.accent}></div>

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
                      disabled={isVerifyingCode}
                    />
                    <p className="mt-2 text-sm text-gray-500 text-center">
                      {translate('enterVerificationCodeSent')}
                    </p>
                    <button
                      onClick={requestEditCode}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 block mx-auto"
                    >
                      {translate('resendCode')}
                    </button>
                  </div>

                  <button
                    onClick={verifyCode}
                    style={themeStyles.accent}
                    className="w-full text-white py-3 rounded-lg hover:opacity-90 transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center"
                    disabled={isVerifyingCode}
                  >
                    {isVerifyingCode ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                        {translate('verifying')}
                      </>
                    ) : (
                      translate('verifyCode')
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && reservation && (
              <div className="p-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">
                  {translate('reservationDetails')}
                </h2>
                <div className="w-16 h-1 mx-auto mb-8" style={themeStyles.accent}></div>

                {reservation.status === 'cancelled' && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-600 text-center font-medium">
                      {translate('reservationCancelledMessage')}
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-6 mb-8">
                  <div className="grid gap-4">
                    <div className="flex items-center border-b border-gray-200 pb-3">
                      <span className="text-gray-600 font-medium w-1/3">{translate('reservationId')}:</span>
                      <span className="text-gray-800 flex-1">{reservation.id}</span>
                    </div>
                    <div className="flex items-center border-b border-gray-200 pb-3">
                      <span className="text-gray-600 font-medium w-1/3">{translate('name')}:</span>
                      <span className="text-gray-800 flex-1">
                        {reservation.firstName} {reservation.lastName}
                      </span>
                    </div>
                    <div className="flex items-center border-b border-gray-200 pb-3">
                      <span className="text-gray-600 font-medium w-1/3">{translate('dateTime')}:</span>
                      <span className="text-gray-800 flex-1">
                        {new Date(reservation.reservationAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center border-b border-gray-200 pb-3">
                      <span className="text-gray-600 font-medium w-1/3">{translate('services')}:</span>
                      <span className="text-gray-800 flex-1">
                        {reservation.services.join(", ")}
                      </span>
                    </div>
                    <div className="flex items-center border-b border-gray-200 pb-3">
                      <span className="text-gray-600 font-medium w-1/3">{translate('status')}:</span>
                      <span className={`flex-1 ${reservation.status === 'cancelled' ? 'text-red-600 font-medium' : 'text-gray-800'}`}>
                        {translate(reservation.status.toLowerCase())}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {reservation.status !== 'cancelled' && (
                    <>
                      <button
                        onClick={() => navigate(`/${business.id}/reservation?reschedule=${reservationId}`)}
                        style={themeStyles.accent}
                        className="w-full text-white py-3 px-4 rounded-lg hover:opacity-90 transform hover:scale-[1.02] transition-all duration-200"
                      >
                        {translate('rescheduleReservation')}
                      </button>
                      <button
                        onClick={cancelReservation}
                        className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transform hover:scale-[1.02] transition-all duration-200"
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

      {showCancelSuccess && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold">{translate('reservationCancelledSuccess')}</h3>
            <button
              onClick={() => setShowCancelSuccess(false)}
              className="mt-4 bg-blue-500 text-white py-2 px-4 rounded"
            >
              {translate('ok')}
            </button>
          </div>
        </div>
      )}

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
